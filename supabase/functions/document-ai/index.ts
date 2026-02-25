import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLASSIFICATION_PROMPT = `You are a document classification and extraction engine for M&A transactions.

Given the filename and text content of a document, you must:
1. Classify it into one of these types: spa, cap_table, waterfall, wire_instructions, kyc, board_consent, employment_agreement, financial_statements, escrow_agreement, disclosure_schedules, other
2. Assign a confidence score (0-1)
3. Extract key structured fields based on the document type
4. Identify validation flags (issues, missing fields, discrepancies)

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
      // Classify + extract from a single document
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: CLASSIFICATION_PROMPT },
            { role: "user", content: `Filename: ${fileName}\n\nDocument text (first 4000 chars):\n${(textContent || '').slice(0, 4000)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract classification, fields, and flags from document",
              parameters: {
                type: "object",
                properties: {
                  doc_type: { type: "string", enum: ["spa", "cap_table", "waterfall", "wire_instructions", "kyc", "board_consent", "employment_agreement", "financial_statements", "escrow_agreement", "disclosure_schedules", "other"] },
                  confidence: { type: "number", description: "Classification confidence 0-1" },
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
      let result = { doc_type: "other", confidence: 0.5, extracted_fields: {}, validation_flags: [], summary: "Unable to classify", page_count_estimate: 1 };

      if (toolCall?.function?.arguments) {
        try {
          result = JSON.parse(toolCall.function.arguments);
        } catch { /* use defaults */ }
      }

      // Update document in DB
      if (documentId) {
        await adminClient.from("deal_documents").update({
          doc_type: result.doc_type,
          doc_type_confidence: result.confidence,
          extracted_fields: result.extracted_fields,
          validation_flags: result.validation_flags,
          extracted_text: textContent?.slice(0, 10000) || null,
          page_count: result.page_count_estimate || 1,
          status: "processed",
        }).eq("id", documentId);
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
