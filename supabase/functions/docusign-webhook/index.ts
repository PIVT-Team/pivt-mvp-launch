import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LEGITIMATELY_UNAUTHENTICATED
 *
 * This function is a DocuSign webhook receiver called by DocuSign's external delivery system.
 * It cannot require an end-user JWT because the caller is not a signed-in app user.
 * It remains public so provider callbacks can update approval state.
 */

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

  try {
    const payload = await req.json();

    // DocuSign Connect webhook payload
    const envelopeId = payload.envelopeId || payload.EnvelopeStatus?.EnvelopeID;
    const status = payload.status || payload.EnvelopeStatus?.Status;

    if (!envelopeId) {
      return new Response(
        JSON.stringify({ error: "No envelope ID in webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find approval record by envelope_id
    const { data: approval } = await supabase
      .from("deal_approvals")
      .select("id, deal_id, approver_name, status")
      .eq("envelope_id", envelopeId)
      .maybeSingle();

    if (!approval) {
      console.log(`No approval found for envelope ${envelopeId}`);
      return new Response(
        JSON.stringify({ received: true, matched: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map DocuSign status
    const statusMap: Record<string, string> = {
      sent: "sent",
      delivered: "viewed",
      completed: "completed",
      declined: "declined",
      voided: "expired",
    };

    const newStatus = statusMap[status?.toLowerCase()] || approval.status;
    const updateFields: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() };

    if (newStatus === "viewed") updateFields.viewed_at = new Date().toISOString();
    if (newStatus === "completed") updateFields.completed_at = new Date().toISOString();
    if (newStatus === "declined") updateFields.declined_at = new Date().toISOString();
    if (newStatus === "expired") updateFields.expired_at = new Date().toISOString();

    await supabase.from("deal_approvals").update(updateFields).eq("id", approval.id);

    // Audit log
    await supabase.from("audit_log").insert({
      deal_id: approval.deal_id,
      action: `approval_${newStatus}_webhook`,
      details: {
        approval_id: approval.id,
        approver_name: approval.approver_name,
        envelope_id: envelopeId,
        source: "docusign_webhook",
      },
    });

    return new Response(
      JSON.stringify({ received: true, matched: true, new_status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("DocuSign webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
