/**
 * PIVT Deal State Machine Service
 * 
 * Canonical deal states:
 *   draft → verification_pending → structuring → conditions_pending
 *   → ready_for_execution → executing → settled → archived
 * 
 * Each state has gates that must be satisfied to advance.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────
export type DealState =
  | 'draft'
  | 'verification_pending'
  | 'structuring'
  | 'conditions_pending'
  | 'ready_for_execution'
  | 'executing'
  | 'settled'
  | 'archived';

export type DealEventType =
  | 'DEAL_CREATED'
  | 'STAKEHOLDER_ADDED'
  | 'STAKEHOLDER_REMOVED'
  | 'VERIFICATION_SENT'
  | 'VERIFICATION_SUBMITTED'
  | 'VERIFICATION_VERIFIED'
  | 'VERIFICATION_FAILED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REMOVED'
  | 'WATERFALL_CONFIGURED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'CONDITION_SATISFIED'
  | 'CONDITION_WAIVED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'DEAL_SETTLED'
  | 'DEAL_ARCHIVED'
  | 'STATE_OVERRIDE';

export interface Gate {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface GateResult {
  currentState: DealState;
  gates: Gate[];
  allPassed: boolean;
  suggestedNextState: DealState | null;
  blockedReason: string | null;
}

export interface DealEvent {
  id?: string;
  deal_id: string;
  event_type: DealEventType;
  actor_id?: string;
  payload?: Record<string, unknown>;
  previous_state?: string;
  new_state?: string;
}

// ── State ordering ─────────────────────────────────────────────
const STATE_ORDER: DealState[] = [
  'draft',
  'verification_pending',
  'structuring',
  'conditions_pending',
  'ready_for_execution',
  'executing',
  'settled',
  'archived',
];

// ── Gate definitions per state (what's needed to LEAVE that state) ──
interface GateDefinition {
  key: string;
  label: string;
  check: (ctx: GateContext) => boolean;
  detail?: (ctx: GateContext) => string;
}

interface GateContext {
  stakeholders: Array<{ id: string; role: string; verification_status: string }>;
  documents: Array<{ id: string; doc_type: string; status: string }>;
  approvals: Array<{ id: string; status: string }>;
  payments: Array<{ id: string; status: string }>;
  conditions: Array<{ id: string; status: string }>;
  deal: { deal_state: string; deal_value: number; escrow_amount: number | null };
}

const SELLER_ROLES = ['Seller', 'Target', 'Shareholder', 'Founder', 'Employee'];
const BUYER_ROLES = ['Buyer', 'Merger Sub', 'Investor'];

const STATE_GATES: Partial<Record<DealState, GateDefinition[]>> = {
  draft: [
    {
      key: 'has_stakeholders',
      label: 'Stakeholders configured',
      check: (ctx) => {
        const hasSeller = ctx.stakeholders.some(s => SELLER_ROLES.includes(s.role));
        const hasBuyer = ctx.stakeholders.some(s => BUYER_ROLES.includes(s.role));
        return hasSeller && hasBuyer;
      },
      detail: (ctx) => `${ctx.stakeholders.length} stakeholders`,
    },
  ],
  verification_pending: [
    {
      key: 'seller_verified',
      label: 'Seller-side verified',
      check: (ctx) => {
        const sellers = ctx.stakeholders.filter(s => SELLER_ROLES.includes(s.role));
        return sellers.length > 0 && sellers.every(s => s.verification_status === 'verified');
      },
      detail: (ctx) => {
        const sellers = ctx.stakeholders.filter(s => SELLER_ROLES.includes(s.role));
        const verified = sellers.filter(s => s.verification_status === 'verified').length;
        return `${verified}/${sellers.length} verified`;
      },
    },
    {
      key: 'buyer_verified',
      label: 'Buyer-side verified',
      check: (ctx) => {
        const buyers = ctx.stakeholders.filter(s => BUYER_ROLES.includes(s.role));
        return buyers.length > 0 && buyers.every(s => s.verification_status === 'verified');
      },
      detail: (ctx) => {
        const buyers = ctx.stakeholders.filter(s => BUYER_ROLES.includes(s.role));
        const verified = buyers.filter(s => s.verification_status === 'verified').length;
        return `${verified}/${buyers.length} verified`;
      },
    },
  ],
  structuring: [
    {
      key: 'spa_uploaded',
      label: 'SPA / Purchase Agreement uploaded',
      check: (ctx) => {
        const spaTypes = ['SPA', 'MERGER_AGREEMENT', 'PURCHASE_AGREEMENT'];
        return ctx.documents.some(d => spaTypes.includes(d.doc_type));
      },
    },
    {
      key: 'wire_instructions',
      label: 'Wire instructions uploaded',
      check: (ctx) => ctx.documents.some(d => ['WIRE_INSTRUCTIONS', 'BANK_LETTER'].includes(d.doc_type)),
    },
  ],
  conditions_pending: [
    {
      key: 'conditions_met',
      label: 'All conditions satisfied',
      check: (ctx) => {
        if (ctx.conditions.length === 0) return true;
        return ctx.conditions.every(c => c.status === 'SATISFIED' || c.status === 'WAIVED');
      },
      detail: (ctx) => {
        const met = ctx.conditions.filter(c => c.status === 'SATISFIED' || c.status === 'WAIVED').length;
        return `${met}/${ctx.conditions.length} conditions`;
      },
    },
    {
      key: 'payments_approved',
      label: 'Payments approved',
      check: (ctx) => {
        if (ctx.payments.length === 0) return true;
        return ctx.payments.every(p => {
          const s = (p.status as string).toUpperCase();
          return s === 'CONFIRMED' || s === 'APPROVED';
        });
      },
    },
    {
      key: 'approvals_complete',
      label: 'All approvals granted',
      check: (ctx) => {
        if (ctx.approvals.length === 0) return true;
        return ctx.approvals.every(a => a.status === 'approved');
      },
      detail: (ctx) => {
        const granted = ctx.approvals.filter(a => a.status === 'approved').length;
        return `${granted}/${ctx.approvals.length} approvals`;
      },
    },
  ],
  ready_for_execution: [
    {
      key: 'execution_started',
      label: 'Execution initiated',
      check: () => false, // Manual trigger
    },
  ],
  executing: [
    {
      key: 'all_disbursed',
      label: 'All disbursements settled',
      check: () => false, // Will be checked by execution engine
    },
  ],
};

// ── Core service ───────────────────────────────────────────────

async function fetchGateContext(dealId: string): Promise<GateContext> {
  const [stakeholders, documents, approvals, payments, conditions, deal] = await Promise.all([
    supabase.from('cap_table_entries').select('id, role, verification_status').eq('deal_id', dealId),
    supabase.from('contract_documents').select('id, doc_type, status').eq('deal_id', dealId),
    supabase.from('deal_approvals').select('id, status').eq('deal_id', dealId),
    supabase.from('payment_instructions').select('id, status').eq('deal_id', dealId),
    supabase.from('conditions').select('id, status').eq('deal_id', dealId),
    supabase.from('deals').select('deal_state, deal_value, escrow_amount').eq('id', dealId).single(),
  ]);

  return {
    stakeholders: (stakeholders.data as any[]) || [],
    documents: (documents.data as any[]) || [],
    approvals: (approvals.data as any[]) || [],
    payments: (payments.data as any[]) || [],
    conditions: (conditions.data as any[]) || [],
    deal: (deal.data as any) || { deal_state: 'draft', deal_value: 0, escrow_amount: 0 },
  };
}

export async function computeGates(dealId: string): Promise<GateResult> {
  const ctx = await fetchGateContext(dealId);
  const currentState = (ctx.deal.deal_state || 'draft') as DealState;
  const gateDefs = STATE_GATES[currentState] || [];

  const gates: Gate[] = gateDefs.map(def => ({
    key: def.key,
    label: def.label,
    passed: def.check(ctx),
    detail: def.detail?.(ctx),
  }));

  const allPassed = gates.length === 0 || gates.every(g => g.passed);
  const suggestedNextState = allPassed ? computeNextState(currentState) : null;
  const failedGates = gates.filter(g => !g.passed);
  const blockedReason = failedGates.length > 0
    ? failedGates.map(g => g.label).join('; ')
    : null;

  return {
    currentState,
    gates,
    allPassed,
    suggestedNextState,
    blockedReason,
  };
}

export function computeNextState(currentState: DealState): DealState | null {
  const idx = STATE_ORDER.indexOf(currentState);
  if (idx === -1 || idx >= STATE_ORDER.length - 1) return null;
  return STATE_ORDER[idx + 1];
}

export async function applyEvent(
  dealId: string,
  eventType: DealEventType,
  payload: Record<string, unknown> = {},
  actorId?: string
): Promise<{ newState: DealState; gateResult: GateResult }> {
  // 1. Compute gates and potential state transition
  const gateResult = await computeGates(dealId);
  const previousState = gateResult.currentState;
  let newState = previousState;

  // 2. If all gates pass, advance state
  if (gateResult.allPassed && gateResult.suggestedNextState) {
    newState = gateResult.suggestedNextState;
  }

  // 3. Write event
  await supabase.from('deal_events').insert({
    deal_id: dealId,
    event_type: eventType,
    actor_id: actorId || null,
    payload,
    previous_state: previousState,
    new_state: newState,
  } as any);

  // 4. Update deal state if changed
  if (newState !== previousState) {
    await supabase.from('deals').update({
      deal_state: newState,
      state_updated_at: new Date().toISOString(),
      blocked_reason: null,
    } as any).eq('id', dealId);
  } else if (gateResult.blockedReason) {
    // Update blocked reason even if state didn't change
    await supabase.from('deals').update({
      blocked_reason: gateResult.blockedReason,
    } as any).eq('id', dealId);
  }

  return { newState, gateResult };
}

export async function forceState(
  dealId: string,
  targetState: DealState,
  reason: string,
  actorId?: string
): Promise<void> {
  const { data: deal } = await supabase
    .from('deals')
    .select('deal_state')
    .eq('id', dealId)
    .single();

  const previousState = (deal as any)?.deal_state || 'draft';

  await supabase.from('deal_events').insert({
    deal_id: dealId,
    event_type: 'STATE_OVERRIDE',
    actor_id: actorId || null,
    payload: { reason, forced_to: targetState },
    previous_state: previousState,
    new_state: targetState,
  } as any);

  await supabase.from('deals').update({
    deal_state: targetState,
    state_updated_at: new Date().toISOString(),
    blocked_reason: null,
  } as any).eq('id', dealId);
}

export async function getDealEvents(dealId: string, limit = 50) {
  const { data } = await supabase
    .from('deal_events')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as any[]) || [];
}

export const dealStateMachineService = {
  computeGates,
  computeNextState,
  applyEvent,
  forceState,
  getDealEvents,
  STATE_ORDER,
};
