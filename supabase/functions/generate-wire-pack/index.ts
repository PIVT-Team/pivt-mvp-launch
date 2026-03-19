import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate Wire Pack — assembles a ready-to-execute wire pack for a deal.
 * Checks readiness gates, then compiles wire summary, source mapping,
 * discrepancy log, and approval record.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id, format } = await req.json();
    if (!deal_id) {
      return json({ success: false, error: "deal_id required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch all needed data in parallel
    const [dealRes, wiresRes, discRes, approvalsRes, docsRes, stakeholdersRes] =
      await Promise.all([
        admin.from("deals").select("*").eq("id", deal_id).single(),
        admin.from("wire_instructions").select("*").eq("deal_id", deal_id),
        admin.from("discrepancies").select("*").eq("deal_id", deal_id),
        admin.from("deal_approvals").select("*").eq("deal_id", deal_id),
        admin.from("contract_documents").select("id, filename, doc_type, status").eq("deal_id", deal_id),
        admin.from("cap_table_entries").select("shareholder_name, role, payout_amount, verification_status").eq("deal_id", deal_id),
      ]);

    if (dealRes.error || !dealRes.data) {
      return json({ success: false, error: "Deal not found" }, 404);
    }

    const deal = dealRes.data;
    const wires = wiresRes.data || [];
    const discrepancies = discRes.data || [];
    const approvals = approvalsRes.data || [];
    const docs = docsRes.data || [];
    const stakeholders = stakeholdersRes.data || [];

    // ── Readiness Check ──
    const openDiscrepancies = discrepancies.filter(
      (d: any) => d.status === "open" && d.severity === "critical"
    );
    const pendingApprovals = approvals.filter(
      (a: any) => a.required && a.status !== "completed"
    );
    const unverifiedWires = wires.filter(
      (w: any) => w.verification_status !== "verified" && w.verification_status !== "confirmed"
    );

    const readiness = {
      wires_uploaded: wires.length > 0,
      wires_verified: unverifiedWires.length === 0 && wires.length > 0,
      critical_discrepancies_resolved: openDiscrepancies.length === 0,
      approvals_complete: pendingApprovals.length === 0,
      pending_approval_count: pendingApprovals.length,
      unverified_wire_count: unverifiedWires.length,
      open_critical_count: openDiscrepancies.length,
    };

    const isReady =
      readiness.wires_uploaded &&
      readiness.wires_verified &&
      readiness.critical_discrepancies_resolved &&
      readiness.approvals_complete;

    // ── Wire Summary Table ──
    const wireSummary = wires.map((w: any) => ({
      id: w.id,
      beneficiary: w.payee_entity,
      bank_name: w.bank_name || "—",
      account_last4: w.account_number_last4 ? `****${w.account_number_last4}` : "—",
      routing_swift: w.routing_number || w.swift_bic || "—",
      amount: Number(w.amount),
      currency: w.currency || "USD",
      payment_type: w.payment_type,
      reference: w.iban || "—",
      verification_status: w.verification_status,
      source: w.created_by_source,
      confidence: w.confidence_status,
    }));

    // ── Source Mapping ──
    const sourceMapping = wires.map((w: any) => {
      const matchedStakeholder = stakeholders.find(
        (s: any) => s.shareholder_name?.toLowerCase() === w.payee_entity?.toLowerCase()
      );
      const sourceDoc = w.source_document_id
        ? docs.find((d: any) => d.id === w.source_document_id)
        : null;

      return {
        wire_id: w.id,
        payee: w.payee_entity,
        funds_flow_entry: sourceDoc
          ? { document: sourceDoc.filename, doc_type: sourceDoc.doc_type }
          : null,
        stakeholder_match: matchedStakeholder
          ? {
              name: matchedStakeholder.shareholder_name,
              role: matchedStakeholder.role,
              payout: matchedStakeholder.payout_amount,
            }
          : null,
      };
    });

    // ── Discrepancy Log ──
    const discrepancyLog = discrepancies.map((d: any) => ({
      id: d.id,
      rule: d.rule_key,
      severity: d.severity,
      message: d.message,
      status: d.status,
      resolved_at: d.resolved_at,
      acknowledged_by: d.acknowledged_by,
      details: d.details,
    }));

    // ── Approval Record ──
    const approvalRecord = approvals.map((a: any) => ({
      id: a.id,
      approver: a.approver_name || "Unknown",
      email: a.approver_email,
      role: a.approver_role,
      side: a.approval_side,
      status: a.status,
      method: a.delivery_method || "manual",
      completed_at: a.completed_at,
      required: a.required,
    }));

    const totalAmount = wires.reduce(
      (s: number, w: any) => s + Number(w.amount),
      0
    );

    const pack = {
      deal_id,
      deal_name: deal.deal_name,
      deal_number: deal.deal_number,
      deal_value: deal.deal_value,
      currency: deal.currency || "USD",
      generated_at: new Date().toISOString(),
      readiness,
      is_ready: isReady,
      status: isReady ? "ready" : pendingApprovals.length > 0 ? "pending_approvals" : "not_ready",
      summary: {
        total_wires: wires.length,
        total_amount: totalAmount,
        verified_count: wires.length - unverifiedWires.length,
        discrepancies_total: discrepancies.length,
        discrepancies_open: openDiscrepancies.length,
        approvals_total: approvals.length,
        approvals_complete: approvals.filter((a: any) => a.status === "completed").length,
      },
      wire_summary: wireSummary,
      source_mapping: sourceMapping,
      discrepancy_log: discrepancyLog,
      approval_record: approvalRecord,
    };

    // Audit log
    await admin.from("audit_log").insert({
      deal_id,
      action: "wire_pack_generated",
      details: {
        is_ready: isReady,
        status: pack.status,
        wire_count: wires.length,
        total_amount: totalAmount,
        format: format || "json",
      },
    });

    return json({ success: true, pack });
  } catch (e) {
    console.error("generate-wire-pack error:", e);
    return json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
