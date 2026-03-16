import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentFinding {
  id: string;
  rule_key: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "reconciliation" | "completeness" | "compliance" | "consistency";
  title: string;
  description: string;
  affected_entities: { type: string; id: string; label: string }[];
  expected_value?: string;
  actual_value?: string;
  recommendation: string;
}

interface WireInstruction {
  id: string;
  deal_id: string;
  payee_entity: string;
  payer_entity: string | null;
  amount: number;
  currency: string;
  payment_type: string;
  verification_status: string;
  bank_name: string | null;
  account_holder: string | null;
  account_number_last4: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  iban: string | null;
}

interface Deal {
  id: string;
  deal_name: string;
  deal_value: number;
  currency: string | null;
  escrow_amount: number | null;
}

interface CapTableEntry {
  id: string;
  shareholder_name: string;
  net_payout: number | null;
  payout_amount: number;
  escrow_holdback: number | null;
  role: string;
}

interface Obligation {
  id: string;
  obligation_type: string;
  status: string;
  amount_value_minor: number | null;
  amount_currency: string | null;
  payee_label: string | null;
  payor_label: string | null;
  mapping_status: string;
}

// ─── Deterministic Validators ────────────────────────────────────────────────

function hashFinding(ruleKey: string, objectId: string): string {
  // Simple deterministic ID for deduplication
  const str = `${ruleKey}:${objectId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function validateWireTotalVsDealValue(
  wires: WireInstruction[],
  deal: Deal
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const totalWires = wires.reduce((sum, w) => sum + Number(w.amount), 0);
  const dealValue = Number(deal.deal_value);

  if (dealValue <= 0) return findings;

  const variance = totalWires - dealValue;
  const variancePct = Math.abs(variance / dealValue) * 100;

  if (totalWires > dealValue) {
    findings.push({
      id: hashFinding("agent.funds_flow.wire_total_exceeds_deal", deal.id),
      rule_key: "agent.funds_flow.wire_total_exceeds_deal",
      severity: "critical",
      category: "reconciliation",
      title: "Wire total exceeds deal value",
      description: `Total wire instructions ($${totalWires.toLocaleString()}) exceed the deal value ($${dealValue.toLocaleString()}) by $${Math.abs(variance).toLocaleString()} (${variancePct.toFixed(2)}%).`,
      affected_entities: wires.map((w) => ({
        type: "wire_instruction",
        id: w.id,
        label: `${w.payee_entity}: $${Number(w.amount).toLocaleString()}`,
      })),
      expected_value: `≤ $${dealValue.toLocaleString()}`,
      actual_value: `$${totalWires.toLocaleString()}`,
      recommendation:
        "Review wire instruction amounts. Total disbursements must not exceed the purchase price.",
    });
  } else if (variancePct > 1 && variance < 0) {
    findings.push({
      id: hashFinding("agent.funds_flow.wire_total_shortfall", deal.id),
      rule_key: "agent.funds_flow.wire_total_shortfall",
      severity: "high",
      category: "reconciliation",
      title: "Wire total significantly below deal value",
      description: `Total wire instructions ($${totalWires.toLocaleString()}) are $${Math.abs(variance).toLocaleString()} below deal value ($${dealValue.toLocaleString()}). This ${variancePct.toFixed(2)}% shortfall may indicate missing payment allocations.`,
      affected_entities: [
        { type: "deal", id: deal.id, label: deal.deal_name },
      ],
      expected_value: `~$${dealValue.toLocaleString()}`,
      actual_value: `$${totalWires.toLocaleString()}`,
      recommendation:
        "Verify all payout recipients are accounted for, including escrow holdbacks and advisory fees.",
    });
  }

  return findings;
}

function validateUnverifiedWires(wires: WireInstruction[]): AgentFinding[] {
  const unverified = wires.filter(
    (w) => w.verification_status !== "verified" && w.verification_status !== "confirmed"
  );
  if (unverified.length === 0) return [];

  return [
    {
      id: hashFinding("agent.funds_flow.unverified_wires", "batch"),
      rule_key: "agent.funds_flow.unverified_wires",
      severity: "high",
      category: "compliance",
      title: `${unverified.length} wire instruction${unverified.length > 1 ? "s" : ""} not verified`,
      description: `The following wire instructions have not been verified: ${unverified.map((w) => w.payee_entity).join(", ")}. Unverified wires block execution.`,
      affected_entities: unverified.map((w) => ({
        type: "wire_instruction",
        id: w.id,
        label: `${w.payee_entity} (${w.verification_status})`,
      })),
      recommendation:
        "Complete wire verification for all payment recipients before execution.",
    },
  ];
}

function validateDuplicateRecipients(wires: WireInstruction[]): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const seen = new Map<string, WireInstruction[]>();

  for (const w of wires) {
    const key = `${w.payee_entity.toLowerCase().trim()}|${Number(w.amount)}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(w);
  }

  for (const [, group] of seen) {
    if (group.length > 1) {
      findings.push({
        id: hashFinding(
          "agent.funds_flow.duplicate_payee_amount",
          group[0].id
        ),
        rule_key: "agent.funds_flow.duplicate_payee_amount",
        severity: "high",
        category: "consistency",
        title: `Duplicate wire: ${group[0].payee_entity}`,
        description: `${group.length} wire instructions found for "${group[0].payee_entity}" with identical amount $${Number(group[0].amount).toLocaleString()}. This may indicate a duplicate entry.`,
        affected_entities: group.map((w) => ({
          type: "wire_instruction",
          id: w.id,
          label: `${w.payee_entity}: $${Number(w.amount).toLocaleString()}`,
        })),
        recommendation:
          "Review and remove duplicate wire instructions to prevent double payment.",
      });
    }
  }

  return findings;
}

