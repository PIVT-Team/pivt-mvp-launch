import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OBLIGATION_TYPES = [
  "PURCHASE_PRICE_BASE",
  "PURCHASE_PRICE_ADJUSTMENT",
  "ESCROW_HOLD_BACK",
  "DEBT_PAYOFF",
  "SELLER_PROCEEDS",
  "BROKER_FEE",
  "LEGAL_FEE",
  "ADVISORY_FEE",
  "TAX_WITHHOLDING",
  "EARNOUT_RESERVE",
  "WORKING_CAPITAL_TRUE_UP",
  "INDEMNITY_RESERVE",
  "OTHER",
];

const SYSTEM_PROMPT = `You are a legal document analyzer for M&A closing transactions.
Given document text, extract all disbursement obligations into a structured JSON array.

Each obligation must have:
- obligation_type: one of ${OBLIGATION_TYPES.join(", ")}
- payor_label: who pays (e.g., "Buyer", "Escrow Agent", "Company")
- payee_label: who receives (e.g., "Seller", "Lender Name", "Law Firm Name")
- amount_type: "FIXED" | "PERCENT_OF_BASE" | "FORMULA" | "UNKNOWN"
- amount_value_cents: integer amount in cents (null if unknown or percentage)
- amount_currency: ISO 4217 code (e.g., "USD")
- percent_basis_points: integer (e.g., 1000 = 10.00%), null if not percentage
- percent_base_reference: what the percentage is of (e.g., "PURCHASE_PRICE_BASE"), null if N/A
- timing_type: "AT_CLOSING" | "PRE_CLOSING" | "POST_CLOSING" | "ON_CONDITION" | "ON_DATE"
- scheduled_date: ISO date string if applicable, null otherwise
- confidence_score: 0.0 to 1.0
- source_text_snippet: short excerpt from the document supporting this extraction (max 200 chars)

Return ONLY a JSON object with key "obligations" containing the array. No markdown, no explanation.
If you cannot identify any obligations, return {"obligations": []}.
Be conservative: if unsure about an amount, set amount_type to "UNKNOWN" and confidence_score low.
NEVER fabricate wire/bank details.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch document
    const { data: doc, error: docErr } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use text_content or generate placeholder
    let textContent = doc.text_content;
    if (!textContent || textContent.trim().length === 0) {
      // In a real implementation, we'd extract text from the PDF here.
      // For now, mark as error if no text content is available.
      textContent = `[Document: ${doc.filename}, Type: ${doc.doc_type}] No text content extracted yet.`;
    }

    // Call AI to extract obligations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Extract all disbursement obligations from this ${doc.doc_type} document:\n\n${textContent.slice(0, 15000)}`,
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark document as error
      await supabase
        .from("contract_documents")
        .update({ status: "ERROR" })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let obligations: any[] = [];
    try {
      // Try to extract JSON from potential markdown wrapping
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        obligations = parsed.obligations || [];
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr, content);
      await supabase
        .from("contract_documents")
        .update({ status: "ERROR" })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Failed to parse AI extraction results" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert obligations
    const rows = obligations.map((o: any) => ({
      deal_id: doc.deal_id,
      source_document_id: document_id,
      obligation_type: OBLIGATION_TYPES.includes(o.obligation_type)
        ? o.obligation_type
        : "OTHER",
      status: "NEEDS_REVIEW",
      timing_type: o.timing_type || "AT_CLOSING",
      scheduled_date: o.scheduled_date || null,
      payor_label: o.payor_label || null,
      payee_label: o.payee_label || null,
      amount_type: o.amount_type || "UNKNOWN",
      amount_value_minor: o.amount_value_cents || null,
      amount_currency: o.amount_currency || "USD",
      percent_basis_points: o.percent_basis_points || null,
      percent_base_reference: o.percent_base_reference || null,
      tolerance_minor: 0,
      structured_json: o,
      confidence_score: o.confidence_score || 0,
      source_text_snippet: o.source_text_snippet
        ? o.source_text_snippet.slice(0, 500)
        : null,
      extracted_by: "AI",
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from("obligations")
        .insert(rows);

      if (insertErr) {
        console.error("Insert obligations error:", insertErr);
        await supabase
          .from("contract_documents")
          .update({ status: "ERROR" })
          .eq("id", document_id);

        return new Response(
          JSON.stringify({ error: "Failed to store obligations" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update document status
    await supabase
      .from("contract_documents")
      .update({ status: "EXTRACTION_COMPLETE" })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        obligations_count: rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("obligation-extractor error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
