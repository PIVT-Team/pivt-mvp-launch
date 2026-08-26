import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { getPortfolioRisk } from '../portfolioRiskService';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  (c as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return c;
}

function setup(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
  mockFrom.mockImplementation((t: string) => {
    const spec = tables[t] ?? { data: [] };
    return chain({ data: spec.data ?? [], error: spec.error ?? null });
  });
}

const DEALS = [
  { id: 'd1', deal_name: 'Greenfield Solar', deal_number: 'PIVT-1', is_demo: false, updated_at: '2026-08-01T00:00:00Z' },
  { id: 'd2', deal_name: 'Meridian Logistics', deal_number: 'PIVT-2', is_demo: false, updated_at: '2026-08-02T00:00:00Z' },
  { id: 'd3', deal_name: 'Sample Deal', deal_number: 'PIVT-3', is_demo: true, updated_at: '2026-08-03T00:00:00Z' },
];

describe('getPortfolioRisk', () => {
  beforeEach(() => mockFrom.mockReset());

  it('counts open discrepancies per deal by severity', async () => {
    setup({
      deals: { data: DEALS },
      discrepancies: { data: [
        { deal_id: 'd1', severity: 'blocker', message: 'Purchase price disagrees with the SPA', created_at: '2026-08-01T10:00:00Z' },
        { deal_id: 'd1', severity: 'warn',    message: 'Wire unverified',                     created_at: '2026-08-01T11:00:00Z' },
        { deal_id: 'd2', severity: 'info',    message: 'Document re-uploaded',                created_at: '2026-08-02T09:00:00Z' },
      ] },
    });
    const r = await getPortfolioRisk();
    const d1 = r.deals.find((d) => d.id === 'd1')!;
    expect(d1).toMatchObject({ blockers: 1, warnings: 1, infos: 0 });
    expect(r.deals.find((d) => d.id === 'd2')).toMatchObject({ blockers: 0, warnings: 0, infos: 1 });
    expect(r.totals).toMatchObject({ blockers: 1, warnings: 1, dealCount: 3, dealsClear: 2 });
  });

  it('shows the worst issue, not the first row that arrived', async () => {
    setup({
      deals: { data: [DEALS[0]] },
      discrepancies: { data: [
        { deal_id: 'd1', severity: 'warn',    message: 'A warning',            created_at: '2026-08-01T09:00:00Z' },
        { deal_id: 'd1', severity: 'blocker', message: 'THE blocker',          created_at: '2026-08-01T12:00:00Z' },
        { deal_id: 'd1', severity: 'blocker', message: 'A later blocker',      created_at: '2026-08-01T13:00:00Z' },
      ] },
    });
    const r = await getPortfolioRisk();
    expect(r.deals[0].topIssue).toBe('THE blocker');   // highest severity, oldest of those
  });

  it('sorts the deal that cannot close to the top', async () => {
    setup({
      deals: { data: DEALS },
      discrepancies: { data: [
        { deal_id: 'd3', severity: 'blocker', message: 'blocked', created_at: '2026-08-03T09:00:00Z' },
        { deal_id: 'd2', severity: 'warn',    message: 'warned',  created_at: '2026-08-02T09:00:00Z' },
      ] },
    });
    const r = await getPortfolioRisk();
    expect(r.deals.map((d) => d.id)).toEqual(['d3', 'd2', 'd1']);
  });

  it('counts pending approvals and unverified wires', async () => {
    setup({
      deals: { data: [DEALS[0]] },
      deal_approvals: { data: [{ deal_id: 'd1' }, { deal_id: 'd1' }] },
      wire_instructions: { data: [
        { deal_id: 'd1', verification_status: 'verified' },
        { deal_id: 'd1', verification_status: 'pending' },
        { deal_id: 'd1', verification_status: null },
      ] },
    });
    const r = await getPortfolioRisk();
    expect(r.deals[0].pendingApprovals).toBe(2);
    expect(r.deals[0].unverifiedWires).toBe(2);
    expect(r.totals.pendingApprovals).toBe(2);
  });

  it('marks demo deals so a fabricated deal is never mistaken for a live one', async () => {
    setup({ deals: { data: DEALS } });
    const r = await getPortfolioRisk();
    expect(r.deals.find((d) => d.id === 'd3')!.isDemo).toBe(true);
    expect(r.deals.find((d) => d.id === 'd1')!.isDemo).toBe(false);
  });

  it('reports truncation rather than presenting a partial portfolio as complete', async () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ ...DEALS[0], id: `x${i}` }));
    setup({ deals: { data: many } });
    const r = await getPortfolioRisk(3);
    expect(r.truncated).toBe(true);
    expect(r.deals).toHaveLength(3);
  });

  it('an empty portfolio is not an error', async () => {
    setup({ deals: { data: [] } });
    const r = await getPortfolioRisk();
    expect(r.deals).toEqual([]);
    expect(r.totals.dealCount).toBe(0);
    expect(r.truncated).toBe(false);
  });

  it('throws when a query fails — a broken monitor must not render as a clean one', async () => {
    setup({ deals: { data: DEALS }, discrepancies: { error: { message: 'permission denied' } } });
    await expect(getPortfolioRisk()).rejects.toMatchObject({ message: 'permission denied' });
  });

  it('throws when the deal list itself fails', async () => {
    setup({ deals: { error: { message: 'RLS' } } });
    await expect(getPortfolioRisk()).rejects.toMatchObject({ message: 'RLS' });
  });
});
