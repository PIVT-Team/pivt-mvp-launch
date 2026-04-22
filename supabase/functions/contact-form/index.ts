import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LEGITIMATELY_UNAUTHENTICATED
 *
 * This function accepts submissions from the public contact/support form.
 * It must remain reachable before login, so it intentionally does not require a user JWT.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per IP, 3 submissions per 10 min)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW
  );
  rateLimitMap.set(ip, timestamps);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function generateTicketId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PIVT-${num}`;
}

function buildConfirmationHtml(firstName: string, ticketId: string, messagePreview: string): string {
  const accent = "hsl(262, 72%, 55%)";
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 200) + "…" : messagePreview;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="background-color:${accent};padding:28px 40px;">
    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">PIVT</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 40px 20px;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">We've received your request</h1>
    <p style="margin:0 0 4px;font-size:13px;color:#888;">Request ID: <strong style="color:#1a1a2e;">${ticketId}</strong></p>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
      Thanks for reaching out to PIVT support. We've received your message and our team will review it shortly.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
      We typically respond within <strong>24–48 business hours</strong>.
    </p>
    <!-- Message preview -->
    <div style="padding:16px;background:#f9f9fb;border-radius:8px;border-left:3px solid ${accent};">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your message</p>
      <p style="margin:0;font-size:14px;color:#444;line-height:1.5;white-space:pre-wrap;">${preview}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0 0 8px;font-size:14px;color:#555;line-height:1.5;">
      If your request is urgent, you can follow up directly at:<br>
      <a href="mailto:support@pivttech.ai" style="color:${accent};text-decoration:none;font-weight:600;">support@pivttech.ai</a>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 40px;border-top:1px solid #eee;">
    <p style="margin:0;font-size:13px;color:#999;line-height:1.5;">
      Best,<br><strong style="color:#555;">PIVT Support Team</strong>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;">
      © ${new Date().getFullYear()} PIVT Technologies Inc. All rights reserved.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildConfirmationText(firstName: string, ticketId: string, messagePreview: string): string {
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 200) + "…" : messagePreview;
  return `We've received your request

Request ID: ${ticketId}

Hi ${firstName},

Thanks for reaching out to PIVT support. We've received your message and our team will review it shortly.

We typically respond within 24–48 business hours.

Your message:
"${preview}"

If your request is urgent, you can follow up directly at:
support@pivttech.ai

Best,
PIVT Support Team`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      console.warn(`Rate limited: ${clientIp}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { name, email, message, _hp } = body;

    // Honeypot check
    if (_hp) {
      console.warn("Honeypot triggered");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid name" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim()) || email.trim().length > 255) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0 || message.trim().length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid message" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedName = name.trim().replace(/[<>]/g, "");
    const sanitizedEmail = email.trim();
    const sanitizedMessage = message.trim().replace(/[<>]/g, "");
    const submittedAt = new Date().toISOString();
    const ticketId = generateTicketId();
    const firstName = sanitizedName.split(" ")[0];

    console.log(`Contact form submission from: ${sanitizedEmail} — Ticket: ${ticketId}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Store submission in database for admin support inbox
    try {
      await adminClient.from("contact_submissions").insert({
        name: sanitizedName,
        email: sanitizedEmail,
        message: sanitizedMessage,
        source: "contact_page",
        status: "new",
        priority: "normal",
        category: "other",
        tags: [ticketId],
      });
    } catch (dbErr) {
      console.error("Failed to store submission:", dbErr);
    }

    // (A) Internal notification email to support@pivttech.ai
    const internalMessageId = `contact-${crypto.randomUUID()}`;
    const internalHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Support Request — ${ticketId}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">Name:</td>
            <td style="padding: 8px 0;">${sanitizedName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${sanitizedEmail}">${sanitizedEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Ticket ID:</td>
            <td style="padding: 8px 0;">${ticketId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Submitted at:</td>
            <td style="padding: 8px 0;">${submittedAt}</td>
          </tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <p style="margin: 0 0 4px; font-weight: bold; color: #555;">Message:</p>
          <p style="margin: 0; color: #333; white-space: pre-wrap;">${sanitizedMessage}</p>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">Sent via PIVT Contact Form</p>
      </div>
    `;
    const internalText = `Ticket: ${ticketId}\nName: ${sanitizedName}\nEmail: ${sanitizedEmail}\nSubmitted at: ${submittedAt}\n\nMessage:\n${sanitizedMessage}`;

    const { error: internalError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: internalMessageId,
        run_id: internalMessageId,
        from: "PIVT Support <no-reply@notify.pivttech.ai>",
        to: "support@pivttech.ai",
        subject: `New Support Request ${ticketId} – PIVT`,
        html: internalHtml,
        text: internalText,
        reply_to: sanitizedEmail,
        purpose: "transactional",
        label: "contact-form",
        sender_domain: "notify.pivttech.ai",
        queued_at: new Date().toISOString(),
      },
    });

    if (internalError) {
      console.error("Failed to enqueue internal email:", JSON.stringify(internalError));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // (B) User confirmation email — fire-and-forget (don't block on failure)
    try {
      const confirmationMessageId = `confirm-${crypto.randomUUID()}`;
      const { error: confirmError } = await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: confirmationMessageId,
          run_id: confirmationMessageId,
          from: "PIVT Support <support@notify.pivttech.ai>",
          to: sanitizedEmail,
          subject: `We received your request — PIVT Support (${ticketId})`,
          html: buildConfirmationHtml(firstName, ticketId, sanitizedMessage),
          text: buildConfirmationText(firstName, ticketId, sanitizedMessage),
          reply_to: "support@pivttech.ai",
          purpose: "transactional",
          label: "support-confirmation",
          sender_domain: "notify.pivttech.ai",
          queued_at: new Date().toISOString(),
        },
      });

      if (confirmError) {
        console.error("Failed to enqueue confirmation email:", JSON.stringify(confirmError));
      } else {
        console.log(`Confirmation email enqueued: ${confirmationMessageId}`);
      }
    } catch (confirmErr) {
      console.error("Confirmation email error (non-blocking):", confirmErr);
    }

    console.log(`Emails enqueued successfully: ${internalMessageId}, ticket: ${ticketId}`);
    return new Response(
      JSON.stringify({ success: true, ticketId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
