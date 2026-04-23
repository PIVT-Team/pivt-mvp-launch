/**
 * ConditionsPrecedentCover — Closing CP tracker.
 * Visual language matches existing PIVT cards/tables. No new colors.
 *
 * Columns: CP Description · Status · Evidence · Owner · Due Date.
 * Actions: Mark Satisfied (with evidence upload), AI "Flag at-risk", link to Waterfall.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, isPast } from 'date-fns';
import {
  CheckCircle2, Circle, Ban, AlertTriangle, Sparkles, Upload, FileText,
  Loader2, Plus, Calculator, User as UserIcon, Calendar as CalendarIcon, ExternalLink,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { usePIVTStore } from '@/stores/pivtStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ConditionRow = Tables<'conditions'> & {
  description?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  due_date?: string | null;
  evidence_document_id?: string | null;
  evidence_note?: string | null;
  at_risk?: boolean;
  at_risk_reason?: string | null;
  satisfied_at?: string | null;
  waiver_justification?: string | null;
};
type DealDocRow = Tables<'deal_documents'>;

type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'SATISFIED' | 'WAIVED';

const STATUS_META: Record<Status, { label: string; badge: string; icon: React.ElementType }> = {
  NOT_STARTED: { label: 'Pending',   badge: 'bg-muted text-muted-foreground border-transparent',  icon: Circle },
  IN_PROGRESS: { label: 'In Review', badge: 'bg-accent/10 text-accent border-accent/20',          icon: AlertTriangle },
  SATISFIED:   { label: 'Satisfied', badge: 'bg-validated/10 text-validated border-validated/20', icon: CheckCircle2 },
  WAIVED:      { label: 'Waived',    badge: 'bg-blocking/10 text-blocking border-blocking/20',    icon: Ban },
};

const DEMO_ID_MAP: Record<string, string> = {
  atlas:  'a0000000-0000-0000-0000-000000000001',
  beacon: 'b0000000-0000-0000-0000-000000000002',
  cipher: 'c0000000-0000-0000-0000-000000000003',
};

const normalizeStatus = (s: string | null | undefined): Status => {
  if (s === 'SATISFIED' || s === 'IN_PROGRESS' || s === 'WAIVED' || s === 'BLOCKED') {
    return s === 'BLOCKED' ? 'WAIVED' : s;
  }
  return 'NOT_STARTED';
};

export const ConditionsPrecedentCover: React.FC = () => {
  const { selectedDealId, setActiveSection } = usePIVTStore();
  const dealId = useMemo(() => DEMO_ID_MAP[selectedDealId] ?? selectedDealId, [selectedDealId]);

  const [items, setItems] = useState<ConditionRow[]>([]);
  const [documents, setDocuments] = useState<DealDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [satisfyTarget, setSatisfyTarget] = useState<ConditionRow | null>(null);
  const [satisfyNote, setSatisfyNote] = useState('');
  const [satisfyDocId, setSatisfyDocId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Load ──
  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const [{ data: conds }, { data: docs }] = await Promise.all([
      supabase.from('conditions').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
      supabase.from('deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
    ]);
    setItems((conds ?? []) as ConditionRow[]);
    setDocuments(docs ?? []);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime ──
  useEffect(() => {
    if (!dealId) return;
    const ch = supabase
      .channel(`conditions:${dealId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conditions', filter: `deal_id=eq.${dealId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealId, load]);

  // ── Mutations ──
  const updateRow = useCallback(async (id: string, patch: Partial<ConditionRow>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } as ConditionRow : i)));
    const { error } = await supabase.from('conditions').update(patch as any).eq('id', id);
    if (error) {
      toast.error('Update failed', { description: error.message });
      load();
    }
  }, [load]);

  const addRow = useCallback(async () => {
    if (!newTitle.trim() || !dealId) return;
    setCreating(true);
    const { error } = await supabase.from('conditions').insert({
      deal_id: dealId,
      title: newTitle.trim(),
      status: 'NOT_STARTED' as any,
    } as any);
    setCreating(false);
    if (error) {
      toast.error('Could not add CP', { description: error.message });
      return;
    }
    setNewTitle('');
    toast.success('Condition added');
  }, [newTitle, dealId]);

  // ── Mark Satisfied with optional upload ──
  const openSatisfy = (row: ConditionRow) => {
    setSatisfyTarget(row);
    setSatisfyNote(row.evidence_note ?? '');
    setSatisfyDocId(row.evidence_document_id ?? '');
  };

  const handleUpload = async (file: File) => {
    if (!dealId) return;
    setUploading(true);
    try {
      const path = `${dealId}/cp-evidence/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('deal-documents').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: doc, error: docErr } = await supabase
        .from('deal_documents')
        .insert({
          deal_id: dealId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type || null,
          status: 'verified',
        } as any)
        .select()
        .single();
      if (docErr) throw docErr;
      setDocuments(prev => [doc as DealDocRow, ...prev]);
      setSatisfyDocId((doc as DealDocRow).id);
      toast.success('Evidence uploaded');
    } catch (e: any) {
      toast.error('Upload failed', { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const confirmSatisfy = async () => {
    if (!satisfyTarget) return;
    await updateRow(satisfyTarget.id, {
      status: 'SATISFIED' as any,
      satisfied_at: new Date().toISOString(),
      evidence_document_id: satisfyDocId || null,
      evidence_note: satisfyNote.trim() || null,
      at_risk: false,
      at_risk_reason: null,
    });
    toast.success('Marked satisfied');
    setSatisfyTarget(null);
    setSatisfyNote('');
    setSatisfyDocId('');
  };

  // ── AI flag-at-risk ──
  const runAtRiskScan = useCallback(async () => {
    if (!dealId) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('flag-cp-at-risk', { body: { deal_id: dealId } });
      if (error) throw error;
      const flagged = data?.flagged ?? 0;
      toast.success(flagged > 0 ? `${flagged} CP${flagged === 1 ? '' : 's'} flagged at risk` : 'No CPs flagged at risk');
      load();
    } catch (e: any) {
      toast.error('AI scan failed', { description: e?.message });
    } finally {
      setAiLoading(false);
    }
  }, [dealId, load]);

  // ── Derived ──
  const stats = useMemo(() => {
    const total = items.length;
    const satisfied = items.filter(i => i.status === 'SATISFIED').length;
    const waived = items.filter(i => i.status === 'WAIVED').length;
    const atRisk = items.filter(i => i.at_risk && i.status !== 'SATISFIED' && i.status !== 'WAIVED').length;
    return { total, satisfied, waived, atRisk, pct: total ? Math.round(((satisfied + waived) / total) * 100) : 0 };
  }, [items]);

  const docMap = useMemo(() => {
    const m: Record<string, DealDocRow> = {};
    for (const d of documents) m[d.id] = d;
    return m;
  }, [documents]);

  // ── Render ──
  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conditions Precedent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track every closing condition with evidence, ownership, and AI-assisted risk flagging.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setActiveSection('waterfall' as any)}
            className="gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" /> View Waterfall
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={runAtRiskScan}
            disabled={aiLoading || items.length === 0}
            className="gap-1.5"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Flag at-risk (AI)
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Total CPs" value={stats.total} />
        <SummaryStat label="Satisfied" value={stats.satisfied} tone="validated" />
        <SummaryStat label="Waived" value={stats.waived} tone="muted" />
        <SummaryStat label="At Risk" value={stats.atRisk} tone={stats.atRisk > 0 ? 'blocking' : 'muted'} />
      </div>

      {/* Add row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a new condition precedent…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addRow(); }}
          className="max-w-md"
        />
        <Button size="sm" onClick={addRow} disabled={!newTitle.trim() || creating} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add CP
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">CP Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading conditions…
              </TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                No conditions precedent yet. Add one above to get started.
              </TableCell></TableRow>
            ) : items.map((row) => {
              const status = normalizeStatus(row.status as string);
              const meta = STATUS_META[status];
              const Icon = meta.icon;
              const overdue = row.due_date && status !== 'SATISFIED' && status !== 'WAIVED' && isPast(new Date(row.due_date));
              const evidenceDoc = row.evidence_document_id ? docMap[row.evidence_document_id] : undefined;

              return (
                <TableRow key={row.id} className={cn(row.at_risk && 'bg-blocking/5')}>
                  {/* Description */}
                  <TableCell className="align-top py-3">
                    <div className="font-medium text-sm leading-tight">{row.title}</div>
                    {row.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{row.description}</div>
                    )}
                    {row.at_risk && row.at_risk_reason && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-blocking">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="leading-snug">{row.at_risk_reason}</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="align-top py-3">
                    <Select
                      value={status}
                      onValueChange={(v) => updateRow(row.id, { status: v as any })}
                    >
                      <SelectTrigger className={cn('h-7 px-2 w-auto gap-1.5 text-xs border', meta.badge)}>
                        <Icon className="w-3 h-3" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_META) as Status[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Evidence */}
                  <TableCell className="align-top py-3">
                    {evidenceDoc ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[160px]" title={evidenceDoc.file_name}>
                          {evidenceDoc.file_name}
                        </span>
                      </div>
                    ) : row.evidence_note ? (
                      <span className="text-xs text-muted-foreground italic line-clamp-2">{row.evidence_note}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>

                  {/* Owner */}
                  <TableCell className="align-top py-3">
                    <Input
                      value={row.owner_name ?? ''}
                      onChange={(e) => setItems(prev => prev.map(i => i.id === row.id ? { ...i, owner_name: e.target.value } : i))}
                      onBlur={(e) => updateRow(row.id, { owner_name: e.target.value || null })}
                      placeholder="Assign…"
                      className="h-7 text-xs px-2 border-transparent hover:border-border focus:border-border"
                    />
                  </TableCell>

                  {/* Due date */}
                  <TableCell className="align-top py-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost" size="sm"
                          className={cn(
                            'h-7 px-2 text-xs gap-1.5 font-normal',
                            overdue && 'text-blocking',
                            !row.due_date && 'text-muted-foreground/60',
                          )}
                        >
                          <CalendarIcon className="w-3 h-3" />
                          {row.due_date ? format(new Date(row.due_date), 'MMM d, yyyy') : 'Set date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={row.due_date ? new Date(row.due_date) : undefined}
                          onSelect={(d) => updateRow(row.id, { due_date: d ? d.toISOString() : null })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="align-top py-3 text-right">
                    {status !== 'SATISFIED' ? (
                      <Button
                        size="sm" variant="outline"
                        className="h-7 px-2.5 text-xs gap-1.5"
                        onClick={() => openSatisfy(row)}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Satisfied
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {row.satisfied_at ? format(new Date(row.satisfied_at), 'MMM d') : 'Done'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer link to waterfall */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <Calculator className="w-4 h-4 text-accent mt-0.5" />
          <div>
            <div className="text-sm font-medium">Linked to Waterfall</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              All CPs must be satisfied or waived before disbursements clear the waterfall calculation.
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setActiveSection('waterfall' as any)} className="gap-1.5">
          Open Waterfall <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

      {/* Mark Satisfied dialog with upload */}
      <Dialog open={!!satisfyTarget} onOpenChange={(o) => !o && setSatisfyTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark CP as Satisfied</DialogTitle>
            <DialogDescription className="line-clamp-2">{satisfyTarget?.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Evidence document</label>
              {satisfyDocId && docMap[satisfyDocId] ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{docMap[satisfyDocId].file_name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSatisfyDocId('')}>Clear</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={satisfyDocId} onValueChange={setSatisfyDocId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Link existing document…" /></SelectTrigger>
                    <SelectContent>
                      {documents.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No documents yet</div>}
                      {documents.map(d => <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline" size="sm" onClick={() => fileRef.current?.click()}
                    disabled={uploading} className="gap-1.5 shrink-0"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </Button>
                  <input
                    ref={fileRef} type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Evidence note (optional)</label>
              <Textarea
                value={satisfyNote}
                onChange={(e) => setSatisfyNote(e.target.value)}
                placeholder="e.g. HSR clearance received 2026-02-12; reference letter attached."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSatisfyTarget(null)}>Cancel</Button>
            <Button onClick={confirmSatisfy} className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Satisfied
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ───────────────────────────── Sub-components ─────────────────────────────
const SummaryStat: React.FC<{ label: string; value: number; tone?: 'validated' | 'blocking' | 'muted' }> = ({ label, value, tone }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn(
      'text-2xl font-semibold mt-1 tabular-nums',
      tone === 'validated' && 'text-validated',
      tone === 'blocking' && 'text-blocking',
    )}>{value}</div>
  </div>
);

export default ConditionsPrecedentCover;
