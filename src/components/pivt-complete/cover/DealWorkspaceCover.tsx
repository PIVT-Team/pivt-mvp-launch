import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DealWorkflowState } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle, Ban,
  FileText, Users, Upload, Shield, CreditCard,
  Landmark, Search, Lock, Sparkles, Calendar, DollarSign,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DealWorkflowStepper, WorkflowStep } from './DealWorkflowStepper';

// Import existing cover pages
import { StakeholdersDealTab } from './StakeholdersDealTab';
import { KycKybDealTab } from './KycKybDealTab';
import { CapTableCover } from './CapTableCover';
import { WaterfallCover } from './WaterfallCover';
import { DocumentIngestionCover } from './DocumentIngestionCover';
import { DocumentsCover } from './DocumentsCover';
import { ApprovalsCover } from './ApprovalsCover';
import { PaymentsCover } from './PaymentsCover';
import { EscrowCover } from './EscrowCover';
import { DealReportsCover } from './DealReportsCover';
import { DealActivityCover } from './DealActivityCover';

// ── Workflow state helpers ──
const WORKFLOW_STEPS_META: { key: DealWorkflowState; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'data_uploaded', label: 'Data Uploaded' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'approved', label: 'Approved (Locked)' },
  { key: 'closed', label: 'Closed' },
];

const stepIndex = (state: DealWorkflowState) => WORKFLOW_STEPS_META.findIndex(s => s.key === state);

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

const AUDIT_ENTRIES = [
  { time: '2026-02-14 09:12', action: 'Waterfall Schedule v3 uploaded', actor: 'Deal Admin' },
  { time: '2026-02-13 16:45', action: 'KYC verification failed — GIC Private Limited', actor: 'System' },
  { time: '2026-02-12 11:00', action: 'Buyer Counsel approved payout execution', actor: 'Buyer Counsel' },
  { time: '2026-02-10 14:32', action: 'Cap table reconciliation triggered', actor: 'Deal Admin' },
  { time: '2026-02-08 10:15', action: 'Escrow account funded — $280M', actor: 'Escrow Agent' },
  { time: '2026-02-05 08:00', action: 'Deal created', actor: 'Deal Admin' },
];

// ── Stepper step definitions ──
type StepId = 'overview' | 'parties' | 'kyc' | 'data-docs' | 'reconciliation' | 'approvals' | 'payments-escrow' | 'audit-reports';

interface SubNav { id: string; label: string }

const STEP_SUB_NAV: Partial<Record<StepId, SubNav[]>> = {
  'parties': [
    { id: 'stakeholders', label: 'Stakeholders' },
  ],
  'data-docs': [
    { id: 'documents', label: 'Documents & Ingestion' },
    { id: 'data-tables', label: 'Data Tables' },
    { id: 'cap-table', label: 'Cap Table' },
    { id: 'waterfall', label: 'Waterfall' },
  ],
  'payments-escrow': [
    { id: 'payments', label: 'Payments' },
    { id: 'escrow', label: 'Escrow' },
  ],
  'audit-reports': [
    { id: 'audit', label: 'Audit Log' },
    { id: 'reports', label: 'Reports' },
    { id: 'activity', label: 'Activity' },
  ],
};

