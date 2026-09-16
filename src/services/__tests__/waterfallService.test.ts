import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { toEngineInput, computeLocal } from '../waterfallService';
import type { WaterfallTier } from '@/stores/waterfallStore';

const rec = (id: string, type: 'FIXED_AMOUNT' | 'PERCENT_OF_TIER' | 'PRO_RATA', v: number, status: 'READY' | 'PENDING' | 'BLOCKED' = 'READY') => ({
  id, stakeholderId: null, externalName: id.toUpperCase(), externalEmail: '', entityType: 'entity' as const,
  allocationType: type, amountOrPercent: v,
  prerequisites: { kycRequired: false, wireRequired: false, approvalRequired: false },
  computedPayout: 0, computedPctOfPool: 0, status,
});
const tier = (o: Partial<WaterfallTier>): WaterfallTier => ({
  id: 't', priority: 1, name: 'Tier', tierCategory: 'common', ruleType: 'PRO_RATA', ruleValue: 0,
  capAmount: null, recipients: [], computedTotal: 0, status: 'PENDING', expanded: false, ...o,
});

describe('toEngineInput', () => {
  it('maps every rule type the screen offers', () => {
    const out = toEngineInput([
      tier({ id: 'a', priority: 1, ruleType: 'FIXED_AMOUNT', ruleValue: 5_000 }),
      tier({ id: 'b', priority: 2, ruleType: 'PERCENT_OF_POOL', ruleValue: 12.5 }),
      tier({ id: 'c', priority: 3, ruleType: 'WATERFALL_CAP', ruleValue: 900 }),
      tier({ id: 'd', priority: 4, ruleType: 'PRO_RATA', capAmount: 100 }),
    ]);
    expect(out.tiers.map((t) => [t.allocation_logic_type, t.params.amount ?? t.params.percentage ?? t.params.cap ?? null]))
      .toEqual([['fixed', 5_000], ['percentage', 12.5], ['threshold', 900], ['pro_rata', null]]);
    expect(out.tiers[3].params.cap_amount).toBe(100);
  });

  it('carries each recipient\'s own rule and de-duplicates recipients across tiers', () => {
    const out = toEngineInput([
      tier({ id: 'a', priority: 1, recipients: [rec('x', 'FIXED_AMOUNT', 100), rec('y', 'PRO_RATA', 60)] }),
      tier({ id: 'b', priority: 2, recipients: [rec('y', 'PERCENT_OF_TIER', 10)] }),
    ]);
    expect(out.recipients.map((r) => r.id)).toEqual(['x', 'y']);
    expect(out.tiers[0].params.recipient_allocations).toEqual([
      { recipient_id: 'x', type: 'fixed', value: 100 }, { recipient_id: 'y', type: 'pro_rata', value: 60 },
    ]);
    expect(out.tiers[1].params.recipient_allocations).toEqual([{ recipient_id: 'y', type: 'percent_of_tier', value: 10 }]);
  });
});

describe('computeLocal', () => {
  it('payouts reconcile to the cent and land on the right recipients', () => {
    const r = computeLocal(1_000_000, [tier({
      ruleType: 'FIXED_AMOUNT', ruleValue: 1_000_000,
      recipients: [rec('a', 'FIXED_AMOUNT', 250_000), rec('b', 'PERCENT_OF_TIER', 10), rec('c', 'PRO_RATA', 1)],
    })]);
    expect(r.tiers[0].recipients.map((x) => x.computedPayout)).toEqual([250_000, 100_000, 650_000]);
    expect(r.tiers[0].computedTotal).toBe(1_000_000);
    expect(r.unallocated).toBe(0);
  });

  it('a PERCENT_OF_POOL tier takes its percentage — the old local math ignored it', () => {
    const r = computeLocal(1_000_000, [tier({ ruleType: 'PERCENT_OF_POOL', ruleValue: 25, recipients: [rec('a', 'PRO_RATA', 1)] })]);
    expect(r.tiers[0].computedTotal).toBe(250_000);
    expect(r.unallocated).toBe(750_000);
  });

  it('readiness comes from prerequisites, not arithmetic', () => {
    const r = computeLocal(100, [tier({ ruleType: 'FIXED_AMOUNT', ruleValue: 100, recipients: [rec('a', 'PRO_RATA', 1, 'READY'), rec('b', 'PRO_RATA', 1, 'BLOCKED')] })]);
    expect(r.tiers[0].status).toBe('BLOCKED');
  });

  it('a tier with no recipients is a discrepancy, and its money stays unallocated', () => {
    const r = computeLocal(100, [tier({ ruleType: 'FIXED_AMOUNT', ruleValue: 100 })]);
    expect(r.hasDiscrepancy).toBe(true);
    expect(r.unallocated).toBe(100);
  });
});
