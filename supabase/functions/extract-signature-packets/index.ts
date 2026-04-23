import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { deal_id, user_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull purchase agreement & related contract docs as the source of signature obligations
    const { data: docs } = await supabase
      .from("contract_documents")
      .select("id, filename, doc_type, text_content, extracted_fields")
      .eq("deal_id", deal_id)
      .in("doc_type", ["purchase_agreement", "merger_agreement", "spa", "apa"]);

    const sourceText = (docs ?? [])
      .map((d) => `### ${d.filename} (${d.doc_type})\n${(d.text_content || "").slice(0, 12000)}`)
      .join("\n\n")
      .slice(0, 30000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an M&A closing specialist. Identify every document in a purchase agreement closing binder that requires a signature (signature packet). Return concise, institutional-quality entries.",
          },
          {
            role: "user",
            content: sourceText
              ? `Extract all signature packets required at closing from these agreements:\n\n${sourceText}`
              : `No purchase agreement uploaded. Return the standard closing signature packet set for an M&A transaction (Merger Agreement, Disclosure Schedules, Escrow Agreement, Officer's Certificate, Secretary's Certificate, FIRPTA, Spousal Consent, Joinder, Resignation Letters, IP Assignment).`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_packets",
            description: "Emit signature packets",
            parameters: {
              type: "object",
              properties: {
                packets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      packet_name: { type: "string" },
                      packet_type: {
                        type: "string",
                        enum: ["agreement", "certificate", "disclosure", "consent", "resolution", "ancillary"],
                      },
                      approver_role: { type: "string" },
                      approver_name: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["packet_name", "packet_type", "approver_role", "confidence"],
                  },
                },
              },
              required: ["packets"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_packets" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI gateway error [${aiRes.status}]: ${t}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { packets: [] };
    const packets: Array<{
      packet_name: string;
      packet_type: string;
      approver_role: string;
      approver_name?: string;
      confidence: number;
    }> = args.packets ?? [];

    if (packets.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, packets: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceDocId = docs?.[0]?.id ?? null;

    const rows = packets.map((p) => ({
      deal_id,
      user_id: user_id ?? null,
      approval_side: "buyer",
      approval_type: p.packet_type,
      approver_role: p.approver_role,
      approver_name: p.approver_name ?? null,
      packet_name: p.packet_name,
      packet_type: p.packet_type,
      source_document_id: sourceDocId,
      ai_generated: true,
      ai_confidence: p.confidence,
      status: "draft",
      required: true,
      delivery_method: "docusign",
    }));

    const { data: inserted, error } = await supabase
      .from("deal_approvals")
      .insert(rows)
      .select();

    if (error) throw error;

    await supabase.from("audit_log").insert({
      deal_id,
      user_id: user_id ?? null,
      action: "signature_packets_generated",
      details: { count: inserted?.length ?? 0, source_documents: docs?.length ?? 0 },
    });

    return new Response(
      JSON.stringify({ inserted: inserted?.length ?? 0, packets: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("extract-signature-packets error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
