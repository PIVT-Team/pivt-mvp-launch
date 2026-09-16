/**
 * Comments across every deal the viewer can see.
 *
 * The Communications screen rendered six invented comments on three invented
 * deals to everyone who opened it. `deal_comments` is real and, since today,
 * written by the Comments tab; this reads it portfolio-wide.
 *
 * There is no read-receipt table, so there is no honest "unread". Rather than
 * fake one with localStorage — per-browser, wrong for a colleague — the screen
 * offers "mentions me", which `comment_mentions` records for real.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioComment {
  id: string;
  dealId: string;
  dealName: string;
  author: string;
  authorInitials: string;
  body: string;
  sectionContext: string;
  createdAt: string;
  mentionsYou: boolean;
  hasReply: boolean;
  replyCount: number;
  lastReplyAuthor: string | null;
  /** Kept for the card's border styling; there is no read state to derive it from. */
  unread: false;
}

export interface PortfolioDealOption { id: string; name: string }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export async function listPortfolioComments(limit = 100): Promise<{
  comments: PortfolioComment[]; deals: PortfolioDealOption[]; mentionCount: number;
}> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id ?? null;

  const { data: dealRows, error: dealErr } = await supabase
    .from("deals").select("id, deal_name").is("deleted_at", null);
  if (dealErr) throw dealErr;
  const deals = (dealRows ?? []).map((d) => ({ id: d.id, name: d.deal_name }));
  if (deals.length === 0) return { comments: [], deals: [], mentionCount: 0 };
  const dealName = new Map(deals.map((d) => [d.id, d.name]));

  const { data: rows, error } = await supabase
    .from("deal_comments")
    .select("id, deal_id, author_user_id, body, parent_id, section_context, created_at")
    .in("deal_id", deals.map((d) => d.id))
    .order("created_at", { ascending: false })
    .limit(limit * 4);           // replies are folded into their parents below
  if (error) throw error;
  const all = rows ?? [];

  const authorIds = Array.from(new Set(all.map((c) => c.author_user_id)));
  const [profilesRes, mentionsRes] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    me && all.length
      ? supabase.from("comment_mentions").select("comment_id").eq("mentioned_user_id", me).in("comment_id", all.map((c) => c.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const names = new Map<string, string>();
  for (const p of profilesRes.data ?? []) if (p.full_name) names.set(p.user_id, p.full_name);
  const mentioned = new Set((mentionsRes.data ?? []).map((m) => m.comment_id));

  // Fold replies into their parents: count them and remember the latest author.
  const replies = new Map<string, { count: number; lastAuthor: string | null; lastAt: string }>();
  for (const c of all) {
    if (!c.parent_id) continue;
    const cur = replies.get(c.parent_id) ?? { count: 0, lastAuthor: null, lastAt: "" };
    cur.count += 1;
    if (c.created_at > cur.lastAt) { cur.lastAt = c.created_at; cur.lastAuthor = names.get(c.author_user_id) ?? "Unknown user"; }
    replies.set(c.parent_id, cur);
  }

  const comments: PortfolioComment[] = all
    .filter((c) => !c.parent_id)
    .slice(0, limit)
    .map((c) => {
      const author = names.get(c.author_user_id) ?? "Unknown user";
      const r = replies.get(c.id);
      return {
        id: c.id,
        dealId: c.deal_id,
        dealName: dealName.get(c.deal_id) ?? "Unknown deal",
        author,
        authorInitials: initials(author),
        body: c.body,
        sectionContext: (c.section_context || "general").toLowerCase(),
        createdAt: c.created_at,
        mentionsYou: mentioned.has(c.id),
        hasReply: !!r,
        replyCount: r?.count ?? 0,
        lastReplyAuthor: r?.lastAuthor ?? null,
        unread: false,
      };
    });

  return { comments, deals, mentionCount: comments.filter((c) => c.mentionsYou).length };
}
