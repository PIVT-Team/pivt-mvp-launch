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
  dealDocuments: any[];
  requiredMatrix: any[];
  escrowAccounts: any[];
  dealId: string;
};

// ── Helper: get extracted field from contract docs ──
function getExtractedField(docs: any[], docType: string, fieldName: string): any {
  const doc = docs.find((d) => d.doc_type === docType && d.extracted_fields);
  return doc?.extracted_fields?.[fieldName] ?? null;
}

function getExtractedDoc(docs: any[], docType: string): any | null {
  return docs.find((d) => d.doc_type === docType) || null;
}

function hasDocType(docs: any[], docType: string): boolean {
  return docs.some((d) => d.doc_type === docType);
}

// ══════════════════════════════════════
// ── RULE EVALUATORS ──
// ══════════════════════════════════════

// ── Core Closing Blockers ──

function evalMissingCoreDocs(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const docTypes = new Set(allDocs.map((d) => (d.doc_type || "").toUpperCase()));

  // SPA always required
  if (!docTypes.has("SPA")) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: "blocker",
      message: "Missing required document: Share Purchase Agreement (SPA).",
      details: { missing_type: "SPA", requirement_group: "Core Closing" },
    });
  }

  // Funds Flow always required
  if (!docTypes.has("FUNDS_FLOW")) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: "blocker",
      message: "Missing required document: Funds Flow Memo.",
      details: { missing_type: "FUNDS_FLOW", requirement_group: "Core Closing" },
    });
  }

  // Escrow agreement required if escrow > 0
  if (Number(ctx.deal.escrow_amount || 0) > 0 && !docTypes.has("ESCROW_AGREEMENT")) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: "blocker",
      message: `Missing required document: Escrow Agreement (deal has $${Number(ctx.deal.escrow_amount).toLocaleString()} escrow).`,
      details: { missing_type: "ESCROW_AGREEMENT", escrow_amount: ctx.deal.escrow_amount, requirement_group: "Core Closing" },
    });
  }

  return results;
}

function evalPurchasePriceConsistency(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const dealValue = Number(ctx.deal.deal_value);
  if (dealValue === 0) return [];

  // Check SPA extracted purchase_price
  const spaPurchasePrice = getExtractedField(allDocs, "SPA", "purchase_price") ??
                           getExtractedField(allDocs, "spa", "purchase_price");
  if (spaPurchasePrice != null) {
    const spaPrice = Number(spaPurchasePrice);
    const tolerance = ((rule.config as any)?.tolerance_pct || 0.5) / 100;
    if (Math.abs(spaPrice - dealValue) / dealValue > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Purchase price mismatch: SPA states $${spaPrice.toLocaleString()} but deal value is $${dealValue.toLocaleString()}.`,
        details: { spa_price: spaPrice, deal_value: dealValue, variance_pct: ((spaPrice - dealValue) / dealValue * 100).toFixed(2) },
      });
    }
  }

  // Check Funds Flow total_uses vs deal value
  const ffTotalUses = getExtractedField(allDocs, "FUNDS_FLOW", "total_uses") ??
                      getExtractedField(allDocs, "funds_flow", "total_uses");
  if (ffTotalUses != null) {
    const totalUses = Number(ffTotalUses);
    const tolerance = ((rule.config as any)?.tolerance_pct || 0.5) / 100;
    if (Math.abs(totalUses - dealValue) / dealValue > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Funds flow total uses ($${totalUses.toLocaleString()}) doesn't match deal value ($${dealValue.toLocaleString()}).`,
        details: { ff_total_uses: totalUses, deal_value: dealValue },
      });
    }
  }

  return results;
}

