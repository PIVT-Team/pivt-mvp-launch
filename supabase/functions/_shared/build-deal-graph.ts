import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

export interface BuildDealGraphResult {
  success: true;
  deal_state: string;
  node_count: number;
  edge_count: number;
  blockers: string[];
  next_actions: string[];
}

type RowRecord = Record<string, any>;

export async function buildDealGraphJob(
  supabase: any,
  dealId: string,
): Promise<BuildDealGraphResult> {
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).single<RowRecord>();
  if (!deal) throw new Error("Deal not found");

  const nodes: NodeDef[] = [];
  const edgeDefs: EdgeDef[] = [];

  nodes.push({
    node_type: "deal",
    label: deal.deal_name,
    status: "in_progress",
    metadata: { deal_value: deal.deal_value, buyer: deal.buyer, seller: deal.seller, target: deal.target_company },
    source_entity_id: deal.id,
  });

  const { data: dealParties } = await supabase.from("deal_parties").select("id, party_type, organization:organizations(id, name)").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const dp of dealParties || []) {
    const orgName = (dp.organization as { name?: string } | null)?.name || dp.party_type;
    nodes.push({
      node_type: "stakeholder",
      label: orgName,
      status: "complete",
      metadata: { party_type: dp.party_type, entity_class: "party" },
      source_entity_id: dp.id,
    });
    edgeDefs.push({ from_source: dp.id, to_source: deal.id, edge_type: "PARTICIPATES_IN" });
  }

  const { data: capEntries } = await supabase.from("cap_table_entries").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const s of capEntries || []) {
    const equityRoles = ["Seller", "Target", "Shareholder", "Founder", "Employee", "Advisor"];
    const isShareholder = equityRoles.includes(s.role) && (s.ownership_pct > 0);
    nodes.push({
      node_type: isShareholder ? "shareholder" : "stakeholder",
      label: s.shareholder_name,
      status: s.verification_status === "verified" ? "complete" : "in_progress",
      metadata: {
        role: s.role,
        stakeholder_type: s.stakeholder_type,
        entity_class: isShareholder ? "shareholder" : "contact",
        ownership_pct: isShareholder ? s.ownership_pct : 0,
        payout: s.payout_amount,
        verification_status: s.verification_status,
      },
      source_entity_id: s.id,
    });

    edgeDefs.push({
      from_source: s.id,
      to_source: deal.id,
      edge_type: isShareholder ? "OWNS" : "PARTICIPATES_IN",
    });
  }

  const { data: docs } = await supabase.from("contract_documents").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const d of docs || []) {
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

    const docStatus = d.status === "EXTRACTION_COMPLETE" || d.status === "VERIFIED"
      ? "complete"
      : d.status === "UPLOADED"
        ? "in_progress"
        : "not_started";

    nodes.push({
      node_type: docNodeType,
      label: d.filename,
      status: docStatus,
      metadata: { doc_type: d.doc_type, status: d.status, document_role: d.document_role },
      source_entity_id: d.id,
    });
    edgeDefs.push({ from_source: d.id, to_source: deal.id, edge_type: "SUBMITTED_DOCUMENT" });
  }

  const { data: obligations } = await supabase.from("obligations").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const ob of obligations || []) {
    const obStatus = ob.status === "CONFIRMED"
      ? "complete"
      : ob.status === "NEEDS_REVIEW" || ob.status === "DRAFT_EXTRACTED"
        ? "in_progress"
        : "not_started";
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

  const { data: checks } = await supabase.from("compliance_checks").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
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

  const { data: approvals } = await supabase.from("deal_approvals").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
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

  const { data: intents } = await supabase.from("disbursement_intents").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const di of intents || []) {
    const pStatus = di.status === "settled" ? "complete" : di.status === "failed" ? "failed" : di.status === "draft" ? "not_started" : "in_progress";
    nodes.push({
      node_type: "payment_intent",
      label: `Payment $${(di.amount_original / 1e6).toFixed(1)}M`,
      status: pStatus,
      metadata: { amount: di.amount_original, status: di.status, rail: di.rail, currency: di.currency_original },
      source_entity_id: di.id,
    });
    edgeDefs.push({ from_source: deal.id, to_source: di.id, edge_type: "PAYS_TO" });
    edgeDefs.push({ from_source: di.id, to_source: di.recipient_id, edge_type: "RECEIVES_PAYOUT" });
  }

  const { data: discreps } = await supabase.from("discrepancies").select("*").eq("deal_id", dealId).neq("status", "resolved") as { data: RowRecord[] | null };
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

  const { data: tiers } = await supabase.from("waterfall_tiers").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
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

  const { data: taxForms } = await supabase.from("tax_forms").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const tf of taxForms || []) {
    const tfStatus = tf.status === "verified" || tf.status === "received" ? "complete" : "in_progress";
    nodes.push({
      node_type: "tax_form",
      label: `${tf.form_type} — ${tf.tin_last4 ? `***${tf.tin_last4}` : "pending"}`,
      status: tfStatus,
      metadata: { form_type: tf.form_type, status: tf.status },
      source_entity_id: tf.id,
    });
    edgeDefs.push({ from_source: tf.recipient_id, to_source: tf.id, edge_type: "HAS_TAX_FORM" });
  }

  const { data: wireInstructions } = await supabase.from("wire_instructions").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const w of wireInstructions || []) {
    const wStatus = w.verification_status === "verified" ? "complete" : "in_progress";
    nodes.push({
      node_type: "wire_instruction",
      label: `Wire → ${w.payee_entity} ($${Number(w.amount).toLocaleString()})`,
      status: wStatus,
      metadata: {
        payee: w.payee_entity,
        payer: w.payer_entity,
        amount: w.amount,
        payment_type: w.payment_type,
        verification_status: w.verification_status,
        source_document_id: w.source_document_id,
      },
      source_entity_id: w.id,
    });
    edgeDefs.push({ from_source: deal.id, to_source: w.id, edge_type: "HAS_WIRE" });
    if (w.source_document_id) {
      edgeDefs.push({ from_source: w.id, to_source: w.source_document_id, edge_type: "DERIVED_FROM_DOCUMENT" });
    }
  }

  const { data: payAllocs } = await supabase.from("payment_allocations").select("*").eq("deal_id", dealId) as { data: RowRecord[] | null };
  for (const pa of payAllocs || []) {
    const paStatus = pa.status === "matched" ? "complete" : "in_progress";
    nodes.push({
      node_type: "payment_allocation",
      label: `${pa.allocation_type} → ${pa.recipient} ($${Number(pa.amount).toLocaleString()})`,
      status: paStatus,
      metadata: {
        recipient: pa.recipient,
        amount: pa.amount,
        allocation_type: pa.allocation_type,
        status: pa.status,
        source_document_id: pa.source_document_id,
      },
      source_entity_id: pa.id,
    });
    if (pa.source_wire_id) {
      edgeDefs.push({ from_source: pa.source_wire_id, to_source: pa.id, edge_type: "ALLOCATES_TO" });
    }
    if (pa.source_document_id) {
      edgeDefs.push({ from_source: pa.id, to_source: pa.source_document_id, edge_type: "DERIVED_FROM_DOCUMENT" });
    }
  }

  await supabase.from("graph_edges").delete().eq("deal_id", dealId);
  await supabase.from("graph_nodes").delete().eq("deal_id", dealId);

  const nodeRows = nodes.map((n) => ({
    deal_id: dealId,
    node_type: n.node_type,
    label: n.label,
    status: n.status,
    metadata: n.metadata,
    source_entity_id: n.source_entity_id,
  }));
  const { data: insertedNodes, error: nodeErr } = await (supabase.from("graph_nodes") as any).insert(nodeRows).select("id, source_entity_id");
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
        deal_id: dealId,
        from_node_id: fromId,
        to_node_id: toId,
        edge_type: e.edge_type,
        metadata: e.metadata || {},
      });
    }
  }

  if (edgeRows.length > 0) {
    const { error: edgeErr } = await (supabase.from("graph_edges") as any).insert(edgeRows);
    if (edgeErr) throw edgeErr;
  }

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

  const unconfirmedObs = (obligations || []).filter((o) => o.status !== "CONFIRMED" && o.status !== "REJECTED");
  if (unconfirmedObs.length > 0) {
    blockers.push(`${unconfirmedObs.length} obligation(s) need review`);
    nextActions.push("Review and confirm extracted obligations");
  }

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

  return {
    success: true,
    deal_state: dealState,
    node_count: insertedNodes?.length || 0,
    edge_count: edgeRows.length,
    blockers,
    next_actions: nextActions,
  };
}