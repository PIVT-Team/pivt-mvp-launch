import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  CheckCircle2,
  Download,
  FileUp,
  Filter,
  Layers3,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { usePIVTStore } from '@/stores/pivtStore';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ChecklistItem, type ChecklistComment, type ChecklistItemModel, type ChecklistPresenceUser } from './checklist/ChecklistItem';
import { cn } from '@/lib/utils';

type ChecklistRow = Tables<'closing_checklist_items'>;
type DealDocumentRow = Tables<'deal_documents'>;
type DealMemberRow = Tables<'deal_members'>;
type EntityRow = Tables<'entities'>;
type DealCommentRow = Tables<'deal_comments'>;

type ChecklistStatus = ChecklistRow['status'];
type ChecklistCategory = 'Legal' | 'Financial' | 'Regulatory' | 'Technical';

interface PresencePayload {
  userId: string;
  label: string;
  section: ChecklistCategory | 'All';
  checklistItemId?: string | null;
}

interface SatisfactionDraft {
  item: ChecklistRow | null;
  note: string;
  selectedDocumentId: string;
  uploadingFile: File | null;
}

interface WaiveDraft {
  item: ChecklistRow | null;
  justification: string;
}

const CATEGORY_ORDER: ChecklistCategory[] = ['Legal', 'Financial', 'Regulatory', 'Technical'];

const CATEGORY_COPY: Record<ChecklistCategory, { label: string; detail: string }> = {
  Legal: { label: 'Legal', detail: 'Agreements, approvals, signatures, and legal deliverables.' },
  Financial: { label: 'Financial', detail: 'Funds flow, payouts, fees, and settlement readiness.' },
  Regulatory: { label: 'Regulatory', detail: 'Compliance, verification, and external clearances.' },
  Technical: { label: 'Technical', detail: 'Systems, cutover, data room, and operational dependencies.' },
};

const STATUS_PRIORITY: ChecklistStatus[] = ['pending', 'in_progress', 'waived', 'not_applicable', 'satisfied'];

const memberLabel = (member: DealMemberRow) => `${member.role.replace(/_/g, ' ')} · ${member.user_id.slice(0, 6)}`;

const commentAuthorLabel = (comment: DealCommentRow, currentUserId?: string) => {
  if (comment.author_user_id === currentUserId) return 'You';
  return `User ${comment.author_user_id.slice(0, 6)}`;
};

const statusRank = (status: ChecklistStatus) => STATUS_PRIORITY.indexOf(status);

const sortChecklistItems = (items: ChecklistRow[]) =>
  [...items].sort((a, b) => {
    const byOrder = a.sort_order - b.sort_order;
    if (byOrder !== 0) return byOrder;
    return a.title.localeCompare(b.title);
  });

interface ClosingCenterCoverProps {
  mode?: 'surface' | 'frame';
  className?: string;
}

