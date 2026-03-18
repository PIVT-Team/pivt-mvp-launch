import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Try to get the authenticated user from the JWT
    const authHeader = req.headers.get("authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let userId = DEMO_USER_ID;

    if (authHeader.startsWith("Bearer ") && authHeader.slice(7) !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }

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
        ]);

        return json({
          success: true,
          deal_id: data.id,
          deal_name: data.deal_name,
          deal_number: (data as any).deal_number || data.id,
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
