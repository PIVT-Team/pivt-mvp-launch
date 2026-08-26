import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { getPortfolioPayments } from '../portfolioPaymentsService';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) c[m] = vi.fn().mockReturnValue(c);
  (c as { then: unknown }).then = (r: (v: unknown) => unknown) => r(result);
  return c;
}
function setup(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
  mockFrom.mockImplementation((t: string) => {
    const s = tables[t] ?? { data: [] };
    return chain({ data: s.data ?? [], error: s.error ?? null });
  });
}

const DEALS = [
  { id: 'd1', deal_name: 'Greenfield Solar', deal_number: 'PIVT-1', is_demo: false },
  { id: 'd2', deal_name: 'Sample Deal',      deal_number: 'PIVT-2', is_demo: true },
];
const intent = (o: Record<string, unknown> = {}) => ({
  id: 'i1', deal_id: 'd1', recipient_id: 'r1', bank_account_ref: 'Meridian Holdings LLC',
  amount_original: 1_000_000, currency_original: 'USD', status: 'eligible',
  provider_ref: null, execution_provider: 'mock', updated_at: '2026-08-01T00:00:00Z', ...o,
});

describe('getPortfolioPayments', () => {
  beforeEach(() => mockFrom.mockReset());

  it('never sums across currencies', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ id: 'a', amount_original: 100, currency_original: 'USD' }),
      intent({ id: 'b', amount_original: 200, currency_original: 'USD' }),
      intent({ id: 'c', amount_original: 50,  currency_original: 'EUR' }),
    ] } });
    const r = await getPortfolioPayments();
    expect(r.totalsByCurrency).toEqual([
      { currency: 'USD', amount: 300, count: 2 },
      { currency: 'EUR', amount: 50,  count: 1 },
    ]);
  });

  it('counts blocked, executed and failed by status', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ id: 'a', status: 'pending_approvals' }),
      intent({ id: 'b', status: 'pending_conditions' }),
      intent({ id: 'c', status: 'settled' }),
      intent({ id: 'd', status: 'executing' }),
      intent({ id: 'e', status: 'failed' }),
      intent({ id: 'f', status: 'draft' }),
    ] } });
    const r = await getPortfolioPayments();
    expect(r.blockedCount).toBe(2);
    expect(r.executedCount).toBe(2);
    expect(r.failedCount).toBe(1);
  });

  it('flags simulation only when a mock provider actually executed something', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ status: 'draft', execution_provider: 'mock' }),
    ] } });
    expect((await getPortfolioPayments()).anySimulated).toBe(false);

    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ status: 'settled', execution_provider: 'mock' }),
    ] } });
    expect((await getPortfolioPayments()).anySimulated).toBe(true);

    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ status: 'settled', execution_provider: 'jpmorgan' }),
    ] } });
    expect((await getPortfolioPayments()).anySimulated).toBe(false);
  });

  it('joins the deal name and marks demo deals', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [
      intent({ id: 'a', deal_id: 'd2' }),
    ] } });
    const r = await getPortfolioPayments();
    expect(r.payments[0]).toMatchObject({ dealName: 'Sample Deal', dealNumber: 'PIVT-2', isDemo: true });
  });

  it('an intent on a deal the viewer cannot see is labelled, not crashed on', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [intent({ deal_id: 'gone' })] } });
    const r = await getPortfolioPayments();
    expect(r.payments[0].dealName).toBe('Unknown deal');
  });

  it('falls back to a label when there is no account reference', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { data: [intent({ bank_account_ref: null })] } });
    expect((await getPortfolioPayments()).payments[0].recipient).toBe('Unnamed recipient');
  });

  it('reports truncation', async () => {
    const many = Array.from({ length: 4 }, (_, i) => intent({ id: `i${i}` }));
    setup({ deals: { data: DEALS }, disbursement_intents: { data: many } });
    const r = await getPortfolioPayments(3);
    expect(r.truncated).toBe(true);
    expect(r.payments).toHaveLength(3);
  });

  it('no deals means no payments, not an error', async () => {
    setup({ deals: { data: [] } });
    const r = await getPortfolioPayments();
    expect(r.payments).toEqual([]);
    expect(r.totalsByCurrency).toEqual([]);
  });

  it('throws when the query fails rather than rendering an empty portfolio', async () => {
    setup({ deals: { data: DEALS }, disbursement_intents: { error: { message: 'permission denied' } } });
    await expect(getPortfolioPayments()).rejects.toMatchObject({ message: 'permission denied' });
  });
});