function validateMissingWireFields(wires: WireInstruction[]): AgentFinding[] {
  const findings: AgentFinding[] = [];

  for (const w of wires) {
    const missing: string[] = [];
    if (!w.bank_name) missing.push("bank name");
    if (!w.routing_number && !w.swift_bic && !w.iban)
      missing.push("routing/SWIFT/IBAN");
    if (!w.account_number_last4 && !w.iban) missing.push("account number");
    if (!w.account_holder) missing.push("account holder");

    if (missing.length > 0) {
      findings.push({
        id: hashFinding("agent.funds_flow.missing_wire_fields", w.id),
        rule_key: "agent.funds_flow.missing_wire_fields",
        severity: "medium",
        category: "completeness",
        title: `Incomplete wire: ${w.payee_entity}`,
        description: `Wire instruction for "${w.payee_entity}" is missing: ${missing.join(", ")}. Incomplete banking details will block payment execution.`,
        affected_entities: [
          {
            type: "wire_instruction",
            id: w.id,
            label: w.payee_entity,
          },
        ],
        recommendation: `Complete the following fields for ${w.payee_entity}: ${missing.join(", ")}.`,
      });
    }
  }

  return findings;
}

function validateNegativeOrZeroAmounts(
  wires: WireInstruction[]
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  for (const w of wires) {
    const amt = Number(w.amount);
    if (amt <= 0) {
      findings.push({
        id: hashFinding("agent.funds_flow.invalid_amount", w.id),
        rule_key: "agent.funds_flow.invalid_amount",
        severity: "critical",
        category: "reconciliation",
        title: `Invalid amount: ${w.payee_entity}`,
        description: `Wire instruction for "${w.payee_entity}" has ${amt === 0 ? "zero" : "negative"} amount ($${amt.toLocaleString()}). All payment amounts must be positive.`,
        affected_entities: [
          { type: "wire_instruction", id: w.id, label: w.payee_entity },
        ],
        expected_value: "> $0",
        actual_value: `$${amt.toLocaleString()}`,
        recommendation: `Correct the payout amount for ${w.payee_entity}.`,
      });
    }
  }

  return findings;
}

