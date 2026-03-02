import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DealWorkflowState } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, AlertTriangle, Ban,
  FileText, Users, Search, Sparkles, Calendar, Brain,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DealWorkflowStepper, WorkflowStep, deriveStatus } from './DealWorkflowStepper';

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
import { AIDashboardCover } from './AIDashboardCover';
import { CommentsCover } from './CommentsCover';

// ── Workflow helpers ──
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

// ── Step definitions ──
type StepId = 'overview' | 'stakeholders' | 'verification' | 'structuring' | 'execution' | 'compliance' | 'comments' | 'ai';

interface SubNav { id: string; label: string }

const STEP_SUB_NAV: Partial<Record<StepId, SubNav[]>> = {
  stakeholders: [
    { id: 'parties', label: 'Parties' },
    { id: 'ownership', label: 'Ownership' },
    { id: 'permissions', label: 'Permissions' },
  ],
  verification: [
    { id: 'kyc', label: 'KYC / KYB' },
    { id: 'documents', label: 'Documents' },
    { id: 'reconciliation', label: 'Reconciliation' },
  ],
  structuring: [
    { id: 'cap-table', label: 'Cap Table' },
    { id: 'waterfall', label: 'Waterfall' },
    { id: 'data-ingestion', label: 'Data Ingestion' },
  ],
  execution: [
    { id: 'approvals', label: 'Approvals' },
    { id: 'payments', label: 'Payments' },
    { id: 'escrow', label: 'Escrow' },
  ],
  compliance: [
    { id: 'audit', label: 'Audit Log' },
    { id: 'reports', label: 'Reports' },
    { id: 'activity', label: 'Activity' },
  ],
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted/60 text-muted-foreground' },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/10 text-amber-600' },
  complete: { label: 'Complete', className: 'bg-emerald-500/10 text-emerald-600' },
  needs_attention: { label: 'Attention', className: 'bg-red-400/10 text-red-400' },
};

