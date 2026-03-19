import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, AlertTriangle, Ban, CheckCircle2, Rocket,
  FileText, Users, Search, Sparkles, Calendar, Brain, ShieldAlert, Copy, Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DealWorkflowStepper, WorkflowStep, deriveStatus } from './DealWorkflowStepper';
import { DealProgressRibbon, DealProgressData } from './DealProgressRibbon';
import { supabase } from '@/integrations/supabase/client';
import type { RealDeal } from '@/hooks/useDealOperations';
import { EditGuardProvider, useEditGuard, consumePendingAction } from '@/hooks/useEditGuard';
import { DealWorkspaceProvider, useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useDealMetrics } from '@/hooks/useDealMetrics';

// Import existing cover pages
import { DealPartiesCover } from './DealPartiesCover';
import { ContactsDealTab } from './ContactsDealTab';
import { KycKybDealTab } from './KycKybDealTab';
import { CapTableCover } from './CapTableCover';
import { WaterfallCover } from './WaterfallCover';
import { DocumentsCover } from './DocumentsCover';
import { ApprovalsCover } from './ApprovalsCover';
import { PaymentsCover } from './PaymentsCover';
import { EscrowCover } from './EscrowCover';
import { DealReportsCover } from './DealReportsCover';
import { DealActivityCover } from './DealActivityCover';
import { AIDashboardCover } from './AIDashboardCover';
import { NewtonAgentPanel } from './NewtonAgentPanel';
import { CommentsCover } from './CommentsCover';
import { DealInputsCover } from './DealInputsCover';
import { FinancialInputs } from './deal-inputs/FinancialInputs';
import { WireInstructions } from './deal-inputs/WireInstructions';
import { TaxInputs } from './deal-inputs/TaxInputs';
import { ContractInputs } from './deal-inputs/ContractInputs';
import { GovernanceInputs } from './deal-inputs/GovernanceInputs';
import { ObligationsPanel } from './deal-inputs/ObligationsPanel';
import { ReadinessPanel } from './deal-inputs/ReadinessPanel';
import { DiscrepancyPanelCover } from './DiscrepancyPanelCover';
import { ExecutionAuthorityPanel } from './ExecutionAuthorityPanel';
import { EditDealDrawer } from './EditDealDrawer';
import { VerificationReviewCover } from './VerificationReviewCover';
import { VerificationReadinessBanner } from './VerificationReadinessBanner';
import { ClosingCenterCover } from './ClosingCenterCover';
import { PaymentVerificationCover } from './PaymentVerificationCover';
import { ApprovalsWorkflowCover } from './ApprovalsWorkflowCover';
import { DealStateInspector } from './DealStateInspector';
import { WirePackCover } from './WirePackCover';

// ── Step definitions ──
type StepId = 'overview' | 'stakeholders' | 'deal-inputs' | 'verification' | 'approvals' | 'execution' | 'compliance' | 'comments' | 'ai' | 'newton-agents';

interface SubNav { id: string; label: string }

