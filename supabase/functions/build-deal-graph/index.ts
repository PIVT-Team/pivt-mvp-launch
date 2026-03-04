import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NodeDef {
  node_type: string;
  label: string;
  status: string;
  metadata: Record<string, unknown>;
  source_entity_id: string | null;
}

interface EdgeDef {
  from_source: string | null; // source_entity_id of from node
  to_source: string | null;
  edge_type: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { deal_id } = await req.json();
    if (!deal_id) throw new Error("deal_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch deal
    const { data: deal } = await supabase.from("deals").select("*").eq("id", deal_id).single();
    if (!deal) throw new Error("Deal not found");

    const nodes: NodeDef[] = [];
    const edgeDefs: EdgeDef[] = [];

    // 1. Deal node
    nodes.push({
      node_type: "deal",
      label: deal.deal_name,
      status: "in_progress",
      metadata: { deal_value: deal.deal_value, buyer: deal.buyer, seller: deal.seller, target: deal.target_company },
      source_entity_id: deal.id,
    });

    // 2. Stakeholders (cap_table_entries)
    const { data: stakeholders } = await supabase.from("cap_table_entries").select("*").eq("deal_id", deal_id);
    for (const s of stakeholders || []) {
      nodes.push({
        node_type: "stakeholder",
        label: s.shareholder_name,
        status: "complete",
        metadata: { ownership_pct: s.ownership_pct, payout: s.payout_amount },
        source_entity_id: s.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: s.id, edge_type: "HAS_PARTY" });
    }

    // 3. Documents (contract_documents)
    const { data: docs } = await supabase.from("contract_documents").select("*").eq("deal_id", deal_id);
    for (const d of docs || []) {
      const docStatus = d.status === "VERIFIED" ? "complete" : d.status === "UPLOADED" ? "in_progress" : "not_started";
      nodes.push({
        node_type: "document",
        label: d.filename,
        status: docStatus,
        metadata: { doc_type: d.doc_type, status: d.status },
        source_entity_id: d.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: d.id, edge_type: "HAS_DOCUMENT" });
    }

    // 4. Obligations
    const { data: obligations } = await supabase.from("obligations").select("*").eq("deal_id", deal_id);
    for (const ob of obligations || []) {
      const obStatus = ob.status === "CONFIRMED" ? "complete" : ob.status === "NEEDS_REVIEW" ? "in_progress" : "not_started";
      nodes.push({
        node_type: "obligation",
        label: ob.payee_label || ob.obligation_type || "Obligation",
        status: obStatus,
        metadata: { amount: ob.amount_value_minor, type: ob.obligation_type, status: ob.status },
        source_entity_id: ob.id,
      });
      // Link doc → obligation
      if (ob.source_document_id) {
        edgeDefs.push({ from_source: ob.source_document_id, to_source: ob.id, edge_type: "DERIVED_FROM" });
      }
    }

    // 5. Compliance checks
    const { data: checks } = await supabase.from("compliance_checks").select("*").eq("deal_id", deal_id);
    for (const c of checks || []) {
      const cStatus = c.status === "passed" ? "complete" : c.status === "failed" ? "failed" : "in_progress";
      nodes.push({
        node_type: "compliance_check",
        label: `${c.check_type}`,
        status: cStatus,
        metadata: { check_type: c.check_type, status: c.status, party_id: c.party_id },
        source_entity_id: c.id,
      });
    }

    // 6. Approvals
    const { data: approvals } = await supabase.from("deal_approvals").select("*").eq("deal_id", deal_id);
    for (const a of approvals || []) {
      const aStatus = a.status === "approved" ? "complete" : a.status === "rejected" ? "failed" : "not_started";
      nodes.push({
        node_type: "approval",
        label: `${a.approval_side} Approval`,
        status: aStatus,
        metadata: { side: a.approval_side, status: a.status },
        source_entity_id: a.id,
      });
    }

    // 7. Disbursement intents
    const { data: intents } = await supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id);
    for (const di of intents || []) {
      const pStatus = di.status === "settled" ? "complete" : di.status === "failed" ? "failed"
        : di.status === "draft" ? "not_started" : "in_progress";
      nodes.push({
        node_type: "payment_intent",
        label: `Payment $${(di.amount_original / 1e6).toFixed(1)}M`,
        status: pStatus,
        metadata: { amount: di.amount_original, status: di.status, rail: di.rail },
        source_entity_id: di.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: di.id, edge_type: "REQUIRES" });
      // Payment → recipient stakeholder
      edgeDefs.push({ from_source: di.id, to_source: di.recipient_id, edge_type: "PAYS" });
    }

    // 8. Discrepancies
    const { data: discreps } = await supabase.from("discrepancies").select("*").eq("deal_id", deal_id).neq("status", "resolved");
    for (const disc of discreps || []) {
      nodes.push({
        node_type: "discrepancy",
        label: disc.message?.slice(0, 60) || disc.rule_key,
        status: disc.severity === "blocker" ? "blocked" : "in_progress",
        metadata: { severity: disc.severity, rule_key: disc.rule_key, status: disc.status },
        source_entity_id: disc.id,
      });
      // BLOCKS edge: discrepancy blocks the object it references
      if (disc.object_id) {
        edgeDefs.push({ from_source: disc.id, to_source: disc.object_id, edge_type: "BLOCKS" });
      }
    }

