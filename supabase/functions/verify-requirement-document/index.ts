import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Does the document that arrived satisfy the requirement that was asked for?
 *
 * Compares the stated requirement against the submitted document and returns a
 * structured verdict — never a decision. The verdict is advisory: a person can
 * override it either way, and `apply_requirement_evidence` treats a human
 * decision as final.
 *
 * Three outcomes, deliberately:
 *   verified         high confidence it matches — auto-satisfies the requirement
 *   review_required  might match, but something needs a human eye
 *   rejected         clearly does not satisfy what was asked
 *
 * The bar for `verified` is high on purpose. A false "verified" closes a
 * requirement and stops the chasing, so the deal team stops looking for a
 * document they never actually received. A false "review_required" costs
 * somebody thirty seconds.
 */

interface Issue { code: string; severity: "high" | "medium" | "low"; message: string }

const VERIFY_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["verified", "review_required", "rejected"] },
    confidence: { type: "number", description: "0-1" },
    document_type: { type: "string", description: "what the document actually appears to be" },
    entity_name: { type: "string", description: "entity the document relates to, verbatim" },
    jurisdiction: { type: "string" },
    identifier: { type: "string", description: "licence/policy/registration number if present" },
    issuer: { type: "string" },
    issue_date: { type: "string" },
    expiry_date: { type: "string", description: "ISO date, empty if none" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          message: { type: "string" },
        },
        required: ["code", "severity", "message"],
      },
    },
    reasoning: { type: "string" },
  },
  required: ["verdict", "confidence", "issues", "reasoning"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireJwt(req, corsHeaders);
    const { evidence_id } = await req.json();
    if (!evidence_id) {
      return json({ error: "evidence_id required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: evidence } = await admin
      .from("requirement_evidence").select("*").eq("id", evidence_id).maybeSingle();
    if (!evidence) return json({ error: "evidence not found" }, 404);

    const { data: req_row } = await admin
      .from("deal_requirements").select("*").eq("id", evidence.requirement_id).maybeSingle();
    if (!req_row) return json({ error: "requirement not found" }, 404);

    // Pull whatever text we have for the document.
    let docText = "";
    if (evidence.document_id) {
      const { data: doc } = await admin
        .from("contract_documents").select("text_content, filename").eq("id", evidence.document_id).maybeSingle();
      docText = (doc?.text_content || "").slice(0, 20000);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // No text and no model — we cannot judge, so say so rather than guessing.
    if (!docText || !LOVABLE_API_KEY) {
      const reason = !docText
        ? "The document could not be read as text (it may be a scan needing OCR)."
        : "Document verification is not configured.";
      return await persist(admin, evidence, {
        verdict: "review_required",
        confidence: 0,
        issues: [{ code: "not_analysable", severity: "medium", message: reason }],
        reasoning: reason,
      });
    }

    const expectations = [
      `Requirement: ${req_row.title}`,
      req_row.description ? `Detail: ${req_row.description}` : "",
      req_row.counterparty_name ? `Expected to come from: ${req_row.counterparty_name}` : "",
      req_row.due_date ? `Due: ${req_row.due_date}` : "",
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You verify whether a submitted document satisfies a stated requirement in an M&A closing. " +
              "Check: is it the right TYPE of document; does the ENTITY NAME match; is the JURISDICTION right; " +
              "has it EXPIRED; is an identifier present; is it complete and legible. " +
              "Return 'verified' ONLY when every check passes and you are confident. " +
              "If the entity name differs in any way that could indicate a different legal entity " +
              "(for example 'Holdings LLC' versus 'Inc'), that is at most 'review_required', never 'verified'. " +
              "Today's date is " + new Date().toISOString().slice(0, 10) + ". " +
              "You are assisting a lawyer; you are not making a legal determination.",
          },
          {
            role: "user",
            content: `WHAT WAS REQUESTED\n${expectations}\n\nWHAT WAS SUBMITTED (${evidence.filename || "document"})\n---\n${docText}`,
          },
        ],
        tools: [{ type: "function", function: { name: "emit_verdict", description: "Verification result", parameters: VERIFY_SCHEMA } }],
        tool_choice: { type: "function", function: { name: "emit_verdict" } },
      }),
    });

    if (!aiRes.ok) {
      const reason = `Verification model returned ${aiRes.status}.`;
      return await persist(admin, evidence, {
        verdict: "review_required", confidence: 0,
        issues: [{ code: "model_error", severity: "medium", message: reason }],
        reasoning: reason,
      });
    }

    const payload = await aiRes.json();
    const call = payload.choices?.[0]?.message?.tool_calls?.[0];
    const result = call ? JSON.parse(call.function.arguments) : null;
    if (!result) {
      return await persist(admin, evidence, {
        verdict: "review_required", confidence: 0,
        issues: [{ code: "no_result", severity: "medium", message: "The model returned no structured verdict." }],
        reasoning: "No structured output.",
      });
    }

    // ── Deterministic overrides. The model does not get the last word on
    //    anything a date comparison or string check can settle. ──
    const issues: Issue[] = Array.isArray(result.issues) ? result.issues : [];
    let verdict = result.verdict as string;

    if (result.expiry_date) {
      const exp = new Date(result.expiry_date);
      if (!isNaN(exp.getTime()) && exp < new Date()) {
        verdict = "rejected";
        issues.push({
          code: "expired", severity: "high",
          message: `Document expired on ${result.expiry_date}.`,
        });
      }
    }

    // A high-severity issue and "verified" are contradictory.
    if (verdict === "verified" && issues.some((i) => i.severity === "high")) {
      verdict = "review_required";
    }
    // Never auto-satisfy on a low-confidence match.
    if (verdict === "verified" && Number(result.confidence) < 0.8) {
      verdict = "review_required";
      issues.push({
        code: "low_confidence", severity: "medium",
        message: `Confidence ${Math.round(Number(result.confidence) * 100)}% is below the threshold for automatic acceptance.`,
      });
    }

    return await persist(admin, evidence, {
      verdict, confidence: Number(result.confidence) || 0, issues,
      reasoning: result.reasoning || "",
      details: {
        document_type: result.document_type, entity_name: result.entity_name,
        jurisdiction: result.jurisdiction, identifier: result.identifier,
        issuer: result.issuer, issue_date: result.issue_date, expiry_date: result.expiry_date,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function persist(admin: any, evidence: any, r: {
  verdict: string; confidence: number; issues: Issue[]; reasoning: string;
  details?: Record<string, unknown>;
}) {
  // Writing the verdict fires apply_requirement_evidence, which satisfies the
  // requirement and stops reminders when the verdict is 'verified'.
  await admin.from("requirement_evidence").update({
    verification_verdict: r.verdict,
    verification_confidence: r.confidence,
    verification_issues: r.issues,
    verification_details: { ...(r.details || {}), reasoning: r.reasoning },
    verified_at: new Date().toISOString(),
  }).eq("id", evidence.id);

  await admin.from("audit_log").insert({
    deal_id: evidence.deal_id,
    action: "requirement_document_verified",
    details: {
      evidence_id: evidence.id, requirement_id: evidence.requirement_id,
      verdict: r.verdict, confidence: r.confidence, issue_count: r.issues.length,
    },
  });

  return json({ success: true, verdict: r.verdict, confidence: r.confidence, issues: r.issues, details: r.details });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
