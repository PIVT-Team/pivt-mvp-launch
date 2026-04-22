import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authHeader } = await requireJwt(req, corsHeaders);
    const { deal_id } = await req.json();

    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.functions.invoke("enqueue-job", {
      body: {
        queue_name: "deal_graph_builds",
        deal_id,
        job_type: "build_deal_graph",
        payload: { deal_id },
      },
      headers: { Authorization: authHeader },
    });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      queued: true,
      job_status_id: data?.job_status_id ?? null,
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
});