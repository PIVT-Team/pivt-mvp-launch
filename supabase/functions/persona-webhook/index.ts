// persona-webhook
//
// Receives Persona webhooks (JSON:API spec). Webhooks are the ONLY source
// of truth for inquiry status — SDK callbacks can drop on mobile network
// transitions, replay attacks are possible, and Persona retries up to 8
// times. Three non-negotiables:
//
//   1. HMAC-SHA256 signature verification with constant-time compare.
//   2. Timestamp freshness check (≤5 min) to block replay.
//   3. Idempotency by event.id — the same event can land twice; we record
//      every event in persona_webhook_events and short-circuit if seen.
//
// This function is LEGITIMATELY_UNAUTHENTICATED — Persona doesn't send a
// JWT. It must remain publicly reachable. Auth is via signature only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, persona-signature",
};

const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Constant-time string compare so an attacker can't observe how many
// characters of the signature match via timing side channel.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sigBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// Persona-Signature header format:
//   t=1234567890,v1=hex_hmac,v1=hex_hmac_old_secret
// Multiple v1= values mean a key rotation is in progress; accept any match.
interface ParsedSig { timestamp: string; v1: string[] }
function parseSignatureHeader(header: string): ParsedSig | null {
  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  const v1: string[] = [];
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    const v = rest.join("=");
    if (k === "t") timestamp = v;
    else if (k === "v1") v1.push(v);
  }
  if (!timestamp || v1.length === 0) return null;
  return { timestamp, v1 };
}

async function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<{ ok: boolean; reason?: string }> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: "Malformed Persona-Signature header" };
  const ts = parseInt(parsed.timestamp, 10);
  if (!ts || Number.isNaN(ts)) return { ok: false, reason: "Invalid timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_SECONDS) {
    return { ok: false, reason: `Timestamp drift > ${MAX_TIMESTAMP_DRIFT_SECONDS}s (replay protection)` };
  }
  // Persona signs `<timestamp>.<raw body>`
  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${rawBody}`);
  for (const candidate of parsed.v1) {
    if (timingSafeEqual(expected, candidate)) return { ok: true };
  }
  return { ok: false, reason: "Signature mismatch" };
}

// Map Persona inquiry status → our cap_table_entries.verification_status
function mapInquiryStatusToVerification(personaStatus: string): string {
  switch (personaStatus) {
    case "approved":
    case "completed":
      return "verified";
    case "declined":
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "needs_review":
      return "submitted";
    case "pending":
    case "created":
      return "in_progress";
    default:
      return "in_progress";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret = Deno.env.get("PERSONA_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("persona-webhook: PERSONA_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Read body as text first — we need the EXACT bytes for HMAC.
  const rawBody = await req.text();
  const sigHeader = req.headers.get("persona-signature") || req.headers.get("Persona-Signature");
  if (!sigHeader) {
    return json({ error: "Missing Persona-Signature header" }, 401);
  }

  const verify = await verifySignature(rawBody, sigHeader, webhookSecret);
  if (!verify.ok) {
    console.warn("persona-webhook: signature verification failed:", verify.reason);
    // Still 401 — Persona will retry, so if rotation is happening we get a
    // second chance with the new secret.
    return json({ error: verify.reason }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const eventId: string | undefined = payload?.data?.id;
  const eventType: string | undefined = payload?.data?.attributes?.name;
  const inquiryId: string | undefined =
    payload?.data?.attributes?.payload?.data?.id ||
    payload?.data?.relationships?.payload?.data?.id;
  const accountId: string | undefined =
    payload?.data?.attributes?.payload?.data?.relationships?.account?.data?.id ||
    payload?.data?.attributes?.payload?.included?.find?.((x: any) => x?.type === "account")?.id;

  if (!eventId) {
    return json({ error: "Missing event id" }, 400);
  }

  // Idempotency: upsert into persona_webhook_events. If a duplicate event_id
  // hits, we 200 OK so Persona stops retrying but skip side-effects.
  const { data: insertedEvent, error: insertErr } = await admin
    .from("persona_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType || "unknown",
      persona_inquiry_id: inquiryId || null,
      persona_account_id: accountId || null,
      signature_verified: true,
      payload,
    })
    .select()
    .single();

  if (insertErr) {
    // Duplicate key = already processed. Return 200 so Persona drops retry.
    if ((insertErr as any).code === "23505") {
      return json({ ok: true, deduped: true });
    }
    console.error("persona-webhook: insert event failed", insertErr);
    return json({ error: "Storage error" }, 500);
  }

  // Process side-effects based on event type
  try {
    if (inquiryId && (eventType?.startsWith("inquiry.") || eventType?.startsWith("verification."))) {
      const inquiryPayload = payload?.data?.attributes?.payload?.data;
      const newStatus: string = inquiryPayload?.attributes?.status ?? "pending";
      const verifStatus = mapInquiryStatusToVerification(newStatus);
      const referenceId: string | undefined = inquiryPayload?.attributes?.["reference-id"];

      // Update persona_inquiries
      const { data: updatedRows } = await admin
        .from("persona_inquiries")
        .update({
          status: newStatus,
          last_event_at: new Date().toISOString(),
          persona_account_id: accountId || undefined,
          completed_at: ["approved", "completed", "declined", "failed", "expired"].includes(newStatus)
            ? new Date().toISOString()
            : null,
          raw_payload: payload,
        })
        .eq("persona_inquiry_id", inquiryId)
        .select();

      // Mirror to cap_table_entries so the existing KYC UI reflects the
      // verification result without needing to know about Persona tables.
      const stakeholderId = updatedRows?.[0]?.stakeholder_id || referenceId;
      if (stakeholderId) {
        const updatePayload: Record<string, unknown> = {
          verification_status: verifStatus,
        };
        if (verifStatus === "verified") {
          updatePayload.verification_completed_at = new Date().toISOString();
          updatePayload.verification_rejection_reason = null;
          if (accountId) updatePayload.persona_account_id = accountId;
          updatePayload.persona_last_inquiry_id = inquiryId;
          updatePayload.persona_last_verified_at = new Date().toISOString();
        }
        if (verifStatus === "failed") {
          updatePayload.verification_rejection_reason =
            inquiryPayload?.attributes?.["decision-reason"] || "Failed Persona verification";
        }
        await admin.from("cap_table_entries").update(updatePayload).eq("id", stakeholderId);

        // Audit
        await admin.from("audit_log").insert({
          action: `persona_inquiry_${newStatus}`,
          details: {
            inquiry_id: inquiryId,
            account_id: accountId || null,
            stakeholder_id: stakeholderId,
            event_id: eventId,
          },
        });
      }
    }

    // Watchlist Report events fold into the inquiry that triggered them
    if (eventType?.startsWith("report.") && inquiryId) {
      const reportId: string | undefined = payload?.data?.attributes?.payload?.data?.id;
      await admin
        .from("persona_inquiries")
        .update({
          watchlist_report_id: reportId,
          last_event_at: new Date().toISOString(),
        })
        .eq("persona_inquiry_id", inquiryId);
    }

    // Mark event as processed
    await admin
      .from("persona_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message || "Unknown processing error";
    console.error("persona-webhook: processing error", err);
    await admin
      .from("persona_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: msg })
      .eq("event_id", eventId);
    // 500 so Persona retries — the event is preserved either way.
    return json({ error: msg }, 500);
  }
});
