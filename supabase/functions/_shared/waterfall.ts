/**
 * Waterfall allocation.
 *
 * Extracted from `disbursement-engine` so the arithmetic that decides who gets
 * paid what can be tested without a Deno runtime.
 */
import { allocateCents, majorToCents, centsToMajor } from "./allocate.ts";

//
// Everything below works in integer cents. The previous version computed each
// share as a float and rounded it on its own — `Math.round(share * 100) / 100`
// — so nothing made the shares add back up to the pool. Across twenty
// stakeholders on a nine-figure deal the residue is real money belonging to
// someone, and the totals stop reconciling against the funds flow.
/**
 * How a tier's cents are split among its recipients.
 *
 * Without `params.recipient_allocations`: pro-rata by ownership for a pro_rata
 * tier, an even split otherwise (allocateCents falls back to even when every
 * weight is zero) — the original behaviour.
 *
 * With it, each recipient carries its own rule, which is what the waterfall
 * screen lets a person express:
 *   fixed            — an amount, capped by what the tier holds
 *   percent_of_tier  — a percentage of the tier
 *   pro_rata         — a share of whatever the fixed and percent rules leave,
 *                      weighted by `value` (or ownership when value is absent)
 * Fixed and percent claims are settled in cents first; the remainder is split
 * by largest remainder, so the tier still sums exactly. If fixed claims exceed
 * the tier they are scaled down proportionally rather than paying out money
 * the tier does not have.
 */
function distributeTier(
  tierCents: number,
  tier: { allocation_logic_type: string; params: any },
  recipients: Array<{ id: string; ownership_pct?: number }>
): number[] {
  const rules: Array<{ recipient_id: string; type: string; value?: number }> | undefined =
    Array.isArray(tier.params?.recipient_allocations) ? tier.params.recipient_allocations : undefined;

  if (!rules) {
    const weights = tier.allocation_logic_type === "pro_rata"
      ? recipients.map((r) => Number(r.ownership_pct) || 0)
      : recipients.map(() => 1);
    return allocateCents(tierCents, weights);
  }

  const byId = new Map(rules.map((r) => [r.recipient_id, r]));
  const out = new Array(recipients.length).fill(0);

  // 1. fixed
  const fixedIdx = recipients.map((r, i) => (byId.get(r.id)?.type === "fixed" ? i : -1)).filter((i) => i >= 0);
  const fixedWant = fixedIdx.map((i) => majorToCents(Number(byId.get(recipients[i].id)!.value) || 0));
  const fixedTotal = fixedWant.reduce((a, b) => a + b, 0);
  let fixedGot: number[];
  if (fixedTotal <= tierCents) fixedGot = fixedWant;
  else fixedGot = allocateCents(tierCents, fixedWant);           // scale down, still exact
  fixedIdx.forEach((i, k) => { out[i] = fixedGot[k]; });
  let left = tierCents - fixedGot.reduce((a, b) => a + b, 0);

  // 2. percent of tier (of the whole tier, as a person reads it)
  const pctIdx = recipients.map((r, i) => (byId.get(r.id)?.type === "percent_of_tier" ? i : -1)).filter((i) => i >= 0);
  const pctWant = pctIdx.map((i) => Math.round((tierCents * (Number(byId.get(recipients[i].id)!.value) || 0)) / 100));
  const pctTotal = pctWant.reduce((a, b) => a + b, 0);
  const pctGot = pctTotal <= left ? pctWant : allocateCents(left, pctWant);
  pctIdx.forEach((i, k) => { out[i] = pctGot[k]; });
  left -= pctGot.reduce((a, b) => a + b, 0);

  // 3. pro rata over the remainder
  const proIdx = recipients.map((r, i) => {
    const rule = byId.get(r.id);
    return !rule || rule.type === "pro_rata" ? i : -1;
  }).filter((i) => i >= 0);
  if (proIdx.length > 0 && left > 0) {
    const weights = proIdx.map((i) => {
      const rule = byId.get(recipients[i].id);
      const v = rule && rule.value != null ? Number(rule.value) : Number(recipients[i].ownership_pct);
      return Number.isFinite(v) && v > 0 ? v : 0;
    });
    const got = allocateCents(left, weights);
    proIdx.forEach((i, k) => { out[i] += got[k]; });
    left = 0;
  }
  // Anything left (no pro-rata recipients to absorb it) stays in the pool: the
  // caller's reconcile check sees it as unallocated rather than lost.
  return out;
}

