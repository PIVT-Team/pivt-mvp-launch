/**
 * Newton — Operational AI Copilot
 * Intent -> action -> shared state update -> visible confirmation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePIVTStore } from '@/stores/pivtStore';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Sparkles, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Shield, Globe, Briefcase,
} from 'lucide-react';
import { NewtonIntakePanel } from './NewtonIntakePanel';
import { NewtonWorkflowTracker, type WorkflowStage } from './newton/NewtonWorkflowTracker';
import { NewtonWorkAreaTabs } from './newton/NewtonWorkAreaTabs';
import { NewtonComposer } from './newton/NewtonComposer';
import { DealReadinessHeader } from './newton/DealReadinessHeader';
import { NewtonActivityTimeline, type ActivityEntry } from './newton/NewtonActivityTimeline';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { NewtonCreateDealForm, type NewtonCreateDealPayload } from '@/components/newton/NewtonCreateDealForm';
import {
  detectIntent,
  executeCreateDeal,
  executeSummarizeReadiness,
  executeListBlockers,
  executeGenerateKycRequests,
  executePrepareApprovalPackage,
  executeListDeals,
  SUPPORTED_ACTIONS_TEXT,
  type NewtonActionResult,
} from '@/services/newtonActionService';

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

interface ActionOutput {
  status: 'info' | 'success' | 'error';
  title: string;
  message: string;
}

const stripMarkdown = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\|/g, ' ')
    .split('\n')
    .find((line) => line.trim().length > 0)?.trim() || 'Action completed';

export const NewtonAgentPanel: React.FC = () => {
  const { dealId: contextDealId } = useDealWorkspace();
  const { user } = useAuth();
  const setStoreActiveSection = usePIVTStore((s) => s.setActiveSection);
  const setStoreSelectedDealId = usePIVTStore((s) => s.setSelectedDealId);

  const [allDeals, setAllDeals] = useState<DealOption[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | undefined>(contextDealId);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showCreateDealForm, setShowCreateDealForm] = useState(false);
  const [createDealPrefill, setCreateDealPrefill] = useState<Partial<NewtonCreateDealPayload>>({});
  const [operationMode, setOperationMode] = useState<'global' | 'deal'>(contextDealId ? 'deal' : 'global');
  const [activeTab, setActiveTab] = useState('stakeholders');
  const [actionOutput, setActionOutput] = useState<ActionOutput | null>(null);
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

  const addActivity = useCallback((description: string, status: ActivityEntry['status'] = 'info') => {
    setLocalActivity((prev) => [{
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description,
      timestamp: new Date(),
      status,
      source: 'user' as const,
    }, ...prev]);
  }, []);

  const pushOutput = useCallback((status: ActionOutput['status'], title: string, message: string) => {
    setActionOutput({ status, title, message });
  }, []);

  useEffect(() => {
    if (contextDealId) {
      setSelectedDealId(contextDealId);
      setStoreSelectedDealId(contextDealId);
      setOperationMode('deal');
    }
  }, [contextDealId, setStoreSelectedDealId]);

  const fetchDeals = useCallback(async () => {
    setDealsLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('id, deal_name, deal_number, status, is_demo, deal_state')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (data) {
      const typed = data as DealOption[];
      setAllDeals(typed);
      setSelectedDealId((prev) => prev || typed[0]?.id);
    }
    setDealsLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

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

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

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

  const calcReadiness = (): number => {
    const { stakeholders, verified, documents, parsedDocs, wires, pendingWires, approvals, completedApprovals, taxForms, taxComplete } = counts;
    const intakePct = stakeholders > 0
      ? Math.min(100, Math.round(((stakeholders > 0 ? 40 : 0) + (documents > 0 ? 30 : 0) + (wires > 0 ? 30 : 0))))
      : 0;
    const verPct = stakeholders > 0 ? Math.round((verified / stakeholders) * 100) : 0;
    const docPct = documents > 0 ? Math.round((parsedDocs / documents) * 100) : 0;
    const appPct = approvals > 0 ? Math.round((completedApprovals / approvals) * 100) : 0;
    const execPct = Math.round(((wires > 0 && pendingWires === 0 ? 50 : 0) + (taxForms > 0 && taxComplete === taxForms ? 50 : wires > 0 ? 25 : 0)));
    return Math.round([intakePct, verPct, docPct, appPct, execPct].reduce((s, v) => s + v, 0) / 5);
  };

  const buildStages = (): WorkflowStage[] => {
    const {
      stakeholders, verified, documents, parsedDocs, wires, pendingWires,
      approvals, completedApprovals, pendingApprovals, taxForms, taxComplete,
      openDiscrepancies, obligations, confirmedObligations,
    } = counts;

    const intakePct = stakeholders > 0
      ? Math.min(100, Math.round(((stakeholders > 0 ? 40 : 0) + (documents > 0 ? 30 : 0) + (wires > 0 ? 30 : 0))))
      : 0;
    const verPct = stakeholders > 0 ? Math.round((verified / stakeholders) * 100) : 0;
    const docPct = documents > 0 ? Math.round((parsedDocs / documents) * 100) : 0;
    const appPct = approvals > 0 ? Math.round((completedApprovals / approvals) * 100) : 0;
    const execPct = Math.round(((wires > 0 && pendingWires === 0 ? 50 : 0) + (taxForms > 0 && taxComplete === taxForms ? 50 : wires > 0 ? 25 : 0)));
    const closePct = [intakePct, verPct, docPct, appPct, execPct].every((p) => p === 100)
      ? 100
      : Math.round([intakePct, verPct, docPct, appPct, execPct].reduce((s, v) => s + v, 0) / 5);

    return [
      { key: 'intake', label: 'Intake', icon: Sparkles, status: intakePct === 100 ? 'complete' : intakePct > 0 ? 'in_progress' : 'not_started', pct: intakePct, subtitle: `${stakeholders} stakeholders, ${documents} docs, ${wires} wires` },
      { key: 'verification', label: 'Verification', icon: Shield, status: verPct === 100 ? 'complete' : verPct > 0 ? 'in_progress' : 'not_started', pct: verPct, subtitle: `${verified}/${stakeholders} verified`, blockers: stakeholders > 0 && verified < stakeholders ? [`${stakeholders - verified} stakeholders pending KYC`] : [] },
      { key: 'documents', label: 'Doc Review', icon: Sparkles, status: docPct === 100 ? 'complete' : documents > 0 ? 'in_progress' : 'not_started', pct: docPct, subtitle: `${parsedDocs}/${documents} parsed`, blockers: obligations > 0 && confirmedObligations < obligations ? [`${obligations - confirmedObligations} obligations unconfirmed`] : [] },
      { key: 'approvals', label: 'Approvals', icon: CheckCircle2, status: appPct === 100 ? 'complete' : pendingApprovals > 0 ? 'in_progress' : approvals === 0 ? 'not_started' : 'complete', pct: appPct, subtitle: `${completedApprovals}/${approvals} signed`, blockers: pendingApprovals > 0 ? [`${pendingApprovals} signatures outstanding`] : [] },
      { key: 'execution', label: 'Exec Prep', icon: Sparkles, status: execPct === 100 ? 'complete' : execPct > 0 ? 'in_progress' : 'not_started', pct: execPct, subtitle: openDiscrepancies > 0 ? `${openDiscrepancies} open issues` : wires > 0 ? 'Wire data on file' : 'Waiting on data', blockers: openDiscrepancies > 0 ? [`${openDiscrepancies} unresolved discrepancies`] : [] },
      { key: 'close', label: 'Ready to Close', icon: CheckCircle2, status: closePct === 100 ? 'complete' : closePct >= 80 ? 'in_progress' : 'not_started', pct: closePct, subtitle: closePct === 100 ? 'All pre-conditions met' : `${closePct}% overall readiness` },
    ];
  };

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedDealId || isRunning) return;

    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('funds-flow-agent', { body: { deal_id: selectedDealId } });
      if (error || (data && !data.success)) {
        toast.error('Analysis failed', { description: data?.error || error?.message });
        addActivity('Newton analysis failed', 'error');
      } else {
        toast.success('Analysis complete', { description: `${data?.finding_count || 0} findings detected.` });
        addActivity(`Newton analysis completed (${data?.finding_count || 0} findings)`, 'success');
      }
      await fetchCounts();
    } catch {
      toast.error('Failed to run analysis');
      addActivity('Newton analysis failed', 'error');
    } finally {
      setIsRunning(false);
    }
  }, [selectedDealId, isRunning, fetchCounts, addActivity]);

  const handleCreateDealSubmit = useCallback(async (payload: NewtonCreateDealPayload) => {
    setIsExecutingAction(true);
    pushOutput('info', 'Creating deal', 'Creating deal and initializing readiness baseline...');

    const result = await executeCreateDeal(payload, user?.id);

    setIsExecutingAction(false);

    if (!result.success) {
      pushOutput('error', 'Deal creation failed', result.message);
      addActivity('Newton failed to create deal', 'error');
      toast.error('Deal creation failed', { description: stripMarkdown(result.message) });
      return;
    }

    setShowCreateDealForm(false);
    setCreateDealPrefill({});

    await fetchDeals();

    if (result.data?.deal_id) {
      setSelectedDealId(result.data.deal_id);
      setStoreSelectedDealId(result.data.deal_id);
      setStoreActiveSection('workspace');
      setOperationMode('deal');
      setActiveTab('stakeholders');
    }

    pushOutput('success', 'Deal created successfully', result.message);
    addActivity(result.logEntry || `Newton created deal: ${payload.deal_name}`, 'success');
    toast.success('Deal created', { description: stripMarkdown(result.message) });
  }, [user, pushOutput, addActivity, fetchDeals, setStoreSelectedDealId, setStoreActiveSection]);

  const handleCancelCreateDeal = useCallback(() => {
    setShowCreateDealForm(false);
    setCreateDealPrefill({});
    pushOutput('info', 'Create deal cancelled', 'No problem — I can reopen the deal setup flow whenever you want.');
    addActivity('Newton create deal flow cancelled', 'info');
  }, [pushOutput, addActivity]);

  const handleComposerSubmit = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    addActivity(`User: "${trimmed}"`, 'info');

    const intent = detectIntent(trimmed);

    if (intent.action === 'unsupported' || intent.confidence < 0.5) {
      pushOutput('error', 'Action not supported yet', SUPPORTED_ACTIONS_TEXT);
      addActivity('Newton could not map request to a supported action', 'warning');
      toast.info('Action not supported yet', { description: 'Newton returned supported capabilities.' });
      return;
    }

    if (intent.scope === 'global' && operationMode !== 'global') {
      setOperationMode('global');
      addActivity('Switched to Global Workspace Mode for this request', 'info');
    }

    if (intent.action === 'create_deal') {
      const prefill = intent.params as Partial<NewtonCreateDealPayload>;
      const requiredKeys: Array<keyof NewtonCreateDealPayload> = ['deal_name', 'deal_type', 'buyer', 'closing_date', 'primary_deal_owner'];
      const missingRequired = requiredKeys.filter((k) => !prefill[k]);
      const missingSellerOrTarget = !prefill.seller && !prefill.target_company;
      const missingCount = missingRequired.length + (missingSellerOrTarget ? 1 : 0);

      setCreateDealPrefill(prefill);
      setShowCreateDealForm(true);
      pushOutput(
        'info',
        'Collecting details',
        missingCount > 0
          ? `I need **${missingCount}** more field${missingCount > 1 ? 's' : ''} to continue. Fill the form below and I will create the deal.`
          : 'I parsed your command and prefilled the form below. Confirm to create the deal.'
      );
      addActivity('Newton opened create deal workflow', 'info');
      return;
    }

    setShowCreateDealForm(false);
    setIsExecutingAction(true);
    pushOutput('info', 'Executing action', intent.scope === 'global' ? 'Executing workspace action...' : 'Executing deal action...');

    let result: NewtonActionResult;

    try {
      switch (intent.action) {
        case 'list_deals': {
          result = await executeListDeals(user?.id);
          break;
        }
        case 'upload_stakeholders':
        case 'parse_stakeholders': {
          setShowIntake(true);
          setActiveTab('stakeholders');
          result = {
            success: true,
            message: 'Stakeholder intake is open. Upload a stakeholder CSV/XLSX and Newton will parse it into the stakeholder workspace.',
            logEntry: 'Newton opened stakeholder import workflow',
          };
          break;
        }
        case 'upload_documents': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can upload documents, but first select a deal or create a new one.' };
            break;
          }
          setShowIntake(true);
          setActiveTab('documents');
          result = {
            success: true,
            message: 'Document intake is open for this deal. Upload files and Newton will route them for parsing and review.',
            logEntry: 'Newton opened document upload workflow',
          };
          break;
        }
        case 'review_documents': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can review documents, but I need a deal selected.' };
            break;
          }
          setActiveTab('documents');
          result = {
            success: true,
            message: 'Switched to document review for the active deal.',
            logEntry: 'Newton switched to document review',
          };
          break;
        }
        case 'open_wire_instructions': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can review wire instructions, but I need a deal selected.' };
            break;
          }
          setActiveTab('wire');
          result = {
            success: true,
            message: 'Switched to wire instructions workflow.',
            logEntry: 'Newton switched to wire instructions workflow',
          };
          break;
        }
        case 'open_tax_forms': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can review tax forms, but I need a deal selected.' };
            break;
          }
          setActiveTab('tax');
          result = {
            success: true,
            message: 'Switched to tax forms workflow.',
            logEntry: 'Newton switched to tax forms workflow',
          };
          break;
        }
        case 'open_approvals': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can manage approvals, but I need a deal selected.' };
            break;
          }
          setActiveTab('approvals');
          result = {
            success: true,
            message: 'Switched to approvals workflow.',
            logEntry: 'Newton switched to approvals workflow',
          };
          break;
        }
        case 'start_new_closing': {
          if (!selectedDealId) {
            result = { success: false, message: 'To start a closing workflow, select a deal or create a new one first.' };
            break;
          }
          setActiveTab('execution');
          await handleRunAnalysis();
          result = {
            success: true,
            message: 'Started closing preparation. Newton kicked off analysis and moved you to execution readiness.',
            logEntry: 'Newton started new closing workflow',
          };
          break;
        }
        case 'summarize_readiness': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can summarize readiness, but I need a deal selected.' };
            break;
          }
          setOperationMode('deal');
          result = await executeSummarizeReadiness(selectedDealId);
          break;
        }
        case 'list_blockers': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can list blockers, but I need a deal selected.' };
            break;
          }
          setOperationMode('deal');
          setActiveTab('execution');
          result = await executeListBlockers(selectedDealId);
          break;
        }
        case 'generate_kyc_requests':
        case 'generate_kyb_requests': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can generate KYC/KYB requests, but I need a deal selected.' };
            break;
          }
          setOperationMode('deal');
          setActiveTab('stakeholders');
          result = await executeGenerateKycRequests(selectedDealId, user?.id);
          break;
        }
        case 'prepare_approval_package': {
          if (!selectedDealId) {
            result = { success: false, message: 'I can prepare an approval package, but I need a deal selected.' };
            break;
          }
          setOperationMode('deal');
          setActiveTab('approvals');
          result = await executePrepareApprovalPackage(selectedDealId, user?.id);
          break;
        }
        default: {
          result = {
            success: false,
            message: SUPPORTED_ACTIONS_TEXT,
          };
        }
      }
    } catch (e) {
      result = {
        success: false,
        message: `Action failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }

    setIsExecutingAction(false);

    pushOutput(result.success ? 'success' : 'error', result.success ? 'Action completed' : 'Action needs attention', result.message);

    addActivity(
      result.logEntry || stripMarkdown(result.message),
      result.success ? 'success' : 'warning'
    );

    if (result.success) {
      toast.success('Newton action completed', { description: stripMarkdown(result.message) });
    } else {
      toast.error('Newton could not complete action', { description: stripMarkdown(result.message) });
    }

    if (result.navigateTo) {
      setStoreActiveSection(result.navigateTo as any);
    }

    if (result.data?.deal_id) {
      setSelectedDealId(result.data.deal_id);
      setStoreSelectedDealId(result.data.deal_id);
      setOperationMode('deal');
      setActiveTab('stakeholders');
    }
  }, [
    addActivity,
    user,
    pushOutput,
    operationMode,
    selectedDealId,
    handleRunAnalysis,
    setStoreActiveSection,
    setStoreSelectedDealId,
  ]);

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

  const selectedDeal = allDeals.find((d) => d.id === selectedDealId);

  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  const readinessPct = calcReadiness();
  const blockers = buildBlockers();
  const recommendations = buildRecommendations();

  return (
    <div className="space-y-4">
      <DealReadinessHeader
        deals={allDeals}
        selectedDealId={selectedDealId}
        onSelectDeal={(id) => {
          setSelectedDealId(id);
          setStoreSelectedDealId(id);
          setOperationMode('deal');
          setShowIntake(false);
          setShowCreateDealForm(false);
        }}
        onCreateNewDeal={() => {
          setOperationMode('global');
          setCreateDealPrefill({});
          setShowCreateDealForm(true);
          pushOutput('info', 'Collecting details', 'Fill in the deal details below to create a new deal.');
          addActivity('Newton opened create deal workflow via + New Deal', 'info');
        }}
        dealState={selectedDeal?.deal_state}
        readinessPct={readinessPct}
        blockers={blockers}
        recommendations={recommendations}
        lastUpdated={lastUpdated}
        onRefresh={fetchCounts}
        onAction={handleComposerSubmit}
        operationMode={operationMode}
      />

      {(isExecutingAction || isRunning) && (
        <div className="flex items-center justify-end px-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing
          </span>
        </div>
      )}

      <NewtonComposer
        onSubmit={handleComposerSubmit}
        disabled={isExecutingAction || isRunning}
        onUploadClick={() => {
          setShowIntake((prev) => !prev);
          if (selectedDealId) setOperationMode('deal');
        }}
      />

      {actionOutput && (
        <div
          className={cn(
            'rounded-xl border p-3',
            actionOutput.status === 'success' && 'border-validated/30 bg-validated/5',
            actionOutput.status === 'error' && 'border-blocking/30 bg-blocking/5',
            actionOutput.status === 'info' && 'border-accent/30 bg-accent/5',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            {actionOutput.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-validated" />}
            {actionOutput.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-blocking" />}
            {actionOutput.status === 'info' && <RefreshCw className="w-3.5 h-3.5 text-accent" />}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actionOutput.title}</span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_table]:text-xs">
            <ReactMarkdown>{actionOutput.message}</ReactMarkdown>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreateDealForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <NewtonCreateDealForm
              onSubmit={handleCreateDealSubmit}
              isLoading={isExecutingAction}
              onCancel={handleCancelCreateDeal}
              initialValues={createDealPrefill}
              currentUserLabel={user?.email || ''}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
              onComplete={() => {
                fetchCounts();
                setShowIntake(false);
                addActivity('Newton intake completed', 'success');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <NewtonActivityTimeline dealId={selectedDealId || null} localEntries={localActivity} />

      <NewtonWorkflowTracker stages={buildStages()} onStageClick={handleStageClick} />

      <NewtonWorkAreaTabs
        dealId={selectedDealId || null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onComposerAction={handleComposerSubmit}
      />
    </div>
  );
};
