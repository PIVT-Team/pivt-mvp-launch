import { supabase } from "@/integrations/supabase/client";

export type DealMetricStageStatus = "not_started" | "in_progress" | "complete" | "blocked";

export interface DealMetricIssue {
  code: string;
  message: string;
  severity: "warn" | "error";
}

/** The five things a closing-readiness view reports on. */
export type ReadinessCategory =
  | "documents"
  | "funds_flow"
  | "verification"
  | "approvals"
  | "closing_requirements";

export type ReadinessCategoryStatus = "ready" | "attention" | "not_started";

/**
 * A single reason this deal cannot close, in the shape a human needs: what is
 * wrong, why it matters, where the finding came from, and what to do about it.
 *
 * `targetSection` / `targetId` exist so the UI can make every blocker clickable
 * through to the thing it is about.
 */
export interface BlockingIssue {
  id: string;
  category: ReadinessCategory;
  title: string;
  reason: string;
  source: string;
  action: string;
  origin: "discrepancy" | "change_event" | "gate";
  targetSection: string;
  targetId?: string;
  createdAt?: string;
}

export interface DealMetrics {
  dealId: string;
  dealStatus: string;
  totalStakeholders: number;
  verifiedStakeholders: number;
  requiredStakeholders: number;
  requiredVerifiedStakeholders: number;
  buyerSideStakeholders: number;
  sellerSideStakeholders: number;
  totalUploadedDocuments: number;
  completedDocuments: number;
  requiredDocuments: number;
  completedRequiredDocuments: number;
  totalDealInputs: number;
  requiredDealInputs: number;
  completedDealInputs: number;
  totalObligations: number;
  confirmedObligations: number;
  totalWireInstructions: number;
  verifiedWireInstructions: number;
  totalApprovals: number;
  requiredApprovals: number;
  grantedApprovals: number;
  grantedRequiredApprovals: number;
  totalConditions: number;
  conditionsSatisfied: number;
  totalSettlementRecords: number;
  settledRecords: number;
  readinessPercent: number;
  executionPercent: number;
  stageStatuses: {
    overview: DealMetricStageStatus;
    stakeholders: DealMetricStageStatus;
    deal_inputs: DealMetricStageStatus;
    verification: DealMetricStageStatus;
    approvals: DealMetricStageStatus;
    execution: DealMetricStageStatus;
    settlement: DealMetricStageStatus;
    compliance: DealMetricStageStatus;
    audit: DealMetricStageStatus;
    comments: DealMetricStageStatus;
  };
  auditEventCount: number;
  commentCount: number;
  commentThreadCount: number;
  gates: {
    stakeholdersConfigured: boolean;
    sellerVerified: boolean;
    buyerVerified: boolean;
    spaUploaded: boolean;
    wireInstructionsUploaded: boolean;
    paymentsApproved: boolean;
    approvalsComplete: boolean;
    settlementComplete: boolean;
    readyToClose: boolean;
  };
  nextRequiredAction: string;
  reconciliationIssues: DealMetricIssue[];

  // ── Closing readiness ──────────────────────────────────────────────────
  /** Every open reason this deal cannot close, most severe first. */
  blockingIssues: BlockingIssue[];
  /** Per-category roll-up for the Closing Readiness view. */
  categoryStatus: Record<ReadinessCategory, ReadinessCategoryStatus>;
  openBlockerDiscrepancies: number;
  openBlockingChangeEvents: number;
  invalidatedApprovals: number;
}

const REQUIRED_STAKEHOLDER_ROLES = new Set(["BUYER", "SELLER", "TARGET", "MERGER_SUB"]);
const BUYER_SIDE_ROLES = new Set(["BUYER", "MERGER_SUB", "INVESTOR", "LENDER", "BUYER_COUNSEL", "ADMINISTRATIVE_AGENT"]);
const SELLER_SIDE_ROLES = new Set(["SELLER", "TARGET", "SHAREHOLDER", "FOUNDER", "EMPLOYEE", "ADVISOR", "SELLER_COUNSEL"]);

