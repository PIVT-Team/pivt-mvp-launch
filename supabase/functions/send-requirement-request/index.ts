import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Send an approved request. The only place a counterparty is ever contacted.
 *
 * The two human gates are enforced by the database, not here: the requirement
 * must be `review_status = 'approved'`, and the request must be
 * `approved_to_send = true`. This function sets status='sent', and if either
 * gate is unmet the `requirement_requests_require_review` trigger raises and
 * the send is refused. That is deliberate — the check lives where it cannot be
 * bypassed by another caller.
 *
 * SEND_REQUIREMENT_EMAILS must be 'true' in the environment. Default is off, so
 * a misconfigured deployment cannot start mailing real counterparties.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const { request_id, subject, body, portal_base_url } = await req.json();
    if (!request_id) return json({ error: "request_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rq } = await admin
      .from("requirement_requests").select("*").eq("id", request_id).maybeSingle();
    if (!rq) return json({ error: "Request not found." }, 404);
    if (["sent", "opened", "responded"].includes(rq.status)) {
      return json({ error: "This request has already been sent." }, 409);
    }

    const { data: r } = await admin
      .from("deal_requirements").select("*").eq("id", rq.requirement_id).maybeSingle();
    if (!r) return json({ error: "Requirement not found." }, 404);

    // Mirror the DB gates with readable errors, so the UI shows a sentence
    // rather than a raw check_violation. The DB still has the final say.
    if (r.review_status !== "approved") {
      return json({ error: "This requirement hasn't been reviewed and approved yet." }, 409);
    }
    if (!rq.approved_to_send) {
      return json({ error: "This message hasn't been approved for sending. Review the draft first." }, 409);
    }

    // One-time token: the recipient gets the raw value, we keep only the hash.
    const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(raw);
    const base = (portal_base_url || Deno.env.get("PORTAL_BASE_URL") || "https://pivt.tools").replace(/\/$/, "");
    const link = `${base}/submit?t=${raw}`;

    const expires = new Date(Date.now() + 30 * 864e5).toISOString();
    const finalBody = String(body || "").replace("[SECURE UPLOAD LINK]", link);
    const finalSubject = subject || `Document request — ${r.title}`;

    const sendingEnabled = (Deno.env.get("SEND_REQUIREMENT_EMAILS") || "").toLowerCase() === "true";

    if (sendingEnabled) {
      const { error: qErr } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: rq.recipient_email,
          from: "PIVT <support@pivttech.ai>",
          subject: finalSubject,
          template_name: "requirement_request",
          body: finalBody,
          metadata: { requirement_id: r.id, request_id: rq.id, deal_id: r.deal_id },
        },
      });
      if (qErr) return json({ error: `Could not queue the email: ${qErr.message}` }, 500);
    }

    // Setting status='sent' fires the trigger, which re-checks both gates and
    // schedules the first reminder off the cadence.
    const { error: upErr } = await admin
      .from("requirement_requests")
      .update({
        token_hash: tokenHash,
        expires_at: expires,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", request_id);
    if (upErr) return json({ error: upErr.message }, 400);

    await admin.from("deal_requirements")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", r.id);

    await admin.from("audit_log").insert({
      deal_id: r.deal_id, user_id: userId,
      action: sendingEnabled ? "requirement_request_sent" : "requirement_request_prepared_not_sent",
      details: {
        requirement_id: r.id, request_id: rq.id, recipient: rq.recipient_email,
        sending_enabled: sendingEnabled, expires_at: expires,
      },
    });

    return json({
      success: true,
      sent: sendingEnabled,
      recipient: rq.recipient_email,
      // Returned once. With sending disabled this is how you deliver it by hand.
      link,
      expires_at: expires,
      message: sendingEnabled
        ? "Sent. Reminders will follow the cadence until it's satisfied."
        : "Prepared but NOT emailed — SEND_REQUIREMENT_EMAILS is not enabled. Copy the link above to send it yourself.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (/has not been reviewed|not approved to send/i.test(msg)) {
      return json({ error: msg }, 409);
    }
    return json({ error: msg }, 500);
  }
});

async function sha256(s: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
