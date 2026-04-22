import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LEGITIMATELY_UNAUTHENTICATED
 *
 * This function powers the public request-access flow for prospective users.
 * It must remain accessible before authentication and therefore cannot require a user JWT.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimitMap.set(ip, timestamps);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function buildConfirmationHtml(firstName: string, ticketId: string): string {
  const accent = "hsl(262, 72%, 55%)";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background-color:${accent};padding:28px 40px;">
    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1px;">PIVT</span>
  </td></tr>
  <tr><td style="padding:36px 40px 20px;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Your access request has been received</h1>
    <p style="margin:0 0 4px;font-size:13px;color:#888;">Request ID: <strong style="color:#1a1a2e;">${ticketId}</strong></p>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.6;">
      Thank you for requesting access to PIVT. Your request has been successfully submitted and is now under review.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.6;">
      A member of our team will follow up with you shortly. We typically respond within <strong>24–48 business hours</strong>.
    </p>
  </td></tr>
  <tr><td style="padding:20px 40px;border-top:1px solid #eee;">
    <p style="margin:0;font-size:13px;color:#999;line-height:1.5;">
      Best,<br><strong style="color:#555;">PIVT Team</strong>
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:#bbb;">
      © ${new Date().getFullYear()} PIVT Technologies Inc. All rights reserved.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildInternalHtml(data: {
  ticketId: string; fullName: string; contactEmail: string;
  company: string; position: string; message: string; submittedAt: string;
}): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px;">
  <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Access Request — ${data.ticketId}</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555; width: 140px;">Ticket ID:</td><td style="padding: 8px 0;">${data.ticketId}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Full Name:</td><td style="padding: 8px 0;">${data.fullName}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${data.contactEmail}">${data.contactEmail}</a></td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Company:</td><td style="padding: 8px 0;">${data.company}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Position:</td><td style="padding: 8px 0;">${data.position}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Submitted:</td><td style="padding: 8px 0;">${data.submittedAt}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold; color: #555;">Source:</td><td style="padding: 8px 0;">Demo — Request Access</td></tr>
  </table>
  ${data.message ? `<div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
    <p style="margin: 0 0 4px; font-weight: bold; color: #555;">Notes:</p>
    <p style="margin: 0; color: #333; white-space: pre-wrap;">${data.message}</p>
  </div>` : ''}
  <p style="margin-top: 24px; font-size: 12px; color: #999;">Sent via PIVT Access Request Form</p>
</div>`;
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

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { fullName, contactEmail, company, position, message, _hp } = body;

    // Honeypot
    if (_hp) {
      return new Response(JSON.stringify({ success: true, ticketId: "PIVT-REQ-0000" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validation
    if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0 || fullName.trim().length > 100) {
      return new Response(JSON.stringify({ success: false, error: "Please enter a valid name" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!contactEmail || !emailRegex.test(contactEmail.trim()) || contactEmail.trim().length > 255) {
      return new Response(JSON.stringify({ success: false, error: "Please enter a valid email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!company || typeof company !== "string" || company.trim().length === 0 || company.trim().length > 200) {
      return new Response(JSON.stringify({ success: false, error: "Please enter a valid company name" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!position || typeof position !== "string" || position.trim().length === 0 || position.trim().length > 200) {
      return new Response(JSON.stringify({ success: false, error: "Please enter a valid position" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sanitize = (s: string) => s.trim().replace(/[<>]/g, "");
    const data = {
      fullName: sanitize(fullName),
      contactEmail: contactEmail.trim(),
      company: sanitize(company),
      position: sanitize(position),
      message: message ? sanitize(message).slice(0, 2000) : "",
      submittedAt: new Date().toISOString(),
    };
    const firstName = data.fullName.split(" ")[0];

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Insert access request — ticket_id is auto-generated by trigger
    const { data: insertedRow, error: dbError } = await adminClient
      .from("access_requests")
      .insert({
        full_name: data.fullName,
        contact_email: data.contactEmail,
        company: data.company,
        position: data.position,
        message: data.message || null,
        source: "demo_request_access",
        status: "new",
      })
      .select("ticket_id")
      .single();

    if (dbError || !insertedRow) {
      console.error("Failed to store access request:", dbError);
      return new Response(JSON.stringify({ success: false, error: "Failed to submit request" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ticketId = insertedRow.ticket_id;
    console.log(`Access request created: ${ticketId} from ${data.contactEmail}`);

    // Internal notification to support@pivttech.ai
    const internalMsgId = `access-req-internal-${crypto.randomUUID()}`;
    const { error: internalError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: internalMsgId,
        run_id: internalMsgId,
        from: "PIVT Platform <no-reply@notify.pivttech.ai>",
        to: "support@pivttech.ai",
        subject: `New PIVT Access Request — ${ticketId} — ${data.company}`,
        html: buildInternalHtml({ ...data, ticketId }),
        text: `Ticket: ${ticketId}\nName: ${data.fullName}\nEmail: ${data.contactEmail}\nCompany: ${data.company}\nPosition: ${data.position}\nNotes: ${data.message}\nSource: Demo Request Access\nSubmitted: ${data.submittedAt}`,
        reply_to: data.contactEmail,
        purpose: "transactional",
        label: "access-request-internal",
        sender_domain: "notify.pivttech.ai",
        queued_at: new Date().toISOString(),
      },
    });

    if (internalError) {
      console.error("Failed to enqueue internal email:", JSON.stringify(internalError));
    }

    // Confirmation email to the requester
    try {
      const confirmMsgId = `access-req-confirm-${crypto.randomUUID()}`;
      await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: confirmMsgId,
          run_id: confirmMsgId,
          from: "PIVT <support@notify.pivttech.ai>",
          to: data.contactEmail,
          subject: `Your PIVT access request has been received (${ticketId})`,
          html: buildConfirmationHtml(firstName, ticketId),
          text: `Hi ${firstName},\n\nThank you for requesting access to PIVT. Your request (${ticketId}) has been received and is under review.\n\nA member of our team will follow up shortly.\n\n— PIVT Team`,
          reply_to: "support@pivttech.ai",
          purpose: "transactional",
          label: "access-request-confirmation",
          sender_domain: "notify.pivttech.ai",
          queued_at: new Date().toISOString(),
        },
      });
    } catch (confirmErr) {
      console.error("Confirmation email error (non-blocking):", confirmErr);
    }

    return new Response(
      JSON.stringify({ success: true, ticketId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request access error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
