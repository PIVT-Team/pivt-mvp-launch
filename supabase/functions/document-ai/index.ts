import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Deterministic keyword-based document classifier ──
// Runs BEFORE AI classification for speed; AI refines after
const DOC_TYPE_KEYWORDS: Record<string, { keywords: string[]; priority: number }> = {
  SPA: { keywords: ["share purchase agreement", "stock purchase agreement", "acquisition agreement", "merger agreement", "asset purchase agreement"], priority: 10 },
  DISCLOSURE_SCHEDULES: { keywords: ["disclosure schedule", "disclosure letter", "seller disclosure"], priority: 9 },
  ESCROW_AGREEMENT: { keywords: ["escrow agreement", "escrow instructions", "escrow arrangement"], priority: 9 },
  FUNDS_FLOW: { keywords: ["funds flow", "fund flow", "sources and uses", "closing statement"], priority: 9 },
  WIRE_AUTHORIZATION: { keywords: ["wire authorization", "wire transfer authorization", "wire approval"], priority: 8 },
  WIRE_INSTRUCTIONS: { keywords: ["wire instructions", "wiring instructions", "bank wire", "wire transfer instructions"], priority: 8 },
  BOARD_CONSENT: { keywords: ["board consent", "board resolution", "unanimous written consent", "board approval"], priority: 8 },
  SECRETARY_CERTIFICATE: { keywords: ["secretary certificate", "secretary's certificate", "certificate of secretary"], priority: 8 },
  OFFICER_CERTIFICATE: { keywords: ["officer certificate", "officer's certificate", "certificate of officer", "closing certificate"], priority: 8 },
  BRING_DOWN_CERTIFICATE: { keywords: ["bring-down", "bring down certificate", "bringdown"], priority: 7 },
  CAP_TABLE: { keywords: ["cap table", "capitalization table", "capitalization", "share register", "stockholder"], priority: 8 },
  WORKING_CAPITAL_STATEMENT: { keywords: ["working capital", "net working capital", "wc statement", "wc adjustment"], priority: 7 },
  LEGAL_OPINION: { keywords: ["legal opinion", "opinion letter", "counsel opinion", "opinion of counsel"], priority: 7 },
  EMPLOYMENT_AGREEMENT: { keywords: ["employment agreement", "employment contract", "offer letter", "executive employment"], priority: 6 },
  IP_ASSIGNMENT: { keywords: ["ip assignment", "intellectual property assignment", "patent assignment", "technology assignment"], priority: 6 },
  NON_COMPETE: { keywords: ["non-compete", "noncompete", "non-competition", "restrictive covenant"], priority: 6 },
  TSA: { keywords: ["transition services", "tsa", "transition agreement"], priority: 6 },
  THIRD_PARTY_CONSENT: { keywords: ["third party consent", "third-party consent", "consent letter", "landlord consent"], priority: 5 },
  PAYOFF_LETTER: { keywords: ["payoff letter", "payoff statement", "pay-off", "debt payoff"], priority: 7 },
  W9: { keywords: ["w-9", "w9", "request for taxpayer", "tin certification"], priority: 6 },
  GOOD_STANDING: { keywords: ["good standing", "certificate of existence", "certificate of status"], priority: 5 },
  FEE_LETTER: { keywords: ["fee letter", "fee agreement", "engagement letter"], priority: 5 },
};