function evalEscrowAmountConsistency(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  const dealEscrow = Number(ctx.deal.escrow_amount || 0);
  if (dealEscrow === 0) return [];

  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const tolerance = ((rule.config as any)?.tolerance_pct || 1) / 100;

  // Check escrow agreement extracted amount
  const escrowDocAmount = getExtractedField(allDocs, "ESCROW_AGREEMENT", "escrow_amount") ??
                          getExtractedField(allDocs, "escrow_agreement", "escrow_amount");
  if (escrowDocAmount != null) {
    const docAmount = Number(escrowDocAmount);
    if (Math.abs(docAmount - dealEscrow) / dealEscrow > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Escrow amount mismatch: Agreement states $${docAmount.toLocaleString()} but deal has $${dealEscrow.toLocaleString()}.`,
        details: { doc_escrow: docAmount, deal_escrow: dealEscrow },
      });
    }
  }

  // Check funds flow escrow line
  const ffEscrow = getExtractedField(allDocs, "FUNDS_FLOW", "escrow_amount") ??
                   getExtractedField(allDocs, "funds_flow", "escrow_amount");
  if (ffEscrow != null) {
    const ffAmount = Number(ffEscrow);
    if (Math.abs(ffAmount - dealEscrow) / dealEscrow > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Escrow mismatch: Funds flow escrow line ($${ffAmount.toLocaleString()}) vs deal escrow ($${dealEscrow.toLocaleString()}).`,
        details: { ff_escrow: ffAmount, deal_escrow: dealEscrow },
      });
    }
  }

  // No escrow doc at all
  if (escrowDocAmount == null && !hasDocType(allDocs, "ESCROW_AGREEMENT") && !hasDocType(allDocs, "escrow_agreement")) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: "blocker",
      message: `Deal has escrow ($${dealEscrow.toLocaleString()}) but no escrow agreement uploaded.`,
      details: { deal_escrow: dealEscrow },
    });
  }

  return results;
}

function evalFundsFlowArithmetic(rule: any, ctx: RuleContext): Discrepancy[] {
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const results: Discrepancy[] = [];
  const tolerance = (rule.config as any)?.tolerance_amount || 100;

  const totalSources = getExtractedField(allDocs, "FUNDS_FLOW", "total_sources") ??
                       getExtractedField(allDocs, "funds_flow", "total_sources");
  const totalUses = getExtractedField(allDocs, "FUNDS_FLOW", "total_uses") ??
                    getExtractedField(allDocs, "funds_flow", "total_uses");
  const lineItems = getExtractedField(allDocs, "FUNDS_FLOW", "line_items") ??
                    getExtractedField(allDocs, "funds_flow", "line_items");

  if (totalSources != null && totalUses != null) {
    if (Math.abs(Number(totalSources) - Number(totalUses)) > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Funds flow imbalance: sources ($${Number(totalSources).toLocaleString()}) ≠ uses ($${Number(totalUses).toLocaleString()}).`,
        details: { total_sources: totalSources, total_uses: totalUses },
      });
    }
  }

  if (lineItems && Array.isArray(lineItems) && totalUses != null) {
    const sumItems = lineItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    if (Math.abs(sumItems - Number(totalUses)) > tolerance) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Funds flow line items sum ($${sumItems.toLocaleString()}) ≠ total uses ($${Number(totalUses).toLocaleString()}).`,
        details: { line_items_sum: sumItems, total_uses: totalUses, line_count: lineItems.length },
      });
    }
  }

  return results;
}

function evalPartyNameAlignment(rule: any, ctx: RuleContext): Discrepancy[] {
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const results: Discrepancy[] = [];

  const spaBuyer = getExtractedField(allDocs, "SPA", "buyer_name") ??
                   getExtractedField(allDocs, "spa", "buyer_name");
  const spaSeller = getExtractedField(allDocs, "SPA", "seller_name") ??
                    getExtractedField(allDocs, "spa", "seller_name");

  if (spaBuyer && ctx.deal.buyer) {
    const buyerNorm = spaBuyer.toLowerCase().trim();
    const dealBuyerNorm = ctx.deal.buyer.toLowerCase().trim();
    if (!buyerNorm.includes(dealBuyerNorm) && !dealBuyerNorm.includes(buyerNorm)) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "warn",
        message: `Buyer name mismatch: SPA says "${spaBuyer}" but deal has "${ctx.deal.buyer}".`,
        details: { spa_buyer: spaBuyer, deal_buyer: ctx.deal.buyer },
      });
    }
  }

  if (spaSeller && ctx.deal.seller) {
    const sellerNorm = spaSeller.toLowerCase().trim();
    const dealSellerNorm = ctx.deal.seller.toLowerCase().trim();
    if (!sellerNorm.includes(dealSellerNorm) && !dealSellerNorm.includes(sellerNorm)) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "warn",
        message: `Seller name mismatch: SPA says "${spaSeller}" but deal has "${ctx.deal.seller}".`,
        details: { spa_seller: spaSeller, deal_seller: ctx.deal.seller },
      });
    }
  }

  return results;
}

