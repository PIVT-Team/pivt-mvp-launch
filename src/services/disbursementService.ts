// disbursementService — the actual "close-the-deal" execution path.
//
// Before this existed, the Wire Pack tab could generate a beautiful PDF and
// then... the user had to manually pretend something happened. There was no
// "Execute Disbursement" button anywhere, no disbursement_intents were ever
// written, and deals stayed stuck in 'active' forever.
//
// What this service does:
//   1. Reads the generated wire pack (or pulls verified wires directly)
//   2. Creates a disbursement_intents row per wire (status 'eligible')
//   3. Simulates a partner-bank execution by stepping each intent through
//      eligible → executing → executed → settled with audit_log writes at
//      each transition (so the Audit tab tells the closing story afterward)
//
// The simulator stands in for a real partner-bank API. The intent rows are
// permanent; only the transition cadence is mock. When a real provider is
// wired (Stripe Treasury, Wise, banking partner), only `simulateOne()` needs
// to change — everything else (intent creation, status transitions, audit
// logging, UI surfaces) is already correct.

import { supabase } from "@/integrations/supabase/client";

export type DisbursementStatus =
  | "draft"
  | "pending_conditions"
  | "pending_approvals"
  | "eligible"
  | "executing"
  | "executed"
  | "settled"
  | "reconciled"
  | "failed";

