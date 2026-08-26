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

    // Pro-rata weights by ownership; anything else splits the tier evenly.
    // `allocateCents` falls back to an even split when the weights are all
    // zero, which is the same answer the old code reached by dividing by the
    // recipient count — but it sums to the tier exactly.
    const weights = tier.allocation_logic_type === "pro_rata"
      ? tierRecipients.map((r: any) => Number(r.ownership_pct) || 0)
      : tierRecipients.map(() => 1);

    const allocated = allocateCents(tierCents, weights);

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
