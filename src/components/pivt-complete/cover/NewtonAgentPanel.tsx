/**
 * Newton — Operational AI Copilot (Redesigned Panel)
 * 380px fixed-width, full-height command interface.
 * Header → Context Bar → Chat Stream → Input Bar
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePIVTStore } from '@/stores/pivtStore';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { NewtonPanelHeader } from './newton/NewtonPanelHeader';
import { NewtonContextBar } from './newton/NewtonContextBar';
import { NewtonChatStream, type ChatMessage } from './newton/NewtonChatStream';
import { NewtonInputBar } from './newton/NewtonInputBar';
import { NewtonIntakePanel } from './NewtonIntakePanel';
import { NewtonDiscrepancyPanel, type DiscrepancyItem } from './newton/NewtonDiscrepancyPanel';
import { NewtonCreateDealForm, type NewtonCreateDealPayload } from '@/components/newton/NewtonCreateDealForm';
import {
  detectIntent,
  executeCreateDeal,
  executeSummarizeReadiness,
  executeListBlockers,
  executeGenerateKycRequests,
  executePrepareApprovalPackage,
  executeListDeals,
  executeParseFundsFlow,
  executeRunDiscrepancyCheck,
  SUPPORTED_ACTIONS_TEXT,
  type NewtonActionResult,
} from '@/services/newtonActionService';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton-action`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callNewtonAction(action: string, params: Record<string, any>): Promise<NewtonActionResult> {
  try {
    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ action, params }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) return { success: false, message: data.error || data.message || `Action failed (${resp.status})` };
    return { success: true, message: data.message || 'Action completed.', data };
  } catch (e) {
    return { success: false, message: `Network error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

interface DealOption {
  id: string;
  deal_name: string;
  deal_number: string;
  status: string;
  is_demo: boolean;
  deal_state: string;
}

interface DealCounts {
  stakeholders: number; verified: number; unverified: number; needsReview: number;
  documents: number; parsedDocs: number;
  wires: number; pendingWires: number;
  approvals: number; pendingApprovals: number; completedApprovals: number;
  taxForms: number; taxComplete: number;
  discrepancies: number; openDiscrepancies: number;
  obligations: number; confirmedObligations: number;
}

const uid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const NewtonAgentPanel: React.FC = () => {
  const { dealId: contextDealId } = useDealWorkspace();
  const { user } = useAuth();
  const setStoreActiveSection = usePIVTStore((s) => s.setActiveSection);
  const setStoreSelectedDealId = usePIVTStore((s) => s.setSelectedDealId);

  const [allDeals, setAllDeals] = useState<DealOption[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | undefined>(contextDealId);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showCreateDealForm, setShowCreateDealForm] = useState(false);
  const [showDiscrepancyPanel, setShowDiscrepancyPanel] = useState(false);
  const [discrepancyItems, setDiscrepancyItems] = useState<DiscrepancyItem[]>([]);
  const [createDealPrefill, setCreateDealPrefill] = useState<Partial<NewtonCreateDealPayload>>({});
  const [operationMode, setOperationMode] = useState<'global' | 'deal'>(contextDealId ? 'deal' : 'global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [counts, setCounts] = useState<DealCounts>({
    stakeholders: 0, verified: 0, unverified: 0, needsReview: 0,
    documents: 0, parsedDocs: 0, wires: 0, pendingWires: 0,
    approvals: 0, pendingApprovals: 0, completedApprovals: 0,
    taxForms: 0, taxComplete: 0, discrepancies: 0, openDiscrepancies: 0,
    obligations: 0, confirmedObligations: 0,
  });

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: uid(), timestamp: new Date() }]);
  }, []);

  const removeLoading = useCallback(() => {
    setMessages(prev => prev.filter(m => m.type !== 'loading'));
  }, []);

  // ── Context sync ──
  useEffect(() => {
    if (contextDealId) {
      setSelectedDealId(contextDealId);
      setStoreSelectedDealId(contextDealId);
      setOperationMode('deal');
    }
  }, [contextDealId, setStoreSelectedDealId]);

  // ── Fetch deals ──
  const fetchDeals = useCallback(async () => {
    setDealsLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('id, deal_name, deal_number, status, is_demo, deal_state')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (data) {
      setAllDeals(data as DealOption[]);
      setSelectedDealId(prev => prev || (data as DealOption[])[0]?.id);
    }
    setDealsLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // ── Fetch counts ──
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
    const stk = sRes.data || []; const docs = dRes.data || []; const wires = wRes.data || [];
    const apprs = aRes.data || []; const taxes = tRes.data || [];
    const discs = discRes.data || []; const obls = oblRes.data || [];
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
  }, [selectedDealId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // ── Readiness calc ──
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

  const buildBlockers = (): string[] => {
    const b: string[] = [];
    if (counts.unverified > 0) b.push(`${counts.unverified} stakeholders missing KYC`);
    if (counts.pendingWires > 0) b.push(`${counts.pendingWires} wire instructions pending`);
    if (counts.pendingApprovals > 0) b.push(`${counts.pendingApprovals} approvals outstanding`);
    if (counts.openDiscrepancies > 0) b.push(`${counts.openDiscrepancies} unresolved discrepancies`);
    if (counts.taxForms > 0 && counts.taxComplete < counts.taxForms) b.push(`${counts.taxForms - counts.taxComplete} tax forms incomplete`);
    if (counts.stakeholders === 0) b.push('No stakeholders imported');
    if (counts.documents === 0) b.push('No documents uploaded');
    if (counts.wires === 0) b.push('No wire instructions on file');
    return b;
  };

  // ── Deal creation handler ──
  const handleCreateDealSubmit = useCallback(async (payload: NewtonCreateDealPayload) => {
    setIsExecuting(true);
    addMessage({ type: 'loading', text: 'Creating deal and initializing readiness baseline…' });

    const result = await executeCreateDeal(payload, user?.id);
    removeLoading();
    setIsExecuting(false);

    if (!result.success) {
      addMessage({ type: 'alert', title: 'Deal creation failed', text: result.message });
      toast.error('Deal creation failed');
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
    }

    addMessage({
      type: 'success',
      title: `Deal Created — ${payload.deal_name}`,
      text: result.message,
      actions: [
        { label: 'Upload Stakeholders', prompt: 'Upload stakeholders' },
        { label: 'Upload Documents', prompt: 'Upload deal documents' },
      ],
    });
    toast.success('Deal created successfully');
  }, [user, addMessage, removeLoading, fetchDeals, setStoreSelectedDealId, setStoreActiveSection]);

  // ── Main action handler ──
  const handleSubmit = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    addMessage({ type: 'user', text: trimmed });

    const intent = detectIntent(trimmed);

    if (intent.action === 'unsupported' || intent.confidence < 0.5) {
      addMessage({
        type: 'response',
        title: 'I can help with that',
        text: SUPPORTED_ACTIONS_TEXT,
        actions: [
          { label: 'Create New Deal', prompt: 'Create a new deal', primary: true },
          { label: 'Show All Deals', prompt: 'Show all deals' },
        ],
      });
      return;
    }

    // Global intent detection
    if (intent.scope === 'global' && operationMode !== 'global') {
      setOperationMode('global');
    }

    // Create deal flow
    if (intent.action === 'create_deal') {
      const prefill = intent.params as Partial<NewtonCreateDealPayload>;
      const requiredKeys: Array<keyof NewtonCreateDealPayload> = ['deal_name', 'deal_type', 'buyer', 'closing_date', 'primary_deal_owner'];
      const missingRequired = requiredKeys.filter(k => !prefill[k]);
      const missingCount = missingRequired.length + (!prefill.seller && !prefill.target_company ? 1 : 0);

      setCreateDealPrefill(prefill);
      setShowCreateDealForm(true);

      addMessage({
        type: 'response',
        title: 'Start Deal Setup',
        text: missingCount > 0
          ? `I'll help you set this up. I need **${missingCount}** more field${missingCount > 1 ? 's' : ''} to proceed.`
          : 'I parsed your request and prefilled the form. Review and confirm to create the deal.',
        actions: [{ label: 'Start Deal Setup', prompt: '__open_create_form', primary: true }],
      });
      return;
    }

    // Execute other actions
    setIsExecuting(true);
    addMessage({ type: 'loading', text: 'Executing…' });

    let result: NewtonActionResult;
    let msgType: ChatMessage['type'] = 'success';
    let actionButtons: ChatMessage['actions'] = undefined;

    try {
      switch (intent.action) {
        case 'list_deals':
          result = await executeListDeals(user?.id);
          break;
        case 'open_deal': {
          result = await callNewtonAction('open_deal', intent.params);
          if (result.success && result.data?.deal_id) {
            setSelectedDealId(result.data.deal_id);
            setStoreSelectedDealId(result.data.deal_id);
            setOperationMode('deal');
            setStoreActiveSection('workspace');
          }
          break;
        }
        case 'next_steps': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await callNewtonAction('next_steps', { deal_id: selectedDealId });
          msgType = 'insight';
          actionButtons = [
            { label: 'Upload Stakeholders', prompt: 'Upload stakeholders' },
            { label: 'Generate KYC', prompt: 'Generate KYC requests' },
            { label: 'Upload Documents', prompt: 'Upload deal documents' },
          ];
          break;
        }
        case 'execute_deal': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await callNewtonAction('execute_deal', { deal_id: selectedDealId });
          msgType = result.message?.includes('Cannot execute') ? 'alert' : 'success';
          if (result.message?.includes('Cannot execute')) {
            actionButtons = [
              { label: 'Show Blockers', prompt: 'What is missing?', primary: true },
              { label: 'What Should I Do Next?', prompt: 'What should I do next?' },
            ];
          }
          break;
        }
        case 'show_demo': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await callNewtonAction('show_demo', { deal_id: selectedDealId });
          msgType = 'insight';
          actionButtons = [
            { label: 'View Stakeholders', prompt: 'Upload stakeholders' },
            { label: 'Check Readiness', prompt: 'What is the readiness?', primary: true },
            { label: 'What Should I Do Next?', prompt: 'What should I do next?' },
          ];
          break;
        }
        case 'query_state': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          result = await callNewtonAction('query_state', { deal_id: selectedDealId });
          msgType = 'insight';
          break;
        }
        case 'upload_stakeholders':
        case 'parse_stakeholders':
          setShowIntake(true);
          result = { success: true, message: 'Stakeholder intake is open. Upload a CSV or XLSX to begin.', logEntry: 'Opened stakeholder import' };
          break;
        case 'upload_documents':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first to upload documents.' }; break; }
          setShowIntake(true);
          result = { success: true, message: 'Document intake is open. Upload files for parsing and review.', logEntry: 'Opened document upload' };
          break;
        case 'review_documents':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          result = { success: true, message: 'Switched to document review.', logEntry: 'Opened document review' };
          break;
        case 'summarize_readiness':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal to check readiness.' }; break; }
          setOperationMode('deal');
          result = await executeSummarizeReadiness(selectedDealId);
          msgType = 'insight';
          actionButtons = [
            { label: 'Show Blockers', prompt: 'List all blockers', primary: true },
            { label: 'Next Steps', prompt: 'What should I do next?' },
          ];
          break;
        case 'list_blockers':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal to see blockers.' }; break; }
          setOperationMode('deal');
          result = await executeListBlockers(selectedDealId);
          msgType = 'alert';
          actionButtons = [
            { label: 'Generate KYC', prompt: 'Generate KYC requests' },
            { label: 'Prepare Approvals', prompt: 'Prepare approval package' },
          ];
          break;
        case 'generate_kyc_requests':
        case 'generate_kyb_requests':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await executeGenerateKycRequests(selectedDealId, user?.id);
          break;
        case 'parse_funds_flow': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await executeParseFundsFlow(selectedDealId);
          msgType = result.success ? 'success' : 'alert';
          if (result.success && result.data?.discrepancies) {
            setDiscrepancyItems(result.data.discrepancies);
            setShowDiscrepancyPanel(true);
          }
          actionButtons = [
            { label: 'Run Discrepancy Check', prompt: 'Run discrepancy check', primary: true },
            { label: 'Check Readiness', prompt: 'Check readiness' },
          ];
          break;
        }
        case 'run_discrepancy_check': {
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await executeRunDiscrepancyCheck(selectedDealId);
          if (result.success && result.data?.discrepancies) {
            setDiscrepancyItems(result.data.discrepancies);
            setShowDiscrepancyPanel(true);
            msgType = result.data.discrepancies.length > 0 ? 'alert' : 'success';
          } else {
            msgType = result.success ? 'insight' : 'alert';
          }
          actionButtons = result.data?.discrepancies?.length > 0
            ? [{ label: 'View Discrepancies', prompt: '__show_discrepancy_panel', primary: true }]
            : [{ label: 'Check Readiness', prompt: 'Check readiness' }];
          break;
        }
        case 'open_wire_instructions':
        case 'open_tax_forms':
        case 'open_approvals':
        case 'start_new_closing':
        case 'update_deal_metadata':
        default:
          result = { success: false, message: SUPPORTED_ACTIONS_TEXT };
      }
    } catch (e) {
      result = { success: false, message: `Action failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }

    removeLoading();
    setIsExecuting(false);

    if (!result.success) msgType = 'alert';

    addMessage({
      type: msgType,
      title: result.success ? (msgType === 'insight' ? 'Newton Intelligence' : 'Action completed') : 'Action needs attention',
      text: result.message,
      actions: actionButtons,
    });

    if (result.navigateTo) {
      setStoreActiveSection(result.navigateTo as any);
    }
    if (result.data?.deal_id && intent.action !== 'open_deal') {
      setSelectedDealId(result.data.deal_id);
      setStoreSelectedDealId(result.data.deal_id);
      setOperationMode('deal');
    }

    await fetchCounts();
  }, [addMessage, removeLoading, user, operationMode, selectedDealId, setStoreActiveSection, setStoreSelectedDealId, fetchCounts]);

  const handleChatAction = useCallback((prompt: string) => {
    if (prompt === '__open_create_form') {
      setShowCreateDealForm(true);
      return;
    }
    if (prompt === '__show_discrepancy_panel') {
      setShowDiscrepancyPanel(true);
      return;
    }
    handleSubmit(prompt);
  }, [handleSubmit]);

  // ── File upload handler ──
  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedDealId) {
      addMessage({ type: 'alert', title: 'No deal selected', text: 'Please select or create a deal before uploading files.' });
      return;
    }

    setOperationMode('deal');
    addMessage({ type: 'user', text: `📎 Uploaded: ${file.name}` });
    setIsExecuting(true);
    addMessage({ type: 'loading', text: `Parsing ${file.name} — extracting structured data…` });

    // Upload to storage
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `deal-documents/${selectedDealId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('deal-files')
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      // Storage may not exist; proceed with metadata-only flow
      console.warn('Storage upload skipped:', uploadError.message);
    }

    // Create document record
    const isFundsFlow = /fund|flow|disburs|payment/i.test(file.name);
    const isWire = /wire|bank|instruction/i.test(file.name);
    const docType = isFundsFlow ? 'FUNDS_FLOW' : isWire ? 'WIRE_INSTRUCTIONS' : 'OTHER';

    await supabase.from('contract_documents').insert({
      deal_id: selectedDealId,
      filename: file.name,
      doc_type: docType as any,
      status: 'uploaded' as any,
      file_url: storagePath,
    });

    // Trigger funds flow parsing if relevant
    if (isFundsFlow || isWire) {
      const result = await executeParseFundsFlow(selectedDealId);
      removeLoading();
      setIsExecuting(false);

      if (result.success) {
        const discCount = result.data?.discrepancy_count || result.data?.discrepancies?.length || 0;
        if (result.data?.discrepancies) {
          setDiscrepancyItems(result.data.discrepancies);
        }

        addMessage({
          type: discCount > 0 ? 'alert' : 'success',
          title: discCount > 0
            ? `${discCount} discrepanc${discCount === 1 ? 'y' : 'ies'} detected`
            : 'Document parsed successfully',
          text: result.message,
          actions: discCount > 0
            ? [
                { label: 'Review Discrepancies', prompt: '__show_discrepancy_panel', primary: true },
                { label: 'Check Readiness', prompt: 'Check readiness' },
              ]
            : [
                { label: 'Run Discrepancy Check', prompt: 'Run discrepancy check', primary: true },
                { label: 'Check Readiness', prompt: 'Check readiness' },
              ],
        });

        if (discCount > 0) setShowDiscrepancyPanel(true);
      } else {
        addMessage({
          type: 'alert',
          title: 'Parsing incomplete',
          text: `I wasn't able to confidently parse parts of **${file.name}** — I've highlighted them for review.\n\n${result.message}`,
          actions: [{ label: 'Upload Again', prompt: 'Upload funds flow' }],
        });
      }
    } else {
      removeLoading();
      setIsExecuting(false);
      addMessage({
        type: 'success',
        title: 'Document uploaded',
        text: `**${file.name}** has been added to the deal binder.\n\nTo run analysis, try:\n- "Parse funds flow"\n- "Run discrepancy check"`,
        actions: [
          { label: 'Parse Funds Flow', prompt: 'Parse funds flow' },
          { label: 'Run Discrepancy Check', prompt: 'Run discrepancy check' },
        ],
      });
    }

    await fetchCounts();
  }, [selectedDealId, addMessage, removeLoading, fetchCounts]);

  const handleResolveDiscrepancy = useCallback((id: string) => {
    setDiscrepancyItems(prev => prev.map(d => d.id === id ? { ...d, resolved: true } : d));
    toast.success('Discrepancy marked as resolved');
  }, []);

  const selectedDeal = allDeals.find(d => d.id === selectedDealId);
  const readinessPct = calcReadiness();
  const blockers = buildBlockers();

  if (dealsLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background rounded-2xl border border-border overflow-hidden">
      {/* Header — 56px */}
      <NewtonPanelHeader
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
          addMessage({
            type: 'response',
            title: 'Start Deal Setup',
            text: 'Fill in the deal details below to create a new deal.',
            actions: [{ label: 'Start Deal Setup', prompt: '__open_create_form', primary: true }],
          });
        }}
        operationMode={operationMode}
        readinessPct={readinessPct}
      />

      {/* Context Bar */}
      <NewtonContextBar
        operationMode={operationMode}
        readinessPct={readinessPct}
        blockerCount={blockers.length}
        dealName={selectedDeal?.deal_name}
      />

      {/* Chat Stream — scrollable main area */}
      <NewtonChatStream messages={messages} onAction={handleChatAction} />

      {/* Slide-over panels */}
      <AnimatePresence>
        {showCreateDealForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="px-4 pb-2"
          >
            <NewtonCreateDealForm
              onSubmit={handleCreateDealSubmit}
              isLoading={isExecuting}
              onCancel={() => { setShowCreateDealForm(false); setCreateDealPrefill({}); }}
              initialValues={createDealPrefill}
              currentUserLabel={user?.email || ''}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discrepancy Panel */}
      <AnimatePresence>
        {showDiscrepancyPanel && discrepancyItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-2"
          >
            <NewtonDiscrepancyPanel
              discrepancies={discrepancyItems}
              onResolve={handleResolveDiscrepancy}
              onClose={() => setShowDiscrepancyPanel(false)}
              dealName={selectedDeal?.deal_name}
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
            className="overflow-hidden px-4 pb-2"
          >
            <NewtonIntakePanel
              dealId={selectedDealId || null}
              onComplete={() => {
                fetchCounts();
                setShowIntake(false);
                addMessage({ type: 'success', title: 'Import complete', text: 'Data has been imported successfully.' });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar — bottom sticky */}
      <NewtonInputBar
        onSubmit={handleSubmit}
        onFileUpload={handleFileUpload}
        disabled={isExecuting}
        operationMode={operationMode}
        onUploadClick={() => {
          setShowIntake(prev => !prev);
          if (selectedDealId) setOperationMode('deal');
        }}
      />
    </div>
  );
};
