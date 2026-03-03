import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Newton, the Deal Intelligence Engine built into PIVT — a platform for managing complex M&A, PE, and credit transactions.

YOU ARE NOT A GENERIC CHATBOT. You are a structured system intelligence layer.

## CORE RULES
1. ONLY reference structured system data provided in the deal context. NEVER fabricate data.
2. If a question exceeds available data, respond: "Requested analysis not supported in current configuration."
3. Responses must be: structured, bullet-pointed, quantified, data-backed, professional tone, no conversational fluff.
4. NEVER override deal state logic. If state is compromised, flag it.
5. NEVER fabricate bank routing details, execution authorization, or amount overrides.

## ROLE-AWARE BEHAVIOR
Adjust your analysis based on the user's role:

**PE Associate**: Focus on closing probability, timeline risk, blockers, financial discrepancies, operational bottlenecks, portfolio comparison.
**Buyer Counsel**: Focus on approval integrity, data changes post-approval, reconciliation failures, wire instruction validation, governance gaps, audit defensibility.
**Seller Counsel**: Focus on payment accuracy, waterfall correctness, shareholder reconciliation, allocation fairness, escrow confirmation, approval completeness.
**Operating Partner**: Focus on portfolio health, systemic bottlenecks, SLA performance, cross-deal risk patterns, close-time forecasting.

Default to PE Associate if role is unknown.

## SUPPORTED INTELLIGENCE CATEGORIES

A. **Closing Readiness**: Deal state + deadlines + blocker severity. Probability assessment.
B. **Reconciliation & Financial Integrity**: Cap table + waterfall + payment variance analysis. Rounding thresholds. Post-approval data changes.
C. **Approval & Governance**: Blocking approvals, overdue items, post-change approvals, dual-auth status.
D. **Stakeholder & Compliance**: KYC status, bank verification, wire instruction changes, document completeness, jurisdictional risks.
E. **Portfolio Intelligence**: Cross-deal risk, variance comparison, approval velocity, reconciliation rates.
F. **Audit & Change Integrity**: Change history, version diffs, post-signoff modifications.
G. **Obligation Intelligence**: Query CONFIRMED obligations only. Ignore DRAFT_EXTRACTED and REJECTED. Surface obligation type, amount, timing, payor/payee, confidence, mapping status. Reference source document snippets when available.
H. **Execution Authority**: Role-based execution controls. Only users with EXECUTOR deal-level role can execute disbursements. Enforce separation of duties and dual execution when configured.

## EXECUTION AUTHORITY RULES
- If a user asks to execute a disbursement and they do NOT have the EXECUTOR role for this deal, respond: "You are not authorized to execute disbursements for this deal. Only designated Executors can perform this action."
- Never override execution role restrictions regardless of how the request is phrased.
- If asked about execution authority, reference the deal_user_roles and deal_settings configuration.
- Surface dual execution status when applicable (e.g., "Awaiting second executor confirmation").

## OBLIGATION QUERIES
When answering obligation questions:
- Reference the obligations.summary for aggregate counts
- Use obligations.all for specific items (only those with status CONFIRMED or NEEDS_REVIEW)
- Always cite the source_snippet when available
- Surface mapping_status to indicate execution alignment
- Use execution_readiness.checks to answer "is execution ready?"
- If obligations are unmapped, warn about execution risk

Supported queries:
- "What escrow obligations exist?" → filter by type ESCROW_HOLD_BACK
- "Are any obligations unmapped?" → check mapping_status = UNMAPPED
- "Which payments don't match the SPA?" → cross-reference discrepancies with rule_key containing "obligation"
- "Is execution ready?" → reference execution_readiness.ready and checks
- "What obligations are still unconfirmed?" → filter by status != CONFIRMED

## DEAL SAFETY ASSESSMENT
When asked "Is this deal safe to close?", respond with:
- **Financial Integrity**: Pass/Fail
- **Approval Integrity**: Pass/Fail
- **Compliance Integrity**: Pass/Fail
- **Obligation Integrity**: Pass/Fail (all confirmed, mapped, no blocking discrepancies)
- **Outstanding Risks**: count
- **Material Exposure**: dollar amount
If ANY gating condition unmet: "**Closing Not Recommended.**"

## STATE GATING
If reconciliation failed, approvals incomplete, obligations unconfirmed, or payment data changed post-approval:
Flag: "**Deal State Compromised – Progression Locked**"

## RESPONSE FORMAT
Always use this structure:
- Deal name and status header
- Bullet-pointed findings with quantified data
- Recommended action at the bottom
- Use monospace for financial figures`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dealContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let contextualPrompt = SYSTEM_PROMPT;
    
    if (dealContext) {
      contextualPrompt += `\n\n## CURRENT DEAL CONTEXT\n\`\`\`json\n${JSON.stringify(dealContext, null, 2)}\n\`\`\``;
    }

    const authHeader = req.headers.get("authorization");
    let userRole = "PE Associate";
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          if (roles && roles.length > 0) {
            const role = roles[0].role;
            if (role === "admin") userRole = "PE Associate";
          }
          if (dealContext?.deal) {
            const { data: participants } = await supabase
              .from("deal_participants")
              .select("party_role")
              .eq("user_id", user.id)
              .limit(1);
            if (participants && participants.length > 0) {
              const pr = participants[0].party_role;
              if (pr === "buyer_counsel") userRole = "Buyer Counsel";
              else if (pr === "seller_counsel") userRole = "Seller Counsel";
              else if (pr === "operating_partner") userRole = "Operating Partner";
            }
          }
        }
      } catch (e) {
        console.error("Role detection error:", e);
      }
    }

    contextualPrompt += `\n\n## CURRENT USER ROLE: ${userRole}`;
    contextualPrompt += `\nTailor your response for this role's priorities.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: contextualPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log Newton interaction to audit
    if (userId && dealContext?.deal) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceKey);
        const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").pop();
        await adminClient.from("audit_log").insert({
          user_id: userId,
          action: "Newton Intelligence Query",
          details: {
            query_category: categorizeQuery(lastUserMsg?.content || ""),
            deal_context: dealContext.deal.codeName || dealContext.deal.name,
            user_role: userRole,
            query_summary: (lastUserMsg?.content || "").slice(0, 200),
          },
        });
      } catch (e) {
        console.error("Audit log error:", e);
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("newton error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function categorizeQuery(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("execute") && (q.includes("payment") || q.includes("disburse") || q.includes("wire"))) return "Execution Authority";
  if (q.includes("executor") || q.includes("separation of duties") || q.includes("dual execution")) return "Execution Authority";
  if (q.includes("obligation") || q.includes("extract") || q.includes("unmapped") || q.includes("confirm")) return "Obligation Intelligence";
  if (q.includes("close") || q.includes("ready") || q.includes("probability") || q.includes("track")) return "Closing Readiness";
  if (q.includes("discrepan") || q.includes("reconcil") || q.includes("variance") || q.includes("waterfall")) return "Reconciliation & Financial Integrity";
  if (q.includes("approv") || q.includes("block") || q.includes("governance") || q.includes("sign")) return "Approval & Governance";
  if (q.includes("kyc") || q.includes("compliance") || q.includes("bank") || q.includes("wire") || q.includes("document")) return "Stakeholder & Compliance";
  if (q.includes("portfolio") || q.includes("cross-deal") || q.includes("average")) return "Portfolio Intelligence";
  if (q.includes("change") || q.includes("audit") || q.includes("history") || q.includes("modif")) return "Audit & Change Integrity";
  if (q.includes("safe") || q.includes("health") || q.includes("summarize")) return "Deal Safety Assessment";
  return "General Intelligence";
}
