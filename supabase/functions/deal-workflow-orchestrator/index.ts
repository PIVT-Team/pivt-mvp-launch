import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Deal Workflow Orchestrator
 * 
 * Triggered after document upload + classification to:
 * 1. Parse extracted data into wire_instructions & payment_allocations
 * 2. Trigger the discrepancy engine
 * 3. Log audit events
 * 4. Update readiness indicators
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // ── Action: process_document ──
    // Called after document-ai classifies a document
    if (action === "process_document" || !action) {
      const docType = (doc_type || "").toUpperCase();

      // If no extracted_fields passed, fetch from contract_documents
      let fields = extracted_fields;
      if (!fields && document_id) {
        const { data: doc } = await admin
          .from("contract_documents")
          .select("extracted_fields, doc_type")
          .eq("id", document_id)
          .single();
        fields = doc?.extracted_fields || {};
      }

      // ── FUNDS_FLOW processing ──
      if (docType === "FUNDS_FLOW" || docType === "WIRE_INSTRUCTIONS") {
        const lineItems = fields?.line_items;

        if (Array.isArray(lineItems) && lineItems.length > 0) {
          // Clear old wire instructions from this document
          if (document_id) {
            await admin.from("wire_instructions").delete().eq("source_document_id", document_id);
            await admin.from("payment_allocations").delete().eq("source_document_id", document_id);
          }

          // Insert wire instructions from line items
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
            payment_type: mapItemType(item.item_type || item.payment_type),
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
          }

          // Insert payment allocations
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
          }
        } else {
          // Even without line_items, create allocations from top-level fields
          const topLevelAllocs: any[] = [];
          if (fields?.total_sources) {
            topLevelAllocs.push({
              deal_id,
              source_document_id: document_id || null,
              recipient: "Total Sources",
              amount: Number(fields.total_sources) || 0,
              allocation_type: "source",
              status: "unmatched",
            });
          }
          if (fields?.total_uses) {
            topLevelAllocs.push({
              deal_id,
              source_document_id: document_id || null,
              recipient: "Total Uses",
              amount: Number(fields.total_uses) || 0,
              allocation_type: "use",
              status: "unmatched",
            });
          }
          if (fields?.escrow_amount) {
            topLevelAllocs.push({
              deal_id,
              source_document_id: document_id || null,
              recipient: "Escrow Agent",
              amount: Number(fields.escrow_amount) || 0,
              allocation_type: "escrow",
              status: "unmatched",
            });
          }

          if (topLevelAllocs.length > 0) {
            if (document_id) {
              await admin.from("payment_allocations").delete().eq("source_document_id", document_id);
            }
            await admin.from("payment_allocations").insert(topLevelAllocs);
            results.allocations_created = topLevelAllocs.length;
          }
        }

        // Log audit event
        await admin.from("audit_log").insert({
          deal_id,
          action: "funds_flow_processed",
          details: {
            document_id,
            doc_type: docType,
            wires_created: results.wires_created || 0,
            allocations_created: results.allocations_created || 0,
          },
        });
      }

      // ── ESCROW_AGREEMENT processing ──
      if (docType === "ESCROW_AGREEMENT") {
        const escrowAmount = Number(fields?.escrow_amount || 0);
        const escrowAgent = fields?.escrow_agent;

        if (escrowAmount > 0 && escrowAgent) {
          // Create wire instruction for escrow deposit
          await admin.from("wire_instructions").insert({
            deal_id,
            source_document_id: document_id || null,
            payee_entity: escrowAgent,
            amount: escrowAmount,
            payment_type: "Escrow",
            verification_status: "pending",
          });
          results.escrow_wire_created = true;
        }

        await admin.from("audit_log").insert({
          deal_id,
          action: "escrow_agreement_processed",
          details: { document_id, escrow_amount: escrowAmount, escrow_agent: escrowAgent },
        });
      }

      // ── PAYOFF_LETTER processing ──
      if (docType === "PAYOFF_LETTER") {
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
        }
      }

      // ── Always trigger discrepancy engine after processing ──
      try {
        await admin.functions.invoke("discrepancy-engine", {
          body: { deal_id },
        });
        results.discrepancy_engine_triggered = true;
      } catch (e) {
        console.error("Discrepancy engine trigger failed:", e);
        results.discrepancy_engine_triggered = false;
      }

      // Log general document processing event
      await admin.from("audit_log").insert({
        deal_id,
        action: "document_workflow_processed",
        details: {
          document_id,
          doc_type: docType,
          fields_extracted: fields ? Object.keys(fields).length : 0,
        },
      });
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

function mapItemType(type: string): string {
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