    // 9. Waterfall tiers
    const { data: tiers } = await supabase.from("waterfall_tiers").select("*").eq("deal_id", deal_id);
    for (const t of tiers || []) {
      nodes.push({
        node_type: "waterfall",
        label: t.name,
        status: "complete",
        metadata: { tier_rank: t.tier_rank },
        source_entity_id: t.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: t.id, edge_type: "REQUIRES" });
    }

    // ── Upsert: delete old graph, insert new ──
    await supabase.from("graph_edges").delete().eq("deal_id", deal_id);
    await supabase.from("graph_nodes").delete().eq("deal_id", deal_id);

    // Insert nodes
    const nodeRows = nodes.map((n) => ({
      deal_id,
      node_type: n.node_type,
      label: n.label,
      status: n.status,
      metadata: n.metadata,
      source_entity_id: n.source_entity_id,
    }));
    const { data: insertedNodes, error: nodeErr } = await supabase
      .from("graph_nodes")
      .insert(nodeRows)
      .select("id, source_entity_id");
    if (nodeErr) throw nodeErr;

    // Build source_entity_id → node id map
    const sourceToNodeId = new Map<string, string>();
    for (const n of insertedNodes || []) {
      if (n.source_entity_id) sourceToNodeId.set(n.source_entity_id, n.id);
    }

    // Insert edges
    const edgeRows: Array<Record<string, unknown>> = [];
    for (const e of edgeDefs) {
      const fromId = e.from_source ? sourceToNodeId.get(e.from_source) : null;
      const toId = e.to_source ? sourceToNodeId.get(e.to_source) : null;
      if (fromId && toId) {
        edgeRows.push({
          deal_id,
          from_node_id: fromId,
          to_node_id: toId,
          edge_type: e.edge_type,
          metadata: e.metadata || {},
        });
      }
    }
    if (edgeRows.length > 0) {
      const { error: edgeErr } = await supabase.from("graph_edges").insert(edgeRows);
      if (edgeErr) throw edgeErr;
    }

    // ── Evaluate deal state ──
    const nodesByType = (type: string) => (insertedNodes || []).filter((_n, i) => nodes[i]?.node_type === type);
    const allChecks = checks || [];
    const allApprovals = approvals || [];
    const allDocs = docs || [];
    const allIntents = intents || [];
    const activeDiscreps = discreps || [];

    const blockers: string[] = [];
    const nextActions: string[] = [];

    // Required docs check
    const requiredDocs = allDocs.filter((d) => d.is_required);
    const missingDocs = requiredDocs.filter((d) => d.status !== "VERIFIED" && d.status !== "EXTRACTED");
    if (missingDocs.length > 0) {
      blockers.push(`${missingDocs.length} required document(s) not verified`);
      missingDocs.slice(0, 3).forEach((d) => nextActions.push(`Upload/verify: ${d.filename}`));
    }

    // Compliance
    const failedChecks = allChecks.filter((c) => c.status !== "passed");
    if (failedChecks.length > 0) {
      blockers.push(`${failedChecks.length} compliance check(s) not passed`);
      failedChecks.slice(0, 3).forEach((c) => nextActions.push(`Complete ${c.check_type}`));
    }

    // Approvals
    const pendingApprovals = allApprovals.filter((a) => a.status !== "approved");
    if (pendingApprovals.length > 0) {
      blockers.push(`${pendingApprovals.length} approval(s) pending`);
      pendingApprovals.slice(0, 3).forEach((a) => nextActions.push(`Get ${a.approval_side} approval`));
    }

    // Blocker discrepancies
    const blockerDiscreps = activeDiscreps.filter((d) => d.severity === "blocker");
    if (blockerDiscreps.length > 0) {
      blockers.push(`${blockerDiscreps.length} blocker discrepancy(ies)`);
      blockerDiscreps.slice(0, 3).forEach((d) => nextActions.push(`Resolve: ${d.message?.slice(0, 50)}`));
    }

    // Derive state
    let dealState = "Draft";
    if (allDocs.length === 0 && allChecks.length === 0) dealState = "Draft";
    else if (missingDocs.length > 0) dealState = "Docs_In_Progress";
    else if (failedChecks.length > 0) dealState = "Compliance_In_Progress";
    else if (pendingApprovals.length > 0) dealState = "Ready_For_Approval";
    else if (blockerDiscreps.length > 0) dealState = "Blocked";
    else if (allIntents.length > 0 && allIntents.every((i) => i.status === "settled")) dealState = "Settled";
    else if (allIntents.length > 0 && allIntents.some((i) => ["approved", "execution_pending"].includes(i.status))) dealState = "Executing";
    else dealState = "Ready_To_Execute";

    return new Response(
      JSON.stringify({
        success: true,
        deal_state: dealState,
        node_count: insertedNodes?.length || 0,
        edge_count: edgeRows.length,
        blockers,
        next_actions: nextActions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
