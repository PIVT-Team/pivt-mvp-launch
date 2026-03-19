import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlatformMetrics {
  totalDeals: number;
  activeDeals: number;
  completedDeals: number;
  totalUsers: number;
  totalDocs: number;
  totalStakeholders: number;
  openTickets: number;
  totalTickets: number;
  completedRuns: number;
  failedRuns: number;
  totalRuns: number;
  successRate: number;
  openDiscrepancies: number;
  blockerDiscrepancies: number;
  pendingApprovals: number;
  topSupportCategory: string;
  failureReasons: string[];
  newUsersThisWeek: number;
  newUsersLastWeek: number;
  loginCountThisWeek: number;
  loginCountLastWeek: number;
  usersWithDeals: number;
  usersWithDocs: number;
  usersWithNewton: number;
  inactiveUsers7d: number;
}

async function gatherMetrics(db: any): Promise<{ metrics: PlatformMetrics; contextSummary: string }> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [
    dealsRes, profilesRes, docsRes, capTableRes, approvalsRes,
    supportRes, agentRunsRes, discrepanciesRes,
    authThisWeek, authLastWeek, profilesAll
  ] = await Promise.all([
    db.from("deals").select("id, deal_state, visibility, created_at, created_by", { count: "exact" }),
    db.from("profiles").select("id", { count: "exact" }),
    db.from("contract_documents").select("id, uploaded_by", { count: "exact" }),
    db.from("cap_table_entries").select("deal_id", { count: "exact" }),
    db.from("deal_approvals").select("id, status", { count: "exact" }),
    db.from("contact_submissions").select("id, status, category, created_at").order("created_at", { ascending: false }).limit(50),
    db.from("agent_runs").select("id, status, agent_type, error_message, duration_ms, triggered_by").order("created_at", { ascending: false }).limit(100),
    db.from("discrepancies").select("id, severity, status, rule_key"),
    db.from("auth_events").select("id, event_type, user_id").gte("created_at", weekAgo),
    db.from("auth_events").select("id, event_type, user_id").gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
    db.from("profiles").select("user_id, created_at, last_active_at"),
  ]);

  const deals = (dealsRes.data ?? []).filter((d: any) => d.visibility !== "global_demo");
  const support = supportRes.data ?? [];
  const agentRuns = agentRunsRes.data ?? [];
  const discrepancies = discrepanciesRes.data ?? [];
  const profiles = profilesAll.data ?? [];
  const authThisWeekData = authThisWeek.data ?? [];
  const authLastWeekData = authLastWeek.data ?? [];

  const completedRuns = agentRuns.filter((r: any) => r.status === "completed").length;
  const failedRuns = agentRuns.filter((r: any) => r.status === "failed").length;

  const supportCategories = support.reduce<Record<string, number>>((acc, s: any) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});
  const topCat = Object.entries(supportCategories).sort((a, b) => b[1] - a[1])[0];

  const newUsersThisWeek = profiles.filter((p: any) => p.created_at >= weekAgo).length;
  const newUsersLastWeek = profiles.filter((p: any) => p.created_at >= twoWeeksAgo && p.created_at < weekAgo).length;
  const loginsThisWeek = authThisWeekData.filter((e: any) => e.event_type === "user_login").length;
  const loginsLastWeek = authLastWeekData.filter((e: any) => e.event_type === "user_login").length;

  const dealCreators = new Set(deals.map((d: any) => d.created_by).filter(Boolean));
  const docUploaders = new Set((docsRes.data ?? []).map((d: any) => d.uploaded_by).filter(Boolean));
  const newtonUsers = new Set(agentRuns.map((r: any) => r.triggered_by).filter(Boolean));
  const inactiveUsers = profiles.filter((p: any) => {
    if (!p.last_active_at) return true;
    return new Date(p.last_active_at).getTime() < new Date(weekAgo).getTime();
  }).length;

  const metrics: PlatformMetrics = {
    totalDeals: deals.length,
    activeDeals: deals.filter((d: any) => !["settled", "archived"].includes(d.deal_state)).length,
    completedDeals: deals.filter((d: any) => d.deal_state === "settled").length,
    totalUsers: profilesRes.count ?? 0,
    totalDocs: docsRes.count ?? 0,
    totalStakeholders: capTableRes.count ?? 0,
    openTickets: support.filter((s: any) => s.status === "new" || s.status === "in_progress").length,
    totalTickets: support.length,
    completedRuns,
    failedRuns,
    totalRuns: agentRuns.length,
    successRate: agentRuns.length > 0 ? Math.round((completedRuns / agentRuns.length) * 100) : 0,
    openDiscrepancies: discrepancies.filter((d: any) => d.status === "open").length,
    blockerDiscrepancies: discrepancies.filter((d: any) => d.severity === "blocker" && d.status === "open").length,
    pendingApprovals: (approvalsRes.data ?? []).filter((a: any) => a.status === "pending").length,
    topSupportCategory: topCat ? `${topCat[0]} (${topCat[1]} tickets)` : "N/A",
    failureReasons: agentRuns.filter((r: any) => r.status === "failed" && r.error_message).map((r: any) => r.error_message).slice(0, 5),
    newUsersThisWeek,
    newUsersLastWeek,
    loginCountThisWeek: loginsThisWeek,
    loginCountLastWeek: loginsLastWeek,
    usersWithDeals: dealCreators.size,
    usersWithDocs: docUploaders.size,
    usersWithNewton: newtonUsers.size,
    inactiveUsers7d: inactiveUsers,
  };

  const contextSummary = `
PIVT Platform Metrics Summary:
- Total Users: ${metrics.totalUsers} (New this week: ${metrics.newUsersThisWeek}, Previous week: ${metrics.newUsersLastWeek})
- Logins this week: ${metrics.loginCountThisWeek} (Previous week: ${metrics.loginCountLastWeek})
- Users inactive >7d: ${metrics.inactiveUsers7d}
- Activation: ${metrics.usersWithDeals} users created deals, ${metrics.usersWithDocs} uploaded docs, ${metrics.usersWithNewton} used Newton
- Total Deals: ${metrics.totalDeals} (Active: ${metrics.activeDeals}, Completed: ${metrics.completedDeals})
- Documents Uploaded: ${metrics.totalDocs}
- Stakeholders Added: ${metrics.totalStakeholders}
- Open Support Tickets: ${metrics.openTickets} out of ${metrics.totalTickets} total
- Top Support Category: ${metrics.topSupportCategory}
- Newton/AI Runs: ${metrics.totalRuns} (Success Rate: ${metrics.successRate}%, Failed: ${metrics.failedRuns})
- Open Discrepancies: ${metrics.openDiscrepancies} (Blockers: ${metrics.blockerDiscrepancies})
- Pending Approvals: ${metrics.pendingApprovals}
- Agent Failure Reasons: ${metrics.failureReasons.join("; ") || "None"}
  `.trim();

  return { metrics, contextSummary };
}

