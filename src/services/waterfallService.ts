/**
 * The waterfall screen, connected to the engine.
 *
 * Until now the screen kept its tiers in a zustand store with no persistence —
 * a waterfall someone built was gone on refresh — and computed payouts with
 * its own float arithmetic, while `waterfall_tiers`, `waterfall_allocations`
 * and the engine's `calculate-waterfall` sat unused. Two sets of numbers, one
 * of them never saved.
 *
 * Now: the store's arithmetic IS the engine's — `calculateWaterfall` from
 * `_shared/waterfall.ts` runs in the browser for instant feedback and in the
 * engine for the persisted snapshot, so what a person sees while editing is
 * what gets recorded, to the cent. Tiers persist to `waterfall_tiers`, with the
 * screen's full tier model kept in `params.client` so no schema change is
 * needed. `runEngine` records the allocation snapshot, its lines, and the draft
 * disbursement intents.
 */
import { supabase } from "@/integrations/supabase/client";
import { calculateWaterfall } from "@shared/waterfall";
import type { WaterfallTier, RecipientAllocation, TierStatus } from "@/stores/waterfallStore";

// ── store → engine ──────────────────────────────────────────────────────────
type EngineTier = { id: string; tier_rank: number; name: string; allocation_logic_type: string; params: Record<string, unknown> };
type EngineRecipient = { id: string; name: string; ownership_pct: number };

export function toEngineInput(tiers: WaterfallTier[]): { tiers: EngineTier[]; recipients: EngineRecipient[] } {
  const recipients = new Map<string, EngineRecipient>();
  const engineTiers = [...tiers]
    .sort((a, b) => a.priority - b.priority)
    .map((t) => {
      for (const r of t.recipients) {
        recipients.set(r.id, { id: r.id, name: r.externalName, ownership_pct: r.amountOrPercent });
      }
      const params: Record<string, unknown> = {
        recipient_ids: t.recipients.map((r) => r.id),
        recipient_allocations: t.recipients.map((r) => ({
          recipient_id: r.id,
          type: r.allocationType === "FIXED_AMOUNT" ? "fixed"
              : r.allocationType === "PERCENT_OF_TIER" ? "percent_of_tier" : "pro_rata",
          value: r.amountOrPercent,
        })),
        ...(t.capAmount != null && t.capAmount > 0 ? { cap_amount: t.capAmount } : {}),
      };
      let logic: string;
      switch (t.ruleType) {
        case "FIXED_AMOUNT":    logic = "fixed";      params.amount = t.ruleValue; break;
        case "PERCENT_OF_POOL": logic = "percentage"; params.percentage = t.ruleValue; break;
        case "WATERFALL_CAP":   logic = "threshold";  params.cap = t.ruleValue; break;
        default:                logic = "pro_rata";
      }
      return { id: t.id, tier_rank: t.priority, name: t.name, allocation_logic_type: logic, params };
    });
  return { tiers: engineTiers, recipients: Array.from(recipients.values()) };
}

// ── the arithmetic the screen shows ─────────────────────────────────────────
export function computeLocal(pool: number, tiers: WaterfallTier[]): {
  tiers: WaterfallTier[]; unallocated: number; hasDiscrepancy: boolean;
} {
  const input = toEngineInput(tiers);
  const result = calculateWaterfall(pool, input.tiers, input.recipients);

  const payout = new Map<string, number>();
  const tierTotal = new Map<string, number>();
  for (const l of result.lines) {
    payout.set(`${l.tier_id}:${l.recipient_id}`, l.amount_original);
    tierTotal.set(l.tier_id, (tierTotal.get(l.tier_id) ?? 0) + l.amount_original);
  }

  const computed = [...tiers]
    .sort((a, b) => a.priority - b.priority)
    .map((t) => {
      const recipients: RecipientAllocation[] = t.recipients.map((r) => {
        const amt = payout.get(`${t.id}:${r.id}`) ?? 0;
        return { ...r, computedPayout: amt, computedPctOfPool: pool > 0 ? (amt / pool) * 100 : 0 };
      });
      // Readiness is about prerequisites (KYC, wire, approval), not arithmetic;
      // it is carried on the recipient and rolled up unchanged.
      const hasBlocked = recipients.some((r) => r.status === "BLOCKED");
      const hasPending = recipients.some((r) => r.status === "PENDING");
      const status: TierStatus = hasBlocked ? "BLOCKED" : hasPending ? "PENDING" : "READY";
      return { ...t, recipients, computedTotal: tierTotal.get(t.id) ?? 0, status };
    });

  return {
    tiers: computed,
    unallocated: result.remaining,
    // A tier that names recipients nobody matched is money that cannot be
    // paid — surfaced, not silently dropped.
    hasDiscrepancy: result.unpayableTiers.length > 0,
  };
}

