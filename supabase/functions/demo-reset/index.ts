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

  return new Response(
    JSON.stringify({ success: true, reset_at: new Date().toISOString(), deals: dealIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});