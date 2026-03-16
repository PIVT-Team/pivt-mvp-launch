/**
 * Newton — Actionable Deal Copilot & Workflow Orchestrator
 * Upload files, trigger actions, review outputs, manage approvals, track execution readiness.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Sparkles, Upload, FileSpreadsheet, Play, Send as SendIcon,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock,
  Users, FileText, DollarSign, Landmark, Receipt, CheckSquare, Shield,
  ChevronDown, RefreshCw, ArrowRight, Zap, Search, PenSquare,
} from 'lucide-react';
import { NewtonIntakePanel } from './NewtonIntakePanel';
import { NewtonWorkflowTracker, type WorkflowStage } from './newton/NewtonWorkflowTracker';
import { NewtonWorkAreaTabs } from './newton/NewtonWorkAreaTabs';
import { NewtonComposer } from './newton/NewtonComposer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────

interface DealOption {
  id: string;
  deal_name: string;
  deal_number: string;
  status: string;
  is_demo: boolean;
  deal_state: string;
}

interface DealCounts {
  stakeholders: number;
  verified: number;
  unverified: number;
  needsReview: number;
  documents: number;
  parsedDocs: number;
  wires: number;
  pendingWires: number;
  approvals: number;
  pendingApprovals: number;
  completedApprovals: number;
  taxForms: number;
  taxComplete: number;
  discrepancies: number;
  openDiscrepancies: number;
  obligations: number;
  confirmedObligations: number;
}

// ─── Deal Selector ───────────────────────────────────────────

const DealSelector: React.FC<{
  deals: DealOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading: boolean;
}> = ({ deals, selectedId, onSelect, loading }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">Deal:</span>
    <select
      value={selectedId || ''}
      onChange={(e) => onSelect(e.target.value)}
      disabled={loading || deals.length === 0}
      className="flex-1 h-8 rounded-lg border border-border bg-card px-2.5 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 appearance-none cursor-pointer truncate"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
    >
      {deals.length === 0 && <option value="">No deals available</option>}
      {deals.filter(d => d.is_demo).length > 0 && (
        <optgroup label="Demo Deals">
          {deals.filter(d => d.is_demo).map(d => (
            <option key={d.id} value={d.id}>{d.deal_name} ({d.deal_number})</option>
          ))}
        </optgroup>
      )}
      {deals.filter(d => !d.is_demo).length > 0 && (
        <optgroup label="Your Deals">
          {deals.filter(d => !d.is_demo).map(d => (
            <option key={d.id} value={d.id}>{d.deal_name} ({d.deal_number})</option>
          ))}
        </optgroup>
      )}
    </select>
  </div>
);

// ─── Primary Action Bar ──────────────────────────────────────

const PrimaryActionBar: React.FC<{
  onUpload: () => void;
  onRunAnalysis: () => void;
  onPrepareApprovals: () => void;
  isRunning: boolean;
}> = ({ onUpload, onRunAnalysis, onPrepareApprovals, isRunning }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <Button size="sm" variant="outline" onClick={onUpload} className="gap-1.5 text-xs h-8">
      <Upload className="w-3 h-3" /> Upload Files
    </Button>
    <Button size="sm" variant="outline" onClick={onUpload} className="gap-1.5 text-xs h-8">
      <FileSpreadsheet className="w-3 h-3" /> Import Spreadsheet
    </Button>
    <Button size="sm" variant="outline" onClick={onRunAnalysis} disabled={isRunning} className="gap-1.5 text-xs h-8">
      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
      Run Analysis
    </Button>
    <Button size="sm" variant="outline" onClick={onPrepareApprovals} className="gap-1.5 text-xs h-8">
      <CheckSquare className="w-3 h-3" /> Prepare Approvals
    </Button>
    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
      <PenSquare className="w-3 h-3" /> Send via DocuSign
    </Button>
  </div>
);

// ─── Quick Action Cards ──────────────────────────────────────

const QUICK_ACTIONS = [
  { key: 'import_stakeholders', label: 'Import stakeholder data', icon: Users, tab: 'stakeholders', color: 'text-accent' },
  { key: 'review_docs', label: 'Review uploaded documents', icon: FileText, tab: 'documents', color: 'text-blue-500' },
  { key: 'kyc_requests', label: 'Generate KYC/KYB requests', icon: Shield, tab: 'stakeholders', color: 'text-validated' },
  { key: 'parse_funds', label: 'Parse funds flow', icon: DollarSign, tab: 'funds_flow', color: 'text-emerald-500' },
  { key: 'match_wires', label: 'Match wire instructions', icon: Landmark, tab: 'wire', color: 'text-blue-500' },
  { key: 'review_tax', label: 'Review tax forms', icon: Receipt, tab: 'tax', color: 'text-amber-500' },
  { key: 'extract_obligations', label: 'Extract payment obligations', icon: FileText, tab: 'documents', color: 'text-accent' },
  { key: 'prepare_approvals', label: 'Prepare approvals', icon: CheckSquare, tab: 'approvals', color: 'text-validated' },
  { key: 'send_docusign', label: 'Send approvals via DocuSign', icon: SendIcon, tab: 'approvals', color: 'text-blue-500' },
  { key: 'closing_readiness', label: 'Assess closing readiness', icon: Shield, tab: 'execution', color: 'text-validated' },
];

const QuickActionCards: React.FC<{
  onAction: (key: string, tab: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ onAction, collapsed, onToggle }) => (
  <div className="pivt-card border border-border overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Quick Actions</span>
      </div>
      <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', !collapsed && 'rotate-180')} />
    </button>
    <AnimatePresence>
      {!collapsed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-1.5 p-3 pt-0">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.key}
                onClick={() => onAction(action.key, action.tab)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:border-accent/20 hover:bg-accent/3 transition-all text-left group"
              >
                <action.icon className={cn('w-3.5 h-3.5 shrink-0', action.color)} />
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground">{action.label}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-accent ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ─── Main Component ──────────────────────────────────────────

export const NewtonAgentPanel: React.FC = () => {
  const { dealId: contextDealId } = useDealWorkspace();
  const [allDeals, setAllDeals] = useState<DealOption[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | undefined>(contextDealId);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [activeTab, setActiveTab] = useState('stakeholders');
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(false);
  const [counts, setCounts] = useState<DealCounts>({
    stakeholders: 0, verified: 0, unverified: 0, needsReview: 0,
    documents: 0, parsedDocs: 0,
    wires: 0, pendingWires: 0,
    approvals: 0, pendingApprovals: 0, completedApprovals: 0,
    taxForms: 0, taxComplete: 0,
    discrepancies: 0, openDiscrepancies: 0,
    obligations: 0, confirmedObligations: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Sync context deal id
  useEffect(() => {
    if (contextDealId) setSelectedDealId(contextDealId);
  }, [contextDealId]);

  // Fetch deals
  useEffect(() => {
    const fetchDeals = async () => {
      setDealsLoading(true);
      const { data } = await supabase
        .from('deals')
        .select('id, deal_name, deal_number, status, is_demo, deal_state')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (data) {
        setAllDeals(data as DealOption[]);
        if (!selectedDealId && data.length > 0) setSelectedDealId(data[0].id);
      }
      setDealsLoading(false);
    };
    fetchDeals();
  }, []);

  // Fetch real counts for the selected deal
  const fetchCounts = useCallback(async () => {
    if (!selectedDealId) return;
    const [sRes, dRes, wRes, aRes, tRes, discRes, oblRes] = await Promise.all([
      supabase.from('cap_table_entries').select('id, verification_status, needs_review', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('contract_documents').select('id, status', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('wire_instructions').select('id, verification_status', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('deal_approvals').select('id, status', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('tax_forms').select('id, status', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('discrepancies').select('id, status', { count: 'exact' }).eq('deal_id', selectedDealId),
      supabase.from('obligations').select('id, status', { count: 'exact' }).eq('deal_id', selectedDealId),
    ]);

    const stk = sRes.data || [];
    const docs = dRes.data || [];
    const wires = wRes.data || [];
    const apprs = aRes.data || [];
    const taxes = tRes.data || [];
    const discs = discRes.data || [];
    const obls = oblRes.data || [];

    setCounts({
      stakeholders: stk.length,
      verified: stk.filter((s: any) => s.verification_status === 'verified').length,
      unverified: stk.filter((s: any) => s.verification_status !== 'verified').length,
      needsReview: stk.filter((s: any) => s.needs_review).length,
      documents: docs.length,
      parsedDocs: docs.filter((d: any) => d.status === 'parsed').length,
      wires: wires.length,
      pendingWires: wires.filter((w: any) => w.verification_status === 'pending').length,
      approvals: apprs.length,
      pendingApprovals: apprs.filter((a: any) => a.status === 'pending').length,
      completedApprovals: apprs.filter((a: any) => a.status === 'completed').length,
      taxForms: taxes.length,
      taxComplete: taxes.filter((t: any) => ['received', 'verified', 'satisfied'].includes(t.status)).length,
      discrepancies: discs.length,
      openDiscrepancies: discs.filter((d: any) => d.status === 'open').length,
      obligations: obls.length,
      confirmedObligations: obls.filter((o: any) => o.status === 'CONFIRMED').length,
    });
    setLastUpdated(new Date());
  }, [selectedDealId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Build workflow stages from real counts
  const buildStages = (): WorkflowStage[] => {
    const { stakeholders, verified, documents, parsedDocs, wires, pendingWires, approvals, completedApprovals, pendingApprovals, taxForms, taxComplete, openDiscrepancies, obligations, confirmedObligations } = counts;

    const intakePct = stakeholders > 0 ? Math.min(100, Math.round(((stakeholders > 0 ? 40 : 0) + (documents > 0 ? 30 : 0) + (wires > 0 ? 30 : 0)))) : 0;
    const verPct = stakeholders > 0 ? Math.round((verified / stakeholders) * 100) : 0;
    const docPct = documents > 0 ? Math.round((parsedDocs / documents) * 100) : 0;
    const appPct = approvals > 0 ? Math.round((completedApprovals / approvals) * 100) : 0;
    const execPct = Math.round(((wires > 0 && pendingWires === 0 ? 50 : 0) + (taxForms > 0 && taxComplete === taxForms ? 50 : wires > 0 ? 25 : 0)));
    const closePct = [intakePct, verPct, docPct, appPct, execPct].every(p => p === 100) ? 100
      : Math.round([intakePct, verPct, docPct, appPct, execPct].reduce((s, v) => s + v, 0) / 5);

    return [
      {
        key: 'intake', label: 'Intake', icon: Upload,
        status: intakePct === 100 ? 'complete' : intakePct > 0 ? 'in_progress' : 'not_started',
        pct: intakePct,
        subtitle: `${stakeholders} stakeholders, ${documents} docs, ${wires} wires`,
      },
      {
        key: 'verification', label: 'Verification', icon: Shield,
        status: verPct === 100 ? 'complete' : verPct > 0 ? 'in_progress' : 'not_started',
        pct: verPct,
        subtitle: `${verified}/${stakeholders} verified`,
        blockers: stakeholders > 0 && verified < stakeholders ? [`${stakeholders - verified} stakeholders pending KYC`] : [],
      },
      {
        key: 'documents', label: 'Doc Review', icon: FileText,
        status: docPct === 100 ? 'complete' : documents > 0 ? 'in_progress' : 'not_started',
        pct: docPct,
        subtitle: `${parsedDocs}/${documents} parsed`,
        blockers: obligations > 0 && confirmedObligations < obligations ? [`${obligations - confirmedObligations} obligations unconfirmed`] : [],
      },
      {
        key: 'approvals', label: 'Approvals', icon: CheckSquare,
        status: appPct === 100 ? 'complete' : pendingApprovals > 0 ? 'in_progress' : approvals === 0 ? 'not_started' : 'complete',
        pct: appPct,
        subtitle: `${completedApprovals}/${approvals} signed`,
        blockers: pendingApprovals > 0 ? [`${pendingApprovals} signatures outstanding`] : [],
      },
      {
        key: 'execution', label: 'Exec Prep', icon: Zap,
        status: execPct === 100 ? 'complete' : execPct > 0 ? 'in_progress' : 'not_started',
        pct: execPct,
        subtitle: openDiscrepancies > 0 ? `${openDiscrepancies} open issues` : wires > 0 ? 'Wire data on file' : 'Waiting on data',
        blockers: openDiscrepancies > 0 ? [`${openDiscrepancies} unresolved discrepancies`] : [],
      },
      {
        key: 'close', label: 'Ready to Close', icon: CheckCircle2,
        status: closePct === 100 ? 'complete' : closePct >= 80 ? 'in_progress' : 'not_started',
        pct: closePct,
        subtitle: closePct === 100 ? 'All pre-conditions met' : `${closePct}% overall readiness`,
      },
    ];
  };

  // Run full analysis
  const handleRunAnalysis = async () => {
    if (!selectedDealId || isRunning) return;
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('funds-flow-agent', { body: { deal_id: selectedDealId } });
      if (error || (data && !data.success)) {
        toast.error('Analysis failed', { description: data?.error || error?.message });
      } else {
        toast.success('Analysis complete', { description: `${data?.finding_count || 0} findings detected.` });
      }
      await fetchCounts();
    } catch (e) {
      toast.error('Failed to run analysis');
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickAction = (key: string, tab: string) => {
    if (key === 'import_stakeholders' || key === 'parse_funds' || key === 'match_wires') {
      setShowIntake(true);
    }
    setActiveTab(tab);
  };

  const handleComposerSubmit = (prompt: string) => {
    // Map common prompts to actions
    const lower = prompt.toLowerCase();
    if (lower.includes('import') || lower.includes('upload') || lower.includes('spreadsheet')) {
      setShowIntake(true);
      toast.info('Open the intake panel to upload files', { description: 'Use Newton Intake to upload and process your documents.' });
    } else if (lower.includes('kyc') || lower.includes('kyb') || lower.includes('verification')) {
      setActiveTab('stakeholders');
      toast.info('Navigate to Stakeholders tab to manage KYC/KYB');
    } else if (lower.includes('funds flow') || lower.includes('payout')) {
      setActiveTab('funds_flow');
    } else if (lower.includes('wire')) {
      setActiveTab('wire');
    } else if (lower.includes('tax')) {
      setActiveTab('tax');
    } else if (lower.includes('approval') || lower.includes('docusign') || lower.includes('signature')) {
      setActiveTab('approvals');
    } else if (lower.includes('ready') || lower.includes('execution') || lower.includes('close') || lower.includes('blocker')) {
      setActiveTab('execution');
    } else if (lower.includes('analysis') || lower.includes('scan') || lower.includes('discrepan')) {
      handleRunAnalysis();
    } else {
      toast.info('Newton received your request', { description: `Processing: "${prompt}"` });
    }
  };

  const handleStageClick = (key: string) => {
    const tabMap: Record<string, string> = {
      intake: 'stakeholders',
      verification: 'stakeholders',
      documents: 'documents',
      approvals: 'approvals',
      execution: 'execution',
      close: 'execution',
    };
    setActiveTab(tabMap[key] || 'stakeholders');
  };

  const selectedDeal = allDeals.find(d => d.id === selectedDealId);

  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Newton</h2>
            <p className="text-[10px] text-muted-foreground">
              Deal copilot — upload, review, approve, execute
            </p>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1.5">
              <button onClick={fetchCounts} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Refresh data">
                <RefreshCw className="w-3 h-3 text-muted-foreground" />
              </button>
              <span className="text-[9px] font-mono text-muted-foreground">
                {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <DealSelector
              deals={allDeals}
              selectedId={selectedDealId}
              onSelect={(id) => { setSelectedDealId(id); setShowIntake(false); }}
              loading={dealsLoading}
            />
          </div>
          {selectedDeal && (
            <Badge variant="outline" className="text-[9px] px-2 shrink-0">
              {selectedDeal.deal_state?.replace(/_/g, ' ') || selectedDeal.status}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Primary Action Bar ── */}
      <PrimaryActionBar
        onUpload={() => setShowIntake(!showIntake)}
        onRunAnalysis={handleRunAnalysis}
        onPrepareApprovals={() => setActiveTab('approvals')}
        isRunning={isRunning}
      />

      {/* ── Newton Intake Panel (toggled) ── */}
      <AnimatePresence>
        {showIntake && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <NewtonIntakePanel
              dealId={selectedDealId || null}
              onComplete={() => { fetchCounts(); setShowIntake(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Workflow Tracker ── */}
      <NewtonWorkflowTracker stages={buildStages()} onStageClick={handleStageClick} />

      {/* ── Quick Actions ── */}
      <QuickActionCards
        onAction={handleQuickAction}
        collapsed={quickActionsCollapsed}
        onToggle={() => setQuickActionsCollapsed(!quickActionsCollapsed)}
      />

      {/* ── Work Area Tabs ── */}
      <NewtonWorkAreaTabs
        dealId={selectedDealId || null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ── Composer ── */}
      <NewtonComposer
        onSubmit={handleComposerSubmit}
        disabled={!selectedDealId}
      />
    </div>
  );
};
