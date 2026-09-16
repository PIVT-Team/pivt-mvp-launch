import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockFrom = vi.fn(); const mockGetUser = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a), auth: { getUser: () => mockGetUser() } },
}));
import { listPortfolioComments } from '../portfolioCommentsService';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit']) c[m] = vi.fn().mockReturnValue(c);
  (c as { then: unknown }).then = (r: (v: unknown) => unknown) => r(result);
  return c;
}
function setup(t: Record<string, { data?: unknown[]; error?: unknown }>) {
  mockFrom.mockImplementation((n: string) => { const s = t[n] ?? { data: [] }; return chain({ data: s.data ?? [], error: s.error ?? null }); });
}
const row = (o: Record<string, unknown>) => ({ id: 'c1', deal_id: 'd1', author_user_id: 'u1', body: 'hello', parent_id: null, section_context: 'Payments', created_at: '2026-09-01T00:00:00Z', ...o });

describe('listPortfolioComments', () => {
  beforeEach(() => { mockFrom.mockReset(); mockGetUser.mockReset(); mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } }); });

  it('folds replies into their parent with a count and the latest reply author', async () => {
    setup({
      deals: { data: [{ id: 'd1', deal_name: 'Greenfield' }] },
      deal_comments: { data: [
        row({ id: 'r2', parent_id: 'c1', author_user_id: 'u2', created_at: '2026-09-03T00:00:00Z' }),
        row({ id: 'r1', parent_id: 'c1', author_user_id: 'u3', created_at: '2026-09-02T00:00:00Z' }),
        row({ id: 'c1' }),
      ] },
      profiles: { data: [{ user_id: 'u1', full_name: 'Jane Okafor' }, { user_id: 'u2', full_name: 'Sam Lee' }] },
    });
    const r = await listPortfolioComments();
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0]).toMatchObject({ dealName: 'Greenfield', author: 'Jane Okafor', authorInitials: 'JO', replyCount: 2, lastReplyAuthor: 'Sam Lee', sectionContext: 'payments', unread: false });
  });

  it('marks comments that mention the viewer', async () => {
    setup({ deals: { data: [{ id: 'd1', deal_name: 'G' }] }, deal_comments: { data: [row({ id: 'c1' }), row({ id: 'c2' })] }, comment_mentions: { data: [{ comment_id: 'c2' }] } });
    const r = await listPortfolioComments();
    expect(r.comments.find((c) => c.id === 'c2')!.mentionsYou).toBe(true);
    expect(r.mentionCount).toBe(1);
  });

  it('an unknown author is labelled, not invented', async () => {
    setup({ deals: { data: [{ id: 'd1', deal_name: 'G' }] }, deal_comments: { data: [row({})] } });
    expect((await listPortfolioComments()).comments[0].author).toBe('Unknown user');
  });

  it('no deals means no comments and no error', async () => {
    setup({ deals: { data: [] } });
    expect(await listPortfolioComments()).toEqual({ comments: [], deals: [], mentionCount: 0 });
  });

  it('a failed read throws — an error must not render as a quiet portfolio', async () => {
    setup({ deals: { data: [{ id: 'd1', deal_name: 'G' }] }, deal_comments: { error: { message: 'denied' } } });
    await expect(listPortfolioComments()).rejects.toMatchObject({ message: 'denied' });
  });
});
