import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Newton Execute — Executes approved proposed actions.
 *
 * Core rule: All Newton-created records are written to the same core PIVT tables
 * used by manual workflows. Records include source metadata (created_by_source='newton',
 * needs_review=true) and remain editable unless locked by a later approval-gated step.
 */

// Source metadata defaults for Newton-created records
const NEWTON_SOURCE_META = {
  created_by_source: "newton",
  last_updated_by_source: "newton",
  needs_review: true,
  confidence_status: "needs_review",
  locked: false,
  locked_reason: null,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const { action_id } = await req.json();
    if (!action_id) {
      return jsonResponse({ success: false, error: "action_id required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Get the proposed action
    const { data: action, error: fetchErr } = await admin
      .from("newton_proposed_actions")
      .select("*, newton_extractions(*)")
      .eq("id", action_id)
      .single();

    if (fetchErr || !action) {
      return jsonResponse({ success: false, error: "Action not found" }, 404);
    }

    if (action.status !== "approved") {
      return jsonResponse({ success: false, error: `Action status is '${action.status}', must be 'approved'` }, 400);
    }

    // Mark as executing
    await admin.from("newton_proposed_actions").update({
      status: "executing",
      updated_at: new Date().toISOString(),
    }).eq("id", action_id);

    let result: any = {};

    try {
      switch (action.action_type) {
        case "import_stakeholder_data":
          result = await executeImportStakeholders(admin, action);
          break;
        case "update_existing_stakeholders":
          result = await executeUpdateStakeholders(admin, action);
          break;
        case "prepare_kyc_kyb_requests":
          result = await executePrepareKyc(admin, action);
          break;
        case "import_payout_rows":
          result = await executeImportPayoutRows(admin, action);
          break;
        case "parse_wire_instructions":
          result = await executeParseWireInstructions(admin, action);
          break;
        case "run_funds_flow_validation":
          result = await executeRunValidation(admin, action);
          break;
        case "verify_wire_matches":
          result = await executeVerifyWireMatches(admin, action);
          break;
        case "flag_missing_fields":
          result = { flagged: true, message: "Missing fields noted" };
          break;
        default:
          result = { error: `Unknown action type: ${action.action_type}` };
      }

      // Mark completed
      await admin.from("newton_proposed_actions").update({
        status: "completed",
        execution_result: result,
        updated_at: new Date().toISOString(),
      }).eq("id", action_id);

      // Audit log
      await admin.from("audit_log").insert({
        deal_id: action.deal_id,
        user_id: userId,
        action: "newton_action_executed",
        details: {
          action_id,
          action_type: action.action_type,
          action_label: action.action_label,
          result_summary: result.summary || result,
          source: "newton",
        },
      });

      return jsonResponse({ success: true, action_type: action.action_type, result });
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : "Execution failed";
      await admin.from("newton_proposed_actions").update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      }).eq("id", action_id);

      await admin.from("audit_log").insert({
        deal_id: action.deal_id,
        user_id: userId,
        action: "newton_action_failed",
        details: { action_id, action_type: action.action_type, error: msg },
      });

      return jsonResponse({ success: false, error: msg }, 500);
    }
  } catch (e) {
    console.error("newton-execute error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════
// Action Executors — All write to core PIVT tables with source metadata
// ═══════════════════════════════════════════════════════════════

async function executeImportStakeholders(admin: any, action: any) {
  const extraction = action.newton_extractions;
  const data = extraction?.extracted_data || [];
  if (!Array.isArray(data) || data.length === 0) return { created: 0 };

  const { data: existing } = await admin.from("cap_table_entries").select("shareholder_name").eq("deal_id", action.deal_id);
  const existingNames = new Set((existing || []).map((e: any) => e.shareholder_name?.toLowerCase()));

  const confidence = extraction?.confidence_score ?? 0;
  const confidenceStatus = confidence >= 0.9 ? "high" : confidence >= 0.7 ? "medium" : "low";

  const newRows = data
    .filter((r: any) => r.name && !existingNames.has(r.name.toLowerCase()))
    .map((r: any) => ({
      deal_id: action.deal_id,
      shareholder_name: r.name,
      email: r.email || null,
      role: r.role || "Shareholder",
      stakeholder_type: r.entity_type || "individual",
      ownership_pct: Number(r.ownership_pct) || 0,
      payout_amount: 0,
      verification_status: "not_sent",
      ...NEWTON_SOURCE_META,
      confidence_status: confidenceStatus,
    }));

  if (newRows.length === 0) return { created: 0, message: "All stakeholders already exist" };

  const { data: inserted, error } = await admin.from("cap_table_entries").insert(newRows).select("id");
  if (error) throw new Error(`Failed to import stakeholders: ${error.message}`);

  return { created: inserted?.length || 0, summary: `${inserted?.length || 0} stakeholders imported via Newton (needs review)` };
}

async function executeUpdateStakeholders(admin: any, action: any) {
  const extraction = action.newton_extractions;
  const data = extraction?.extracted_data || [];
  let updated = 0;

  for (const row of data) {
    if (!row.name) continue;
    const { data: existing } = await admin.from("cap_table_entries")
      .select("id, locked").eq("deal_id", action.deal_id)
      .ilike("shareholder_name", row.name).maybeSingle();

    if (existing) {
      // Respect lock — skip locked records
      if (existing.locked) continue;

      const updates: any = {
        last_updated_by_source: "newton",
        needs_review: true,
      };
      if (row.email) updates.email = row.email;
      if (row.ownership_pct) updates.ownership_pct = Number(row.ownership_pct);
      if (row.role) updates.role = row.role;

      if (Object.keys(updates).length > 2) { // more than just the source tracking fields
        await admin.from("cap_table_entries").update(updates).eq("id", existing.id);
        updated++;
      }
    }
  }

  return { updated, summary: `${updated} stakeholders updated via Newton` };
}

async function executePrepareKyc(admin: any, action: any) {
  const extraction = action.newton_extractions;
  const data = extraction?.extracted_data || [];
  const withEmail = data.filter((r: any) => r.email);

  const { data: stakeholders } = await admin.from("cap_table_entries")
    .select("id, email, verification_status")
    .eq("deal_id", action.deal_id)
    .in("verification_status", ["not_sent", "not_requested"]);

  const eligibleIds = (stakeholders || [])
    .filter((s: any) => s.email && withEmail.some((r: any) => r.email?.toLowerCase() === s.email?.toLowerCase()))
    .map((s: any) => s.id);

  return {
    eligible_count: eligibleIds.length,
    stakeholder_ids: eligibleIds,
    summary: `${eligibleIds.length} stakeholders ready for KYC/KYB verification`,
  };
}

async function executeImportPayoutRows(admin: any, action: any) {
  const extraction = action.newton_extractions;
  const data = extraction?.extracted_data || [];
  if (!Array.isArray(data) || data.length === 0) return { created: 0 };

  const confidence = extraction?.confidence_score ?? 0;
  const confidenceStatus = confidence >= 0.9 ? "high" : confidence >= 0.7 ? "medium" : "low";

  const wireRows = data.map((r: any) => ({
    deal_id: action.deal_id,
    payee_entity: r.recipient || r.payee || "Unknown",
    amount: Number(r.amount) || 0,
    currency: r.currency || "USD",
    payment_type: r.payment_type || "Purchase Price",
    verification_status: "pending",
    source_document_id: null,
    ...NEWTON_SOURCE_META,
    confidence_status: confidenceStatus,
  }));

  const { data: inserted, error } = await admin.from("wire_instructions").insert(wireRows).select("id");
  if (error) throw new Error(`Failed to import payout rows: ${error.message}`);

  return { created: inserted?.length || 0, summary: `${inserted?.length || 0} payout rows imported via Newton (needs review)` };
}

async function executeParseWireInstructions(admin: any, action: any) {
  const extraction = action.newton_extractions;
  const data = extraction?.extracted_data || [];
  if (!Array.isArray(data) || data.length === 0) return { created: 0 };

  const confidence = extraction?.confidence_score ?? 0;
  const confidenceStatus = confidence >= 0.9 ? "high" : confidence >= 0.7 ? "medium" : "low";

  const wireRows = data.map((r: any) => ({
    deal_id: action.deal_id,
    payee_entity: r.payee || r.recipient || "Unknown",
    bank_name: r.bank_name || null,
    account_holder: r.account_holder || null,
    account_number_last4: r.account_last4 || null,
    routing_number: r.routing_number || null,
    swift_bic: r.swift_bic || null,
    iban: r.iban || null,
    amount: Number(r.amount) || 0,
    currency: r.currency || "USD",
    payment_type: "Purchase Price",
    verification_status: "pending",
    ...NEWTON_SOURCE_META,
    confidence_status: confidenceStatus,
  }));

  const { data: inserted, error } = await admin.from("wire_instructions").insert(wireRows).select("id");
  if (error) throw new Error(`Failed to import wire instructions: ${error.message}`);

  return { created: inserted?.length || 0, summary: `${inserted?.length || 0} wire instructions imported via Newton (needs review)` };
}

async function executeRunValidation(admin: any, action: any) {
  try {
    const { data, error } = await admin.functions.invoke("funds-flow-agent", {
      body: { deal_id: action.deal_id },
    });
    if (error) throw error;
    return {
      findings: data?.finding_count || 0,
      summary: `Validation complete — ${data?.finding_count || 0} findings`,
    };
  } catch (e) {
    return { findings: 0, summary: "Validation agent not available", error: (e as Error).message };
  }
}

async function executeVerifyWireMatches(admin: any, action: any) {
  const [wiresRes, stakeholdersRes] = await Promise.all([
    admin.from("wire_instructions").select("payee_entity, amount").eq("deal_id", action.deal_id),
    admin.from("cap_table_entries").select("shareholder_name, payout_amount").eq("deal_id", action.deal_id),
  ]);

  const wires = wiresRes.data || [];
  const stakeholders = stakeholdersRes.data || [];
  const stakeholderNames = new Set(stakeholders.map((s: any) => s.shareholder_name?.toLowerCase()));

  const matched = wires.filter((w: any) => stakeholderNames.has(w.payee_entity?.toLowerCase()));
  const unmatched = wires.filter((w: any) => !stakeholderNames.has(w.payee_entity?.toLowerCase()));

  return {
    total_wires: wires.length,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatched_payees: unmatched.map((w: any) => w.payee_entity),
    summary: `${matched.length}/${wires.length} wires matched to stakeholders. ${unmatched.length} unmatched.`,
  };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
