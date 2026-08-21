import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, FileSignature, FileWarning,
  Loader2, Mail, PenLine, ShieldCheck, Upload, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import {
  listRequirements, reviewRequirement,
  type DealRequirement, type RequirementKind,
} from '@/services/requirementsService';
import { buildAllPackets, groupBySignatory } from '@/services/signaturePacketService';

/**
 * One view over signatures, consents and external deliverables.
 *
 * They are the same underlying record differing by `requirement_kind`, so this
 * is a single component with a filter rather than three separate screens —
 * the Requirements Engine idea made visible.
 *
 * The review gate is the centre of it: an AI-extracted row shows an amber
 * "Needs review" state and cannot be acted on until a person approves or
 * rejects it, with every field editable first.
 */

const KIND_TABS: Array<{ id: RequirementKind | 'all'; label: string; icon: React.ElementType }> = [
  { id: 'all', label: 'All', icon: ShieldCheck },
  { id: 'signature', label: 'Signatures', icon: FileSignature },
  { id: 'consent', label: 'Consents', icon: PenLine },
  { id: 'external_document', label: 'Deliverables', icon: Upload },
];

const STATUS_STYLE: Record<string, string> = {
  satisfied: 'bg-validated/10 text-validated border-validated/20',
  waived: 'bg-muted text-muted-foreground border-border',
  not_required: 'bg-muted text-muted-foreground border-border',
  issue: 'bg-blocking/10 text-blocking border-blocking/20',
  under_review: 'bg-discrepancy/10 text-discrepancy border-discrepancy/20',
  sent: 'bg-accent/10 text-accent border-accent/20',
  viewed: 'bg-accent/10 text-accent border-accent/20',
  responded: 'bg-accent/10 text-accent border-accent/20',
  draft_ready: 'bg-muted text-muted-foreground border-border',
  not_started: 'bg-muted text-muted-foreground border-border',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not sent', draft_ready: 'Draft ready', sent: 'Sent', viewed: 'Viewed',
  responded: 'Responded', under_review: 'Review required', satisfied: 'Complete',
  waived: 'Waived', not_required: 'Not required', issue: 'Issue',
};

const isOverdue = (r: DealRequirement) =>
  !!r.due_date && new Date(r.due_date) < new Date() &&
  !['satisfied', 'waived', 'not_required'].includes(r.status);

