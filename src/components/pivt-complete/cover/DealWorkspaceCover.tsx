import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DealWorkflowState } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Ban,
  FileText, Users, Calculator, Upload, Shield, CreditCard,
  Landmark, Search, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ── Workflow States ──
const WORKFLOW_STEPS: { key: DealWorkflowState; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'data_uploaded', label: 'Data Uploaded' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'approved', label: 'Approved (Locked)' },
  { key: 'closed', label: 'Closed' },
];

const stepIndex = (state: DealWorkflowState) => WORKFLOW_STEPS.findIndex(s => s.key === state);

function getNextAction(state: DealWorkflowState, discrepancies: number, pendingApprovals: number): string {
  switch (state) {
    case 'draft': return 'Upload Seller Cap Table';
    case 'data_uploaded': return 'Run reconciliation to validate data';
    case 'reconciliation':
      return discrepancies > 0 ? `Resolve ${discrepancies} discrepancies` : 'All checks passed — submit for approval';
    case 'awaiting_approval':
      return pendingApprovals > 0 ? `Awaiting ${pendingApprovals} approval(s)` : 'All approvals received';
    case 'approved': return 'Ready to release funds';
    case 'closed': return 'Deal closed successfully';
    default: return '';
  }
}

// ── Demo data ──
const DISCREPANCIES = [
  { id: 1, field: 'Ownership %', desc: 'ESOP pool shows 7.2% vs cap table 7.0%', severity: 'warning' as const, resolved: false },
  { id: 2, field: 'Wire Instructions', desc: 'Missing bank details for a16z trust account', severity: 'critical' as const, resolved: false },
  { id: 3, field: 'Tax ID', desc: 'GIC Singapore entity TIN mismatch', severity: 'warning' as const, resolved: true },
];

const SIGNATORIES = [
  { name: 'Buyer Counsel', status: 'signed', timestamp: '2026-02-10 14:32 UTC' },
  { name: 'Seller Counsel', status: 'pending', timestamp: null },
  { name: 'Third-Party Agent', status: 'pending', timestamp: null },
];

const AUDIT_ENTRIES = [
  { time: '2026-02-14 09:12', action: 'Waterfall Schedule v3 uploaded', actor: 'Deal Admin' },
  { time: '2026-02-13 16:45', action: 'KYC verification failed — GIC Private Limited', actor: 'System' },
  { time: '2026-02-12 11:00', action: 'Buyer Counsel approved payout execution', actor: 'Buyer Counsel' },
  { time: '2026-02-10 14:32', action: 'Cap table reconciliation triggered', actor: 'Deal Admin' },
  { time: '2026-02-08 10:15', action: 'Escrow account funded — $280M', actor: 'Escrow Agent' },
  { time: '2026-02-05 08:00', action: 'Deal created', actor: 'Deal Admin' },
];

