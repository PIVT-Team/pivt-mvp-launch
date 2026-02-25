import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DealWorkflowState } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Ban,
  FileText, Users, Upload, Shield, CreditCard,
  Landmark, Search, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DEAL_WORKSPACE_TABS, DealWorkspaceTab } from '@/lib/navigation';

// Import existing cover pages for embedding
import { StakeholdersCover } from './StakeholdersCover';
import { VerificationCover } from './VerificationCover';
import { CapTableCover } from './CapTableCover';
import { WaterfallCover } from './WaterfallCover';
import { DocumentIngestionCover } from './DocumentIngestionCover';
import { DocumentsCover } from './DocumentsCover';
import { ApprovalsCover } from './ApprovalsCover';
import { PaymentsCover } from './PaymentsCover';
import { EscrowCover } from './EscrowCover';
import { IntelligenceMapCover } from './IntelligenceMapCover';
import { DealReportsCover } from './DealReportsCover';

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

// ── Demo data for reconciliation & audit ──
const DISCREPANCIES = [
  { id: 1, field: 'Ownership %', desc: 'ESOP pool shows 7.2% vs cap table 7.0%', severity: 'warning' as const, resolved: false },
  { id: 2, field: 'Wire Instructions', desc: 'Missing bank details for a16z trust account', severity: 'critical' as const, resolved: false },
  { id: 3, field: 'Tax ID', desc: 'GIC Singapore entity TIN mismatch', severity: 'warning' as const, resolved: true },
];

const AUDIT_ENTRIES = [
  { time: '2026-02-14 09:12', action: 'Waterfall Schedule v3 uploaded', actor: 'Deal Admin' },
  { time: '2026-02-13 16:45', action: 'KYC verification failed — GIC Private Limited', actor: 'System' },
  { time: '2026-02-12 11:00', action: 'Buyer Counsel approved payout execution', actor: 'Buyer Counsel' },
  { time: '2026-02-10 14:32', action: 'Cap table reconciliation triggered', actor: 'Deal Admin' },
  { time: '2026-02-08 10:15', action: 'Escrow account funded — $280M', actor: 'Escrow Agent' },
  { time: '2026-02-05 08:00', action: 'Deal created', actor: 'Deal Admin' },
];

// ── Overview Section (inline) ──
const OverviewSection: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, waterfallTiers, payments } = usePIVTStore();

  const currentIdx = stepIndex(deal.workflowState);
  const nextAction = getNextAction(deal.workflowState, deal.discrepanciesFound, deal.pendingApprovals);

  return (
    <div className="space-y-6">
      {/* STATE MACHINE PROGRESS BAR */}
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

      {/* NEXT REQUIRED ACTION */}
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

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Recipients', value: deal.totalRecipients },
          { label: 'Documents', value: deal.documentsUploaded },
          { label: 'Discrepancies', value: deal.discrepanciesFound, color: deal.discrepanciesFound > 0 ? 'text-discrepancy' : 'text-validated' },
          { label: 'Pending Approvals', value: deal.pendingApprovals, color: deal.pendingApprovals > 0 ? 'text-discrepancy' : 'text-validated' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className={`pivt-stat text-xl mt-1 ${stat.color || ''}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick data preview */}
      <div className="pivt-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="font-medium text-sm">Top Shareholders</h3>
        </div>
        {stakeholders.slice(0, 4).map(s => (
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
      </div>

      {/* Progress bar */}
      <div className="pivt-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Ready to Pay</span>
          <span className="font-mono text-sm font-medium">{deal.readyToPayPercent}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${deal.readyToPayPercent}%` }} />
        </div>
      </div>
    </div>
  );
};

// ── Reconciliation Section (inline, Newton-powered) ──
const ReconciliationSection: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <Search className="w-4 h-4 text-discrepancy" />
      <h3 className="font-medium">Reconciliation Results</h3>
      <span className="text-xs text-muted-foreground ml-auto">{DISCREPANCIES.filter(d => !d.resolved).length} unresolved</span>
    </div>
    <p className="text-xs text-muted-foreground mb-4">Newton AI validation findings are embedded here. Discrepancy resolution status is tracked automatically.</p>
    <div className="space-y-2">
      {DISCREPANCIES.map(disc => (
        <div key={disc.id} className={`pivt-card p-3 border-l-4 ${disc.severity === 'critical' ? 'border-blocking bg-blocking/5' : 'border-discrepancy bg-discrepancy/5'} ${disc.resolved ? 'opacity-50' : ''}`}>
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
  </div>
);

// ── Deal-Level Audit Section (inline) ──
const DealAuditSection: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <FileText className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-medium">Deal Audit Log</h3>
    </div>
    <p className="text-xs text-muted-foreground mb-4">Immutable activity timeline — state changes, edits, approval records, and Newton outputs.</p>
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
  </div>
);

// ── Stakeholders & KYC combined section ──
const StakeholdersKycSection: React.FC = () => (
  <div className="space-y-8">
    <StakeholdersCover />
    <div className="border-t border-border pt-8">
      <VerificationCover />
    </div>
  </div>
);

// ── Data section (Ingestion + Cap Table + Waterfall) ──
const DataSection: React.FC = () => (
  <div className="space-y-8">
    <DocumentIngestionCover />
    <div className="border-t border-border pt-8">
      <CapTableCover />
    </div>
    <div className="border-t border-border pt-8">
      <WaterfallCover />
    </div>
  </div>
);

// ── Payments / Escrow combined ──
const PaymentsEscrowSection: React.FC = () => (
  <div className="space-y-8">
    <PaymentsCover />
    <div className="border-t border-border pt-8">
      <EscrowCover />
    </div>
  </div>
);

// ── Tab content map ──
const TAB_COMPONENTS: Record<DealWorkspaceTab, React.FC> = {
  'overview': OverviewSection,
  'stakeholders-kyc': StakeholdersKycSection,
  'data': DataSection,
  'documents': DocumentsCover,
  'reconciliation': ReconciliationSection,
  'approvals': ApprovalsCover,
  'payments-escrow': PaymentsEscrowSection,
  'audit-log': DealAuditSection,
  'reports': DealReportsCover,
  'intelligence-map': IntelligenceMapCover,
};

// ── Main Component ──
export const DealWorkspaceCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { setActiveSection } = usePIVTStore();
  const [activeTab, setActiveTab] = useState<DealWorkspaceTab>('overview');

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

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
        {deal.hasBlocker && (
          <Badge className="bg-blocking/10 text-blocking border-blocking/20">
            <Ban className="w-3 h-3 mr-1" /> Blocked
          </Badge>
        )}
      </div>

      {/* Deal Workspace Tabs */}
      <div className="flex gap-1 rounded-2xl p-1.5 flex-wrap" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
        {DEAL_WORKSPACE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div>
        <ActiveTabComponent />
      </div>
    </motion.div>
  );
};
