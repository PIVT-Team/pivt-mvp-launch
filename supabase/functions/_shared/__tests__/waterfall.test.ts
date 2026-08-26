// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateWaterfall } from '../waterfall.ts';

const tier = (over: Record<string, unknown> = {}) => ({
  id: 't1', tier_rank: 1, name: 'Tier 1',
  allocation_logic_type: 'pro_rata', params: {}, ...over,
}) as never;

const CAP_TABLE = [
  { id: 'r1', name: 'Meridian Holdings LLC', ownership_pct: 42 },
  { id: 'r2', name: 'Meridian Capital LLC',  ownership_pct: 8 },
  { id: 'r3', name: 'Apex Advisory LLC',     ownership_pct: 25 },
  { id: 'r4', name: 'Jane Okafor',           ownership_pct: 5 },
  { id: 'r5', name: 'Option Pool',           ownership_pct: 20 },
];

const paid = (r: { lines: Array<{ amount_original: number }> }) =>
  Math.round(r.lines.reduce((s, l) => s + l.amount_original, 0) * 100) / 100;

describe('calculateWaterfall', () => {
  it('a pro-rata split of $185M reconciles to the cent', () => {
    const r = calculateWaterfall(185_000_000, [tier()], CAP_TABLE);
    expect(paid(r)).toBe(185_000_000);
    expect(r.remaining).toBe(0);
    expect(r.totalAllocated).toBe(185_000_000);
  });

  it('an awkward total that does not divide evenly still reconciles', () => {
    // $100,000,000.01 across three equal holders: 33,333,333.34 / .34 / .33
    const r = calculateWaterfall(100_000_000.01, [tier()], [
      { id: 'a', name: 'A', ownership_pct: 1 },
      { id: 'b', name: 'B', ownership_pct: 1 },
      { id: 'c', name: 'C', ownership_pct: 1 },
    ]);
    expect(paid(r)).toBe(100_000_000.01);
    expect(new Set(r.lines.map((l) => l.amount_original)).size).toBeLessThanOrEqual(2);
  });

  it('twenty stakeholders on $275M lose nothing', () => {
    const recipients = Array.from({ length: 20 }, (_, i) => ({
      id: `r${i}`, name: `Holder ${i}`, ownership_pct: (i + 1) * 1.37,
    }));
    const r = calculateWaterfall(275_000_000, [tier()], recipients);
    expect(paid(r)).toBe(275_000_000);
    expect(r.lines).toHaveLength(20);
  });

  it('runs tiers in rank order and stops when the pool is exhausted', () => {
    const r = calculateWaterfall(10_000_000, [
      tier({ id: 't2', tier_rank: 2, name: 'Second', allocation_logic_type: 'fixed', params: { amount: 9_000_000 } }),
      tier({ id: 't1', tier_rank: 1, name: 'First',  allocation_logic_type: 'fixed', params: { amount: 4_000_000 } }),
    ], [{ id: 'a', name: 'A', ownership_pct: 100 }]);
    expect(r.lines.map((l) => [l.tier_name, l.amount_original]))
      .toEqual([['First', 4_000_000], ['Second', 6_000_000]]);   // second tier capped by what is left
    expect(r.remaining).toBe(0);
  });

  it('a percentage tier takes its share of the total, not of the remainder', () => {
    const r = calculateWaterfall(1_000_000, [
      tier({ allocation_logic_type: 'percentage', params: { percentage: 12.5 } }),
    ], [{ id: 'a', name: 'A', ownership_pct: 100 }]);
    expect(r.lines[0].amount_original).toBe(125_000);
    expect(r.remaining).toBe(875_000);
  });

  it('a tier that matches no recipient is reported, not silently consumed', () => {
    const r = calculateWaterfall(1_000_000, [
      tier({ id: 'x', name: 'Escrow', allocation_logic_type: 'fixed',
             params: { amount: 250_000, recipient_ids: ['nobody'] } }),
      tier({ id: 'y', tier_rank: 2, name: 'Rest' }),
    ], [{ id: 'a', name: 'A', ownership_pct: 100 }]);

    expect(r.unpayableTiers).toEqual([{ tier_id: 'x', tier_name: 'Escrow', amount: 250_000 }]);
    // The money it could not pay stays in the pool rather than vanishing from
    // the arithmetic while still counting as "allocated".
    expect(paid(r)).toBe(1_000_000);
    expect(r.totalAllocated).toBe(1_000_000);
  });

  it('recipients with no ownership percentage split the tier evenly', () => {
    const r = calculateWaterfall(1_000, [tier()], [
      { id: 'a', name: 'A', ownership_pct: 0 },
      { id: 'b', name: 'B', ownership_pct: 0 },
      { id: 'c', name: 'C', ownership_pct: 0 },
    ]);
    expect(paid(r)).toBe(1_000);
    expect(r.lines.map((l) => l.amount_original)).toEqual([333.34, 333.33, 333.33]);
  });

  it('the same inputs always produce the same allocation', () => {
    const run = () => calculateWaterfall(185_000_000.07, [tier()], CAP_TABLE)
      .lines.map((l) => l.amount_original_cents);
    const first = run();
    for (let i = 0; i < 10; i++) expect(run()).toEqual(first);
  });

  it('no tiers means no payments and nothing consumed', () => {
    const r = calculateWaterfall(5_000_000, [], CAP_TABLE);
    expect(r.lines).toHaveLength(0);
    expect(r.remaining).toBe(5_000_000);
    expect(r.totalAllocated).toBe(0);
  });
});