function validateEscrowReconciliation(
  wires: WireInstruction[],
  deal: Deal,
  capTable: CapTableEntry[]
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const escrowWires = wires.filter(
    (w) => w.payment_type.toLowerCase().includes("escrow")
  );
  const escrowWireTotal = escrowWires.reduce(
    (sum, w) => sum + Number(w.amount),
    0
  );

  const dealEscrow = Number(deal.escrow_amount || 0);
  const capTableEscrow = capTable.reduce(
    (sum, c) => sum + Number(c.escrow_holdback || 0),
    0
  );

  // Check wire escrow vs deal escrow
  if (dealEscrow > 0 && Math.abs(escrowWireTotal - dealEscrow) > 1) {
    findings.push({
      id: hashFinding("agent.funds_flow.escrow_wire_mismatch", deal.id),
      rule_key: "agent.funds_flow.escrow_wire_mismatch",
      severity: "critical",
      category: "reconciliation",
      title: "Escrow wire amount does not match deal escrow",
      description: `Escrow wire instructions total $${escrowWireTotal.toLocaleString()} but the deal escrow is configured at $${dealEscrow.toLocaleString()}.`,
      affected_entities: escrowWires.map((w) => ({
        type: "wire_instruction",
        id: w.id,
        label: `${w.payee_entity}: $${Number(w.amount).toLocaleString()}`,
      })),
      expected_value: `$${dealEscrow.toLocaleString()}`,
      actual_value: `$${escrowWireTotal.toLocaleString()}`,
      recommendation:
        "Reconcile escrow wire amounts with the deal escrow configuration.",
    });
  }

  // Check cap table holdbacks vs deal escrow
  if (dealEscrow > 0 && capTableEscrow > 0 && Math.abs(capTableEscrow - dealEscrow) > 1) {
    findings.push({
      id: hashFinding("agent.funds_flow.escrow_captable_mismatch", deal.id),
      rule_key: "agent.funds_flow.escrow_captable_mismatch",
      severity: "high",
      category: "reconciliation",
      title: "Cap table holdbacks don't match deal escrow",
      description: `Total cap table escrow holdbacks ($${capTableEscrow.toLocaleString()}) differ from deal escrow ($${dealEscrow.toLocaleString()}).`,
      affected_entities: [
        { type: "deal", id: deal.id, label: deal.deal_name },
      ],
      expected_value: `$${dealEscrow.toLocaleString()}`,
      actual_value: `$${capTableEscrow.toLocaleString()}`,
      recommendation:
        "Align cap table escrow holdback amounts with the configured deal escrow.",
    });
  }

  return findings;
}

function validateCapTableVsWires(
  wires: WireInstruction[],
  capTable: CapTableEntry[]
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  // Build a map of wire amounts by normalized payee name
  const wireByPayee = new Map<string, number>();
  for (const w of wires) {
    const key = w.payee_entity.toLowerCase().trim();
    wireByPayee.set(key, (wireByPayee.get(key) || 0) + Number(w.amount));
  }

  // Check each cap table entry with a net payout
  for (const entry of capTable) {
    const netPayout = Number(entry.net_payout ?? entry.payout_amount);
    if (netPayout <= 0) continue;

    const key = entry.shareholder_name.toLowerCase().trim();
    const wireAmount = wireByPayee.get(key);

    if (wireAmount === undefined) {
      findings.push({
        id: hashFinding("agent.funds_flow.missing_wire_for_stakeholder", entry.id),
        rule_key: "agent.funds_flow.missing_wire_for_stakeholder",
        severity: "high",
        category: "completeness",
        title: `No wire instruction for ${entry.shareholder_name}`,
        description: `Cap table entry "${entry.shareholder_name}" has a net payout of $${netPayout.toLocaleString()} but no matching wire instruction was found.`,
        affected_entities: [
          {
            type: "cap_table_entry",
            id: entry.id,
            label: `${entry.shareholder_name}: $${netPayout.toLocaleString()}`,
          },
        ],
        expected_value: `Wire for $${netPayout.toLocaleString()}`,
        actual_value: "No wire found",
        recommendation: `Add wire instructions for ${entry.shareholder_name} to enable payment execution.`,
      });
    } else if (Math.abs(wireAmount - netPayout) / netPayout > 0.001) {
      // > 0.1% variance
      findings.push({
        id: hashFinding("agent.funds_flow.cap_table_wire_variance", entry.id),
        rule_key: "agent.funds_flow.cap_table_wire_variance",
        severity: "high",
        category: "reconciliation",
        title: `Wire/payout mismatch: ${entry.shareholder_name}`,
        description: `Wire amount ($${wireAmount.toLocaleString()}) differs from cap table net payout ($${netPayout.toLocaleString()}) for "${entry.shareholder_name}".`,
        affected_entities: [
          {
            type: "cap_table_entry",
            id: entry.id,
            label: entry.shareholder_name,
          },
        ],
        expected_value: `$${netPayout.toLocaleString()}`,
        actual_value: `$${wireAmount.toLocaleString()}`,
        recommendation: `Reconcile wire amount with the cap table payout for ${entry.shareholder_name}.`,
      });
    }
  }

  return findings;
}

