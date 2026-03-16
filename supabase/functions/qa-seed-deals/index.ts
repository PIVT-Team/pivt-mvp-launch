import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Get calling user
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id || null;
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "Authentication required" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const results: Record<string, string> = {};

  // ─── Deal A: Valid payout structure ───
  const { data: dealA } = await admin.from("deals").insert({
    deal_name: "QA Deal A — Valid Payouts",
    deal_number: "",
    deal_value: 10000000,
    currency: "USD",
    escrow_amount: 500000,
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    buyer: "Acme Corp",
    seller: "Delta Holdings",
    deal_type: "M&A",
  }).select("id").single();

  if (dealA) {
    results.deal_a = dealA.id;
    // Add wire instructions that match deal value
    await admin.from("wire_instructions").insert([
      { deal_id: dealA.id, payee_entity: "Delta Holdings", amount: 9500000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "JPMorgan Chase", account_holder: "Delta Holdings LLC", account_number_last4: "4567", routing_number: "021000021" },
      { deal_id: dealA.id, payee_entity: "Escrow Agent — First American", amount: 500000, currency: "USD", payment_type: "Escrow Deposit", verification_status: "verified", bank_name: "First American Trust", account_holder: "First American Title", account_number_last4: "8901", routing_number: "021000089" },
    ]);
    await admin.from("cap_table_entries").insert([
      { deal_id: dealA.id, shareholder_name: "Delta Holdings", ownership_pct: 100, payout_amount: 9500000, escrow_holdback: 500000, role: "Seller" },
    ]);
  }

  // ─── Deal B: Payout totals mismatch ───
  const { data: dealB } = await admin.from("deals").insert({
    deal_name: "QA Deal B — Payout Mismatch",
    deal_number: "",
    deal_value: 5000000,
    currency: "USD",
    escrow_amount: 250000,
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    buyer: "Pinnacle Partners",
    seller: "Vanguard Industries",
    deal_type: "Asset Purchase",
  }).select("id").single();

  if (dealB) {
    results.deal_b = dealB.id;
    // Wires intentionally exceed deal value
    await admin.from("wire_instructions").insert([
      { deal_id: dealB.id, payee_entity: "Vanguard Industries", amount: 4000000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "Bank of America", account_holder: "Vanguard Industries Inc", account_number_last4: "1234", routing_number: "026009593" },
      { deal_id: dealB.id, payee_entity: "Advisory Fee — Goldman", amount: 750000, currency: "USD", payment_type: "Advisory Fee", verification_status: "verified", bank_name: "Goldman Sachs", account_holder: "GS Advisory", account_number_last4: "5678", routing_number: "021000018" },
      { deal_id: dealB.id, payee_entity: "Escrow Agent", amount: 500000, currency: "USD", payment_type: "Escrow Deposit", verification_status: "pending", bank_name: "Wells Fargo", account_holder: "WF Escrow Services", account_number_last4: "9012", routing_number: "121000248" },
    ]);
  }

  // ─── Deal C: Missing bank details ───
  const { data: dealC } = await admin.from("deals").insert({
    deal_name: "QA Deal C — Missing Bank Details",
    deal_number: "",
    deal_value: 3000000,
    currency: "USD",
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    buyer: "Apex Capital",
    seller: "Meridian Group",
    deal_type: "Merger",
  }).select("id").single();

  if (dealC) {
    results.deal_c = dealC.id;
    await admin.from("wire_instructions").insert([
      { deal_id: dealC.id, payee_entity: "Meridian Group", amount: 2500000, currency: "USD", payment_type: "Purchase Price", verification_status: "pending", bank_name: null, account_holder: null, account_number_last4: null, routing_number: null },
      { deal_id: dealC.id, payee_entity: "Legal Fees — Skadden", amount: 500000, currency: "USD", payment_type: "Legal Fee", verification_status: "pending", bank_name: "Citibank", account_holder: "Skadden Arps", account_number_last4: "3456", routing_number: null },
    ]);
  }

  // ─── Deal D: Duplicate recipient ───
  const { data: dealD } = await admin.from("deals").insert({
    deal_name: "QA Deal D — Duplicate Recipient",
    deal_number: "",
    deal_value: 8000000,
    currency: "USD",
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    buyer: "Summit Holdings",
    seller: "Cascade Ventures",
    deal_type: "Stock Purchase",
  }).select("id").single();

  if (dealD) {
    results.deal_d = dealD.id;
    await admin.from("wire_instructions").insert([
      { deal_id: dealD.id, payee_entity: "Cascade Ventures", amount: 4000000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "US Bank", account_holder: "Cascade Ventures LLC", account_number_last4: "7890", routing_number: "091000019" },
      { deal_id: dealD.id, payee_entity: "Cascade Ventures", amount: 4000000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "US Bank", account_holder: "Cascade Ventures LLC", account_number_last4: "7890", routing_number: "091000019" },
    ]);
  }

  return new Response(
    JSON.stringify({ success: true, deals: results, message: "4 QA test deals created" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
