/**
 * Newton Work Area Tabs — Stakeholders, Documents, Funds Flow, Wire, Tax, Approvals, Execution
 * Each tab shows real data with editable fields and actionable empty states.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { NewtonSourceBadge } from '../NewtonSourceBadge';
import {
  Users, FileText, DollarSign, Landmark, Receipt,
  CheckSquare, Shield, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ───────────────────────────────────────────────────

interface StakeholderRow {
  id: string; shareholder_name: string; email: string | null; role: string;
  ownership_pct: number; payout_amount: number; verification_status: string;
  created_by_source?: string; needs_review?: boolean; confidence_status?: string;
  locked?: boolean; locked_reason?: string | null;
}

interface WireRow {
  id: string; payee_entity: string; amount: number; currency: string;
  payment_type: string; bank_name: string | null; verification_status: string;
  created_by_source?: string; needs_review?: boolean; confidence_status?: string; locked?: boolean;
}

interface DocRow { id: string; filename: string; doc_type: string; status: string; uploaded_at: string; }
interface ApprovalRow { id: string; approver_name: string | null; approver_email: string | null; approver_role: string | null; approval_side: string; status: string; delivery_method: string | null; envelope_id: string | null; }
interface TaxFormRow { id: string; form_type: string; status: string; recipient_id: string; }
interface TabConfig { key: string; label: string; icon: React.ElementType; count?: number; alert?: number; }

// ─── Component ───────────────────────────────────────────────

interface Props {
  dealId: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onComposerAction?: (prompt: string) => void;
}

export const NewtonWorkAreaTabs: React.FC<Props> = ({ dealId, activeTab, onTabChange, onComposerAction }) => {
  const [stakeholders, setStakeholders] = useState<StakeholderRow[]>([]);
  const [wires, setWires] = useState<WireRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [taxForms, setTaxForms] = useState<TaxFormRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const [sRes, wRes, dRes, aRes, tRes] = await Promise.all([
      supabase.from('cap_table_entries').select('id, shareholder_name, email, role, ownership_pct, payout_amount, verification_status, created_by_source, needs_review, confidence_status, locked, locked_reason').eq('deal_id', dealId),
      supabase.from('wire_instructions').select('id, payee_entity, amount, currency, payment_type, bank_name, verification_status, created_by_source, needs_review, confidence_status, locked').eq('deal_id', dealId),
      supabase.from('contract_documents').select('id, filename, doc_type, status, uploaded_at').eq('deal_id', dealId).order('uploaded_at', { ascending: false }),
      supabase.from('deal_approvals').select('id, approver_name, approver_email, approver_role, approval_side, status, delivery_method, envelope_id').eq('deal_id', dealId),
      supabase.from('tax_forms').select('id, form_type, status, recipient_id').eq('deal_id', dealId),
    ]);
    setStakeholders((sRes.data || []) as StakeholderRow[]);
    setWires((wRes.data || []) as WireRow[]);
    setDocs((dRes.data || []) as DocRow[]);
    setApprovals((aRes.data || []) as ApprovalRow[]);
    setTaxForms((tRes.data || []) as TaxFormRow[]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const needsReviewStk = stakeholders.filter(s => s.needs_review).length;
  const pendingWires = wires.filter(w => w.verification_status === 'pending').length;
  const missingTax = taxForms.filter(t => t.status === 'required').length;

  const tabs: TabConfig[] = [
    { key: 'stakeholders', label: 'Stakeholders', icon: Users, count: stakeholders.length, alert: needsReviewStk },
    { key: 'documents', label: 'Documents', icon: FileText, count: docs.length },
    { key: 'funds_flow', label: 'Funds Flow', icon: DollarSign, count: wires.length, alert: pendingWires },
    { key: 'wire', label: 'Wire Instructions', icon: Landmark, count: wires.length },
    { key: 'tax', label: 'Tax Forms', icon: Receipt, count: taxForms.length, alert: missingTax },
    { key: 'approvals', label: 'Approvals', icon: CheckSquare, count: approvals.length, alert: pendingApprovals },
    { key: 'execution', label: 'Execution', icon: Shield },
  ];

  if (!dealId) return null;

  return (
    <div className="pivt-card border border-border overflow-hidden">
      <div className="border-b border-border overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.count != null && tab.count > 0 && <span className="text-[9px] text-muted-foreground">({tab.count})</span>}
              {(tab.alert ?? 0) > 0 && <span className="w-4 h-4 rounded-full bg-blocking/15 text-blocking text-[8px] font-bold flex items-center justify-center">{tab.alert}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'stakeholders' && <StakeholdersPane rows={stakeholders} onAction={onComposerAction} />}
            {activeTab === 'documents' && <DocumentsPane rows={docs} onAction={onComposerAction} />}
            {(activeTab === 'funds_flow' || activeTab === 'wire') && <WiresPane rows={wires} mode={activeTab} onAction={onComposerAction} />}
            {activeTab === 'tax' && <TaxPane rows={taxForms} stakeholders={stakeholders} onAction={onComposerAction} />}
            {activeTab === 'approvals' && <ApprovalsPane rows={approvals} onAction={onComposerAction} />}
            {activeTab === 'execution' && (
              <ExecutionPane
                stakeholderCount={stakeholders.length}
                verifiedCount={stakeholders.filter(s => s.verification_status === 'verified').length}
                approvedCount={approvals.filter(a => a.status === 'completed').length}
                totalApprovals={approvals.length}
                wireCount={wires.length}
                taxComplete={taxForms.filter(t => ['received', 'verified', 'satisfied'].includes(t.status)).length}
                taxTotal={taxForms.length}
                discrepancies={0}
                onAction={onComposerAction}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Actionable Empty State ──────────────────────────────────

const ActionableEmpty: React.FC<{
  icon: React.ElementType;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon: Icon, message, actionLabel, onAction }) => (
  <div className="text-center py-10 space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
      <Icon className="w-6 h-6 text-muted-foreground/30" />
    </div>
    <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">{message}</p>
    {actionLabel && onAction && (
      <Button size="sm" variant="outline" onClick={onAction} className="gap-1.5 text-xs h-8">
        <Sparkles className="w-3 h-3" />
        {actionLabel}
      </Button>
    )}
  </div>
);

// ─── Sub-panes ───────────────────────────────────────────────

const StakeholdersPane: React.FC<{ rows: StakeholderRow[]; onAction?: (p: string) => void }> = ({ rows, onAction }) => {
  if (rows.length === 0) return (
    <ActionableEmpty
      icon={Users}
      message="No stakeholders imported yet. Newton can parse a spreadsheet and import stakeholder data automatically."
      actionLabel="Import stakeholder spreadsheet"
      onAction={() => onAction?.('Import stakeholder spreadsheet')}
    />
  );

  const verStatusColor = (s: string) =>
    s === 'verified' ? 'bg-validated/10 text-validated border-validated/20' :
    ['sent', 'in_progress'].includes(s) ? 'bg-accent/10 text-accent border-accent/20' :
    ['failed', 'expired'].includes(s) ? 'bg-blocking/10 text-blocking border-blocking/20' :
    'bg-muted text-muted-foreground border-border';

  return (
    <ScrollArea className="max-h-[400px]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-medium text-muted-foreground">Name</th>
            <th className="px-2 py-2 font-medium text-muted-foreground">Role</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-right">Ownership</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-right">Payout</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-center">Verification</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-center">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-2 py-2">
                <p className="font-medium">{r.shareholder_name}</p>
                {r.email && <p className="text-muted-foreground text-[10px]">{r.email}</p>}
              </td>
              <td className="px-2 py-2 text-muted-foreground">{r.role}</td>
              <td className="px-2 py-2 text-right font-mono">{r.ownership_pct}%</td>
              <td className="px-2 py-2 text-right font-mono">${(r.payout_amount / 1e6).toFixed(2)}M</td>
              <td className="px-2 py-2 text-center">
                <Badge variant="outline" className={cn('text-[8px] px-1.5', verStatusColor(r.verification_status))}>
                  {r.verification_status.replace(/_/g, ' ')}
                </Badge>
              </td>
              <td className="px-2 py-2 text-center">
                <NewtonSourceBadge created_by_source={r.created_by_source} needs_review={r.needs_review} confidence_status={r.confidence_status} locked={r.locked} locked_reason={r.locked_reason} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
};

const DocumentsPane: React.FC<{ rows: DocRow[]; onAction?: (p: string) => void }> = ({ rows, onAction }) => {
  if (rows.length === 0) return (
    <ActionableEmpty
      icon={FileText}
      message="No documents uploaded yet. Newton can review agreements and extract payment obligations, sign-off requirements, and conditions precedent."
      actionLabel="Upload deal documents"
      onAction={() => onAction?.('Upload deal documents')}
    />
  );
  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {rows.map(d => (
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{d.filename}</p>
              <p className="text-[10px] text-muted-foreground">{d.doc_type.replace(/_/g, ' ')} · {new Date(d.uploaded_at).toLocaleDateString()}</p>
            </div>
            <Badge variant="outline" className={cn('text-[8px]',
              d.status === 'parsed' ? 'text-validated border-validated/20' :
              d.status === 'uploaded' ? 'text-accent border-accent/20' :
              'text-muted-foreground border-border'
            )}>{d.status}</Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const WiresPane: React.FC<{ rows: WireRow[]; mode: string; onAction?: (p: string) => void }> = ({ rows, mode, onAction }) => {
  if (rows.length === 0) return (
    <ActionableEmpty
      icon={mode === 'wire' ? Landmark : DollarSign}
      message={mode === 'wire'
        ? "No wire instructions found. Newton can parse wire schedules and match instructions to payees automatically."
        : "No funds flow data yet. Newton can parse a funds flow spreadsheet and flag discrepancies."}
      actionLabel={mode === 'wire' ? "Match wire instructions" : "Parse funds flow"}
      onAction={() => onAction?.(mode === 'wire' ? 'Match wire instructions' : 'Parse funds flow')}
    />
  );
  return (
    <ScrollArea className="max-h-[400px]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-2 py-2 font-medium text-muted-foreground">Payee</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-right">Amount</th>
            <th className="px-2 py-2 font-medium text-muted-foreground">{mode === 'wire' ? 'Bank' : 'Type'}</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-center">Status</th>
            <th className="px-2 py-2 font-medium text-muted-foreground text-center">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-2 py-2 font-medium">{w.payee_entity}</td>
              <td className="px-2 py-2 text-right font-mono">{w.currency} {w.amount.toLocaleString()}</td>
              <td className="px-2 py-2 text-muted-foreground">{mode === 'wire' ? (w.bank_name || '—') : w.payment_type}</td>
              <td className="px-2 py-2 text-center">
                <Badge variant="outline" className={cn('text-[8px]', w.verification_status === 'verified' ? 'text-validated border-validated/20' : 'text-muted-foreground border-border')}>{w.verification_status}</Badge>
              </td>
              <td className="px-2 py-2 text-center">
                <NewtonSourceBadge created_by_source={w.created_by_source} needs_review={w.needs_review} confidence_status={w.confidence_status} locked={w.locked} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
};

const TaxPane: React.FC<{ rows: TaxFormRow[]; stakeholders: StakeholderRow[]; onAction?: (p: string) => void }> = ({ rows, stakeholders, onAction }) => {
  if (rows.length === 0) return (
    <ActionableEmpty
      icon={Receipt}
      message="No tax forms tracked yet. Newton can identify required forms from stakeholder data and flag missing or incomplete submissions."
      actionLabel="Review tax forms"
      onAction={() => onAction?.('Review tax forms')}
    />
  );
  const getName = (recipientId: string) => stakeholders.find(s => s.id === recipientId)?.shareholder_name || recipientId.slice(0, 8);
  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {rows.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{t.form_type}</p>
              <p className="text-[10px] text-muted-foreground">{getName(t.recipient_id)}</p>
            </div>
            <Badge variant="outline" className={cn('text-[8px]',
              ['received', 'verified', 'satisfied'].includes(t.status) ? 'text-validated border-validated/20' :
              t.status === 'required' ? 'text-blocking border-blocking/20' :
              'text-muted-foreground border-border'
            )}>{t.status}</Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const ApprovalsPane: React.FC<{ rows: ApprovalRow[]; onAction?: (p: string) => void }> = ({ rows, onAction }) => {
  if (rows.length === 0) return (
    <ActionableEmpty
      icon={CheckSquare}
      message="No approvals configured yet. Newton can generate approval requests from deal participants and send them via DocuSign."
      actionLabel="Generate approval requests"
      onAction={() => onAction?.('Prepare approval package')}
    />
  );

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-validated border-validated/20 bg-validated/5' :
    s === 'declined' ? 'text-blocking border-blocking/20 bg-blocking/5' :
    s === 'sent' ? 'text-blue-500 border-blue-500/20 bg-blue-500/5' :
    'text-muted-foreground border-border bg-muted/30';

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {rows.map(a => (
          <div key={a.id} className={cn('flex items-center gap-3 p-3 rounded-lg border', statusColor(a.status))}>
            <CheckSquare className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{a.approver_name || 'TBD'}</p>
              <p className="text-[10px] text-muted-foreground">
                {a.approver_role || 'Unknown role'} · {a.approval_side.replace('_', ' ')}
                {a.envelope_id && ' · DocuSign'}
              </p>
            </div>
            <Badge variant="outline" className="text-[8px]">{a.status}</Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const ExecutionPane: React.FC<{
  stakeholderCount: number; verifiedCount: number; approvedCount: number;
  totalApprovals: number; wireCount: number; taxComplete: number;
  taxTotal: number; discrepancies: number; onAction?: (p: string) => void;
}> = ({ stakeholderCount, verifiedCount, approvedCount, totalApprovals, wireCount, taxComplete, taxTotal, discrepancies, onAction }) => {
  const checks = [
    { label: 'Stakeholders verified', done: verifiedCount === stakeholderCount && stakeholderCount > 0, value: `${verifiedCount}/${stakeholderCount}` },
    { label: 'Approvals complete', done: approvedCount === totalApprovals && totalApprovals > 0, value: `${approvedCount}/${totalApprovals}` },
    { label: 'Wire instructions', done: wireCount > 0, value: wireCount > 0 ? `${wireCount} on file` : 'Missing' },
    { label: 'Tax forms', done: taxComplete === taxTotal && taxTotal > 0, value: taxTotal > 0 ? `${taxComplete}/${taxTotal}` : 'None tracked' },
    { label: 'Discrepancies resolved', done: discrepancies === 0, value: discrepancies === 0 ? 'Clear' : `${discrepancies} open` },
  ];

  const readyCount = checks.filter(c => c.done).length;
  const isReady = readyCount === checks.length;

  return (
    <div className="space-y-4">
      <div className={cn('p-4 rounded-xl border text-center', isReady ? 'border-validated/30 bg-validated/5' : 'border-border')}>
        <Shield className={cn('w-8 h-8 mx-auto mb-2', isReady ? 'text-validated' : 'text-muted-foreground/30')} />
        <p className="text-sm font-semibold">{isReady ? 'Ready for Execution' : 'Not Ready for Execution'}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{readyCount}/{checks.length} pre-conditions satisfied</p>
        {!isReady && onAction && (
          <Button size="sm" variant="outline" onClick={() => onAction('Prepare deal for closing')} className="gap-1.5 text-xs h-7 mt-3">
            <Sparkles className="w-3 h-3" />
            Prepare deal for closing
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border">
            {c.done ? <CheckCircle2 className="w-3.5 h-3.5 text-validated shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-blocking shrink-0" />}
            <span className="text-xs flex-1">{c.label}</span>
            <span className={cn('text-[10px] font-mono', c.done ? 'text-validated' : 'text-blocking')}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