// ── Binder Warnings ──

function evalDocTypeWarning(docType: string, label: string, ruleKey: string) {
  return (rule: any, ctx: RuleContext): Discrepancy[] => {
    const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
    if (!hasDocType(allDocs, docType) && !hasDocType(allDocs, docType.toLowerCase())) {
      return [{
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: ruleKey, severity: rule.severity,
        message: `${label} has not been uploaded.`,
        details: { missing_type: docType },
      }];
    }
    return [];
  };
}

// ── Required Document Matrix ──

function evalRequiredDocumentMatrix(rule: any, ctx: RuleContext): Discrepancy[] {
  if (ctx.requiredMatrix.length === 0) return [];
  const results: Discrepancy[] = [];
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const docTypes = new Set(allDocs.map((d) => (d.doc_type || "").toUpperCase()));

  for (const req of ctx.requiredMatrix) {
    if (!req.is_required) continue;

    // Evaluate condition_expression
    if (req.condition_expression) {
      if (req.condition_expression === "escrow_amount > 0" && !(Number(ctx.deal.escrow_amount || 0) > 0)) continue;
    }

    if (!docTypes.has(req.doc_type.toUpperCase())) {
      results.push({
        deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
        rule_key: rule.rule_key, severity: "blocker",
        message: `Required by deal type: ${req.doc_type.replace(/_/g, " ")} (${req.requirement_group}).`,
        details: { doc_type: req.doc_type, requirement_group: req.requirement_group, deal_type: req.deal_type },
      });
    }
  }
  return results;
}

// ── Existing operational rules ──

function evalDualCounselMissing(rule: any, ctx: RuleContext): Discrepancy[] {
  const results: Discrepancy[] = [];
  for (const intent of ctx.intents) {
    if (!["eligible", "executing"].includes(intent.status)) continue;
    const hasBC = ctx.approvals.some((a) => a.approval_type === "LEGAL_SIGNOFF" && a.status === "APPROVED");
    const hasSC = ctx.approvals.some((a) => a.approval_type === "FINANCE_SIGNOFF" && a.status === "APPROVED");
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
      message: "Execution blocked: compliance/risk checks failed.",
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
  const tolerance = ((rule.config as any)?.tolerance_pct || 0.5) / 100;
  if (dealValue > 0 && Math.abs(totalIntents - dealValue) / dealValue > tolerance) {
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
  const threshold = (rule.config as any)?.threshold_amount || 5000000;
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
  const staleDays = (rule.config as any)?.stale_days || 14;
  const daysSince = (Date.now() - new Date(ctx.deal.updated_at).getTime()) / (1000 * 60 * 60 * 24);
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

function evalPartyPresence(rule: any, ctx: RuleContext): Discrepancy[] {
  const minParties = (rule.config as any)?.min_parties || 2;
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
  const tolerance = (rule.config as any)?.ownership_tolerance_pct || 0.01;
  if (Math.abs(totalPct - 100) > tolerance) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Cap table ownership totals ${totalPct.toFixed(2)}%, expected 100%.`,
      details: { total_pct: totalPct },
    });
  }
  const totalPayout = ctx.capTable.reduce((s, e) => s + Number(e.payout_amount), 0);
  const dealValue = Number(ctx.deal.deal_value);
  if (dealValue > 0 && Math.abs(totalPayout - dealValue) / dealValue > 0.005) {
    results.push({
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: rule.severity,
      message: `Cap table payouts ($${totalPayout.toLocaleString()}) don't match deal value ($${dealValue.toLocaleString()}).`,
      details: { total_payout: totalPayout, deal_value: dealValue },
    });
  }
  return results;
}