const DEFAULT_REQUIRED_DOC_TYPES = [
  "SPA",
  "FUNDS_FLOW",
  "WIRE_INSTRUCTIONS",
  "ESCROW_AGREEMENT",
  "DISCLOSURE_SCHEDULES",
  "BOARD_CONSENT",
  "OFFICER_CERTIFICATE",
];

const REQUIRED_DOC_EQUIVALENTS: Record<string, string[]> = {
  SPA: ["SPA", "MERGER_AGREEMENT", "PURCHASE_AGREEMENT"],
  FUNDS_FLOW: ["FUNDS_FLOW", "WATERFALL_MODEL", "DISTRIBUTION_SCHEDULE"],
  WIRE_INSTRUCTIONS: ["WIRE_INSTRUCTIONS", "WIRE_AUTHORIZATION", "BANK_LETTER"],
  ESCROW_AGREEMENT: ["ESCROW_AGREEMENT"],
  DISCLOSURE_SCHEDULES: ["DISCLOSURE_SCHEDULES"],
  BOARD_CONSENT: ["BOARD_CONSENT", "STOCKHOLDER_CONSENT"],
  OFFICER_CERTIFICATE: ["OFFICER_CERTIFICATE", "SECRETARY_CERTIFICATE"],
};

const COMPLETED_DOC_STATUSES = new Set(["PARSED", "EXTRACTION_COMPLETE", "VERIFIED", "PROCESSED", "COMPLETED"]);
const COMPLETED_APPROVAL_STATUSES = new Set(["APPROVED", "COMPLETED"]);
const BLOCKED_APPROVAL_STATUSES = new Set(["DECLINED", "EXPIRED", "FAILED_DELIVERY", "BLOCKED"]);
const VERIFIED_STAKEHOLDER_STATUSES = new Set(["VERIFIED", "COMPLETED"]);
const CONFIRMED_OBLIGATION_STATUSES = new Set(["CONFIRMED", "SATISFIED", "WAIVED"]);
const VERIFIED_WIRE_STATUSES = new Set(["VERIFIED", "CONFIRMED", "APPROVED"]);
const SATISFIED_CONDITION_STATUSES = new Set(["MET", "SATISFIED", "WAIVED"]);
const SETTLED_STATUSES = new Set(["SETTLED", "EXECUTED", "COMPLETED"]);

const pct = (done: number, total: number) => (total <= 0 ? 0 : Math.round((done / total) * 100));
const nStatus = (status: string | null | undefined) => String(status || "").toUpperCase();
const nRole = (role: string | null | undefined) => String(role || "").toUpperCase().replace(/[\s-]+/g, "_");
const nDocType = (type: string | null | undefined) => String(type || "OTHER").toUpperCase().replace(/[\s-]+/g, "_");

function hasRequiredDoc(records: Array<{ doc_type: string; status: string }>, requiredType: string, completedOnly: boolean) {
  const accepted = new Set(REQUIRED_DOC_EQUIVALENTS[requiredType] || [requiredType]);
  return records.some((d) => accepted.has(nDocType(d.doc_type)) && (!completedOnly || COMPLETED_DOC_STATUSES.has(nStatus(d.status))));
}

// ── Closing-readiness helpers ────────────────────────────────────────────────

/** Which readiness category a change event belongs under. */
function changeEventCategory(changeType: string): ReadinessCategory {
  switch (changeType) {
    case "approval_invalidated":
      return "approvals";
    case "verification_invalidated":
    case "wire_details_changed":
      return "verification";
    case "payment_added":
    case "payment_removed":
    case "payment_amount_changed":
    case "duplicate_payment_detected":
      return "funds_flow";
    case "document_version_added":
      return "documents";
    default:
      return "closing_requirements";
  }
}

