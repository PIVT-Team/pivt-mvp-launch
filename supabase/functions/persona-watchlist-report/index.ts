// persona-watchlist-report
//
// Kicks off a Watchlist Report against a verified Persona Account. Called
// either:
//   • Automatically by persona-webhook when an inquiry transitions to
//     approved/completed (set up via a Workflow in Persona) — preferred.
//   • Manually from the KYC tab "Run watchlist" button as a fallback or
//     refresh check.
//
// Reports are async — Persona returns the report_id immediately, then
// posts a `report.completed` webhook when results are in. We store the
// report_id on persona_inquiries.watchlist_report_id so the UI can show
// "Watchlist running…" → "✓ Clear" or "⚠ Hits found".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERSONA_API_BASE = "https://api.withpersona.com/api/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const personaKey = Deno.env.get("PERSONA_API_KEY");
    if (!personaKey) {
      return json({ success: false, error: "PERSONA_API_KEY not set" }, 503);
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const inquiryLocalId: string | undefined = body.inquiry_id; // our local persona_inquiries.id
    if (!inquiryLocalId) {
      return json({ success: false, error: "inquiry_id required" }, 400);
    }

    const { data: inquiry } = await admin
      .from("persona_inquiries")
      .select("id, deal_id, stakeholder_id, persona_account_id, persona_inquiry_id, org_id")
      .eq("id", inquiryLocalId)
      .maybeSingle();
    if (!inquiry) {
      return json({ success: false, error: "Inquiry not found" }, 404);
    }
    if (!inquiry.persona_account_id) {
      return json({
        success: false,
        error: "Cannot run watchlist — inquiry has no linked Persona Account yet. Wait for the inquiry to complete.",
      }, 400);
    }

    // Resolve watchlist template (per-org override > env default)
    let watchlistTemplate: string | null = null;
    if (inquiry.org_id) {
      const { data: override } = await admin
        .from("organization_persona_templates")
        .select("persona_template_id, is_active")
        .eq("org_id", inquiry.org_id)
        .eq("kind", "watchlist")
        .maybeSingle();
      if (override?.is_active) watchlistTemplate = override.persona_template_id as string;
    }
    if (!watchlistTemplate) {
      watchlistTemplate = Deno.env.get("PERSONA_DEFAULT_WATCHLIST_TEMPLATE") || null;
    }
    if (!watchlistTemplate) {
      return json({
        success: false,
        error: "No watchlist template configured. Set PERSONA_DEFAULT_WATCHLIST_TEMPLATE.",
        code: "TEMPLATE_NOT_CONFIGURED",
      }, 503);
    }

    const personaResp = await fetch(`${PERSONA_API_BASE}/reports`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${personaKey}`,
        "Content-Type": "application/json",
        "Persona-Version": "2023-01-05",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            "report-template-id": watchlistTemplate,
          },
          relationships: {
            account: { data: { type: "account", id: inquiry.persona_account_id } },
          },
        },
      }),
    });

    const personaBody = await personaResp.json().catch(() => ({}));
    if (!personaResp.ok) {
      console.error("Persona report creation failed:", personaResp.status, personaBody);
      return json({
        success: false,
        error: personaBody?.errors?.[0]?.title || `Persona API ${personaResp.status}`,
      }, 502);
    }

    const reportId = personaBody?.data?.id;
    await admin
      .from("persona_inquiries")
      .update({ watchlist_report_id: reportId, last_event_at: new Date().toISOString() })
      .eq("id", inquiry.id);

    await admin.from("audit_log").insert({
      action: "persona_watchlist_started",
      user_id: userId,
      details: {
        report_id: reportId,
        inquiry_id: inquiry.persona_inquiry_id,
        account_id: inquiry.persona_account_id,
        stakeholder_id: inquiry.stakeholder_id,
      },
    });

    return json({ success: true, report_id: reportId });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("persona-watchlist-report unexpected error:", err);
    return json({ success: false, error: (err as Error).message ?? "Unknown error" }, 500);
  }
});