function evalIntentFundsFlowMismatch(rule: any, ctx: RuleContext): Discrepancy[] {
  const allDocs = [...ctx.contractDocs, ...ctx.dealDocuments];
  const ffTotalUses = getExtractedField(allDocs, "FUNDS_FLOW", "total_uses") ??
                      getExtractedField(allDocs, "funds_flow", "total_uses");
  if (ffTotalUses == null || ctx.intents.length === 0) return [];

  const intentTotal = ctx.intents.reduce((s, i) => s + Number(i.amount_original), 0);
  const tolerance = ((rule.config as any)?.tolerance_pct || 0.5) / 100;
  const ffTotal = Number(ffTotalUses);

  if (Math.abs(intentTotal - ffTotal) / ffTotal > tolerance) {
    return [{
      deal_id: ctx.dealId, object_type: "deal", object_id: ctx.dealId,
      rule_key: rule.rule_key, severity: "blocker",
      message: `Disbursement intents total ($${intentTotal.toLocaleString()}) ≠ funds flow total uses ($${ffTotal.toLocaleString()}).`,
      details: { intent_total: intentTotal, ff_total: ffTotal },
    }];
  }
  return [];
}

function noOp(): Discrepancy[] { return []; }

// ── Rule dispatcher ──
const RULE_EVALUATORS: Record<string, (rule: any, ctx: RuleContext) => Discrepancy[]> = {
  // Core closing
  missing_core_docs: evalMissingCoreDocs,
  purchase_price_consistency: evalPurchasePriceConsistency,
  escrow_amount_consistency: evalEscrowAmountConsistency,
  funds_flow_arithmetic: evalFundsFlowArithmetic,
  party_name_alignment: evalPartyNameAlignment,
  missing_officer_secretary_cert: evalDocTypeWarning("OFFICER_CERTIFICATE", "Officer Certificate", "missing_officer_secretary_cert"),
  // Payment execution
  intent_funds_flow_mismatch: evalIntentFundsFlowMismatch,
  wire_instructions_missing: evalPayeeAccountMissing,
  dual_counsel_approval: evalDualCounselMissing,
  dual_counsel_missing: evalDualCounselMissing,
  // Compliance
  kyc_passed: noOp, // evaluated via conditions
  kyb_passed: noOp,
  sanctions_clear: noOp,
  compliance_failed: evalComplianceFailed,
  // Binder warnings
  disclosure_schedules_missing: evalDocTypeWarning("DISCLOSURE_SCHEDULES", "Disclosure Schedules", "disclosure_schedules_missing"),
  legal_opinion_missing: evalDocTypeWarning("LEGAL_OPINION", "Legal Opinion", "legal_opinion_missing"),
  cap_table_missing: evalDocTypeWarning("CAP_TABLE", "Cap Table", "cap_table_missing"),
  working_capital_missing: evalDocTypeWarning("WORKING_CAPITAL_STATEMENT", "Working Capital Statement", "working_capital_missing"),
  board_consent_missing: evalDocTypeWarning("BOARD_CONSENT", "Board Consent", "board_consent_missing"),
  good_standing_missing: evalDocTypeWarning("GOOD_STANDING", "Good Standing Certificate", "good_standing_missing"),
  // Cross-document
  cap_table_total_validation: evalCapTableTotalValidation,
  waterfall_reconciliation: evalWaterfallIntentMismatch,
  // Operational
  docs_not_executed: evalDocsNotExecuted,
  payee_account_missing_or_mismatch: evalPayeeAccountMissing,
  fx_rate_outside_tolerance: evalFxRateOutsideTolerance,
  waterfall_intent_total_mismatch: evalWaterfallIntentMismatch,
  large_payment_extra_approval: evalLargePaymentApproval,
  stale_deal_data: evalStaleDealData,
  party_presence: evalPartyPresence,
  closing_conditions_met: evalClosingConditionsMet,
  required_document_presence: evalRequiredDocumentMatrix,
  unresolved_discrepancy_blocks_execution: noOp,
  audit_trail_completeness: noOp,
};