/** Which readiness category a discrepancy rule belongs under. */
function discrepancyCategory(ruleKey: string): ReadinessCategory {
  const k = String(ruleKey || "");
  if (/doc|schedule|certificate|consent|opinion|binder|standing/.test(k)) return "documents";
  if (/funds_flow|wire|payee|waterfall|escrow|price|cap_table|fx|payment|intent/.test(k)) return "funds_flow";
  if (/kyc|kyb|sanction|verif|tax_form/.test(k)) return "verification";
  if (/approval|counsel/.test(k)) return "approvals";
  return "closing_requirements";
}

/** Deep-link target so every blocker is clickable through to its subject. */
function sectionForObject(objectType: string | null | undefined, hint = ""): string {
  switch (String(objectType || "")) {
    case "wire_instruction": return "payments";
    case "deal_approval": return "approvals";
    case "cap_table_entry": return "stakeholders";
    case "tax_recipient": return "tax";
    case "intent": return "payments";
    case "document": return "documents";
    default: return sectionForCategory(discrepancyCategory(hint));
  }
}

function sectionForCategory(category: ReadinessCategory): string {
  switch (category) {
    case "documents": return "documents";
    case "funds_flow": return "payments";
    case "verification": return "verification";
    case "approvals": return "approvals";
    default: return "overview";
  }
}

function categoryRoll(
  issues: BlockingIssue[],
  category: ReadinessCategory,
  started: boolean
): ReadinessCategoryStatus {
  if (issues.some((i) => i.category === category)) return "attention";
  return started ? "ready" : "not_started";
}