export const ClosingCenterCover: React.FC<ClosingCenterCoverProps> = ({ mode = 'surface', className }) => {
  const { dealId, isDemoDeal, realDeal, refetchMetrics } = useDealWorkspace();
  const { user } = useAuth();
  const { setActiveSection, setSelectedEntity } = usePIVTStore();

  const [items, setItems] = useState<ChecklistRow[]>([]);
  const [documents, setDocuments] = useState<DealDocumentRow[]>([]);
  const [members, setMembers] = useState<DealMemberRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [commentsByItem, setCommentsByItem] = useState<Record<string, DealCommentRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ChecklistCategory | 'All'>('All');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [focusedSection, setFocusedSection] = useState<ChecklistCategory | 'All'>('All');
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  const [satisfactionDraft, setSatisfactionDraft] = useState<SatisfactionDraft>({ item: null, note: '', selectedDocumentId: '', uploadingFile: null });
  const [savingSatisfaction, setSavingSatisfaction] = useState(false);
  const [waiveDraft, setWaiveDraft] = useState<WaiveDraft>({ item: null, justification: '' });
  const [savingWaiver, setSavingWaiver] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', category: 'Legal' as ChecklistCategory });
  const [presenceMap, setPresenceMap] = useState<Record<string, PresencePayload>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const loadChecklist = useCallback(async () => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [itemsRes, docsRes, membersRes, entitiesRes, commentsRes] = await Promise.all([
        supabase
          .from('closing_checklist_items')
          .select('*')
          .eq('deal_id', dealId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('deal_documents')
          .select('*')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false }),
        supabase
          .from('deal_members')
          .select('*')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: true }),
        supabase
          .from('entities')
          .select('*')
          .eq('source_deal_id', dealId)
          .order('canonical_name', { ascending: true }),
        supabase
          .from('deal_comments')
          .select('*')
          .eq('deal_id', dealId)
          .like('section_context', 'checklist:%')
          .order('created_at', { ascending: true }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (docsRes.error) throw docsRes.error;
      if (membersRes.error) throw membersRes.error;
      if (entitiesRes.error) throw entitiesRes.error;
      if (commentsRes.error) throw commentsRes.error;

      const nextItems = sortChecklistItems((itemsRes.data || []) as ChecklistRow[]);
      setItems(nextItems);
      setDocuments((docsRes.data || []) as DealDocumentRow[]);
      setMembers((membersRes.data || []) as DealMemberRow[]);
      setEntities((entitiesRes.data || []) as EntityRow[]);

      const groupedComments = ((commentsRes.data || []) as DealCommentRow[]).reduce<Record<string, DealCommentRow[]>>((acc, comment) => {
        const itemId = comment.section_context?.replace('checklist:', '') || 'unknown';
        acc[itemId] = acc[itemId] || [];
        acc[itemId].push(comment);
        return acc;
      }, {});
      setCommentsByItem(groupedComments);

      setExpandedSections((current) => {
        const next = { ...current };
        nextItems.filter((item) => item.parent_id === null).forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = true;
        });
        return next;
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load closing checklist');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`closing-checklist-${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'closing_checklist_items', filter: `deal_id=eq.${dealId}` }, () => {
        loadChecklist();
        refetchMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_comments', filter: `deal_id=eq.${dealId}` }, loadChecklist)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_documents', filter: `deal_id=eq.${dealId}` }, loadChecklist)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, loadChecklist, refetchMetrics]);

  useEffect(() => {
    if (!dealId || !user) return;

    const channel = supabase.channel(`checklist:${dealId}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const flattened = Object.values(state).flat();
        setPresenceMap(
          flattened.reduce<Record<string, PresencePayload>>((acc, entry) => {
            acc[entry.userId] = entry;
            return acc;
          }, {}),
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            label: user.email?.split('@')[0] || 'You',
            section: focusedSection,
            checklistItemId: selectedIds[0] || null,
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [dealId, user]);

  useEffect(() => {
    const channel = presenceChannelRef.current;
    if (!channel || !user) return;

    channel.track({
      userId: user.id,
      label: user.email?.split('@')[0] || 'You',
      section: focusedSection,
      checklistItemId: selectedIds[0] || null,
    });
  }, [focusedSection, selectedIds, user]);

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const documentMap = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const entityMap = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'All') return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, items]);

  const topLevelItems = useMemo(() => filteredItems.filter((item) => item.parent_id === null), [filteredItems]);
  const childrenByParent = useMemo(
    () => filteredItems.reduce<Record<string, ChecklistRow[]>>((acc, item) => {
      if (!item.parent_id) return acc;
      acc[item.parent_id] = acc[item.parent_id] || [];
      acc[item.parent_id].push(item);
      return acc;
    }, {}),
    [filteredItems],
  );

  const actionableItems = useMemo(() => items.filter((item) => !childrenByParent[item.id]?.length), [items, childrenByParent]);

  const progress = useMemo(() => {
    const total = actionableItems.length;
    const satisfied = actionableItems.filter((item) => item.status === 'satisfied').length;
    const pct = total === 0 ? 0 : Math.round((satisfied / total) * 100);
    const breakdown = CATEGORY_ORDER.map((category) => {
      const categoryItems = actionableItems.filter((item) => item.category === category);
      const categorySatisfied = categoryItems.filter((item) => item.status === 'satisfied').length;
      return {
        category,
        total: categoryItems.length,
        satisfied: categorySatisfied,
        pct: categoryItems.length === 0 ? 0 : Math.round((categorySatisfied / categoryItems.length) * 100),
      };
    });
    return { total, satisfied, pct, breakdown };
  }, [actionableItems]);

  const presenceBySection = useMemo(() => {
    return CATEGORY_ORDER.reduce<Record<ChecklistCategory, ChecklistPresenceUser[]>>((acc, category) => {
      acc[category] = Object.values(presenceMap)
        .filter((entry) => entry.section === category)
        .map((entry) => ({ key: entry.userId, label: entry.label }));
      return acc;
    }, {} as Record<ChecklistCategory, ChecklistPresenceUser[]>);
  }, [presenceMap]);

  const commentModels = useMemo(() => {
    return Object.entries(commentsByItem).reduce<Record<string, ChecklistComment[]>>((acc, [itemId, comments]) => {
      acc[itemId] = comments.map((comment) => ({
        id: comment.id,
        authorLabel: commentAuthorLabel(comment, user?.id),
        body: comment.body,
        createdAt: comment.created_at,
      }));
      return acc;
    }, {});
  }, [commentsByItem, user?.id]);

  const unreadCounts = useMemo(() => {
    return Object.fromEntries(
      Object.entries(commentModels).map(([itemId, comments]) => [itemId, Math.max(comments.length - (seenCounts[itemId] || 0), 0)]),
    );
  }, [commentModels, seenCounts]);

  const toggleSelected = (itemId: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, itemId])] : current.filter((id) => id !== itemId)));
  };

  const handleCommentsViewed = (itemId: string) => {
    setSeenCounts((current) => ({ ...current, [itemId]: commentModels[itemId]?.length || 0 }));
  };

  const addComment = async (itemId: string, body: string) => {
    if (!dealId || !user) return;
    const { error } = await supabase.from('deal_comments').insert({
      deal_id: dealId,
      author_user_id: user.id,
      body,
      visibility: 'internal',
      section_context: `checklist:${itemId}`,
    } as any);

    if (error) {
      toast.error(error.message || 'Could not add comment');
      return;
    }

    loadChecklist();
  };

  const updateChecklistItems = async (ids: string[], payload: Partial<ChecklistRow>) => {
    if (ids.length === 0 || isDemoDeal) return;
    const { error } = await supabase.from('closing_checklist_items').update(payload).in('id', ids);
    if (error) {
      toast.error(error.message || 'Could not update checklist items');
      return;
    }
    toast.success('Checklist updated');
    setSelectedIds([]);
    loadChecklist();
    refetchMetrics();
  };

  const uploadEvidenceDocument = async (file: File) => {
    if (!dealId || !user) return null;
    const ext = file.name.split('.').pop() || 'pdf';
    const storagePath = `${dealId}/closing_checklist_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('deal-documents').upload(storagePath, file, { upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase.from('deal_documents').insert({
      deal_id: dealId,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'uploaded',
      doc_type: 'closing_checklist_evidence',
      uploaded_by: user.id,
    } as any).select('*').single();

    if (error) throw error;
    return data as DealDocumentRow;
  };

  const confirmSatisfaction = async () => {
    const item = satisfactionDraft.item;
    if (!item || !user) return;

    setSavingSatisfaction(true);
    try {
      let supportingDocumentId = satisfactionDraft.selectedDocumentId || null;

      if (satisfactionDraft.uploadingFile) {
        const uploadedDocument = await uploadEvidenceDocument(satisfactionDraft.uploadingFile);
        supportingDocumentId = uploadedDocument?.id || null;
      }

      const { error } = await supabase.from('closing_checklist_items').update({
        status: 'satisfied',
        satisfied_by: user.id,
        satisfied_at: new Date().toISOString(),
        supporting_document_id: supportingDocumentId,
      } as any).eq('id', item.id);

      if (error) throw error;

      if (satisfactionDraft.note.trim()) {
        await addComment(item.id, satisfactionDraft.note.trim());
      }

      toast.success('Checklist item marked satisfied');
      setSatisfactionDraft({ item: null, note: '', selectedDocumentId: '', uploadingFile: null });
      loadChecklist();
      refetchMetrics();
    } catch (error: any) {
      toast.error(error.message || 'Could not mark checklist item satisfied');
    } finally {
      setSavingSatisfaction(false);
    }
  };

  const confirmWaiver = async () => {
    const item = waiveDraft.item;
    if (!item) return;
    if (!waiveDraft.justification.trim()) {
      toast.error('A written justification is required to waive an item');
      return;
    }

    setSavingWaiver(true);
    try {
      const { error } = await supabase.from('closing_checklist_items').update({
        status: 'waived',
        waiver_justification: waiveDraft.justification.trim(),
      } as any).eq('id', item.id);
      if (error) throw error;

      await addComment(item.id, `Waiver justification: ${waiveDraft.justification.trim()}`);
      toast.success('Checklist item waived');
      setWaiveDraft({ item: null, justification: '' });
      loadChecklist();
      refetchMetrics();
    } catch (error: any) {
      toast.error(error.message || 'Could not waive checklist item');
    } finally {
      setSavingWaiver(false);
    }
  };

  const exportSelectedToPdf = () => {
    const exportItems = actionableItems.filter((item) => selectedIds.includes(item.id));
    if (exportItems.length === 0) {
      toast.error('Select checklist items to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 18;

    doc.setFontSize(18);
    doc.text('PIVT Closing Checklist Export', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(realDeal?.deal_name || 'Deal', 14, y);
    y += 10;

    exportItems.forEach((item, index) => {
      if (y > 260) {
        doc.addPage();
        y = 18;
      }

      const responsible = item.responsible_party_id ? memberLabel(memberMap.get(item.responsible_party_id)!) : 'Unassigned';
      const entity = item.entity_id ? entityMap.get(item.entity_id)?.canonical_name || 'Linked entity' : '—';
      const supporting = item.supporting_document_id ? documentMap.get(item.supporting_document_id)?.file_name || 'Evidence linked' : '—';

      doc.setDrawColor(220);
      doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3);
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${item.title}`, 18, y + 7);
      doc.setFontSize(9);
      doc.text(`Status: ${item.status}`, 18, y + 13);
      doc.text(`Category: ${item.category}`, 72, y + 13);
      doc.text(`Owner: ${responsible}`, 18, y + 19);
      doc.text(`Entity: ${entity}`, 100, y + 19);
      doc.text(`Evidence: ${supporting}`, 18, y + 25);
      y += 34;
    });

    doc.save(`closing-checklist-${realDeal?.deal_number || 'deal'}.pdf`);
  };

  const createManualItem = async () => {
    if (!dealId || !newItem.title.trim()) return;
    try {
      const nextOrder = items.length === 0 ? 0 : Math.max(...items.map((item) => item.sort_order)) + 1;
      const { error } = await supabase.from('closing_checklist_items').insert({
        deal_id: dealId,
        title: newItem.title.trim(),
        description: newItem.description.trim() || null,
        category: newItem.category,
        status: 'pending',
        source: 'manual',
        sort_order: nextOrder,
      } as any);
      if (error) throw error;
      setNewItem({ title: '', description: '', category: 'Legal' });
      setCreatingItem(false);
      toast.success('Checklist item added');
      loadChecklist();
    } catch (error: any) {
      toast.error(error.message || 'Could not create checklist item');
    }
  };

  const renderItemTree = (item: ChecklistRow, depth = 0): React.ReactNode => {
    const children = sortChecklistItems(childrenByParent[item.id] || []);
    const comments = commentModels[item.id] || [];
    const member = item.responsible_party_id ? memberMap.get(item.responsible_party_id) : null;
    const entity = item.entity_id ? entityMap.get(item.entity_id) : null;
    const document = item.supporting_document_id ? documentMap.get(item.supporting_document_id) : null;
    const sectionPresence = CATEGORY_ORDER.includes(item.category as ChecklistCategory)
      ? presenceBySection[item.category as ChecklistCategory]
      : [];

    return (
      <ChecklistItem
        key={item.id}
        item={item as ChecklistItemModel}
        depth={depth}
        isSection={children.length > 0}
        isExpanded={expandedSections[item.id] !== false}
        isSelected={selectedIds.includes(item.id)}
        isReadOnly={isDemoDeal}
        responsiblePartyLabel={member ? memberLabel(member) : null}
        entityLabel={entity?.canonical_name || null}
        supportingDocumentLabel={document?.file_name || null}
        unreadCount={unreadCounts[item.id] || 0}
        comments={comments}
        presenceUsers={children.length > 0 ? sectionPresence : []}
        onSelect={(checked) => toggleSelected(item.id, checked)}
        onToggleExpanded={() => setExpandedSections((current) => ({ ...current, [item.id]: current[item.id] === false ? true : false }))}
        onMarkSatisfied={() => setSatisfactionDraft({ item, note: '', selectedDocumentId: item.supporting_document_id || '', uploadingFile: null })}
        onWaive={() => setWaiveDraft({ item, justification: item.waiver_justification || '' })}
        onOpenEntity={() => {
          if (!entity) return;
          setSelectedEntity({ id: entity.id, type: 'deal', name: entity.canonical_name, status: 'linked' });
          setActiveSection('ontology');
        }}
        onAddComment={(body) => addComment(item.id, body)}
        onCommentsViewed={() => handleCommentsViewed(item.id)}
      >
        {children.map((child) => renderItemTree(child, depth + 1))}
      </ChecklistItem>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const isFrameMode = mode === 'frame';

  return (
    <div className={cn('space-y-6', isFrameMode && 'space-y-4', className)}>
      <section className={cn('rounded-2xl border border-border/60 bg-card space-y-5', isFrameMode ? 'p-5' : 'p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              <Layers3 className="h-3.5 w-3.5" />
              {isFrameMode ? 'Workspace Checklist' : 'Closing Checklist'}
            </div>
            <div>
              <h2 className={cn('font-semibold', isFrameMode ? 'text-xl' : 'text-2xl')}>{progress.satisfied} of {progress.total} conditions satisfied</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isFrameMode
                  ? 'This checklist now anchors collaboration across every workspace view.'
                  : 'The checklist is now the shared operating frame for legal, financial, regulatory, and technical close work.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
             <Button variant="outline" className="gap-2" onClick={() => setCreatingItem((current) => !current)} disabled={isDemoDeal}>
              <Plus className="h-4 w-4" />
               {isFrameMode ? 'Add item' : 'Add checklist item'}
            </Button>
             <Button variant="outline" className="gap-2" onClick={exportSelectedToPdf} disabled={selectedIds.length === 0}>
              <Download className="h-4 w-4" />
               {isFrameMode ? 'Export PDF' : 'Export selected to PDF'}
            </Button>
          </div>
        </div>

        <Progress value={progress.pct} className="h-2 [&>div]:bg-accent" />

        <div className="grid gap-3 lg:grid-cols-4">
          {progress.breakdown.map((bucket) => (
            <button
              key={bucket.category}
              type="button"
              onClick={() => {
                setCategoryFilter(bucket.category);
                setFocusedSection(bucket.category);
              }}
              className="rounded-xl border border-border/60 bg-background/70 p-4 text-left transition-colors hover:border-accent/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{bucket.category}</span>
                <Badge variant="outline" className="text-[10px]">{bucket.satisfied}/{bucket.total}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_COPY[bucket.category].detail}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${bucket.pct}%` }} />
              </div>
            </button>
          ))}
        </div>

        {creatingItem ? (
          <div className="rounded-xl border border-border/60 bg-background/70 p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-[1.4fr,1fr]">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newItem.title} onChange={(event) => setNewItem((current) => ({ ...current, title: event.target.value }))} placeholder="Add a closing deliverable" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(value) => setNewItem((current) => ({ ...current, category: value as ChecklistCategory }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newItem.description} onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))} placeholder="Add the context the team should collaborate around" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreatingItem(false)}>Cancel</Button>
              <Button onClick={createManualItem}>Create item</Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Bulk actions
          </div>
          <span className="text-sm text-foreground">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" disabled={selectedIds.length === 0 || isDemoDeal} onClick={() => updateChecklistItems(selectedIds, { status: 'not_applicable' })}>
            Mark not applicable
          </Button>
          <div className="w-56">
            <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Assign responsible party" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{memberLabel(member)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!bulkAssignee || selectedIds.length === 0 || isDemoDeal} onClick={() => updateChecklistItems(selectedIds, { responsible_party_id: bulkAssignee })}>
            Assign owner
          </Button>
          <Button size="sm" variant="ghost" onClick={() => {
            setCategoryFilter('All');
            setFocusedSection('All');
          }}>
            Clear filter
          </Button>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-accent" />
          <h3 className="mt-4 text-xl font-semibold">No closing checklist items yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with the first legal, financial, regulatory, or technical deliverable and let the team collaborate around it here.
          </p>
        </div>
      ) : (
        <div className={cn('space-y-4', isFrameMode && 'max-h-[calc(100vh-19rem)] overflow-y-auto pr-1')}>
          {topLevelItems.map((item) => renderItemTree(item))}
        </div>
      )}

      <Sheet open={Boolean(satisfactionDraft.item)} onOpenChange={(open) => !open && setSatisfactionDraft({ item: null, note: '', selectedDocumentId: '', uploadingFile: null })}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Mark satisfied with evidence</SheetTitle>
            <SheetDescription>
              Confirm completion, attach supporting evidence, and leave a note for the deal team.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold">{satisfactionDraft.item?.title}</p>
              {satisfactionDraft.item?.description ? <p className="mt-1 text-sm text-muted-foreground">{satisfactionDraft.item.description}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Select existing supporting document</Label>
              <Select value={satisfactionDraft.selectedDocumentId} onValueChange={(value) => setSatisfactionDraft((current) => ({ ...current, selectedDocumentId: value, uploadingFile: null }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((document) => (
                    <SelectItem key={document.id} value={document.id}>{document.file_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Or upload new evidence</Label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground hover:border-accent/30 hover:text-foreground">
                <span className="inline-flex items-center gap-2"><FileUp className="h-4 w-4" /> {satisfactionDraft.uploadingFile?.name || 'Choose a file'}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSatisfactionDraft((current) => ({ ...current, uploadingFile: file, selectedDocumentId: '' }));
                  }}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea value={satisfactionDraft.note} onChange={(event) => setSatisfactionDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add what was completed and any evidence context" />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSatisfactionDraft({ item: null, note: '', selectedDocumentId: '', uploadingFile: null })}>Cancel</Button>
            <Button onClick={confirmSatisfaction} disabled={savingSatisfaction || isDemoDeal || (!satisfactionDraft.selectedDocumentId && !satisfactionDraft.uploadingFile)}>
              {savingSatisfaction ? 'Saving…' : 'Confirm satisfaction'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(waiveDraft.item)} onOpenChange={(open) => !open && setWaiveDraft({ item: null, justification: '' })}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Waive checklist item</SheetTitle>
            <SheetDescription>
              A written justification is required before this item can be waived.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold">{waiveDraft.item?.title}</p>
            </div>
            <div className="space-y-2">
              <Label>Waiver justification</Label>
              <Textarea value={waiveDraft.justification} onChange={(event) => setWaiveDraft((current) => ({ ...current, justification: event.target.value }))} placeholder="Explain why this item is being waived" />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setWaiveDraft({ item: null, justification: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={confirmWaiver} disabled={savingWaiver || isDemoDeal || !waiveDraft.justification.trim()}>
              {savingWaiver ? 'Saving…' : 'Waive item'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};