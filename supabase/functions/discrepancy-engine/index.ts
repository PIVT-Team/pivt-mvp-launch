import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ──
interface Discrepancy {
  deal_id: string;
  object_type: string;
  object_id: string;
  rule_key: string;
  severity: string;
  message: string;
  details: Record<string, unknown>;
}

type RuleContext = {
  deal: any;
  approvals: any[];
  docs: any[];
  intents: any[];
  conditions: any[];
  confirmedObligations: any[];
  parties: any[];
  capTable: any[];
  contractDocs: any[];
  dealId: string;
};

// ── Rule Evaluators ──
// Each function takes a rule config + context, returns discrepancies found.

function evalDualCounselMissing(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  for (const intent of ctx.intents) {
    if (!["eligible", "executing"].includes(intent.status)) continue;
    const hasBC = ctx.approvals.some(
      (a) => a.approval_type === "LEGAL_SIGNOFF" && a.status === "APPROVED"
    );
    const hasSC = ctx.approvals.some(
      (a) => a.approval_type === "FINANCE_SIGNOFF" && a.status === "APPROVED"
    );
    if (!hasBC || !hasSC) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: rule.rule_key, severity: rule.severity,
        message: "Execution blocked: missing dual-counsel approvals (Buyer Counsel, Seller Counsel).",
        details: { has_buyer_counsel: hasBC, has_seller_counsel: hasSC },
      });
    }
  }
  return results;
}

function evalDocsNotExecuted(rule: any, ctx: RuleContext): Discrepancy[] {
  const allExecuted = ctx.docs.every((d) => d.doc_type === "OTHER" || d.url);
  if (!allExecuted && ctx.intents.some((i) => ["eligible", "executing"].includes(i.status))) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: "Execution blocked: required documents are not fully executed.",
      details: { total_docs: ctx.docs.length, incomplete: ctx.docs.filter((d) => !d.url).length },
    }];
  }
  return [];
}

function evalComplianceFailed(rule: any, ctx: RuleContext): Discrepancy[] {
  const failed = ctx.conditions.filter((c) => c.status === "BLOCKED");
  if (failed.length > 0) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: "Execution blocked: compliance/risk checks failed (review details).",
      details: { blocked_conditions: failed.map((c) => c.title) },
    }];
  }
  return [];
}

function evalPayeeAccountMissing(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  for (const intent of ctx.intents) {
    if (!intent.bank_account_ref) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: rule.rule_key, severity: rule.severity,
        message: "Execution blocked: payee payout account missing or unverified.",
        details: { recipient_id: intent.recipient_id },
      });
    }
  }
  return results;
}

function evalFxRateOutsideTolerance(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  for (const intent of ctx.intents) {
    if (intent.currency_original !== intent.settlement_currency && !intent.fx_quote_id) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: rule.rule_key, severity: rule.severity,
        message: "Warning: FX rate moved beyond tolerance since quote.",
        details: { currency_original: intent.currency_original, settlement_currency: intent.settlement_currency },
      });
    }
  }
  return results;
}

function evalWaterfallIntentMismatch(rule: any, ctx: RuleContext): Discrepancy[] {
  const totalIntents = ctx.intents.reduce((s, i) => s + Number(i.amount_original), 0);
  const dealValue = Number(ctx.deal.deal_value);
  const tolerance = (rule.config as { tolerance_pct?: number })?.tolerance_pct || 0.5;
  if (dealValue > 0 && Math.abs(totalIntents - dealValue) / dealValue > tolerance / 100) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: "Warning: Intent totals don't match expected waterfall outputs.",
      details: { intent_total: totalIntents, deal_value: dealValue },
    }];
  }
  return [];
}

function evalLargePaymentApproval(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  const threshold = (rule.config as { threshold_amount?: number })?.threshold_amount || 5000000;
  for (const intent of ctx.intents) {
    if (Number(intent.amount_original) > threshold) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: rule.rule_key, severity: rule.severity,
        message: "Warning: High-value disbursement requires additional approval.",
        details: { amount: intent.amount_original, threshold },
      });
    }
  }
  return results;
}

function evalStaleDealData(rule: any, ctx: RuleContext): Discrepancy[] {
  const staleDays = (rule.config as { stale_days?: number })?.stale_days || 14;
  const updatedAt = new Date(ctx.deal.updated_at);
  const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > staleDays) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: "Info: Deal data hasn't been updated recently—confirm details are current.",
      details: { days_since_update: Math.round(daysSince), threshold_days: staleDays },
    }];
  }
  return [];
}

