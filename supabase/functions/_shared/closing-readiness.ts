/**
 * Can this transaction close? One answer, computed in one place.
 *
 * Two definitions used to exist. The Closing Readiness screen computed blockers
 * from gates, discrepancies, change events, requirements and wire verification.
 * `get-deal-context` — what Newton reasons from — read discrepancies,
 * obligations and conditions, and checked approvals in a different table
 * (`ontology_approvals`). It never saw a requirement, a wire, or a change
 * event. So Newton could say "ready to close" over a screen listing five
 * blockers, and a readiness figure that depends on which screen you are looking
 * at is worse than none.
 *
 * This module is pure: rows in, verdict out. The frontend calls it with the
 * rows it already fetches; the edge function calls it with the same rows read
 * under the service role. Neither may compute readiness any other way.
 */

export type ReadinessCategory =
  | "documents"
  | "funds_flow"
  | "verification"
  | "approvals"
  | "closing_requirements";

/**
 * A single reason this deal cannot close, in the shape a human needs: what is
 * wrong, why it matters, where it came from, and what to do next.
 */
export interface BlockingIssue {
  id: string;
  category: ReadinessCategory;
  title: string;
  reason: string;
  source: string;
  action: string;
  origin: "discrepancy" | "change_event" | "gate" | "requirement";
  targetSection: string;
  targetId?: string;
  createdAt?: string;
}

// ── Row shapes: the minimum each caller must supply ─────────────────────────
export interface ReadinessInput {
  deal: { buyer?: string | null; seller?: string | null } | null;
  stakeholders: Array<{ role?: string | null; verification_status?: string | null }>;
  contractDocs: Array<{ doc_type?: string | null; status?: string | null; is_current?: boolean | null }>;
  dealDocs: Array<{ doc_type?: string | null; status?: string | null }>;
  wires: Array<{ verification_status?: string | null }>;
  approvals: Array<{ status?: string | null; required?: boolean | null; invalidated_at?: string | null }>;
  discrepancies: Array<{
    id: string; rule_key: string; severity: string; message?: string | null;
    details?: unknown; object_type?: string | null; object_id?: string | null; created_at?: string;
  }>;
  changeEvents: Array<{
    id: string; change_type: string; blocks_closing?: boolean | null; title?: string | null;
    what_changed?: string | null; why_it_matters?: string | null; recommended_action?: string | null;
    source_label?: string | null; object_type?: string | null; object_id?: string | null; created_at?: string;
  }>;
  requirements: Array<{
    id: string; requirement_kind: string; title: string; description?: string | null;
    status: string; review_status?: string | null; blocks_closing?: boolean | null;
    due_date?: string | null; counterparty_name?: string | null; counterparty_email?: string | null;
    signatory_name?: string | null; source?: string | null; source_ref?: unknown; created_at?: string;
  }>;
}

export interface ReadinessGates {
  stakeholdersConfigured: boolean;
  sellerVerified: boolean;
  buyerVerified: boolean;
  spaUploaded: boolean;
  wireInstructionsUploaded: boolean;
  paymentsApproved: boolean;
  approvalsComplete: boolean;
}

export interface ClosingReadiness {
  canClose: boolean;
  gates: ReadinessGates;
  /** Every open reason this deal cannot close, most urgent first. */
  blockingIssues: BlockingIssue[];
  counts: {
    blockerDiscrepancies: number;
    blockingChangeEvents: number;
    invalidatedApprovals: number;
    openRequirements: number;
    blockingRequirements: number;
    requirementsAwaitingReview: number;
  };
}

// ── Normalisers and vocabularies ────────────────────────────────────────────
export const nStatus = (status: string | null | undefined) => String(status || "").toUpperCase();
export const nRole = (role: string | null | undefined) => String(role || "").toUpperCase().replace(/[\s-]+/g, "_");
export const nDocType = (type: string | null | undefined) => String(type || "OTHER").toUpperCase().replace(/[\s-]+/g, "_");

