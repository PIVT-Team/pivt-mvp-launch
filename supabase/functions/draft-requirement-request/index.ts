import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Draft the outbound message for a requirement, using what the deal already knows.
 *
 * Feature 2 step 6 and Feature 3 step 3: PIVT generates the request; a lawyer
 * edits and approves it; only then does anything leave the building.
 *
 * This function writes a DRAFT only. It sets `approved_to_send = false` and
 * status 'draft', so the database trigger will refuse to send it until a human
 * has read it. Drafting and sending are deliberately different operations.
 *
 * Deterministic templates rather than free generation. A consent request is a
 * quasi-legal communication; the wording should be predictable, reviewable and
 * the same every time, with the AI adding nothing it wasn't given. The clause
 * text is quoted verbatim from `source_ref`, never paraphrased.
 */

interface DraftOut { subject: string; body: string; notes: string[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireJwt(req, corsHeaders);
    const { requirement_id, recipient_email, recipient_name, cadence_days, due_date } = await req.json();
    if (!requirement_id) return json({ error: "requirement_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: r } = await admin
      .from("deal_requirements").select("*").eq("id", requirement_id).maybeSingle();
    if (!r) return json({ error: "Requirement not found." }, 404);

    // Refuse to draft for something a human hasn't accepted as real. Drafting
    // an unreviewed AI finding invites someone to hit send on a guess.
    if (r.review_status !== "approved") {
      return json({
        error: "This requirement hasn't been reviewed and approved yet. Review it before drafting a request.",
      }, 409);
    }

    const { data: deal } = await admin
      .from("deals").select("deal_name, buyer, seller, target_company").eq("id", r.deal_id).maybeSingle();

    const to = recipient_email || r.counterparty_email;
    if (!to) {
      return json({ error: "No recipient email. Add a contact for this counterparty first." }, 400);
    }

    const draft = buildDraft(r, deal, recipient_name || r.counterparty_name);
    const effectiveDue = due_date || r.due_date;

    const { data: request, error } = await admin
      .from("requirement_requests")
      .insert({
        requirement_id: r.id,
        deal_id: r.deal_id,
        recipient_email: to,
        recipient_name: recipient_name || r.counterparty_name || null,
        channel: "email",
        status: "draft",
        approved_to_send: false,          // the gate — a person must clear this
        reminder_cadence_days: Array.isArray(cadence_days) && cadence_days.length
          ? cadence_days : [3, 3, 2],
        auto_remind: true,
      })
      .select("id").single();
    if (error) return json({ error: error.message }, 500);

    if (effectiveDue && effectiveDue !== r.due_date) {
      await admin.from("deal_requirements")
        .update({ due_date: effectiveDue, updated_at: new Date().toISOString() })
        .eq("id", r.id);
    }

    await admin.from("audit_log").insert({
      deal_id: r.deal_id, action: "requirement_request_drafted",
      details: { requirement_id: r.id, request_id: request.id, recipient: to },
    });

    return json({
      success: true,
      request_id: request.id,
      recipient: to,
      subject: draft.subject,
      body: draft.body,
      notes: draft.notes,
      note: "Draft only. Nothing sends until a person reviews it and approves it for sending.",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function buildDraft(r: any, deal: any, recipient: string | null): DraftOut {
  const src = (r.source_ref || {}) as Record<string, string>;
  const dealName = deal?.deal_name || "a pending transaction";
  const target = deal?.target_company || deal?.seller || "the company";
  const who = recipient || r.counterparty_name || "there";
  const notes: string[] = [];
  const by = r.due_date ? ` by ${fmt(r.due_date)}` : "";

  if (r.requirement_kind === "consent" || r.requirement_kind === "notice") {
    const isNotice = r.requirement_type === "notice";
    const clause = src.snippet
      ? `\n\nThe relevant provision${src.clause_ref ? ` (${src.clause_ref})` : ""} reads:\n\n    "${src.snippet}"\n`
      : "\n";

    if (!src.snippet) notes.push("No clause text was captured — consider quoting the provision before sending.");
    if (r.requirement_type === "unclear") {
      notes.push("This requirement is classified 'unclear'. Confirm whether it genuinely applies before sending.");
    }

    return {
      subject: isNotice
        ? `Notice of transaction — ${target}`
        : `Consent request — ${target} (${r.trigger_event || "change of control"})`,
      body:
`Dear ${who},

We are writing in connection with ${target}, which is party to an agreement with you.

${target} is undertaking a transaction that we believe constitutes ${r.trigger_event || "a change of control"} for the purposes of that agreement.${clause}
${isNotice
  ? `This letter is provided as notice under that provision. No response is required, though please confirm receipt${by} if convenient.`
  : `We are therefore requesting your written consent to the transaction${by}. Please reply to this email confirming your consent, or let us know if you need further information.`}

We would be glad to answer any questions.

Kind regards
${dealName} transaction team`,
      notes,
    };
  }

  // external document / condition
  const detail = r.description ? `\n\nSpecifically: ${r.description}` : "";
  if (!r.description) notes.push("No description — consider adding detail about the format or period required.");

  return {
    subject: `Document request — ${r.title}`,
    body:
`Dear ${who},

We are working towards closing ${dealName} and need one item from you:

    ${r.title}${detail}

You can upload it securely using the link below — no account or sign-up is needed, and the link is unique to this request.

    [SECURE UPLOAD LINK]

Please send it${by ? by : " at your earliest convenience"}. If you have any questions, or if this should be directed to a colleague, just reply to this email.

Thank you
${dealName} transaction team`,
    notes: [...notes, "[SECURE UPLOAD LINK] is replaced with the real one-time link when the request is approved for sending."],
  };
}

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
