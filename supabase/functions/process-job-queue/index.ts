import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildDealGraphJob } from "../_shared/build-deal-graph.ts";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROCESSABLE_QUEUES = new Set([
  "deal_graph_builds",
  "document_ai_extraction",
  "discrepancy_sweeps",
  "email_notifications",
  "audit_chain_updates",
]);

async function dispatchJob(
  supabase: any,
  jobType: string,
  payload: Record<string, unknown>,
) {
  switch (jobType) {
    case "build_deal_graph": {
      const dealId = typeof payload.deal_id === "string" ? payload.deal_id : null;
      if (!dealId) throw new Error("deal_id missing from job payload");
      return await buildDealGraphJob(supabase, dealId);
    }
    default:
      throw new Error(`Unsupported job_type: ${jobType}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claims } = await requireJwt(req, corsHeaders);
    if (claims.role !== "service_role") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const queueName = typeof body.queue_name === "string" ? body.queue_name : null;

    if (!queueName || !PROCESSABLE_QUEUES.has(queueName)) {
      return new Response(JSON.stringify({ error: "Valid queue_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: jobs, error: readError } = await supabase.rpc("claim_next_job", {
      p_queue_name: queueName,
      p_visibility_timeout: 30,
      p_qty: 1,
    });

    if (readError) throw readError;

    const job = jobs?.[0];
    if (!job) {
      return new Response(JSON.stringify({ processed: false, reason: "empty_queue" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (job.message && typeof job.message === "object" ? job.message : {}) as Record<string, unknown>;
    const { data: startedJob, error: startError } = await supabase.rpc("start_job_processing", {
      p_job_status_id: job.job_status_id,
    });

    if (startError) throw startError;
    if (!startedJob) {
      return new Response(JSON.stringify({ processed: false, reason: "job_not_ready" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const result = await dispatchJob(supabase, job.job_type, payload);

      const { error: completeError } = await supabase.rpc("complete_job_processing", {
        p_job_status_id: job.job_status_id,
        p_result: result,
      });
      if (completeError) throw completeError;

      const { error: ackError } = await supabase.rpc("ack_job_message", {
        p_queue_name: queueName,
        p_msg_id: job.msg_id,
      });
      if (ackError) throw ackError;

      return new Response(JSON.stringify({
        processed: true,
        job_status_id: job.job_status_id,
        status: "completed",
        result,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      const attempts = Number(startedJob.attempts ?? 0);
      const maxAttempts = Number(startedJob.max_attempts ?? 3);
      const retryDelayMinutes = Math.max(1, 2 ** attempts);

      const { data: failedJob, error: failError } = await supabase.rpc("fail_job_processing", {
        p_job_status_id: job.job_status_id,
        p_error: error instanceof Error ? error.message : "Unexpected error",
        p_retry_delay_minutes: retryDelayMinutes,
      });
      if (failError) throw failError;

      const terminalFailure = attempts >= maxAttempts;
      if (terminalFailure) {
        const { error: ackError } = await supabase.rpc("ack_job_message", {
          p_queue_name: queueName,
          p_msg_id: job.msg_id,
        });
        if (ackError) throw ackError;
      }

      return new Response(JSON.stringify({
        processed: true,
        job_status_id: job.job_status_id,
        status: failedJob?.status ?? (terminalFailure ? "failed" : "queued"),
        next_retry_at: failedJob?.next_retry_at ?? null,
        error: error instanceof Error ? error.message : "Unexpected error",
      }), {
        status: terminalFailure ? 500 : 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return error instanceof Response
      ? error
      : new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
});