export const REQUIRED_STAKEHOLDER_ROLES = new Set(["BUYER", "SELLER", "TARGET", "MERGER_SUB"]);
export const BUYER_SIDE_ROLES = new Set(["BUYER", "MERGER_SUB", "INVESTOR", "LENDER", "BUYER_COUNSEL", "ADMINISTRATIVE_AGENT"]);
export const SELLER_SIDE_ROLES = new Set(["SELLER", "TARGET", "SHAREHOLDER", "FOUNDER", "EMPLOYEE", "ADVISOR", "SELLER_COUNSEL"]);

export const DEFAULT_REQUIRED_DOC_TYPES = [
  "SPA", "FUNDS_FLOW", "WIRE_INSTRUCTIONS", "ESCROW_AGREEMENT",
  "DISCLOSURE_SCHEDULES", "BOARD_CONSENT", "OFFICER_CERTIFICATE",
];
export const REQUIRED_DOC_EQUIVALENTS: Record<string, string[]> = {
  SPA: ["SPA", "MERGER_AGREEMENT", "PURCHASE_AGREEMENT"],
  FUNDS_FLOW: ["FUNDS_FLOW", "WATERFALL_MODEL", "DISTRIBUTION_SCHEDULE"],
  WIRE_INSTRUCTIONS: ["WIRE_INSTRUCTIONS", "WIRE_AUTHORIZATION", "BANK_LETTER"],
  ESCROW_AGREEMENT: ["ESCROW_AGREEMENT"],
  DISCLOSURE_SCHEDULES: ["DISCLOSURE_SCHEDULES"],
  BOARD_CONSENT: ["BOARD_CONSENT", "STOCKHOLDER_CONSENT"],
  OFFICER_CERTIFICATE: ["OFFICER_CERTIFICATE", "SECRETARY_CERTIFICATE"],
};
export const COMPLETED_DOC_STATUSES = new Set(["PARSED", "EXTRACTION_COMPLETE", "VERIFIED", "PROCESSED", "COMPLETED"]);
export const COMPLETED_APPROVAL_STATUSES = new Set(["APPROVED", "COMPLETED"]);
export const BLOCKED_APPROVAL_STATUSES = new Set(["DECLINED", "EXPIRED", "FAILED_DELIVERY", "BLOCKED"]);
export const VERIFIED_STAKEHOLDER_STATUSES = new Set(["VERIFIED", "COMPLETED"]);
export const CONFIRMED_OBLIGATION_STATUSES = new Set(["CONFIRMED", "SATISFIED", "WAIVED"]);
export const VERIFIED_WIRE_STATUSES = new Set(["VERIFIED", "CONFIRMED", "APPROVED"]);
export const SATISFIED_CONDITION_STATUSES = new Set(["MET", "SATISFIED", "WAIVED"]);
export const SETTLED_STATUSES = new Set(["SETTLED", "EXECUTED", "COMPLETED"]);

export function hasRequiredDoc(
  records: Array<{ doc_type?: string | null; status?: string | null }>,
  requiredType: string,
  completedOnly: boolean
): boolean {
  const accepted = new Set(REQUIRED_DOC_EQUIVALENTS[requiredType] || [requiredType]);
  return records.some((d) =>
    accepted.has(nDocType(d.doc_type)) && (!completedOnly || COMPLETED_DOC_STATUSES.has(nStatus(d.status)))
  );
}

// ── Categorisation ──────────────────────────────────────────────────────────
export function changeEventCategory(changeType: string): ReadinessCategory {
  switch (changeType) {
    case "approval_invalidated": return "approvals";
    case "verification_invalidated":
    case "wire_details_changed": return "verification";
    case "payment_added":
    case "payment_removed":
    case "payment_amount_changed":
    case "duplicate_payment_detected": return "funds_flow";
    case "document_version_added": return "documents";
    default: return "closing_requirements";
  }
}

export function discrepancyCategory(ruleKey: string): ReadinessCategory {
  const k = String(ruleKey || "");
  if (/doc|schedule|certificate|consent|opinion|binder|standing/.test(k)) return "documents";
  if (/funds_flow|wire|payee|waterfall|escrow|price|cap_table|fx|payment|intent/.test(k)) return "funds_flow";
  if (/kyc|kyb|sanction|verif|tax_form/.test(k)) return "verification";
  if (/approval|counsel/.test(k)) return "approvals";
  return "closing_requirements";
}