// ── Tax form validation ──
async function evalTaxFormRules(supabase: any, dealId: string, rules: any[]): Promise<Discrepancy[]> {
  const taxRule = rules.find((r) => r.rule_key === "missing_tax_form");
  if (!taxRule) return [];

  const { data: taxRecipients } = await supabase
    .from("tax_recipients").select("id, name, recipient_type, tax_residency").eq("deal_id", dealId);
  if (!taxRecipients || taxRecipients.length === 0) return [];

  const { data: taxForms } = await supabase
    .from("tax_forms").select("*").eq("deal_id", dealId);

  const forms = taxForms || [];
  const today = new Date().toISOString().slice(0, 10);
  const results: Discrepancy[] = [];

  for (const recipient of taxRecipients) {
    let requiredForm = "W9";
    if (recipient.tax_residency === "non_us") {
      requiredForm = recipient.recipient_type === "individual" ? "W8BEN" : "W8BENE";
    }
    const satisfied = forms.some(
      (f: any) => f.recipient_id === recipient.id && f.form_type === requiredForm &&
        ["received", "verified"].includes(f.status) && (f.expires_on === null || f.expires_on >= today)
    );
    if (!satisfied) {
      results.push({
        deal_id: dealId, object_type: "tax_recipient", object_id: recipient.id,
        rule_key: "missing_tax_form", severity: "blocker",
        message: `Tax form missing: ${recipient.name} requires ${requiredForm === "W8BENE" ? "W-8BEN-E" : requiredForm === "W8BEN" ? "W-8BEN" : "W-9"}.`,
        details: { recipient_name: recipient.name, required_form: requiredForm },
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
      return ob.payee_label.toLowerCase().includes(intent.recipient_id.toLowerCase().slice(0, 8));
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

    if (matchingOb.amount_type === "FIXED" && matchingOb.amount_value_minor != null) {
      const intentMinor = Math.round(Number(intent.amount_original) * 100);
      const tolerance = Number(matchingOb.tolerance_minor) || 5000;
      const variance = Math.abs(intentMinor - Number(matchingOb.amount_value_minor));
      if (variance > tolerance) {
        results.push({
          deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
          rule_key: "obligation_amount_mismatch", severity: "blocker",
          message: `Amount mismatch: intent $${(intentMinor / 100).toLocaleString()} vs obligation $${(Number(matchingOb.amount_value_minor) / 100).toLocaleString()}.`,
          details: { obligation_id: matchingOb.id, expected: matchingOb.amount_value_minor, observed: intentMinor, variance },
        });
      }
    }

    if (matchingOb.amount_currency && intent.currency_original !== matchingOb.amount_currency) {
      results.push({
        deal_id: ctx.dealId, object_type: "intent", object_id: intent.id,
        rule_key: "obligation_currency_mismatch", severity: "blocker",
        message: `Currency mismatch: intent ${intent.currency_original} vs obligation ${matchingOb.amount_currency}.`,
        details: { obligation_id: matchingOb.id },
      });
    }

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

// ══════════════════════════════════════
// ── MAIN HANDLER ──
// ══════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch rules
    const { data: rules } = await supabase.from("discrepancy_rules").select("*").eq("enabled", true);
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ discrepancies: [], message: "No rules enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch full deal context in parallel
    const [dealRes, approvalsRes, docsRes, intentsRes, conditionsRes, obligationsRes, partiesRes, capTableRes, contractDocsRes, dealDocsRes, escrowRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", deal_id).single(),
      supabase.from("ontology_approvals").select("*").eq("deal_id", deal_id),
      supabase.from("ontology_documents").select("*").eq("deal_id", deal_id),
      supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id),
      supabase.from("conditions").select("*").eq("deal_id", deal_id),
      supabase.from("obligations").select("*").eq("deal_id", deal_id).eq("status", "CONFIRMED"),
      supabase.from("deal_parties").select("*").eq("deal_id", deal_id),
      supabase.from("cap_table_entries").select("*").eq("deal_id", deal_id),
      supabase.from("contract_documents").select("*").eq("deal_id", deal_id),
      supabase.from("deal_documents").select("*").eq("deal_id", deal_id),
      supabase.from("escrow_accounts").select("*").eq("deal_id", deal_id),
    ]);

    if (dealRes.error) {
      return new Response(JSON.stringify({ error: dealRes.error.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch required document matrix for this deal type
    let requiredMatrix: any[] = [];
    if (dealRes.data.deal_type) {
      const { data: matrix } = await supabase
        .from("required_document_matrix")
        .select("*")
        .eq("deal_type", dealRes.data.deal_type);
      requiredMatrix = matrix || [];
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
      dealDocuments: dealDocsRes.data || [],
      requiredMatrix,
      escrowAccounts: escrowRes.data || [],
      dealId: deal_id,
    };

    // Evaluate all rules
    const newDiscrepancies: Discrepancy[] = [];
    for (const rule of rules) {
      const evaluator = RULE_EVALUATORS[rule.rule_key];
      if (evaluator) {
        newDiscrepancies.push(...evaluator(rule, ctx));
      }
    }

    // Special evaluators
    newDiscrepancies.push(...await evalTaxFormRules(supabase, deal_id, rules));
    newDiscrepancies.push(...evalObligationRules(ctx));

    // ── Upsert logic ──
    const { data: existing } = await supabase
      .from("discrepancies").select("*").eq("deal_id", deal_id).in("status", ["open", "acknowledged"]);

    const existingMap = new Map((existing || []).map((d: any) => [`${d.rule_key}::${d.object_id}`, d]));
    const newKeys = new Set(newDiscrepancies.map((d) => `${d.rule_key}::${d.object_id}`));

    for (const disc of newDiscrepancies) {
      const key = `${disc.rule_key}::${disc.object_id}`;
      if (!existingMap.has(key)) {
        await supabase.from("discrepancies").insert(disc);
      }
    }

    for (const [key, disc] of existingMap) {
      if (!newKeys.has(key) && disc.status === "open") {
        await supabase.from("discrepancies")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disc.id);
      }
    }

    // Return current state
    const { data: current } = await supabase
      .from("discrepancies").select("*").eq("deal_id", deal_id)
      .in("status", ["open", "acknowledged"]).order("created_at", { ascending: false });

    const allDocs = [...(contractDocsRes.data || []), ...(dealDocsRes.data || [])];
    const docTypes = new Set(allDocs.map((d: any) => (d.doc_type || "").toUpperCase()));

    // Compute binder readiness
    const coreRequired = ["SPA", "FUNDS_FLOW"];
    if (Number(dealRes.data.escrow_amount || 0) > 0) coreRequired.push("ESCROW_AGREEMENT");
    const corePresent = coreRequired.filter((t) => docTypes.has(t)).length;
    const totalRequired = requiredMatrix.filter((r: any) => r.is_required).length || coreRequired.length;
    const totalPresent = requiredMatrix.length > 0
      ? requiredMatrix.filter((r: any) => r.is_required && docTypes.has(r.doc_type.toUpperCase())).length
      : corePresent;

    const binderReadiness = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0;

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
        binder_readiness: {
          score: binderReadiness,
          core_docs: { required: coreRequired.length, present: corePresent },
          total_docs: { required: totalRequired, present: totalPresent },
          uploaded_types: [...docTypes],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
