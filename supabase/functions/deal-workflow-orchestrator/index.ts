import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";
import { diffPaymentSet, type PaymentRow } from "../_shared/funds-flow-diff.ts";
import { normalizePayee } from "../_shared/entity-match.ts";

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

      // ── Step 1: Resolve this document's place in its version history ──
      //
      // Previously this step deleted rows whose source_document_id matched the
      // document being processed. For a NEW version of a funds flow that matched
      // nothing — the prior version's wires survived and the new version's were
      // inserted alongside them, doubling every payment on the deal (gap G2).
      // Reconciliation is now a diff, handled inside processFundsFlow.
      let docMeta: { version: number; filename: string; supersedes_id: string | null } | null = null;
      if (document_id) {
        const { data: dm } = await admin
          .from("contract_documents")
          .select("version, filename, supersedes_id")
          .eq("id", document_id)
          .maybeSingle();
        if (dm) {
          docMeta = { version: dm.version ?? 1, filename: dm.filename, supersedes_id: dm.supersedes_id ?? null };
          results.document_version = docMeta.version;
        }
        // Re-processing the SAME document (a retry, not a new version) should
        // still clear that document's own prior output so retries stay idempotent.
        await admin.from("payment_allocations").delete().eq("source_document_id", document_id);
      }

      // ── Step 2: Ontology Mapping + Entity Creation by doc type ──

      if (docType === "FUNDS_FLOW" || docType === "WIRE_INSTRUCTIONS") {
        await processFundsFlow(admin, deal_id, document_id, fields, results, auditEvents, docMeta, docType);
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

      // ── Step 2b: Extract payment obligations ──
      //
      // Nothing invoked obligation-extractor anywhere in the codebase, so
      // `obligations` was always empty. evalObligationRules returns early on an
      // empty set, which meant four blocker rules — amount mismatch, currency
      // mismatch, unconfirmed payment instructions, and no-matching-obligation —
      // had never fired on any deal. They gate execution, so this ran the
      // discrepancy engine with a quarter of its execution checks inert.
      //
      // Runs BEFORE the discrepancy engine so the obligations it writes are
      // visible to the rules in the same pass.
      if (document_id && ["SPA", "FUNDS_FLOW", "ESCROW_AGREEMENT", "PAYOFF_LETTER", "FEE_LETTER"].includes(docType)) {
        try {
          await admin.functions.invoke("obligation-extractor", {
            body: { document_id },
            headers: { Authorization: authHeader },
          });
          results.obligations_extracted = true;
          auditEvents.push({ action: "obligations_extracted", details: { document_id, doc_type: docType } });
        } catch (e) {
          // Non-fatal: a missing obligation set degrades the rules but must not
          // fail the whole ingestion pass.
          console.error("Obligation extraction failed:", e);
          results.obligations_extracted = false;
        }
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
      const auditRows: Array<{
        deal_id: string;
        action: string;
        details: Record<string, unknown>;
      }> = auditEvents.map((evt) => ({
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

/**
 * Invalidate approvals that were granted against a now-superseded payment set.
 *
 * An approval used to be a status with no memory of what it approved, so it
 * could never go stale: PIVT reported "approvals complete" on a deal whose
 * funds flow had changed eight days after the last sign-off (gap G4). An
 * approval is now bound to the document version in force when it was granted,
 * and a materially different version revokes it.
 */
async function invalidateStaleApprovals(
  admin: any, deal_id: string, document_id: string | null,
  sourceLabel: string,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>
) {
  const { data: live } = await admin
    .from("deal_approvals")
    .select("id, approval_side, approval_type, approver_name, packet_name, status")
    .eq("deal_id", deal_id)
    .in("status", ["approved", "completed"])
    .is("invalidated_at", null);

  if (!live || live.length === 0) return;

  const reason = `${sourceLabel} changed the payment set after this approval was granted.`;
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("deal_approvals")
    .update({
      status: "pending",
      invalidated_at: nowIso,
      invalidated_reason: reason,
      invalidated_by_document_id: document_id,
    })
    .in("id", live.map((a: any) => a.id));

  if (error) {
    console.error("Failed to invalidate approvals:", error);
    return;
  }

  const events = live.map((a: any) => ({
    deal_id,
    change_type: "approval_invalidated",
    severity: "critical",
    blocks_closing: true,
    source_document_id: document_id,
    source_label: sourceLabel,
    object_type: "deal_approval",
    object_id: a.id,
    title: `Approval no longer valid: ${a.packet_name || a.approval_type || a.approval_side}`,
    what_changed: `${a.approver_name || a.approval_side} approved an earlier version of the payment set. ${reason}`,
    why_it_matters: "The approval on file authorises payments that have since changed. Closing on it would execute terms nobody signed off.",
    recommended_action: `Re-send for approval against ${sourceLabel}.`,
    details: { approval_side: a.approval_side, approval_type: a.approval_type, previous_status: a.status },
  }));

  const { error: ceErr } = await admin.from("deal_change_events").insert(events);
  if (ceErr) console.error("Failed to record approval invalidation events:", ceErr);

  auditEvents.push({
    action: "approvals_invalidated",
    details: { count: live.length, reason, document_id },
  });
}

async function processFundsFlow(
  admin: any, deal_id: string, document_id: string | null,
  fields: any, results: Record<string, unknown>,
  auditEvents: Array<{ action: string; details: Record<string, unknown> }>,
  docMeta: { version: number; filename: string; supersedes_id: string | null } | null,
  docType: string
) {
  const lineItems = fields?.line_items;

  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const version = docMeta?.version ?? 1;
    const prettyType = docType === "WIRE_INSTRUCTIONS" ? "Wire Instructions" : "Funds Flow";
    const sourceLabel = `${prettyType} v${version}`;

    const incoming: PaymentRow[] = lineItems.map((item: any) => ({
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
    })) as PaymentRow[];

    // Reconcile against the payments this document lineage already produced.
    // Wires entered by hand or by Newton (source_document_id null, or sourced
    // from an unrelated document) are left strictly alone — a funds flow import
    // must never delete something a person typed.
    const { data: allWires } = await admin
      .from("wire_instructions")
      .select("*")
      .eq("deal_id", deal_id);

    const { data: lineageDocs } = await admin
      .from("contract_documents")
      .select("id")
      .eq("deal_id", deal_id)
      .in("doc_type", ["FUNDS_FLOW", "WIRE_INSTRUCTIONS"]);
    const lineageIds = new Set((lineageDocs || []).map((d: any) => d.id));

    const existing: PaymentRow[] = (allWires || []).filter(
      (w: any) => w.source_document_id && lineageIds.has(w.source_document_id)
    );
    const manualWires = (allWires || []).filter(
      (w: any) => !w.source_document_id || !lineageIds.has(w.source_document_id)
    );

    const diff = diffPaymentSet(existing, incoming);
    const changeEvents: any[] = [];

    // ── amount changes: update in place, keep the row identity ──
    for (const c of diff.amountChanged) {
      await admin.from("wire_instructions")
        .update({
          amount: Number(c.incoming.amount) || 0,
          source_document_id: document_id,
          last_updated_by_source: `funds_flow_v${version}`,
        })
        .eq("id", c.existing.id);

      changeEvents.push({
        deal_id, change_type: "payment_amount_changed",
        severity: "high", blocks_closing: true,
        source_document_id: document_id, source_label: sourceLabel,
        from_version: version - 1, to_version: version,
        object_type: "wire_instruction", object_id: c.existing.id,
        title: `Payment amount changed: ${c.existing.payee_entity}`,
        what_changed: `$${(c.fromCents / 100).toLocaleString()} → $${(c.toCents / 100).toLocaleString()}`,
        why_it_matters: "The amount payable to this recipient moved after the payment set was last reviewed.",
        recommended_action: `Confirm the revised amount for ${c.existing.payee_entity} against ${sourceLabel}, then re-approve.`,
        details: { from_cents: c.fromCents, to_cents: c.toCents, payee: c.existing.payee_entity },
      });
    }

    // ── bank detail changes: update; the DB trigger resets verification ──
    for (const c of diff.bankChanged) {
      await admin.from("wire_instructions")
        .update({
          bank_name: c.incoming.bank_name ?? c.existing.bank_name,
          account_holder: c.incoming.account_holder ?? c.existing.account_holder,
          account_number_last4: c.incoming.account_number_last4 ?? c.existing.account_number_last4,
          routing_number: c.incoming.routing_number ?? c.existing.routing_number,
          swift_bic: c.incoming.swift_bic ?? c.existing.swift_bic,
          iban: c.incoming.iban ?? c.existing.iban,
          source_document_id: document_id,
          last_updated_by_source: `funds_flow_v${version}`,
        })
        .eq("id", c.existing.id);

      changeEvents.push({
        deal_id, change_type: "wire_details_changed",
        severity: "critical", blocks_closing: true,
        source_document_id: document_id, source_label: sourceLabel,
        from_version: version - 1, to_version: version,
        object_type: "wire_instruction", object_id: c.existing.id,
        title: `Wire instructions changed: ${c.existing.payee_entity}`,
        what_changed: c.changes
          .map((x: any) => `${x.field.replace(/_/g, " ")}: ${x.from ?? "—"} → ${x.to}`)
          .join("; "),
        why_it_matters: c.wasVerified
          ? "This account was previously verified. That verification described the OLD account and no longer applies — this is the pattern payment-redirection fraud takes."
          : "Payment routing changed before verification completed.",
        recommended_action: `Reverify ${c.existing.payee_entity}'s bank account by independent callback to a known contact before funding.`,
        details: { changes: c.changes, was_verified: c.wasVerified, payee: c.existing.payee_entity },
      });
    }

    // ── removed: drop the payment, but never silently ──
    for (const r of diff.removed) {
      changeEvents.push({
        deal_id, change_type: "payment_removed",
        severity: "high", blocks_closing: true,
        source_document_id: document_id, source_label: sourceLabel,
        from_version: version - 1, to_version: version,
        object_type: "wire_instruction", object_id: r.id,
        title: `Recipient removed: ${r.payee_entity}`,
        what_changed: `${r.payee_entity} was receiving $${Number(r.amount).toLocaleString()} and is absent from ${sourceLabel}.`,
        why_it_matters: "A party who was due funds is no longer scheduled to be paid. If the omission is unintentional they will be left unpaid at closing.",
        recommended_action: `Confirm with the party preparing ${sourceLabel} that dropping ${r.payee_entity} is intended.`,
        // full snapshot: the wire row itself is about to disappear
        details: {
          removed_payee: r.payee_entity,
          removed_amount: r.amount,
          removed_currency: r.currency,
          removed_bank: r.bank_name,
          removed_account_last4: r.account_number_last4,
          prior_verification_status: r.verification_status,
        },
      });
      await admin.from("wire_instructions").delete().eq("id", r.id);
    }

    // ── added ──
    const addedRows = diff.added.map((a) => ({
      deal_id,
      source_document_id: document_id || null,
      payer_entity: a.payer_entity || null,
      payee_entity: a.payee_entity,
      bank_name: a.bank_name || null,
      account_holder: a.account_holder || null,
      account_number_last4: a.account_number_last4 || null,
      routing_number: a.routing_number || null,
      swift_bic: a.swift_bic || null,
      iban: a.iban || null,
      currency: a.currency || "USD",
      amount: Number(a.amount) || 0,
      payment_type: a.payment_type || "Purchase Price",
      verification_status: "pending",
    }));

    let insertedWires: any[] = [];
    if (addedRows.length > 0) {
      const { data, error: wireErr } = await admin
        .from("wire_instructions").insert(addedRows).select("id, payee_entity, amount");
      if (wireErr) {
        // Do not report success on a partial write (gap G8).
        console.error("Failed to insert wire instructions:", wireErr);
        results.wire_insert_error = wireErr.message;
        auditEvents.push({
          action: "wire_instruction_insert_failed",
          details: { document_id, attempted: addedRows.length, error: wireErr.message },
        });
        throw new Error(`Wire instruction insert failed: ${wireErr.message}`);
      }
      insertedWires = data || [];
      for (const w of insertedWires) {
        changeEvents.push({
          deal_id, change_type: "payment_added",
          severity: version > 1 ? "high" : "info",
          blocks_closing: version > 1,
          source_document_id: document_id, source_label: sourceLabel,
          from_version: version - 1, to_version: version,
          object_type: "wire_instruction", object_id: w.id,
          title: `New recipient: ${w.payee_entity}`,
          what_changed: `${w.payee_entity} added for $${Number(w.amount).toLocaleString()}.`,
          why_it_matters: version > 1
            ? "A recipient not present in the prior version has been introduced. New payees are the most common vector for fraudulent additions."
            : "Initial payment set imported.",
          recommended_action: `Verify ${w.payee_entity}'s identity and bank details before funding.`,
          details: { payee: w.payee_entity, amount: w.amount },
        });
      }
    }

    // ── duplicates inside the incoming document ──
    for (const dup of diff.duplicatesInIncoming) {
      changeEvents.push({
        deal_id, change_type: "duplicate_payment_detected",
        severity: "critical", blocks_closing: true,
        source_document_id: document_id, source_label: sourceLabel,
        from_version: version - 1, to_version: version,
        object_type: "deal", object_id: deal_id,
        title: `Duplicate payment: ${dup.payee} appears ${dup.rows.length}×`,
        what_changed: `${sourceLabel} lists ${dup.rows.length} separate payments of $${(dup.amountCents / 100).toLocaleString()} to ${dup.payee} (spellings: ${dup.rows.map((r: any) => `"${r.payee_entity}"`).join(", ")}).`,
        why_it_matters: `If all lines fund, the deal overpays by $${((dup.amountCents * (dup.rows.length - 1)) / 100).toLocaleString()}.`,
        recommended_action: `Confirm whether these are genuinely separate obligations. If not, remove the duplicate line from ${sourceLabel}.`,
        details: { payee: dup.payee, count: dup.rows.length, amount_cents: dup.amountCents },
      });
    }

    if (changeEvents.length > 0) {
      const { error: ceErr } = await admin.from("deal_change_events").insert(changeEvents);
      if (ceErr) console.error("Failed to record change events:", ceErr);
    }

    // ── invalidate approvals that covered the superseded payment set ──
    if (version > 1 && (diff.bankChanged.length || diff.amountChanged.length || diff.removed.length || diff.added.length)) {
      await invalidateStaleApprovals(admin, deal_id, document_id, sourceLabel, auditEvents);
    }

    results.wires_created = insertedWires.length;
    results.wires_updated = diff.amountChanged.length + diff.bankChanged.length;
    results.wires_removed = diff.removed.length;
    results.wires_unchanged = diff.unchanged.length;
    results.manual_wires_untouched = manualWires.length;
    results.change_events = changeEvents.length;

    auditEvents.push({
      action: "funds_flow_reconciled",
      details: {
        document_id, version, source: sourceLabel,
        added: insertedWires.length,
        amount_changed: diff.amountChanged.length,
        bank_changed: diff.bankChanged.length,
        removed: diff.removed.length,
        unchanged: diff.unchanged.length,
        duplicates_flagged: diff.duplicatesInIncoming.length,
      },
    });

    // Create payment allocation records.
    //
    // source_wire_id used to be `insertedWires[idx]`, which assumed the insert
    // returned one row per line item in order. Now that most line items update
    // an existing wire rather than insert a new one, the index no longer lines
    // up — resolve the wire by payee identity against the reconciled set.
    const { data: reconciledWires } = await admin
      .from("wire_instructions")
      .select("id, payee_entity, payment_type")
      .eq("deal_id", deal_id);

    const wireByPayee = new Map<string, string>();
    for (const w of reconciledWires || []) {
      wireByPayee.set(
        `${normalizePayee(w.payee_entity)}::${(w.payment_type || "").toLowerCase().trim()}`,
        w.id
      );
    }

    const allocRows = lineItems.map((item: any) => {
      const payee = item.recipient_name || item.payee || "Unknown";
      const key = `${normalizePayee(payee)}::${mapPaymentType(item.item_type || item.payment_type).toLowerCase().trim()}`;
      return {
        deal_id,
        source_document_id: document_id || null,
        source_wire_id: wireByPayee.get(key) || null,
        recipient: payee,
        amount: Number(item.amount) || 0,
        currency: item.currency || "USD",
        allocation_type: item.item_type || "other",
        status: "unmatched",
      };
    });

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