// ── Section Components ──
const OverviewSection: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders } = usePIVTStore();
  const currentIdx = stepIndex(deal.workflowState);
  const nextAction = getNextAction(deal.workflowState, deal.discrepanciesFound, deal.pendingApprovals);

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS_META.map((step, i) => {
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
                {i < WORKFLOW_STEPS_META.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded ${i < currentIdx ? 'bg-validated' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>

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

const ReconciliationSection: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <Search className="w-4 h-4 text-discrepancy" />
      <h3 className="font-medium">Reconciliation Results</h3>
      <span className="text-xs text-muted-foreground ml-auto">{DISCREPANCIES.filter(d => !d.resolved).length} unresolved</span>
    </div>
    <p className="text-xs text-muted-foreground mb-4">Newton AI validation findings. Discrepancy resolution tracked automatically.</p>
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

const DealAuditSection: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <FileText className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-medium">Deal Audit Log</h3>
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
  </div>
);

const DataSection: React.FC = () => (
  <div className="space-y-8">
    <DocumentIngestionCover />
    <div className="border-t border-border pt-8"><CapTableCover /></div>
    <div className="border-t border-border pt-8"><WaterfallCover /></div>
  </div>
);

const PaymentsEscrowSection: React.FC = () => (
  <div className="space-y-8">
    <PaymentsCover />
    <div className="border-t border-border pt-8"><EscrowCover /></div>
  </div>
);

// ── Content map by stepId + optional subNav ──
function getContentComponent(stepId: StepId, subNavId?: string): React.FC {
  switch (stepId) {
    case 'overview': return OverviewSection;
    case 'parties': return StakeholdersDealTab;
    case 'kyc': return KycKybDealTab;
    case 'data-docs':
      if (subNavId === 'cap-table') return CapTableCover;
      if (subNavId === 'waterfall') return WaterfallCover;
      if (subNavId === 'data-tables') return DataSection;
      return DocumentsCover;
    case 'reconciliation': return ReconciliationSection;
    case 'approvals': return ApprovalsCover;
    case 'payments-escrow':
      if (subNavId === 'escrow') return EscrowCover;
      return PaymentsCover;
    case 'audit-reports':
      if (subNavId === 'reports') return DealReportsCover;
      if (subNavId === 'activity') return DealActivityCover;
      return DealAuditSection;
    default: return OverviewSection;
  }
}

// ── Main Component ──
export const DealWorkspaceCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { setActiveSection } = usePIVTStore();
  const [activeStepId, setActiveStepId] = useState<StepId>('overview');
  const [activeSubNav, setActiveSubNav] = useState<string | undefined>();

  const handleStepClick = (id: string) => {
    setActiveStepId(id as StepId);
    const subs = STEP_SUB_NAV[id as StepId];
    setActiveSubNav(subs ? subs[0].id : undefined);
  };

  const workflowSteps: WorkflowStep[] = useMemo(() => [
    { id: 'overview', number: 1, label: 'Overview', completionPct: 100, blockers: 0 },
    { id: 'parties', number: 2, label: 'Parties & Stakeholders', completionPct: 85, blockers: deal.hasBlocker ? 1 : 0 },
    { id: 'kyc', number: 3, label: 'KYC / KYB', completionPct: 72, blockers: 1 },
    { id: 'data-docs', number: 4, label: 'Data & Documents', completionPct: 64, blockers: deal.discrepanciesFound },
    { id: 'reconciliation', number: 5, label: 'Reconciliation', completionPct: deal.discrepanciesFound > 2 ? 40 : 78, blockers: DISCREPANCIES.filter(d => !d.resolved).length },
    { id: 'approvals', number: 6, label: 'Approvals', completionPct: deal.pendingApprovals > 0 ? 50 : 100, blockers: deal.pendingApprovals },
    { id: 'payments-escrow', number: 7, label: 'Payments & Escrow', completionPct: deal.readyToPayPercent, blockers: 0 },
    { id: 'audit-reports', number: 8, label: 'Audit & Reports', completionPct: 100, blockers: 0 },
  ], [deal]);

  const subNavItems = STEP_SUB_NAV[activeStepId];
  const ContentComponent = getContentComponent(activeStepId, activeSubNav);

  return (
    <motion.div {...staggerChildren} className="space-y-5">
      {/* Back */}
      <button
        onClick={() => setActiveSection('deals')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Deals
      </button>

      {/* ── Deal Header ── */}
      <div className="pivt-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground truncate">{deal.codeName}</h1>
              {deal.hasBlocker && (
                <Badge className="bg-blocking/10 text-blocking border-blocking/20 shrink-0">
                  <Ban className="w-3 h-3 mr-1" /> Blocked
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm truncate">
              {deal.buyerName} acquiring {deal.targetCompany}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap lg:ml-auto shrink-0">
            <div className="text-left lg:text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deal Value</p>
              <p className="font-mono text-sm font-semibold">${(deal.consideration / 1e9).toFixed(1)}B</p>
            </div>
            <div className="h-8 w-px bg-border hidden lg:block" />
            <div className="text-left lg:text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Closing</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                {deal.closingDate}
              </p>
            </div>
            <div className="h-8 w-px bg-border hidden lg:block" />
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Readiness</p>
                <span className="font-mono text-xs font-semibold">{deal.readyToPayPercent}%</span>
              </div>
              <Progress value={deal.readyToPayPercent} className="h-1.5" />
            </div>
            <div className="h-8 w-px bg-border hidden lg:block" />
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5" />
              What's blocking close?
            </button>
          </div>
        </div>
      </div>

      {/* ── Workflow Stepper ── */}
      <DealWorkflowStepper
        steps={workflowSteps}
        activeStepId={activeStepId}
        onStepClick={handleStepClick}
      />

      {/* ── Sub-navigation chips ── */}
      {subNavItems && (
        <div className="flex gap-1.5">
          {subNavItems.map(sub => (
            <button
              key={sub.id}
              onClick={() => setActiveSubNav(sub.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeSubNav === sub.id
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <motion.div
        key={`${activeStepId}-${activeSubNav}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <ContentComponent />
      </motion.div>
    </motion.div>
  );
};
