import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert M&A closing counsel. Given the text of a Purchase Agreement, produce an actionable Closing Checklist as a JSON array of items.
Each item must include:
- title: short imperative task (max 80 chars)
- description: 1-2 sentence detail (max 240 chars)
- category: one of "Legal" | "Financial" | "Regulatory" | "Technical"
- due_offset_days: integer days from today by which this should be done (use 7 if not stated, 0 if at signing, 30+ for regulatory clearances)
Return ONLY a JSON object with key "items". No markdown. Generate 8-16 items grouped pragmatically across the four categories.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deal_id, document_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve document text. Prefer specified document, otherwise pick the most relevant agreement.
    let docText: string | null = null;
    if (document_id) {
      const { data: doc } = await admin
        .from("contract_documents")
        .select("text_content")
        .eq("id", document_id)
        .maybeSingle();
      docText = doc?.text_content ?? null;
      if (!docText) {
        const { data: dd } = await admin
          .from("deal_documents")
          .select("extracted_text")
          .eq("id", document_id)
          .maybeSingle();
        docText = dd?.extracted_text ?? null;
      }
    }
    if (!docText) {
      const { data: docs } = await admin
        .from("contract_documents")
        .select("text_content, doc_type")
        .eq("deal_id", deal_id)
        .not("text_content", "is", null)
        .limit(3);
      docText = (docs ?? []).map((d) => d.text_content).filter(Boolean).join("\n\n").slice(0, 60000);
    }

    if (!docText || docText.trim().length < 50) {
      // Fall back to a structured generic checklist seed if no document text exists
      docText = "No purchase agreement text available. Use a standard mid-market M&A closing checklist.";
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Purchase Agreement excerpt:\n\n${docText.slice(0, 60000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_checklist",
            description: "Emit the closing checklist items.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string", enum: ["Legal", "Financial", "Regulatory", "Technical"] },
                      due_offset_days: { type: "integer" },
                    },
                    required: ["title", "description", "category", "due_offset_days"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_checklist" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let items: Array<{ title: string; description: string; category: string; due_offset_days: number }> = [];
    try {
      const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
      items = Array.isArray(args.items) ? args.items : [];
    } catch (_) {
      items = [];
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "AI returned no items" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find next sort_order
    const { data: maxRow } = await admin
      .from("closing_checklist_items")
      .select("sort_order")
      .eq("deal_id", deal_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    let nextOrder = (maxRow?.[0]?.sort_order ?? 0) + 1;

    const now = Date.now();
    const rows = items.slice(0, 24).map((it) => ({
      deal_id,
      title: String(it.title).slice(0, 200),
      description: String(it.description ?? "").slice(0, 500),
      category: ["Legal", "Financial", "Regulatory", "Technical"].includes(it.category) ? it.category : "Legal",
      sort_order: nextOrder++,
      source: "ai_generated",
      status: "pending",
      due_date: new Date(now + Math.max(0, Number(it.due_offset_days || 7)) * 86400000).toISOString(),
    }));

    const { data: inserted, error: insertErr } = await admin
      .from("closing_checklist_items")
      .insert(rows)
      .select("*");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ items: inserted, count: inserted?.length ?? 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-checklist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
