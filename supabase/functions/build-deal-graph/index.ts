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
  from_source: string | null;
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

    // 2. Cap table entries — shareholders get OWNS edges, non-equity roles get PARTICIPATES_IN
    const { data: capEntries } = await supabase.from("cap_table_entries").select("*").eq("deal_id", deal_id);
    for (const s of stakeholders || []) {
      // Determine if shareholder (equity holder) vs stakeholder (participant)
      const equityRoles = ['Seller', 'Target', 'Shareholder', 'Founder', 'Employee', 'Advisor'];
      const isShareholder = equityRoles.includes(s.role) && (s.ownership_pct > 0);
      const nodeType = isShareholder ? "shareholder" : "stakeholder";

      nodes.push({
        node_type: nodeType,
        label: s.shareholder_name,
        status: s.verification_status === "verified" ? "complete" : "in_progress",
        metadata: {
          role: s.role,
          stakeholder_type: s.stakeholder_type,
          ownership_pct: isShareholder ? s.ownership_pct : 0,
          payout: s.payout_amount,
          verification_status: s.verification_status,
        },
        source_entity_id: s.id,
      });

      // Stakeholders PARTICIPATE, shareholders OWN
      if (isShareholder) {
        edgeDefs.push({ from_source: s.id, to_source: deal.id, edge_type: "OWNS" });
      } else {
        edgeDefs.push({ from_source: s.id, to_source: deal.id, edge_type: "PARTICIPATES_IN" });
      }
    }

    // 3. Documents — typed by category
    const { data: docs } = await supabase.from("contract_documents").select("*").eq("deal_id", deal_id);
    for (const d of docs || []) {
      // Map doc_type to node type for graph classification
      const capTableTypes = ["CAP_TABLE"];
      const waterfallTypes = ["WATERFALL_MODEL", "DISTRIBUTION_SCHEDULE"];
      const contractTypes = ["SPA", "MERGER_AGREEMENT", "FUNDS_FLOW", "ESCROW_AGREEMENT", "PAYOFF_LETTER", "FEE_LETTER"];
      const governanceTypes = ["BOARD_RESOLUTION", "SHAREHOLDER_APPROVAL", "WRITTEN_CONSENT", "OFFICER_CERTIFICATE"];
      const taxTypes = ["W9", "W8BEN", "W8BENE", "WITHHOLDING_CERT"];
      const wireTypes = ["WIRE_INSTRUCTION", "BANK_CONFIRMATION", "PAYMENT_DIRECTION"];

      let docNodeType = "document";
      if (capTableTypes.includes(d.doc_type)) docNodeType = "cap_table_file";
      else if (waterfallTypes.includes(d.doc_type)) docNodeType = "waterfall_file";
      else if (contractTypes.includes(d.doc_type)) docNodeType = "contract_document";
      else if (governanceTypes.includes(d.doc_type)) docNodeType = "governance_document";
      else if (taxTypes.includes(d.doc_type)) docNodeType = "tax_form";
      else if (wireTypes.includes(d.doc_type)) docNodeType = "wire_instruction_letter";

      const docStatus = d.status === "EXTRACTION_COMPLETE" || d.status === "VERIFIED" ? "complete"
        : d.status === "UPLOADED" ? "in_progress" : "not_started";

      nodes.push({
        node_type: docNodeType,
        label: d.filename,
        status: docStatus,
        metadata: { doc_type: d.doc_type, status: d.status, document_role: d.document_role },
        source_entity_id: d.id,
      });
      edgeDefs.push({ from_source: d.id, to_source: deal.id, edge_type: "SUBMITTED_DOCUMENT" });
    }

    // 4. Obligations — DERIVED_FROM_DOCUMENT
    const { data: obligations } = await supabase.from("obligations").select("*").eq("deal_id", deal_id);
    for (const ob of obligations || []) {
      const obStatus = ob.status === "CONFIRMED" ? "complete"
        : ob.status === "NEEDS_REVIEW" || ob.status === "DRAFT_EXTRACTED" ? "in_progress" : "not_started";
      nodes.push({
        node_type: "obligation",
        label: ob.payee_label || ob.obligation_type || "Obligation",
        status: obStatus,
        metadata: { amount: ob.amount_value_minor, type: ob.obligation_type, status: ob.status, payor: ob.payor_label, payee: ob.payee_label },
        source_entity_id: ob.id,
      });
      if (ob.source_document_id) {
        edgeDefs.push({ from_source: ob.id, to_source: ob.source_document_id, edge_type: "DERIVED_FROM_DOCUMENT" });
      }
      edgeDefs.push({ from_source: deal.id, to_source: ob.id, edge_type: "HAS_OBLIGATION" });
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
      edgeDefs.push({ from_source: c.id, to_source: deal.id, edge_type: "VERIFIED_AGAINST" });
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
      edgeDefs.push({ from_source: deal.id, to_source: a.id, edge_type: "REQUIRES_APPROVAL" });
    }

    // 7. Disbursement intents — PAYS_TO beneficiaries
    const { data: intents } = await supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id);
    for (const di of intents || []) {
      const pStatus = di.status === "settled" ? "complete" : di.status === "failed" ? "failed"
        : di.status === "draft" ? "not_started" : "in_progress";
      nodes.push({
        node_type: "payment_intent",
        label: `Payment $${(di.amount_original / 1e6).toFixed(1)}M`,
        status: pStatus,
        metadata: { amount: di.amount_original, status: di.status, rail: di.rail, currency: di.currency_original },
        source_entity_id: di.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: di.id, edge_type: "PAYS_TO" });
      // Payment → recipient (beneficiary)
      edgeDefs.push({ from_source: di.id, to_source: di.recipient_id, edge_type: "RECEIVES_PAYOUT" });
    }

    // 8. Discrepancies — BLOCKED_BY
    const { data: discreps } = await supabase.from("discrepancies").select("*").eq("deal_id", deal_id).neq("status", "resolved");
    for (const disc of discreps || []) {
      nodes.push({
        node_type: "discrepancy",
        label: disc.message?.slice(0, 60) || disc.rule_key,
        status: disc.severity === "blocker" ? "blocked" : "in_progress",
        metadata: { severity: disc.severity, rule_key: disc.rule_key, status: disc.status },
        source_entity_id: disc.id,
      });
      if (disc.object_id) {
        edgeDefs.push({ from_source: disc.object_id, to_source: disc.id, edge_type: "BLOCKED_BY" });
      }
    }

    // 9. Waterfall tiers
    const { data: tiers } = await supabase.from("waterfall_tiers").select("*").eq("deal_id", deal_id);
    for (const t of tiers || []) {
      nodes.push({
        node_type: "waterfall_model",
        label: t.name,
        status: "complete",
        metadata: { tier_rank: t.tier_rank },
        source_entity_id: t.id,
      });
      edgeDefs.push({ from_source: deal.id, to_source: t.id, edge_type: "DERIVED_FROM_DOCUMENT" });
    }

    // 10. Tax forms
    const { data: taxForms } = await supabase.from("tax_forms").select("*").eq("deal_id", deal_id);
    for (const tf of taxForms || []) {
      const tfStatus = tf.status === "verified" || tf.status === "received" ? "complete" : "in_progress";
      nodes.push({
        node_type: "tax_form",
        label: `${tf.form_type} — ${tf.tin_last4 ? `***${tf.tin_last4}` : 'pending'}`,
        status: tfStatus,
        metadata: { form_type: tf.form_type, status: tf.status },
        source_entity_id: tf.id,
      });
      edgeDefs.push({ from_source: tf.recipient_id, to_source: tf.id, edge_type: "HAS_TAX_FORM" });
    }

    // ── Upsert: delete old graph, insert new ──
    await supabase.from("graph_edges").delete().eq("deal_id", deal_id);
    await supabase.from("graph_nodes").delete().eq("deal_id", deal_id);

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

    const sourceToNodeId = new Map<string, string>();
    for (const n of insertedNodes || []) {
      if (n.source_entity_id) sourceToNodeId.set(n.source_entity_id, n.id);
    }

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
    const allChecks = checks || [];
    const allApprovals = approvals || [];
    const allDocs = docs || [];
    const allIntents = intents || [];
    const activeDiscreps = discreps || [];

    const blockers: string[] = [];
    const nextActions: string[] = [];

    const requiredDocs = allDocs.filter((d) => d.is_required);
    const missingDocs = requiredDocs.filter((d) => d.status !== "VERIFIED" && d.status !== "EXTRACTION_COMPLETE");
    if (missingDocs.length > 0) {
      blockers.push(`${missingDocs.length} required document(s) not verified`);
      missingDocs.slice(0, 3).forEach((d) => nextActions.push(`Upload/verify: ${d.filename}`));
    }

    const failedChecks = allChecks.filter((c) => c.status !== "passed");
    if (failedChecks.length > 0) {
      blockers.push(`${failedChecks.length} compliance check(s) not passed`);
      failedChecks.slice(0, 3).forEach((c) => nextActions.push(`Complete ${c.check_type}`));
    }

    const pendingApprovals = allApprovals.filter((a) => a.status !== "approved");
    if (pendingApprovals.length > 0) {
      blockers.push(`${pendingApprovals.length} approval(s) pending`);
      pendingApprovals.slice(0, 3).forEach((a) => nextActions.push(`Get ${a.approval_side} approval`));
    }

    const blockerDiscreps = activeDiscreps.filter((d) => d.severity === "blocker");
    if (blockerDiscreps.length > 0) {
      blockers.push(`${blockerDiscreps.length} blocker discrepancy(ies)`);
      blockerDiscreps.slice(0, 3).forEach((d) => nextActions.push(`Resolve: ${d.message?.slice(0, 50)}`));
    }

    // Unconfirmed obligations
    const unconfirmedObs = (obligations || []).filter((o) => o.status !== "CONFIRMED" && o.status !== "REJECTED");
    if (unconfirmedObs.length > 0) {
      blockers.push(`${unconfirmedObs.length} obligation(s) need review`);
      nextActions.push("Review and confirm extracted obligations");
    }

    // Missing tax forms
    const missingTax = (taxForms || []).filter((t) => t.status === "required");
    if (missingTax.length > 0) {
      blockers.push(`${missingTax.length} required tax form(s) missing`);
      nextActions.push("Collect outstanding tax documentation");
    }

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