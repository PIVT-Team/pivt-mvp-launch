/**
 * ClosingChecklistCover — A draggable closing checklist with AI generation,
 * status badges, assignees, due dates, linked documents, comments, and realtime sync.
 *
 * Visual language matches existing PIVT cards (pivt-card / status tokens) — no new colors.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  CheckCircle2, Circle, Clock, FileText, GripVertical, Loader2,
  MessageSquare, Plus, Sparkles, Trash2, User as UserIcon, Ban, AlertTriangle, Calendar as CalendarIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { usePIVTStore } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ChecklistRow = Tables<'closing_checklist_items'> & { due_date?: string | null };
type DealMemberRow = Tables<'deal_members'>;
type DealDocRow = Tables<'deal_documents'>;
type CommentRow = Tables<'deal_comments'>;

type Status = 'pending' | 'in_progress' | 'satisfied' | 'waived' | 'not_applicable';

const STATUS_META: Record<Status, { label: string; badge: string; dot: string; icon: React.ElementType }> = {
  pending:        { label: 'Not Started', badge: 'bg-muted text-muted-foreground border-transparent',                   dot: 'bg-muted-foreground/40', icon: Circle },
  in_progress:    { label: 'In Progress', badge: 'bg-accent/10 text-accent border-accent/20',                            dot: 'bg-accent',              icon: Clock },
  satisfied:      { label: 'Completed',   badge: 'bg-validated/10 text-validated border-validated/20',                  dot: 'bg-validated',           icon: CheckCircle2 },
  waived:         { label: 'Blocked',     badge: 'bg-blocking/10 text-blocking border-blocking/20',                     dot: 'bg-blocking',            icon: Ban },
  not_applicable: { label: 'Blocked',     badge: 'bg-blocking/10 text-blocking border-blocking/20',                     dot: 'bg-blocking',            icon: Ban },
};

const STATUS_ORDER: Status[] = ['pending', 'in_progress', 'satisfied', 'waived'];

const DEMO_ID_MAP: Record<string, string> = {
  atlas:  'a0000000-0000-0000-0000-000000000001',
  beacon: 'b0000000-0000-0000-0000-000000000002',
  cipher: 'c0000000-0000-0000-0000-000000000003',
};

const initials = (label?: string | null) => {
  if (!label) return '—';
  return label.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '—';
};

// ───────────────────────────── Sortable Row ─────────────────────────────
interface RowProps {
  item: ChecklistRow;
  members: DealMemberRow[];
  memberProfiles: Record<string, string>;
  documents: DealDocRow[];
  commentCount: number;
  isReadOnly: boolean;
  onChange: (patch: Partial<ChecklistRow>) => void;
  onDelete: () => void;
  onOpenComments: () => void;
}

const ChecklistRowCard: React.FC<RowProps> = ({
  item, members, memberProfiles, documents, commentCount, isReadOnly, onChange, onDelete, onOpenComments,
}) => {
  const status = (item.status as Status) || 'pending';
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const StatusIcon = meta.icon;

  const sortable = useSortable({ id: item.id, disabled: isReadOnly });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };

  const assigneeLabel = item.responsible_party_id
    ? memberProfiles[item.responsible_party_id] ?? 'Assigned'
    : null;

  const linkedDoc = useMemo(
    () => documents.find(d => d.id === item.supporting_document_id),
    [documents, item.supporting_document_id],
  );

  const dueDate = item.due_date ? new Date(item.due_date) : null;
  const overdue = dueDate && isPast(dueDate) && status !== 'satisfied';

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'pivt-card p-4 group',
        sortable.isDragging && 'ring-1 ring-accent/40',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={isReadOnly}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Drag to reorder"
          type="button"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Status dot click-to-cycle */}
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => {
            const idx = STATUS_ORDER.indexOf(status);
            const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
            onChange({ status: next });
          }}
          className="mt-1 shrink-0"
          aria-label={`Cycle status, currently ${meta.label}`}
        >
          <StatusIcon className={cn('w-4 h-4', status === 'satisfied' ? 'text-validated' : status === 'in_progress' ? 'text-accent' : status === 'waived' ? 'text-blocking' : 'text-muted-foreground/60')} />
        </button>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Title row */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn('text-sm font-semibold truncate', status === 'satisfied' && 'line-through text-muted-foreground')}>
                  {item.title}
                </h3>
                <Badge className={cn('text-[10px] font-medium', meta.badge)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', meta.dot)} />
                  {meta.label}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {item.category}
                </Badge>
                {item.source === 'ai_generated' && (
                  <Badge variant="outline" className="text-[10px] gap-1 border-accent/30 text-accent">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-blocking p-1"
                aria-label="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Meta row: assignee · due date · doc · comments */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Assignee */}
            <Select
              value={item.responsible_party_id ?? '__none__'}
              onValueChange={(v) => onChange({ responsible_party_id: v === '__none__' ? null : v })}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs gap-1.5 px-2 bg-background/70 border-border/60">
                {assigneeLabel ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px] font-semibold">{initials(assigneeLabel)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[120px]">{assigneeLabel}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground"><UserIcon className="w-3 h-3" /> Unassigned</span>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {memberProfiles[m.id] ?? m.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Due date */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isReadOnly}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs border transition-colors',
                    overdue ? 'border-blocking/30 bg-blocking/5 text-blocking' : 'border-border/60 bg-background/70 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <CalendarIcon className="w-3 h-3" />
                  {dueDate ? format(dueDate, 'MMM d') : 'Due date'}
                  {overdue && <span className="text-[10px] font-medium">· overdue</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate ?? undefined}
                  onSelect={(d) => onChange({ due_date: d ? d.toISOString() : null })}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

            {/* Linked document */}
            <Select
              value={item.supporting_document_id ?? '__none__'}
              onValueChange={(v) => onChange({ supporting_document_id: v === '__none__' ? null : v })}
              disabled={isReadOnly || documents.length === 0}
            >
              <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs gap-1.5 px-2 bg-background/70 border-border/60">
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{linkedDoc?.file_name ?? 'No document'}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No document</SelectItem>
                {documents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Comments toggle */}
            <button
              type="button"
              onClick={onOpenComments}
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              {commentCount > 0 ? `${commentCount}` : 'Comment'}
            </button>

            {dueDate && (
              <span className="text-[10px] text-muted-foreground/70 ml-auto">
                {overdue ? `${formatDistanceToNow(dueDate)} overdue` : `due in ${formatDistanceToNow(dueDate)}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────── Comments Panel ─────────────────────────────
interface CommentsProps {
  itemId: string;
  dealId: string;
  comments: CommentRow[];
  isReadOnly: boolean;
  onClose: () => void;
  onPosted: () => void;
}

const CommentsPanel: React.FC<CommentsProps> = ({ itemId, dealId, comments, isReadOnly, onClose, onPosted }) => {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const body = draft.trim();
    if (!body || !user) return;
    setPosting(true);
    const { error } = await supabase.from('deal_comments').insert({
      deal_id: dealId,
      author_user_id: user.id,
      body,
      section_context: `checklist:${itemId}`,
    });
    setPosting(false);
    if (error) {
      toast.error('Could not post comment');
      return;
    }
    setDraft('');
    onPosted();
  };

  return (
    <div className="pivt-card p-4 mt-2 space-y-3 ml-9">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comments</h4>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{initials(c.author_user_id)}</span>
                <span>{format(new Date(c.created_at), 'MMM d, p')}</span>
              </div>
              <p className="mt-1 text-sm">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {!isReadOnly && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="min-h-[72px] text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={posting || !draft.trim()}>
              {posting ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ───────────────────────────── Main Cover ─────────────────────────────
export const ClosingChecklistCover: React.FC = () => {
  const { selectedDealId, setActiveSection } = usePIVTStore();
  const { user } = useAuth();

  const isUuid = selectedDealId && selectedDealId.includes('-') && selectedDealId.length > 20;
  const dealId = isUuid ? selectedDealId : (selectedDealId ? DEMO_ID_MAP[selectedDealId] : null);

  const [items, setItems] = useState<ChecklistRow[]>([]);
  const [members, setMembers] = useState<DealMemberRow[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<DealDocRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [newTitle, setNewTitle] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Initial load ──
  const fetchAll = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    const [itemsRes, membersRes, docsRes, commentsRes, dealRes] = await Promise.all([
      supabase.from('closing_checklist_items').select('*').eq('deal_id', dealId).order('sort_order', { ascending: true }),
      supabase.from('deal_members').select('*').eq('deal_id', dealId),
      supabase.from('deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
      supabase.from('deal_comments').select('*').eq('deal_id', dealId).like('section_context', 'checklist:%').order('created_at', { ascending: true }),
      supabase.from('deals').select('is_demo, visibility, owner_id').eq('id', dealId).maybeSingle(),
    ]);
    setItems((itemsRes.data ?? []) as ChecklistRow[]);
    setMembers(membersRes.data ?? []);
    setDocuments(docsRes.data ?? []);
    setComments(commentsRes.data ?? []);

    const deal = dealRes.data;
    const readOnly = !!(deal?.is_demo || deal?.visibility === 'global_demo' || (user && deal?.owner_id && deal.owner_id !== user.id));
    setIsReadOnly(readOnly);

    // Resolve assignee labels
    const userIds = Array.from(new Set((membersRes.data ?? []).map(m => m.user_id))).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const labelByMember: Record<string, string> = {};
      (membersRes.data ?? []).forEach(m => {
        const prof = profs?.find(p => p.user_id === m.user_id);
        labelByMember[m.id] = prof?.full_name || m.role;
      });
      setMemberProfiles(labelByMember);
    }
    setLoading(false);
  }, [dealId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Realtime ──
  useEffect(() => {
    if (!dealId) return;
    const channel = supabase
      .channel(`closing-checklist:${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'closing_checklist_items', filter: `deal_id=eq.${dealId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_comments', filter: `deal_id=eq.${dealId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dealId, fetchAll]);

  // ── Derived metrics ──
  const total = items.length;
  const completed = items.filter(i => i.status === 'satisfied').length;
  const blocked = items.filter(i => i.status === 'waived' || i.status === 'not_applicable').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const readiness = total > 0 ? Math.round((completed / total) * 100) : 0;

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.status === filter);
  }, [items, filter]);

  // ── Mutations ──
  const updateItem = async (id: string, patch: Partial<ChecklistRow>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    const { error } = await supabase.from('closing_checklist_items').update(patch as any).eq('id', id);
    if (error) {
      toast.error('Update failed');
      fetchAll();
    }
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('closing_checklist_items').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); fetchAll(); }
  };

  const addItem = async () => {
    const title = newTitle.trim();
    if (!title || !dealId) return;
    const sort_order = (items[items.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from('closing_checklist_items').insert({
      deal_id: dealId, title, category: 'Legal', sort_order, source: 'manual', status: 'pending',
    });
    if (error) toast.error('Could not add task');
    else { setNewTitle(''); }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    // Persist new sort_order for affected rows
    const updates = next.map((i, idx) => ({ id: i.id, sort_order: idx + 1 }));
    await Promise.all(updates.map(u =>
      supabase.from('closing_checklist_items').update({ sort_order: u.sort_order }).eq('id', u.id)
    ));
  };

  const generateFromAgreement = async () => {
    if (!dealId || isReadOnly) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-checklist-from-agreement', {
        body: { deal_id: dealId },
      });
      if (error) {
        const msg = (error as any)?.message || '';
        if (msg.includes('429')) toast.error('Rate limit reached. Try again shortly.');
        else if (msg.includes('402')) toast.error('AI credits exhausted. Add funds in workspace settings.');
        else toast.error('Generation failed');
        return;
      }
      toast.success(`Added ${data?.count ?? 0} AI-generated tasks`);
    } finally {
      setGenerating(false);
    }
  };

  const commentsByItem = useMemo(() => {
    const map: Record<string, CommentRow[]> = {};
    comments.forEach(c => {
      const ctx = c.section_context || '';
      const match = ctx.match(/^checklist:(.+)$/);
      if (match) {
        const itemId = match[1];
        (map[itemId] ||= []).push(c);
      }
    });
    return map;
  }, [comments]);

  if (!dealId) {
    return (
      <div className="space-y-4">
        <div className="pivt-card p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Select a deal to view its closing checklist.</p>
          <Button onClick={() => setActiveSection('deals')}>Go to Deals</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.03em' }}>Closing Checklist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track every condition, signature, and clearance required for close. Drag to re-order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={generateFromAgreement}
            disabled={generating || isReadOnly}
            className="gap-1.5 text-primary-foreground"
            style={{ background: 'var(--pivt-gradient-primary)' }}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Checklist from Purchase Agreement
          </Button>
        </div>
      </div>

      {/* Progress card */}
      <div className="pivt-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Readiness</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn(
                'font-mono text-3xl font-semibold',
                readiness >= 80 ? 'text-validated' : readiness >= 50 ? 'text-amber-500' : 'text-blocking',
              )}>{readiness}%</span>
              <span className="text-xs text-muted-foreground">{completed} of {total} complete</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> {inProgress} in progress</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-validated" /> {completed} done</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blocking" /> {blocked} blocked</span>
          </div>
        </div>
        <Progress value={readiness} className="h-2" />
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          {(['all', 'pending', 'in_progress', 'satisfied', 'waived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                filter === f
                  ? 'bg-accent/10 text-accent border-accent/20'
                  : 'border-border/50 bg-background/40 text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' ? 'All' : STATUS_META[f as Status].label}
            </button>
          ))}
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-1.5">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
              placeholder="Add a new task…"
              className="h-8 w-64 text-xs"
            />
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addItem} disabled={!newTitle.trim()}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="pivt-card p-12 text-center space-y-3">
          {items.length === 0 ? (
            <>
              <AlertTriangle className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No checklist items yet. Add one above or generate from a purchase agreement.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No items match this filter.</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filteredItems.map((it) => (
                  <motion.div
                    key={it.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChecklistRowCard
                      item={it}
                      members={members}
                      memberProfiles={memberProfiles}
                      documents={documents}
                      commentCount={(commentsByItem[it.id] ?? []).length}
                      isReadOnly={isReadOnly}
                      onChange={(patch) => updateItem(it.id, patch)}
                      onDelete={() => deleteItem(it.id)}
                      onOpenComments={() => setOpenComments(openComments === it.id ? null : it.id)}
                    />
                    {openComments === it.id && (
                      <CommentsPanel
                        itemId={it.id}
                        dealId={dealId}
                        comments={commentsByItem[it.id] ?? []}
                        isReadOnly={isReadOnly}
                        onClose={() => setOpenComments(null)}
                        onPosted={fetchAll}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isReadOnly && (
        <p className="text-[11px] text-muted-foreground text-center">
          This is a demo deal — checklist edits are disabled.
        </p>
      )}
    </div>
  );
};
