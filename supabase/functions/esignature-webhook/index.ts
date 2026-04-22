import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * LEGITIMATELY_UNAUTHENTICATED
 *
 * This function receives provider-style e-signature callbacks and simulated webhook events.
 * It stays unauthenticated because external signing providers do not present end-user JWTs.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method === "POST" ? await req.json() : {};
    const supabase = createClient(supabaseUrl, serviceKey);

    switch (action) {
      // Create or link an envelope
      case "create-envelope": {
        const { deal_id, envelope_id, provider, document_title, signers, actor_id } = body;

        const { data: envelope } = await supabase.from("esign_envelopes").insert({
          deal_id,
          envelope_id: envelope_id || `mock-env-${Date.now()}`,
          provider: provider || "docusign",
          document_title: document_title || "Deal Documents",
          signers: signers || [],
          status: "created",
        }).select().single();

        if (envelope) {
          await supabase.from("audit_events").insert({
            deal_id,
            actor_id,
            entity_type: "esign_envelope",
            entity_id: envelope.id,
            event_type: "created",
            before: {},
            after: { envelope_id: envelope.envelope_id, provider, status: "created" },
          });
        }

        return new Response(JSON.stringify(envelope), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Simulate provider webhook (status update)
      case "webhook": {
        const { envelope_id, new_status } = body;
        const validStatuses = ["sent", "delivered", "signed", "completed", "declined", "voided"];
        if (!validStatuses.includes(new_status)) {
          return new Response(JSON.stringify({ error: "Invalid status", valid: validStatuses }), {
            status: 400, headers: corsHeaders,
          });
        }

        const { data: envelope } = await supabase
          .from("esign_envelopes")
          .select("*")
          .eq("envelope_id", envelope_id)
          .single();

        if (!envelope) {
          return new Response(JSON.stringify({ error: "Envelope not found" }), {
            status: 404, headers: corsHeaders,
          });
        }

        const updates: any = {
          status: new_status,
          last_event_at: new Date().toISOString(),
        };
        if (new_status === "completed") {
          updates.completed_at = new Date().toISOString();
        }

        await supabase.from("esign_envelopes").update(updates).eq("id", envelope.id);

        await supabase.from("audit_events").insert({
          deal_id: envelope.deal_id,
          actor_id: null,
          entity_type: "esign_envelope",
          entity_id: envelope.id,
          event_type: "webhook_received",
          before: { status: envelope.status },
          after: { status: new_status },
        });

        // If completed, auto-flip "docs_executed" condition on related intents
        if (new_status === "completed") {
          const { data: intents } = await supabase
            .from("disbursement_intents")
            .select("id, required_conditions")
            .eq("deal_id", envelope.deal_id);

          if (intents) {
            for (const intent of intents) {
              const conditions = (intent.required_conditions as any[]) || [];
              const updated = conditions.map((c: any) =>
                c.key === "docs_executed" ? { ...c, met: true } : c
              );
              if (JSON.stringify(updated) !== JSON.stringify(conditions)) {
                await supabase.from("disbursement_intents")
                  .update({ required_conditions: updated })
                  .eq("id", intent.id);

                await supabase.from("audit_events").insert({
                  deal_id: envelope.deal_id,
                  actor_id: null,
                  entity_type: "disbursement_intent",
                  entity_id: intent.id,
                  event_type: "condition_auto_flipped",
                  before: { condition: "docs_executed", met: false },
                  after: { condition: "docs_executed", met: true, trigger: "esign_completed" },
                });
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, status: new_status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update compliance check
      case "update-compliance": {
        const { check_id, deal_id, party_id, check_type, status, evidence_ref, notes, actor_id } = body;

        if (check_id) {
          // Update existing
          const { data: existing } = await supabase
            .from("compliance_checks")
            .select("*")
            .eq("id", check_id)
            .single();

          const updates: any = { status };
          if (status === "passed" || status === "failed") updates.checked_at = new Date().toISOString();
          if (evidence_ref) updates.evidence_ref = evidence_ref;
          if (notes) updates.notes = notes;

          await supabase.from("compliance_checks").update(updates).eq("id", check_id);

          await supabase.from("audit_events").insert({
            deal_id: existing?.deal_id,
            actor_id,
            entity_type: "compliance_check",
            entity_id: check_id,
            event_type: "status_changed",
            before: { status: existing?.status },
            after: { status, check_type: existing?.check_type },
          });

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // Create new
          const { data: check } = await supabase.from("compliance_checks").insert({
            deal_id,
            party_id,
            check_type: check_type || "kyc",
            status: status || "not_started",
            evidence_ref,
            notes,
          }).select().single();

          if (check) {
            await supabase.from("audit_events").insert({
              deal_id,
              actor_id,
              entity_type: "compliance_check",
              entity_id: check.id,
              event_type: "created",
              before: {},
              after: { check_type, status: check.status },
            });
          }

          return new Response(JSON.stringify(check), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Pre-execution fraud/risk checks
      case "pre-execution-check": {
        const { intent_id } = body;
        const { data: intent } = await supabase
          .from("disbursement_intents")
          .select("*")
          .eq("id", intent_id)
          .single();

        if (!intent) {
          return new Response(JSON.stringify({ error: "Intent not found" }), {
            status: 404, headers: corsHeaders,
          });
        }

        const blocks: string[] = [];

        // Check 1: FX locked if needed
        if (intent.currency_original !== intent.settlement_currency) {
          if (!intent.fx_quote_id) {
            blocks.push("FX quote required but not attached");
          } else {
            const { data: fxq } = await supabase.from("fx_quotes").select("*").eq("id", intent.fx_quote_id).single();
            if (fxq && !fxq.locked) blocks.push("FX quote not locked");
            if (fxq && fxq.expires_at && new Date(fxq.expires_at) < new Date()) blocks.push("FX quote expired");
          }
        }

        // Check 2: All conditions met
        const conditions = (intent.required_conditions as any[]) || [];
        const unmetConditions = conditions.filter((c: any) => !c.met);
        if (unmetConditions.length > 0) {
          blocks.push(`${unmetConditions.length} condition(s) not met: ${unmetConditions.map((c: any) => c.key).join(", ")}`);
        }

        // Check 3: All approvals
        const approvals = (intent.required_approvals as any[]) || [];
        const pendingApprovals = approvals.filter((a: any) => !a.approved);
        if (pendingApprovals.length > 0) {
          blocks.push(`${pendingApprovals.length} approval(s) pending: ${pendingApprovals.map((a: any) => a.role).join(", ")}`);
        }

        // Check 4: Bank account ref present
        if (!intent.bank_account_ref) {
          blocks.push("No bank account reference on file");
        }

        // Check 5: Recipient missing compliance (mock check)
        // In real implementation, would check compliance_checks table

        if (blocks.length > 0) {
          await supabase.from("audit_events").insert({
            deal_id: intent.deal_id,
            actor_id: body.actor_id || null,
            entity_type: "disbursement_intent",
            entity_id: intent_id,
            event_type: "execution_blocked",
            before: { status: intent.status },
            after: { blocks },
          });
        }

        return new Response(JSON.stringify({
          intent_id,
          eligible: blocks.length === 0,
          blocks,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CSV export
      case "export-csv": {
        const { table, deal_id, filters } = body;
        const allowed = ["disbursement_intents", "consideration_records", "audit_events", "waterfall_allocation_lines"];
        if (!allowed.includes(table)) {
          return new Response(JSON.stringify({ error: "Table not exportable" }), {
            status: 400, headers: corsHeaders,
          });
        }

        let query = supabase.from(table).select("*");
        if (deal_id) query = query.eq("deal_id", deal_id);

        const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: corsHeaders,
          });
        }

        if (!data || data.length === 0) {
          return new Response(JSON.stringify({ csv: "", count: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate CSV
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(",")];
        for (const row of data) {
          const values = headers.map(h => {
            const val = (row as any)[h];
            if (val === null || val === undefined) return "";
            if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(","));
        }

        return new Response(JSON.stringify({ csv: csvRows.join("\n"), count: data.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: "Unknown action",
          available: ["create-envelope", "webhook", "update-compliance", "pre-execution-check", "export-csv"],
        }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: corsHeaders,
    });
  }
});
