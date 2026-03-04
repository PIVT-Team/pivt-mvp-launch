import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Ontology-driven rule definitions ──
const ONTOLOGY_RULES = [
  // ── Deal-level rules ──
  {
    rule_key: "purchase_price_consistency",
    name: "Purchase Price Consistency",
    description: "SPA purchase price must match Deal.deal_value. Cross-references transaction agreement documents against deal metadata.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "escrow_amount_consistency",
    name: "Escrow Amount Consistency",
    description: "Escrow agreement amount must match Deal.escrow_amount. Prevents mismatched escrow funding.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Party rules ──
  {
    rule_key: "party_presence",
    name: "Minimum Party Presence",
    description: "Every deal must have at least 2 parties (buyer + seller). Blocks execution if parties are missing.",
    severity: "warn",
    scope: "deal",
    config: { min_parties: 2 },
    enabled: true,
  },
  {
    rule_key: "party_document_alignment",
    name: "Party–Document Alignment",
    description: "SPA buyer/seller names must match deal party records. Detects entity name mismatches across documents.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Role rules ──
  {
    rule_key: "role_assignment_valid",
    name: "Role Assignment Validation",
    description: "Every party in the deal must have at least one assigned role (e.g., buyer_counsel, seller_counsel).",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "approval_role_validation",
    name: "Approval Role Exists",
    description: "Every approval record must reference a valid role. Prevents orphaned approvals.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Document rules ──
  {
    rule_key: "required_document_presence",
    name: "Required Document Presence",
    description: "Critical documents (SPA, Funds Flow Memo, Escrow Agreement) must be uploaded before execution.",
    severity: "blocker",
    scope: "deal",
    config: {
      required_doc_types: ["SPA", "FUNDS_FLOW", "ESCROW_AGREEMENT"],
    },
    enabled: true,
  },
  {
    rule_key: "document_uploaded_before_execution",
    name: "Documents Before Execution",
    description: "All required documents must be uploaded and verified before any disbursement intent can execute.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Envelope / Signature rules ──
  {
    rule_key: "signature_required",
    name: "Signature Completion Required",
    description: "All signature envelopes must have status 'completed' before execution. Blocks on pending signatures.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "envelope_documents_linked",
    name: "Envelope–Document Linkage",
    description: "Every signature envelope must be linked to at least one deal document.",
    severity: "warn",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Condition rules ──
  {
    rule_key: "closing_conditions_met",
    name: "All Closing Conditions Met",
    description: "Every condition must have status 'SATISFIED' before deal can proceed to execution. Blocks on any unmet condition.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Approval rules ──
  {
    rule_key: "dual_counsel_approval",
    name: "Dual Counsel Approval",
    description: "Both buyer counsel and seller counsel must approve before execution. Required for legal sign-off.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Disbursement Intent rules ──
  {
    rule_key: "funds_flow_alignment",
    name: "Funds Flow Alignment",
    description: "Disbursement intent amounts must match funds flow memo line items. Detects amount discrepancies.",
    severity: "blocker",
    scope: "intent",
    config: {},
    enabled: true,
  },
  {
    rule_key: "payment_recipient_validation",
    name: "Payment Recipient Validation",
    description: "Every disbursement recipient must appear in the funds flow memo. Prevents unauthorized payees.",
    severity: "blocker",
    scope: "intent",
    config: {},
    enabled: true,
  },

  // ── Settlement rules ──
  {
    rule_key: "settlement_matches_intent",
    name: "Settlement–Intent Amount Match",
    description: "Settlement confirmation amount must match the original disbursement intent amount.",
    severity: "blocker",
    scope: "intent",
    config: { tolerance_pct: 0.1 },
    enabled: true,
  },
  {
    rule_key: "settlement_after_execution",
    name: "Settlement Timing Validation",
    description: "Settlement timestamp must occur after execution timestamp. Detects temporal anomalies.",
    severity: "warn",
    scope: "intent",
    config: {},
    enabled: true,
  },

  // ── Compliance rules ──
  {
    rule_key: "compliance_passed",
    name: "Compliance Checks Passed",
    description: "All compliance checks (KYC, KYB, sanctions) must pass before execution is permitted.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "kyc_passed",
    name: "KYC Verification Passed",
    description: "All deal participants must have KYC status 'approved'. Blocks on pending or failed KYC.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "kyb_passed",
    name: "KYB Verification Passed",
    description: "All organizational parties must have KYB status 'approved'. Blocks on unverified entities.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },
  {
    rule_key: "sanctions_clear",
    name: "Sanctions Screening Clear",
    description: "All parties must pass sanctions screening. Blocks execution if any party is flagged.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Discrepancy meta-rules ──
  {
    rule_key: "unresolved_discrepancy_blocks_execution",
    name: "Unresolved Blockers Block Execution",
    description: "Any open blocker-severity discrepancy prevents deal execution. All blockers must be resolved or waived.",
    severity: "blocker",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Audit rules ──
  {
    rule_key: "audit_trail_completeness",
    name: "Audit Trail Completeness",
    description: "Critical actions (document upload, approval, payment execution) must have corresponding audit events.",
    severity: "info",
    scope: "deal",
    config: {},
    enabled: true,
  },

  // ── Document type classification mappings ──
  {
    rule_key: "document_type_classification",
    name: "Document Type Classification",
    description: "Uploaded documents must be classified into known types: SPA, escrow, funds_flow, cap_table, closing_certificate, legal_opinion.",
    severity: "info",
    scope: "deal",
    config: {
      type_mappings: {
        "transaction_agreement": ["SPA", "APA", "Merger Agreement"],
        "escrow": ["Escrow Agreement", "Escrow Instructions"],
        "funds_flow": ["Funds Flow Memo", "Funds Flow Statement"],
        "cap_table": ["Cap Table", "Capitalization Table"],
        "closing_certificate": ["Closing Certificate", "Officer's Certificate"],
        "legal_opinion": ["Legal Opinion", "Counsel Opinion"],
      },
    },
    enabled: true,
  },

  // ── Cross-document validation ──
  {
    rule_key: "cap_table_total_validation",
    name: "Cap Table Totals Validation",
    description: "Cap table ownership percentages must total 100% and payout amounts must reconcile with deal value.",
    severity: "blocker",
    scope: "deal",
    config: { ownership_tolerance_pct: 0.01 },
    enabled: true,
  },
  {
    rule_key: "waterfall_reconciliation",
    name: "Waterfall Reconciliation",
    description: "Waterfall tier allocations must sum to total deal value. Detects over/under allocation.",
    severity: "blocker",
    scope: "deal",
    config: { tolerance_pct: 0.5 },
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
        message: `Generated ${data.length} ontology-driven rules`,
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