export function calculateWaterfall(
  totalConsideration: number,
  tiers: { id: string; tier_rank: number; name: string; allocation_logic_type: string; params: any }[],
  recipients: { id: string; name: string; ownership_pct: number }[]
) {
  const sorted = [...tiers].sort((a, b) => a.tier_rank - b.tier_rank);
  const totalCents = majorToCents(totalConsideration);
  let remainingCents = totalCents;
  const lines: any[] = [];
  /** Tiers whose recipient list matched nobody — money that cannot be paid. */
  const unpayableTiers: Array<{ tier_id: string; tier_name: string; amount: number }> = [];

  for (const tier of sorted) {
    if (remainingCents <= 0) break;
    let tierCents = 0;

    switch (tier.allocation_logic_type) {
      case "fixed":
        tierCents = Math.min(majorToCents(tier.params.amount || 0), remainingCents);
        break;
      case "percentage":
        tierCents = Math.min(
          Math.round((totalCents * (tier.params.percentage || 0)) / 100),
          remainingCents
        );
        break;
      case "pro_rata":
        tierCents = Math.min(
          tier.params.pool_amount != null ? majorToCents(tier.params.pool_amount) : remainingCents,
          remainingCents
        );
        break;
      case "threshold":
        tierCents = Math.min(
          tier.params.cap != null ? majorToCents(tier.params.cap) : remainingCents,
          remainingCents
        );
        break;
    }

    // A cap applies to any tier type; the screen lets a person put one on a
    // percentage or pro-rata tier, not only a threshold tier.
    if (tier.params?.cap_amount != null) {
      tierCents = Math.min(tierCents, majorToCents(Number(tier.params.cap_amount) || 0));
    }

    // Work out who this tier pays BEFORE consuming the money. The previous
    // version deducted the tier from the remaining pool and then, if no
    // recipient matched, paid it to nobody — so `totalAllocated` counted money
    // that appeared on no payment line.
    const tierRecipients = tier.params.recipient_ids
      ? recipients.filter((r: any) => tier.params.recipient_ids.includes(r.id))
      : recipients;

    if (tierRecipients.length === 0) {
      unpayableTiers.push({ tier_id: tier.id, tier_name: tier.name, amount: centsToMajor(tierCents) });
      continue;
    }

    remainingCents -= tierCents;

    const allocated = distributeTier(tierCents, tier, tierRecipients);
    const distributed = allocated.reduce((a, b) => a + b, 0);
    remainingCents += tierCents - distributed;   // undistributed cents go back to the pool

    tierRecipients.forEach((r: any, i: number) => {
      lines.push({
        tier_id: tier.id,
        tier_name: tier.name,
        recipient_id: r.id,
        recipient_name: r.name,
        consideration_type: tier.params.consideration_type || "cash",
        amount_original: centsToMajor(allocated[i]),
        amount_original_cents: allocated[i],
        currency_original: tier.params.currency || "USD",
        settlement_currency: tier.params.settlement_currency || "USD",
        priority_rank: tier.tier_rank,
      });
    });
  }

  // Version hash
  const hashInput = JSON.stringify({ totalConsideration, tiers: sorted.map(t => ({ id: t.id, params: t.params })), lines });
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  // Simple hash for demo
  let hash = 0;
  for (const byte of data) { hash = ((hash << 5) - hash + byte) | 0; }
  const versionHash = `wf-${Math.abs(hash).toString(16).padStart(8, "0")}`;

  const allocatedCents = lines.reduce((sum, l) => sum + l.amount_original_cents, 0);

  // The whole point of working in cents: this must hold exactly. If it ever
  // does not, the numbers on the payment run are wrong and saying so is far
  // better than shipping a plausible total.
  if (allocatedCents + remainingCents !== totalCents) {
    throw new Error(
      `Waterfall allocation does not reconcile: allocated ${allocatedCents} + unallocated ` +
      `${remainingCents} != ${totalCents} cents. Refusing to produce a payment run.`
    );
  }

  return {
    lines,
    versionHash,
    remaining: centsToMajor(remainingCents),
    totalAllocated: centsToMajor(allocatedCents),
    unpayableTiers,
  };
}
