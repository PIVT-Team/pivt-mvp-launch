import { supabase } from "@/integrations/supabase/client";

/**
 * Requirements Engine — client service.
 *
 * Signature packets, third-party consents and external document collection are
 * the same pattern: a requirement is extracted or created, a human reviews it,
 * a request goes out, evidence comes back, it gets verified, and the result
 * feeds Closing Readiness. They differ only by `requirement_kind`.
 *
 * Two rules are enforced in the database rather than here, deliberately —
 * a UI check is not a control:
 *   1. no request can be sent for a requirement that isn't `approved`
 *   2. no request can be sent unless the outbound message is `approved_to_send`
 * These helpers surface those errors rather than trying to pre-empt them.
 */

export type RequirementKind =
  | "signature" | "consent" | "notice" | "external_document" | "condition";

export type RequirementStatus =
  | "not_started" | "draft_ready" | "sent" | "viewed" | "responded"
  | "under_review" | "satisfied" | "waived" | "not_required" | "issue";

export type ReviewStatus = "pending_review" | "approved" | "rejected";
export type VerificationVerdict = "not_run" | "verified" | "review_required" | "rejected";

export interface DealRequirement {
  id: string;
  deal_id: string;
  requirement_kind: RequirementKind;
  title: string;
  description: string | null;
  category: string;
  status: RequirementStatus;
  review_status: ReviewStatus;
  blocks_closing: boolean;
  priority: string;
  due_date: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  internal_owner_id: string | null;
  entity_id: string | null;
  signing_party: string | null;
  signatory_name: string | null;
  signatory_capacity: string | null;
  trigger_event: string | null;
  requirement_type: string | null;
  source: string;
  source_ref: Record<string, unknown>;
  ai_confidence: number | null;
  ai_ambiguity: string | null;
  evidence_doc_id: string | null;
  satisfied_at: string | null;
  created_at: string;
}

export interface RequirementRequest {
  id: string;
  requirement_id: string;
  deal_id: string;
  channel: string;
  recipient_name: string | null;
  recipient_email: string;
  status: string;
  approved_to_send: boolean;
  sent_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  reminder_count: number;
  next_reminder_at: string | null;
  reminder_cadence_days: number[];
  auto_remind: boolean;
  escalated_at: string | null;
}

export interface RequirementEvidence {
  id: string;
  requirement_id: string;
  deal_id: string;
  filename: string | null;
  submitted_by_email: string | null;
  submitted_at: string;
  verification_verdict: VerificationVerdict;
  verification_confidence: number | null;
  verification_issues: Array<{ code: string; severity: string; message: string }>;
  verification_details: Record<string, unknown>;
  human_decision: "accepted" | "rejected" | null;
  decision_notes: string | null;
}

const OPEN_STATUSES: RequirementStatus[] = [
  "not_started", "draft_ready", "sent", "viewed", "responded", "under_review", "issue",
];

/** Everything on a deal, newest first. Excludes soft-deleted rows. */
export async function listRequirements(
  dealId: string,
  opts: { kind?: RequirementKind; openOnly?: boolean } = {}
): Promise<DealRequirement[]> {
  let q = supabase
    .from("deal_requirements")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (opts.kind) q = q.eq("requirement_kind", opts.kind);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data || []) as unknown as DealRequirement[];
  return opts.openOnly ? rows.filter((r) => OPEN_STATUSES.includes(r.status)) : rows;
}

/**
 * Create a requirement by hand. Manually-created requirements are approved on
 * creation — a person is already in the loop. AI-extracted ones are inserted by
 * the extractor with review_status 'pending_review'.
 */
