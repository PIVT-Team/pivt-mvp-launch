import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_QUEUES = new Set([
  "deal_graph_builds",
  "document_ai_extraction",
  "discrepancy_sweeps",
  "email_notifications",
  "audit_chain_updates",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const { queue_name, deal_id, job_type, payload } = await req.json();

    if (!queue_name || !job_type) {
      return new Response(JSON.stringify({ error: "queue_name and job_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_QUEUES.has(queue_name)) {
      return new Response(JSON.stringify({ error: "Unsupported queue_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const enrichedPayload = {
      ...(payload && typeof payload === "object" ? payload : {}),
      enqueued_by: userId,
    };

    const { data: jobId, error } = await supabase.rpc("enqueue_job_status", {
      p_queue_name: queue_name,
      p_deal_id: deal_id ?? null,
      p_job_type: job_type,
      p_payload: enrichedPayload,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ job_status_id: jobId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const response = error instanceof Response
      ? error
      : new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    return response;
  }
});