import { requireJwt } from "../_shared/require-jwt.ts";
import {
  assertDealAccess,
  createServiceClient,
  fetchDealEventsForChain,
  getAuditChainVerificationInstructions,
  verifyDealAuditChain,
} from "../_shared/audit-chain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const { deal_id } = await req.json().catch(() => ({}));

    if (!deal_id || typeof deal_id !== "string") {
      return new Response(JSON.stringify({ error: "deal_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    await assertDealAccess(supabase, userId, deal_id);

    const [verification, events] = await Promise.all([
      verifyDealAuditChain(supabase, deal_id),
      fetchDealEventsForChain(supabase, deal_id),
    ]);

    const chainRootHash = events.at(-1)?.event_hash ?? null;

    return new Response(JSON.stringify({
      deal_id,
      exported_at: new Date().toISOString(),
      events,
      chain_root_hash: chainRootHash,
      verification_instructions: getAuditChainVerificationInstructions(chainRootHash),
      verification_summary: verification,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(await error.text(), {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});