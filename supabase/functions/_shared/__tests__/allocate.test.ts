// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { allocateCents, majorToCents, centsToMajor } from '../allocate.ts';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('allocateCents', () => {
  it('always sums to the pool exactly', () => {
    const cases: Array<[number, number[]]> = [
      [100_00, [1, 1, 1]],                       // the classic 3-way split
      [18_500_000_000, [42, 8, 25, 5, 20]],      // the $185M cap table
      [1, [1, 1, 1, 1, 1]],                      // one cent, five people
      [7, [0.3333, 0.3333, 0.3334]],
      [999_999_999, [17, 3, 80]],
    ];
    for (const [total, weights] of cases) {
      expect(sum(allocateCents(total, weights))).toBe(total);
    }
  });

  it('survives twenty stakeholders on a nine-figure deal', () => {
    const weights = Array.from({ length: 20 }, (_, i) => (i + 1) * 1.37);
    const total = 27_500_000_000;              // $275,000,000
    const out = allocateCents(total, weights);
    expect(sum(out)).toBe(total);
    expect(out.every((c) => Number.isInteger(c))).toBe(true);
  });

  it('the old float method does NOT reconcile — this is what was wrong', () => {
    const weights = [1, 1, 1];
    const total = 100_00;
    const oldWay = weights.map(() => Math.round((total / 100 / 3) * 100) / 100);
    expect(sum(oldWay)).not.toBe(total / 100);   // 99.99 ≠ 100
    expect(sum(allocateCents(total, weights)) / 100).toBe(100);
  });

  it('splits evenly when no weights are given', () => {
    expect(allocateCents(10, [0, 0, 0])).toEqual([4, 3, 3]);
    expect(sum(allocateCents(10, [0, 0, 0]))).toBe(10);
  });

  it('is deterministic — the same inputs never shuffle cents between people', () => {
    const w = [33.3333, 33.3333, 33.3334];
    const a = allocateCents(1_000_000, w);
    for (let i = 0; i < 20; i++) expect(allocateCents(1_000_000, w)).toEqual(a);
  });

  it('gives the extra cent to the largest fractional claim, not the first row', () => {
    // 10 cents at 15% / 85%: exact shares are 1.5 and 8.5, floors 1 and 8,
    // one cent left. Tie on fraction → earlier index wins, deterministically.
    expect(allocateCents(10, [15, 85])).toEqual([2, 8]);
    // No tie: 0.9 beats 0.1.
    expect(allocateCents(10, [19, 81])).toEqual([2, 8]);
    expect(sum(allocateCents(10, [19, 81]))).toBe(10);
  });

  it('handles zero, empty and negative pools without inventing money', () => {
    expect(allocateCents(0, [1, 2])).toEqual([0, 0]);
    expect(allocateCents(100, [])).toEqual([]);
    expect(sum(allocateCents(-500, [1, 1, 1]))).toBe(-500);
  });

  it('ignores NaN and negative weights rather than propagating them', () => {
    const out = allocateCents(300, [NaN, 1, -5, 1]);
    expect(sum(out)).toBe(300);
    expect(out[0]).toBe(0);
    expect(out[2]).toBe(0);
  });
});

describe('majorToCents / centsToMajor', () => {
  it('round-trips the amounts a funds flow contains', () => {
    for (const v of [0, 0.01, 1234.56, 77_700_000.1, 185_000_000]) {
      expect(centsToMajor(majorToCents(v))).toBe(v);
    }
  });

  it('does not lose a cent to float multiplication', () => {
    expect(majorToCents(1234.56)).toBe(123456);   // not 123455
    expect(majorToCents(0.07)).toBe(7);
    expect(majorToCents(8.115)).toBe(812);
  });
});
