import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  ArrowLeft, AlertTriangle, Ban, CheckCircle2, Rocket,
  FileText, Users, Search, Sparkles, Calendar, Brain, ShieldAlert, Copy, Pencil,
  LayoutDashboard, UserCheck, Layers, ShieldCheck, ClipboardCheck, Zap, Scale, MessageCircle, Bot,
  ChevronRight, Circle, CreditCard, Upload, Wand2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { RealDeal } from '@/hooks/useDealOperations';
import { EditGuardProvider, useEditGuard, consumePendingAction } from '@/hooks/useEditGuard';
import { DealWorkspaceProvider, useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { NewtonProvider, useNewtonContext, type NewtonRecordType, type NewtonWorkspaceTab } from '@/contexts/NewtonContext';
import { useDealMetrics } from '@/hooks/useDealMetrics';
import { useDealWorkflow } from '@/hooks/useDealWorkflow';
import type { DealMetrics } from '@/services/dealMetricsService';
import { NewtonRail } from '@/components/newton/NewtonRail';

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
import { ExecutionPrepCover } from './ExecutionPrepCover';

// ── Step definitions ──
type StepId = 'overview' | 'stakeholders' | 'deal-inputs' | 'verification' | 'approvals' | 'execution' | 'compliance' | 'comments' | 'ai';

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
    { id: 'prep', label: 'Execution Prep' },
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

// ── Sidebar Navigation Config ──
interface SidebarNavItem {
  id: StepId;
  label: string;
  icon: React.ElementType;
}

const SIDEBAR_NAV: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'stakeholders', label: 'Stakeholders', icon: Users },
  { id: 'deal-inputs', label: 'Deal Inputs', icon: Layers },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
  { id: 'execution', label: 'Execution', icon: Zap },
  { id: 'compliance', label: 'Compliance', icon: Scale },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── Status Bar Component ──
const DealStatusBar: React.FC<{ dealStatus: string; readyPct: number; totalBlockers: number; metrics: any }> = ({
  dealStatus, readyPct, totalBlockers, metrics,
}) => {
  const statusMessage = useMemo(() => {
    if (totalBlockers > 0) return { emoji: '🔴', text: `${totalBlockers} blocking issue${totalBlockers !== 1 ? 's' : ''} remaining`, variant: 'blocking' as const };
    if (readyPct >= 100) return { emoji: '🟢', text: 'Ready to execute', variant: 'ready' as const };
    if (readyPct >= 50) return { emoji: '🟡', text: `${100 - readyPct}% readiness remaining`, variant: 'progress' as const };
    return { emoji: '🟡', text: 'Deal setup in progress', variant: 'progress' as const };
  }, [totalBlockers, readyPct]);

  const variantStyles = {
    blocking: 'border-blocking/20 bg-blocking/4',
    ready: 'border-validated/20 bg-validated/4',
    progress: 'border-discrepancy/20 bg-discrepancy/4',
  };

  return (
    <div className={`flex items-center justify-between px-5 py-2.5 rounded-xl border ${variantStyles[statusMessage.variant]} transition-all`}>
      <div className="flex items-center gap-3">
        <span className="text-sm">{statusMessage.emoji}</span>
        <span className="text-sm font-medium text-foreground">{statusMessage.text}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {metrics && (
          <>
            <span className="font-mono">{metrics.totalUploadedDocuments || 0} docs</span>
            <span className="h-3 w-px bg-border" />
            <span className="font-mono">{metrics.grantedApprovals || 0}/{metrics.totalApprovals || 0} approvals</span>
            <span className="h-3 w-px bg-border" />
            <span className="font-mono">{metrics.verifiedWireInstructions || 0}/{metrics.totalWireInstructions || 0} wires</span>
          </>
        )}
      </div>
    </div>
  );
};

