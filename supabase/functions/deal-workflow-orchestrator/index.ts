import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Deal Workflow Orchestrator — Central Pipeline
 *
 * Document Upload → Classification → Extraction → Ontology Mapping →
 * Graph Update → Workflow Triggers → Verification → Readiness → Compliance Log
 *
 * Handles re-uploads by superseding prior extracted data from the same document.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authHeader } = await requireJwt(req, corsHeaders);
    const { deal_id, document_id, doc_type, extracted_fields, action } = await req.json();

    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const results: Record<string, unknown> = { deal_id, document_id };
    const auditEvents: Array<{ action: string; details: Record<string, unknown> }> = [];

    // ── Action: process_document ──
    if (action === "process_document" || !action) {
      const docType = (doc_type || "").toUpperCase();

      // Fetch fields from DB if not provided
      let fields = extracted_fields;
      if (!fields && document_id) {
        const { data: doc } = await admin
          .from("contract_documents")
          .select("extracted_fields, doc_type")
          .eq("id", document_id)
          .single();
        fields = doc?.extracted_fields || {};
      }

      // ── Step 1: Supersede prior extracted data from this document ──
      if (document_id) {
        const [delWires, delAllocs] = await Promise.all([
          admin.from("wire_instructions").delete().eq("source_document_id", document_id),
          admin.from("payment_allocations").delete().eq("source_document_id", document_id),
        ]);
        if (delWires.data || delAllocs.data) {
          auditEvents.push({
            action: "prior_extraction_superseded",
            details: { document_id, doc_type: docType },
          });
        }
      }

      // ── Step 2: Ontology Mapping + Entity Creation by doc type ──

      if (docType === "FUNDS_FLOW" || docType === "WIRE_INSTRUCTIONS") {
        await processFundsFlow(admin, deal_id, document_id, fields, results, auditEvents);
      }

      if (docType === "ESCROW_AGREEMENT") {
        await processEscrowAgreement(admin, deal_id, document_id, fields, results, auditEvents);
      }

      if (docType === "PAYOFF_LETTER") {
        await processPayoffLetter(admin, deal_id, document_id, fields, results, auditEvents);
      }

      if (docType === "CAP_TABLE") {
        await processCapTable(admin, deal_id, document_id, fields, results, auditEvents);
      }

      if (docType === "SPA") {
        await processSPA(admin, deal_id, document_id, fields, results, auditEvents);
      }

      // ── Step 3: Run Discrepancy Engine ──
      try {
        await admin.functions.invoke("discrepancy-engine", {
          body: { deal_id },
          headers: { Authorization: authHeader },
        });
        results.discrepancy_engine_triggered = true;
        auditEvents.push({ action: "discrepancy_engine_triggered", details: { deal_id } });
      } catch (e) {
        console.error("Discrepancy engine trigger failed:", e);
        results.discrepancy_engine_triggered = false;
      }

      // ── Step 4: Queue Deal Graph Rebuild only when new documents are processed ──
      try {
        const graphRes = await admin.functions.invoke("enqueue-job", {
          body: {
            queue_name: "deal_graph_builds",
            deal_id,
            job_type: "build_deal_graph",
            payload: { deal_id, trigger: "document_added", document_id },
          },
          headers: { Authorization: authHeader },
        });
        results.graph_rebuilt = Boolean(graphRes?.data?.job_status_id);
        results.graph_job_id = graphRes?.data?.job_status_id || null;
        auditEvents.push({
          action: "deal_graph_rebuild_queued",
          details: {
            job_status_id: results.graph_job_id,
            trigger: "document_added",
          },
        });
      } catch (e) {
        console.error("Graph rebuild failed:", e);
        results.graph_rebuilt = false;
      }

      // ── Step 5: Write all audit events ──
      const auditRows = auditEvents.map((evt) => ({
        deal_id,
        action: evt.action,
        details: { ...evt.details, document_id, doc_type: docType, orchestrator_version: "2.0" },
      }));

      // Add the main processing event
      auditRows.push({
        deal_id,
        action: "document_workflow_processed",
        details: {
          document_id,
          doc_type: docType,
          fields_extracted: fields ? Object.keys(fields).length : 0,
          wires_created: results.wires_created || 0,
          allocations_created: results.allocations_created || 0,
          graph_rebuilt: results.graph_rebuilt || false,
          orchestrator_version: "2.0",
        },
      });

      if (auditRows.length > 0) {
        await admin.from("audit_log").insert(auditRows);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deal-workflow-orchestrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// Document Type Processors — Ontology-aware entity creation
// ═══════════════════════════════════════════════════════════════

async function processFundsFlow(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  const lineItems = fields?.line_items;

  if (Array.isArray(lineItems) && lineItems.length > 0) {
    // Create wire instruction records from line items
    const wireRows = lineItems.map((item: any) => ({
      deal_id,
      source_document_id: document_id || null,
      payer_entity: item.payor || item.payer || null,
      payee_entity: item.recipient_name || item.payee || "Unknown",
      bank_name: item.bank_name || null,
      account_holder: item.account_holder || item.recipient_name || null,
      account_number_last4: item.account_last4 || null,
      routing_number: item.routing_number || null,
      swift_bic: item.swift_bic || item.swift || null,
      iban: item.iban || null,
      currency: item.currency || "USD",
      amount: Number(item.amount) || 0,
      payment_type: mapPaymentType(item.item_type || item.payment_type),
      verification_status: "pending",
    }));

    const { data: insertedWires, error: wireErr } = await admin
      .from("wire_instructions")
      .insert(wireRows)
      .select("id");

    if (wireErr) {
      console.error("Failed to insert wire instructions:", wireErr);
    } else {
      results.wires_created = insertedWires?.length || 0;
      auditEvents.push({
        action: "wire_instructions_created",
        details: { count: results.wires_created, source: "funds_flow_extraction" },
      });
    }

    // Create payment allocation records
    const allocRows = lineItems.map((item: any, idx: number) => ({
      deal_id,
      source_document_id: document_id || null,
      source_wire_id: insertedWires?.[idx]?.id || null,
      recipient: item.recipient_name || item.payee || "Unknown",
      amount: Number(item.amount) || 0,
      currency: item.currency || "USD",
      allocation_type: item.item_type || "other",
      status: "unmatched",
    }));

    const { data: insertedAllocs, error: allocErr } = await admin
      .from("payment_allocations")
      .insert(allocRows)
      .select("id");

    if (allocErr) {
      console.error("Failed to insert allocations:", allocErr);
    } else {
      results.allocations_created = insertedAllocs?.length || 0;
      auditEvents.push({
        action: "payment_allocations_created",
        details: { count: results.allocations_created, source: "funds_flow_extraction" },
      });
    }
  } else {
    // Top-level fields without line items
    const topLevelAllocs: any[] = [];
    if (fields?.total_sources) {
      topLevelAllocs.push({
        deal_id, source_document_id: document_id || null,
        recipient: "Total Sources", amount: Number(fields.total_sources) || 0,
        allocation_type: "source", status: "unmatched",
      });
    }
    if (fields?.total_uses) {
      topLevelAllocs.push({
        deal_id, source_document_id: document_id || null,
        recipient: "Total Uses", amount: Number(fields.total_uses) || 0,
        allocation_type: "use", status: "unmatched",
      });
    }
    if (fields?.escrow_amount) {
      topLevelAllocs.push({
        deal_id, source_document_id: document_id || null,
        recipient: "Escrow Agent", amount: Number(fields.escrow_amount) || 0,
        allocation_type: "escrow", status: "unmatched",
      });
    }

    if (topLevelAllocs.length > 0) {
      await admin.from("payment_allocations").insert(topLevelAllocs);
      results.allocations_created = topLevelAllocs.length;
      auditEvents.push({
        action: "payment_allocations_created",
        details: { count: topLevelAllocs.length, source: "funds_flow_top_level" },
      });
    }
  }
}

async function processEscrowAgreement(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  const escrowAmount = Number(fields?.escrow_amount || 0);
  const escrowAgent = fields?.escrow_agent;

  if (escrowAmount > 0 && escrowAgent) {
    await admin.from("wire_instructions").insert({
      deal_id,
      source_document_id: document_id || null,
      payee_entity: escrowAgent,
      amount: escrowAmount,
      payment_type: "Escrow",
      verification_status: "pending",
    });
    results.escrow_wire_created = true;

    // Update deal escrow_amount if available
    await admin.from("deals").update({ escrow_amount: escrowAmount }).eq("id", deal_id);

    auditEvents.push({
      action: "escrow_agreement_processed",
      details: { escrow_amount: escrowAmount, escrow_agent: escrowAgent },
    });
  }
}

async function processPayoffLetter(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  const payoffAmount = Number(fields?.payoff_amount || fields?.amount || 0);
  const lender = fields?.lender_name || fields?.payoff_lender || "Lender";

  if (payoffAmount > 0) {
    await admin.from("wire_instructions").insert({
      deal_id,
      source_document_id: document_id || null,
      payee_entity: lender,
      amount: payoffAmount,
      payment_type: "Debt Payoff",
      verification_status: "pending",
    });
    results.payoff_wire_created = true;
    auditEvents.push({
      action: "payoff_letter_processed",
      details: { payoff_amount: payoffAmount, lender },
    });
  }
}

async function processCapTable(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  const majorHolders = fields?.major_holders;
  if (!Array.isArray(majorHolders) || majorHolders.length === 0) return;

  // Get deal value for payout calculation
  const { data: deal } = await admin.from("deals").select("deal_value").eq("id", deal_id).single();
  const dealValue = Number(deal?.deal_value || 0);

  let created = 0;
  for (const holder of majorHolders) {
    const name = holder.name;
    const pct = Number(holder.percentage || 0);
    if (!name || pct <= 0) continue;

    // Check if shareholder already exists
    const { data: existing } = await admin
      .from("cap_table_entries")
      .select("id")
      .eq("deal_id", deal_id)
      .eq("shareholder_name", name)
      .maybeSingle();

    if (existing) {
      // Update existing
      await admin.from("cap_table_entries").update({
        ownership_pct: pct,
        payout_amount: dealValue > 0 ? Math.round(dealValue * pct / 100) : 0,
      }).eq("id", existing.id);
    } else {
      // Insert new
      await admin.from("cap_table_entries").insert({
        deal_id,
        shareholder_name: name,
        ownership_pct: pct,
        payout_amount: dealValue > 0 ? Math.round(dealValue * pct / 100) : 0,
        role: "Shareholder",
        stakeholder_type: "individual",
        verification_status: "not_sent",
      });
      created++;
    }
  }

  results.shareholders_created = created;
  results.shareholders_updated = majorHolders.length - created;
  auditEvents.push({
    action: "cap_table_processed",
    details: {
      holders_extracted: majorHolders.length,
      created,
      updated: majorHolders.length - created,
    },
  });
}

async function processSPA(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  // Update deal metadata from SPA
  const updates: Record<string, any> = {};
  if (fields?.buyer_name) updates.buyer = fields.buyer_name;
  if (fields?.seller_name) updates.seller = fields.seller_name;
  if (fields?.target_name) updates.target_company = fields.target_name;
  if (fields?.purchase_price) updates.deal_value = Number(fields.purchase_price);
  if (fields?.closing_date) updates.closing_date = fields.closing_date;
  if (fields?.escrow_amount) updates.escrow_amount = Number(fields.escrow_amount);
  if (fields?.governing_law) updates.jurisdiction = fields.governing_law;

  if (Object.keys(updates).length > 0) {
    await admin.from("deals").update(updates).eq("id", deal_id);
    results.deal_metadata_updated = Object.keys(updates);
    auditEvents.push({
      action: "spa_processed",
      details: { fields_updated: Object.keys(updates), source_document_id: document_id },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function mapPaymentType(type: string): string {
  const map: Record<string, string> = {
    seller_proceeds: "Purchase Price",
    escrow: "Escrow",
    payoff: "Debt Payoff",
    fees: "Fees",
    tax_withholding: "Tax Withholding",
    advisory_fee: "Advisory Fee",
    other: "Other",
  };
  return map[type?.toLowerCase()] || type || "Other";
}
