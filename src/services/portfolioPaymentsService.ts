/**
 * Payments across every deal, from the database.
 *
 * This screen showed six invented payments — $55.5M to "Sarah Chen" on "Project
 * ATLAS" — to everyone who opened it, with a portfolio total computed from
 * those literals. It now reads `disbursement_intents`.
 *
 * Amounts are summed per currency, never across them. The previous version
 * added USD, EUR and GBP figures together and printed the result with a dollar
 * sign. On a payments screen that is not a rounding question — it is a wrong
 * number presented as a total.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DisbursementStatus = Database["public"]["Enums"]["disbursement_status"];

/** Statuses where the money has not moved and something is holding it up. */
export const BLOCKED_STATUSES: DisbursementStatus[] = ["pending_conditions", "pending_approvals"];
/** Statuses that claim money has moved — all currently produced by the mock provider. */
export const EXECUTED_STATUSES: DisbursementStatus[] = ["executing", "executed", "settled", "reconciled"];

export interface PortfolioPayment {
  id: string;
  dealId: string;
  dealName: string;
  dealNumber: string;
  isDemo: boolean;
  recipient: string;
  amount: number;
  currency: string;
  status: DisbursementStatus;
  providerRef: string | null;
  /** Which provider executed it — "mock" means no funds moved. */
  provider: string;
  updatedAt: string;
}

export interface PortfolioPaymentsSummary {
  payments: PortfolioPayment[];
  /** Totals per currency. Never summed across currencies. */
  totalsByCurrency: Array<{ currency: string; amount: number; count: number }>;
  blockedCount: number;
  executedCount: number;
  failedCount: number;
  /** True when any executed payment came from a simulated provider. */
  anySimulated: boolean;
  truncated: boolean;
}

export async function getPortfolioPayments(limit = 200): Promise<PortfolioPaymentsSummary> {
  const { data: dealRows, error: dealError } = await supabase
    .from("deals")
    .select("id, deal_name, deal_number, is_demo")
    .is("deleted_at", null);

  if (dealError) throw dealError;

  const deals = dealRows ?? [];
  const empty: PortfolioPaymentsSummary = {
    payments: [], totalsByCurrency: [], blockedCount: 0,
    executedCount: 0, failedCount: 0, anySimulated: false, truncated: false,
  };
  if (deals.length === 0) return empty;

  const dealMap = new Map(deals.map((d) => [d.id, d]));

  const { data: intentRows, error: intentError } = await supabase
    .from("disbursement_intents")
    .select("id, deal_id, recipient_id, bank_account_ref, amount_original, currency_original, status, provider_ref, execution_provider, updated_at")
    .in("deal_id", Array.from(dealMap.keys()))
    .order("updated_at", { ascending: false })
    .limit(limit + 1);

  if (intentError) throw intentError;

  const truncated = (intentRows?.length ?? 0) > limit;
  const rows = (intentRows ?? []).slice(0, limit);

  const payments: PortfolioPayment[] = rows.map((r) => {
    const deal = dealMap.get(r.deal_id);
    return {
      id: r.id,
      dealId: r.deal_id,
      dealName: deal?.deal_name ?? "Unknown deal",
      dealNumber: deal?.deal_number ?? "—",
      isDemo: Boolean(deal?.is_demo),
      // `disbursement_intents.recipient_id` has no foreign key to a party table,
      // so the account reference is the only name available. The per-deal
      // payments screen labels rows the same way.
      recipient: r.bank_account_ref || "Unnamed recipient",
      amount: Number(r.amount_original ?? 0),
      currency: r.currency_original || "USD",
      status: r.status,
      providerRef: r.provider_ref,
      provider: r.execution_provider || "unknown",
      updatedAt: r.updated_at,
    };
  });

  const byCurrency = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const cur = byCurrency.get(p.currency) ?? { amount: 0, count: 0 };
    cur.amount += p.amount;
    cur.count += 1;
    byCurrency.set(p.currency, cur);
  }

  return {
    payments,
    totalsByCurrency: Array.from(byCurrency.entries())
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => b.amount - a.amount),
    blockedCount: payments.filter((p) => BLOCKED_STATUSES.includes(p.status)).length,
    executedCount: payments.filter((p) => EXECUTED_STATUSES.includes(p.status)).length,
    failedCount: payments.filter((p) => p.status === "failed").length,
    anySimulated: payments.some(
      (p) => EXECUTED_STATUSES.includes(p.status) && /mock|sim/i.test(p.provider)
    ),
    truncated,
  };
}
