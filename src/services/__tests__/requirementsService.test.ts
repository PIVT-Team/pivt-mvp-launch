import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockInvoke = vi.fn();
const mockGetUser = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  listRequests, draftRequestViaEngine, approveRequestToSend, sendRequest, cancelRequest,
} from '../requirementsService';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'order', 'update', 'insert', 'single', 'maybeSingle']) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  (c as { then: unknown }).then = (r: (v: unknown) => unknown) => r(result);
  return c;
}

describe('the send path', () => {
  beforeEach(() => { mockFrom.mockReset(); mockInvoke.mockReset(); mockGetUser.mockReset(); });

  it('listRequests reads the deal\'s requests', async () => {
    const c = chain({ data: [{ id: 'q1', status: 'draft' }], error: null });
    mockFrom.mockReturnValue(c);
    const r = await listRequests('d1');
    expect(mockFrom).toHaveBeenCalledWith('requirement_requests');
    expect(c.eq).toHaveBeenCalledWith('deal_id', 'd1');
    expect(r[0].id).toBe('q1');
  });

  it('draftRequestViaEngine calls the engine and returns the draft text', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, request_id: 'q1', recipient: 'a@b.c', subject: 'S', body: 'B' }, error: null });
    const d = await draftRequestViaEngine({ requirementId: 'r1' });
    expect(mockInvoke).toHaveBeenCalledWith('draft-requirement-request', expect.objectContaining({ body: expect.objectContaining({ requirement_id: 'r1' }) }));
    expect(d).toMatchObject({ request_id: 'q1', subject: 'S', body: 'B' });
  });

  it('draftRequestViaEngine surfaces the engine\'s refusal (unreviewed requirement)', async () => {
    mockInvoke.mockResolvedValue({ data: { error: "This requirement hasn't been reviewed and approved yet." }, error: null });
    await expect(draftRequestViaEngine({ requirementId: 'r1' })).rejects.toThrow(/reviewed/);
  });

  it('approveRequestToSend records who approved and when', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const c = chain({ data: null, error: null });
    mockFrom.mockReturnValue(c);
    await approveRequestToSend('q1');
    const payload = (c.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.approved_to_send).toBe(true);
    expect(payload.approved_by).toBe('u1');
    expect(typeof payload.approved_at).toBe('string');
    expect(c.eq).toHaveBeenCalledWith('id', 'q1');
  });

  it('sendRequest passes the portal base and returns whether email actually went', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, sent: false, link: 'https://x/submit?t=1', expires_at: 'e', message: 'Prepared but NOT emailed' }, error: null });
    const r = await sendRequest({ requestId: 'q1', subject: 'S', body: 'B' });
    const call = mockInvoke.mock.calls[0];
    expect(call[0]).toBe('send-requirement-request');
    expect((call[1] as { body: { portal_base_url: string } }).body.portal_base_url).toMatch(/^https?:\/\//);
    expect(r.sent).toBe(false);          // the UI must not say "sent" here
    expect(r.link).toContain('/submit?t=');
  });

  it('sendRequest surfaces the gate error from the engine', async () => {
    mockInvoke.mockResolvedValue({ data: { error: "This message hasn't been approved for sending." }, error: null });
    await expect(sendRequest({ requestId: 'q1', subject: 'S', body: 'B' })).rejects.toThrow(/approved/);
  });

  it('cancelRequest only withdraws drafts', async () => {
    const c = chain({ data: null, error: null });
    mockFrom.mockReturnValue(c);
    await cancelRequest('q1');
    expect(c.eq).toHaveBeenCalledWith('status', 'draft');
  });
});