// ── Section Components ──
const OverviewSection: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders } = usePIVTStore();
  const nextAction = getNextAction(deal.workflowState, deal.discrepanciesFound, deal.pendingApprovals);

  return (
    <div className="space-y-8">
      {/* V2 Next Action Panel */}
      <motion.div {...fadeInUp} className="pivt-next-action p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/12 flex items-center justify-center pivt-icon-pulse">
            <AlertTriangle className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="pivt-metric-label">Next Required Action</p>
            <p className="text-sm font-semibold mt-0.5">{nextAction}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Recipients', value: deal.totalRecipients },
          { label: 'Documents', value: deal.documentsUploaded },
          { label: 'Discrepancies', value: deal.discrepanciesFound, color: deal.discrepanciesFound > 0 ? 'text-discrepancy' : 'text-validated' },
          { label: 'Pending Approvals', value: deal.pendingApprovals, color: deal.pendingApprovals > 0 ? 'text-discrepancy' : 'text-validated' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-6">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className={`pivt-stat text-2xl mt-3 ${stat.color || ''}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="pivt-card p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="font-medium text-sm">Top Shareholders</h3>
        </div>
        {stakeholders.slice(0, 4).map(s => (
          <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
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

      <div className="pivt-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="pivt-metric-label">Ready to Pay</span>
          <span className="font-mono text-sm font-medium">{deal.readyToPayPercent}%</span>
        </div>
        <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--g5-from)), hsl(var(--g5-to)))' }}
            initial={{ width: 0 }}
            animate={{ width: `${deal.readyToPayPercent}%` }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          />
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
        <div key={disc.id} className={`pivt-card p-4 border-l-4 ${disc.severity === 'critical' ? 'border-blocking bg-blocking/4' : 'border-discrepancy bg-discrepancy/4'} ${disc.resolved ? 'opacity-50' : ''}`}>
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
      <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border/40" />
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

// ── Content resolver ──
function getContentComponent(stepId: StepId, subNavId?: string): React.FC {
  switch (stepId) {
    case 'overview': return OverviewSection;
    case 'stakeholders':
      if (subNavId === 'ownership') return CapTableCover;
      return StakeholdersDealTab;
    case 'verification':
      if (subNavId === 'documents') return DocumentsCover;
      if (subNavId === 'reconciliation') return ReconciliationSection;
      return KycKybDealTab;
    case 'structuring':
      if (subNavId === 'waterfall') return WaterfallCover;
      if (subNavId === 'data-ingestion') return DocumentIngestionCover;
      return CapTableCover;
    case 'execution':
      if (subNavId === 'payments') return PaymentsCover;
      if (subNavId === 'escrow') return EscrowCover;
      return ApprovalsCover;
    case 'compliance':
      if (subNavId === 'reports') return DealReportsCover;
      if (subNavId === 'activity') return DealActivityCover;
      return DealAuditSection;
    case 'comments': return CommentsCover;
    case 'ai': return AIDashboardCover;
    default: return OverviewSection;
  }
}

// ── Vertical Sub-Tab Layout ──
const SectionWithSideTabs: React.FC<{
  subs: SubNav[];
  activeSub: string;
  onSubChange: (id: string) => void;
  stepLabel: string;
  stepStatus: string;
  children: React.ReactNode;
}> = ({ subs, activeSub, onSubChange, stepLabel, stepStatus, children }) => {
  const statusCfg = STATUS_LABELS[stepStatus] || STATUS_LABELS.not_started;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{stepLabel}</h2>
        <Badge className={`text-[10px] px-2.5 py-0.5 ${statusCfg.className}`}>
          {statusCfg.label}
        </Badge>
      </div>

      <div className="flex gap-6">
        <div className="w-44 shrink-0 space-y-0.5">
          {subs.map(sub => (
            <button
              key={sub.id}
              onClick={() => onSubChange(sub.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${
                activeSub === sub.id
                  ? 'font-semibold text-foreground border-l-[3px] bg-accent/8'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-[3px] border-transparent'
              }`}
              style={activeSub === sub.id ? {
                borderImage: 'linear-gradient(180deg, hsl(var(--g2-from)), hsl(var(--g2-to))) 1',
              } : undefined}
            >
              {sub.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
};

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
    { id: 'stakeholders', number: 2, label: 'Stakeholders', completionPct: 85, blockers: deal.hasBlocker ? 1 : 0 },
    { id: 'verification', number: 3, label: 'Verification', completionPct: 72, blockers: 1 },
    { id: 'structuring', number: 4, label: 'Structuring', completionPct: 64, blockers: deal.discrepanciesFound },
    { id: 'execution', number: 5, label: 'Execution', completionPct: deal.pendingApprovals > 0 ? 50 : 100, blockers: deal.pendingApprovals },
    { id: 'compliance', number: 6, label: 'Compliance', completionPct: 100, blockers: 0 },
    { id: 'comments', number: 7, label: 'Comments', completionPct: 100, blockers: 0 },
    { id: 'ai', number: 8, label: 'AI', completionPct: 0, blockers: 0 },
  ], [deal]);

  const totalBlockers = useMemo(() => workflowSteps.reduce((sum, s) => sum + s.blockers, 0), [workflowSteps]);
  const sectionsWithBlockers = useMemo(() => workflowSteps.filter(s => s.blockers > 0).length, [workflowSteps]);

  const subNavItems = STEP_SUB_NAV[activeStepId];
  const ContentComponent = getContentComponent(activeStepId, activeSubNav);

  const currentStep = workflowSteps.find(s => s.id === activeStepId);
  const currentStatus = currentStep ? deriveStatus(currentStep) : 'not_started';

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      {/* Back */}
      <button
        onClick={() => setActiveSection('deals')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Deals
      </button>

      {/* ── V2 Deal Header — Hero Command Module ── */}
      <div className="pivt-panel p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8" style={{ justifyContent: 'space-between' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-semibold text-foreground" style={{ letterSpacing: '-0.04em', whiteSpace: 'normal', overflow: 'visible' }}>{deal.codeName}</h1>
              {deal.hasBlocker && (
                <Badge className="bg-blocking/10 text-blocking border-blocking/15 shrink-0">
                  <Ban className="w-3 h-3 mr-1" /> Blocked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(deal.dealNumber);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer"
                title="Click to copy Deal ID"
              >
                {deal.dealNumber}
              </button>
              <span className="text-muted-foreground/60 text-sm font-normal truncate">
                {deal.buyerName} acquiring {deal.targetCompany}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 flex-wrap lg:ml-auto" style={{ flexShrink: 0 }}>
            <div className="text-left lg:text-right">
              <p className="pivt-metric-label">Deal Value</p>
              <p className="font-mono text-lg font-medium mt-1.5">${(deal.consideration / 1e6).toFixed(1)}M</p>
            </div>
            <div className="h-10 w-px bg-border/20 hidden lg:block" />
            <div className="text-left lg:text-right">
              <p className="pivt-metric-label">Closing</p>
              <p className="text-sm font-medium flex items-center gap-1.5 mt-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" />
                {deal.closingDate}
              </p>
            </div>
            <div className="h-10 w-px bg-border/20 hidden lg:block" />
            <div className="min-w-[140px]">
              <div className="flex items-center justify-between mb-2">
                <p className="pivt-metric-label">Readiness</p>
                <span className="font-mono text-xs font-medium">{deal.readyToPayPercent}%</span>
              </div>
              <Progress value={deal.readyToPayPercent} className="h-1.5" />
            </div>
            <div className="h-10 w-px bg-border/20 hidden lg:block" />
            <button className="pivt-ai-btn flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-accent whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 pivt-spark" />
              What's blocking close?
            </button>
          </div>
        </div>
      </div>

      {/* ── V2 Blocking Issues — Slim inline notification ── */}
      {totalBlockers > 0 && (
        <motion.div
          {...fadeInUp}
          className="flex items-center gap-3 px-5 py-3 rounded-2xl"
          style={{
            background: 'hsl(0 35% 50% / 0.04)',
            borderLeft: '3px solid hsl(0 35% 50% / 0.30)',
          }}
        >
          <AlertTriangle className="w-4 h-4 text-blocking/60 shrink-0" />
          <span className="text-sm text-foreground/80">
            <span className="font-semibold text-blocking/70">{totalBlockers} items</span>
            {' '}need attention across{' '}
            <span className="font-semibold">{sectionsWithBlockers} sections</span>
          </span>
          <button
            onClick={() => {
              const firstBlocked = workflowSteps.find(s => s.blockers > 0);
              if (firstBlocked) handleStepClick(firstBlocked.id);
            }}
            className="ml-auto text-xs font-medium text-blocking/70 hover:text-blocking transition-colors whitespace-nowrap"
          >
            View all →
          </button>
        </motion.div>
      )}

      {/* ── V2 Workflow Stepper ── */}
      <DealWorkflowStepper
        steps={workflowSteps}
        activeStepId={activeStepId}
        onStepClick={handleStepClick}
      />

      {/* ── Content ── */}
      <motion.div
        key={`${activeStepId}-${activeSubNav}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      >
        {subNavItems ? (
          <SectionWithSideTabs
            subs={subNavItems}
            activeSub={activeSubNav || subNavItems[0].id}
            onSubChange={setActiveSubNav}
            stepLabel={currentStep?.label || ''}
            stepStatus={currentStatus}
          >
            <ContentComponent />
          </SectionWithSideTabs>
        ) : (
          <ContentComponent />
        )}
      </motion.div>
    </motion.div>
  );
};
