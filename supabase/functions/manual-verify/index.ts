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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const requestId = url.pathname.split("/").pop();

    if (req.method === "GET") {
      // List verification requests for a deal
      const dealId = url.searchParams.get("deal_id");
      if (!dealId) {
        return new Response(
          JSON.stringify({ error: "deal_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: requests, error } = await adminClient
        .from("verification_requests")
        .select(`
          *,
          submissions:verification_submissions(*),
          documents:verification_documents(*)
        `)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ requests }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const { verified, notes, request_id } = await req.json();
      if (!request_id) {
        return new Response(
          JSON.stringify({ error: "request_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the verification request
      const { data: verReq, error: fetchErr } = await adminClient
        .from("verification_requests")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();

      if (fetchErr || !verReq) {
        return new Response(
          JSON.stringify({ error: "Verification request not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date().toISOString();
      const newStatus = verified ? "verified" : "expired";
      const stakeholderStatus = verified ? "verified" : "failed";

      // Update verification request
      await adminClient
        .from("verification_requests")
        .update({
          status: newStatus,
          verified_at: verified ? now : null,
          verified_by_user_id: userId,
          manual_review_notes: notes || null,
          updated_at: now,
        })
        .eq("id", request_id);

      // Update stakeholder verification_status + tracking fields
      const stakeholderUpdate: Record<string, unknown> = {
        verification_status: stakeholderStatus,
        verification_completed_at: now,
      };
      if (!verified && notes) {
        stakeholderUpdate.verification_rejection_reason = notes;
      }
      await adminClient
        .from("cap_table_entries")
        .update(stakeholderUpdate)
        .eq("id", verReq.stakeholder_id);

      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          stakeholder_status: stakeholderStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Manual-verify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