function buildDailyPrompt(contextSummary: string): string {
  return `You are an AI operations analyst for PIVT, an M&A deal execution platform.
Based on the following platform metrics, generate 3-5 concise, actionable daily insights focused on USER BEHAVIOR and ENGAGEMENT.

${contextSummary}

Prioritize insights about:
1. User activation and drop-off patterns
2. Feature adoption gaps
3. Users at risk of churn
4. Support friction signals
5. Newton/AI usage patterns

For each insight, provide a JSON object with:
- title: A concise insight headline (max 80 chars)
- body: Brief explanation of why this matters (max 200 chars)
- suggested_action: A specific, actionable recommendation (max 150 chars)
- severity: One of "critical", "important", or "opportunity"
- category: One of "activation", "retention", "newton", "support", "risk", "documents", "deals", "engagement", "general"
- priority_rank: Integer 1-5 where 1 is highest priority

IMPORTANT: Only generate insights grounded in the actual data above. If data is insufficient, skip. Do not fabricate.

Return ONLY a JSON array of insight objects. No markdown, no explanation.`;
}

function buildWeeklyPrompt(contextSummary: string): string {
  return `You are an AI operations analyst providing a WEEKLY FOUNDER OPS BRIEF for PIVT, an M&A deal execution platform.

${contextSummary}

Generate a comprehensive weekly brief as a JSON object with:
- summary: 2-3 sentence executive summary of the week (max 300 chars)
- highlights: Array of 3-5 key changes/trends this week, each with { title, body, category }
- top_product_priorities: Array of 3 strings - specific product priorities
- top_user_actions: Array of 3 strings - specific user/customer actions to take
- growth_opportunity: String - the #1 growth opportunity
- operational_risk: String - the #1 operational risk
- activation_rate_assessment: String describing current activation health
- churn_risk_users_count: Number of users showing churn signals
- severity: "critical" if urgent issues, "important" if moderate, "opportunity" if healthy

IMPORTANT: Ground everything in actual data. If insufficient data, say so explicitly.

Return ONLY the JSON object. No markdown.`;
}

async function generateWithAI(prompt: string, lovableApiKey: string): Promise<any> {
  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!aiRes.ok) return null;
  const aiData = await aiRes.json();
  const content = aiData.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  return null;
}

