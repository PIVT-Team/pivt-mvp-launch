// Conditions Precedent at-risk flagger.
// Calls the Lovable AI gateway to evaluate open CPs and mark those that are at risk
// (overdue, no owner, no evidence, blocked by upstream items, etc.).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an M&A closing risk analyst. Given a list of Conditions Precedent (CPs) for a deal, identify which ones are at risk of slipping the closing date and explain briefly why.
Risk signals: overdue or due within 5 days with no evidence; no owner; status still 'pending' close to closing; regulatory CPs without filings.
Return ONLY a JSON object: {"items": [{"id": "<cp_id>", "at_risk": true, "reason": "<short reason, max 140 chars>"}]}.
Only include items that ARE at risk. If none are at risk, return {"items": []}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: deal } = await supabase
      .from("deals")
      .select("id, deal_name, closing_date")
      .eq("id", deal_id)
      .maybeSingle();

    const { data: conditions, error: cErr } = await supabase
      .from("conditions")
      .select("id, title, description, status, due_date, owner_name, evidence_document_id, evidence_note")
      .eq("deal_id", deal_id);

    if (cErr) throw cErr;
    if (!conditions || conditions.length === 0) {
      return new Response(JSON.stringify({ flagged: 0, items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Deal: ${deal?.deal_name ?? deal_id}
Closing date: ${deal?.closing_date ?? "unknown"}
Today: ${new Date().toISOString().slice(0, 10)}

Conditions Precedent:
${JSON.stringify(conditions, null, 2)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }), {
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
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: Array<{ id: string; at_risk: boolean; reason: string }> } = {};
    try { parsed = JSON.parse(content); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Reset all to not-at-risk first, then apply flagged ones (idempotent run).
    await supabase
      .from("conditions")
      .update({ at_risk: false, at_risk_reason: null })
      .eq("deal_id", deal_id);

    let flagged = 0;
    for (const item of items) {
      if (!item?.id || !item.at_risk) continue;
      const { error: upErr } = await supabase
        .from("conditions")
        .update({ at_risk: true, at_risk_reason: item.reason?.slice(0, 240) ?? "Flagged by AI" })
        .eq("id", item.id)
        .eq("deal_id", deal_id);
      if (!upErr) flagged += 1;
    }

    return new Response(JSON.stringify({ flagged, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("flag-cp-at-risk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