function validateCurrencyConsistency(
  wires: WireInstruction[],
  deal: Deal
): AgentFinding[] {
  if (wires.length === 0) return [];

  const dealCurrency = (deal.currency || "USD").toUpperCase();
  const mismatchedWires = wires.filter(
    (w) => w.currency.toUpperCase() !== dealCurrency
  );

  if (mismatchedWires.length === 0) return [];

  return [
    {
      id: hashFinding("agent.funds_flow.currency_mismatch", deal.id),
      rule_key: "agent.funds_flow.currency_mismatch",
      severity: "medium",
      category: "consistency",
      title: `${mismatchedWires.length} wire${mismatchedWires.length > 1 ? "s" : ""} in non-deal currency`,
      description: `Deal currency is ${dealCurrency} but ${mismatchedWires.length} wire instruction(s) use different currencies: ${[...new Set(mismatchedWires.map((w) => w.currency))].join(", ")}. Ensure FX quotes are configured.`,
      affected_entities: mismatchedWires.map((w) => ({
        type: "wire_instruction",
        id: w.id,
        label: `${w.payee_entity}: ${w.currency}`,
      })),
      recommendation:
        "Confirm FX rates are locked for cross-currency payments or correct currency assignments.",
    },
  ];
}

// ─── AI Summary Generation ──────────────────────────────────────────────────

