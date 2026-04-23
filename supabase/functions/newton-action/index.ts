import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireJwt } from "../_shared/require-jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_USER_ID = "7def4eb3-14c8-412c-8ec8-155d45e6e8b2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireJwt(req, corsHeaders);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, params } = body;

    switch (action) {
      case "create_deal": {
        const p = params || {};
        const { data, error } = await admin.from("deals").insert({
          deal_name: p.deal_name || "Untitled Deal",
          deal_value: p.deal_value ?? 0,
          buyer: p.buyer || null,
          seller: p.seller || null,
          target_company: p.target_company || null,
          deal_type: p.deal_type || null,
          sector: p.sector || null,
          currency: p.currency || "USD",
          jurisdiction: p.jurisdiction || null,
          closing_date: p.closing_date || null,
          escrow_amount: p.escrow_amount || 0,
          created_by: userId,
          owner_id: userId,
          status: "draft",
          deal_number: "",
          deal_kind: "live",
          visibility: "private",
          is_demo: false,
          seed_key: p.internal_reference || null,
          template_id: p.template_id || null,
          template_version: p.template_version || null,
        }).select().single();

        if (error) {
          return json({ success: false, error: error.message }, 400);
        }

        // Setup: participant, settings, conditions, event
        await Promise.allSettled([
          admin.from("deal_participants").insert({
            deal_id: data.id, user_id: userId, party_role: "admin",
          }),
          admin.from("deal_settings").insert({ deal_id: data.id }),
          admin.from("conditions").insert([
            "Stakeholder data imported",
            "Documents uploaded",
            "KYC/KYB requests generated",
            "Approval package prepared",
          ].map((title) => ({ deal_id: data.id, title }))),
          admin.from("deal_events").insert({
            deal_id: data.id, actor_id: userId,
            event_type: "state_transition",
            previous_state: null, new_state: "draft",
            payload: { source: "newton", action: "create_deal" },
          }),
          admin.from("audit_log").insert({
            deal_id: data.id, user_id: userId,
            action: `Newton created deal: ${p.deal_name}`,
            details: { source: "newton", timestamp: new Date().toISOString() },
          }),
          p.template_id
            ? admin.rpc("apply_checklist_template_to_deal", {
                _deal_id: data.id,
                _template_id: p.template_id,
              })
            : Promise.resolve({ data: null, error: null }),
        ]);

        return json({
          success: true,
          deal_id: data.id,
          deal_name: data.deal_name,
          deal_number: (data as any).deal_number || data.id,
          template_id: p.template_id || null,
          template_version: p.template_version || null,
        });
      }

      case "summarize_readiness": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [condRes, appRes, docsRes, discRes, stakRes] = await Promise.all([
          admin.from("conditions").select("status").eq("deal_id", dealId),
          admin.from("deal_approvals").select("status").eq("deal_id", dealId),
          admin.from("contract_documents").select("status").eq("deal_id", dealId),
          admin.from("discrepancies").select("severity, status").eq("deal_id", dealId).neq("status", "resolved"),
          admin.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
        ]);

        const conditions = condRes.data || [];
        const condMet = conditions.filter((c: any) => ["MET", "SATISFIED", "WAIVED"].includes(c.status)).length;
        const approvals = appRes.data || [];
        const appDone = approvals.filter((a: any) => ["approved", "completed"].includes(a.status)).length;
        const docs = docsRes.data || [];
        const docsVerified = docs.filter((d: any) => d.status === "verified").length;
        const discrepancies = discRes.data || [];
        const critical = discrepancies.filter((d: any) => d.severity === "critical").length;
        const stakeholders = stakRes.data || [];
        const verified = stakeholders.filter((s: any) => s.verification_status === "verified").length;

        const total = conditions.length + approvals.length + docs.length + stakeholders.length;
        const done = condMet + appDone + docsVerified + verified;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return json({
          success: true,
          message:
            `**Closing Readiness: ${pct}%**\n\n` +
            `- **Conditions:** ${condMet}/${conditions.length} met\n` +
            `- **Approvals:** ${appDone}/${approvals.length} completed\n` +
            `- **Documents:** ${docsVerified}/${docs.length} verified\n` +
            `- **Stakeholder KYC:** ${verified}/${stakeholders.length} verified\n` +
            `- **Open Discrepancies:** ${discrepancies.length} (${critical} critical)\n\n` +
            (critical > 0
              ? "⚠️ **Critical discrepancies must be resolved before closing.**"
              : pct >= 90
                ? "✅ **Deal is approaching closing readiness.**"
                : "📋 **Continue resolving outstanding items.**"),
        });
      }

      case "list_blockers": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [condRes, appRes, discRes, stakRes, docsRes] = await Promise.all([
          admin.from("conditions").select("title, status").eq("deal_id", dealId).not("status", "in", '("MET","SATISFIED","WAIVED")'),
          admin.from("deal_approvals").select("approver_name, approval_type, status").eq("deal_id", dealId).not("status", "in", '("approved","completed")'),
          admin.from("discrepancies").select("message, severity, status").eq("deal_id", dealId).neq("status", "resolved"),
          admin.from("cap_table_entries").select("shareholder_name, verification_status").eq("deal_id", dealId).neq("verification_status", "verified"),
          admin.from("contract_documents").select("filename, status").eq("deal_id", dealId).neq("status", "verified"),
        ]);

        const blockers: string[] = [];
        ((discRes.data || []) as any[]).filter((d) => d.severity === "critical").forEach((d) => blockers.push(`🔴 Critical: ${d.message}`));
        ((appRes.data || []) as any[]).filter((a) => ["pending", "sent"].includes(a.status)).forEach((a) => blockers.push(`🟡 Approval: ${a.approval_type || "Approval"} from ${a.approver_name || "Unknown"}`));
        ((condRes.data || []) as any[]).forEach((c) => blockers.push(`🟠 Condition: ${c.title}`));
        ((stakRes.data || []) as any[]).forEach((s) => blockers.push(`🟡 KYC: ${s.shareholder_name}`));
        ((docsRes.data || []) as any[]).forEach((d) => blockers.push(`🟠 Doc: ${d.filename}`));

        return json({
          success: true,
          message: blockers.length === 0
            ? "✅ **No blockers identified.** Deal appears ready to progress."
            : `**${blockers.length} Blocker${blockers.length > 1 ? "s" : ""} Identified:**\n\n${blockers.join("\n")}`,
        });
      }

      case "generate_kyc_requests": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const { data: stakeholders } = await admin
          .from("cap_table_entries")
          .select("id, shareholder_name, email, verification_status, stakeholder_type")
          .eq("deal_id", dealId)
          .in("verification_status", ["not_sent", "not_requested"]);

        const eligible = (stakeholders || []).filter((s: any) => s.email);
        if (eligible.length === 0) {
          return json({ success: true, message: "**No eligible stakeholders.** All have been sent or are missing email addresses." });
        }

        const ids = eligible.map((s: any) => s.id);
        await admin.from("cap_table_entries").update({
          verification_status: "requested",
          verification_requested_at: new Date().toISOString(),
          verification_last_sent_at: new Date().toISOString(),
        }).in("id", ids);

        await admin.from("audit_log").insert({
          deal_id: dealId, user_id: userId,
          action: `Newton generated ${eligible.length} KYC/KYB requests`,
          details: { source: "newton" },
        });

        const details = eligible.map((s: any) => `- ${s.shareholder_name} (${s.stakeholder_type === "organization" ? "KYB" : "KYC"}) → ${s.email}`).join("\n");

        return json({
          success: true,
          message: `**${eligible.length} KYC/KYB requests generated:**\n\n${details}\n\n📧 Verification requests queued.`,
        });
      }

      case "prepare_approval_package": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [dealRes, condRes, discRes, stakRes] = await Promise.all([
          admin.from("deals").select("deal_name, deal_value, status").eq("id", dealId).single(),
          admin.from("conditions").select("title, status").eq("deal_id", dealId),
          admin.from("discrepancies").select("severity, status").eq("deal_id", dealId).neq("status", "resolved"),
          admin.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
        ]);

        const deal = dealRes.data;
        if (!deal) return json({ success: false, error: "Deal not found" }, 404);

        const conditions = condRes.data || [];
        const condMet = conditions.filter((c: any) => ["MET", "SATISFIED", "WAIVED"].includes(c.status)).length;
        const openDisc = (discRes.data || []).length;
        const criticalDisc = (discRes.data || []).filter((d: any) => d.severity === "critical").length;
        const totalStak = (stakRes.data || []).length;
        const verifiedStak = (stakRes.data || []).filter((s: any) => s.verification_status === "verified").length;
        const ready = criticalDisc === 0 && condMet === conditions.length;

        await admin.from("audit_log").insert({
          deal_id: dealId, user_id: userId,
          action: `Newton prepared approval package for ${deal.deal_name}`,
          details: { source: "newton" },
        });

        return json({
          success: true,
          message:
            `**Approval Package — ${deal.deal_name}**\n\n` +
            `| Item | Status |\n|---|---|\n` +
            `| Conditions | ${condMet}/${conditions.length} met |\n` +
            `| Discrepancies | ${openDisc} open (${criticalDisc} critical) |\n` +
            `| Stakeholder KYC | ${verifiedStak}/${totalStak} verified |\n` +
            `| Deal Value | $${((deal as any).deal_value / 1e6).toFixed(1)}M |\n\n` +
            (ready ? "✅ **Package ready for submission.**" : "⚠️ **Package NOT ready.** Resolve outstanding items."),
        });
      }

      case "list_deals": {
        const { data: deals } = await admin.from("deals").select("id, deal_name, deal_number, deal_value, status, closing_date")
          .neq("deal_kind", "template")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(15);

        if (!deals || deals.length === 0) {
          return json({ success: true, message: "No deals found. Would you like to create one?" });
        }

        const rows = deals.map((d: any) => `| ${d.deal_name} | ${d.deal_number} | $${(d.deal_value / 1e6).toFixed(1)}M | ${d.status} |`).join("\n");
        return json({ success: true, message: `**Your Deals (${deals.length}):**\n\n| Name | Matter ID | Value | Status |\n|---|---|---|---|\n${rows}` });
      }

      case "open_deal": {
        const searchName = (params?.deal_name || "").toLowerCase().trim();
        if (!searchName) return json({ success: false, error: "Please specify a deal name." }, 400);

        const { data: deals } = await admin.from("deals")
          .select("id, deal_name, deal_number, deal_state, status")
          .is("deleted_at", null)
          .ilike("deal_name", `%${searchName}%`)
          .limit(5);

        if (!deals || deals.length === 0) {
          return json({ success: false, error: `No deal found matching "${params.deal_name}".` });
        }

        const best = deals[0];
        return json({
          success: true, deal_id: best.id,
          message: `Opened **${best.deal_name}** (${best.deal_number}). Status: ${best.status}.`,
        });
      }

      case "next_steps": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [stakRes, docsRes, wiresRes, apprRes, discRes] = await Promise.all([
          admin.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
          admin.from("contract_documents").select("status").eq("deal_id", dealId),
          admin.from("wire_instructions").select("verification_status").eq("deal_id", dealId),
          admin.from("deal_approvals").select("status").eq("deal_id", dealId),
          admin.from("discrepancies").select("severity, status").eq("deal_id", dealId).neq("status", "resolved"),
        ]);

        const stak = stakRes.data || []; const docs = docsRes.data || [];
        const wires = wiresRes.data || []; const apprs = apprRes.data || [];
        const discs = discRes.data || [];
        const steps: string[] = [];

        if (stak.length === 0) steps.push("📋 **Import stakeholders** — Upload a cap table or stakeholder list");
        else if (stak.some((s: any) => s.verification_status !== "verified")) steps.push(`🔐 **Verify stakeholders** — ${stak.filter((s: any) => s.verification_status !== "verified").length} pending KYC/KYB`);

        if (docs.length === 0) steps.push("📄 **Upload documents** — Add deal agreements and contracts");
        else if (docs.some((d: any) => d.status !== "verified")) steps.push(`📝 **Review documents** — ${docs.filter((d: any) => d.status !== "verified").length} need review`);

        if (wires.length === 0) steps.push("🏦 **Add wire instructions** — Upload or enter banking details");
        else if (wires.some((w: any) => w.verification_status === "pending")) steps.push(`💸 **Verify wires** — ${wires.filter((w: any) => w.verification_status === "pending").length} pending verification`);

        if (discs.length > 0) {
          const critical = discs.filter((d: any) => d.severity === "critical").length;
          steps.push(`⚠️ **Resolve discrepancies** — ${discs.length} open (${critical} critical)`);
        }

        if (apprs.length === 0 && stak.length > 0) steps.push("✍️ **Prepare approval package** — Generate sign-off requests");
        else if (apprs.some((a: any) => a.status === "pending")) steps.push(`📨 **Track approvals** — ${apprs.filter((a: any) => a.status === "pending").length} pending`);

        if (steps.length === 0) steps.push("✅ **All clear** — Deal appears ready to execute");

        return json({
          success: true,
          message: `**Recommended Next Steps:**\n\n${steps.slice(0, 4).join("\n\n")}`,
        });
      }

      case "execute_deal": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [condRes, appRes, discRes, stakRes, dealRes] = await Promise.all([
          admin.from("conditions").select("title, status").eq("deal_id", dealId).not("status", "in", '("MET","SATISFIED","WAIVED")'),
          admin.from("deal_approvals").select("status").eq("deal_id", dealId).not("status", "in", '("approved","completed")'),
          admin.from("discrepancies").select("severity").eq("deal_id", dealId).neq("status", "resolved").eq("severity", "critical"),
          admin.from("cap_table_entries").select("verification_status").eq("deal_id", dealId).neq("verification_status", "verified"),
          admin.from("deals").select("deal_name, deal_state").eq("id", dealId).single(),
        ]);

        const unmetConditions = condRes.data || [];
        const pendingApprovals = appRes.data || [];
        const criticalDiscs = discRes.data || [];
        const unverifiedStak = stakRes.data || [];

        const blockers: string[] = [];
        if (criticalDiscs.length > 0) blockers.push(`🔴 **${criticalDiscs.length} critical discrepancies** must be resolved`);
        if (unmetConditions.length > 0) blockers.push(`🟠 **${unmetConditions.length} conditions** not yet met`);
        if (pendingApprovals.length > 0) blockers.push(`🟡 **${pendingApprovals.length} approvals** still pending`);
        if (unverifiedStak.length > 0) blockers.push(`🟡 **${unverifiedStak.length} stakeholders** not yet verified`);

        if (blockers.length === 0) {
          return json({
            success: true,
            message: `✅ **${dealRes.data?.deal_name || "Deal"} is ready to execute.**\n\nAll conditions met, approvals completed, and no critical issues. You may proceed with execution.`,
          });
        }

        return json({
          success: true,
          message: `⚠️ **Cannot execute yet.** ${blockers.length} blocker${blockers.length > 1 ? "s" : ""} must be resolved:\n\n${blockers.join("\n")}\n\nResolve these items before proceeding with execution.`,
        });
      }

      case "query_state": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [stakRes, docsRes, wiresRes, apprRes, discRes] = await Promise.all([
          admin.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
          admin.from("contract_documents").select("status").eq("deal_id", dealId),
          admin.from("wire_instructions").select("verification_status").eq("deal_id", dealId),
          admin.from("deal_approvals").select("status").eq("deal_id", dealId),
          admin.from("discrepancies").select("status").eq("deal_id", dealId),
        ]);

        const stak = stakRes.data || []; const docs = docsRes.data || [];
        const wires = wiresRes.data || []; const apprs = apprRes.data || [];
        const discs = discRes.data || [];

        return json({
          success: true,
          message:
            `**Deal State Summary:**\n\n` +
            `| Category | Total | Verified/Complete |\n|---|---|---|\n` +
            `| Stakeholders | ${stak.length} | ${stak.filter((s: any) => s.verification_status === "verified").length} verified |\n` +
            `| Documents | ${docs.length} | ${docs.filter((d: any) => d.status === "verified").length} verified |\n` +
            `| Wire Instructions | ${wires.length} | ${wires.filter((w: any) => w.verification_status === "verified").length} verified |\n` +
            `| Approvals | ${apprs.length} | ${apprs.filter((a: any) => ["approved", "completed"].includes(a.status)).length} completed |\n` +
            `| Discrepancies | ${discs.length} | ${discs.filter((d: any) => d.status === "resolved").length} resolved |`,
        });
      }

      case "show_demo": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        const [dealRes, stakRes, docsRes, condRes] = await Promise.all([
          admin.from("deals").select("*").eq("id", dealId).single(),
          admin.from("cap_table_entries").select("shareholder_name, ownership_pct, verification_status").eq("deal_id", dealId).limit(5),
          admin.from("contract_documents").select("filename, status").eq("deal_id", dealId).limit(5),
          admin.from("conditions").select("title, status").eq("deal_id", dealId),
        ]);

        const deal = dealRes.data;
        if (!deal) return json({ success: false, error: "Deal not found" }, 404);

        const stak = stakRes.data || [];
        const docs = docsRes.data || [];
        const conds = condRes.data || [];

        const stakPreview = stak.length > 0
          ? stak.map((s: any) => `  - ${s.shareholder_name} (${s.ownership_pct}%) — ${s.verification_status}`).join("\n")
          : "  _No stakeholders imported yet_";

        const docsPreview = docs.length > 0
          ? docs.map((d: any) => `  - ${d.filename} — ${d.status}`).join("\n")
          : "  _No documents uploaded yet_";

        const condPreview = conds.length > 0
          ? conds.map((c: any) => `  - ${c.title}: ${c.status}`).join("\n")
          : "  _No conditions set_";

        return json({
          success: true,
          message:
            `**Deal Walkthrough — ${deal.deal_name}**\n\n` +
            `**Overview:** $${((deal as any).deal_value / 1e6).toFixed(1)}M ${deal.deal_type || "deal"}\n` +
            `Buyer: ${deal.buyer || "TBD"} | Seller: ${deal.seller || "TBD"}\n` +
            `Status: ${deal.status} | Close: ${deal.closing_date || "TBD"}\n\n` +
            `**📋 Stakeholders:**\n${stakPreview}\n\n` +
            `**📄 Documents:**\n${docsPreview}\n\n` +
            `**✅ Conditions:**\n${condPreview}\n\n` +
            `---\n_Use the action buttons below to dive deeper into any area._`,
        });
      }

      case "parse_funds_flow": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        // Fetch wires & deal for analysis
        const [dealRes, wiresRes, capRes] = await Promise.all([
          admin.from("deals").select("id, deal_name, deal_value, currency, escrow_amount").eq("id", dealId).single(),
          admin.from("wire_instructions").select("*").eq("deal_id", dealId),
          admin.from("cap_table_entries").select("id, shareholder_name, net_payout, payout_amount, escrow_holdback, role").eq("deal_id", dealId),
        ]);

        const deal = dealRes.data;
        if (!deal) return json({ success: false, error: "Deal not found" }, 404);

        const wires = (wiresRes.data || []) as any[];
        const capTable = (capRes.data || []) as any[];

        if (wires.length === 0) {
          return json({
            success: true,
            message: `No wire instructions found for **${deal.deal_name}**.\n\nUpload a funds flow memo or wire instruction document, and I'll parse it automatically.`,
            discrepancies: [],
            discrepancy_count: 0,
          });
        }

        // Run deterministic validations inline
        const findings: any[] = [];

        // Wire total vs deal value
        const totalWires = wires.reduce((s: number, w: any) => s + Number(w.amount), 0);
        const dealValue = Number(deal.deal_value);
        if (dealValue > 0) {
          const variance = totalWires - dealValue;
          const variancePct = Math.abs(variance / dealValue) * 100;
          if (totalWires > dealValue) {
            findings.push({
              id: `ff-total-exceeds-${dealId.slice(0, 8)}`,
              rule_key: "wire_total_exceeds_deal",
              severity: "critical",
              category: "reconciliation",
              title: "Wire total exceeds deal value",
              description: `Total wires ($${totalWires.toLocaleString()}) exceed deal value ($${dealValue.toLocaleString()}) by $${Math.abs(variance).toLocaleString()} (${variancePct.toFixed(1)}%).`,
              expected_value: `≤ $${dealValue.toLocaleString()}`,
              actual_value: `$${totalWires.toLocaleString()}`,
              recommendation: "Review wire instruction amounts. Total disbursements must not exceed the purchase price.",
              affected_entities: wires.map((w: any) => ({ type: "wire", id: w.id, label: `${w.payee_entity}: $${Number(w.amount).toLocaleString()}` })),
            });
          } else if (variancePct > 1 && variance < 0) {
            findings.push({
              id: `ff-shortfall-${dealId.slice(0, 8)}`,
              rule_key: "wire_total_shortfall",
              severity: "high",
              category: "reconciliation",
              title: "Wire total below deal value",
              description: `Total wires ($${totalWires.toLocaleString()}) are $${Math.abs(variance).toLocaleString()} below deal value. May indicate missing allocations.`,
              expected_value: `~$${dealValue.toLocaleString()}`,
              actual_value: `$${totalWires.toLocaleString()}`,
              recommendation: "Verify all payout recipients are accounted for.",
              affected_entities: [{ type: "deal", id: dealId, label: deal.deal_name }],
            });
          }
        }

        // Duplicate payees
        const seen = new Map<string, any[]>();
        for (const w of wires) {
          const key = `${(w.payee_entity || "").toLowerCase().trim()}|${Number(w.amount)}`;
          if (!seen.has(key)) seen.set(key, []);
          seen.get(key)!.push(w);
        }
        for (const [, group] of seen) {
          if (group.length > 1) {
            findings.push({
              id: `ff-dup-${group[0].id.slice(0, 8)}`,
              rule_key: "duplicate_payee",
              severity: "high",
              category: "consistency",
              title: `Duplicate wire: ${group[0].payee_entity}`,
              description: `${group.length} identical wires for "${group[0].payee_entity}" at $${Number(group[0].amount).toLocaleString()}.`,
              expected_value: "1 wire per payee-amount",
              actual_value: `${group.length} duplicates`,
              recommendation: "Remove duplicate wire instructions.",
              affected_entities: group.map((w: any) => ({ type: "wire", id: w.id, label: w.payee_entity })),
            });
          }
        }

        // Missing fields
        for (const w of wires) {
          const missing: string[] = [];
          if (!w.bank_name) missing.push("bank name");
          if (!w.routing_number && !w.swift_bic && !w.iban) missing.push("routing/SWIFT/IBAN");
          if (!w.account_number_last4 && !w.iban) missing.push("account number");
          if (missing.length > 0) {
            findings.push({
              id: `ff-incomplete-${w.id.slice(0, 8)}`,
              rule_key: "missing_wire_fields",
              severity: "medium",
              category: "completeness",
              title: `Incomplete wire: ${w.payee_entity}`,
              description: `Missing: ${missing.join(", ")}`,
              recommendation: `Complete banking details for ${w.payee_entity}.`,
              affected_entities: [{ type: "wire", id: w.id, label: w.payee_entity }],
            });
          }
        }

        // Cap table vs wires
        const wireByPayee = new Map<string, number>();
        for (const w of wires) {
          const key = (w.payee_entity || "").toLowerCase().trim();
          wireByPayee.set(key, (wireByPayee.get(key) || 0) + Number(w.amount));
        }
        for (const entry of capTable) {
          const netPayout = Number(entry.net_payout ?? entry.payout_amount);
          if (netPayout <= 0) continue;
          const key = entry.shareholder_name.toLowerCase().trim();
          const wireAmount = wireByPayee.get(key);
          if (wireAmount === undefined) {
            findings.push({
              id: `ff-nowire-${entry.id.slice(0, 8)}`,
              rule_key: "missing_wire_for_stakeholder",
              severity: "high",
              category: "completeness",
              title: `No wire for ${entry.shareholder_name}`,
              description: `Cap table shows $${netPayout.toLocaleString()} payout but no matching wire instruction.`,
              expected_value: `Wire for $${netPayout.toLocaleString()}`,
              actual_value: "No wire found",
              recommendation: `Add wire instructions for ${entry.shareholder_name}.`,
              affected_entities: [{ type: "stakeholder", id: entry.id, label: entry.shareholder_name }],
            });
          } else if (Math.abs(wireAmount - netPayout) / netPayout > 0.001) {
            findings.push({
              id: `ff-mismatch-${entry.id.slice(0, 8)}`,
              rule_key: "cap_table_wire_mismatch",
              severity: "high",
              category: "reconciliation",
              title: `Wire/payout mismatch: ${entry.shareholder_name}`,
              description: `Wire $${wireAmount.toLocaleString()} vs cap table $${netPayout.toLocaleString()}.`,
              expected_value: `$${netPayout.toLocaleString()}`,
              actual_value: `$${wireAmount.toLocaleString()}`,
              recommendation: `Reconcile wire amount with cap table for ${entry.shareholder_name}.`,
              affected_entities: [{ type: "stakeholder", id: entry.id, label: entry.shareholder_name }],
            });
          }
        }

        // Build summary
        const critical = findings.filter(f => f.severity === "critical").length;
        const high = findings.filter(f => f.severity === "high").length;

        await admin.from("audit_log").insert({
          deal_id: dealId, user_id: userId,
          action: `Newton analyzed funds flow: ${findings.length} findings (${critical} critical)`,
          details: { source: "newton", finding_count: findings.length },
        });

        const summary = findings.length === 0
          ? `✅ **Funds flow analysis complete** — ${wires.length} wire instructions reconcile cleanly against deal value ($${dealValue.toLocaleString()}).`
          : `⚠️ **${findings.length} discrepanc${findings.length === 1 ? "y" : "ies"} detected** in wire instructions.\n\n` +
            `- 🔴 ${critical} critical\n- 🟠 ${high} high\n- 🟡 ${findings.length - critical - high} medium/low\n\n` +
            `**Top issues:**\n${findings.slice(0, 3).map(f => `- ${f.title}`).join("\n")}`;

        return json({
          success: true,
          message: summary,
          discrepancies: findings,
          discrepancy_count: findings.length,
          wire_count: wires.length,
        });
      }

      case "run_discrepancy_check": {
        const dealId = params?.deal_id;
        if (!dealId) return json({ success: false, error: "deal_id required" }, 400);

        // Fetch existing discrepancies from the database
        const { data: discrepancies } = await admin
          .from("discrepancies")
          .select("id, rule_key, severity, message, details, status, object_type, object_id")
          .eq("deal_id", dealId)
          .neq("status", "resolved");

        const discs = (discrepancies || []).map((d: any) => ({
          id: d.id,
          rule_key: d.rule_key,
          severity: d.severity === "blocker" ? "critical" : d.severity,
          category: d.object_type || "deal",
          title: d.message.split(":")[0] || d.message,
          description: d.message,
          recommendation: (d.details as any)?.recommendation || "Review and resolve this discrepancy.",
          affected_entities: [{ type: d.object_type, id: d.object_id, label: d.object_type }],
          expected_value: (d.details as any)?.expected || undefined,
          actual_value: (d.details as any)?.actual || undefined,
        }));

        const critical = discs.filter((d: any) => d.severity === "critical").length;

        return json({
          success: true,
          message: discs.length === 0
            ? "✅ **No discrepancies detected.** All validation checks passed."
            : `⚠️ **${discs.length} discrepanc${discs.length === 1 ? "y" : "ies"} found** (${critical} critical).\n\n` +
              discs.slice(0, 5).map((d: any) => `- **${d.severity.toUpperCase()}:** ${d.description}`).join("\n"),
          discrepancies: discs,
          discrepancy_count: discs.length,
        });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
