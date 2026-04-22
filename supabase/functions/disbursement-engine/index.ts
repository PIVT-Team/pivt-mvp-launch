import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------- Types ----------
type DisbursementStatus =
  | "draft" | "pending_conditions" | "pending_approvals" | "eligible"
  | "executing" | "executed" | "settled" | "reconciled" | "failed";

interface DisbursementIntent {
  id: string;
  deal_id: string;
  status: DisbursementStatus;
  required_conditions: { key: string; met: boolean }[];
  required_approvals: { role: string; approved: boolean }[];
  fx_quote_id: string | null;
  waterfall_allocation_id: string | null;
  [k: string]: unknown;
}

// ---------- State Machine ----------
function evaluateEligibility(intent: DisbursementIntent, fxQuote: any | null): DisbursementStatus {
  // Check conditions
  const conditions = intent.required_conditions || [];
  if (conditions.length > 0 && conditions.some((c: any) => !c.met)) {
    return "pending_conditions";
  }
  // Check approvals
  const approvals = intent.required_approvals || [];
  if (approvals.length > 0 && approvals.some((a: any) => !a.approved)) {
    return "pending_approvals";
  }
  // Check FX
  if (fxQuote && (!fxQuote.locked || (fxQuote.expires_at && new Date(fxQuote.expires_at) < new Date()))) {
    return "pending_conditions";
  }
  return "eligible";
}

// ---------- Waterfall Calculator ----------
function calculateWaterfall(
  totalConsideration: number,
  tiers: { id: string; tier_rank: number; name: string; allocation_logic_type: string; params: any }[],
  recipients: { id: string; name: string; ownership_pct: number }[]
) {
  const sorted = [...tiers].sort((a, b) => a.tier_rank - b.tier_rank);
  let remaining = totalConsideration;
  const lines: any[] = [];

  for (const tier of sorted) {
    if (remaining <= 0) break;
    let tierAmount = 0;

    switch (tier.allocation_logic_type) {
      case "fixed":
        tierAmount = Math.min(tier.params.amount || 0, remaining);
        break;
      case "percentage":
        tierAmount = Math.min(totalConsideration * (tier.params.percentage || 0) / 100, remaining);
        break;
      case "pro_rata":
        tierAmount = Math.min(tier.params.pool_amount || remaining, remaining);
        break;
      case "threshold":
        tierAmount = Math.min(tier.params.cap || remaining, remaining);
        break;
    }

    remaining -= tierAmount;

    // Distribute to recipients based on tier params
    const tierRecipients = tier.params.recipient_ids
      ? recipients.filter((r: any) => tier.params.recipient_ids.includes(r.id))
      : recipients;

    if (tier.allocation_logic_type === "pro_rata" && tierRecipients.length > 0) {
      const totalPct = tierRecipients.reduce((s: number, r: any) => s + r.ownership_pct, 0);
      for (const r of tierRecipients) {
        const share = totalPct > 0 ? (r.ownership_pct / totalPct) * tierAmount : tierAmount / tierRecipients.length;
        lines.push({
          tier_id: tier.id,
          tier_name: tier.name,
          recipient_id: r.id,
          recipient_name: r.name,
          consideration_type: tier.params.consideration_type || "cash",
          amount_original: Math.round(share * 100) / 100,
          currency_original: tier.params.currency || "USD",
          settlement_currency: tier.params.settlement_currency || "USD",
          priority_rank: tier.tier_rank,
        });
      }
    } else if (tierRecipients.length > 0) {
      const perRecipient = tierAmount / tierRecipients.length;
      for (const r of tierRecipients) {
        lines.push({
          tier_id: tier.id,
          tier_name: tier.name,
          recipient_id: r.id,
          recipient_name: r.name,
          consideration_type: tier.params.consideration_type || "cash",
          amount_original: Math.round(perRecipient * 100) / 100,
          currency_original: tier.params.currency || "USD",
          settlement_currency: tier.params.settlement_currency || "USD",
          priority_rank: tier.tier_rank,
        });
      }
    }
  }

  // Version hash
  const hashInput = JSON.stringify({ totalConsideration, tiers: sorted.map(t => ({ id: t.id, params: t.params })), lines });
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  // Simple hash for demo
  let hash = 0;
  for (const byte of data) { hash = ((hash << 5) - hash + byte) | 0; }
  const versionHash = `wf-${Math.abs(hash).toString(16).padStart(8, "0")}`;

  return { lines, versionHash, remaining, totalAllocated: totalConsideration - remaining };
}

