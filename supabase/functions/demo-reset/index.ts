import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_USER_ID = "7def4eb3-14c8-412c-8ec8-155d45e6e8b2";

const DEMO_DEALS = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    deal_name: "Project ATLAS",
    deal_number: "PIVT-2026-000142",
    deal_value: 142500000,
    escrow_amount: 14250000,
    status: "active",
    closing_date: "2025-01-15",
    seed_key: "atlas_demo",
    deal_kind: "demo",
    created_by: DEMO_USER_ID,
    owner_id: null,
    visibility: "global_demo",
    is_demo: true,
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    deal_name: "Project BEACON",
    deal_number: "PIVT-2026-000143",
    deal_value: 89000000,
    escrow_amount: 8900000,
    status: "active",
    closing_date: "2025-01-18",
    seed_key: "beacon_demo",
    deal_kind: "demo",
    created_by: DEMO_USER_ID,
    owner_id: null,
    visibility: "global_demo",
    is_demo: true,
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    deal_name: "Project CIPHER",
    deal_number: "PIVT-2026-000144",
    deal_value: 215000000,
    escrow_amount: 21500000,
    status: "active",
    closing_date: "2025-01-22",
    seed_key: "cipher_demo",
    deal_kind: "demo",
    created_by: DEMO_USER_ID,
    owner_id: null,
    visibility: "global_demo",
    is_demo: true,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dealIds = DEMO_DEALS.map((d) => d.id);

  // Delete child table data for demo deals (order matters for FK constraints)
  const childTables = [
    "execution_events",
    "obligation_intent_map",
    "disbursement_intents",
    "waterfall_allocation_lines",
    "waterfall_allocations",
    "waterfall_tiers",
    "deal_approvals",
    "deal_comments",
    "comment_mentions",
    "discrepancies",
    "obligations",
    "contract_documents",
    "deal_documents",
    "cap_table_entries",
    "escrow_transactions",
    "escrow_accounts",
    "conditions",
    "deal_settings",
    "deal_user_roles",
    "deal_participants",
    "deal_parties",
    "ontology_approvals",
    "ontology_documents",
    "payment_instructions",
    "consideration_records",
    "fx_quotes",
    "audit_events",
    "audit_log",
    "validation_results",
    "tax_forms",
    "tax_recipients",
  ];

  for (const table of childTables) {
    await supabaseAdmin.from(table).delete().in("deal_id", dealIds);
  }

  // Upsert the golden-state demo deals
  for (const deal of DEMO_DEALS) {
    await supabaseAdmin.from("deals").upsert(deal as any, { onConflict: "id" });
  }

  // Re-seed demo deal participants (demo user as admin)
  for (const id of dealIds) {
    await supabaseAdmin.from("deal_participants").insert({
      deal_id: id,
      user_id: DEMO_USER_ID,
      party_role: "admin",
    });
    await supabaseAdmin.from("deal_settings").insert({ deal_id: id });
  }

  // Seed conditions for ATLAS (example golden state)
  const atlasConditions = [
    "SPA Fully Executed",
    "Board Approvals Obtained",
    "Funds Confirmed in Escrow",
    "Escrow Account Established",
    "Payment Instructions Verified",
    "Third-Party Consents Received",
    "Regulatory Approvals Cleared",
    "Working Capital Adjustment Calculated",
    "Closing Statement Delivered",
  ];

  for (const title of atlasConditions) {
    await supabaseAdmin.from("conditions").insert({
      deal_id: DEMO_DEALS[0].id,
      title,
      status: "MET",
    } as any);
  }

  // Seed tax recipients for ATLAS demo
  const taxRecipients = [
    { deal_id: DEMO_DEALS[0].id, name: "David Patel", recipient_type: "individual", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "Emily Chen", recipient_type: "individual", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "Seed Fund I LP", recipient_type: "entity", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "Angel Investors", recipient_type: "entity", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "Employee Option Pool", recipient_type: "entity", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "Cooley LLP", recipient_type: "entity", tax_residency: "us" },
    { deal_id: DEMO_DEALS[0].id, name: "WSGR", recipient_type: "entity", tax_residency: "us" },
  ];

  const insertedRecipients: { id: string; name: string }[] = [];
  for (const tr of taxRecipients) {
    const { data } = await supabaseAdmin.from("tax_recipients").insert(tr as any).select("id, name").single();
    if (data) insertedRecipients.push(data);
  }

  // Seed tax forms — most have W-9s on file, but David Patel and Seed Fund I are MISSING
  for (const r of insertedRecipients) {
    const isMissing = r.name === "David Patel" || r.name === "Seed Fund I LP";
    if (!isMissing) {
      await supabaseAdmin.from("tax_forms").insert({
        deal_id: DEMO_DEALS[0].id,
        recipient_id: r.id,
        form_type: "W9",
        status: "verified",
        signed_date: "2026-01-10",
        tin_last4: String(1000 + Math.floor(Math.random() * 9000)),
      } as any);
    }
  }

  return new Response(
    JSON.stringify({ success: true, reset_at: new Date().toISOString(), deals: dealIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});