// ── Extraction schemas per document type ──
const EXTRACTION_SCHEMAS: Record<string, object> = {
  SPA: {
    type: "object",
    properties: {
      buyer_name: { type: "string", description: "Name of the buyer/acquirer entity" },
      seller_name: { type: "string", description: "Name of the seller entity" },
      target_name: { type: "string", description: "Name of the target company being acquired" },
      purchase_price: { type: "number", description: "Total purchase price in dollars" },
      closing_date: { type: "string", description: "Expected or stated closing date (YYYY-MM-DD)" },
      escrow_amount: { type: "number", description: "Escrow holdback amount if referenced" },
      governing_law: { type: "string", description: "Governing law jurisdiction" },
      indemnification_cap: { type: "number", description: "Cap on indemnification if stated" },
      basket_amount: { type: "number", description: "Deductible/basket amount if stated" },
    },
    required: ["buyer_name", "seller_name", "purchase_price"],
  },
  FUNDS_FLOW: {
    type: "object",
    properties: {
      total_sources: { type: "number", description: "Sum of all funding sources" },
      total_uses: { type: "number", description: "Sum of all uses/disbursements" },
      escrow_amount: { type: "number", description: "Amount going to escrow" },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recipient_name: { type: "string" },
            amount: { type: "number" },
            item_type: { type: "string", enum: ["seller_proceeds", "escrow", "payoff", "fees", "tax_withholding", "other"] },
          },
        },
        description: "Individual line items in the funds flow",
      },
    },
    required: ["total_sources", "total_uses"],
  },
  ESCROW_AGREEMENT: {
    type: "object",
    properties: {
      escrow_amount: { type: "number", description: "Total escrow deposit amount" },
      escrow_agent: { type: "string", description: "Name of the escrow agent/institution" },
      release_conditions: { type: "string", description: "Summary of release conditions" },
      escrow_term_months: { type: "number", description: "Duration of escrow hold in months" },
      interest_treatment: { type: "string", description: "How interest on escrow is handled" },
    },
    required: ["escrow_amount", "escrow_agent"],
  },
  CAP_TABLE: {
    type: "object",
    properties: {
      fully_diluted_shares: { type: "number", description: "Total fully diluted share count" },
      major_holders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            shares: { type: "number" },
            percentage: { type: "number" },
          },
        },
        description: "Major shareholders with >1% ownership",
      },
    },
  },
  WORKING_CAPITAL_STATEMENT: {
    type: "object",
    properties: {
      estimated_wc: { type: "number", description: "Estimated working capital at closing" },
      target_wc: { type: "number", description: "Target/peg working capital amount" },
      true_up_timeline_days: { type: "number", description: "Days after closing for true-up" },
      adjustment_mechanism: { type: "string", description: "How WC adjustment is calculated" },
    },
  },
};

function classifyByKeywords(filename: string, textContent: string): { doc_type: string; confidence: number } | null {
  const combined = `${filename} ${(textContent || "").slice(0, 3000)}`.toLowerCase();
  let bestMatch: { doc_type: string; confidence: number; priority: number } | null = null;

  for (const [docType, { keywords, priority }] of Object.entries(DOC_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        const confidence = 0.7 + (priority / 50); // 0.8-0.9 range
        if (!bestMatch || priority > bestMatch.priority) {
          bestMatch = { doc_type: docType, confidence: Math.min(confidence, 0.95), priority };
        }
        break;
      }
    }
  }
  return bestMatch ? { doc_type: bestMatch.doc_type, confidence: bestMatch.confidence } : null;
}

// ── AI Classification Prompt (extended for binder) ──
const CLASSIFICATION_PROMPT = `You are a document classification and extraction engine for M&A transactions and closing binders.

Given the filename and text content of a document, you must:
1. Classify it into one of these types: SPA, DISCLOSURE_SCHEDULES, ESCROW_AGREEMENT, FUNDS_FLOW, WIRE_AUTHORIZATION, WIRE_INSTRUCTIONS, BOARD_CONSENT, SECRETARY_CERTIFICATE, OFFICER_CERTIFICATE, BRING_DOWN_CERTIFICATE, CAP_TABLE, WORKING_CAPITAL_STATEMENT, LEGAL_OPINION, EMPLOYMENT_AGREEMENT, IP_ASSIGNMENT, NON_COMPETE, TSA, THIRD_PARTY_CONSENT, PAYOFF_LETTER, W9, GOOD_STANDING, FEE_LETTER, OTHER
2. Assign a confidence score (0-1)
3. Extract key structured fields based on the document type
4. Identify validation flags (issues, missing fields, discrepancies)
5. Determine the document role: buyer_side, seller_side, or mutual

For SPAs: Extract buyer_name, seller_name, target_name, purchase_price, closing_date, escrow_amount, governing_law
For Funds Flow: Extract total_sources, total_uses, escrow_amount, line_items (recipient_name, amount, item_type)
For Escrow: Extract escrow_amount, escrow_agent, release_conditions
For Cap Tables: Extract fully_diluted_shares, major_holders
For Working Capital: Extract estimated_wc, target_wc, true_up_timeline_days
For Certificates: Extract certifying_entity, date, covers_agreement

Respond using the extract_document_data tool.`;

