import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Ontology-driven rule definitions (v2: binder-grade) ──
const ONTOLOGY_RULES = [
  // ══════════════════════════════════════
  // ── CORE CLOSING BLOCKERS ──
  // ══════════════════════════════════════
  {
    rule_key: "missing_core_docs",
    name: "Missing Core Closing Documents",
    description: "Blocks execution if SPA, Funds Flow, or Escrow Agreement (when escrow > 0) are missing.",
    severity: "blocker",
    scope: "deal",
    config: { core_types: ["SPA", "FUNDS_FLOW"] },
    enabled: true,
  },
  {
    rule_key: "purchase_price_consistency",
    name: "Purchase Price Consistency",
    description: "SPA purchase_price must match Deal.deal_value. Cross-references extracted fields from transaction agreement.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_pct: 0.5 },
    enabled: true,
  },
  {
    rule_key: "escrow_amount_consistency",
    name: "Escrow Amount Consistency",
    description: "Deal.escrow_amount must match EscrowAgreement.escrow_amount and FundsFlow.escrow_amount.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_pct: 1 },
    enabled: true,
  },
  {
    rule_key: "funds_flow_arithmetic",
    name: "Funds Flow Arithmetic",
    description: "FundsFlow.total_uses must equal sum(line_items.amount) and total_sources must equal total_uses.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_amount: 100 },
    enabled: true,
  },
  {
    rule_key: "party_name_alignment",
    name: "Party Name Alignment",
    description: "SPA buyer/seller/target names must match Deal party records.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "missing_officer_secretary_cert",
    name: "Missing Officer/Secretary Certificates",
    description: "Officer Certificate and Secretary Certificate required for deal types that mandate them.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ══════════════════════════════════════
  // ── PAYMENT EXECUTION BLOCKERS ──
  // ══════════════════════════════════════
  {
    rule_key: "intent_funds_flow_mismatch",
    name: "Disbursement Intent vs Funds Flow Mismatch",
    description: "Each funds flow line item must have a corresponding Disbursement Intent. Total must match.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_pct: 0.5 },
    enabled: true,
  },
  {
    rule_key: "wire_instructions_missing",
    name: "Wire Instructions Missing",
    description: "Blocks execution if any Disbursement Intent lacks wire instructions or linked wire doc.",
    severity: "blocker",
    scope: "intent",
    config: {},
    enabled: true,
  },
  {
    rule_key: "dual_counsel_approval",
    name: "Dual Counsel Approval Required",
    description: "Both buyer counsel and seller counsel approvals must be APPROVED before execution.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ══════════════════════════════════════
  // ── COMPLIANCE BLOCKERS ──
  // ══════════════════════════════════════
  {
    rule_key: "kyc_passed",
    name: "KYC Verification Required",
    description: "All deal participants must have KYC status 'approved'. Blocks on pending or failed.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "kyb_passed",
    name: "KYB Verification Required",
    description: "All organizational parties must have KYB status 'approved'.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "sanctions_clear",
    name: "Sanctions Screening Clear",
    description: "All parties must pass sanctions screening before execution.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "compliance_failed",
    name: "Compliance Checks Failed",
    description: "Execution blocked if any compliance/risk conditions are BLOCKED.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ══════════════════════════════════════
  // ── BINDER WARNINGS (BigLaw feel) ──
  // ══════════════════════════════════════
  {
    rule_key: "disclosure_schedules_missing",
    name: "Disclosure Schedules Missing",
    description: "Warning if disclosure schedules have not been uploaded.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "legal_opinion_missing",
    name: "Legal Opinion Missing",
    description: "Warning if legal opinion has not been uploaded.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "cap_table_missing",
    name: "Cap Table Missing",
    description: "Warning if cap table has not been uploaded (blocker for equity deals).",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "working_capital_missing",
    name: "Working Capital Statement Missing",
    description: "Warning if SPA indicates WC true-up but no WC statement uploaded.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "board_consent_missing",
    name: "Board Consent Missing",
    description: "Warning if board consent/resolution not uploaded.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "good_standing_missing",
    name: "Good Standing Certificate Missing",
    description: "Warning if good standing certificate not provided.",
    severity: "info",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ══════════════════════════════════════
  // ── CROSS-DOCUMENT VALIDATION ──
  // ══════════════════════════════════════
  {
    rule_key: "cap_table_total_validation",
    name: "Cap Table Totals Validation",
    description: "Cap table ownership must total 100% and payouts must reconcile with deal value.",
    severity: "blocker",
    scope: "deal",
    config: { ownership_tolerance_pct: 0.01 },
    enabled: true,
  },
  {
    rule_key: "waterfall_reconciliation",
    name: "Waterfall Reconciliation",
    description: "Waterfall tier allocations must sum to total deal value.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_pct: 0.5 },
    enabled: true,
  },

  // ══════════════════════════════════════
  // ── EXISTING OPERATIONAL RULES ──
  // ══════════════════════════════════════
  {
    rule_key: "dual_counsel_missing",
    name: "Dual Counsel Missing",
    description: "Both legal and finance sign-offs must be APPROVED before execution.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "docs_not_executed",
    name: "Documents Not Executed",
    description: "All deal documents must be executed before disbursement.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "payee_account_missing_or_mismatch",
    name: "Payee Account Missing",
    description: "Every disbursement intent must have a verified bank account reference.",
    severity: "blocker",
    scope: "intent",
    config: {},
    enabled: true,
  },
  {
    rule_key: "fx_rate_outside_tolerance",
    name: "FX Rate Outside Tolerance",
    description: "Cross-currency intents must have a valid FX quote.",
    severity: "warn",
    scope: "intent",
    config: {},
    enabled: true,
  },
  {
    rule_key: "waterfall_intent_total_mismatch",
    name: "Waterfall Intent Mismatch",
    description: "Intent totals must match expected waterfall outputs.",
    severity: "warn",
    scope: "deal",
    config: { tolerance_pct: 0.5 },
    enabled: true,
  },
  {
    rule_key: "large_payment_extra_approval",
    name: "Large Payment Extra Approval",
    description: "High-value disbursements require additional approval.",
    severity: "warn",
    scope: "intent",
    config: { threshold_amount: 5000000 },
    enabled: true,
  },
  {
    rule_key: "stale_deal_data",
    name: "Stale Deal Data",
    description: "Deal hasn't been updated recently.",
    severity: "info",
    scope: "deal",
    config: { stale_days: 14 },
    enabled: true,
  },
  {
    rule_key: "closing_conditions_met",
    name: "Closing Conditions Met",
    description: "All conditions must be SATISFIED before execution.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "party_presence",
    name: "Party Presence",
    description: "Deal must have at least 2 parties.",
    severity: "warn",
    scope: "deal",
    config: { min_parties: 2 },
    enabled: true,
  },
  {
    rule_key: "unresolved_discrepancy_blocks_execution",
    name: "Unresolved Blockers",
    description: "Any open blocker prevents deal execution.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "audit_trail_completeness",
    name: "Audit Trail Completeness",
    description: "Critical actions must have audit events.",
    severity: "info",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "required_document_presence",
    name: "Required Document Presence (Matrix)",
    description: "Documents required by deal type matrix must be uploaded.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "missing_tax_form",
    name: "Missing Tax Form",
    description: "Tax recipients must have valid W-9 or W-8BEN forms.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "compliance_checks_required",
    name: "Compliance Checks Required",
    description: "All compliance checks (KYB, sanctions, PEP, tax form validation) must pass before disbursement execution.",
    severity: "blocker",
    scope: "deal",
    config: { applies_to: "DisbursementIntent.execute" },
    enabled: true,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing rules to avoid duplicates
    const { data: existingRules } = await supabase
      .from("discrepancy_rules")
      .select("rule_key");

    const existingKeys = new Set((existingRules || []).map((r: any) => r.rule_key));
    const newRules = ONTOLOGY_RULES.filter((r) => !existingKeys.has(r.rule_key));

    if (newRules.length === 0) {
      return new Response(
        JSON.stringify({
          message: "All ontology rules already exist",
          total_rules: existingKeys.size,
          new_rules: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("discrepancy_rules")
      .insert(newRules)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        message: `Generated ${data.length} binder-grade ontology rules`,
        total_rules: existingKeys.size + data.length,
        new_rules: data.length,
        rule_keys: data.map((r: any) => r.rule_key),
        breakdown: {
          blockers: data.filter((r: any) => r.severity === "blocker").length,
          warnings: data.filter((r: any) => r.severity === "warn").length,
          info: data.filter((r: any) => r.severity === "info").length,
        },
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
