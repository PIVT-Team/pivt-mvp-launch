import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Gather platform metrics
    const [
      dealsRes,
      profilesRes,
      docsRes,
      capTableRes,
      approvalsRes,
      supportRes,
      agentRunsRes,
      discrepanciesRes,
    ] = await Promise.all([
      db.from("deals").select("id, deal_state, visibility, created_at", { count: "exact" }),
      db.from("profiles").select("id", { count: "exact" }),
      db.from("contract_documents").select("id", { count: "exact" }),
      db.from("cap_table_entries").select("deal_id", { count: "exact" }),
      db.from("deal_approvals").select("id, status", { count: "exact" }),
      db.from("contact_submissions").select("id, status, category, created_at").order("created_at", { ascending: false }).limit(50),
      db.from("agent_runs").select("id, status, agent_type, error_message, duration_ms").order("created_at", { ascending: false }).limit(100),
      db.from("discrepancies").select("id, severity, status, rule_key"),
    ]);

    const deals = dealsRes.data ?? [];
    const userDeals = deals.filter(d => d.visibility !== 'global_demo');
    const approvals = approvalsRes.data ?? [];
    const support = supportRes.data ?? [];
    const agentRuns = agentRunsRes.data ?? [];
    const discrepancies = discrepanciesRes.data ?? [];

    // Compute metrics
    const totalDeals = userDeals.length;
    const activeDeals = userDeals.filter(d => !['settled', 'archived'].includes(d.deal_state)).length;
    const completedDeals = userDeals.filter(d => d.deal_state === 'settled').length;
    const totalUsers = profilesRes.count ?? 0;
    const totalDocs = docsRes.count ?? 0;
    const totalStakeholders = capTableRes.count ?? 0;
    const openTickets = support.filter(s => s.status === 'new' || s.status === 'in_progress').length;
    const completedRuns = agentRuns.filter(r => r.status === 'completed').length;
    const failedRuns = agentRuns.filter(r => r.status === 'failed').length;
    const successRate = agentRuns.length > 0 ? Math.round((completedRuns / agentRuns.length) * 100) : 0;
    const openDiscrepancies = discrepancies.filter(d => d.status === 'open').length;
    const blockerDiscrepancies = discrepancies.filter(d => d.severity === 'blocker' && d.status === 'open').length;
    const pendingApprovals = approvals.filter(a => a.status === 'pending').length;

    // Support category breakdown
    const supportCategories = support.reduce<Record<string, number>>((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    }, {});
    const topSupportCategory = Object.entries(supportCategories).sort((a, b) => b[1] - a[1])[0];

    // Agent failure reasons
    const failureReasons = agentRuns
      .filter(r => r.status === 'failed' && r.error_message)
      .map(r => r.error_message);

    // Build context for AI
    const contextSummary = `
PIVT Platform Metrics Summary:
- Total Deals: ${totalDeals} (Active: ${activeDeals}, Completed: ${completedDeals})
- Total Users: ${totalUsers}
- Documents Uploaded: ${totalDocs}
- Stakeholders Added: ${totalStakeholders}
- Open Support Tickets: ${openTickets} out of ${support.length} total
- Top Support Category: ${topSupportCategory ? `${topSupportCategory[0]} (${topSupportCategory[1]} tickets)` : 'N/A'}
- Newton/AI Runs: ${agentRuns.length} (Success Rate: ${successRate}%, Failed: ${failedRuns})
- Open Discrepancies: ${openDiscrepancies} (Blockers: ${blockerDiscrepancies})
- Pending Approvals: ${pendingApprovals}
- Agent Failure Reasons: ${failureReasons.slice(0, 5).join('; ') || 'None'}
    `.trim();

    const prompt = `You are an AI operations analyst for PIVT, an M&A deal execution platform.
Based on the following platform metrics, generate 3-5 concise, actionable daily insights.

${contextSummary}

For each insight, provide a JSON object with these fields:
- title: A concise insight headline (max 80 chars)
- body: Brief explanation of why this matters (max 200 chars)
- suggested_action: A specific, actionable recommendation (max 150 chars)
- severity: One of "critical", "important", or "opportunity"
- category: One of "support", "deals", "newton", "risk", "engagement", "general"

IMPORTANT: Only generate insights grounded in the actual data above. If data is insufficient for a particular area, skip it. Do not fabricate metrics or trends.

Return ONLY a JSON array of insight objects. No markdown, no explanation.`;

    let insights: any[] = [];

    if (lovableApiKey) {
      try {
        const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content ?? "";
          // Extract JSON array from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            insights = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiErr) {
        console.error("AI generation failed:", aiErr);
      }
    }

    // Fallback: generate rule-based insights if AI fails
    if (insights.length === 0) {
      if (openTickets > 0) {
        insights.push({
          title: `${openTickets} open support tickets awaiting response`,
          body: "Unresolved support tickets may impact user satisfaction and retention.",
          suggested_action: "Review and triage open support tickets, prioritizing urgent items.",
          severity: openTickets > 5 ? "critical" : "important",
          category: "support",
        });
      }
      if (failedRuns > 0) {
        insights.push({
          title: `${failedRuns} Newton agent runs failed recently`,
          body: `AI success rate is ${successRate}%. Failed runs reduce user trust in automation.`,
          suggested_action: "Review failed agent runs to identify common failure patterns.",
          severity: successRate < 70 ? "critical" : "important",
          category: "newton",
        });
      }
      if (blockerDiscrepancies > 0) {
        insights.push({
          title: `${blockerDiscrepancies} blocker-level discrepancies unresolved`,
          body: "Blocker discrepancies prevent deals from advancing to execution.",
          suggested_action: "Prioritize resolution of blocker-level discrepancies across active deals.",
          severity: "critical",
          category: "risk",
        });
      }
      if (totalDeals > 0 && completedDeals === 0) {
        insights.push({
          title: "No deals have reached settled status yet",
          body: "Users are creating deals but none have completed the full workflow.",
          suggested_action: "Investigate drop-off points in the deal funnel and provide onboarding guidance.",
          severity: "important",
          category: "deals",
        });
      }
      if (insights.length === 0) {
        insights.push({
          title: "Platform operating normally",
          body: `${totalDeals} deals, ${totalUsers} users, ${successRate}% Newton success rate.`,
          suggested_action: "Continue monitoring. No immediate action required.",
          severity: "opportunity",
          category: "general",
        });
      }
    }

    // Store insights in database
    const insightRows = insights.map((insight: any) => ({
      insight_type: "daily",
      title: String(insight.title ?? "").slice(0, 200),
      body: String(insight.body ?? "").slice(0, 500),
      evidence: contextSummary.slice(0, 1000),
      suggested_action: String(insight.suggested_action ?? "").slice(0, 500),
      severity: ["critical", "important", "opportunity"].includes(insight.severity) ? insight.severity : "opportunity",
      category: insight.category ?? "general",
      confidence: 0.8,
      generated_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await db.from("admin_insights").insert(insightRows);
    if (insertErr) {
      console.error("Failed to store insights:", insertErr);
    }

    return new Response(
      JSON.stringify({ success: true, count: insightRows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin insights error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to generate insights" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
