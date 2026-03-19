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

    try {
      switch (intent.action) {
        case 'list_deals':
          result = await executeListDeals(user?.id);
          break;
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
          break;
        case 'list_blockers':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal to see blockers.' }; break; }
          setOperationMode('deal');
          result = await executeListBlockers(selectedDealId);
          break;
        case 'generate_kyc_requests':
        case 'generate_kyb_requests':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await executeGenerateKycRequests(selectedDealId, user?.id);
          break;
        case 'prepare_approval_package':
          if (!selectedDealId) { result = { success: false, message: 'Select a deal first.' }; break; }
          setOperationMode('deal');
          result = await executePrepareApprovalPackage(selectedDealId, user?.id);
          break;
        default:
          result = { success: false, message: SUPPORTED_ACTIONS_TEXT };
      }
    } catch (e) {
      result = { success: false, message: `Action failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }

    removeLoading();
    setIsExecuting(false);

    const msgType = result.success ? 'success' : 'alert';
    addMessage({
      type: msgType,
      title: result.success ? 'Action completed' : 'Action needs attention',
      text: result.message,
    });

    if (result.navigateTo) {
      setStoreActiveSection(result.navigateTo as any);
    }
    if (result.data?.deal_id) {
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
    handleSubmit(prompt);
  }, [handleSubmit]);

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
