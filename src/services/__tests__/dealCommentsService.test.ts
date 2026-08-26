import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    auth: { getUser: () => mockGetUser() },
  },
}));

import { listDealComments, postDealComment } from '../dealCommentsService';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert']) c[m] = vi.fn().mockReturnValue(c);
  (c as { single: unknown }).single = vi.fn().mockResolvedValue(result);
  (c as { then: unknown }).then = (r: (v: unknown) => unknown) => r(result);
  return c;
}
function setup(tables: Record<string, { data?: unknown; error?: unknown }>) {
  mockFrom.mockImplementation((t: string) => {
    const s = tables[t] ?? { data: [] };
    return chain({ data: s.data ?? [], error: s.error ?? null });
  });
}

const row = (o: Record<string, unknown> = {}) => ({
  id: 'c1', deal_id: 'd1', author_user_id: 'u1', body: 'Cap table delta on the ESOP pool',
  parent_id: null, section_context: 'Stakeholders', visibility: 'internal',
  created_at: '2026-08-01T10:00:00Z', ...o,
});

describe('listDealComments', () => {
  beforeEach(() => { mockFrom.mockReset(); mockGetUser.mockReset(); });

  it('resolves author names from profiles', async () => {
    setup({
      deal_comments: { data: [row()] },
      profiles: { data: [{ user_id: 'u1', full_name: 'Jane Okafor' }] },
    });
    const r = await listDealComments('d1');
    expect(r[0].authorName).toBe('Jane Okafor');
    expect(r[0].body).toBe('Cap table delta on the ESOP pool');
  });

  it('says "Unknown user" rather than inventing a plausible name', async () => {
    setup({ deal_comments: { data: [row()] }, profiles: { data: [] } });
    expect((await listDealComments('d1'))[0].authorName).toBe('Unknown user');
  });

  it('nests replies under their parent, oldest first', async () => {
    setup({
      deal_comments: { data: [
        row({ id: 'c1' }),
        row({ id: 'r2', parent_id: 'c1', created_at: '2026-08-01T12:00:00Z', body: 'second reply' }),
        row({ id: 'r1', parent_id: 'c1', created_at: '2026-08-01T11:00:00Z', body: 'first reply' }),
      ] },
      profiles: { data: [{ user_id: 'u1', full_name: 'Jane Okafor' }] },
    });
    const r = await listDealComments('d1');
    expect(r).toHaveLength(1);
    expect(r[0].replies.map(x => x.body)).toEqual(['first reply', 'second reply']);
  });

  it('surfaces an orphaned reply instead of dropping it', async () => {
    setup({
      deal_comments: { data: [row({ id: 'r1', parent_id: 'gone' })] },
      profiles: { data: [] },
    });
    const r = await listDealComments('d1');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('r1');
  });

  it('attaches mentions to the right comment', async () => {
    setup({
      deal_comments: { data: [row({ id: 'c1' }), row({ id: 'c2' })] },
      profiles: { data: [] },
      comment_mentions: { data: [{ comment_id: 'c2', mentioned_user_id: 'u9' }] },
    });
    const r = await listDealComments('d1');
    expect(r.find(c => c.id === 'c2')!.mentionedUserIds).toEqual(['u9']);
    expect(r.find(c => c.id === 'c1')!.mentionedUserIds).toEqual([]);
  });

  it('a profile lookup failure does not lose the comments', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup({ deal_comments: { data: [row()] }, profiles: { error: { message: 'denied' } } });
    const r = await listDealComments('d1');
    expect(r).toHaveLength(1);
    expect(r[0].authorName).toBe('Unknown user');
    warn.mockRestore();
  });

  it('throws when the comments query fails — an error is not an empty thread', async () => {
    setup({ deal_comments: { error: { message: 'permission denied' } } });
    await expect(listDealComments('d1')).rejects.toMatchObject({ message: 'permission denied' });
  });
});

describe('postDealComment', () => {
  beforeEach(() => { mockFrom.mockReset(); mockGetUser.mockReset(); });

  it('refuses when nobody is signed in rather than posting anonymously', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(postDealComment({ dealId: 'd1', body: 'hi' })).rejects.toThrow(/signed in/i);
  });

  it('writes the comment and reports it back', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setup({
      deal_comments: { data: row({ id: 'new1', body: 'hi' }) },
      profiles: { data: [{ user_id: 'u1', full_name: 'Jane Okafor' }] },
    });
    const c = await postDealComment({ dealId: 'd1', body: 'hi', sectionContext: 'Payments' });
    expect(c.id).toBe('new1');
    expect(c.authorName).toBe('Jane Okafor');
    expect(mockFrom).toHaveBeenCalledWith('deal_comments');
  });

  it('a failed mention insert does not fail the comment', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setup({
      deal_comments: { data: row({ id: 'new1' }) },
      comment_mentions: { error: { message: 'denied' } },
      profiles: { data: [] },
    });
    const c = await postDealComment({ dealId: 'd1', body: 'hi', mentionedUserIds: ['u2'] });
    expect(c.id).toBe('new1');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('surfaces a write failure instead of claiming success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setup({ deal_comments: { error: { message: 'RLS violation' } } });
    await expect(postDealComment({ dealId: 'd1', body: 'hi' })).rejects.toMatchObject({ message: 'RLS violation' });
  });
});
