/**
 * Splitting money without losing any.
 *
 * The waterfall calculator computed each recipient's share as a float and
 * rounded it independently — `Math.round(share * 100) / 100`. Every share
 * rounds on its own, so nothing makes them add back up. Across twenty
 * stakeholders on a nine-figure deal the residue is real money that belongs to
 * someone, and the totals stop reconciling against the funds flow.
 *
 * The largest-remainder method allocates whole cents and then hands the
 * leftover cents, one each, to the recipients with the largest fractional
 * claim. The result sums to the pool exactly, by construction.
 */

/**
 * Split `totalCents` across `weights`, preserving the total exactly.
 *
 * Weights need not sum to anything in particular — they are relative. Zero or
 * absent weights split the pool evenly, which is what the caller wants when a
 * tier has no ownership percentages attached.
 *
 * Ties in the fractional remainder are broken by original position, so the same
 * inputs always produce the same allocation: a payment run must not shuffle
 * cents between people when it is recalculated.
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const cents = Math.trunc(totalCents);
  if (cents === 0) return new Array(n).fill(0);

  const sign = cents < 0 ? -1 : 1;
  const pool = Math.abs(cents);

  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const totalWeight = safe.reduce((a, b) => a + b, 0);
  const effective = totalWeight > 0 ? safe : new Array(n).fill(1);
  const denominator = totalWeight > 0 ? totalWeight : n;

  const exact = effective.map((w) => (pool * w) / denominator);
  const floors = exact.map((x) => Math.floor(x));
  let residue = pool - floors.reduce((a, b) => a + b, 0);

  // Hand out the remaining cents to the largest fractional claims.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

  const out = floors.slice();
  for (let k = 0; k < order.length && residue > 0; k++) {
    out[order[k].i] += 1;
    residue -= 1;
  }
  // `residue` can exceed the number of recipients only if the weights are
  // degenerate; loop until it is gone rather than silently dropping cents.
  let k = 0;
  while (residue > 0) {
    out[order[k % order.length].i] += 1;
    residue -= 1;
    k++;
  }

  return sign < 0 ? out.map((c) => -c) : out;
}

/** Dollars (or any major unit) to whole cents, without float drift. */
export function majorToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Number((amount * 100).toFixed(4)));
}

/** Whole cents back to the major unit, exact for anything under ~$90 trillion. */
export function centsToMajor(cents: number): number {
  return cents / 100;
}