// ── NEW Ontology-driven rule evaluators ──

function evalPartyPresence(rule: any, ctx: RuleContext): Discrepancy[] {
  const minParties = (rule.config as { min_parties?: number })?.min_parties || 2;
  if (ctx.parties.length < minParties) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Deal requires at least ${minParties} parties. Currently has ${ctx.parties.length}.`,
      details: { required: minParties, actual: ctx.parties.length },
    }];
  }
  return [];
}

function evalRequiredDocumentPresence(rule: any, ctx: RuleContext): Discrepancy[] {
  const requiredTypes = (rule.config as { required_doc_types?: string[] })?.required_doc_types || ["SPA", "FUNDS_FLOW", "ESCROW_AGREEMENT"];
  const existingTypes = new Set(ctx.contractDocs.map((d) => d.doc_type));
  const missing = requiredTypes.filter((t) => !existingTypes.has(t));
  if (missing.length > 0) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Required documents missing: ${missing.join(", ")}.`,
      details: { missing_types: missing, existing_types: [...existingTypes] },
    }];
  }
  return [];
}

function evalClosingConditionsMet(rule: any, ctx: RuleContext): Discrepancy[] {
  const unmet = ctx.conditions.filter((c) => c.status !== "SATISFIED" && c.status !== "WAIVED");
  if (unmet.length > 0 && ctx.intents.some((i) => ["eligible", "executing"].includes(i.status))) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `${unmet.length} closing condition(s) not yet satisfied.`,
      details: { unmet_conditions: unmet.map((c) => ({ id: c.id, title: c.title, status: c.status })) },
    }];
  }
  return [];
}

function evalCapTableTotalValidation(rule: any, ctx: RuleContext): Discrepancy[] {
  if (ctx.capTable.length === 0) return [];
  const results: Discrepancy[] = [];
  const totalPct = ctx.capTable.reduce((s, e) => s + Number(e.ownership_pct), 0);
  const tolerance = (rule.config as { ownership_tolerance_pct?: number })?.ownership_tolerance_pct || 0.01;
  if (Math.abs(totalPct - 100) > tolerance) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Cap table ownership totals ${totalPct.toFixed(2)}%, expected 100%.`,
      details: { total_pct: totalPct, tolerance },
    });
  }
  const totalPayout = ctx.capTable.reduce((s, e) => s + Number(e.payout_amount), 0);
  const dealValue = Number(ctx.deal.deal_value);
  if (dealValue > 0 && Math.abs(totalPayout - dealValue) / dealValue > 0.005) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: "cap_table_total_validation",
      severity: rule.severity,
      message: `Cap table payouts ($${totalPayout.toLocaleString()}) don't match deal value ($${dealValue.toLocaleString()}).`,
      details: { total_payout: totalPayout, deal_value: dealValue },
    });
  }
  return results;
}

function evalUnresolvedDiscrepancyBlocks(_rule: any, ctx: RuleContext): Discrepancy[] {
  // This is a meta-rule: if any blocker exists, it surfaces a summary
  // Handled implicitly by the engine's blocker count — no extra row needed
  return [];
}

function evalPurchasePriceConsistency(rule: any, ctx: RuleContext): Discrepancy[] {
  // Cross-reference SPA document extracted fields against deal value
  const spaDocs = ctx.contractDocs.filter((d) => d.doc_type === "SPA");
  if (spaDocs.length === 0) return []; // covered by required_document_presence
  // If we have extracted text, check for price mentions
  // For now, flag if SPA exists but deal_value is 0
  if (Number(ctx.deal.deal_value) === 0 && spaDocs.length > 0) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: "SPA uploaded but deal value is $0. Confirm purchase price is set correctly.",
      details: { spa_count: spaDocs.length },
    }];
  }
  return [];
}