export async function createRequirement(input: {
  dealId: string;
  kind: RequirementKind;
  title: string;
  description?: string;
  category?: string;
  counterpartyName?: string;
  counterpartyEmail?: string;
  internalOwnerId?: string;
  dueDate?: string;
  blocksClosing?: boolean;
  priority?: string;
}): Promise<DealRequirement> {
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("deal_requirements")
    .insert({
      deal_id: input.dealId,
      requirement_kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? "other",
      counterparty_name: input.counterpartyName ?? null,
      counterparty_email: input.counterpartyEmail ?? null,
      internal_owner_id: input.internalOwnerId ?? session?.user?.id ?? null,
      due_date: input.dueDate ?? null,
      blocks_closing: input.blocksClosing ?? false,
      priority: input.priority ?? "normal",
      source: "manual",
      review_status: "approved",
      reviewed_by: session?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      created_by: session?.user?.id ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DealRequirement;
}

/**
 * Approve, reject or amend an AI-extracted requirement.
 *
 * This is the guardrail every one of the three briefs calls for: an AI
 * extraction is a proposed interpretation, not a legal determination, and a
 * lawyer must be able to correct any field before anything is circulated.
 */
export async function reviewRequirement(
  requirementId: string,
  decision: "approved" | "rejected",
  edits?: Partial<Pick<DealRequirement,
    | "title" | "description" | "counterparty_name" | "counterparty_email"
    | "signatory_name" | "signatory_capacity" | "signing_party"
    | "requirement_type" | "trigger_event" | "due_date" | "blocks_closing" | "priority">>,
  notes?: string
): Promise<DealRequirement> {
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("deal_requirements")
    .update({
      ...(edits ?? {}),
      review_status: decision,
      reviewed_by: session?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null,
      // A rejected requirement stops gating the closing.
      ...(decision === "rejected" ? { status: "not_required", blocks_closing: false } : {}),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", requirementId)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DealRequirement;
}

/**
 * Draft an outbound request. Deliberately created with approved_to_send=false
 * and status 'draft': a person still has to read the message and approve it.
 */
export async function draftRequest(input: {
  requirementId: string;
  dealId: string;
  recipientEmail: string;
  recipientName?: string;
  channel?: "email" | "docusign" | "manual_export";
  cadenceDays?: number[];
  autoRemind?: boolean;
  escalateTo?: string;
}): Promise<RequirementRequest> {
  const { data: session } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("requirement_requests")
    .insert({
      requirement_id: input.requirementId,
      deal_id: input.dealId,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName ?? null,
      channel: input.channel ?? "email",
      reminder_cadence_days: input.cadenceDays ?? [3, 3, 2],
      auto_remind: input.autoRemind ?? true,
      escalate_to: input.escalateTo ?? null,
      status: "draft",
      approved_to_send: false,
      created_by: session?.user?.id ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as RequirementRequest;
}

/**
 * Human error, in the words a person needs. The database raises these as
 * check_violation exceptions; PostgREST surfaces them as opaque failures.
 */
export function explainRequestError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/has not been reviewed and approved/i.test(msg)) {
    return "This requirement hasn't been reviewed yet. Approve it before sending anything to the counterparty.";
  }
  if (/not approved to send/i.test(msg)) {
    return "The outbound message hasn't been approved. Review the draft, then approve it for sending.";
  }
  return msg || "Something went wrong sending this request.";
}

// ── the send path ───────────────────────────────────────────────────────────
//
// Until these existed the chain stopped at "requirement approved in review":
// `draft-requirement-request` and `send-requirement-request` had no callers,
// and nothing anywhere set `approved_to_send`. The database enforced
// review-before-send on a path nobody could reach.

/** All outbound requests on a deal, newest first. */
export async function listRequests(dealId: string): Promise<RequirementRequest[]> {
  const { data, error } = await supabase
    .from("requirement_requests")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as RequirementRequest[];
}

export interface DraftedRequest {
  request_id: string;
  recipient: string;
  subject: string;
  body: string;
  notes?: string[];
}

/**
 * Ask the engine for a draft. Server-side so the review gate is enforced there
 * and the message text comes from the requirement's own source clause.
 * Writes a `requirement_requests` row with approved_to_send=false.
 */
export async function draftRequestViaEngine(input: {
  requirementId: string;
  recipientEmail?: string;
  recipientName?: string;
  cadenceDays?: number[];
  dueDate?: string;
}): Promise<DraftedRequest> {
  const { data, error } = await supabase.functions.invoke("draft-requirement-request", {
    body: {
      requirement_id: input.requirementId,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
      cadence_days: input.cadenceDays,
      due_date: input.dueDate,
    },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Could not draft the request.");
  return data as DraftedRequest;
}

/** The human gate. Recorded with who and when; the send function checks it. */
export async function approveRequestToSend(requestId: string): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("requirement_requests")
    .update({
      approved_to_send: true,
      approved_by: session?.user?.id ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", requestId);
  if (error) throw error;
}

export interface SendResult {
  sent: boolean;
  link: string;
  expires_at: string;
  message: string;
}

/**
 * Send (or, where email delivery is disabled in the environment, prepare) the
 * approved request. The result says which happened; the UI must not say
 * "sent" when the engine says "prepared".
 */
export async function sendRequest(input: {
  requestId: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  // The portal lives at <site>/submit; BASE_URL covers a sub-path deploy.
  const base = `${window.location.origin}${import.meta.env.BASE_URL || "/"}`.replace(/\/+$/, "");
  const { data, error } = await supabase.functions.invoke("send-requirement-request", {
    body: { request_id: input.requestId, subject: input.subject, body: input.body, portal_base_url: base },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Could not send the request.");
  return data as SendResult;
}

/** Withdraw a draft that was never approved. */
export async function cancelRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("requirement_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq("id", requestId)
    .eq("status", "draft");
  if (error) throw error;
}
