import { supabase } from "@/integrations/supabase/client";

export type DealMetricStageStatus = "not_started" | "in_progress" | "complete" | "blocked";

export interface DealMetricIssue {
  code: string;
  message: string;
  severity: "warn" | "error";
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
    stakeholders: DealMetricStageStatus;
    deal_inputs: DealMetricStageStatus;
    verification: DealMetricStageStatus;
    execution: DealMetricStageStatus;
    settlement: DealMetricStageStatus;
    compliance: DealMetricStageStatus;
  };
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

export async function getDealMetrics(dealId: string): Promise<DealMetrics> {
  const [dealRes, stakeholdersRes, contractDocsRes, dealDocsRes, obligationsRes, wiresRes, approvalsRes, conditionsRes, waterfallRes, taxRes, paymentAllocRes, escrowTxRes] = await Promise.all([
    supabase.from("deals").select("id, status, buyer, seller, target_company, deal_type").eq("id", dealId).maybeSingle(),
    supabase.from("cap_table_entries").select("id, role, verification_status").eq("deal_id", dealId),
    supabase.from("contract_documents").select("id, doc_type, status").eq("deal_id", dealId),
    supabase.from("deal_documents").select("id, doc_type, status").eq("deal_id", dealId),
    supabase.from("obligations").select("id, status").eq("deal_id", dealId),
    supabase.from("wire_instructions").select("id, verification_status").eq("deal_id", dealId),
    supabase.from("deal_approvals").select("id, status, required").eq("deal_id", dealId),
    supabase.from("conditions").select("id, status").eq("deal_id", dealId),
    supabase.from("waterfall_tiers").select("id").eq("deal_id", dealId),
    supabase.from("tax_forms").select("id").eq("deal_id", dealId),
    supabase.from("payment_allocations").select("id, status").eq("deal_id", dealId),
    supabase.from("escrow_transactions").select("id, status").eq("deal_id", dealId),
  ]);

  const deal = dealRes.data as any;
  const stakeholders = (stakeholdersRes.data || []) as any[];
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

  const stakeholderRoles = stakeholders.map((s) => nRole(s.role));
  const verifiedStakeholders = stakeholders.filter((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status))).length;
  const buyerRows = stakeholders.filter((s) => BUYER_SIDE_ROLES.has(nRole(s.role)));
  const sellerRows = stakeholders.filter((s) => SELLER_SIDE_ROLES.has(nRole(s.role)));
  const requiredStakeholderRows = stakeholders.filter((s) => REQUIRED_STAKEHOLDER_ROLES.has(nRole(s.role)));
  const requiredStakeholders = requiredStakeholderRows.length > 0 ? requiredStakeholderRows.length : stakeholders.length;
  const requiredVerifiedStakeholders = (requiredStakeholderRows.length > 0 ? requiredStakeholderRows : stakeholders).filter((s) => VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status))).length;

  const allDocs = [
    ...contractDocs.map((d) => ({ id: `contract:${d.id}`, doc_type: d.doc_type, status: d.status })),
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

  const requiredDealInputs = Object.keys(categoryChecks).length;
  const completedDealInputs = Object.values(categoryChecks).filter(Boolean).length;
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

  const readyToClose = stakeholdersConfigured && sellerVerified && buyerVerified && spaUploaded && wireInstructionsUploaded && paymentsApproved && approvalsComplete;

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
    stakeholders:
      stakeholders.length === 0 ? "not_started" : verifiedStakeholders === stakeholders.length ? "complete" : "in_progress",
    deal_inputs:
      totalDealInputs === 0 ? "not_started" : completedDealInputs >= requiredDealInputs ? "complete" : "in_progress",
    verification:
      requiredStakeholders === 0 ? "not_started" : requiredVerifiedStakeholders === requiredStakeholders ? "complete" : "in_progress",
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
  };
}
