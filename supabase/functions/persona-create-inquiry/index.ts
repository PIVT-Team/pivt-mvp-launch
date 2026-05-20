// persona-create-inquiry
//
// Server-side Persona inquiry creation. Client never holds the Persona API
// key, never picks the template_id — both come from server env / per-org
// config. The client only knows: "verify stakeholder X for kind Y on deal Z".
//
// Returns an inquiry session token that the client passes to the Persona
// embedded SDK to open the verification modal.
//
// Why server-side only:
//   • Client-side inquiry creation requires the public template_id to be
//     exposed, and Persona's docs explicitly say to pin reference-id server-
//     side so the client can't impersonate other stakeholders.
//   • Lets us record `persona_inquiries.initiated_by` for audit.
//   • Reuse logic lives here: if the stakeholder already has a verified
//     Persona Account (account_id stored on cap_table_entries), we
//     associate the new inquiry to that Account rather than creating a
//     fresh identity.

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

async function resolveTemplateId(
  admin: ReturnType<typeof createClient>,
  orgId: string | null,
  kind: "kyc" | "kyb" | "watchlist",
): Promise<string | null> {
  // Per-org override wins
  if (orgId) {
    const { data: override } = await admin
      .from("organization_persona_templates")
      .select("persona_template_id, is_active")
      .eq("org_id", orgId)
      .eq("kind", kind)
      .maybeSingle();
    if (override?.is_active && override.persona_template_id) {
      return override.persona_template_id as string;
    }
  }
  // Otherwise fall back to env default
  const envKey =
    kind === "kyc" ? "PERSONA_DEFAULT_KYC_TEMPLATE"
    : kind === "kyb" ? "PERSONA_DEFAULT_KYB_TEMPLATE"
    : "PERSONA_DEFAULT_WATCHLIST_TEMPLATE";
  return Deno.env.get(envKey) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const personaKey = Deno.env.get("PERSONA_API_KEY");
    if (!personaKey) {
      return json({
        success: false,
        error: "Persona is not configured. Set PERSONA_API_KEY in Supabase secrets.",
        code: "PERSONA_NOT_CONFIGURED",
      }, 503);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const stakeholderId: string | undefined = body.stakeholder_id;
    const dealId: string | undefined = body.deal_id;
    const kind: "kyc" | "kyb" | "watchlist" = body.kind ?? "kyc";

    if (!stakeholderId || !dealId) {
      return json({ success: false, error: "stakeholder_id and deal_id are required" }, 400);
    }
    if (!["kyc", "kyb", "watchlist"].includes(kind)) {
      return json({ success: false, error: "kind must be kyc | kyb | watchlist" }, 400);
    }

    // Load stakeholder so we can pre-fill Persona fields + look up account reuse
    const { data: stakeholder, error: shErr } = await admin
      .from("cap_table_entries")
      .select("id, deal_id, shareholder_name, email, stakeholder_type, persona_account_id")
      .eq("id", stakeholderId)
      .maybeSingle();
    if (shErr || !stakeholder) {
      return json({ success: false, error: "Stakeholder not found" }, 404);
    }
    if (stakeholder.deal_id !== dealId) {
      return json({ success: false, error: "Stakeholder does not belong to this deal" }, 400);
    }

    // Resolve the org_id for the deal (used for per-org template override)
    const { data: deal } = await admin
      .from("deals")
      .select("id, org_id")
      .eq("id", dealId)
      .maybeSingle();
    const orgId = (deal?.org_id as string) ?? null;

    const templateId = await resolveTemplateId(admin, orgId, kind);
    if (!templateId) {
      return json({
        success: false,
        error: `No Persona template configured for kind=${kind}. Set PERSONA_DEFAULT_${kind.toUpperCase()}_TEMPLATE or configure a per-org override.`,
        code: "TEMPLATE_NOT_CONFIGURED",
      }, 503);
    }

    // reference_id stays stable across deals so Persona dedupes the
    // Account. Stakeholder.id is the canonical handle.
    const referenceId = stakeholder.id;

    // Split name for Persona's pre-fill fields. Persona is graceful about
    // missing parts so we just send what we have.
    const fullName: string = stakeholder.shareholder_name || "";
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ");

    const personaPayload: Record<string, unknown> = {
      data: {
        attributes: {
          "inquiry-template-id": templateId,
          "reference-id": referenceId,
          fields: {
            "name-first": firstName || undefined,
            "name-last": lastName || undefined,
            "email-address": stakeholder.email || undefined,
          },
        },
      },
    };

    // If we already have an Account from a prior deal, associate to it so
    // Persona reuses the underlying identity.
    if (stakeholder.persona_account_id) {
      // deno-lint-ignore no-explicit-any
      (personaPayload.data as any).relationships = {
        account: { data: { type: "account", id: stakeholder.persona_account_id } },
      };
    }

    const personaResp = await fetch(`${PERSONA_API_BASE}/inquiries`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${personaKey}`,
        "Content-Type": "application/json",
        "Persona-Version": "2023-01-05",
      },
      body: JSON.stringify(personaPayload),
    });

    const personaBody = await personaResp.json().catch(() => ({}));
    if (!personaResp.ok) {
      console.error("Persona inquiry creation failed:", personaResp.status, personaBody);
      return json({
        success: false,
        error: personaBody?.errors?.[0]?.title || `Persona API returned ${personaResp.status}`,
        code: "PERSONA_API_ERROR",
        detail: personaBody?.errors ?? null,
      }, 502);
    }

    const inquiryId: string = personaBody?.data?.id;
    const inquiryStatus: string = personaBody?.data?.attributes?.status ?? "created";
    const sessionToken: string | null = personaBody?.meta?.["session-token"] ?? null;

    // Mirror the inquiry locally so we have a stable handle even before
    // webhooks land.
    const { data: inserted, error: insertErr } = await admin
      .from("persona_inquiries")
      .insert({
        deal_id: dealId,
        stakeholder_id: stakeholderId,
        org_id: orgId,
        kind,
        persona_inquiry_id: inquiryId,
        persona_account_id: stakeholder.persona_account_id ?? null,
        persona_template_id: templateId,
        reference_id: referenceId,
        status: inquiryStatus,
        initiated_by: userId,
        raw_payload: personaBody,
      })
      .select()
      .single();

    if (insertErr) {
      console.warn("persona_inquiries insert failed (continuing):", insertErr.message);
    }

    // Mark cap_table_entries as in-progress so the UI flips immediately
    // (webhook will overwrite with terminal state).
    await admin
      .from("cap_table_entries")
      .update({
        verification_status: "in_progress",
        verification_requested_at: new Date().toISOString(),
        verification_last_sent_at: new Date().toISOString(),
      })
      .eq("id", stakeholderId);

    // Audit
    await admin.from("audit_log").insert({
      action: "persona_inquiry_created",
      user_id: userId,
      details: {
        inquiry_id: inquiryId,
        deal_id: dealId,
        stakeholder_id: stakeholderId,
        kind,
        template_id: templateId,
      },
    });

    return json({
      success: true,
      inquiry_id: inquiryId,
      session_token: sessionToken,
      template_id: templateId,
      reference_id: referenceId,
      local_id: inserted?.id ?? null,
      reused_account: !!stakeholder.persona_account_id,
    });
  } catch (err) {
    if (err instanceof Response) return err; // requireJwt returns Response on auth fail
    console.error("persona-create-inquiry unexpected error:", err);
    return json({ success: false, error: (err as Error).message ?? "Unknown error" }, 500);
  }
});