export const DealWorkspaceCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, waterfallTiers, payments, setActiveSection } = usePIVTStore();

  const currentIdx = stepIndex(deal.workflowState);
  const nextAction = getNextAction(deal.workflowState, deal.discrepanciesFound, deal.pendingApprovals);

  const approvalsLocked = deal.workflowState === 'approved' || deal.workflowState === 'closed';

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      {/* Back to deals */}
      <button
        onClick={() => setActiveSection('deals')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Deals
      </button>

      {/* Deal Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{deal.codeName}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{deal.buyerName} acquiring {deal.targetCompany} · ${(deal.consideration / 1e9).toFixed(1)}B</p>
        </div>
      </div>

      {/* ─── STATE MACHINE PROGRESS BAR ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, i) => {
            const isCurrent = i === currentIdx;
            const isComplete = i < currentIdx;
            const isBlocked = isCurrent && deal.hasBlocker;
            let bg = 'bg-muted';
            let text = 'text-muted-foreground';
            if (isComplete) { bg = 'bg-validated'; text = 'text-validated'; }
            else if (isBlocked) { bg = 'bg-blocking'; text = 'text-blocking'; }
            else if (isCurrent) { bg = 'bg-accent'; text = 'text-accent'; }
            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg} ${isComplete || isCurrent ? 'text-white' : ''}`}>
                    {isComplete ? <CheckCircle2 className="w-4 h-4" /> :
                     isBlocked ? <Ban className="w-4 h-4" /> :
                     isCurrent ? <Clock className="w-4 h-4 animate-pulse" /> :
                     <span className="text-xs font-mono">{i + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight ${text}`}>{step.label}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded ${i < currentIdx ? 'bg-validated' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>

      {/* ─── NEXT REQUIRED ACTION ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-4 border-l-4 border-accent bg-accent/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Next Required Action</p>
            <p className="text-sm font-semibold mt-0.5">{nextAction}</p>
          </div>
        </div>
      </motion.div>

      {/* ─── SECTION 1: DATA ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Data</h3>
        </div>

        {/* Cap Table Summary */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cap Table · {stakeholders.length} shareholders</p>
          <div className="space-y-1.5">
            {stakeholders.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <span>{s.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{s.ownershipPct}%</span>
                  <span className="font-mono text-xs">${(s.payoutAmount / 1e6).toFixed(0)}M</span>
                  <Badge className={`text-[9px] ${s.kycStatus === 'verified' ? 'bg-validated/10 text-validated' : s.kycStatus === 'failed' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'}`}>
                    {s.kycStatus}
                  </Badge>
                </div>
              </div>
            ))}
            {stakeholders.length > 5 && <p className="text-xs text-muted-foreground">+{stakeholders.length - 5} more</p>}
          </div>
        </div>

        {/* Waterfall Summary */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Waterfall · {waterfallTiers.length} tiers</p>
          <div className="flex gap-1 h-6 rounded overflow-hidden">
            {waterfallTiers.map((t, i) => (
              <div key={t.id} className="bg-accent/70 hover:bg-accent transition-colors relative group" style={{ width: `${t.percentage}%` }}>
                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.percentage}%
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {waterfallTiers.map(t => (
              <span key={t.id} className="text-[10px] text-muted-foreground">{t.name}: ${(t.amount / 1e6).toFixed(0)}M</span>
            ))}
          </div>
        </div>

        {/* Ingestion status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Upload className="w-3.5 h-3.5" />
          <span>{deal.documentsUploaded} files ingested</span>
        </div>
      </motion.div>

      {/* ─── SECTION 2: DOCUMENTS ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Documents</h3>
          <span className="text-xs text-muted-foreground ml-auto">{documents.filter(d => d.status === 'verified').length}/{documents.length} verified</span>
        </div>
        <div className="space-y-1.5">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
              <div>
                <span>{doc.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{doc.type}</span>
              </div>
              <Badge className={`text-[9px] ${doc.status === 'verified' ? 'bg-validated/10 text-validated' : doc.status === 'rejected' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'}`}>
                {doc.status}
              </Badge>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── SECTION 3: RECONCILIATION RESULTS ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-discrepancy" />
          <h3 className="font-medium">Reconciliation Results</h3>
          <span className="text-xs text-muted-foreground ml-auto">{DISCREPANCIES.filter(d => !d.resolved).length} unresolved</span>
        </div>
        <div className="space-y-2">
          {DISCREPANCIES.map(disc => (
            <div key={disc.id} className={`p-3 rounded-lg border-l-4 ${disc.severity === 'critical' ? 'border-blocking bg-blocking/5' : 'border-discrepancy bg-discrepancy/5'} ${disc.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium">{disc.field}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{disc.desc}</p>
                </div>
                <Badge className={`text-[9px] ${disc.resolved ? 'bg-validated/10 text-validated' : disc.severity === 'critical' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'}`}>
                  {disc.resolved ? 'Resolved' : disc.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── SECTION 4: APPROVALS ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Approvals</h3>
          {approvalsLocked && (
            <Badge className="text-[9px] bg-validated/10 text-validated ml-auto flex items-center gap-1">
              <Lock className="w-3 h-3" /> Locked
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {SIGNATORIES.map((sig, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-sm font-medium">{sig.name}</span>
              <div className="flex items-center gap-3">
                {sig.timestamp && <span className="text-[10px] text-muted-foreground font-mono">{sig.timestamp}</span>}
                <Badge className={`text-[9px] ${sig.status === 'signed' ? 'bg-validated/10 text-validated' : 'bg-discrepancy/10 text-discrepancy'}`}>
                  {sig.status === 'signed' ? '✓ Signed' : 'Pending'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── SECTION 5: PAYMENTS ─── */}
      <motion.div {...fadeInUp} className={`pivt-card p-5 ${approvalsLocked ? '' : 'opacity-60 pointer-events-none'}`}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Payments</h3>
          {!approvalsLocked && <span className="text-[10px] text-muted-foreground ml-auto">Locked until approvals complete</span>}
        </div>
        <div className="space-y-1.5">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
              <span>{p.recipientName}</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs">${(p.amount / 1e6).toFixed(0)}M</span>
                <Badge className={`text-[9px] ${p.status === 'executed' ? 'bg-validated/10 text-validated' : p.status === 'approved' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                  {p.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Escrow within Payments */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Escrow Holdback</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Indemnity Escrow</span>
            <span className="font-mono">${(deal.consideration * 0.1 / 1e6).toFixed(0)}M held</span>
          </div>
        </div>
      </motion.div>

      {/* ─── SECTION 6: AUDIT LOG ─── */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium">Audit Log</h3>
        </div>
        <div className="relative pl-5 space-y-3">
          <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border" />
          {AUDIT_ENTRIES.map((entry, i) => (
            <div key={i} className="relative flex items-start gap-3">
              <div className="absolute left-[-14px] w-2 h-2 rounded-full bg-accent mt-1.5" />
              <div className="flex-1">
                <p className="text-sm">{entry.action}</p>
                <p className="text-[10px] text-muted-foreground">{entry.actor}</p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{entry.time}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
