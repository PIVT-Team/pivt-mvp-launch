import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { stakeholder_id, deal_id } = await req.json();
    if (!stakeholder_id || !deal_id) {
      return new Response(
        JSON.stringify({ error: "stakeholder_id and deal_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for DB ops
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get stakeholder details
    const { data: stakeholder, error: sErr } = await adminClient
      .from("cap_table_entries")
      .select("*")
      .eq("id", stakeholder_id)
      .eq("deal_id", deal_id)
      .maybeSingle();

    if (sErr || !stakeholder) {
      return new Response(
        JSON.stringify({ error: "Stakeholder not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stakeholder.email) {
      return new Response(
        JSON.stringify({ error: "Stakeholder has no email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get deal name
    const { data: deal } = await adminClient
      .from("deals")
      .select("deal_name, deal_number")
      .eq("id", deal_id)
      .maybeSingle();

    // Generate token
    const rawToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);

    // Check for existing pending request and revoke
    await adminClient
      .from("verification_requests")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("stakeholder_id", stakeholder_id)
      .in("status", ["pending", "sent"]);

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
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create verification request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build verification URL
    const projectUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "");
    const siteUrl = `https://id-preview--7a07f5f2-4b1d-47b9-b6b9-ed69164d12f6.lovable.app`;
    const verifyUrl = `${siteUrl}/verify?token=${rawToken}`;

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dealName = deal?.deal_name || "a transaction";
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PIVT Verification <onboarding@resend.dev>",
        to: [stakeholder.email],
        subject: `Action Required: Complete verification for ${dealName}`,
        html: buildEmailHtml(stakeholder.shareholder_name, dealName, verifyUrl),
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email", details: emailData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to sent
    await adminClient
      .from("verification_requests")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", verReq.id);

    // Update stakeholder verification_status
    await adminClient
      .from("cap_table_entries")
      .update({ verification_status: "sent" })
      .eq("id", stakeholder_id);

    return new Response(
      JSON.stringify({ success: true, request_id: verReq.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

function buildEmailHtml(name: string, dealName: string, verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <div style="background:#0F1220;border-radius:12px;padding:40px 32px;color:#ffffff;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:20px;font-weight:700;margin:0;color:#ffffff;">PIVT</h1>
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:4px 0 0;">Verification Required</p>
      </div>
      <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.85);">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
        You've been added as a stakeholder on <strong style="color:#ffffff;">${dealName}</strong>.
        To proceed, please complete your identity verification.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:#6C5CE7;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Complete Verification
        </a>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">
        This link expires in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#999;margin-top:16px;">
      Sent by PIVT · Secure transaction infrastructure
    </p>
  </div>
</body>
</html>`;
}