function generateFallbackDaily(m: PlatformMetrics): any[] {
  const insights: any[] = [];
  if (m.newUsersThisWeek > 0 && m.usersWithDocs < m.totalUsers) {
    insights.push({
      title: `${m.newUsersThisWeek} new users this week, only ${m.usersWithDocs} have uploaded docs`,
      body: "Users are signing up but not completing key activation steps like document upload.",
      suggested_action: "Improve onboarding to guide new users toward their first document upload.",
      severity: m.usersWithDocs === 0 ? "critical" : "important",
      category: "activation",
      priority_rank: 1,
    });
  }
  if (m.inactiveUsers7d > 0) {
    insights.push({
      title: `${m.inactiveUsers7d} users inactive for 7+ days`,
      body: "These users may be at risk of churning without re-engagement.",
      suggested_action: "Reach out to inactive users with personalized follow-ups.",
      severity: m.inactiveUsers7d > 3 ? "critical" : "important",
      category: "retention",
      priority_rank: 2,
    });
  }
  if (m.openTickets > 0) {
    insights.push({
      title: `${m.openTickets} open support tickets awaiting response`,
      body: "Unresolved support tickets impact user satisfaction.",
      suggested_action: "Review and triage open support tickets.",
      severity: m.openTickets > 5 ? "critical" : "important",
      category: "support",
      priority_rank: 3,
    });
  }
  if (m.failedRuns > 0) {
    insights.push({
      title: `Newton success rate at ${m.successRate}% (${m.failedRuns} failures)`,
      body: "Failed AI runs reduce user trust in the platform.",
      suggested_action: "Review failed agent runs to identify common failure patterns.",
      severity: m.successRate < 70 ? "critical" : "important",
      category: "newton",
      priority_rank: 4,
    });
  }
  if (insights.length === 0) {
    insights.push({
      title: "Platform operating normally",
      body: `${m.totalUsers} users, ${m.totalDeals} deals, ${m.successRate}% Newton success rate.`,
      suggested_action: "Continue monitoring. No immediate action required.",
      severity: "opportunity",
      category: "general",
      priority_rank: 5,
    });
  }
  return insights;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const db = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const insightType = body.type ?? "daily";

    const { metrics, contextSummary } = await gatherMetrics(db);

    let insightRows: any[] = [];

    if (insightType === "weekly") {
      let weeklyData: any = null;
      if (lovableApiKey) {
        try { weeklyData = await generateWithAI(buildWeeklyPrompt(contextSummary), lovableApiKey); } catch (e) { console.error("AI weekly failed:", e); }
      }

      const title = weeklyData?.summary ?? `Weekly brief: ${metrics.totalUsers} users, ${metrics.newUsersThisWeek} new this week`;
      const bodyText = weeklyData ? JSON.stringify({
        highlights: weeklyData.highlights ?? [],
        top_product_priorities: weeklyData.top_product_priorities ?? [],
        top_user_actions: weeklyData.top_user_actions ?? [],
        growth_opportunity: weeklyData.growth_opportunity ?? "",
        operational_risk: weeklyData.operational_risk ?? "",
        activation_rate_assessment: weeklyData.activation_rate_assessment ?? "",
        churn_risk_users_count: weeklyData.churn_risk_users_count ?? 0,
      }) : "Insufficient data for detailed weekly brief.";

      insightRows = [{
        insight_type: "weekly",
        title: String(title).slice(0, 200),
        body: bodyText.slice(0, 2000),
        evidence: contextSummary.slice(0, 1000),
        suggested_action: weeklyData?.top_product_priorities?.[0] ?? "Review platform metrics.",
        severity: weeklyData?.severity ?? "opportunity",
        category: "general",
        confidence: 0.8,
        generated_at: new Date().toISOString(),
        review_status: "new",
      }];
    } else {
      // Daily insights
      let insights: any[] = [];
      if (lovableApiKey) {
        try { insights = await generateWithAI(buildDailyPrompt(contextSummary), lovableApiKey) ?? []; } catch (e) { console.error("AI daily failed:", e); }
      }
      if (!Array.isArray(insights) || insights.length === 0) {
        insights = generateFallbackDaily(metrics);
      }

      insightRows = insights.map((insight: any, i: number) => ({
        insight_type: "daily",
        title: String(insight.title ?? "").slice(0, 200),
        body: String(insight.body ?? "").slice(0, 500),
        evidence: contextSummary.slice(0, 1000),
        suggested_action: String(insight.suggested_action ?? "").slice(0, 500),
        severity: ["critical", "important", "opportunity"].includes(insight.severity) ? insight.severity : "opportunity",
        category: insight.category ?? "general",
        confidence: 0.8,
        generated_at: new Date().toISOString(),
        review_status: "new",
        priority_rank: insight.priority_rank ?? (i + 1),
      }));
    }

    const { error: insertErr } = await db.from("admin_insights").insert(insightRows);
    if (insertErr) console.error("Failed to store insights:", insertErr);

    return new Response(
      JSON.stringify({ success: true, type: insightType, count: insightRows.length }),
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
