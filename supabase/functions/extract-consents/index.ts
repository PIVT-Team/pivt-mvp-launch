import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";
import { chunkSequential, wasTruncated } from "../_shared/chunk-text.ts";
import { THRESHOLDS } from "../_shared/thresholds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Feature 2 — third-party consents and notices.
 *
 * Finds provisions that a transaction triggers: change of control, assignment,
 * merger/reorganisation, transfer, notice obligations, and termination rights
 * that the deal itself sets off.
 *
 * Two things this deliberately does NOT do:
 *   - decide that consent is legally required (it proposes; a lawyer decides)
 *   - contact anybody (nothing here can send; the DB trigger blocks it until
 *     a human has approved both the requirement and the outbound message)
 *
 * `unclear` is a first-class outcome. A clause that might require consent is
 * far more useful surfaced as ambiguous than silently dropped or overstated.
 */

const CONSENT_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          counterparty: { type: "string", description: "the other party to the contract" },
          contract_name: { type: "string" },
          requirement_type: { type: "string", enum: ["consent", "notice", "unclear"] },
          trigger_event: {
            type: "string",
            description: "change_of_control | assignment | merger | transfer | termination_right | other",
          },
          clause_reference: { type: "string", description: "e.g. 'Section 14.2'" },
          clause_text: { type: "string", description: "verbatim quote of the operative language" },
          deadline_days: { type: "number", description: "days before/after closing if stated, else 0" },
          deadline_description: { type: "string" },
          counterparty_contact: { type: "string", description: "email or notice address if stated" },
          consequence_if_missed: { type: "string" },
          confidence: { type: "number", description: "0-1" },
          ambiguity: { type: "string", enum: ["low", "medium", "high"] },
          reasoning: { type: "string" },
        },
        required: ["counterparty", "requirement_type", "trigger_event", "clause_text", "confidence", "ambiguity"],
      },
    },
  },
  required: ["findings"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireJwt(req, corsHeaders);
    const { deal_id, document_ids } = await req.json();
    if (!deal_id) return json({ error: "deal_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let q = admin
      .from("contract_documents")
      .select("id, filename, doc_type, version, text_content")
      .eq("deal_id", deal_id)
      .eq("is_current", true);
    if (Array.isArray(document_ids) && document_ids.length > 0) q = q.in("id", document_ids);

    const { data: docs } = await q;
    const usable = (docs || []).filter((d: any) => (d.text_content || "").length > 200);
    if (usable.length === 0) {
      return json({ success: true, created: 0, message: "No readable current documents to analyse." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const created: any[] = [];
    const truncatedDocs: string[] = [];

    for (const doc of usable) {
      const fullText = doc.text_content || "";
      // Consent and notice provisions can sit anywhere in an agreement, so
      // cover the whole document with overlapping windows rather than reading
      // only the first 25k characters as this used to.
      const chunks = chunkSequential(fullText);
      if (wasTruncated(fullText, chunks)) truncatedDocs.push(doc.filename);
      const seenInDoc = new Set<string>();

      for (const chunk of chunks) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You review commercial contracts for provisions that an M&A transaction would trigger: " +
                "change of control, assignment, merger or reorganisation, transfer, notice obligations, " +
                "and termination rights the transaction sets off. " +
                "Distinguish carefully between a CONSENT requirement (the counterparty must agree) and a " +
                "NOTICE requirement (they must merely be told). Where the language is genuinely ambiguous, " +
                "or where it is unclear whether this transaction structure triggers it, return 'unclear' — " +
                "that is a valid and useful answer, and far better than guessing either way. " +
                "Always quote the operative language verbatim in clause_text. " +
                "You are assisting a lawyer, not making a legal determination.",
            },
            {
              role: "user",
              content: `Contract: ${doc.filename} (${doc.doc_type}, version ${doc.version})` +
                       (chunk.total > 1 ? `\nSection: ${chunk.label} (${chunk.index + 1} of ${chunk.total})` : "") +
                       `\n\n${chunk.text}`,
            },
          ],
          tools: [{ type: "function", function: { name: "emit_consents", description: "Consent/notice findings", parameters: CONSENT_SCHEMA } }],
          tool_choice: { type: "function", function: { name: "emit_consents" } },
        }),
      });

      if (!aiRes.ok) continue;
      const payload = await aiRes.json();
      const call = payload.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) continue;
      const findings = JSON.parse(call.function.arguments).findings || [];

      for (const f of findings) {
        if (Number(f.confidence) < THRESHOLDS.consentConfidenceFloor) continue;

        // Overlapping windows can surface the same clause twice.
        const dedupeKey = [f.counterparty, f.clause_reference, f.trigger_event]
          .map((v: string) => String(v || "").toLowerCase().trim()).join("::");
        if (seenInDoc.has(dedupeKey)) continue;
        seenInDoc.add(dedupeKey);

        const kind = f.requirement_type === "notice" ? "notice" : "consent";
        const trigger = String(f.trigger_event || "other").replace(/_/g, " ");
        const label = f.requirement_type === "unclear"
          ? "Possible consent"
          : f.requirement_type === "notice" ? "Notice" : "Consent";

        created.push({
          deal_id,
          requirement_kind: kind,
          title: `${label} — ${f.counterparty}${f.contract_name ? ` (${f.contract_name})` : ""}`,
          description: [
            f.consequence_if_missed ? `If missed: ${f.consequence_if_missed}` : "",
            f.deadline_description || "",
          ].filter(Boolean).join(" ") || null,
          category: "consents",
          counterparty_name: f.counterparty || null,
          counterparty_email: /@/.test(f.counterparty_contact || "") ? f.counterparty_contact : null,
          trigger_event: trigger,
          requirement_type: f.requirement_type,
          // An 'unclear' finding must not gate a closing until a lawyer has
          // classified it; blocks_closing is set on review, not on extraction.
          blocks_closing: f.requirement_type === "consent" && f.ambiguity !== "high",
          priority: f.requirement_type === "consent" ? "high" : "normal",
          due_date: Number(f.deadline_days) > 0
            ? new Date(Date.now() + Number(f.deadline_days) * 864e5).toISOString().slice(0, 10)
            : null,
          source: "ai",
          source_ref: {
            document_id: doc.id,
            document_version: doc.version,
            filename: doc.filename,
            clause_ref: f.clause_reference || null,
            snippet: (f.clause_text || "").slice(0, 800),
            reasoning: (f.reasoning || "").slice(0, 400),
          },
          ai_confidence: Number(f.confidence) || null,
          ai_ambiguity: f.requirement_type === "unclear" ? "high" : (f.ambiguity || "medium"),
          review_status: "pending_review",
          status: "not_started",
        });
      }
      }
    }

    if (created.length === 0) {
      return json({ success: true, created: 0, message: "No consent or notice provisions identified." });
    }

    const { data: inserted, error } = await admin
      .from("deal_requirements").insert(created)
      .select("id, title, requirement_type, trigger_event, ai_ambiguity");
    if (error) return json({ error: error.message }, 500);

    const unclear = (inserted || []).filter((r: any) => r.requirement_type === "unclear").length;

    await admin.from("audit_log").insert({
      deal_id,
      action: "consents_extracted",
      details: {
        documents_analysed: usable.length,
        findings: inserted?.length || 0,
        unclear,
      },
    });

    return json({
      success: true,
      created: inserted?.length || 0,
      documents_analysed: usable.length,
      unclear_requiring_classification: unclear,
      rows: inserted,
      partially_read: truncatedDocs,
      note: truncatedDocs.length
        ? `Findings are proposed interpretations; none will contact a counterparty until approved. NOTE: ${truncatedDocs.length} document(s) were too long to read in full (${truncatedDocs.join(", ")}) — some provisions may be missing.`
        : "Findings are proposed interpretations. None will contact a counterparty until reviewed and approved.",
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
