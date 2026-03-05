import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);

    // GET: validate token and return request info
    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(token);
      const { data: verReq, error } = await adminClient
        .from("verification_requests")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error || !verReq) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired verification link" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiry
      if (new Date(verReq.expires_at) < new Date()) {
        await adminClient
          .from("verification_requests")
          .update({ status: "expired" })
          .eq("id", verReq.id);
        return new Response(
          JSON.stringify({ error: "This verification link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already used
      if (["submitted", "verified", "revoked", "expired"].includes(verReq.status)) {
        return new Response(
          JSON.stringify({ error: "This verification link has already been used", status: verReq.status }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as opened
      if (verReq.status === "sent") {
        await adminClient
          .from("verification_requests")
          .update({ status: "opened", opened_at: new Date().toISOString() })
          .eq("id", verReq.id);
      }

      // Get deal info
      const { data: deal } = await adminClient
        .from("deals")
        .select("deal_name")
        .eq("id", verReq.deal_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          valid: true,
          request_id: verReq.id,
          recipient_name: verReq.recipient_name,
          recipient_email: verReq.recipient_email,
          stakeholder_type: verReq.stakeholder_type,
          deal_name: deal?.deal_name || "Transaction",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: submit verification data
    if (req.method === "POST") {
      const { token, submission, consent_accepted, documents } = await req.json();
      if (!token || !submission) {
        return new Response(
          JSON.stringify({ error: "Token and submission data are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenHash = await hashToken(token);
      const { data: verReq, error } = await adminClient
        .from("verification_requests")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error || !verReq) {
        return new Response(
          JSON.stringify({ error: "Invalid verification link" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(verReq.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This verification link has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (["submitted", "verified", "revoked", "expired"].includes(verReq.status)) {
        return new Response(
          JSON.stringify({ error: "This verification has already been completed" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create verification submission record
      await adminClient
        .from("verification_submissions")
        .insert({
          verification_request_id: verReq.id,
          payload_json: submission,
          consent_accepted: consent_accepted || false,
        });

      // Create verification document records
      if (documents && Array.isArray(documents)) {
        for (const doc of documents) {
          await adminClient
            .from("verification_documents")
            .insert({
              verification_request_id: verReq.id,
              file_name: doc.fileName,
              file_url: doc.fileUrl,
              doc_type: doc.docType,
            });
        }
      }

      // Update verification request
      await adminClient
        .from("verification_requests")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submission_data: submission,
        })
        .eq("id", verReq.id);

      // Update stakeholder verification_status
      await adminClient
        .from("cap_table_entries")
        .update({ verification_status: "submitted" })
        .eq("id", verReq.stakeholder_id);

      return new Response(
        JSON.stringify({ success: true, message: "Verification submitted successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Verify-token error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
