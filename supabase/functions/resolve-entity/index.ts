import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const { variant_entity_id, canonical_entity_id, confirmed } = await req.json();

    if (!variant_entity_id || !canonical_entity_id || typeof confirmed !== "boolean") {
      return new Response(JSON.stringify({ error: "variant_entity_id, canonical_entity_id, and confirmed are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: variantEntity, error: variantError } = await supabase
      .from("entities")
      .select("id, source_deal_id, metadata")
      .eq("id", variant_entity_id)
      .single();
    if (variantError) throw variantError;
    if (!variantEntity) throw new Error("Variant entity not found");

    const { data: resolution, error: resolutionLookupError } = await supabase
      .from("entity_resolution")
      .select("id, variant_entity_id, canonical_entity_id, resolution_method")
      .eq("variant_entity_id", variant_entity_id)
      .eq("canonical_entity_id", canonical_entity_id)
      .maybeSingle();
    if (resolutionLookupError) throw resolutionLookupError;

    if (!resolution) {
      return new Response(JSON.stringify({ error: "Resolution record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (confirmed) {
      const { error: updateResolutionError } = await supabase
        .from("entity_resolution")
        .update({
          resolution_method: "human_confirmed",
          resolved_by: userId,
        })
        .eq("id", resolution.id);
      if (updateResolutionError) throw updateResolutionError;

      const { error: updateEntityError } = await supabase
        .from("entities")
        .update({
          metadata: {
            ...((variantEntity.metadata && typeof variantEntity.metadata === "object") ? variantEntity.metadata : {}),
            manual_review_required: false,
            resolution_status: "human_confirmed",
          },
        })
        .eq("id", variant_entity_id);
      if (updateEntityError) throw updateEntityError;
    } else {
      const { error: deleteResolutionError } = await supabase
        .from("entity_resolution")
        .delete()
        .eq("id", resolution.id);
      if (deleteResolutionError) throw deleteResolutionError;

      const { error: updateEntityError } = await supabase
        .from("entities")
        .update({
          canonical_id: null,
          metadata: {
            ...((variantEntity.metadata && typeof variantEntity.metadata === "object") ? variantEntity.metadata : {}),
            manual_review_required: true,
            resolution_status: "rejected",
          },
        })
        .eq("id", variant_entity_id);
      if (updateEntityError) throw updateEntityError;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      deal_id: variantEntity.source_deal_id,
      user_id: userId,
      action: confirmed ? "entity_resolution_confirmed" : "entity_resolution_rejected",
      details: {
        variant_entity_id,
        canonical_entity_id,
        confirmed,
      },
    });
    if (auditError) throw auditError;

    return new Response(JSON.stringify({
      success: true,
      variant_entity_id,
      canonical_entity_id,
      confirmed,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
});