// ── persistence ─────────────────────────────────────────────────────────────
type StoredTier = Omit<WaterfallTier, "computedTotal" | "status" | "expanded"> & { recipients: RecipientAllocation[] };

function stripComputed(t: WaterfallTier): StoredTier {
  const { computedTotal: _ct, status: _s, expanded: _e, ...rest } = t;
  return {
    ...rest,
    recipients: rest.recipients.map((r) => ({ ...r, computedPayout: 0, computedPctOfPool: 0 })),
  };
}

export async function loadTiers(dealId: string): Promise<WaterfallTier[]> {
  const { data, error } = await supabase
    .from("waterfall_tiers")
    .select("id, name, tier_rank, allocation_logic_type, params")
    .eq("deal_id", dealId)
    .order("tier_rank", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => {
    const client = (row.params as { client?: StoredTier } | null)?.client;
    if (client) return { ...client, computedTotal: 0, status: "PENDING" as TierStatus, expanded: false };
    // A row written by something other than this screen: show it faithfully,
    // as a fixed/pro-rata tier with no recipients rather than hiding it.
    const p = (row.params || {}) as Record<string, number>;
    return {
      id: row.id, priority: row.tier_rank, name: row.name, tierCategory: "other",
      ruleType: row.allocation_logic_type === "fixed" ? "FIXED_AMOUNT"
              : row.allocation_logic_type === "percentage" ? "PERCENT_OF_POOL"
              : row.allocation_logic_type === "threshold" ? "WATERFALL_CAP" : "PRO_RATA",
      ruleValue: Number(p.amount ?? p.percentage ?? p.cap ?? 0),
      capAmount: p.cap_amount ?? null,
      recipients: [], computedTotal: 0, status: "PENDING", expanded: false,
    } as WaterfallTier;
  });
}

export async function saveTiers(dealId: string, tiers: WaterfallTier[]): Promise<void> {
  const engine = toEngineInput(tiers);
  const rows = engine.tiers.map((et) => {
    const t = tiers.find((x) => x.id === et.id)!;
    return {
      id: et.id, deal_id: dealId, name: et.name, tier_rank: et.tier_rank,
      allocation_logic_type: et.allocation_logic_type,
      params: { ...et.params, client: stripComputed(t) },
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length > 0) {
    const { error } = await supabase.from("waterfall_tiers").upsert(rows as never, { onConflict: "id" });
    if (error) throw error;
  }
  // Tiers deleted on screen are deleted in the database.
  const keep = rows.map((r) => r.id);
  let q = supabase.from("waterfall_tiers").delete().eq("deal_id", dealId);
  if (keep.length > 0) q = q.not("id", "in", `(${keep.join(",")})`);
  const { error: delError } = await q;
  if (delError) throw delError;
}

export interface EngineRun {
  allocation_id: string | null;
  totalAllocated: number;
  remaining: number;
  unpayableTiers: Array<{ tier_id: string; tier_name: string; amount: number }>;
  versionHash: string;
}

/** Record the allocation in the engine: snapshot, lines, draft intents. */
export async function runEngine(dealId: string, pool: number, tiers: WaterfallTier[]): Promise<EngineRun> {
  const input = toEngineInput(tiers);
  const { data, error } = await supabase.functions.invoke("disbursement-engine", {
    body: { action: "calculate-waterfall", deal_id: dealId, total_consideration: pool, ...input },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    allocation_id: data?.allocation_id ?? null,
    totalAllocated: Number(data?.totalAllocated ?? 0),
    remaining: Number(data?.remaining ?? 0),
    unpayableTiers: data?.unpayableTiers ?? [],
    versionHash: String(data?.versionHash ?? ""),
  };
}
