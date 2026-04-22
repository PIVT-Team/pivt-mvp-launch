import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type DealEventChainRow = {
  id: string;
  deal_id: string;
  event_type: string;
  actor_id: string | null;
  payload: unknown;
  created_at: string;
  prev_hash: string | null;
  event_hash: string | null;
  chain_sequence: number | null;
};

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function assertDealAccess(supabase: ReturnType<typeof createServiceClient>, userId: string, dealId: string) {
  const { data, error } = await supabase.rpc("is_deal_accessible", {
    _user_id: userId,
    _deal_id: dealId,
  });

  if (error) throw error;
  if (!data) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function fetchDealEventsForChain(supabase: ReturnType<typeof createServiceClient>, dealId: string) {
  const { data, error } = await supabase
    .from("deal_events")
    .select("id, deal_id, event_type, actor_id, payload, created_at, prev_hash, event_hash, chain_sequence")
    .eq("deal_id", dealId)
    .not("chain_sequence", "is", null)
    .order("chain_sequence", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DealEventChainRow[];
}

export async function recomputeEventHash(supabase: ReturnType<typeof createServiceClient>, eventId: string) {
  const { data, error } = await supabase.rpc("compute_event_hash", { event_id: eventId });
  if (error) throw error;
  return data as string;
}

export async function verifyDealAuditChain(supabase: ReturnType<typeof createServiceClient>, dealId: string) {
  const events = await fetchDealEventsForChain(supabase, dealId);

  if (events.length === 0) {
    return {
      valid: true,
      total_events: 0,
      first_event_at: null,
      last_event_at: null,
    };
  }

  let previousHash = "GENESIS";

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSequence = index + 1;

    if (event.chain_sequence !== expectedSequence) {
      return {
        valid: false,
        total_events: events.length,
        first_event_at: events[0]?.created_at ?? null,
        last_event_at: events.at(-1)?.created_at ?? null,
        broken_at_sequence: event.chain_sequence ?? expectedSequence,
      };
    }

    if ((event.prev_hash ?? "GENESIS") !== previousHash) {
      return {
        valid: false,
        total_events: events.length,
        first_event_at: events[0]?.created_at ?? null,
        last_event_at: events.at(-1)?.created_at ?? null,
        broken_at_sequence: event.chain_sequence ?? expectedSequence,
      };
    }

    const recomputedHash = await recomputeEventHash(supabase, event.id);
    if ((event.event_hash ?? "") !== recomputedHash) {
      return {
        valid: false,
        total_events: events.length,
        first_event_at: events[0]?.created_at ?? null,
        last_event_at: events.at(-1)?.created_at ?? null,
        broken_at_sequence: event.chain_sequence ?? expectedSequence,
      };
    }

    previousHash = event.event_hash ?? "";
  }

  return {
    valid: true,
    total_events: events.length,
    first_event_at: events[0]?.created_at ?? null,
    last_event_at: events.at(-1)?.created_at ?? null,
  };
}

export function getAuditChainVerificationInstructions(chainRootHash: string | null) {
  return [
    "Start with the first event in sequence order and confirm its prev_hash is exactly 'GENESIS'.",
    "For each following event, confirm prev_hash exactly matches the prior event's event_hash.",
    "For each event, recompute SHA-256 over deal_id, event_type, actor_id, payload content, created_at, and prev_hash joined with pipe characters in that order.",
    "Confirm the recomputed digest matches the stored event_hash for every row.",
    chainRootHash
      ? `If every step matches, the exported chain root hash should equal ${chainRootHash}.`
      : "No post-migration chained events exist yet for this deal, so there is no chain root hash to verify.",
  ];
}