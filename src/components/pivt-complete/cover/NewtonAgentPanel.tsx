/**
 * Newton — Chat-first AI Deal Copilot
 * Primary interaction is through the composer. Actions surface as suggestions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Shield,
} from 'lucide-react';
import { NewtonIntakePanel } from './NewtonIntakePanel';
import { NewtonWorkflowTracker, type WorkflowStage } from './newton/NewtonWorkflowTracker';
import { NewtonWorkAreaTabs } from './newton/NewtonWorkAreaTabs';
import { NewtonComposer } from './newton/NewtonComposer';
import { DealReadinessHeader } from './newton/DealReadinessHeader';
import { NewtonActivityTimeline, type ActivityEntry } from './newton/NewtonActivityTimeline';
import { Badge } from '@/components/ui/badge';
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

// ─── Main Component ──────────────────────────────────────────

export const NewtonAgentPanel: React.FC = () => {
  const { dealId: contextDealId } = useDealWorkspace();
  const [allDeals, setAllDeals] = useState<DealOption[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | undefined>(contextDealId);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [activeTab, setActiveTab] = useState('stakeholders');
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
  const [localActivity, setLocalActivity] = useState<ActivityEntry[]>([]);

  const addActivity = (description: string, status: ActivityEntry['status'] = 'info') => {
    setLocalActivity(prev => [{
      id: `local-${Date.now()}`,
      description,
      timestamp: new Date(),
      status,
      source: 'user' as const,
    }, ...prev]);
  };

  useEffect(() => {
    if (contextDealId) setSelectedDealId(contextDealId);
  }, [contextDealId]);

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

  // Build blockers list
  const buildBlockers = (): string[] => {
    const blockers: string[] = [];
    if (counts.unverified > 0) blockers.push(`${counts.unverified} stakeholders missing KYC`);
    if (counts.pendingWires > 0) blockers.push(`${counts.pendingWires} wire instructions pending`);
    if (counts.pendingApprovals > 0) blockers.push(`${counts.pendingApprovals} approvals outstanding`);
    if (counts.openDiscrepancies > 0) blockers.push(`${counts.openDiscrepancies} unresolved discrepancies`);
    if (counts.taxForms > 0 && counts.taxComplete < counts.taxForms) blockers.push(`${counts.taxForms - counts.taxComplete} tax forms incomplete`);
    if (counts.obligations > 0 && counts.confirmedObligations < counts.obligations) blockers.push(`${counts.obligations - counts.confirmedObligations} obligations unconfirmed`);
    if (counts.stakeholders === 0) blockers.push('No stakeholders imported');
    if (counts.documents === 0) blockers.push('No documents uploaded');
    if (counts.wires === 0) blockers.push('No wire instructions on file');
    return blockers;
  };

  // Build recommended next actions
  const buildRecommendations = (): { label: string; prompt: string }[] => {
    const recs: { label: string; prompt: string }[] = [];
    if (counts.stakeholders === 0) recs.push({ label: 'Import stakeholder spreadsheet', prompt: 'Import stakeholder spreadsheet' });
    if (counts.unverified > 0) recs.push({ label: 'Generate KYC/KYB requests', prompt: 'Generate KYC/KYB requests' });
    if (counts.documents === 0) recs.push({ label: 'Upload deal documents', prompt: 'Upload deal documents' });
    if (counts.documents > 0 && counts.parsedDocs < counts.documents) recs.push({ label: 'Review uploaded documents', prompt: 'Review deal documents' });
    if (counts.wires === 0) recs.push({ label: 'Upload wire instructions', prompt: 'Upload wire instructions' });
    if (counts.pendingWires > 0) recs.push({ label: 'Match wire instructions', prompt: 'Match wire instructions' });
    if (counts.taxForms > 0 && counts.taxComplete < counts.taxForms) recs.push({ label: 'Review tax forms', prompt: 'Review tax forms' });
    if (counts.approvals === 0 && counts.stakeholders > 0) recs.push({ label: 'Prepare approval package', prompt: 'Prepare approval package' });
    if (counts.pendingApprovals > 0) recs.push({ label: 'Send approvals via DocuSign', prompt: 'Send approvals via DocuSign' });
    if (counts.openDiscrepancies > 0) recs.push({ label: 'Resolve discrepancies', prompt: 'Review discrepancies' });
    if (counts.obligations > 0 && counts.confirmedObligations < counts.obligations) recs.push({ label: 'Confirm payment obligations', prompt: 'Review payment obligations' });
    if (recs.length === 0 && counts.stakeholders > 0) recs.push({ label: 'Check closing readiness', prompt: 'Check closing readiness' });
    return recs.slice(0, 4);
  };

  // Closing readiness %
  const calcReadiness = (): number => {
    const { stakeholders, verified, documents, parsedDocs, wires, pendingWires, approvals, completedApprovals, taxForms, taxComplete } = counts;
    const intakePct = stakeholders > 0 ? Math.min(100, Math.round(((stakeholders > 0 ? 40 : 0) + (documents > 0 ? 30 : 0) + (wires > 0 ? 30 : 0)))) : 0;
    const verPct = stakeholders > 0 ? Math.round((verified / stakeholders) * 100) : 0;
    const docPct = documents > 0 ? Math.round((parsedDocs / documents) * 100) : 0;
    const appPct = approvals > 0 ? Math.round((completedApprovals / approvals) * 100) : 0;
    const execPct = Math.round(((wires > 0 && pendingWires === 0 ? 50 : 0) + (taxForms > 0 && taxComplete === taxForms ? 50 : wires > 0 ? 25 : 0)));
    return Math.round([intakePct, verPct, docPct, appPct, execPct].reduce((s, v) => s + v, 0) / 5);
  };

  // Build workflow stages
  const buildStages = (): WorkflowStage[] => {
    const { stakeholders, verified, documents, parsedDocs, wires, pendingWires, approvals, completedApprovals, pendingApprovals, taxForms, taxComplete, openDiscrepancies, obligations, confirmedObligations } = counts;
    const intakePct = stakeholders > 0 ? Math.min(100, Math.round(((stakeholders > 0 ? 40 : 0) + (documents > 0 ? 30 : 0) + (wires > 0 ? 30 : 0)))) : 0;
    const verPct = stakeholders > 0 ? Math.round((verified / stakeholders) * 100) : 0;
    const docPct = documents > 0 ? Math.round((parsedDocs / documents) * 100) : 0;
    const appPct = approvals > 0 ? Math.round((completedApprovals / approvals) * 100) : 0;
    const execPct = Math.round(((wires > 0 && pendingWires === 0 ? 50 : 0) + (taxForms > 0 && taxComplete === taxForms ? 50 : wires > 0 ? 25 : 0)));
    const closePct = [intakePct, verPct, docPct, appPct, execPct].every(p => p === 100) ? 100 : Math.round([intakePct, verPct, docPct, appPct, execPct].reduce((s, v) => s + v, 0) / 5);
    return [
      { key: 'intake', label: 'Intake', icon: Sparkles, status: intakePct === 100 ? 'complete' : intakePct > 0 ? 'in_progress' : 'not_started', pct: intakePct, subtitle: `${stakeholders} stakeholders, ${documents} docs, ${wires} wires` },
      { key: 'verification', label: 'Verification', icon: Shield, status: verPct === 100 ? 'complete' : verPct > 0 ? 'in_progress' : 'not_started', pct: verPct, subtitle: `${verified}/${stakeholders} verified`, blockers: stakeholders > 0 && verified < stakeholders ? [`${stakeholders - verified} stakeholders pending KYC`] : [] },
      { key: 'documents', label: 'Doc Review', icon: Sparkles, status: docPct === 100 ? 'complete' : documents > 0 ? 'in_progress' : 'not_started', pct: docPct, subtitle: `${parsedDocs}/${documents} parsed`, blockers: obligations > 0 && confirmedObligations < obligations ? [`${obligations - confirmedObligations} obligations unconfirmed`] : [] },
      { key: 'approvals', label: 'Approvals', icon: CheckCircle2, status: appPct === 100 ? 'complete' : pendingApprovals > 0 ? 'in_progress' : approvals === 0 ? 'not_started' : 'complete', pct: appPct, subtitle: `${completedApprovals}/${approvals} signed`, blockers: pendingApprovals > 0 ? [`${pendingApprovals} signatures outstanding`] : [] },
      { key: 'execution', label: 'Exec Prep', icon: Sparkles, status: execPct === 100 ? 'complete' : execPct > 0 ? 'in_progress' : 'not_started', pct: execPct, subtitle: openDiscrepancies > 0 ? `${openDiscrepancies} open issues` : wires > 0 ? 'Wire data on file' : 'Waiting on data', blockers: openDiscrepancies > 0 ? [`${openDiscrepancies} unresolved discrepancies`] : [] },
      { key: 'close', label: 'Ready to Close', icon: CheckCircle2, status: closePct === 100 ? 'complete' : closePct >= 80 ? 'in_progress' : 'not_started', pct: closePct, subtitle: closePct === 100 ? 'All pre-conditions met' : `${closePct}% overall readiness` },
    ];
  };

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
    } catch {
      toast.error('Failed to run analysis');
    } finally {
      setIsRunning(false);
    }
  };

  const handleComposerSubmit = (prompt: string) => {
    const lower = prompt.toLowerCase();
    addActivity(`User: "${prompt}"`, 'info');
    if (lower.includes('prepare deal for closing') || lower.includes('closing readiness') || lower.includes('full review')) {
      handleRunAnalysis();
      setActiveTab('execution');
      addActivity('Running full deal review…', 'info');
      toast.info('Running full deal review…', { description: 'Newton is checking stakeholders, documents, wires, tax, and approvals.' });
    } else if (lower.includes('import') || lower.includes('upload') || lower.includes('spreadsheet')) {
      setShowIntake(true);
      addActivity('Opened file intake panel', 'info');
    } else if (lower.includes('kyc') || lower.includes('kyb') || lower.includes('verification')) {
      setActiveTab('stakeholders');
      addActivity('Navigated to stakeholder verification', 'info');
    } else if (lower.includes('funds flow') || lower.includes('payout')) {
      setActiveTab('funds_flow');
      addActivity('Navigated to funds flow review', 'info');
    } else if (lower.includes('wire')) {
      setActiveTab('wire');
      addActivity('Navigated to wire instructions', 'info');
    } else if (lower.includes('tax')) {
      setActiveTab('tax');
      addActivity('Navigated to tax forms', 'info');
    } else if (lower.includes('approval') || lower.includes('docusign') || lower.includes('signature')) {
      setActiveTab('approvals');
      addActivity('Navigated to approvals', 'info');
    } else if (lower.includes('ready') || lower.includes('execution') || lower.includes('close') || lower.includes('blocker')) {
      setActiveTab('execution');
      addActivity('Checking execution readiness', 'info');
    } else if (lower.includes('analysis') || lower.includes('scan') || lower.includes('discrepan')) {
      handleRunAnalysis();
      addActivity('Started deal analysis', 'info');
    } else if (lower.includes('document') || lower.includes('agreement') || lower.includes('obligation')) {
      setActiveTab('documents');
      addActivity('Navigated to document review', 'info');
    } else {
      toast.info('Newton received your request', { description: `Processing: "${prompt}"` });
    }
  };

  const handleStageClick = (key: string) => {
    const tabMap: Record<string, string> = {
      intake: 'stakeholders', verification: 'stakeholders', documents: 'documents',
      approvals: 'approvals', execution: 'execution', close: 'execution',
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

  const readinessPct = calcReadiness();
  const blockers = buildBlockers();

  return (
    <div className="space-y-4">
      {/* ── Deal Readiness Header ── */}
      <DealReadinessHeader
        deals={allDeals}
        selectedDealId={selectedDealId}
        onSelectDeal={(id) => { setSelectedDealId(id); setShowIntake(false); }}
        dealState={selectedDeal?.deal_state}
        readinessPct={readinessPct}
        blockers={blockers}
        lastUpdated={lastUpdated}
        onRefresh={fetchCounts}
      />

      {/* ── Chat Composer (Primary Interaction) ── */}
      <NewtonComposer
        onSubmit={handleComposerSubmit}
        disabled={!selectedDealId}
        onUploadClick={() => setShowIntake(!showIntake)}
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

      {/* ── Newton Activity Timeline ── */}
      <NewtonActivityTimeline dealId={selectedDealId || null} localEntries={localActivity} />

      {/* ── Workflow Tracker (compact) ── */}
      <NewtonWorkflowTracker stages={buildStages()} onStageClick={handleStageClick} />

      {/* ── Work Area Tabs ── */}
      <NewtonWorkAreaTabs
        dealId={selectedDealId || null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onComposerAction={handleComposerSubmit}
      />
    </div>
  );
};