const QA_PROMPT = `You are Newton, PIVT's Document Intelligence Engine. You answer questions about deal documents.

You have access to extracted document data. When answering:
- Cite the source document name
- Reference specific extracted fields
- Be precise with financial figures
- Flag any discrepancies you notice
- If information is not in the documents, say so clearly

Available document data is provided in the context.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, documentId, fileName, textContent, question, dealId, documents } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "classify") {
      // Step 1: Fast deterministic classification
      const keywordResult = classifyByKeywords(fileName || "", textContent || "");

      // Step 2: AI-powered classification + extraction
      // Build extraction schema hint based on keyword classification
      const hintType = keywordResult?.doc_type || "OTHER";
      const extractionSchema = EXTRACTION_SCHEMAS[hintType];
      const schemaHint = extractionSchema
        ? `\n\nExpected document type: ${hintType}. Extract these fields: ${JSON.stringify(extractionSchema)}`
        : "";

      const allDocTypes = Object.keys(DOC_TYPE_KEYWORDS).concat(["OTHER"]);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: CLASSIFICATION_PROMPT + schemaHint },
            { role: "user", content: `Filename: ${fileName}\n\nDocument text (first 5000 chars):\n${(textContent || '').slice(0, 5000)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract classification, fields, and flags from document",
              parameters: {
                type: "object",
                properties: {
                  doc_type: { type: "string", enum: allDocTypes },
                  confidence: { type: "number", description: "Classification confidence 0-1" },
                  document_role: { type: "string", enum: ["buyer_side", "seller_side", "mutual"] },
                  extracted_fields: {
                    type: "object",
                    description: "Key-value pairs of extracted fields relevant to the document type",
                    additionalProperties: true,
                  },
                  validation_flags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["info", "warning", "critical"] },
                        field: { type: "string" },
                        message: { type: "string" },
                      },
                      required: ["severity", "field", "message"],
                    },
                  },
                  requirement_group: { type: "string", enum: ["Core Closing", "Ancillary", "IP & Employment", "Tax", "Compliance", "Financial", "Approvals", "Other"] },
                  page_count_estimate: { type: "number" },
                  summary: { type: "string", description: "2-3 sentence summary of the document" },
                },
                required: ["doc_type", "confidence", "extracted_fields", "validation_flags", "summary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_document_data" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const body = await response.text();
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error [${status}]: ${body}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      let result: any = {
        doc_type: keywordResult?.doc_type || "OTHER",
        confidence: keywordResult?.confidence || 0.5,
        document_role: "mutual",
        extracted_fields: {},
        validation_flags: [],
        requirement_group: "Other",
        summary: "Unable to classify",
        page_count_estimate: 1,
      };

      if (toolCall?.function?.arguments) {
        try {
          const aiResult = JSON.parse(toolCall.function.arguments);
          // Merge: prefer AI classification if higher confidence, otherwise use keyword
          if (keywordResult && keywordResult.confidence > (aiResult.confidence || 0)) {
            aiResult.doc_type = keywordResult.doc_type;
            aiResult.confidence = keywordResult.confidence;
          }
          result = { ...result, ...aiResult };
        } catch { /* use keyword/defaults */ }
      }

      // Update deal_documents table
      if (documentId) {
        await adminClient.from("deal_documents").update({
          doc_type: result.doc_type.toLowerCase(),
          doc_type_confidence: result.confidence,
          extracted_fields: result.extracted_fields,
          validation_flags: result.validation_flags,
          extracted_text: textContent?.slice(0, 10000) || null,
          page_count: result.page_count_estimate || 1,
          status: "processed",
        }).eq("id", documentId);
      }

      // Also upsert into contract_documents if deal_id available
      if (dealId && result.doc_type !== "OTHER") {
        await adminClient.from("contract_documents").upsert({
          deal_id: dealId,
          filename: fileName || "unknown",
          doc_type: result.doc_type,
          file_url: null,
          text_content: textContent?.slice(0, 10000) || null,
          status: "PARSED",
          document_role: result.document_role || "mutual",
          extracted_fields: result.extracted_fields || {},
          extraction_confidence: result.confidence || 0,
          requirement_group: result.requirement_group || "Other",
        }, { onConflict: "id" });
      }

      // Trigger workflow orchestrator after classification (non-blocking)
      // This populates wire_instructions, payment_allocations, runs discrepancy engine
      if (dealId) {
        adminClient.functions.invoke("deal-workflow-orchestrator", {
          body: {
            deal_id: dealId,
            document_id: documentId,
            doc_type: result.doc_type,
            extracted_fields: result.extracted_fields,
            action: "process_document",
          },
        }).catch((err: any) => console.error("Orchestrator trigger failed:", err));
      }

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "qa") {
      // Q&A over documents - streaming
      const docsContext = (documents || []).map((d: any) =>
        `Document: ${d.file_name} (Type: ${d.doc_type})\nExtracted Fields: ${JSON.stringify(d.extracted_fields)}\nFlags: ${JSON.stringify(d.validation_flags)}\nText Preview: ${(d.extracted_text || '').slice(0, 2000)}`
      ).join("\n\n---\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `${QA_PROMPT}\n\n## DOCUMENT CONTEXT\n${docsContext}` },
            { role: "user", content: question },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error [${status}]`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("document-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
