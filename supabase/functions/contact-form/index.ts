import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`Contact form submission from: ${sanitizedEmail}`);

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
      });
    } catch (dbErr) {
      console.error("Failed to store submission:", dbErr);
    }

    // Enqueue email via the managed email queue
    const messageId = `contact-${crypto.randomUUID()}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Support Request</h2>
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
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Submitted at:</td>
            <td style="padding: 8px 0;">${submittedAt}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #555;">Source:</td>
            <td style="padding: 8px 0;">Contact &amp; Support page</td>
          </tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          <p style="margin: 0 0 4px; font-weight: bold; color: #555;">Message:</p>
          <p style="margin: 0; color: #333; white-space: pre-wrap;">${sanitizedMessage}</p>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">Sent via PIVT Contact Form</p>
      </div>
    `;

    const textBody = `Name: ${sanitizedName}\nEmail: ${sanitizedEmail}\nSubmitted at: ${submittedAt}\nSource: Contact & Support page\n\nMessage:\n${sanitizedMessage}`;

    const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: "support@pivttech.ai",
        subject: "New Support Request – PIVT",
        html: htmlBody,
        text: textBody,
        reply_to: sanitizedEmail,
        purpose: "transactional",
        label: "contact-form",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue email:", JSON.stringify(enqueueError));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email enqueued successfully: ${messageId}`);
    return new Response(
      JSON.stringify({ success: true }),
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
