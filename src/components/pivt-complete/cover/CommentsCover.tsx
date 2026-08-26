import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Reply, AtSign, ChevronDown, ChevronUp, ThumbsUp, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fadeInUp } from '@/lib/animations';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { listDealComments, postDealComment, type DealComment } from '@/services/dealCommentsService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Types ──
interface Comment {
  id: string;
  deal_id: string;
  author_user_id: string;
  body: string;
  parent_id: string | null;
  section_context: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  // joined
  author_name?: string;
  replies?: Comment[];
  reactions?: Record<string, string[]>; // emoji -> userIds
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

/** The service returns camelCase; this screen was written around the row shape. */
function toViewComment(c: DealComment): Comment {
  return {
    id: c.id,
    deal_id: c.dealId,
    author_user_id: c.authorUserId,
    author_name: c.authorName,
    body: c.body,
    parent_id: c.parentId,
    section_context: c.sectionContext,
    visibility: c.visibility,
    created_at: c.createdAt,
    updated_at: c.createdAt,
    replies: c.replies.map(toViewComment),
  };
}

const SECTION_TAGS = ['General', 'Documents', 'Stakeholders', 'Payments', 'Escrow', 'Waterfall', 'Compliance'];

const SECTION_COLORS: Record<string, string> = {
  General: 'bg-muted/60 text-muted-foreground',
  Documents: 'bg-blue-500/10 text-blue-500',
  Stakeholders: 'bg-purple-500/10 text-purple-500',
  Payments: 'bg-emerald-500/10 text-emerald-500',
  Escrow: 'bg-amber-500/10 text-amber-600',
  Waterfall: 'bg-cyan-500/10 text-cyan-600',
  Compliance: 'bg-red-400/10 text-red-400',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Compose Box ──
const ComposeBox: React.FC<{
  onSubmit: (body: string, section: string, mentions: string[]) => void;
  participants: Participant[];
  placeholder?: string;
  compact?: boolean;
  /** True while a write is in flight — the comment now goes to the database,
   *  so a second click would post it twice. */
  busy?: boolean;
  disabled?: boolean;
}> = ({ onSubmit, participants, placeholder = 'Add a comment...', compact = false, busy = false, disabled = false }) => {
  const [body, setBody] = useState('');
  const [section, setSection] = useState('General');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredParticipants = useMemo(() =>
    participants.filter(p => p.name.toLowerCase().includes(mentionQuery.toLowerCase())),
    [participants, mentionQuery]
  );

  const handleInput = (val: string) => {
    setBody(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const query = val.slice(lastAt + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (p: Participant) => {
    const lastAt = body.lastIndexOf('@');
    const newBody = body.slice(0, lastAt) + `@${p.name} `;
    setBody(newBody);
    if (!mentions.includes(p.id)) setMentions([...mentions, p.id]);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!body.trim()) return;
    onSubmit(body.trim(), section, mentions);
    setBody('');
    setMentions([]);
    setSection('General');
  };

  return (
    <div className={`pivt-card p-4 space-y-3 ${compact ? '' : 'border-l-[3px]'}`}
      style={!compact ? { borderImage: 'linear-gradient(180deg, hsl(var(--g2-from)), hsl(var(--g2-to))) 1' } : undefined}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={e => handleInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-[60px] bg-muted/20 border-border/30 text-sm resize-none focus:ring-accent/30"
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
        />
        {/* Mentions dropdown */}
        <AnimatePresence>
          {showMentions && filteredParticipants.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute bottom-full left-0 mb-1 w-64 pivt-card p-1 shadow-lg z-50 max-h-40 overflow-auto"
            >
              {filteredParticipants.map(p => (
                <button
                  key={p.id}
                  onClick={() => insertMention(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent/8 text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-semibold text-accent">
                    {getInitials(p.name)}
                  </div>
                  <span>{p.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Section tag picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${SECTION_COLORS[section] || SECTION_COLORS.General}`}>
                {section}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              {SECTION_TAGS.map(s => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-muted/40 ${s === section ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  {s}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            onClick={() => { setBody(body + '@'); textareaRef.current?.focus(); setShowMentions(true); setMentionQuery(''); }}
            className="text-muted-foreground hover:text-accent transition-colors"
            title="Mention someone"
          >
            <AtSign className="w-4 h-4" />
          </button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!body.trim() || busy || disabled}
          size="sm"
          className="pivt-btn-primary gap-1.5 text-xs"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {busy ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </div>
  );
};

// ── Single Comment ──
const CommentItem: React.FC<{
  comment: Comment;
  participants: Participant[];
  onReply: (parentId: string, body: string, mentions: string[]) => void;
  depth?: number;
}> = ({ comment, participants, onReply, depth = 0 }) => {
  const [showReplies, setShowReplies] = useState(true);
  const [replying, setReplying] = useState(false);
  const replyCount = comment.replies?.length || 0;

  const highlightMentions = (text: string) => {
    return text.replace(/@(\w+\s?\w*)/g, '<span class="text-accent font-medium">@$1</span>');
  };

  return (
    <motion.div
      {...fadeInUp}
      className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-accent/10' : ''}`}
    >
      <div className="pivt-card p-4 group hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-[11px] font-semibold text-accent shrink-0">
            {getInitials(comment.author_name || 'U')}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{comment.author_name || 'User'}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(comment.created_at)}
              </span>
              {comment.section_context && comment.section_context !== 'General' && (
                <Badge className={`text-[9px] px-2 py-0 ${SECTION_COLORS[comment.section_context] || SECTION_COLORS.General}`}>
                  {comment.section_context}
                </Badge>
              )}
              {comment.visibility === 'external' && (
                <Badge className="text-[9px] px-2 py-0 bg-amber-500/10 text-amber-600">External</Badge>
              )}
            </div>

            {/* Body */}
            <div
              className="text-sm text-foreground/80 mt-1.5 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: highlightMentions(comment.body) }}
            />

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {depth === 0 && (
                <button
                  onClick={() => setReplying(!replying)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent transition-colors"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}
              <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-accent transition-colors">
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-emerald-500 transition-colors">
                <CheckCircle2 className="w-3 h-3" />
              </button>
              <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-500 transition-colors">
                <AlertTriangle className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reply compose */}
      <AnimatePresence>
        {replying && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 ml-8"
          >
            <ComposeBox
              onSubmit={(body, _, mentions) => { onReply(comment.id, body, mentions); setReplying(false); }}
              participants={participants}
              placeholder="Write a reply..."
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replies */}
      {replyCount > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="ml-8 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-2"
          >
            {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
          <AnimatePresence>
            {showReplies && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {comment.replies!.map(reply => (
                  <CommentItem key={reply.id} comment={reply} participants={participants} onReply={onReply} depth={1} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

// ── Main Comments Feed ──
export const CommentsCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { dealId: resolvedDealId } = useDealWorkspace();
  const { stakeholders } = usePIVTStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [filterSection, setFilterSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Demo participants from stakeholders
  const participants: Participant[] = useMemo(() =>
    stakeholders.map(s => ({ id: s.id, name: s.name, email: s.email })),
    [stakeholders]
  );

  // Real comments. This screen used to render a fixed conversation between
  // "John Chen" and "Sarah Kim" on whatever deal was open, including a live
  // one, and posting appended to React state and raised "Comment posted" — the
  // user's comment was gone on the next render. `deal_comments` had existed the
  // whole time.
  const load = useCallback(async () => {
    if (!resolvedDealId) { setComments([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await listDealComments(resolvedDealId);
      setComments(rows.map(toViewComment));
      setLoadError(null);
    } catch (e: any) {
      console.error('Could not load comments:', e);
      setLoadError(e?.message || 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [resolvedDealId]);

  useEffect(() => { void load(); }, [load]);

  const filteredComments = useMemo(() =>
    filterSection ? comments.filter(c => c.section_context === filterSection) : comments,
    [comments, filterSection]
  );

  // `mentions` arrive as display names from the picker; only ids that match a
  // real participant are recorded. Inventing a mention row for a name we cannot
  // resolve would create a notification pointing at nobody.
  const resolveMentionIds = (names: string[]): string[] =>
    names
      .map(n => participants.find(p => p.name === n || p.id === n)?.id)
      .filter((id): id is string => Boolean(id));

  const write = async (
    body: string,
    opts: { section?: string | null; parentId?: string | null; mentions: string[] },
    successMessage: string
  ) => {
    if (!resolvedDealId) {
      toast.error('Open a saved deal before commenting.');
      return;
    }
    setPosting(true);
    try {
      await postDealComment({
        dealId: resolvedDealId,
        body,
        sectionContext: opts.section ?? null,
        parentId: opts.parentId ?? null,
        mentionedUserIds: resolveMentionIds(opts.mentions),
      });
      // Re-read rather than splicing local state: what is on screen should be
      // what is stored, including anything a colleague posted meanwhile.
      await load();
      toast.success(successMessage);
    } catch (e: any) {
      console.error('Could not post comment:', e);
      toast.error(`Comment not saved: ${e?.message || 'unknown error'}`);
    } finally {
      setPosting(false);
    }
  };

  const handlePost = (body: string, section: string, mentions: string[]) =>
    void write(body, { section, mentions }, 'Comment posted');

  const handleReply = (parentId: string, body: string, mentions: string[]) =>
    void write(body, { parentId, mentions }, 'Reply posted');

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Comments</h2>
            <p className="text-xs text-muted-foreground">{totalComments} comments in this deal</p>
          </div>
        </div>
      </motion.div>

      {/* Compose */}
      <ComposeBox onSubmit={handlePost} participants={participants} busy={posting} disabled={!resolvedDealId} />

      {/* Section filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterSection(null)}
          className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-colors ${
            !filterSection ? 'bg-accent/10 text-accent' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {SECTION_TAGS.map(s => {
          const count = comments.filter(c => c.section_context === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilterSection(filterSection === s ? null : s)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-colors ${
                filterSection === s ? 'bg-accent/10 text-accent' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading comments…
          </div>
        )}

        {loadError && !loading && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <p className="text-sm font-medium text-red-500">Comments could not be loaded</p>
            <p className="text-xs text-muted-foreground mt-1">
              {loadError} This is not an empty conversation — nothing was read.
            </p>
          </div>
        )}

        {!resolvedDealId && !loading && (
          <div className="pivt-card p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              This deal has not been saved yet, so it has nowhere to keep comments.
            </p>
          </div>
        )}

        <AnimatePresence>
          {filteredComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              participants={participants}
              onReply={handleReply}
            />
          ))}
        </AnimatePresence>

        {!loading && !loadError && resolvedDealId && filteredComments.length === 0 && (
          <div className="pivt-card p-12 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filterSection ? `No comments tagged ${filterSection}.` : 'No comments yet. Start the conversation.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
