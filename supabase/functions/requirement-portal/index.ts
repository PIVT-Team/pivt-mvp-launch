import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { THRESHOLDS } from "../_shared/thresholds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * The external stakeholder's door into PIVT.
 *
 * Feature 3: "The external stakeholder should not need a PIVT account. They
 * receive a secure link allowing them to view the request, upload the document
 * and submit. Keep this extremely simple."
 *
 * Deliberately unauthenticated — the token IS the credential. Which is exactly
 * why it is careful:
 *   - only the SHA-256 hash is stored, so a database leak yields no live links
 *   - expiry and cancellation are checked on every call
 *   - the response exposes only what the recipient already knows: what was
 *     asked for and which deal it concerns. No deal financials, no other
 *     requirements, no participant list.
 *   - the upload is written by the service role AFTER the token validates, so
 *     no storage bucket has to be opened to anonymous writes
 *
 * Actions: 'peek' (render the request) and 'submit' (accept the file).
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, action, filename, content_base64, submitter_email } = await req.json();
    if (!token) return json({ error: "Missing link token." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await hashToken(token);
    const { data: request } = await admin
      .from("requirement_requests")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    // Same message whether the token is wrong, cancelled or expired — a probe
    // should not be able to distinguish "never existed" from "used up".
    const dead = () => json({ error: "This link is no longer valid. Please ask your contact for a new one." }, 410);

    if (!request) return dead();
    if (request.status === "cancelled") return dead();
    if (request.expires_at && new Date(request.expires_at) < new Date()) return dead();

    const { data: requirement } = await admin
      .from("deal_requirements").select("*").eq("id", request.requirement_id).maybeSingle();
    if (!requirement) return dead();
    if (["satisfied", "waived", "not_required"].includes(requirement.status)) {
      return json({ error: "This item has already been completed. Nothing further is needed." }, 410);
    }

    const { data: deal } = await admin
      .from("deals").select("deal_name").eq("id", request.deal_id).maybeSingle();

    // ── peek ──────────────────────────────────────────────────────────────
    if (action !== "submit") {
      if (!request.opened_at) {
        await admin.from("requirement_requests")
          .update({ opened_at: new Date().toISOString(), status: request.status === "sent" ? "opened" : request.status })
          .eq("id", request.id);
        await admin.from("audit_log").insert({
          deal_id: request.deal_id, action: "requirement_request_opened",
          details: { request_id: request.id, requirement_id: requirement.id, recipient: request.recipient_email },
        });
      }
      return json({
        ok: true,
        request: {
          title: requirement.title,
          description: requirement.description,
          due_date: requirement.due_date,
          deal_name: deal?.deal_name ?? "a transaction",
          recipient_name: request.recipient_name,
          already_submitted: requirement.status === "under_review",
        },
      });
    }

    // ── submit ────────────────────────────────────────────────────────────
    if (!filename || !content_base64) return json({ error: "No file was received." }, 400);

    const bytes = decodeBase64(content_base64);
    if (bytes.length === 0) return json({ error: "The file appears to be empty." }, 400);
    if (bytes.length > THRESHOLDS.portalMaxUploadBytes) {
      return json({ error: `Files must be ${Math.round(THRESHOLDS.portalMaxUploadBytes / 1024 / 1024)}MB or smaller.` }, 400);
    }

    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
    const path = `${request.deal_id}/requirements/${requirement.id}/${Date.now()}_${safeName}`;

    const { error: upErr } = await admin.storage
      .from("deal-documents")
      .upload(path, bytes, { contentType: guessType(safeName), upsert: false });
    if (upErr) {
      console.error("requirement-portal upload failed:", upErr);
      return json({ error: "We could not store that file. Please try again." }, 500);
    }

    const { data: evidence, error: evErr } = await admin
      .from("requirement_evidence")
      .insert({
        requirement_id: requirement.id,
        deal_id: request.deal_id,
        request_id: request.id,
        storage_path: path,
        filename: safeName,
        submitted_by_email: submitter_email || request.recipient_email,
        verification_verdict: "not_run",
      })
      .select("id").single();
    if (evErr) return json({ error: "We stored the file but could not record it. Please tell your contact." }, 500);

    await admin.from("requirement_requests")
      .update({ status: "responded", responded_at: new Date().toISOString(), auto_remind: false, next_reminder_at: null })
      .eq("id", request.id);

    await admin.from("deal_requirements")
      .update({ status: "under_review", updated_at: new Date().toISOString() })
      .eq("id", requirement.id);

    await admin.from("audit_log").insert({
      deal_id: request.deal_id, action: "requirement_document_submitted",
      details: { request_id: request.id, requirement_id: requirement.id, evidence_id: evidence.id, filename: safeName },
    });

    // Verification runs after the response — the submitter should never wait
    // on a model call, and a verification failure must not lose their upload.
    void admin.functions.invoke("verify-requirement-document", {
      body: { evidence_id: evidence.id },
    }).catch((e) => console.error("verification dispatch failed:", e));

    return json({ ok: true, message: "Received. Thank you — we'll be in touch if anything else is needed." });
  } catch (e) {
    console.error("requirement-portal error:", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "application/pdf"
    : ext === "png" ? "image/png"
    : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "doc" ? "application/msword"
    : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/octet-stream";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
