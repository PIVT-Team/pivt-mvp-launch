import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Feature 1 — the Signature Matrix.
 *
 * Replaces `extract-signature-packets`, which emitted packet-level rows
 * (packet_name / packet_type / approver_role) straight into `deal_approvals`.
 * That produced a list of documents, not a matrix: no per-person rows, no
 * signing capacity, no signature-page references, and no review step before
 * rows landed in a table the send flow reads from.
 *
 * This emits one row per Document × Party × Signatory × Capacity, into
 * `deal_requirements` with kind='signature' and review_status='pending_review'.
 * Nothing can be circulated until a lawyer approves it — enforced by the
 * `requirement_requests_require_review` trigger, not by this function.
 */

const MATRIX_SCHEMA = {
  type: "object",
  properties: {
    signatures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          document_name: { type: "string", description: "e.g. 'Stock Purchase Agreement'" },
          signing_party: { type: "string", description: "the entity that signs, e.g. 'BuyerCo'" },
          signatory_name: { type: "string", description: "the person signing; empty if not stated" },
          signatory_capacity: { type: "string", description: "e.g. 'CEO', 'President', 'Manager'" },
          signatory_email: { type: "string" },
          signature_page_ref: { type: "string", description: "page or section reference if identifiable" },
          multiple_signatures_required: { type: "boolean" },
          notarisation_required: { type: "boolean" },
          confidence: { type: "number", description: "0-1" },
          ambiguity: { type: "string", enum: ["low", "medium", "high"] },
          source_snippet: { type: "string", description: "verbatim text the finding rests on" },
        },
        required: ["document_name", "signing_party", "signatory_capacity", "confidence", "ambiguity"],
      },
    },
  },
  required: ["signatures"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireJwt(req, corsHeaders);
    const { deal_id } = await req.json();
    if (!deal_id) return json({ error: "deal_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Only current document versions — a superseded SPA's signature block is
    // not what anyone will be signing.
    const { data: docs } = await admin
      .from("contract_documents")
      .select("id, filename, doc_type, version, text_content")
      .eq("deal_id", deal_id)
      .eq("is_current", true);

    const usable = (docs || []).filter((d: any) => (d.text_content || "").length > 200);
    if (usable.length === 0) {
      return json({ success: true, created: 0, message: "No readable current documents to analyse." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const created: any[] = [];

    // Per document, so every row carries a real source reference rather than a
    // finding attributed to an undifferentiated blob of text.
    for (const doc of usable) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You identify who must sign an M&A transaction document. For each signature block or " +
                "execution provision, emit one entry PER SIGNATORY — not per document. If a document is " +
                "signed by two parties, that is two entries. Capture the signing entity, the individual " +
                "(if named), and their capacity/title. If the individual is not named, leave signatory_name " +
                "empty and set ambiguity to 'high' — do NOT invent a name. Quote the text each finding " +
                "rests on in source_snippet. You are proposing an interpretation for a lawyer to review, " +
                "not making a legal determination.",
            },
            {
              role: "user",
              content: `Document: ${doc.filename} (${doc.doc_type}, version ${doc.version})\n\n${(doc.text_content || "").slice(0, 25000)}`,
            },
          ],
          tools: [{ type: "function", function: { name: "emit_matrix", description: "Signature matrix rows", parameters: MATRIX_SCHEMA } }],
          tool_choice: { type: "function", function: { name: "emit_matrix" } },
        }),
      });

      if (!aiRes.ok) continue;
      const payload = await aiRes.json();
      const call = payload.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) continue;
      const rows = JSON.parse(call.function.arguments).signatures || [];

      for (const s of rows) {
        // Skip rows the model is unsure enough about to be noise.
        if (Number(s.confidence) < 0.3) continue;

        const who = s.signatory_name?.trim();
        const title = [
          s.document_name || doc.filename,
          "—",
          who ? `${who} (${s.signatory_capacity})` : `${s.signing_party} signatory`,
        ].join(" ");

        created.push({
          deal_id,
          requirement_kind: "signature",
          title,
          description: s.multiple_signatures_required
            ? "This document requires more than one signature."
            : null,
          category: "signatures",
          signing_party: s.signing_party || null,
          signatory_name: who || null,
          signatory_capacity: s.signatory_capacity || null,
          counterparty_name: s.signing_party || null,
          counterparty_email: s.signatory_email || null,
          signature_pages: s.signature_page_ref ? [{ ref: s.signature_page_ref }] : [],
          blocks_closing: true,
          priority: "high",
          source: "ai",
          source_ref: {
            document_id: doc.id,
            document_version: doc.version,
            filename: doc.filename,
            snippet: (s.source_snippet || "").slice(0, 500),
            page: s.signature_page_ref || null,
            notarisation_required: !!s.notarisation_required,
          },
          ai_confidence: Number(s.confidence) || null,
          // An unnamed signatory is always high ambiguity regardless of what
          // the model claimed — someone has to say who actually signs.
          ai_ambiguity: who ? (s.ambiguity || "medium") : "high",
          review_status: "pending_review",
          status: "not_started",
        });
      }
    }

    if (created.length === 0) {
      return json({ success: true, created: 0, message: "No signature requirements identified." });
    }

    const { data: inserted, error } = await admin
      .from("deal_requirements").insert(created).select("id, title, signatory_name, signatory_capacity, ai_ambiguity");
    if (error) return json({ error: error.message }, 500);

    await admin.from("audit_log").insert({
      deal_id,
      action: "signature_matrix_extracted",
      details: {
        documents_analysed: usable.length,
        rows_created: inserted?.length || 0,
        awaiting_review: inserted?.length || 0,
      },
    });

    return json({
      success: true,
      created: inserted?.length || 0,
      documents_analysed: usable.length,
      awaiting_review: inserted?.length || 0,
      rows: inserted,
      note: "All rows require human review before any packet can be circulated.",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