export const RequirementsCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { toast } = useToast();
  const [rows, setRows] = useState<DealRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RequirementKind | 'all'>('all');
  const [reviewing, setReviewing] = useState<DealRequirement | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      setRows(await listRequirements(dealId));
    } catch (e) {
      toast({ title: 'Could not load requirements', description: String((e as Error).message), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [dealId, toast]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (tab === 'all' ? rows : rows.filter((r) => r.requirement_kind === tab)),
    [rows, tab]
  );

  const stats = useMemo(() => {
    const open = rows.filter((r) => !['satisfied', 'waived', 'not_required'].includes(r.status));
    return {
      required: rows.length,
      complete: rows.filter((r) => r.status === 'satisfied').length,
      outstanding: open.length,
      overdue: rows.filter(isOverdue).length,
      needsReview: rows.filter((r) => r.review_status === 'pending_review').length,
      reviewRequired: rows.filter((r) => r.status === 'under_review').length,
    };
  }, [rows]);

  const runExtractor = async (fn: 'extract-signature-matrix' | 'extract-consents') => {
    if (!dealId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { deal_id: dealId } });
      if (error) throw error;
      toast({
        title: `${data?.created ?? 0} proposed for review`,
        description: data?.created
          ? 'Nothing is sent until you approve each item.'
          : (data?.message ?? 'No new findings.'),
      });
      await load();
    } catch (e) {
      toast({ title: 'Extraction failed', description: String((e as Error).message), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const generatePackets = async () => {
    setBusy(true);
    try {
      const { blob, packets, skipped } = await buildAllPackets(rows, 'Deal');
      if (packets.length === 0) {
        toast({
          title: 'Nothing to generate',
          description: 'Every signature requirement is still awaiting review. Approve them first.',
          variant: 'destructive',
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'signature-packets.zip'; a.click();
      URL.revokeObjectURL(url);
      toast({
        title: `${packets.length} packet${packets.length > 1 ? 's' : ''} generated`,
        description: skipped.length
          ? `${skipped.length} signatory group skipped — still awaiting review.`
          : 'One PDF per signatory, grouped by person.',
      });
    } catch (e) {
      toast({ title: 'Could not generate packets', description: String((e as Error).message), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const signatoryCount = useMemo(() => groupBySignatory(rows).length, [rows]);

  if (loading) {
    return (
      <div className="pivt-card p-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── census ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Required', value: stats.required, tone: '' },
          { label: 'Complete', value: stats.complete, tone: 'text-validated' },
          { label: 'Outstanding', value: stats.outstanding, tone: '' },
          { label: 'Overdue', value: stats.overdue, tone: stats.overdue ? 'text-blocking' : '' },
          { label: 'Review required', value: stats.reviewRequired, tone: stats.reviewRequired ? 'text-discrepancy' : '' },
        ].map((s) => (
          <div key={s.label} className="pivt-card p-4">
            <p className="pivt-metric-label">{s.label}</p>
            <p className={`font-mono text-2xl font-medium mt-1 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── the review gate, surfaced before anything else ── */}
      {stats.needsReview > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-discrepancy/25 bg-discrepancy/5">
          <AlertTriangle className="w-4 h-4 text-discrepancy shrink-0" />
          <p className="text-xs flex-1">
            <span className="font-medium">{stats.needsReview} AI-extracted item{stats.needsReview > 1 ? 's' : ''} awaiting your review.</span>{' '}
            These are proposed interpretations, not legal determinations. Nothing is sent to a counterparty until you approve it.
          </p>
        </div>
      )}

      {/* ── tabs + extractors ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {KIND_TABS.map((t) => {
          const Icon = t.icon;
          const n = t.id === 'all' ? rows.length : rows.filter((r) => r.requirement_kind === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                tab === t.id ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="font-mono opacity-60">{n}</span>
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <button disabled={busy} onClick={() => runExtractor('extract-signature-matrix')}
            className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Find signatures'}
          </button>
          <button disabled={busy} onClick={() => runExtractor('extract-consents')}
            className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/50 disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Find consents'}
          </button>
          {signatoryCount > 0 && (
            <button disabled={busy} onClick={generatePackets}
              className="text-xs px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50">
              Generate packets ({signatoryCount})
            </button>
          )}
        </div>
      </div>

      {/* ── the matrix ── */}
      {visible.length === 0 ? (
        <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
          No requirements yet. Run an extractor above, or add one manually.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <RequirementRow key={r.id} r={r} onReview={() => setReviewing(r)} />
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewDrawer
          requirement={reviewing}
          onClose={() => setReviewing(null)}
          onDone={async () => { setReviewing(null); await load(); }}
        />
      )}
    </div>
  );
};

// ── one row of the matrix ───────────────────────────────────────────────────
const RequirementRow: React.FC<{ r: DealRequirement; onReview: () => void }> = ({ r, onReview }) => {
  const pending = r.review_status === 'pending_review';
  const overdue = isOverdue(r);
  const src = (r.source_ref || {}) as Record<string, string>;

  return (
    <div className={`pivt-card p-4 border-l-4 ${
      pending ? 'border-discrepancy bg-discrepancy/4'
      : r.status === 'satisfied' ? 'border-validated'
      : overdue || r.status === 'issue' ? 'border-blocking bg-blocking/4'
      : 'border-border'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{r.title}</p>
            {pending && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-discrepancy/15 text-discrepancy font-medium">
                NEEDS REVIEW
              </span>
            )}
            {r.requirement_type === 'unclear' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">AMBIGUOUS</span>
            )}
            {r.blocks_closing && !['satisfied', 'waived', 'not_required'].includes(r.status) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blocking/10 text-blocking">BLOCKS CLOSING</span>
            )}
          </div>

          {/* the matrix columns your brief asks for */}
          <p className="text-[11px] text-muted-foreground mt-1">
            {[
              r.signing_party && `Party: ${r.signing_party}`,
              r.signatory_name && `Signatory: ${r.signatory_name}`,
              r.signatory_capacity && `Capacity: ${r.signatory_capacity}`,
              r.counterparty_name && !r.signing_party && `Counterparty: ${r.counterparty_name}`,
              r.trigger_event && `Trigger: ${r.trigger_event}`,
              r.due_date && `Due: ${r.due_date}`,
            ].filter(Boolean).join('  ·  ')}
          </p>

          {/* clause traceability — the reason a lawyer can trust the row */}
          {src.snippet && (
            <p className="text-[10px] text-muted-foreground/80 mt-1.5 italic border-l-2 border-border/60 pl-2 line-clamp-2">
              “{src.snippet}”
              {src.clause_ref && <span className="not-italic"> — {src.clause_ref}</span>}
              {src.filename && <span className="not-italic opacity-70"> ({src.filename})</span>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {overdue && <Clock className="w-3.5 h-3.5 text-blocking" />}
          <span className={`text-[9px] px-2 py-1 rounded border ${STATUS_STYLE[r.status] ?? STATUS_STYLE.not_started}`}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
          {pending && (
            <button onClick={onReview}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20">
              Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── review drawer: approve, amend, or reject ────────────────────────────────
const ReviewDrawer: React.FC<{
  requirement: DealRequirement; onClose: () => void; onDone: () => void;
}> = ({ requirement, onClose, onDone }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState({
    title: requirement.title,
    counterparty_name: requirement.counterparty_name ?? '',
    counterparty_email: requirement.counterparty_email ?? '',
    signatory_name: requirement.signatory_name ?? '',
    signatory_capacity: requirement.signatory_capacity ?? '',
    requirement_type: requirement.requirement_type ?? '',
    blocks_closing: requirement.blocks_closing,
  });
  const src = (requirement.source_ref || {}) as Record<string, string>;

  const submit = async (decision: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await reviewRequirement(requirement.id, decision, {
        title: edits.title,
        counterparty_name: edits.counterparty_name || null,
        counterparty_email: edits.counterparty_email || null,
        signatory_name: edits.signatory_name || null,
        signatory_capacity: edits.signatory_capacity || null,
        requirement_type: edits.requirement_type || null,
        blocks_closing: edits.blocks_closing,
      } as never);
      toast({
        title: decision === 'approved' ? 'Approved' : 'Rejected',
        description: decision === 'approved'
          ? 'This item can now be actioned. It still needs a request approved before anything is sent.'
          : 'This item no longer gates closing.',
      });
      onDone();
    } catch (e) {
      toast({ title: 'Could not save', description: String((e as Error).message), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof typeof edits, placeholder = '') => (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={String(edits[key] ?? '')}
        placeholder={placeholder}
        onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
        className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-border/60 bg-background"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="pivt-card w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">Review extracted requirement</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              AI proposed this. Correct anything that's wrong before approving.
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {src.snippet && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Source</p>
            <p className="text-[11px] italic">“{src.snippet}”</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {[src.filename, src.clause_ref].filter(Boolean).join(' — ')}
            </p>
          </div>
        )}

        {requirement.ai_confidence != null && (
          <p className="text-[11px] text-muted-foreground">
            Model confidence {Math.round(Number(requirement.ai_confidence) * 100)}%
            {requirement.ai_ambiguity === 'high' && ' · flagged ambiguous'}
          </p>
        )}

        <div className="space-y-3">
          {field('Title', 'title')}
          {requirement.requirement_kind === 'signature' ? (
            <div className="grid grid-cols-2 gap-3">
              {field('Signatory', 'signatory_name', 'not stated in document')}
              {field('Capacity', 'signatory_capacity')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {field('Counterparty', 'counterparty_name')}
              {field('Contact email', 'counterparty_email')}
            </div>
          )}
          {(requirement.requirement_kind === 'consent' || requirement.requirement_kind === 'notice') && (
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Classification</span>
              <select
                value={edits.requirement_type}
                onChange={(e) => setEdits((s) => ({ ...s, requirement_type: e.target.value }))}
                className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-border/60 bg-background"
              >
                <option value="consent">Consent required</option>
                <option value="notice">Notice only</option>
                <option value="unclear">Still unclear</option>
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={edits.blocks_closing}
              onChange={(e) => setEdits((s) => ({ ...s, blocks_closing: e.target.checked }))} />
            Blocks closing until satisfied
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button disabled={busy} onClick={() => submit('approved')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-accent text-accent-foreground disabled:opacity-50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </button>
          <button disabled={busy} onClick={() => submit('rejected')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-border/60 disabled:opacity-50">
            <FileWarning className="w-3.5 h-3.5" /> Not required
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Mail className="w-3 h-3" /> Approving does not send anything. Requests are approved separately.
        </p>
      </div>
    </div>
  );
};