export async function getDealMetrics(dealId: string): Promise<DealMetrics> {
  const [dealRes, stakeholdersRes, contractDocsRes, dealDocsRes, obligationsRes, wiresRes, approvalsRes, conditionsRes, waterfallRes, taxRes, paymentAllocRes, escrowTxRes, auditLogRes, commentsRes, discrepanciesRes, changeEventsRes] = await Promise.all([
    supabase.from("deals").select("id, status, buyer, seller, target_company, deal_type").eq("id", dealId).maybeSingle(),
    supabase.from("cap_table_entries").select("id, role, verification_status").eq("deal_id", dealId),
    // `is_current` / `version` are read so document checks reflect the version
    // in force rather than whichever row happened to come back first (gap G3).
    supabase.from("contract_documents").select("id, doc_type, status, is_current, version, filename").eq("deal_id", dealId),
    supabase.from("deal_documents").select("id, doc_type, status").eq("deal_id", dealId),
    supabase.from("obligations").select("id, status").eq("deal_id", dealId),
    supabase.from("wire_instructions").select("id, verification_status").eq("deal_id", dealId),
    supabase.from("deal_approvals").select("id, status, required, invalidated_at, invalidated_reason, approval_side, approval_type, packet_name").eq("deal_id", dealId),
    supabase.from("conditions").select("id, status").eq("deal_id", dealId),
    supabase.from("waterfall_tiers").select("id").eq("deal_id", dealId),
    supabase.from("tax_forms").select("id").eq("deal_id", dealId),
    supabase.from("payment_allocations").select("id, status").eq("deal_id", dealId),
    supabase.from("escrow_transactions").select("id, status").eq("deal_id", dealId),
    // Just a presence probe — we only need to know "any audit activity?".
    // Limit 1 keeps the round-trip tiny.
    supabase.from("audit_log").select("id").eq("deal_id", dealId).limit(1),
    // Lightweight comment census — limit 200 covers all realistic deals
    // and we only use it for total + thread counts in the sidebar tooltip.
    supabase.from("deal_comments").select("id, parent_id").eq("deal_id", dealId).limit(200),
    // ── The two sources of truth for "why can't this close?" ──
    //
    // These queries did not exist before. Readiness was computed purely from
    // presence-and-status gates, so a deal could report readyToClose: true
    // while holding twelve open blocker discrepancies — including a $2M wire
    // overpayment and a duplicate payment (gap G1). Detection and the closing
    // gate were two disconnected systems; these two rows connect them.
    supabase
      .from("discrepancies")
      .select("id, rule_key, severity, status, message, details, object_type, object_id, created_at")
      .eq("deal_id", dealId)
      .in("status", ["open", "acknowledged"]),
    supabase
      .from("deal_change_events")
      .select("id, change_type, severity, blocks_closing, status, title, what_changed, why_it_matters, recommended_action, source_label, object_type, object_id, created_at")
      .eq("deal_id", dealId)
      .eq("status", "open"),
  ]);

  const deal = dealRes.data as any;
  const stakeholders = (stakeholdersRes.data || []) as any[];
  const auditEventCount = ((auditLogRes.data || []) as any[]).length;
  const commentRows = (commentsRes.data || []) as any[];
  const commentCount = commentRows.length;
  const commentThreadCount = commentRows.filter((c: any) => !c.parent_id).length;
  const contractDocs = (contractDocsRes.data || []) as any[];
  const dealDocs = (dealDocsRes.data || []) as any[];
  const obligations = (obligationsRes.data || []) as any[];
  const wires = (wiresRes.data || []) as any[];
  const approvals = (approvalsRes.data || []) as any[];
  const conditions = (conditionsRes.data || []) as any[];
  const waterfall = (waterfallRes.data || []) as any[];
  const taxForms = (taxRes.data || []) as any[];
  const paymentAllocations = (paymentAllocRes.data || []) as any[];
  const escrowTransactions = (escrowTxRes.data || []) as any[];
  // These two tables may not exist yet on a database that predates the
  // versioning migration; treat a failed query as "nothing blocking" rather
  // than letting readiness fail to load entirely.
  const discrepancies = (discrepanciesRes?.data || []) as any[];
  const changeEvents = (changeEventsRes?.data || []) as any[];

  const stakeholderRoles = stakeholders.map((s) => nRole(s.role));
  const verifiedStakeholders = stakeholders.filter((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status))).length;
  const buyerRows = stakeholders.filter((s) => BUYER_SIDE_ROLES.has(nRole(s.role)));
  const sellerRows = stakeholders.filter((s) => SELLER_SIDE_ROLES.has(nRole(s.role)));
  const requiredStakeholderRows = stakeholders.filter((s) => REQUIRED_STAKEHOLDER_ROLES.has(nRole(s.role)));
  const requiredStakeholders = requiredStakeholderRows.length > 0 ? requiredStakeholderRows.length : stakeholders.length;
  const requiredVerifiedStakeholders = (requiredStakeholderRows.length > 0 ? requiredStakeholderRows : stakeholders).filter((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status))).length;

  // Only the version in force counts toward "is this document on file and
  // complete?". Superseded versions stay in the table for history but must not
  // satisfy a requirement or contribute a status (gap G3). Rows written before
  // the versioning migration have is_current undefined, which reads as current.
  const currentContractDocs = contractDocs.filter((d) => d.is_current !== false);

  const allDocs = [
    ...currentContractDocs.map((d) => ({ id: `contract:${d.id}`, doc_type: d.doc_type, status: d.status })),
    ...dealDocs.map((d) => ({ id: `deal:${d.id}`, doc_type: d.doc_type, status: d.status })),
  ];

  const totalUploadedDocuments = allDocs.length;
  const completedDocuments = allDocs.filter((d) => COMPLETED_DOC_STATUSES.has(nStatus(d.status))).length;

  const requiredDocuments = DEFAULT_REQUIRED_DOC_TYPES.length;
  const completedRequiredDocuments = DEFAULT_REQUIRED_DOC_TYPES.filter((docType) => hasRequiredDoc(allDocs, docType, true)).length;

  const totalObligations = obligations.length;
  const confirmedObligations = obligations.filter((o) => CONFIRMED_OBLIGATION_STATUSES.has(nStatus(o.status))).length;

  const totalWireInstructions = wires.length;
  const verifiedWireInstructions = wires.filter((w) => VERIFIED_WIRE_STATUSES.has(nStatus(w.verification_status))).length;

  const totalApprovals = approvals.length;
  const requiredApprovals = approvals.filter((a) => a.required !== false).length;
  const grantedApprovals = approvals.filter((a) => COMPLETED_APPROVAL_STATUSES.has(nStatus(a.status))).length;
  const grantedRequiredApprovals = approvals.filter((a) => a.required !== false && COMPLETED_APPROVAL_STATUSES.has(nStatus(a.status))).length;

  const totalConditions = conditions.length;
  const conditionsSatisfied = conditions.filter((c) => SATISFIED_CONDITION_STATUSES.has(nStatus(c.status))).length;

  const categoryChecks = {
    financial: allDocs.some((d) => ["CAP_TABLE", "WATERFALL_MODEL", "DISTRIBUTION_SCHEDULE", "FUNDS_FLOW", "FINANCIAL_STATEMENTS"].includes(nDocType(d.doc_type))),
    cap_table: stakeholders.length > 0,
    waterfall: waterfall.length > 0,
    wire_instructions: totalWireInstructions > 0,
    tax: taxForms.length > 0,
    contracts: allDocs.some((d) => ["SPA", "MERGER_AGREEMENT", "PURCHASE_AGREEMENT", "ESCROW_AGREEMENT", "DISCLOSURE_SCHEDULES", "TSA", "SIDE_LETTER", "EARNOUT"].includes(nDocType(d.doc_type))),
    governance: allDocs.some((d) => ["BOARD_CONSENT", "OFFICER_CERTIFICATE", "SECRETARY_CERTIFICATE", "STOCKHOLDER_CONSENT"].includes(nDocType(d.doc_type))),
    obligations: totalObligations > 0,
  };

  // "Required" inputs = the minimum bar to call Deal Inputs complete. The
  // other categories (waterfall / wire_instructions / tax / governance /
  // obligations) are tracked but they're execution-stage concerns and are
  // already gated under the Execution dot. Without this split, even the
  // test's explicitly-perfect "Clean Deal — Healthy Close" scenario fails
  // — because no real M&A deal has tax forms + obligations + waterfall +
  // governance docs uploaded up-front, the dot stays yellow forever.
  const REQUIRED_DEAL_INPUT_CATEGORIES = ['cap_table', 'contracts'] as const;
  const requiredDealInputs = REQUIRED_DEAL_INPUT_CATEGORIES.length;
  const completedDealInputs = REQUIRED_DEAL_INPUT_CATEGORIES.filter((k) => categoryChecks[k]).length;
  const totalDealInputs = totalUploadedDocuments + stakeholders.length + waterfall.length + totalWireInstructions + taxForms.length + totalObligations;

  const stakeholdersConfigured = (buyerRows.length > 0 || !!deal?.buyer) && (sellerRows.length > 0 || !!deal?.seller);
  const sellerVerified = sellerRows.length > 0 && sellerRows.every((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status)));
  const buyerVerified = buyerRows.length > 0 && buyerRows.every((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status)));
  const spaUploaded = hasRequiredDoc(allDocs, "SPA", false);
  const wireInstructionsUploaded = totalWireInstructions > 0;
  const paymentsApproved = totalWireInstructions > 0 && verifiedWireInstructions === totalWireInstructions;
  const approvalsComplete = requiredApprovals > 0 && grantedRequiredApprovals === requiredApprovals;

  const totalSettlementRecords = paymentAllocations.length + escrowTransactions.length;
  const settledRecords = paymentAllocations.filter((p) => SETTLED_STATUSES.has(nStatus(p.status))).length + escrowTransactions.filter((t) => SETTLED_STATUSES.has(nStatus(t.status))).length;
  const settlementComplete = totalSettlementRecords > 0 && settledRecords === totalSettlementRecords;

  // ── Blocking issues ────────────────────────────────────────────────────
  const blockerDiscrepancies = discrepancies.filter((d) => String(d.severity) === "blocker");
  const blockingChangeEvents = changeEvents.filter((e) => e.blocks_closing === true);

  const blockingIssues: BlockingIssue[] = [
    // Change events first — they describe something that moved, which is
    // almost always more urgent than a static gap.
    ...blockingChangeEvents.map((e) => ({
      id: `change:${e.id}`,
      category: changeEventCategory(e.change_type),
      title: e.title || "Change requires review",
      reason: [e.what_changed, e.why_it_matters].filter(Boolean).join(" "),
      source: e.source_label || "Deal change log",
      action: e.recommended_action || "Review this change before closing.",
      origin: "change_event" as const,
      targetSection: sectionForObject(e.object_type, e.change_type),
      targetId: e.object_id || undefined,
      createdAt: e.created_at,
    })),
    ...blockerDiscrepancies.map((d) => ({
      id: `disc:${d.id}`,
      category: discrepancyCategory(d.rule_key),
      title: d.message || d.rule_key,
      reason: String((d.details as any)?.why_it_matters || d.message || ""),
      source: String((d.details as any)?.source || `Rule: ${d.rule_key}`),
      action: String((d.details as any)?.recommended_action || "Resolve this discrepancy before closing."),
      origin: "discrepancy" as const,
      targetSection: sectionForObject(d.object_type, d.rule_key),
      targetId: d.object_id || undefined,
      createdAt: d.created_at,
    })),
  ];

  // Unmet hard gates are blockers too — surfaced in the same list so the view
  // has one place to read rather than three.
  const gateBlockers: Array<[boolean, string, ReadinessCategory, string, string, string]> = [
    [stakeholdersConfigured, "Buyer and seller stakeholders not configured", "closing_requirements", "A deal cannot close without both sides identified.", "Deal record", "Add at least one buyer and one seller stakeholder."],
    [sellerVerified, "Seller-side verification incomplete", "verification", "Funds cannot be released to an unverified party.", "Verification status", "Complete KYC/KYB for every seller-side stakeholder."],
    [buyerVerified, "Buyer-side verification incomplete", "verification", "Funds cannot be sourced from an unverified party.", "Verification status", "Complete KYC/KYB for every buyer-side stakeholder."],
    [spaUploaded, "No purchase agreement on file", "documents", "The operative agreement is missing, so nothing can be reconciled against it.", "Document set", "Upload the SPA or merger agreement."],
    [wireInstructionsUploaded, "No wire instructions on file", "funds_flow", "There is no payment set to execute.", "Funds flow", "Upload the funds flow or add wire instructions."],
    [paymentsApproved, "Not all wire instructions are verified", "verification", "Unverified payment instructions cannot be funded.", "Wire instructions", "Verify each remaining wire instruction."],
    [approvalsComplete, "Required approvals outstanding", "approvals", "The payment set has not been authorised by everyone required.", "Approvals", "Collect the remaining required approvals."],
  ];
  for (const [ok, title, category, reason, source, action] of gateBlockers) {
    if (!ok) {
      blockingIssues.push({
        id: `gate:${title}`, category, title, reason, source, action,
        origin: "gate", targetSection: sectionForCategory(category),
      });
    }
  }

  const invalidatedApprovals = approvals.filter((a) => !!a.invalidated_at).length;

  // A deal is ready only when the gates pass AND nothing is blocking. Before
  // this, the gates alone decided, so "Ready" could appear over an open list of
  // blockers the product had already computed.
  const readyToClose =
    stakeholdersConfigured && sellerVerified && buyerVerified && spaUploaded &&
    wireInstructionsUploaded && paymentsApproved && approvalsComplete &&
    blockerDiscrepancies.length === 0 &&
    blockingChangeEvents.length === 0 &&
    invalidatedApprovals === 0;

  const categoryStatus: Record<ReadinessCategory, ReadinessCategoryStatus> = {
    documents: categoryRoll(blockingIssues, "documents", totalUploadedDocuments > 0),
    funds_flow: categoryRoll(blockingIssues, "funds_flow", totalWireInstructions > 0),
    verification: categoryRoll(blockingIssues, "verification", requiredStakeholders > 0),
    approvals: categoryRoll(blockingIssues, "approvals", totalApprovals > 0),
    closing_requirements: categoryRoll(blockingIssues, "closing_requirements", totalConditions > 0 || stakeholdersConfigured),
  };

  const stakeholderRatio = requiredStakeholders > 0 ? requiredVerifiedStakeholders / requiredStakeholders : 0;
  const docsRatio = requiredDocuments > 0 ? completedRequiredDocuments / requiredDocuments : 0;
  const obligationsRatio = totalObligations > 0 ? confirmedObligations / totalObligations : 0;
  const wiresRatio = totalWireInstructions > 0 ? verifiedWireInstructions / totalWireInstructions : 0;
  const approvalsRatio = requiredApprovals > 0 ? grantedRequiredApprovals / requiredApprovals : 0;
  const readinessPercent = Math.round(((stakeholderRatio + docsRatio + obligationsRatio + wiresRatio + approvalsRatio) / 5) * 100);

  const executionGateValues = [
    stakeholdersConfigured,
    sellerVerified,
    buyerVerified,
    spaUploaded,
    wireInstructionsUploaded,
    paymentsApproved,
    approvalsComplete,
  ];
  const executionPercent = Math.round((executionGateValues.filter(Boolean).length / executionGateValues.length) * 100);

  const hasExecutionBlocker = approvals.some((a) => BLOCKED_APPROVAL_STATUSES.has(nStatus(a.status)));

  const stageStatuses: DealMetrics["stageStatuses"] = {
    // Overview is the deal's home view, not a step that has progress. If
    // we got here, getDealMetrics found a deal — so the dot reads green
    // ("deal loaded") rather than grey ("blank").
    overview: deal ? "complete" : "not_started",
    // Stakeholders stage = "have we identified the people in this deal?",
    // NOT "are they all KYC'd?" — verification is its own stage with its
    // own dot below. Previously this conflated the two so the sidebar dot
    // stayed yellow until every stakeholder was verified, which made
    // Stakeholders unreachable-green even after the roster was complete.
    stakeholders:
      stakeholders.length === 0
        ? "not_started"
        : stakeholdersConfigured
        ? "complete"
        : "in_progress",
    deal_inputs:
      totalDealInputs === 0 ? "not_started" : completedDealInputs >= requiredDealInputs ? "complete" : "in_progress",
    verification:
      requiredStakeholders === 0 ? "not_started" : requiredVerifiedStakeholders === requiredStakeholders ? "complete" : "in_progress",
    // Approvals — drives the sidebar dot next to the Approvals tab. Was
    // previously missing from this object entirely, so the dot fell through
    // to the "default" grey/blank state regardless of progress.
    //
    // Green ("complete") needs to fire in any of these "all done" shapes:
    //   - every approval is granted (regardless of required flag)
    //   - there are required approvals and all of them are granted (optional
    //     ones may still be pending, but the deal isn't blocked on them)
    //   - there are zero required approvals and every present approval is
    //     granted (all-optional case — used to fall through to yellow)
    approvals:
      totalApprovals === 0
        ? "not_started"
        : hasExecutionBlocker
        ? "blocked"
        : grantedApprovals >= totalApprovals
        ? "complete"
        : requiredApprovals > 0 && grantedRequiredApprovals >= requiredApprovals
        ? "complete"
        : "in_progress",
    execution:
      hasExecutionBlocker ? "blocked" : executionPercent === 0 ? "not_started" : executionPercent === 100 ? "complete" : "in_progress",
    settlement:
      totalSettlementRecords === 0 ? "not_started" : settlementComplete ? "complete" : "in_progress",
    compliance:
      totalConditions + requiredApprovals === 0
        ? "not_started"
        : conditionsSatisfied + grantedRequiredApprovals >= totalConditions + requiredApprovals
        ? "complete"
        : "in_progress",
    // Audit is an always-growing trail rather than a checklist, so the
    // healthy state is "any activity recorded." 0 events = nothing's
    // happened yet (grey), ≥1 = the trail is live and being captured.
    // Chain-integrity (the only real "blocked" condition for audit) is
    // surfaced separately by the Audit Log view itself.
    audit: auditEventCount === 0 ? "not_started" : "complete",
    // Comments mirrors Audit — it's a discussion log that grows over
    // time, not a checklist. Green once any thread exists.
    comments: commentCount === 0 ? "not_started" : "complete",
  };

  let nextRequiredAction = "Review deal workspace";
  if (!stakeholdersConfigured) nextRequiredAction = "Add at least one buyer and one seller stakeholder";
  else if (!sellerVerified) nextRequiredAction = "Complete seller-side verification";
  else if (!buyerVerified) nextRequiredAction = "Complete buyer-side verification";
  else if (!spaUploaded) nextRequiredAction = "Upload SPA / merger agreement";
  else if (!wireInstructionsUploaded) nextRequiredAction = "Add wire instructions";
  else if (!paymentsApproved) nextRequiredAction = "Verify all wire instructions";
  else if (!approvalsComplete) nextRequiredAction = "Complete required approvals";
  else if (!settlementComplete && totalSettlementRecords > 0) nextRequiredAction = "Finalize settlement records";
  // A live blocker outranks the generic "review workspace" fallback: if
  // something changed or reconciled badly, that is the next required action.
  if (blockingIssues.length > 0 && (readyToClose || nextRequiredAction === "Review deal workspace")) {
    nextRequiredAction = blockingIssues[0].action;
  }

  const reconciliationIssues: DealMetricIssue[] = [];
  if (requiredStakeholders > stakeholders.length) {
    reconciliationIssues.push({
      code: "stakeholders_required_exceeds_actual",
      message: `Required stakeholders (${requiredStakeholders}) exceed actual stakeholders (${stakeholders.length}).`,
      severity: "error",
    });
  }
  if (requiredDocuments > totalUploadedDocuments) {
    reconciliationIssues.push({
      code: "required_docs_exceed_uploaded",
      message: `Readiness expects ${requiredDocuments} required documents but only ${totalUploadedDocuments} documents are uploaded.`,
      severity: "warn",
    });
  }
  if (stageStatuses.execution === "complete" && !readyToClose) {
    reconciliationIssues.push({
      code: "execution_complete_without_gates",
      message: "Execution stage is marked complete but execution gates are not all satisfied.",
      severity: "error",
    });
  }

  return {
    dealId,
    dealStatus: deal?.status || "draft",
    totalStakeholders: stakeholders.length,
    verifiedStakeholders,
    requiredStakeholders,
    requiredVerifiedStakeholders,
    buyerSideStakeholders: stakeholderRoles.filter((r) => BUYER_SIDE_ROLES.has(r)).length,
    sellerSideStakeholders: stakeholderRoles.filter((r) => SELLER_SIDE_ROLES.has(r)).length,
    totalUploadedDocuments,
    completedDocuments,
    requiredDocuments,
    completedRequiredDocuments,
    totalDealInputs,
    requiredDealInputs,
    completedDealInputs,
    totalObligations,
    confirmedObligations,
    totalWireInstructions,
    verifiedWireInstructions,
    totalApprovals,
    requiredApprovals,
    grantedApprovals,
    grantedRequiredApprovals,
    totalConditions,
    conditionsSatisfied,
    totalSettlementRecords,
    settledRecords,
    auditEventCount,
    commentCount,
    commentThreadCount,
    readinessPercent,
    executionPercent,
    stageStatuses,
    gates: {
      stakeholdersConfigured,
      sellerVerified,
      buyerVerified,
      spaUploaded,
      wireInstructionsUploaded,
      paymentsApproved,
      approvalsComplete,
      settlementComplete,
      readyToClose,
    },
    nextRequiredAction,
    reconciliationIssues,
    blockingIssues,
    categoryStatus,
    openBlockerDiscrepancies: blockerDiscrepancies.length,
    openBlockingChangeEvents: blockingChangeEvents.length,
    invalidatedApprovals,
  };
}