// ---------- Mock Provider ----------
const MockProvider = {
  initiateDisbursement(intent: any) {
    return {
      provider_ref: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "executing",
      message: "Mock wire initiated",
    };
  },
  getStatus(providerRef: string) {
    return { status: "executed", settled_at: new Date().toISOString() };
  },
  validateBeneficiary(bankAccountRef: string) {
    return { valid: true, holder_name: "Verified Account", institution: "Mock Bank" };
  },
};

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method === "POST" ? await req.json() : {};
    const supabase = createClient(supabaseUrl, serviceKey);

    switch (action) {
      // ---- Evaluate intent eligibility ----
      case "evaluate": {
        const { intent_id } = body;
        const { data: intent } = await supabase
          .from("disbursement_intents")
          .select("*")
          .eq("id", intent_id)
          .single();
        if (!intent) return new Response(JSON.stringify({ error: "Intent not found" }), { status: 404, headers: corsHeaders });

        let fxQuote = null;
        if (intent.fx_quote_id) {
          const { data } = await supabase.from("fx_quotes").select("*").eq("id", intent.fx_quote_id).single();
          fxQuote = data;
        }

        const newStatus = evaluateEligibility(intent as DisbursementIntent, fxQuote);
        if (newStatus !== intent.status) {
          await supabase.from("disbursement_intents").update({ status: newStatus }).eq("id", intent_id);
          await supabase.from("audit_events").insert({
            deal_id: intent.deal_id,
            actor_id: userId,
            entity_type: "disbursement_intent",
            entity_id: intent_id,
            event_type: "status_changed",
            before: { status: intent.status },
            after: { status: newStatus },
          });
        }

        return new Response(JSON.stringify({ intent_id, previous_status: intent.status, new_status: newStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Execute intent (mock provider) ----
      case "execute": {
        const { intent_id } = body;
        const { data: intent } = await supabase
          .from("disbursement_intents")
          .select("*")
          .eq("id", intent_id)
          .single();
        if (!intent) return new Response(JSON.stringify({ error: "Intent not found" }), { status: 404, headers: corsHeaders });
        if (intent.status !== "eligible") {
          return new Response(JSON.stringify({ error: "Intent not eligible for execution", status: intent.status }), { status: 400, headers: corsHeaders });
        }

        // Tax form gate — check all recipients have satisfied forms
        const { data: taxRecipients } = await supabase
          .from("tax_recipients")
          .select("id, name, recipient_type, tax_residency")
          .eq("deal_id", intent.deal_id);

        if (taxRecipients && taxRecipients.length > 0) {
          const { data: taxForms } = await supabase.from("tax_forms").select("*").eq("deal_id", intent.deal_id);
          const allForms = taxForms || [];
          const today = new Date().toISOString().slice(0, 10);
          const missing: string[] = [];

          for (const tr of taxRecipients) {
            const rf = tr.tax_residency === "us" ? "W9" : (tr.recipient_type === "individual" ? "W8BEN" : "W8BENE");
            const satisfied = allForms.some((f: any) =>
              f.recipient_id === tr.id && f.form_type === rf &&
              ["received", "verified"].includes(f.status) &&
              (f.expires_on === null || f.expires_on >= today)
            );
            if (!satisfied) missing.push(`${tr.name} (${rf})`);
          }

          if (missing.length > 0) {
            return new Response(JSON.stringify({
              error: "Execution blocked: missing tax forms",
              missing_forms: missing,
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        const result = MockProvider.initiateDisbursement(intent);
        await supabase.from("disbursement_intents").update({
          status: "executing",
          provider_ref: result.provider_ref,
        }).eq("id", intent_id);

        await supabase.from("audit_events").insert({
          deal_id: intent.deal_id,
          actor_id: userId,
          entity_type: "disbursement_intent",
          entity_id: intent_id,
          event_type: "execution_initiated",
          before: { status: "eligible" },
          after: { status: "executing", provider_ref: result.provider_ref },
        });

        return new Response(JSON.stringify({ success: true, provider_ref: result.provider_ref }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Simulate webhook (mock settlement) ----
      case "simulate-webhook": {
        const { intent_id, new_status } = body;
        const validStatuses = ["executed", "settled", "reconciled", "failed"];
        if (!validStatuses.includes(new_status)) {
          return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: corsHeaders });
        }

        const { data: intent } = await supabase
          .from("disbursement_intents")
          .select("*")
          .eq("id", intent_id)
          .single();
        if (!intent) return new Response(JSON.stringify({ error: "Intent not found" }), { status: 404, headers: corsHeaders });

        await supabase.from("disbursement_intents").update({ status: new_status }).eq("id", intent_id);
        await supabase.from("audit_events").insert({
          deal_id: intent.deal_id,
          actor_id: null,
          entity_type: "disbursement_intent",
          entity_id: intent_id,
          event_type: "webhook_received",
          before: { status: intent.status },
          after: { status: new_status },
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Calculate waterfall ----
      case "calculate-waterfall": {
        const { deal_id, total_consideration, tiers, recipients } = body;
        const result = calculateWaterfall(total_consideration, tiers, recipients);

        // Store allocation snapshot
        const { data: allocation } = await supabase.from("waterfall_allocations").insert({
          deal_id,
          calculation_version_hash: result.versionHash,
          input_totals: { total_consideration, tier_count: tiers.length, recipient_count: recipients.length },
          output_summary: { total_allocated: result.totalAllocated, remaining: result.remaining, line_count: result.lines.length },
        }).select().single();

        if (allocation) {
          // Insert allocation lines
          const lineInserts = result.lines.map((l: any) => ({
            waterfall_allocation_id: allocation.id,
            recipient_id: l.recipient_id,
            consideration_type: l.consideration_type,
            amount_original: l.amount_original,
            currency_original: l.currency_original,
            settlement_currency: l.settlement_currency,
            priority_rank: l.priority_rank,
          }));
          await supabase.from("waterfall_allocation_lines").insert(lineInserts);

          // Auto-create disbursement intents for cash lines
          const cashLines = result.lines.filter((l: any) => l.consideration_type === "cash");
          for (const line of cashLines) {
            await supabase.from("disbursement_intents").insert({
              deal_id,
              recipient_id: line.recipient_id,
              amount_original: line.amount_original,
              currency_original: line.currency_original,
              settlement_currency: line.settlement_currency,
              consideration_type: "cash",
              waterfall_allocation_id: allocation.id,
              status: "draft",
              required_conditions: [],
              required_approvals: [
                { role: "BUYER_COUNSEL", approved: false },
                { role: "SELLER_COUNSEL", approved: false },
              ],
            });
          }

          // Auto-create consideration records for non-cash lines
          const nonCashLines = result.lines.filter((l: any) => l.consideration_type !== "cash");
          for (const line of nonCashLines) {
            await supabase.from("consideration_records").insert({
              deal_id,
              recipient_id: line.recipient_id,
              type: line.consideration_type,
              status: "draft",
              terms: { amount: line.amount_original, currency: line.currency_original },
            });
          }

          await supabase.from("audit_events").insert({
            deal_id,
            actor_id: userId,
            entity_type: "waterfall",
            entity_id: allocation.id,
            event_type: "calculated",
            before: {},
            after: { version_hash: result.versionHash, lines: result.lines.length },
          });
        }

        return new Response(JSON.stringify({ allocation_id: allocation?.id, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Create FX quote ----
      case "create-fx-quote": {
        const { deal_id, base_currency, quote_currency } = body;
        // Mock FX rate
        const mockRates: Record<string, number> = {
          "USD/EUR": 0.92, "EUR/USD": 1.087, "USD/GBP": 0.79, "GBP/USD": 1.265,
          "USD/CHF": 0.88, "USD/JPY": 149.5, "USD/CAD": 1.36, "USD/AUD": 1.53,
        };
        const pair = `${base_currency}/${quote_currency}`;
        const rate = mockRates[pair] || 1.0 + (Math.random() * 0.1 - 0.05);
        const spreadBps = 15 + Math.floor(Math.random() * 10);

        const { data: quote } = await supabase.from("fx_quotes").insert({
          deal_id,
          base_currency,
          quote_currency,
          rate: Math.round(rate * 100000) / 100000,
          source: "mock",
          spread_bps: spreadBps,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
          risk_bearer: "buyer",
        }).select().single();

        if (quote) {
          await supabase.from("audit_events").insert({
            deal_id,
            actor_id: userId,
            entity_type: "fx_quote",
            entity_id: quote.id,
            event_type: "created",
            before: {},
            after: { rate: quote.rate, pair, spread_bps: spreadBps },
          });
        }

        return new Response(JSON.stringify(quote), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Lock FX quote ----
      case "lock-fx-quote": {
        const { quote_id } = body;
        const { data: quote } = await supabase.from("fx_quotes").select("*").eq("id", quote_id).single();
        if (!quote) return new Response(JSON.stringify({ error: "Quote not found" }), { status: 404, headers: corsHeaders });

        await supabase.from("fx_quotes").update({ locked: true, locked_at: new Date().toISOString() }).eq("id", quote_id);
        await supabase.from("audit_events").insert({
          deal_id: quote.deal_id,
          actor_id: userId,
          entity_type: "fx_quote",
          entity_id: quote_id,
          event_type: "locked",
          before: { locked: false },
          after: { locked: true },
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ---- Validate beneficiary ----
      case "validate-beneficiary": {
        const { bank_account_ref } = body;
        const result = MockProvider.validateBeneficiary(bank_account_ref);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action", available: [
          "evaluate", "execute", "simulate-webhook", "calculate-waterfall",
          "create-fx-quote", "lock-fx-quote", "validate-beneficiary",
        ] }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