const STEP_SUB_NAV: Partial<Record<StepId, SubNav[]>> = {
  stakeholders: [
    { id: 'deal-parties', label: 'Deal Parties' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'kyc', label: 'KYC / KYB' },
    { id: 'review', label: 'Review Queue' },
  ],
  'deal-inputs': [
    { id: 'financial', label: 'Financial' },
    { id: 'cap-table', label: 'Cap Table' },
    { id: 'waterfall', label: 'Waterfall' },
    { id: 'wires', label: 'Wire Instructions' },
    { id: 'tax', label: 'Tax' },
    { id: 'contracts', label: 'Contract' },
    { id: 'governance', label: 'Governance' },
    { id: 'obligations', label: 'Obligations' },
    { id: 'readiness', label: 'Readiness' },
  ],
  verification: [
    { id: 'wire-instructions', label: 'Wire Instructions' },
    { id: 'allocations', label: 'Payment Allocations' },
    { id: 'discrepancies', label: 'Discrepancies' },
  ],
  approvals: [],
  execution: [
    { id: 'closing', label: 'Closing Readiness' },
    { id: 'wire-pack', label: 'Wire Pack' },
    { id: 'intents', label: 'Disbursement Intents' },
    { id: 'payments', label: 'Payments' },
    { id: 'discrepancies', label: 'Discrepancies' },
    { id: 'escrow', label: 'Escrow' },
    { id: 'authority', label: 'Execution Authority' },
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

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── Section Components ──

const DemoOverviewSection: React.FC<{ seedKey?: string | null; realDeal?: RealDeal | null }> = ({ seedKey, realDeal }) => {
  const demoDeal = useSelectedDeal();
  const effectiveKey = seedKey || demoDeal.id;
  const { dealId } = useDealWorkspace();

  // Derive metrics from canonical service
  const { metrics } = useDealMetrics(dealId);

  // Demo-specific narrative blockers (these describe the story, not counts)
  const DEMO_NEXT_ACTIONS: Record<string, string> = {
    atlas: '2 wire instructions pending verification — a16z & GIC',
    atlas_demo: '2 wire instructions pending verification — a16z & GIC',
    beacon: 'KYC pending for Insight Partners & ESOP Trust',
    beacon_demo: 'KYC pending for Insight Partners & ESOP Trust',
    cipher: 'Transition Services Agreement pending upload',
    cipher_demo: 'Transition Services Agreement pending upload',
  };

  const DEMO_BLOCKERS: Record<string, { label: string; severity: 'warning' | 'critical' }[]> = {
    atlas: [
      { label: 'Wire instructions missing for a16z', severity: 'critical' },
      { label: 'GIC Private Limited KYC failed — requires re-submission', severity: 'critical' },
    ],
    atlas_demo: [
      { label: 'Wire instructions missing for a16z', severity: 'critical' },
      { label: 'GIC Private Limited KYC failed — requires re-submission', severity: 'critical' },
    ],
    beacon: [
      { label: 'Escrow agreement not yet verified', severity: 'warning' },
      { label: 'Insight Partners verification pending', severity: 'warning' },
    ],
    beacon_demo: [
      { label: 'Escrow agreement not yet verified', severity: 'warning' },
      { label: 'Insight Partners verification pending', severity: 'warning' },
    ],
    cipher: [
      { label: 'TSA document pending upload', severity: 'warning' },
    ],
    cipher_demo: [
      { label: 'TSA document pending upload', severity: 'warning' },
    ],
  };

  const nextAction = DEMO_NEXT_ACTIONS[effectiveKey] || (metrics?.nextRequiredAction ?? 'Review deal workspace');
  const blockers = DEMO_BLOCKERS[effectiveKey] || [];

  const dealValue = realDeal?.deal_value ?? demoDeal.consideration;
  const escrowValue = realDeal?.escrow_amount ?? 0;
  const closingDate = realDeal?.closing_date || demoDeal.closingDate;
  const status = realDeal?.status || demoDeal.status;

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Deal Value', value: formatCurrency(dealValue) },
          { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1) },
          { label: 'Escrow', value: escrowValue > 0 ? formatCurrency(escrowValue) : 'N/A' },
          { label: 'Closing', value: closingDate },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-6">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className="pivt-stat text-2xl mt-3">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="pivt-card p-4">
          <p className="pivt-metric-label">Conditions</p>
          <p className="font-mono text-lg font-medium mt-1">
            {metrics ? `${metrics.conditionsSatisfied}/${metrics.totalConditions}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">satisfied</p>
        </div>
        <div className="pivt-card p-4">
          <p className="pivt-metric-label">Approvals</p>
          <p className="font-mono text-lg font-medium mt-1">
            {metrics ? `${metrics.grantedApprovals}/${metrics.totalApprovals}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {metrics ? `${metrics.totalApprovals - metrics.grantedApprovals} pending` : ''}
          </p>
        </div>
        <div className="pivt-card p-4">
          <p className="pivt-metric-label">Documents</p>
          <p className="font-mono text-lg font-medium mt-1">{metrics?.totalUploadedDocuments ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">linked</p>
        </div>
        <div className="pivt-card p-4">
          <p className="pivt-metric-label">Payments</p>
          <p className="font-mono text-lg font-medium mt-1">
            {metrics ? `${metrics.verifiedWireInstructions}/${metrics.totalWireInstructions}` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {metrics?.verifiedWireInstructions ?? 0} confirmed
          </p>
        </div>
        <div className="pivt-card p-4">
          <p className="pivt-metric-label">Escrow</p>
          <p className="font-mono text-lg font-medium mt-1 capitalize">
            {metrics?.totalSettlementRecords ? `${metrics.settledRecords}/${metrics.totalSettlementRecords}` : 'N/A'}
          </p>
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground/80">What's Blocking Close</h3>
          {blockers.map((b, i) => (
            <div key={i} className={`pivt-card p-4 border-l-4 ${b.severity === 'critical' ? 'border-blocking bg-blocking/4' : 'border-discrepancy bg-discrepancy/4'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 ${b.severity === 'critical' ? 'text-blocking' : 'text-discrepancy'}`} />
                <p className="text-sm">{b.label}</p>
                <Badge className={`ml-auto text-[9px] ${b.severity === 'critical' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'}`}>
                  {b.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RealDealOverviewSection: React.FC<{ realDeal: RealDeal; dealId: string }> = ({ realDeal, dealId }) => {
  const { metrics } = useDealMetrics(dealId);
  const { toast } = useToast();
  const status = realDeal.status;
  const [activating, setActivating] = useState(false);

  const stakeholderCount = metrics?.totalStakeholders ?? 0;
  const paymentCount = metrics?.totalWireInstructions ?? 0;

  const nextAction = metrics?.nextRequiredAction
    ?? (status === 'draft' ? 'Activate this deal to unlock workflows' : 'Loading...');

  // Activation prerequisites
  const prereqs = [
    { label: 'Buyer specified', met: !!realDeal.buyer },
    { label: 'Seller specified', met: !!realDeal.seller },
    { label: 'Target company specified', met: !!realDeal.target_company },
    { label: 'Deal type selected', met: !!realDeal.deal_type },
    { label: 'At least 2 stakeholders', met: stakeholderCount >= 2 },
    { label: 'Payment structure initialized', met: paymentCount >= 1 },
  ];
  const allPrereqsMet = prereqs.every(p => p.met);
  const isDraft = status === 'draft';

  const handleActivate = async () => {
    if (!allPrereqsMet) return;
    setActivating(true);
    const { error } = await supabase
      .from('deals')
      .update({ status: 'active' })
      .eq('id', dealId);
    setActivating(false);
    if (error) {
      toast({ title: 'Activation failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deal Activated', description: 'Workflows are now unlocked.' });
      window.dispatchEvent(new CustomEvent('deal-activated', { detail: { dealId } }));
      (realDeal as any).status = 'active';
    }
  };

  return (
    <div className="space-y-8">
      <VerificationReadinessBanner />

      {isDraft && (
        <motion.div {...fadeInUp} className="pivt-card p-6 border-l-4 border-accent">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-5 h-5 text-accent" />
                <h3 className="font-semibold text-lg">Activate Deal</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Complete the prerequisites below to activate this deal and unlock stakeholder invitations, verification, and approval workflows.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {prereqs.map(p => (
                  <div key={p.label} className="flex items-center gap-2 text-sm">
                    {p.met ? (
                      <CheckCircle2 className="w-4 h-4 text-validated shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <span className={p.met ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 pt-2">
              <Button
                onClick={handleActivate}
                disabled={!allPrereqsMet || activating}
                className="gap-2"
                size="lg"
              >
                {activating ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                {activating ? 'Activating…' : 'Activate Deal'}
              </Button>
              {!allPrereqsMet && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  {prereqs.filter(p => !p.met).length} prerequisite{prereqs.filter(p => !p.met).length > 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Deal Value', value: formatCurrency(realDeal.deal_value) },
          { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1) },
          { label: 'Escrow', value: formatCurrency(realDeal.escrow_amount || 0) },
          { label: 'Closing', value: realDeal.closing_date || 'TBD' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-6">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className="pivt-stat text-2xl mt-3">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="pivt-card p-4">
            <p className="pivt-metric-label">Conditions</p>
            <p className="font-mono text-lg font-medium mt-1">{metrics.conditionsSatisfied}/{metrics.totalConditions}</p>
            <p className="text-[10px] text-muted-foreground">satisfied</p>
          </div>
          <div className="pivt-card p-4">
            <p className="pivt-metric-label">Approvals</p>
            <p className="font-mono text-lg font-medium mt-1">{metrics.grantedApprovals}/{metrics.totalApprovals}</p>
            <p className="text-[10px] text-muted-foreground">{metrics.totalApprovals - metrics.grantedApprovals} pending</p>
          </div>
          <div className="pivt-card p-4">
            <p className="pivt-metric-label">Documents</p>
            <p className="font-mono text-lg font-medium mt-1">{metrics.totalUploadedDocuments}</p>
            <p className="text-[10px] text-muted-foreground">linked</p>
          </div>
          <div className="pivt-card p-4">
            <p className="pivt-metric-label">Payments</p>
            <p className="font-mono text-lg font-medium mt-1">{metrics.verifiedWireInstructions}/{metrics.totalWireInstructions}</p>
            <p className="text-[10px] text-muted-foreground">{metrics.verifiedWireInstructions} confirmed</p>
          </div>
          <div className="pivt-card p-4">
            <p className="pivt-metric-label">Escrow</p>
            <p className="font-mono text-lg font-medium mt-1 capitalize">
              {metrics.totalSettlementRecords > 0 ? `${metrics.settledRecords}/${metrics.totalSettlementRecords}` : 'N/A'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const OverviewSection: React.FC<{ realDeal?: RealDeal | null; dealId?: string; isDemoDeal?: boolean; seedKey?: string | null }> = ({ realDeal, dealId, isDemoDeal, seedKey }) => {
  if (isDemoDeal) {
    return <DemoOverviewSection seedKey={seedKey} realDeal={realDeal} />;
  }
  return <RealDealOverviewSection realDeal={realDeal!} dealId={dealId || ''} />;
};

const ReconciliationSection: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [discrepancies, setDiscrepancies] = useState<{ id: string; field: string; desc: string; severity: 'warning' | 'critical'; resolved: boolean }[]>([]);

  useEffect(() => {
    if (!dealId) return;
    supabase
      .from('discrepancies')
      .select('id, rule_key, message, severity, status')
      .eq('deal_id', dealId)
      .then(({ data }) => {
        setDiscrepancies((data || []).map((d: any) => ({
          id: d.id,
          field: d.rule_key,
          desc: d.message,
          severity: d.severity === 'critical' ? 'critical' : 'warning',
          resolved: d.status === 'resolved' || d.status === 'acknowledged',
        })));
      });
  }, [dealId]);

  if (discrepancies.length === 0) {
    return (
      <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
        No reconciliation issues found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-discrepancy" />
        <h3 className="font-medium">Reconciliation Results</h3>
        <span className="text-xs text-muted-foreground ml-auto">{discrepancies.filter(d => !d.resolved).length} unresolved</span>
      </div>
      <div className="space-y-2">
        {discrepancies.map(disc => (
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
};

// ── Protected deal banner ──
const ProtectedDealBanner: React.FC = () => {
  const { isProtected, guardEdit } = useEditGuard();
  if (!isProtected) return null;

  return (
    <motion.div
      {...fadeInUp}
      className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-accent/20 bg-accent/5"
    >
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm text-foreground/80">
          <span className="font-semibold">Read-only.</span> This is a shared demo deal. Duplicate it to make changes.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs shrink-0 border-accent/30 text-accent hover:bg-accent/10"
        onClick={() => guardEdit('DUPLICATE', null, () => {})}
      >
        <Copy className="w-3 h-3" />
        Duplicate to edit
      </Button>
    </motion.div>
  );
};

const DealAuditSection: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [entries, setEntries] = useState<{ action: string; actor: string; time: string }[]>([]);

  useEffect(() => {
    if (!dealId) return;
    supabase
      .from('audit_log')
      .select('action, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEntries((data || []).map((e: any) => ({
          action: e.action,
          actor: 'System',
          time: new Date(e.created_at).toLocaleString(),
        })));
      });
  }, [dealId]);

  if (entries.length === 0) {
    return (
      <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
        No audit activity recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-medium">Deal Audit Log</h3>
      </div>
      <div className="relative pl-5 space-y-3">
        <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border/40" />
        {entries.map((entry, i) => (
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
};

// ── Content resolver ──
function getContentComponent(stepId: StepId, subNavId?: string): React.FC<any> {
  switch (stepId) {
    case 'overview': return OverviewSection;
    case 'stakeholders':
      if (subNavId === 'contacts') return ContactsDealTab;
      if (subNavId === 'kyc') return KycKybDealTab;
      if (subNavId === 'review') return VerificationReviewCover;
      return DealPartiesCover;
    case 'deal-inputs':
      if (subNavId === 'cap-table') return CapTableCover;
      if (subNavId === 'waterfall') return WaterfallCover;
      if (subNavId === 'wires') return WireInstructions;
      if (subNavId === 'tax') return TaxInputs;
      if (subNavId === 'contracts') return ContractInputs;
      if (subNavId === 'governance') return GovernanceInputs;
      if (subNavId === 'obligations') return ObligationsPanel;
      if (subNavId === 'readiness') return ReadinessPanel;
      return FinancialInputs;
    case 'verification':
      return PaymentVerificationCover;
    case 'approvals':
      return ApprovalsWorkflowCover;
    case 'execution':
      if (subNavId === 'closing') return ClosingCenterCover;
      if (subNavId === 'intents') return PaymentsCover;
      if (subNavId === 'payments') return PaymentsCover;
      if (subNavId === 'discrepancies') return DiscrepancyPanelCover;
      if (subNavId === 'escrow') return EscrowCover;
      if (subNavId === 'authority') return ExecutionAuthorityPanel;
      return ClosingCenterCover;
    case 'compliance':
      if (subNavId === 'reports') return DealReportsCover;
      if (subNavId === 'activity') return DealActivityCover;
      return DealAuditSection;
    case 'comments': return CommentsCover;
    case 'ai': return AIDashboardCover;
    case 'newton-agents': return NewtonAgentPanel;
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
  const { selectedDealId, setActiveSection } = usePIVTStore();
  const demoDeal = useSelectedDeal();
  const [activeStepId, setActiveStepId] = useState<StepId>('overview');
  const [activeSubNav, setActiveSubNav] = useState<string | undefined>();
  const [realDeal, setRealDeal] = useState<RealDeal | null>(null);
  const [loadingDeal, setLoadingDeal] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const isRealDeal = selectedDealId && selectedDealId.includes('-') && selectedDealId.length > 10;
  const isDemoDeal = useMemo(() => {
    if (!isRealDeal) return true;
    if (realDeal) return !!(realDeal.is_demo || realDeal.seed_key);
    return false;
  }, [isRealDeal, realDeal]);
  const demoDealSeedKey = useMemo(() => {
    if (!isRealDeal) return selectedDealId;
    return realDeal?.seed_key || null;
  }, [isRealDeal, realDeal, selectedDealId]);

  const effectiveDealId = isRealDeal ? selectedDealId : undefined;
  const DEMO_ID_MAP: Record<string, string> = {
    atlas: 'a0000000-0000-0000-0000-000000000001',
    beacon: 'b0000000-0000-0000-0000-000000000002',
    cipher: 'c0000000-0000-0000-0000-000000000003',
  };
  const resolvedDealId = effectiveDealId || DEMO_ID_MAP[selectedDealId] || undefined;

  // ── SINGLE SOURCE OF TRUTH: canonical metrics ──
  const { metrics, loading: metricsLoading } = useDealMetrics(resolvedDealId);

  useEffect(() => {
    const fetchId = isRealDeal ? selectedDealId : DEMO_ID_MAP[selectedDealId];
    if (fetchId) {
      setLoadingDeal(true);
      supabase.from('deals').select('*').eq('id', fetchId).single()
        .then(({ data }) => {
          setRealDeal(data as RealDeal | null);
          setLoadingDeal(false);
        });
    } else {
      setRealDeal(null);
      setLoadingDeal(false);
    }
  }, [selectedDealId, isRealDeal]);

  useEffect(() => {
    if (!selectedDealId) {
      setActiveSection('deals');
    }
  }, [selectedDealId]);

  useEffect(() => {
    if (!loadingDeal && realDeal && !isDemoDeal) {
      const pending = consumePendingAction();
      if (pending) {
        if (pending.type === 'ADD_STAKEHOLDER') {
          setActiveStepId('stakeholders');
        } else if (pending.type === 'ADD_WATERFALL_TIER') {
          setActiveStepId('deal-inputs');
          setActiveSubNav('waterfall');
        } else if (pending.type === 'UPLOAD_DOCUMENT') {
          setActiveStepId('deal-inputs');
          setActiveSubNav('contracts');
        }
      }
    }
  }, [loadingDeal, realDeal, isDemoDeal]);

  const handleStepClick = (id: string) => {
    setActiveStepId(id as StepId);
    const subs = STEP_SUB_NAV[id as StepId];
    setActiveSubNav(subs ? subs[0].id : undefined);
  };

  const dealName = realDeal?.deal_name || demoDeal.codeName;
  const dealNumber = realDeal?.deal_number || demoDeal.dealNumber;
  const dealValue = realDeal ? realDeal.deal_value : demoDeal.consideration;
  const closingDate = realDeal?.closing_date || demoDeal.closingDate;
  const dealStatus = realDeal?.status || demoDeal.status;
  const hasBlocker = isDemoDeal && demoDeal.hasBlocker;

  // Readiness from canonical metrics
  const readyPct = metrics?.readinessPercent ?? 0;

  // ── Progress Ribbon Data — all from canonical metrics ──
  const progressData: DealProgressData = useMemo(() => {
    const m = metrics;
    return {
      stakeholdersAdded: m?.totalStakeholders || 0,
      stakeholdersRequired: 0, // open-ended
      compliancePassed: m?.requiredVerifiedStakeholders || 0,
      complianceTotal: m?.requiredStakeholders || 0,
      complianceBlocked: false,
      conditionsSatisfied: m?.conditionsSatisfied || 0,
      conditionsTotal: m?.totalConditions || 0,
      documentsUploaded: m?.totalUploadedDocuments || 0,
      documentsRequired: 0, // open-ended — readiness uses requiredDocuments separately
      approvalsGranted: m?.grantedRequiredApprovals || 0,
      approvalsTotal: m?.requiredApprovals || 0,
      approvalsBlocked: false,
      paymentsExecuted: m?.settledRecords || 0,
      paymentsTotal: m?.totalSettlementRecords || 0,
      paymentsFailed: false,
    };
  }, [metrics]);

  // ── Workflow Steps — derived from canonical stage statuses ──
  const workflowSteps: WorkflowStep[] = useMemo(() => {
    const ss = metrics?.stageStatuses;
    const pctFromStatus = (s: string | undefined) => {
      if (!s) return 0;
      if (s === 'complete') return 100;
      if (s === 'in_progress') return 50;
      if (s === 'blocked') return 25;
      return 0;
    };
    return [
      { id: 'overview', number: 1, label: 'Overview', completionPct: 100, blockers: 0 },
      { id: 'stakeholders', number: 2, label: 'Stakeholders', completionPct: pctFromStatus(ss?.stakeholders), blockers: 0 },
      { id: 'deal-inputs', number: 3, label: 'Deal Inputs', completionPct: pctFromStatus(ss?.deal_inputs), blockers: 0 },
      { id: 'verification', number: 4, label: 'Verification', completionPct: pctFromStatus(ss?.verification), blockers: 0 },
      { id: 'approvals', number: 5, label: 'Approvals', completionPct: pctFromStatus(ss?.compliance), blockers: 0 },
      { id: 'execution', number: 6, label: 'Execution', completionPct: pctFromStatus(ss?.execution), blockers: ss?.execution === 'blocked' ? 1 : 0 },
      { id: 'compliance', number: 7, label: 'Compliance', completionPct: pctFromStatus(ss?.compliance), blockers: 0 },
      { id: 'comments', number: 8, label: 'Comments', completionPct: 100, blockers: 0 },
      { id: 'ai', number: 9, label: 'AI', completionPct: 0, blockers: 0 },
      { id: 'newton-agents', number: 10, label: 'Agents', completionPct: 0, blockers: 0 },
    ];
  }, [metrics]);

  const totalBlockers = useMemo(() => workflowSteps.reduce((sum, s) => sum + s.blockers, 0), [workflowSteps]);
  const sectionsWithBlockers = useMemo(() => workflowSteps.filter(s => s.blockers > 0).length, [workflowSteps]);

  const subNavItems = STEP_SUB_NAV[activeStepId];
  const ContentComponent = getContentComponent(activeStepId, activeSubNav);

  const currentStep = workflowSteps.find(s => s.id === activeStepId);
  const currentStatus = currentStep ? deriveStatus(currentStep) : 'not_started';

  if (loadingDeal) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isRealDeal && !realDeal) {
    return (
      <div className="space-y-4">
        <button onClick={() => setActiveSection('deals')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Deals
        </button>
        <div className="pivt-card p-12 text-center">
          <p className="text-muted-foreground">Deal not found.</p>
        </div>
      </div>
    );
  }

  return (
    <EditGuardProvider realDeal={realDeal} isDemoDeal={isDemoDeal}>
    <DealWorkspaceProvider dealId={resolvedDealId || selectedDealId} isDemoDeal={isDemoDeal} realDeal={realDeal}>
    <motion.div {...staggerChildren} className="space-y-8">
      <button
        onClick={() => setActiveSection('deals')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Deals
      </button>

      <ProtectedDealBanner />

      {/* ── Deal Header ── */}
      <div className="pivt-panel p-6 lg:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground truncate" style={{ letterSpacing: '-0.04em' }}>{dealName}</h1>
                {hasBlocker && (
                  <Badge className="bg-blocking/10 text-blocking border-blocking/15 shrink-0">
                    <Ban className="w-3 h-3 mr-1" /> Blocked
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => navigator.clipboard.writeText(dealNumber)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer"
                  title="Click to copy Deal ID"
                >
                  {dealNumber}
                </button>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  dealStatus === 'active' ? 'bg-accent/10 text-accent' :
                  dealStatus === 'closed' ? 'bg-validated/10 text-validated' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {dealStatus.charAt(0).toUpperCase() + dealStatus.slice(1)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isDemoDeal && realDeal && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => setEditDrawerOpen(true)}
                >
                  <Pencil className="w-3 h-3" />
                  Edit Deal
                </Button>
              )}
              {isDemoDeal && (
                <Badge variant="secondary" className="text-[10px]">Read-only demo</Badge>
              )}
              <button className="pivt-ai-btn flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-accent whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 pivt-spark" />
                What's blocking close?
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap border-t border-border/30 pt-4">
            <div>
              <p className="pivt-metric-label">Deal Value</p>
              <p className="font-mono text-lg font-medium mt-1">{formatCurrency(dealValue)}</p>
            </div>
            <div className="h-8 w-px bg-border/20 hidden sm:block" />
            <div>
              <p className="pivt-metric-label">Closing</p>
              <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" />
                {closingDate || 'TBD'}
              </p>
            </div>
            <div className="h-8 w-px bg-border/20 hidden sm:block" />
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="pivt-metric-label">Readiness</p>
                <span className="font-mono text-xs font-medium">{readyPct}%</span>
              </div>
              <Progress value={readyPct} className="h-1.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Blocking Issues ── */}
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
        </motion.div>
      )}

      {/* ── Deal Progress Ribbon ── */}
      <DealProgressRibbon
        progressData={progressData}
        onStageClick={(stageId) => {
          const stepMap: Record<string, string> = {
            stakeholders: 'stakeholders',
            verification: 'verification',
            'deal-inputs': 'deal-inputs',
            execution: 'execution',
            settlement: 'execution',
          };
          handleStepClick(stepMap[stageId] || 'overview');
        }}
      />

      {/* ── Workflow Stepper ── */}
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
        {subNavItems && subNavItems.length > 0 ? (
          <SectionWithSideTabs
            subs={subNavItems}
            activeSub={activeSubNav || subNavItems[0].id}
            onSubChange={setActiveSubNav}
            stepLabel={currentStep?.label || ''}
            stepStatus={currentStatus}
          >
            {activeStepId === 'overview' ? <ContentComponent realDeal={realDeal} dealId={selectedDealId} isDemoDeal={isDemoDeal} seedKey={demoDealSeedKey} /> : <ContentComponent />}
          </SectionWithSideTabs>
        ) : (
          activeStepId === 'overview' ? <ContentComponent realDeal={realDeal} dealId={selectedDealId} isDemoDeal={isDemoDeal} seedKey={demoDealSeedKey} /> : <ContentComponent />
        )}
      </motion.div>

      <DealStateInspector />

      {realDeal && !isDemoDeal && (
        <EditDealDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          deal={realDeal}
          onSaved={(updated) => setRealDeal(updated)}
        />
      )}
    </motion.div>
    </DealWorkspaceProvider>
    </EditGuardProvider>
  );
};