// ── Overview Sections ──
const DemoOverviewSection: React.FC<{ seedKey?: string | null; realDeal?: RealDeal | null }> = ({ seedKey, realDeal }) => {
  const demoDeal = useSelectedDeal();
  const effectiveKey = seedKey || demoDeal.id;
  const { dealId, metrics } = useDealWorkspace();

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
    cipher: [{ label: 'TSA document pending upload', severity: 'warning' }],
    cipher_demo: [{ label: 'TSA document pending upload', severity: 'warning' }],
  };

  const nextAction = DEMO_NEXT_ACTIONS[effectiveKey] || (metrics?.nextRequiredAction ?? 'Review deal workspace');
  const blockers = DEMO_BLOCKERS[effectiveKey] || [];
  const dealValue = realDeal?.deal_value ?? demoDeal.consideration;
  const escrowValue = realDeal?.escrow_amount ?? 0;
  const closingDate = realDeal?.closing_date || demoDeal.closingDate;
  const status = realDeal?.status || demoDeal.status;

  return (
    <div className="space-y-6">
      {/* Next Action */}
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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deal Value', value: formatCurrency(dealValue) },
          { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1) },
          { label: 'Escrow', value: escrowValue > 0 ? formatCurrency(escrowValue) : 'N/A' },
          { label: 'Closing', value: closingDate },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-5">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className="text-xl font-semibold mt-2 font-mono" style={{ letterSpacing: '-0.02em' }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Conditions', value: metrics ? `${metrics.conditionsSatisfied}/${metrics.totalConditions}` : '—', sub: 'satisfied' },
          { label: 'Approvals', value: metrics ? `${metrics.grantedApprovals}/${metrics.totalApprovals}` : '—', sub: metrics ? `${metrics.totalApprovals - metrics.grantedApprovals} pending` : '' },
          { label: 'Documents', value: String(metrics?.totalUploadedDocuments ?? 0), sub: 'linked' },
          { label: 'Payments', value: metrics ? `${metrics.verifiedWireInstructions}/${metrics.totalWireInstructions}` : '—', sub: `${metrics?.verifiedWireInstructions ?? 0} confirmed` },
          { label: 'Escrow', value: metrics?.totalSettlementRecords ? `${metrics.settledRecords}/${metrics.totalSettlementRecords}` : 'N/A', sub: '' },
        ].map(stat => (
          <div key={stat.label} className="pivt-card p-4">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className="font-mono text-lg font-medium mt-1">{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-muted-foreground">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Blockers */}
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
    const { error } = await supabase.from('deals').update({ status: 'active' }).eq('id', dealId);
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
    <div className="space-y-6">
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
                    {p.met ? <CheckCircle2 className="w-4 h-4 text-validated shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                    <span className={p.met ? 'text-foreground' : 'text-muted-foreground'}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 pt-2">
              <Button onClick={handleActivate} disabled={!allPrereqsMet || activating} className="gap-2" size="lg">
                {activating ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Rocket className="w-4 h-4" />}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deal Value', value: formatCurrency(realDeal.deal_value) },
          { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1) },
          { label: 'Escrow', value: formatCurrency(realDeal.escrow_amount || 0) },
          { label: 'Closing', value: realDeal.closing_date || 'TBD' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-5">
            <p className="pivt-metric-label">{stat.label}</p>
            <p className="text-xl font-semibold mt-2 font-mono" style={{ letterSpacing: '-0.02em' }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Conditions', value: `${metrics.conditionsSatisfied}/${metrics.totalConditions}`, sub: 'satisfied' },
            { label: 'Approvals', value: `${metrics.grantedApprovals}/${metrics.totalApprovals}`, sub: `${metrics.totalApprovals - metrics.grantedApprovals} pending` },
            { label: 'Documents', value: String(metrics.totalUploadedDocuments), sub: 'linked' },
            { label: 'Payments', value: `${metrics.verifiedWireInstructions}/${metrics.totalWireInstructions}`, sub: `${metrics.verifiedWireInstructions} confirmed` },
            { label: 'Escrow', value: metrics.totalSettlementRecords > 0 ? `${metrics.settledRecords}/${metrics.totalSettlementRecords}` : 'N/A', sub: '' },
          ].map(stat => (
            <div key={stat.label} className="pivt-card p-4">
              <p className="pivt-metric-label">{stat.label}</p>
              <p className="font-mono text-lg font-medium mt-1">{stat.value}</p>
              {stat.sub && <p className="text-[10px] text-muted-foreground">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OverviewSection: React.FC<{ realDeal?: RealDeal | null; dealId?: string; isDemoDeal?: boolean; seedKey?: string | null }> = ({ realDeal, dealId, isDemoDeal, seedKey }) => {
  if (isDemoDeal) return <DemoOverviewSection seedKey={seedKey} realDeal={realDeal} />;
  return <RealDealOverviewSection realDeal={realDeal!} dealId={dealId || ''} />;
};

const ReconciliationSection: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [discrepancies, setDiscrepancies] = useState<{ id: string; field: string; desc: string; severity: 'warning' | 'critical'; resolved: boolean }[]>([]);

  useEffect(() => {
    if (!dealId) return;
    supabase.from('discrepancies').select('id, rule_key, message, severity, status').eq('deal_id', dealId)
      .then(({ data }) => {
        setDiscrepancies((data || []).map((d: any) => ({
          id: d.id, field: d.rule_key, desc: d.message,
          severity: d.severity === 'critical' ? 'critical' : 'warning',
          resolved: d.status === 'resolved' || d.status === 'acknowledged',
        })));
      });
  }, [dealId]);

  if (discrepancies.length === 0) {
    return <div className="pivt-card p-12 text-center text-muted-foreground text-sm">No reconciliation issues found.</div>;
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
    <motion.div {...fadeInUp} className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-accent/20 bg-accent/5">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm text-foreground/80 font-medium">
          You are viewing a demo deal. No changes will be saved.
        </span>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0 border-accent/30 text-accent hover:bg-accent/10" onClick={() => guardEdit('DUPLICATE', null, () => {})}>
        <Copy className="w-3 h-3" /> Duplicate to edit
      </Button>
    </motion.div>
  );
};

const DealAuditSection: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [entries, setEntries] = useState<{ action: string; actor: string; time: string }[]>([]);

  useEffect(() => {
    if (!dealId) return;
    supabase.from('audit_log').select('action, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        setEntries((data || []).map((e: any) => ({ action: e.action, actor: 'System', time: new Date(e.created_at).toLocaleString() })));
      });
  }, [dealId]);

  if (entries.length === 0) return <div className="pivt-card p-12 text-center text-muted-foreground text-sm">No audit activity recorded yet.</div>;

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

const WorkspaceEmptyState: React.FC<{
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}> = ({ icon: Icon, eyebrow, title, description, ctaLabel, onCta }) => (
  <motion.div {...fadeInUp} className="pivt-card p-10 md:p-12 text-center space-y-5">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
      <Icon className="h-6 w-6" />
    </div>
    <div className="space-y-2 max-w-xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Button onClick={onCta} className="gap-2">
      <Sparkles className="h-4 w-4" />
      {ctaLabel}
    </Button>
  </motion.div>
);

function getWorkspaceEmptyState(stepId: StepId, metrics: DealMetrics | null, openNewton: () => void) {
  if (!metrics) return null;

  if (stepId === 'stakeholders' && metrics.totalStakeholders === 0) {
    return {
      icon: Users,
      eyebrow: 'Stakeholders',
      title: 'Start with the deal parties and team',
      description: 'Buyer, seller, target, and supporting contacts will appear here once Newton or your team adds the first participants.',
      ctaLabel: 'Create deal structure with Newton',
      onCta: openNewton,
    };
  }

  if (stepId === 'deal-inputs' && metrics.totalUploadedDocuments === 0 && metrics.totalObligations === 0) {
    return {
      icon: Upload,
      eyebrow: 'Deal Inputs',
      title: 'Upload the transaction documents to populate this workspace',
      description: 'SPA terms, funds flow, tax inputs, governance docs, and extracted obligations will land here after the first intake pass.',
      ctaLabel: 'Open Newton intake',
      onCta: openNewton,
    };
  }

  if (stepId === 'verification' && metrics.totalWireInstructions === 0) {
    return {
      icon: ShieldCheck,
      eyebrow: 'Verification',
      title: 'Verification starts once payment details exist',
      description: 'Wire confirmations, allocation checks, and discrepancy review appear here after deal inputs and payment instructions are added.',
      ctaLabel: 'Generate payment setup with Newton',
      onCta: openNewton,
    };
  }

  if (stepId === 'approvals' && metrics.totalApprovals === 0) {
    return {
      icon: ClipboardCheck,
      eyebrow: 'Approvals',
      title: 'No approval workflow has been configured yet',
      description: 'Newton can scaffold approvers, signing flows, and approval requests once the core deal documents and stakeholders are ready.',
      ctaLabel: 'Ask Newton to stage approvals',
      onCta: openNewton,
    };
  }

  if (stepId === 'execution' && metrics.totalSettlementRecords === 0 && metrics.totalWireInstructions === 0) {
    return {
      icon: Zap,
      eyebrow: 'Execution',
      title: 'Execution activates after verification is complete',
      description: 'Wire packs, payment intents, escrow actions, and settlement records will show up here when the deal is ready to move funds.',
      ctaLabel: 'Prepare execution plan with Newton',
      onCta: openNewton,
    };
  }

  if (stepId === 'compliance' && metrics.totalConditions === 0 && metrics.totalApprovals === 0 && metrics.totalUploadedDocuments === 0) {
    return {
      icon: Scale,
      eyebrow: 'Compliance',
      title: 'Compliance artifacts will build as the deal progresses',
      description: 'Audit history, reports, and operational activity appear here once documents, approvals, and workflow events start flowing through the deal.',
      ctaLabel: 'Launch guided setup in Newton',
      onCta: openNewton,
    };
  }

  return null;
}

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
    case 'verification': return PaymentVerificationCover;
    case 'approvals': return ApprovalsWorkflowCover;
    case 'execution':
      if (subNavId === 'prep') return ExecutionPrepCover;
      if (subNavId === 'closing') return ClosingCenterCover;
      if (subNavId === 'wire-pack') return WirePackCover;
      if (subNavId === 'intents') return PaymentsCover;
      if (subNavId === 'payments') return PaymentsCover;
      if (subNavId === 'discrepancies') return DiscrepancyPanelCover;
      if (subNavId === 'escrow') return EscrowCover;
      if (subNavId === 'authority') return ExecutionAuthorityPanel;
      return ExecutionPrepCover;
    case 'compliance':
      if (subNavId === 'reports') return DealReportsCover;
      if (subNavId === 'activity') return DealActivityCover;
      return DealAuditSection;
    case 'comments': return CommentsCover;
    case 'ai': return AIDashboardCover;
    default: return OverviewSection;
  }
}

const STEP_TO_NEWTON_TAB: Record<StepId, NewtonWorkspaceTab> = {
  overview: 'overview',
  stakeholders: 'stakeholders',
  'deal-inputs': 'deal-inputs',
  verification: 'verification',
  approvals: 'approvals',
  execution: 'execution',
  compliance: 'compliance',
  comments: 'comments',
  ai: 'ai',
};

const SUBNAV_TO_RECORD_TYPE: Partial<Record<string, NewtonRecordType>> = {
  'deal-parties': 'stakeholder',
  contacts: 'stakeholder',
  kyc: 'stakeholder',
  review: 'stakeholder',
  financial: 'document',
  'cap-table': 'stakeholder',
  waterfall: 'payment',
  wires: 'payment',
  tax: 'document',
  contracts: 'document',
  governance: 'document',
  obligations: 'document',
  readiness: 'deal',
  'wire-instructions': 'payment',
  allocations: 'payment',
  discrepancies: 'discrepancy',
  reports: 'document',
  activity: 'comment',
  audit: 'deal',
  prep: 'deal',
  closing: 'deal',
  'wire-pack': 'document',
  intents: 'payment',
  payments: 'payment',
  escrow: 'entity',
  authority: 'approval',
};

const ENTITY_TO_RECORD_TYPE: Record<string, NewtonRecordType> = {
  deal: 'deal',
  stakeholder: 'stakeholder',
  document: 'document',
  payment: 'payment',
  escrow: 'entity',
  approval: 'approval',
};

// ── Deal Workspace Sidebar ──
const WorkspaceSidebar: React.FC<{
  activeStepId: StepId;
  onStepClick: (id: StepId) => void;
  subNavItems?: SubNav[];
  activeSubNav?: string;
  onSubChange: (id: string) => void;
  stageStatuses?: Record<string, string>;
}> = ({ activeStepId, onStepClick, subNavItems, activeSubNav, onSubChange, stageStatuses }) => {

  const getStepDot = (id: StepId) => {
    const status = stageStatuses?.[id === 'deal-inputs' ? 'deal_inputs' : id];
    if (status === 'complete') return 'bg-validated';
    if (status === 'in_progress') return 'bg-amber-400';
    if (status === 'blocked') return 'bg-blocking';
    return 'bg-muted-foreground/20';
  };

  return (
    <div className="w-52 shrink-0 flex flex-col gap-1">
      {/* Primary nav */}
      <nav className="space-y-0.5">
        {SIDEBAR_NAV.map(item => {
          const isActive = activeStepId === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onStepClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-accent/8 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
              style={isActive ? { borderLeft: '2px solid hsl(var(--accent))' } : { borderLeft: '2px solid transparent' }}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStepDot(item.id)} transition-colors`} />
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-muted-foreground/60 group-hover:text-muted-foreground'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sub-navigation */}
      {subNavItems && subNavItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            {SIDEBAR_NAV.find(s => s.id === activeStepId)?.label}
          </p>
          <div className="space-y-0.5">
            {subNavItems.map(sub => (
              <button
                key={sub.id}
                onClick={() => onSubChange(sub.id)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-[12px] transition-all duration-150 ${
                  activeSubNav === sub.id
                    ? 'font-medium text-foreground bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${activeSubNav === sub.id ? 'rotate-90 text-accent' : 'text-muted-foreground/40'}`} />
                  <span>{sub.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const WorkspaceShell: React.FC<{
  activeStepId: StepId;
  activeSubNav?: string;
  setActiveStepId: React.Dispatch<React.SetStateAction<StepId>>;
  setActiveSubNav: React.Dispatch<React.SetStateAction<string | undefined>>;
  metrics: ReturnType<typeof useDealMetrics>['metrics'];
  realDeal: RealDeal | null;
  isDemoDeal: boolean;
  demoDealSeedKey: string | null;
  selectedDealId: string;
}> = ({ activeStepId, activeSubNav, setActiveStepId, setActiveSubNav, metrics, realDeal, isDemoDeal, demoDealSeedKey, selectedDealId }) => {
  const { selectedEntity } = usePIVTStore();
  const { setCurrentTab, setFocusedRecord } = useNewtonContext();

  useEffect(() => {
    setCurrentTab(STEP_TO_NEWTON_TAB[activeStepId]);
  }, [activeStepId, setCurrentTab]);

  useEffect(() => {
    const entityType = selectedEntity?.type ? ENTITY_TO_RECORD_TYPE[selectedEntity.type] : null;
    const fallbackType = activeSubNav ? SUBNAV_TO_RECORD_TYPE[activeSubNav] ?? null : null;

    if (selectedEntity?.id && entityType) {
      setFocusedRecord({ id: selectedEntity.id, type: entityType });
      return;
    }

    if (activeSubNav && fallbackType) {
      setFocusedRecord({ id: activeSubNav, type: fallbackType });
      return;
    }

    setFocusedRecord({ id: undefined, type: null });
  }, [activeSubNav, selectedEntity, setFocusedRecord]);

  const handleStepClick = (id: StepId) => {
    setActiveStepId(id);
    const subs = STEP_SUB_NAV[id];
    setActiveSubNav(subs ? subs[0].id : undefined);
  };

  const subNavItems = STEP_SUB_NAV[activeStepId];
  const ContentComponent = getContentComponent(activeStepId, activeSubNav);
  const showingChecklistSurface = activeStepId === 'execution' && activeSubNav === 'closing';
  const openNewton = () => {
    window.dispatchEvent(new CustomEvent('pivt:open-newton'));
    window.dispatchEvent(new CustomEvent('pivt:newton-create-deal'));
  };
  const emptyState = getWorkspaceEmptyState(activeStepId, metrics, openNewton);

  return (
    <div className="grid min-h-[600px] gap-6 xl:grid-cols-[22rem,13rem,minmax(0,1fr),20rem] items-start">
      <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
        <ClosingCenterCover mode="frame" />
      </div>

      <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
        <WorkspaceSidebar
          activeStepId={activeStepId}
          onStepClick={handleStepClick}
          subNavItems={subNavItems}
          activeSubNav={activeSubNav}
          onSubChange={setActiveSubNav}
          stageStatuses={metrics?.stageStatuses}
        />
      </div>

      <div className="flex-1 min-w-0">
        {emptyState ? (
          <WorkspaceEmptyState {...emptyState} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeStepId}-${activeSubNav}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              {showingChecklistSurface ? (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-8 text-center space-y-3">
                  <ShieldCheck className="mx-auto h-8 w-8 text-accent" />
                  <h3 className="text-xl font-semibold">The checklist is now your deal command surface</h3>
                  <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                    Keep working from the persistent checklist on the left while Newton and this panel stay focused on the selected execution context.
                  </p>
                </div>
              ) : activeStepId === 'overview'
                ? <ContentComponent realDeal={realDeal} dealId={selectedDealId} isDemoDeal={isDemoDeal} seedKey={demoDealSeedKey} />
                : <ContentComponent />
              }
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="sticky top-0 self-start">
        <NewtonRail />
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

  // ── SINGLE SOURCE OF TRUTH ──
  const { metrics, loading: metricsLoading, refetch: refetchMetrics } = useDealMetrics(resolvedDealId);
  const workflow = useDealWorkflow(metrics);

  useEffect(() => {
    const fetchId = isRealDeal ? selectedDealId : DEMO_ID_MAP[selectedDealId];
    if (fetchId) {
      setLoadingDeal(true);
      supabase.from('deals').select('*').eq('id', fetchId).single()
        .then(({ data }) => { setRealDeal(data as RealDeal | null); setLoadingDeal(false); });
    } else { setRealDeal(null); setLoadingDeal(false); }
  }, [selectedDealId, isRealDeal]);

  useEffect(() => { if (!selectedDealId) setActiveSection('deals'); }, [selectedDealId]);

  useEffect(() => {
    if (!loadingDeal && realDeal && !isDemoDeal) {
      const pending = consumePendingAction();
      if (pending) {
        if (pending.type === 'ADD_STAKEHOLDER') setActiveStepId('stakeholders');
        else if (pending.type === 'ADD_WATERFALL_TIER') { setActiveStepId('deal-inputs'); setActiveSubNav('waterfall'); }
        else if (pending.type === 'UPLOAD_DOCUMENT') { setActiveStepId('deal-inputs'); setActiveSubNav('contracts'); }
      }
    }
  }, [loadingDeal, realDeal, isDemoDeal]);

  // Programmatic navigation listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.step) {
        setActiveStepId(detail.step as StepId);
        const subs = STEP_SUB_NAV[detail.step as StepId];
        setActiveSubNav(detail.sub || (subs ? subs[0].id : undefined));
      }
    };
    window.addEventListener('pivt:navigate-workspace', handler);
    return () => window.removeEventListener('pivt:navigate-workspace', handler);
  }, []);

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
  const readyPct = metrics?.readinessPercent ?? 0;

  // Compute total blockers
  const totalBlockers = useMemo(() => {
    const ss = metrics?.stageStatuses;
    if (!ss) return 0;
    return Object.values(ss).filter(s => s === 'blocked').length;
  }, [metrics]);

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
        <div className="pivt-card p-12 text-center"><p className="text-muted-foreground">Deal not found.</p></div>
      </div>
    );
  }

  return (
    <EditGuardProvider realDeal={realDeal} isDemoDeal={isDemoDeal}>
    <DealWorkspaceProvider dealId={resolvedDealId || selectedDealId} isDemoDeal={isDemoDeal} realDeal={realDeal} metrics={metrics} metricsLoading={metricsLoading} workflow={workflow} refetchMetrics={refetchMetrics}>
    <NewtonProvider currentDealId={resolvedDealId || selectedDealId}>
    <div className="space-y-5">
      {/* Back + Deal Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setActiveSection('deals')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Deals</span>
        </button>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-sm font-medium text-foreground truncate">{dealName}</span>
      </div>

      <ProtectedDealBanner />

      {/* ── Compact Deal Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-foreground truncate" style={{ letterSpacing: '-0.03em' }}>{dealName}</h1>
              {hasBlocker && (
                <Badge className="bg-blocking/10 text-blocking border-blocking/15 shrink-0 text-[10px]">
                  <Ban className="w-3 h-3 mr-1" /> Blocked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => navigator.clipboard.writeText(dealNumber)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {dealNumber}
              </button>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                dealStatus === 'active' ? 'bg-accent/10 text-accent' :
                dealStatus === 'closed' ? 'bg-validated/10 text-validated' :
                'bg-muted text-muted-foreground'
              }`}>
                {dealStatus.charAt(0).toUpperCase() + dealStatus.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{formatCurrency(dealValue)}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {closingDate || 'TBD'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Readiness pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Readiness</span>
            <span className={`font-mono text-sm font-semibold ${readyPct >= 80 ? 'text-validated' : readyPct >= 50 ? 'text-amber-500' : 'text-blocking'}`}>{readyPct}%</span>
            <div className="w-16 h-1.5 bg-muted/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${readyPct >= 80 ? 'bg-validated' : readyPct >= 50 ? 'bg-amber-400' : 'bg-blocking'}`} style={{ width: `${readyPct}%` }} />
            </div>
          </div>

          {!isDemoDeal && realDeal && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setEditDrawerOpen(true)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
          )}
          {isDemoDeal && <Badge variant="secondary" className="text-[10px]">Demo</Badge>}
          <button
            className="pivt-ai-btn flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent whitespace-nowrap rounded-lg"
            onClick={() => window.dispatchEvent(new CustomEvent('pivt:open-newton'))}
          >
            <Sparkles className="w-3.5 h-3.5 pivt-spark" />
            Newton
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <DealStatusBar
        dealStatus={dealStatus}
        readyPct={readyPct}
        totalBlockers={totalBlockers}
        metrics={metrics}
      />

      {/* ── 3-Panel Layout: Sidebar + Content ── */}
      <WorkspaceShell
        activeStepId={activeStepId}
        activeSubNav={activeSubNav}
        setActiveStepId={setActiveStepId}
        setActiveSubNav={setActiveSubNav}
        metrics={metrics}
        realDeal={realDeal}
        isDemoDeal={isDemoDeal}
        demoDealSeedKey={demoDealSeedKey}
        selectedDealId={selectedDealId}
      />

      <DealStateInspector />

      {realDeal && !isDemoDeal && (
        <EditDealDrawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen} deal={realDeal} onSaved={(updated) => setRealDeal(updated)} />
      )}
    </div>
    </NewtonProvider>
    </DealWorkspaceProvider>
    </EditGuardProvider>
  );
};
