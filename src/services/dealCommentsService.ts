/**
 * Deal comments, from `deal_comments`.
 *
 * The Comments tab rendered a fixed conversation between "John Chen" and
 * "Sarah Kim" about a 0.2% ESOP delta — on whatever deal the user had open,
 * including their own live transaction. It imported the Supabase client and
 * never called it. Posting appended to React state and raised "Comment posted";
 * on the next render the invented thread was back and the user's comment was
 * gone.
 *
 * A screen that invites someone to write to their counterparty and then
 * discards what they wrote is worse than not having the screen.
 *
 * `deal_comments` has existed the whole time, with RLS and a `comment_mentions`
 * child table.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DealComment {
  id: string;
  dealId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  parentId: string | null;
  sectionContext: string | null;
  visibility: string;
  createdAt: string;
  mentionedUserIds: string[];
  replies: DealComment[];
}

async function resolveAuthorNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return names;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", unique);

  // A missing profile is not a reason to lose the comment — the body is the
  // point. Fall back to an honest placeholder rather than a plausible name.
  if (error) {
    console.warn("Could not resolve comment authors:", error.message);
    return names;
  }
  for (const p of data ?? []) {
    if (p.full_name) names.set(p.user_id, p.full_name);
  }
  return names;
}

export async function listDealComments(dealId: string): Promise<DealComment[]> {
  const { data: rows, error } = await supabase
    .from("deal_comments")
    .select("id, deal_id, author_user_id, body, parent_id, section_context, visibility, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const comments = rows ?? [];
  if (comments.length === 0) return [];

  const [names, mentionsRes] = await Promise.all([
    resolveAuthorNames(comments.map((c) => c.author_user_id)),
    supabase
      .from("comment_mentions")
      .select("comment_id, mentioned_user_id")
      .in("comment_id", comments.map((c) => c.id)),
  ]);

  const mentions = new Map<string, string[]>();
  for (const m of mentionsRes.data ?? []) {
    mentions.set(m.comment_id, [...(mentions.get(m.comment_id) ?? []), m.mentioned_user_id]);
  }

  const toComment = (c: (typeof comments)[number]): DealComment => ({
    id: c.id,
    dealId: c.deal_id,
    authorUserId: c.author_user_id,
    authorName: names.get(c.author_user_id) ?? "Unknown user",
    body: c.body,
    parentId: c.parent_id,
    sectionContext: c.section_context,
    visibility: c.visibility,
    createdAt: c.created_at,
    mentionedUserIds: mentions.get(c.id) ?? [],
    replies: [],
  });

  // Nest one level. Replies read oldest-first inside a thread, which is how a
  // conversation is read; top-level comments stay newest-first.
  const byId = new Map<string, DealComment>();
  const roots: DealComment[] = [];
  for (const c of comments) byId.set(c.id, toComment(c));
  for (const c of comments) {
    const node = byId.get(c.id)!;
    // A reply whose parent is outside this deal, or filtered out by RLS, has no
    // parent to nest under. It becomes a root rather than disappearing.
    const parent = c.parent_id ? byId.get(c.parent_id) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  for (const r of roots) {
    r.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return roots;
}

export async function postDealComment(input: {
  dealId: string;
  body: string;
  sectionContext?: string | null;
  parentId?: string | null;
  mentionedUserIds?: string[];
  visibility?: string;
}): Promise<DealComment> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error("You must be signed in to comment.");

  const { data, error } = await supabase
    .from("deal_comments")
    .insert({
      deal_id: input.dealId,
      author_user_id: userId,
      body: input.body,
      parent_id: input.parentId ?? null,
      section_context: input.sectionContext ?? null,
      visibility: input.visibility ?? "internal",
    })
    .select("id, deal_id, author_user_id, body, parent_id, section_context, visibility, created_at")
    .single();

  if (error) throw error;

  const mentions = input.mentionedUserIds ?? [];
  if (mentions.length > 0) {
    const { error: mentionError } = await supabase
      .from("comment_mentions")
      .insert(mentions.map((id) => ({ comment_id: data.id, mentioned_user_id: id })));
    // The comment is saved either way. Losing the mention is worth reporting
    // but not worth telling the user their comment failed.
    if (mentionError) console.warn("Could not record mentions:", mentionError.message);
  }

  const names = await resolveAuthorNames([userId]);

  return {
    id: data.id,
    dealId: data.deal_id,
    authorUserId: data.author_user_id,
    authorName: names.get(userId) ?? "You",
    body: data.body,
    parentId: data.parent_id,
    sectionContext: data.section_context,
    visibility: data.visibility,
    createdAt: data.created_at,
    mentionedUserIds: mentions,
    replies: [],
  };
}