async function generateAISummary(
  deal: Deal,
  findings: AgentFinding[],
  wireCount: number
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  const prompt = `You are Newton, the Deal Intelligence Engine. Summarize these Funds Flow Validation findings in 2-3 sentences for a PE associate.

Deal: ${deal.deal_name}
Deal Value: $${Number(deal.deal_value).toLocaleString()}
Wire Instructions Analyzed: ${wireCount}
Total Findings: ${findings.length} (${criticalCount} critical, ${highCount} high)

Findings:
${findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join("\n")}

${findings.length === 0 ? "No issues detected. All funds flow validation checks passed." : ""}

Rules:
- Be specific about dollar amounts and counts
- Use professional financial language
- End with a clear recommendation
- Do NOT use markdown formatting`;

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      console.error("AI summary failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("AI summary error:", e);
    return null;
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { deal_id } = await req.json();
    if (!deal_id) {
      return new Response(
        JSON.stringify({ success: false, error: "deal_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Identify the triggering user (optional — edge function may be called by service)
    let triggeredBy: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        triggeredBy = user?.id || null;
      } catch { /* anonymous trigger */ }
    }

    // Check for recent running agent (prevent duplicates)
    const { data: recentRuns } = await admin
      .from("agent_runs")
      .select("id, status, created_at")
      .eq("deal_id", deal_id)
      .eq("agent_type", "funds_flow_validation")
      .eq("status", "running")
      .gte("created_at", new Date(Date.now() - 60000).toISOString())
      .limit(1);

    if (recentRuns && recentRuns.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "An agent run is already in progress for this deal.",
          existing_run_id: recentRuns[0].id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create agent_run record
    const { data: agentRun, error: runError } = await admin
      .from("agent_runs")
      .insert({
        deal_id,
        agent_type: "funds_flow_validation",
        agent_version: "1.0.0",
        status: "running",
        triggered_by: triggeredBy,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError || !agentRun) {
      console.error("Failed to create agent_run:", runError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to initialize agent run" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runId = agentRun.id;

    try {
      // ── Step 2: Snapshot — parallel data fetch ──
      const [
        { data: deal },
        { data: wires },
        { data: capTable },
        { data: obligations },
        { data: existingDiscrepancies },
      ] = await Promise.all([
        admin.from("deals").select("*").eq("id", deal_id).single(),
        admin.from("wire_instructions").select("*").eq("deal_id", deal_id),
        admin.from("cap_table_entries").select("*").eq("deal_id", deal_id),
        admin
          .from("obligations")
          .select("*")
          .eq("deal_id", deal_id)
          .in("status", ["CONFIRMED", "NEEDS_REVIEW"]),
        admin
          .from("discrepancies")
          .select("rule_key, object_id, status")
          .eq("deal_id", deal_id)
          .like("rule_key", "agent.funds_flow.%")
          .in("status", ["open", "acknowledged"]),
      ]);

      if (!deal) {
        throw new Error(`Deal not found: ${deal_id}`);
      }

      const wireList: WireInstruction[] = wires || [];
      const capTableList: CapTableEntry[] = capTable || [];

      // Build input snapshot
      const inputSnapshot = {
        deal_value: deal.deal_value,
        deal_currency: deal.currency,
        escrow_amount: deal.escrow_amount,
        wire_count: wireList.length,
        cap_table_count: capTableList.length,
        obligation_count: (obligations || []).length,
        wire_total: wireList.reduce((s, w) => s + Number(w.amount), 0),
      };

      // ── Step 3: Run deterministic validators ──
      const allFindings: AgentFinding[] = [];

      if (wireList.length === 0) {
        // No wires to validate — single informational finding
        allFindings.push({
          id: hashFinding("agent.funds_flow.no_wires", deal_id),
          rule_key: "agent.funds_flow.no_wires",
          severity: "medium",
          category: "completeness",
          title: "No wire instructions found",
          description: `Deal "${deal.deal_name}" has no wire instructions configured. Payment execution cannot proceed without wire details.`,
          affected_entities: [
            { type: "deal", id: deal.id, label: deal.deal_name },
          ],
          recommendation:
            "Upload a Funds Flow Memorandum or manually add wire instructions.",
        });
      } else {
        allFindings.push(
          ...validateWireTotalVsDealValue(wireList, deal),
          ...validateUnverifiedWires(wireList),
          ...validateDuplicateRecipients(wireList),
          ...validateMissingWireFields(wireList),
          ...validateNegativeOrZeroAmounts(wireList),
          ...validateEscrowReconciliation(wireList, deal, capTableList),
          ...validateCapTableVsWires(wireList, capTableList),
          ...validateCurrencyConsistency(wireList, deal)
        );
      }

      // Sort by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      allFindings.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );

      const criticalCount = allFindings.filter(
        (f) => f.severity === "critical"
      ).length;

      // ── Step 4: AI Summary ──
      const summaryText = await generateAISummary(
        deal,
        allFindings,
        wireList.length
      );

      // ── Step 5: Write results ──
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      await admin
        .from("agent_runs")
        .update({
          status: "completed",
          input_snapshot: inputSnapshot,
          findings: allFindings,
          finding_count: allFindings.length,
          critical_count: criticalCount,
          summary_text: summaryText,
          completed_at: completedAt,
          duration_ms: durationMs,
        })
        .eq("id", runId);

      // Create discrepancies for critical/high findings (deduplicated)
      const existingKeys = new Set(
        (existingDiscrepancies || []).map(
          (d: { rule_key: string; object_id: string }) =>
            `${d.rule_key}:${d.object_id}`
        )
      );

      const newDiscrepancies = allFindings
        .filter((f) => f.severity === "critical" || f.severity === "high")
        .filter((f) => {
          const objectId =
            f.affected_entities[0]?.id || deal_id;
          return !existingKeys.has(`${f.rule_key}:${objectId}`);
        })
        .map((f) => ({
          deal_id,
          rule_key: f.rule_key,
          severity: f.severity,
          message: f.title,
          object_type: f.affected_entities[0]?.type || "deal",
          object_id: f.affected_entities[0]?.id || deal_id,
          status: "open",
          details: {
            description: f.description,
            recommendation: f.recommendation,
            affected_entities: f.affected_entities,
            expected_value: f.expected_value,
            actual_value: f.actual_value,
            created_by_agent_run_id: runId,
          },
        }));

      if (newDiscrepancies.length > 0) {
        const { error: discError } = await admin
          .from("discrepancies")
          .insert(newDiscrepancies);
        if (discError) {
          console.error("Failed to insert discrepancies:", discError);
        }
      }

      // Audit event
      await admin.from("audit_events").insert({
        deal_id,
        actor_id: triggeredBy,
        entity_type: "agent_run",
        entity_id: runId,
        event_type: "agent.funds_flow.completed",
        after: {
          finding_count: allFindings.length,
          critical_count: criticalCount,
          discrepancies_created: newDiscrepancies.length,
          duration_ms: durationMs,
          summary: summaryText?.slice(0, 500),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          run_id: runId,
          finding_count: allFindings.length,
          critical_count: criticalCount,
          findings: allFindings,
          summary: summaryText,
          discrepancies_created: newDiscrepancies.length,
          duration_ms: durationMs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (innerError) {
      // Mark agent run as failed
      const errorMsg =
        innerError instanceof Error ? innerError.message : "Unknown error";
      await admin
        .from("agent_runs")
        .update({
          status: "failed",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq("id", runId);

      console.error("Agent execution error:", innerError);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, run_id: runId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("funds-flow-agent error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
