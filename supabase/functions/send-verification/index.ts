import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function errorResponse(message: string, status: number, details?: unknown) {
  console.error(`[send-verification] ERROR ${status}: ${message}`, details ?? "");
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: jsonHeaders }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return errorResponse("Unauthorized", 401);
    }
    const userId = claimsData.claims.sub as string;

    // --- Step 1: Parse & validate inputs ---
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const { stakeholder_id, deal_id } = body as { stakeholder_id?: string; deal_id?: string };
    console.log("[send-verification] Request payload:", { stakeholder_id, deal_id, userId });

    if (!deal_id) return errorResponse("Missing dealId", 400);
    if (!stakeholder_id) return errorResponse("Missing stakeholderId", 400);

    // --- Step 2: Fetch stakeholder & validate ---
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: stakeholder, error: sErr } = await adminClient
      .from("cap_table_entries")
      .select("*")
      .eq("id", stakeholder_id)
      .eq("deal_id", deal_id)
      .maybeSingle();

    if (sErr) {
      return errorResponse("Failed to look up stakeholder", 500, sErr.message);
    }
    if (!stakeholder) {
      return errorResponse("Stakeholder not found for this deal", 404);
    }
    if (!stakeholder.email) {
      return errorResponse("Stakeholder has no email address. Add an email before sending verification.", 400);
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stakeholder.email)) {
      return errorResponse(`Invalid email format: ${stakeholder.email}`, 400);
    }

    if (stakeholder.verification_status === "verified") {
      return errorResponse("Stakeholder is already verified", 400);
    }

    // --- Fetch deal + profile in parallel ---
    const [dealRes, profileRes] = await Promise.all([
      adminClient.from("deals").select("deal_name, deal_number").eq("id", deal_id).maybeSingle(),
      adminClient.from("profiles").select("full_name, organization").eq("user_id", userId).maybeSingle(),
    ]);

    const deal = dealRes.data;
    const profile = profileRes.data;

    // --- Generate verification token ---
    const rawToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);

    // Revoke existing pending requests
    await adminClient
      .from("verification_requests")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("stakeholder_id", stakeholder_id)
      .in("status", ["pending", "sent"]);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create verification request
    const { data: verReq, error: insertErr } = await adminClient
      .from("verification_requests")
      .insert({
        stakeholder_id,
        deal_id,
        recipient_email: stakeholder.email,
        recipient_name: stakeholder.shareholder_name,
        stakeholder_type: stakeholder.stakeholder_type || "individual",
        token_hash: tokenHash,
        status: "pending",
        created_by: userId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      return errorResponse("Failed to create verification request", 500, insertErr.message);
    }

    // --- Step 4: MOCK mode check ---
    const emailMode = (Deno.env.get("EMAIL_MODE") || "").toUpperCase();
    if (emailMode === "MOCK") {
      console.log("[send-verification] MOCK MODE — email would be sent to:", stakeholder.email);
      const now = new Date().toISOString();
      await adminClient
        .from("verification_requests")
        .update({ status: "sent", sent_at: now })
        .eq("id", verReq.id);
      await adminClient
        .from("cap_table_entries")
        .update({
          verification_status: "sent",
          verification_requested_at: stakeholder.verification_requested_at || now,
          verification_last_sent_at: now,
          verification_provider: "mock",
        } as any)
        .eq("id", stakeholder_id);
      return new Response(
        JSON.stringify({ success: true, mode: "MOCK", request_id: verReq.id }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // --- Step 3: Check email provider config ---
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return errorResponse("Email provider not configured: missing RESEND_API_KEY", 500);
    }

    // Build verification URL
    const siteUrl = Deno.env.get("SITE_URL") || `https://id-preview--7a07f5f2-4b1d-47b9-b6b9-ed69164d12f6.lovable.app`;
    const verifyUrl = `${siteUrl}/verify?token=${rawToken}`;
    const logoUrl = `${siteUrl}/pivt-favicon-new.png`;

    const isKYB = (stakeholder.stakeholder_type || "individual") === "entity";
    const dealName = deal?.deal_name || "a transaction";
    const contactName = stakeholder.shareholder_name || "there";
    const requesterName = profile?.full_name || "A team member";
    const requesterEmail = (await supabase.auth.getUser()).data?.user?.email || "";
    const requestingFirmName = profile?.organization || "PIVT";
    const entityName = stakeholder.shareholder_name || "your entity";
    const expiresAtFormatted = expiresAt.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const subject = isKYB
      ? `Action required: Business verification for ${entityName}`
      : `Action required: Identity verification requested by ${requestingFirmName}`;

    const emailHtml = buildEmailHtml({
      isKYB, logoUrl, contactName, entityName, dealName, verifyUrl,
      requesterName, requesterEmail, requestingFirmName, expiresAt: expiresAtFormatted,
    });

    console.log("[send-verification] Sending email via Resend to:", stakeholder.email);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PIVT Verification <onboarding@resend.dev>",
        to: [stakeholder.email],
        subject,
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error("[send-verification] Resend API error:", emailRes.status, emailData);
      const detail = emailData?.message || emailData?.name || JSON.stringify(emailData);
      return errorResponse(`Email provider error: ${detail}`, 502, emailData);
    }

    console.log("[send-verification] Email sent successfully:", emailData);

    // Update status
    const now = new Date().toISOString();
    await adminClient
      .from("verification_requests")
      .update({ status: "sent", sent_at: now })
      .eq("id", verReq.id);

    await adminClient
      .from("cap_table_entries")
      .update({
        verification_status: "sent",
        verification_requested_at: stakeholder.verification_requested_at || now,
        verification_last_sent_at: now,
        verification_provider: "resend",
      } as any)
      .eq("id", stakeholder_id);

    return new Response(
      JSON.stringify({ success: true, request_id: verReq.id, email_id: emailData?.id }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("[send-verification] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
});

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface EmailParams {
  isKYB: boolean;
  logoUrl: string;
  contactName: string;
  entityName: string;
  dealName: string;
  verifyUrl: string;
  requesterName: string;
  requesterEmail: string;
  requestingFirmName: string;
  expiresAt: string;
}

function buildEmailHtml(p: EmailParams): string {
  const ctaLabel = p.isKYB ? "Complete Business Verification" : "Complete Identity Verification";

  const introText = p.isKYB
    ? `<strong>${p.requesterName}</strong> from <strong>${p.requestingFirmName}</strong> has requested Know Your Business (KYB) verification for the following entity as part of a transaction workflow managed through PIVT.`
    : `<strong>${p.requesterName}</strong> from <strong>${p.requestingFirmName}</strong> has requested Know Your Customer (KYC) identity verification as part of a transaction workflow managed through PIVT.`;

  const detailsBlock = p.isKYB
    ? `<table role="presentation" style="width:100%;margin:20px 0;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:110px;">Entity</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${p.entityName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Deal</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${p.dealName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Requested by</td><td style="padding:6px 0;color:#111827;font-size:14px;">${p.requesterName} (${p.requesterEmail})</td></tr>
       </table>`
    : "";

  const requirementsList = p.isKYB
    ? `<ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
        <li>Legal business details</li>
        <li>Registration number (EIN / Company Number / ACN etc.)</li>
        <li>Registered business address</li>
        <li>Certificate of incorporation or business registry extract</li>
       </ul>`
    : `<ul style="margin:0;padding:0 0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
        <li>Your legal name and contact details</li>
        <li>Date of birth</li>
        <li>Residential address</li>
        <li>A government-issued ID (passport or driver's licence)</li>
       </ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PIVT Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="padding:32px 40px 24px;">
              <img src="${p.logoUrl}" alt="PIVT" height="36" style="display:block;height:36px;width:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background-color:#e5e7eb;"></div></td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111827;">Hi ${p.contactName},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${introText}</p>
              ${detailsBlock}
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">To proceed, please complete verification using the secure link below.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${p.verifyUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#6B46FF;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;line-height:1;text-align:center;">
                      <span>${ctaLabel}</span>
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#111827;">What you will need</p>
              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">To complete verification you may be asked to provide:</p>
              ${requirementsList}
              <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">This process typically takes 2–3 minutes.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background-color:#e5e7eb;"></div></td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;">Security Notice</p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#9ca3af;">
                For security reasons:<br/>
                • This link is unique to you<br/>
                • It will expire on ${p.expiresAt}<br/>
                • Please do not forward this email
              </p>
              <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">
                If you have questions you may reply directly to <a href="mailto:${p.requesterEmail}" style="color:#6B46FF;text-decoration:none;">${p.requesterEmail}</a>.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding:24px 40px 0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Powered by <strong style="color:#6b7280;">PIVT</strong><br/>
                The Intelligence Layer Behind Every Close
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