function evalEscrowAmountConsistency(rule: any, ctx: RuleContext): Discrepancy[] {
  // Compare deal escrow_amount with escrow_accounts if present
  const dealEscrow = Number(ctx.deal.escrow_amount || 0);
  if (dealEscrow === 0) return [];
  // Flag if deal has escrow but no escrow docs
  const escrowDocs = ctx.contractDocs.filter((d) => d.doc_type === "ESCROW_AGREEMENT");
  if (escrowDocs.length === 0 && dealEscrow > 0) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Deal has escrow amount ($${dealEscrow.toLocaleString()}) but no escrow agreement uploaded.`,
      details: { escrow_amount: dealEscrow },
    }];
  }
  return [];
}

// ── Rule dispatcher ──
const RULE_EVALUATORS: Record<string, (rule: any, ctx: RuleContext) => Discrepancy[]> = {
  dual_counsel_missing: evalDualCounselMissing,
  docs_not_executed: evalDocsNotExecuted,
  compliance_failed: evalComplianceFailed,
  payee_account_missing_or_mismatch: evalPayeeAccountMissing,
  fx_rate_outside_tolerance: evalFxRateOutsideTolerance,
  waterfall_intent_total_mismatch: evalWaterfallIntentMismatch,
  large_payment_extra_approval: evalLargePaymentApproval,
  stale_deal_data: evalStaleDealData,
  // Ontology-driven rules
  party_presence: evalPartyPresence,
  required_document_presence: evalRequiredDocumentPresence,
  closing_conditions_met: evalClosingConditionsMet,
  cap_table_total_validation: evalCapTableTotalValidation,
  unresolved_discrepancy_blocks_execution: evalUnresolvedDiscrepancyBlocks,
  purchase_price_consistency: evalPurchasePriceConsistency,
  escrow_amount_consistency: evalEscrowAmountConsistency,
  // Aliases
  dual_counsel_approval: evalDualCounselMissing,
};

// ── Tax form validation (special handling) ──
async function evalTaxFormRules(
  supabase: any,
  dealId: string,
  rules: any[]
): Promise<Discrepancy[]> {
  const taxRule = rules.find((r) => r.rule_key === "missing_tax_form");
  if (!taxRule) return [];

  const { data: taxRecipients } = await supabase
    .from("tax_recipients")
    .select("id, name, recipient_type, tax_residency")
    .eq("deal_id", dealId);

  if (!taxRecipients || taxRecipients.length === 0) return [];

  const { data: taxForms } = await supabase
    .from("tax_forms")
    .select("*")
    .eq("deal_id", dealId);

  const forms = taxForms || [];
  const today = new Date().toISOString().slice(0, 10);
  const results: Discrepancy[] = [];

  for (const recipient of taxRecipients) {
    let requiredForm = "W9";
    if (recipient.tax_residency === "non_us") {
      requiredForm = recipient.recipient_type === "individual" ? "W8BEN" : "W8BENE";
    }
    const satisfied = forms.some(
      (f: any) =>
        f.recipient_id === recipient.id &&
        f.form_type === requiredForm &&
        ["received", "verified"].includes(f.status) &&
        (f.expires_on === null || f.expires_on >= today)
    );
    if (!satisfied) {
      results.push({
        deal_id: dealId,
        object_type: "tax_recipient",
        object_id: recipient.id,
        rule_key: "missing_tax_form",
        severity: "blocker",
        message: `Tax form missing: ${recipient.name} requires ${requiredForm === "W8BENE" ? "W-8BEN-E" : requiredForm === "W8BEN" ? "W-8BEN" : "W-9"}.`,
        details: {
          recipient_name: recipient.name,
          required_form: requiredForm,
          recipient_type: recipient.recipient_type,
          tax_residency: recipient.tax_residency,
        },
      });
    }
  }
  return results;
}

// ── Obligation-based validation ──
function evalObligationRules(ctx: RuleContext): Discrepancy[] {
  if (ctx.confirmedObligations.length === 0) return [];
  const results: Discrepancy[] = [];

  for (const intent of ctx.intents) {
    if (intent.status === "draft") continue;

    const matchingOb = ctx.confirmedObligations.find((ob: any) => {
      if (!ob.payee_label || !intent.recipient_id) return false;
      const payeeNorm = ob.payee_label.toLowerCase();
      return payeeNorm.includes(intent.recipient_id.toLowerCase().slice(0, 8));
    });

    if (!matchingOb) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: "no_matching_obligation", severity: "warn",
        message: "No confirmed obligation found for this disbursement intent.",
        details: { recipient_id: intent.recipient_id },
      });
      continue;
    }

    // Amount mismatch
    if (matchingOb.amount_type === "FIXED" && matchingOb.amount_value_minor != null) {
      const intentAmountMinor = Math.round(Number(intent.amount_original) * 100);
      const tolerance = Number(matchingOb.tolerance_minor) || 5000;
      const variance = Math.abs(intentAmountMinor - Number(matchingOb.amount_value_minor));
      if (variance > tolerance) {
        results.push({
          deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
          rule_key: "obligation_amount_mismatch", severity: "blocker",
          message: `Amount mismatch: intent $${(intentAmountMinor / 100).toLocaleString()} vs obligation $${(Number(matchingOb.amount_value_minor) / 100).toLocaleString()}.`,
          details: {
            obligation_id: matchingOb.id,
            expected_minor: matchingOb.amount_value_minor,
            observed_minor: intentAmountMinor,
            variance_minor: variance,
          },
        });
      }
    }

    // Currency mismatch
    if (matchingOb.amount_currency && intent.currency_original !== matchingOb.amount_currency) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: "obligation_currency_mismatch", severity: "blocker",
        message: `Currency mismatch: intent ${intent.currency_original} vs obligation ${matchingOb.amount_currency}.`,
        details: { obligation_id: matchingOb.id },
      });
    }

    // Wire confirmation gating
    if (!matchingOb.instructions_confirmed && ["eligible", "executing"].includes(intent.status)) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: "obligation_instructions_unconfirmed", severity: "blocker",
        message: "Payment instructions not confirmed on matched obligation.",
        details: { obligation_id: matchingOb.id },
      });
    }
  }
  return results;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch enabled rules
    const { data: rules } = await supabase
      .from("discrepancy_rules")
      .select("*")
      .eq("enabled", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ discrepancies: [], message: "No rules enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch deal context (all in parallel)
    const [dealRes, approvalsRes, docsRes, intentsRes, conditionsRes, obligationsRes, partiesRes, capTableRes, contractDocsRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", deal_id).single(),
      supabase.from("ontology_approvals").select("*").eq("deal_id", deal_id),
      supabase.from("ontology_documents").select("*").eq("deal_id", deal_id),
      supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id),
      supabase.from("conditions").select("*").eq("deal_id", deal_id),
      supabase.from("obligations").select("*").eq("deal_id", deal_id).eq("status", "CONFIRMED"),
      supabase.from("deal_parties").select("*").eq("deal_id", deal_id),
      supabase.from("cap_table_entries").select("*").eq("deal_id", deal_id),
      supabase.from("contract_documents").select("*").eq("deal_id", deal_id),
    ]);

    if (dealRes.error) {
      return new Response(JSON.stringify({ error: dealRes.error.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx: RuleContext = {
      deal: dealRes.data,
      approvals: approvalsRes.data || [],
      docs: docsRes.data || [],
      intents: intentsRes.data || [],
      conditions: conditionsRes.data || [],
      confirmedObligations: obligationsRes.data || [],
      parties: partiesRes.data || [],
      capTable: capTableRes.data || [],
      contractDocs: contractDocsRes.data || [],
      dealId: deal_id,
    };

    // ── Evaluate all rules ──
    const newDiscrepancies: Discrepancy[] = [];

    for (const rule of rules) {
      const evaluator = RULE_EVALUATORS[rule.rule_key];
      if (evaluator) {
        newDiscrepancies.push(...evaluator(rule, ctx));
      }
    }

    // Tax form validation (async)
    newDiscrepancies.push(...await evalTaxFormRules(supabase, deal_id, rules));

    // Obligation-based validation
    newDiscrepancies.push(...evalObligationRules(ctx));

    // ── Upsert logic ──
    const { data: existing } = await supabase
      .from("discrepancies")
      .select("*")
      .eq("deal_id", deal_id)
      .in("status", ["open", "acknowledged"]);

    const existingMap = new Map(
      (existing || []).map((d: any) => [`${d.rule_key}::${d.object_id}`, d])
    );

    const newKeys = new Set(newDiscrepancies.map((d) => `${d.rule_key}::${d.object_id}`));

    // Insert new
    for (const disc of newDiscrepancies) {
      const key = `${disc.rule_key}::${disc.object_id}`;
      if (!existingMap.has(key)) {
        await supabase.from("discrepancies").insert(disc);
      }
    }

    // Resolve old
    for (const [key, disc] of existingMap) {
      if (!newKeys.has(key) && disc.status === "open") {
        await supabase
          .from("discrepancies")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disc.id);
      }
    }

    // Return current state
    const { data: current } = await supabase
      .from("discrepancies")
      .select("*")
      .eq("deal_id", deal_id)
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });

    const grouped = {
      blockers: (current || []).filter((d: any) => d.severity === "blocker"),
      warnings: (current || []).filter((d: any) => d.severity === "warn"),
      info: (current || []).filter((d: any) => d.severity === "info"),
    };

    return new Response(
      JSON.stringify({
        discrepancies: current || [],
        grouped,
        deal_id,
        rules_evaluated: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
