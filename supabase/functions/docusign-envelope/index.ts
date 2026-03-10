import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { action, user_id, deal_id, approval_id, approver_name, approver_email, message } = await req.json();

  try {
    // Get DocuSign connection
    const { data: conn } = await supabase
      .from("docusign_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "connected")
      .maybeSingle();

    if (!conn) {
      return new Response(
        JSON.stringify({ error: "DocuSign not connected. Please connect your account first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      // Attempt token refresh
      const DOCUSIGN_CLIENT_ID = Deno.env.get("DOCUSIGN_CLIENT_ID")!;
      const DOCUSIGN_CLIENT_SECRET = Deno.env.get("DOCUSIGN_CLIENT_SECRET")!;
      const credentials = btoa(`${DOCUSIGN_CLIENT_ID}:${DOCUSIGN_CLIENT_SECRET}`);

      const refreshRes = await fetch("https://account-d.docusign.com/oauth/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${conn.refresh_token}`,
      });

      if (!refreshRes.ok) {
        await supabase.from("docusign_connections").update({ status: "expired" }).eq("id", conn.id);
        return new Response(
          JSON.stringify({ error: "DocuSign session expired. Please reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await refreshRes.json();
      await supabase.from("docusign_connections").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("id", conn.id);

      conn.access_token = tokens.access_token;
    }

    const baseUri = conn.base_uri || "https://demo.docusign.net";
    const accountId = conn.account_id;

    if (action === "send_envelope") {
      // Create and send envelope
      const envelope = {
        emailSubject: `Approval Request: Please review and sign`,
        emailBlurb: message || "Please review and approve this document.",
        status: "sent",
        recipients: {
          signers: [{
            email: approver_email,
            name: approver_name,
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [{
                documentId: "1",
                pageNumber: "1",
                xPosition: "100",
                yPosition: "700",
              }],
            },
          }],
        },
        documents: [{
          documentBase64: btoa("Approval request for deal execution. Please sign to confirm your approval."),
          name: "Approval Request",
          fileExtension: "txt",
          documentId: "1",
        }],
      };

      const envRes = await fetch(
        `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${conn.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(envelope),
        }
      );

      if (!envRes.ok) {
        const errBody = await envRes.text();
        throw new Error(`DocuSign API error [${envRes.status}]: ${errBody}`);
      }

      const envData = await envRes.json();

      // Update approval record
      await supabase.from("deal_approvals").update({
        envelope_id: envData.envelopeId,
        status: "sent",
        sent_at: new Date().toISOString(),
        delivery_method: "docusign",
      }).eq("id", approval_id);

      // Audit log
      await supabase.from("audit_log").insert({
        deal_id,
        user_id,
        action: "approval_sent_docusign",
        details: {
          approval_id,
          approver_name,
          approver_email,
          envelope_id: envData.envelopeId,
        },
      });

      return new Response(
        JSON.stringify({ success: true, envelope_id: envData.envelopeId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check_status") {
      // Get envelope status
      const { data: approval } = await supabase
        .from("deal_approvals")
        .select("envelope_id")
        .eq("id", approval_id)
        .single();

      if (!approval?.envelope_id) {
        return new Response(
          JSON.stringify({ status: "not_sent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusRes = await fetch(
        `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${approval.envelope_id}`,
        {
          headers: { "Authorization": `Bearer ${conn.access_token}` },
        }
      );

      if (!statusRes.ok) {
        throw new Error(`Failed to check envelope status: ${statusRes.status}`);
      }

      const statusData = await statusRes.json();

      // Map DocuSign status to our status
      const statusMap: Record<string, string> = {
        created: "draft",
        sent: "sent",
        delivered: "viewed",
        completed: "completed",
        declined: "declined",
        voided: "expired",
      };

      const mappedStatus = statusMap[statusData.status] || statusData.status;

      // Update approval record
      const updateFields: Record<string, any> = { status: mappedStatus };
      if (mappedStatus === "viewed") updateFields.viewed_at = new Date().toISOString();
      if (mappedStatus === "completed") updateFields.completed_at = new Date().toISOString();
      if (mappedStatus === "declined") updateFields.declined_at = new Date().toISOString();
      if (mappedStatus === "expired") updateFields.expired_at = new Date().toISOString();

      await supabase.from("deal_approvals").update(updateFields).eq("id", approval_id);

      return new Response(
        JSON.stringify({ status: mappedStatus, raw_status: statusData.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "resend") {
      const { data: approval } = await supabase
        .from("deal_approvals")
        .select("envelope_id, reminder_count")
        .eq("id", approval_id)
        .single();

      if (approval?.envelope_id) {
        // Resend notification via DocuSign
        await fetch(
          `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${approval.envelope_id}`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${conn.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "sent" }),
          }
        );
      }

      await supabase.from("deal_approvals").update({
        reminder_count: (approval?.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      }).eq("id", approval_id);

      // Audit log
      await supabase.from("audit_log").insert({
        deal_id,
        user_id,
        action: "approval_reminder_sent",
        details: { approval_id, approver_name },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("DocuSign envelope error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
