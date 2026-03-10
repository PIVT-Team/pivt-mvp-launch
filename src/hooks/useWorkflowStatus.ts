import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type WorkflowStepStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface WorkflowStatuses {
  overview: WorkflowStepStatus;
  stakeholders: WorkflowStepStatus;
  verification: WorkflowStepStatus;
  structuring: WorkflowStepStatus;
  'deal-inputs': WorkflowStepStatus;
  execution: WorkflowStepStatus;
  compliance: WorkflowStepStatus;
  completion: WorkflowStepStatus;
}

export interface WorkflowStatusResult {
  statuses: WorkflowStatuses;
  /** completionPct per step (0-100) for progress bar */
  completionPcts: Record<string, number>;
  loading: boolean;
  refetch: () => void;
}

const DEFAULT: WorkflowStatuses = {
  overview: 'NOT_STARTED',
  stakeholders: 'NOT_STARTED',
  verification: 'NOT_STARTED',
  structuring: 'NOT_STARTED',
  'deal-inputs': 'NOT_STARTED',
  execution: 'NOT_STARTED',
  compliance: 'NOT_STARTED',
  completion: 'NOT_STARTED',
};

export function useWorkflowStatus(dealId: string | undefined): WorkflowStatusResult {
  const [statuses, setStatuses] = useState<WorkflowStatuses>(DEFAULT);
  const [completionPcts, setCompletionPcts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);

    const [
      stakeholders,
      documents,
      approvals,
      payments,
      conditions,
      capTable,
      deal,
      escrow,
      dealParties,
    ] = await Promise.all([
      supabase.from('cap_table_entries').select('id, role, verification_status, ownership_pct').eq('deal_id', dealId),
      supabase.from('contract_documents').select('id, doc_type, status').eq('deal_id', dealId),
      supabase.from('deal_approvals').select('id, status').eq('deal_id', dealId),
      supabase.from('payment_instructions').select('id, status').eq('deal_id', dealId),
      supabase.from('conditions').select('id, status').eq('deal_id', dealId),
      supabase.from('waterfall_tiers').select('id').eq('deal_id', dealId),
      supabase.from('deals').select('deal_value, closing_date, buyer, seller, target_company, deal_type, status').eq('id', dealId).single(),
      supabase.from('escrow_accounts').select('status').eq('deal_id', dealId).maybeSingle(),
      supabase.from('deal_parties').select('id').eq('deal_id', dealId),
    ]);

    const stk = stakeholders.data || [];
    const docs = documents.data || [];
    const apps = approvals.data || [];
    const pays = payments.data || [];
    const conds = conditions.data || [];
    const tiers = capTable.data || [];
    const d = deal.data;
    const dp = dealParties.data || [];

    // ── Overview: always complete (it's a summary page)
    const overviewStatus: WorkflowStepStatus = 'COMPLETED';

    // ── Stakeholders
    const stkStatus: WorkflowStepStatus =
      stk.length === 0 ? 'NOT_STARTED' :
      stk.every(s => s.verification_status === 'verified') ? 'COMPLETED' :
      'IN_PROGRESS';
    // Stakeholder pct: having stakeholders = 50% base, verification progress = remaining 50%
    const stkPct = stk.length === 0 ? 0 :
      Math.round(50 + (stk.filter(s => s.verification_status === 'verified').length / stk.length) * 50);

    // ── Verification
    const ACTIVE_STATUSES = ['sent', 'in_progress', 'submitted', 'pending', 'verified', 'failed', 'not_sent'];
    const activeVerifications = stk.filter(s => ACTIVE_STATUSES.includes(s.verification_status));
    const verifiedCount = stk.filter(s => s.verification_status === 'verified').length;
    const verificationStatus: WorkflowStepStatus =
      stk.length === 0 ? 'NOT_STARTED' :
      verifiedCount === stk.length && stk.length > 0 ? 'COMPLETED' :
      'IN_PROGRESS';
    // Verification pct: having stakeholders to verify = 25% base, verified progress = remaining 75%
    const verPct = stk.length === 0 ? 0 :
      (verificationStatus === 'NOT_STARTED' ? 0 :
        Math.round(25 + (verifiedCount / stk.length) * 75));

    // ── Structuring (cap table + waterfall)
    const ownershipTotal = stk.reduce((sum, s) => sum + (Number(s.ownership_pct) || 0), 0);
    const hasStructuring = stk.length > 0 || tiers.length > 0;
    const structuringStatus: WorkflowStepStatus =
      !hasStructuring ? 'NOT_STARTED' :
      ownershipTotal >= 99.9 && tiers.length > 0 ? 'COMPLETED' :
      'IN_PROGRESS';
    const structPct = !hasStructuring ? 0 :
      Math.min(100, Math.round(((ownershipTotal >= 99.9 ? 50 : ownershipTotal / 2) + (tiers.length > 0 ? 50 : 0))));

    // ── Deal Inputs (documents + deal metadata)
    const hasRequiredMeta = !!(d?.deal_value && d?.closing_date);
    const dealInputsStatus: WorkflowStepStatus =
      docs.length === 0 && !hasRequiredMeta ? 'NOT_STARTED' :
      docs.length > 0 && hasRequiredMeta ? 'COMPLETED' :
      'IN_PROGRESS';
    const inputPct = (docs.length > 0 ? 50 : 0) + (hasRequiredMeta ? 50 : 0);

    // ── Execution (payments + escrow)
    const paysConfirmed = pays.filter(p => {
      const s = (p.status as string).toUpperCase();
      return s === 'CONFIRMED' || s === 'APPROVED' || s === 'EXECUTED';
    }).length;
    const executionStatus: WorkflowStepStatus =
      pays.length === 0 ? 'NOT_STARTED' :
      paysConfirmed >= pays.length ? 'COMPLETED' :
      'IN_PROGRESS';
    const execPct = pays.length === 0 ? 0 :
      Math.round((paysConfirmed / pays.length) * 100);

    // ── Compliance (conditions + approvals)
    const condsMet = conds.filter(c => c.status === 'SATISFIED' || c.status === 'WAIVED').length;
    const appsApproved = apps.filter(a => a.status === 'approved').length;
    const compTotal = conds.length + apps.length;
    const compDone = condsMet + appsApproved;
    const complianceStatus: WorkflowStepStatus =
      compTotal === 0 ? 'NOT_STARTED' :
      compDone >= compTotal ? 'COMPLETED' :
      'IN_PROGRESS';
    const compPct = compTotal === 0 ? 0 :
      Math.round((compDone / compTotal) * 100);

    // ── Completion (deal status)
    const dealStatus = d?.status || 'draft';
    const completionStatus: WorkflowStepStatus =
      dealStatus === 'closed' || dealStatus === 'settled' ? 'COMPLETED' :
      dealStatus === 'executing' || dealStatus === 'active' ? 'IN_PROGRESS' :
      'NOT_STARTED';
    const completionPct = completionStatus === 'COMPLETED' ? 100 : completionStatus === 'IN_PROGRESS' ? 50 : 0;

    setStatuses({
      overview: overviewStatus,
      stakeholders: stkStatus,
      verification: verificationStatus,
      structuring: structuringStatus,
      'deal-inputs': dealInputsStatus,
      execution: executionStatus,
      compliance: complianceStatus,
      completion: completionStatus,
    });

    setCompletionPcts({
      overview: 100,
      stakeholders: stkPct,
      verification: verPct,
      structuring: structPct,
      'deal-inputs': inputPct,
      execution: execPct,
      compliance: compPct,
      completion: completionPct,
    });

    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Subscribe to realtime changes on cap_table_entries for this deal
  useEffect(() => {
    if (!dealId) return;
    const channel = supabase
      .channel(`workflow-status-${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cap_table_entries', filter: `deal_id=eq.${dealId}` }, () => fetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_documents', filter: `deal_id=eq.${dealId}` }, () => fetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_approvals', filter: `deal_id=eq.${dealId}` }, () => fetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions', filter: `deal_id=eq.${dealId}` }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dealId, fetch]);

  return { statuses, completionPcts, loading, refetch: fetch };
}
