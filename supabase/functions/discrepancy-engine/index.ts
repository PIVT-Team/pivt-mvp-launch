import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(JSON.stringify({ error: "deal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch enabled rules
    const { data: rules } = await supabase
      .from("discrepancy_rules")
      .select("*")
      .eq("enabled", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ discrepancies: [], message: "No rules enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch deal context
    const [dealRes, approvalsRes, docsRes, intentsRes, conditionsRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", deal_id).single(),
      supabase.from("ontology_approvals").select("*").eq("deal_id", deal_id),
      supabase.from("ontology_documents").select("*").eq("deal_id", deal_id),
      supabase.from("disbursement_intents").select("*").eq("deal_id", deal_id),
      supabase.from("conditions").select("*").eq("deal_id", deal_id),
    ]);

    if (dealRes.error) {
      return new Response(JSON.stringify({ error: dealRes.error.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deal = dealRes.data;
    const approvals = approvalsRes.data || [];
    const docs = docsRes.data || [];
    const intents = intentsRes.data || [];
    const conditions = conditionsRes.data || [];

    const newDiscrepancies: Array<{
      deal_id: string;
      object_type: string;
      object_id: string;
      rule_key: string;
      severity: string;
      message: string;
      details: Record<string, unknown>;
    }> = [];

    for (const rule of rules) {
      switch (rule.rule_key) {
        case "dual_counsel_missing": {
          // Check each intent that's in eligible/executing status
          for (const intent of intents) {
            if (!["eligible", "executing"].includes(intent.status)) continue;
            const hasBC = approvals.some(
              (a) => a.approval_type === "LEGAL_SIGNOFF" && a.status === "APPROVED"
            );
            const hasSC = approvals.some(
              (a) => a.approval_type === "FINANCE_SIGNOFF" && a.status === "APPROVED"
            );
            if (!hasBC || !hasSC) {
              newDiscrepancies.push({
                deal_id,
                object_type: "intent",
                object_id: intent.id,
                rule_key: rule.rule_key,
                severity: rule.severity,
                message: "Execution blocked: missing dual-counsel approvals (Buyer Counsel, Seller Counsel).",
                details: { has_buyer_counsel: hasBC, has_seller_counsel: hasSC },
              });
            }
          }
          break;
        }

        case "docs_not_executed": {
          const allExecuted = docs.every((d) => d.doc_type === "OTHER" || d.url);
          if (!allExecuted && intents.some((i) => ["eligible", "executing"].includes(i.status))) {
            newDiscrepancies.push({
              deal_id,
              object_type: "deal",
              object_id: deal_id,
              rule_key: rule.rule_key,
              severity: rule.severity,
              message: "Execution blocked: required documents are not fully executed.",
              details: { total_docs: docs.length, incomplete: docs.filter((d) => !d.url).length },
            });
          }
          break;
        }

        case "compliance_failed": {
          const failedConditions = conditions.filter((c) => c.status === "BLOCKED");
          if (failedConditions.length > 0) {
            newDiscrepancies.push({
              deal_id,
              object_type: "deal",
              object_id: deal_id,
              rule_key: rule.rule_key,
              severity: rule.severity,
              message: "Execution blocked: compliance/risk checks failed (review details).",
              details: { blocked_conditions: failedConditions.map((c) => c.title) },
            });
          }
          break;
        }

        case "payee_account_missing_or_mismatch": {
          for (const intent of intents) {
            if (!intent.bank_account_ref) {
              newDiscrepancies.push({
                deal_id,
                object_type: "intent",
                object_id: intent.id,
                rule_key: rule.rule_key,
                severity: rule.severity,
                message: "Execution blocked: payee payout account missing or unverified.",
                details: { recipient_id: intent.recipient_id },
              });
            }
          }
          break;
        }

        case "fx_rate_outside_tolerance": {
          for (const intent of intents) {
            if (intent.currency_original !== intent.settlement_currency && !intent.fx_quote_id) {
              newDiscrepancies.push({
                deal_id,
                object_type: "intent",
                object_id: intent.id,
                rule_key: rule.rule_key,
                severity: rule.severity,
                message: "Warning: FX rate moved beyond tolerance since quote.",
                details: { currency_original: intent.currency_original, settlement_currency: intent.settlement_currency },
              });
            }
          }
          break;
        }

        case "waterfall_intent_total_mismatch": {
          const totalIntents = intents.reduce((s, i) => s + Number(i.amount_original), 0);
          const dealValue = Number(deal.deal_value);
          const tolerance = (rule.config as { tolerance_pct?: number })?.tolerance_pct || 0.5;
          if (dealValue > 0 && Math.abs(totalIntents - dealValue) / dealValue > tolerance / 100) {
            newDiscrepancies.push({
              deal_id,
              object_type: "deal",
              object_id: deal_id,
              rule_key: rule.rule_key,
              severity: rule.severity,
              message: "Warning: Intent totals don't match expected waterfall outputs.",
              details: { intent_total: totalIntents, deal_value: dealValue },
            });
          }
          break;
        }

        case "large_payment_extra_approval": {
          const threshold = (rule.config as { threshold_amount?: number })?.threshold_amount || 5000000;
          for (const intent of intents) {
            if (Number(intent.amount_original) > threshold) {
              newDiscrepancies.push({
                deal_id,
                object_type: "intent",
                object_id: intent.id,
                rule_key: rule.rule_key,
                severity: rule.severity,
                message: "Warning: High-value disbursement requires additional approval.",
                details: { amount: intent.amount_original, threshold },
              });
            }
          }
          break;
        }

        case "stale_deal_data": {
          const staleDays = (rule.config as { stale_days?: number })?.stale_days || 14;
          const updatedAt = new Date(deal.updated_at);
          const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince > staleDays) {
            newDiscrepancies.push({
              deal_id,
              object_type: "deal",
              object_id: deal_id,
              rule_key: rule.rule_key,
              severity: rule.severity,
              message: "Info: Deal data hasn't been updated recently—confirm details are current.",
              details: { days_since_update: Math.round(daysSince), threshold_days: staleDays },
            });
          }
          break;
        }
      }
    }

    // Fetch existing open discrepancies
    const { data: existing } = await supabase
      .from("discrepancies")
      .select("*")
      .eq("deal_id", deal_id)
      .in("status", ["open", "acknowledged"]);

    const existingMap = new Map(
      (existing || []).map((d) => [`${d.rule_key}::${d.object_id}`, d])
    );

    // Upsert: create new, resolve old
    const newKeys = new Set(newDiscrepancies.map((d) => `${d.rule_key}::${d.object_id}`));

    // Insert new discrepancies
    for (const disc of newDiscrepancies) {
      const key = `${disc.rule_key}::${disc.object_id}`;
      if (!existingMap.has(key)) {
        await supabase.from("discrepancies").insert(disc);
      }
    }

    // Resolve old ones that passed now
    for (const [key, disc] of existingMap) {
      if (!newKeys.has(key) && disc.status === "open") {
        await supabase
          .from("discrepancies")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", disc.id);
      }
    }

    // Return current state
    const { data: current } = await supabase
      .from("discrepancies")
      .select("*")
      .eq("deal_id", deal_id)
      .in("status", ["open", "acknowledged"])
      .order("created_at", { ascending: false });

    const grouped = {
      blockers: (current || []).filter((d) => d.severity === "blocker"),
      warnings: (current || []).filter((d) => d.severity === "warn"),
      info: (current || []).filter((d) => d.severity === "info"),
    };

    return new Response(JSON.stringify({ discrepancies: current || [], grouped, deal_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