export function requirementCategory(kind: string): ReadinessCategory {
  switch (kind) {
    case "signature": return "approvals";
    case "external_document": return "documents";
    case "consent":
    case "notice":
    default: return "closing_requirements";
  }
}

export function sectionForCategory(category: ReadinessCategory): string {
  switch (category) {
    case "documents": return "documents";
    case "funds_flow": return "payments";
    case "verification": return "verification";
    case "approvals": return "approvals";
    default: return "overview";
  }
}

/** Deep-link target so every blocker is clickable through to its subject. */
export function sectionForObject(objectType: string | null | undefined, hint = ""): string {
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

// ── The verdict ─────────────────────────────────────────────────────────────
export function computeClosingReadiness(input: ReadinessInput): ClosingReadiness {
  const { deal, stakeholders, wires, approvals, discrepancies, changeEvents, requirements } = input;

  const buyerRows = stakeholders.filter((s) => BUYER_SIDE_ROLES.has(nRole(s.role)));
  const sellerRows = stakeholders.filter((s) => SELLER_SIDE_ROLES.has(nRole(s.role)));
  const verified = (s: { verification_status?: string | null }) =>
    VERIFIED_STAKEHOLDER_STATUSES.has(nStatus(s.verification_status));

  // Only the version in force counts; a superseded upload must not satisfy a
  // document gate on its own.
  const allDocs = [
    ...input.contractDocs.filter((d) => d.is_current !== false),
    ...input.dealDocs,
  ];

  const totalWires = wires.length;
  const verifiedWires = wires.filter((w) => VERIFIED_WIRE_STATUSES.has(nStatus(w.verification_status))).length;
  const requiredApprovals = approvals.filter((a) => a.required !== false);
  const grantedRequired = requiredApprovals.filter((a) => COMPLETED_APPROVAL_STATUSES.has(nStatus(a.status))).length;

  const gates: ReadinessGates = {
    stakeholdersConfigured: (buyerRows.length > 0 || !!deal?.buyer) && (sellerRows.length > 0 || !!deal?.seller),
    sellerVerified: sellerRows.length > 0 && sellerRows.every(verified),
    buyerVerified: buyerRows.length > 0 && buyerRows.every(verified),
    spaUploaded: hasRequiredDoc(allDocs, "SPA", false),
    wireInstructionsUploaded: totalWires > 0,
    paymentsApproved: totalWires > 0 && verifiedWires === totalWires,
    approvalsComplete: requiredApprovals.length > 0 && grantedRequired === requiredApprovals.length,
  };

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
    ...blockerDiscrepancies.map((d) => {
      const details = (d.details || {}) as Record<string, unknown>;
      return {
        id: `disc:${d.id}`,
        category: discrepancyCategory(d.rule_key),
        title: d.message || d.rule_key,
        reason: String(details.why_it_matters || d.message || ""),
        source: String(details.source || `Rule: ${d.rule_key}`),
        action: String(details.recommended_action || "Resolve this discrepancy before closing."),
        origin: "discrepancy" as const,
        targetSection: sectionForObject(d.object_type, d.rule_key),
        targetId: d.object_id || undefined,
        createdAt: d.created_at,
      };
    }),
  ];

  // A requirement blocks only if someone marked it as blocking AND it has
  // cleared human review; an unreviewed AI extraction is never allowed to gate
  // a closing on its own.
  const OPEN_REQ_STATUSES = new Set(["not_started", "draft_ready", "sent", "viewed", "responded", "under_review", "issue"]);
  const openRequirements = requirements.filter(
    (r) => OPEN_REQ_STATUSES.has(String(r.status)) && r.review_status !== "rejected"
  );
  const blockingRequirements = openRequirements.filter(
    (r) => r.blocks_closing === true && r.review_status === "approved"
  );
  const requirementsAwaitingReview = requirements.filter((r) => r.review_status === "pending_review");

  blockingIssues.push(
    ...blockingRequirements.map((r) => {
      const kindLabel = String(r.requirement_kind || "").replace(/_/g, " ");
      // Entity names routinely end in a period ("Acme Inc."); trim it so we
      // never print "Acme Inc..".
      const rawWho = r.signatory_name || r.counterparty_name || r.counterparty_email || "the counterparty";
      const who = String(rawWho).replace(/\.+$/, "");
      const overdue = !!r.due_date && new Date(r.due_date) < new Date();
      const ref = (r.source_ref || {}) as Record<string, string>;
      return {
        id: `req:${r.id}`,
        category: requirementCategory(r.requirement_kind),
        title: r.title,
        reason: [
          r.description,
          r.status === "issue" ? "The response received did not satisfy the request." :
          r.status === "under_review" ? "A response arrived but needs human review." :
          r.status === "not_started" ? `No ${kindLabel} request has been sent yet.` :
          `Awaiting a response from ${who}.`,
          overdue ? `Overdue since ${r.due_date}.` : "",
        ].filter(Boolean).join(" "),
        source: ref.filename
          ? `${ref.filename}${ref.clause_ref ? ` — ${ref.clause_ref}` : ""}`
          : r.source === "ai" ? "AI extraction (reviewed)" : "Manually added",
        action: r.status === "under_review" ? `Review the document submitted by ${who}.`
              : r.status === "issue" ? `Resolve the issue with ${who} and request a replacement.`
              : r.status === "not_started" ? `Send the ${kindLabel} request to ${who}.`
              : `Follow up with ${who}.`,
        origin: "requirement" as const,
        targetSection: requirementCategory(r.requirement_kind) === "approvals" ? "approvals" : "requirements",
        targetId: r.id,
        createdAt: r.created_at,
      };
    })
  );

  // Unmet hard gates are blockers too — one list, not three.
  const gateBlockers: Array<[boolean, string, ReadinessCategory, string, string, string]> = [
    [gates.stakeholdersConfigured, "Buyer and seller stakeholders not configured", "closing_requirements", "A deal cannot close without both sides identified.", "Deal record", "Add at least one buyer and one seller stakeholder."],
    [gates.sellerVerified, "Seller-side verification incomplete", "verification", "Funds cannot be released to an unverified party.", "Verification status", "Complete KYC/KYB for every seller-side stakeholder."],
    [gates.buyerVerified, "Buyer-side verification incomplete", "verification", "Funds cannot be sourced from an unverified party.", "Verification status", "Complete KYC/KYB for every buyer-side stakeholder."],
    [gates.spaUploaded, "No purchase agreement on file", "documents", "The operative agreement is missing, so nothing can be reconciled against it.", "Document set", "Upload the SPA or merger agreement."],
    [gates.wireInstructionsUploaded, "No wire instructions on file", "funds_flow", "There is no payment set to execute.", "Funds flow", "Upload the funds flow or add wire instructions."],
    [gates.paymentsApproved, "Not all wire instructions are verified", "verification", "Unverified payment instructions cannot be funded.", "Wire instructions", "Verify each remaining wire instruction."],
    [gates.approvalsComplete, "Required approvals outstanding", "approvals", "The payment set has not been authorised by everyone required.", "Approvals", "Collect the remaining required approvals."],
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

  // Ready only when the gates pass AND nothing is blocking. Before this, gates
  // alone decided, so "Ready" could appear over an open list of blockers.
  const canClose =
    Object.values(gates).every(Boolean) &&
    blockerDiscrepancies.length === 0 &&
    blockingChangeEvents.length === 0 &&
    invalidatedApprovals === 0 &&
    blockingRequirements.length === 0;

  return {
    canClose,
    gates,
    blockingIssues,
    counts: {
      blockerDiscrepancies: blockerDiscrepancies.length,
      blockingChangeEvents: blockingChangeEvents.length,
      invalidatedApprovals,
      openRequirements: openRequirements.length,
      blockingRequirements: blockingRequirements.length,
      requirementsAwaitingReview: requirementsAwaitingReview.length,
    },
  };
}