export interface DisbursementIntent {
  id: string;
  deal_id: string;
  recipient_id: string;
  amount_original: number;
  currency_original: string;
  settlement_currency: string;
  rail: string;
  bank_account_ref: string | null;
  consideration_type: string;
  status: DisbursementStatus;
  execution_provider: string;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface WireForExecution {
  id: string;
  payee_entity: string;
  amount: number;
  currency: string;
  account_number_last4: string | null;
  bank_name: string | null;
  verification_status: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────────
// READ
// ──────────────────────────────────────────────────────────

export async function listDisbursementIntents(dealId: string): Promise<DisbursementIntent[]> {
  const { data, error } = await supabase
    .from("disbursement_intents")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load intents: ${error.message}`);
  return (data || []) as DisbursementIntent[];
}

// ──────────────────────────────────────────────────────────
// CORE EXECUTION
// ──────────────────────────────────────────────────────────

export interface ExecuteDisbursementOptions {
  dealId: string;
  userId: string | null;
  /** Optional per-intent progress callback so the UI can render live status. */
  onProgress?: (update: { intentId: string; status: DisbursementStatus; recipient: string }) => void;
  /** Speed knob for the demo. Real execution would be event-driven via webhook. */
  stepDelayMs?: number;
}

export interface ExecuteDisbursementResult {
  created: number;
  executed: number;
  failed: number;
  intents: DisbursementIntent[];
}

export async function executeDisbursement(opts: ExecuteDisbursementOptions): Promise<ExecuteDisbursementResult> {
  const stepDelay = opts.stepDelayMs ?? 800;

  // Pull all verified wires for this deal. We only execute wires that have
  // passed verification — anything still 'pending' would land as a 'failed'
  // intent below, but we'd rather skip them entirely and tell the user.
  const { data: wires, error: wireErr } = await supabase
    .from("wire_instructions")
    .select("id, payee_entity, amount, currency, account_number_last4, bank_name, verification_status")
    .eq("deal_id", opts.dealId);
  if (wireErr) throw new Error(`Failed to load wires: ${wireErr.message}`);

  const eligible = (wires || []).filter((w: WireForExecution) =>
    w.verification_status === "verified" || w.verification_status === "confirmed",
  );

  if (eligible.length === 0) {
    throw new Error("No verified wires found for this deal. Verify wires before executing.");
  }

  // Skip wires that already have a disbursement_intent in a non-failed state.
  // Re-running Execute on a partially-completed deal should be safe and only
  // create intents for wires that haven't been disbursed yet.
  const existing = await listDisbursementIntents(opts.dealId);
  const alreadyDisbursed = new Set(
    existing
      .filter((i) => i.status !== "failed")
      .map((i) => i.recipient_id),
  );
  const toDisburse = eligible.filter((w: WireForExecution) => !alreadyDisbursed.has(w.id));

  if (toDisburse.length === 0) {
    return { created: 0, executed: 0, failed: 0, intents: existing };
  }

  // ── Phase 1: Create intents (status='eligible') ──
  const intentRows = toDisburse.map((w: WireForExecution) => ({
    deal_id: opts.dealId,
    recipient_id: w.id, // wire_instruction.id is a stable per-recipient anchor
    amount_original: Number(w.amount) || 0,
    currency_original: w.currency || "USD",
    settlement_currency: w.currency || "USD",
    rail: "wire",
    bank_account_ref: `${w.payee_entity}${w.account_number_last4 ? ` (****${w.account_number_last4})` : ""}`,
    consideration_type: "cash" as const,
    status: "eligible" as DisbursementStatus,
    execution_provider: "mock",
    required_conditions: [],
    required_approvals: [],
  }));

  const { data: created, error: createErr } = await supabase
    .from("disbursement_intents")
    .insert(intentRows as any)
    .select("*");
  if (createErr) throw new Error(`Failed to create intents: ${createErr.message}`);

  const createdIntents = (created || []) as DisbursementIntent[];

  await supabase.from("audit_log").insert({
    deal_id: opts.dealId,
    user_id: opts.userId,
    action: "disbursement_batch_created",
    details: {
      intent_count: createdIntents.length,
      total_amount: createdIntents.reduce((s, i) => s + Number(i.amount_original), 0),
      currency: createdIntents[0]?.currency_original ?? "USD",
    },
  });

  // ── Phase 2: Step each intent through executing → executed → settled ──
  // Sequential so the UI shows a clear progression rather than 8 things
  // flipping at once.
  let executed = 0;
  let failed = 0;
  for (const intent of createdIntents) {
    try {
      await simulateOne(intent, opts.userId, stepDelay, (status) =>
        opts.onProgress?.({ intentId: intent.id, status, recipient: intent.bank_account_ref || "Unknown" }),
      );
      executed += 1;
    } catch {
      failed += 1;
      // Best-effort: write the failed state so the row shows correctly.
      await supabase
        .from("disbursement_intents")
        .update({ status: "failed" as DisbursementStatus })
        .eq("id", intent.id)
        .then(() => undefined, () => undefined);
    }
  }

  const finalIntents = await listDisbursementIntents(opts.dealId);
  return { created: createdIntents.length, executed, failed, intents: finalIntents };
}

// ──────────────────────────────────────────────────────────
// MOCK PROVIDER
// ──────────────────────────────────────────────────────────

// Simulates a partner-bank execution cycle: executing → executed → settled.
// Each transition is a real DB update + audit_log entry so the deal's audit
// trail tells the full story after a successful close. The delays are the
// only mock thing — a real provider would update via webhook.
async function simulateOne(
  intent: DisbursementIntent,
  userId: string | null,
  stepDelay: number,
  onStatus: (status: DisbursementStatus) => void,
): Promise<void> {
  // → executing
  await transition(intent.id, "executing", { execution_started_at: new Date().toISOString() });
  onStatus("executing");
  await audit(intent, userId, "disbursement_started");
  await wait(stepDelay);

  // → executed (mock provider returns a fake transaction ref)
  const providerRef = `MOCK-${intent.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  await transition(intent.id, "executed", { provider_ref: providerRef });
  onStatus("executed");
  await audit(intent, userId, "disbursement_executed", { provider_ref: providerRef });
  await wait(stepDelay);

  // → settled (the partner confirms funds left the account)
  await transition(intent.id, "settled", {});
  onStatus("settled");
  await audit(intent, userId, "disbursement_settled", { provider_ref: providerRef });
}

async function transition(
  intentId: string,
  status: DisbursementStatus,
  extraFields: Record<string, unknown>,
): Promise<void> {
  const payload: Record<string, unknown> = { status, ...extraFields };
  // Strip fields the table doesn't have — execution_started_at isn't a column
  // in disbursement_intents, but if it gets added later this is the right spot.
  delete payload.execution_started_at;
  const { error } = await supabase
    .from("disbursement_intents")
    .update(payload as any)
    .eq("id", intentId);
  if (error) throw new Error(`Transition to ${status} failed: ${error.message}`);
}

async function audit(
  intent: DisbursementIntent,
  userId: string | null,
  action: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("audit_log").insert({
    deal_id: intent.deal_id,
    user_id: userId,
    action,
    details: {
      intent_id: intent.id,
      recipient: intent.bank_account_ref,
      amount: Number(intent.amount_original),
      currency: intent.currency_original,
      provider: intent.execution_provider,
      ...(extra || {}),
    },
  });
}

// ──────────────────────────────────────────────────────────
// RETRY (for failed intents)
// ──────────────────────────────────────────────────────────

export async function retryDisbursement(
  intent: DisbursementIntent,
  userId: string | null,
  onProgress?: (status: DisbursementStatus) => void,
): Promise<void> {
  await audit(intent, userId, "disbursement_retry_started");
  await simulateOne(intent, userId, 800, (s) => onProgress?.(s));
}

// Human-readable status label for badges and toasts.
export const statusLabel = (s: DisbursementStatus): string => {
  switch (s) {
    case "draft": return "Draft";
    case "pending_conditions": return "Pending conditions";
    case "pending_approvals": return "Pending approvals";
    case "eligible": return "Eligible";
    case "executing": return "Executing…";
    case "executed": return "Executed";
    case "settled": return "Settled";
    case "reconciled": return "Reconciled";
    case "failed": return "Failed";
  }
};
