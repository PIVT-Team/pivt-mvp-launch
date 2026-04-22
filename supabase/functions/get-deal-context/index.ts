import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireJwt(req, corsHeaders);
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [deal, parties, members, conditions, approvals, documents, payments, obligations, contractDocs, discrepancies, intents, dealUserRoles, dealSettings] =
      await Promise.all([
        supabase.from("deals").select("*").eq("id", deal_id).single(),
        supabase.from("deal_parties").select("*, organizations(name)").eq("deal_id", deal_id),
        supabase.from("deal_members").select("*").eq("deal_id", deal_id),
        supabase.from("conditions").select("*").eq("deal_id", deal_id),
        supabase.from("ontology_approvals").select("*").eq("deal_id", deal_id),
        supabase.from("ontology_documents").select("*").eq("deal_id", deal_id),
        supabase.from("payment_instructions").select("*").eq("deal_id", deal_id),
        supabase.from("obligations").select("*").eq("deal_id", deal_id).neq("status", "REJECTED"),
        supabase.from("contract_documents").select("id, deal_id, doc_type, filename, status").eq("deal_id", deal_id),
        supabase.from("discrepancies").select("*").eq("deal_id", deal_id).in("status", ["open", "acknowledged"]),
        supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id),
        supabase.from("deal_user_roles").select("*").eq("deal_id", deal_id),
        supabase.from("deal_settings").select("*").eq("deal_id", deal_id).maybeSingle(),
      ]);

    if (deal.error) {
      return new Response(JSON.stringify({ error: deal.error.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute execution readiness
    const confirmedObligations = (obligations.data || []).filter((o: any) => o.status === "CONFIRMED");
    const allObligations = (obligations.data || []).filter((o: any) => o.status !== "REJECTED");
    const unmappedConfirmed = confirmedObligations.filter((o: any) => o.mapping_status === "UNMAPPED");
    const blockerDiscrepancies = (discrepancies.data || []).filter((d: any) => d.severity === "blocker");
    const unsatisfiedConditions = (conditions.data || []).filter((c: any) => c.status !== "SATISFIED" && c.status !== "WAIVED");
    const pendingApprovals = (approvals.data || []).filter((a: any) => a.status === "PENDING");

    const executionReady =
      allObligations.length > 0 &&
      confirmedObligations.length === allObligations.length &&
      unmappedConfirmed.length === 0 &&
      blockerDiscrepancies.length === 0 &&
      unsatisfiedConditions.length === 0 &&
      pendingApprovals.length === 0;

    const contextPack = {
      deal: {
        deal_number: deal.data.deal_number,
        name: deal.data.deal_name,
        value: deal.data.deal_value,
        status: deal.data.status,
        closing_date: deal.data.closing_date,
        escrow_amount: deal.data.escrow_amount,
      },
      parties: parties.data || [],
      members: members.data || [],
      conditions: conditions.data || [],
      approvals: approvals.data || [],
      documents: documents.data || [],
      payment_instructions: payments.data || [],
      obligations: {
        all: (obligations.data || []).map((o: any) => ({
          id: o.id,
          type: o.obligation_type,
          status: o.status,
          payor: o.payor_label,
          payee: o.payee_label,
          amount_type: o.amount_type,
          amount_value_minor: o.amount_value_minor,
          amount_currency: o.amount_currency,
          percent_basis_points: o.percent_basis_points,
          timing: o.timing_type,
          confidence: o.confidence_score,
          mapping_status: o.mapping_status,
          source_snippet: o.source_text_snippet,
          instructions_confirmed: o.instructions_confirmed,
        })),
        summary: {
          total: allObligations.length,
          confirmed: confirmedObligations.length,
          needs_review: allObligations.filter((o: any) => o.status === "NEEDS_REVIEW" || o.status === "DRAFT_EXTRACTED").length,
          unmapped_confirmed: unmappedConfirmed.length,
        },
      },
      contract_documents: contractDocs.data || [],
      discrepancies: {
        blockers: blockerDiscrepancies.length,
        warnings: (discrepancies.data || []).filter((d: any) => d.severity === "warn").length,
        details: (discrepancies.data || []).map((d: any) => ({
          rule_key: d.rule_key,
          severity: d.severity,
          message: d.message,
          object_type: d.object_type,
        })),
      },
      disbursement_intents: (intents.data || []).map((i: any) => ({
        id: i.id,
        amount: i.amount_original,
        currency: i.currency_original,
        status: i.status,
        recipient_id: i.recipient_id,
      })),
      execution_readiness: {
        ready: executionReady,
        checks: {
          all_obligations_confirmed: confirmedObligations.length === allObligations.length && allObligations.length > 0,
          all_confirmed_mapped: unmappedConfirmed.length === 0,
          no_blocking_discrepancies: blockerDiscrepancies.length === 0,
          conditions_satisfied: unsatisfiedConditions.length === 0,
          approvals_complete: pendingApprovals.length === 0,
        },
      },
      execution_authority: {
        executors: (dealUserRoles.data || []).filter((r: any) => r.role === 'EXECUTOR').map((r: any) => r.user_id),
        approvers: (dealUserRoles.data || []).filter((r: any) => r.role === 'APPROVER').map((r: any) => r.user_id),
        settings: {
          enforce_separation_of_duties: dealSettings.data?.enforce_separation_of_duties ?? true,
          require_dual_execution: dealSettings.data?.require_dual_execution ?? false,
        },
        all_roles: (dealUserRoles.data || []).map((r: any) => ({ user_id: r.user_id, role: r.role })),
      },
    };

    return new Response(JSON.stringify(contextPack), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
