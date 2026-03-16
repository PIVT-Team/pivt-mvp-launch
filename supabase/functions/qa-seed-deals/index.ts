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

  // ─── Demo 1: Healthy Deal — no blocking issues ───
  const { data: deal1 } = await admin.from("deals").insert({
    deal_name: "Demo — Healthy Close (Greenfield Solar)",
    deal_number: "",
    deal_value: 15000000,
    currency: "USD",
    escrow_amount: 750000,
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    deal_state: "execution",
    buyer: "CleanTech Ventures",
    seller: "Greenfield Solar Holdings",
    deal_type: "Asset Purchase",
    sector: "Renewable Energy",
    target_company: "Greenfield Solar Inc.",
    closing_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  }).select("id").single();

  if (deal1) {
    results.healthy = deal1.id;
    // Wire instructions that exactly match deal value
    await admin.from("wire_instructions").insert([
      { deal_id: deal1.id, payee_entity: "Greenfield Solar Holdings", amount: 14250000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "JPMorgan Chase", account_holder: "Greenfield Solar Holdings LLC", account_number_last4: "4567", routing_number: "021000021" },
      { deal_id: deal1.id, payee_entity: "Escrow Agent — First American", amount: 750000, currency: "USD", payment_type: "Escrow Deposit", verification_status: "verified", bank_name: "First American Trust", account_holder: "First American Title Insurance", account_number_last4: "8901", routing_number: "021000089" },
    ]);
    await admin.from("cap_table_entries").insert([
      { deal_id: deal1.id, shareholder_name: "Greenfield Solar Holdings", ownership_pct: 100, payout_amount: 14250000, escrow_holdback: 750000, role: "Seller" },
    ]);
    // Add approvals — all completed
    await admin.from("deal_approvals").insert([
      { deal_id: deal1.id, user_id: userId, approval_side: "buyer", approver_name: "Sarah Chen", approver_email: "sarah@cleantech.com", approver_role: "General Counsel", status: "completed", completed_at: new Date().toISOString() },
      { deal_id: deal1.id, user_id: userId, approval_side: "seller", approver_name: "James Rivera", approver_email: "james@greenfield.com", approver_role: "CFO", status: "completed", completed_at: new Date().toISOString() },
    ]);
    // Add conditions — all satisfied
    await admin.from("conditions").insert([
      { deal_id: deal1.id, title: "Environmental assessment complete", status: "SATISFIED" },
      { deal_id: deal1.id, title: "Board approval obtained", status: "SATISFIED" },
      { deal_id: deal1.id, title: "Regulatory clearance received", status: "SATISFIED" },
    ]);
  }

  // ─── Demo 2: Payout Mismatch Discrepancy ───
  const { data: deal2 } = await admin.from("deals").insert({
    deal_name: "Demo — Payout Mismatch (Meridian Logistics)",
    deal_number: "",
    deal_value: 8000000,
    currency: "USD",
    escrow_amount: 400000,
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    deal_state: "validation",
    buyer: "Atlas Freight Corp",
    seller: "Meridian Logistics Group",
    deal_type: "M&A",
    sector: "Transportation & Logistics",
    target_company: "Meridian Logistics Inc.",
    closing_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
  }).select("id").single();

  if (deal2) {
    results.mismatch = deal2.id;
    // Wires intentionally exceed deal value ($8M deal, $9.25M in wires)
    await admin.from("wire_instructions").insert([
      { deal_id: deal2.id, payee_entity: "Meridian Logistics Group", amount: 7200000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "Bank of America", account_holder: "Meridian Logistics Group Inc", account_number_last4: "1234", routing_number: "026009593" },
      { deal_id: deal2.id, payee_entity: "Advisory Fee — Lazard", amount: 1250000, currency: "USD", payment_type: "Advisory Fee", verification_status: "verified", bank_name: "Lazard Ltd", account_holder: "Lazard Frères & Co", account_number_last4: "5678", routing_number: "021000018" },
      { deal_id: deal2.id, payee_entity: "Escrow Agent — Wilmington Trust", amount: 800000, currency: "USD", payment_type: "Escrow Deposit", verification_status: "pending", bank_name: "Wilmington Trust", account_holder: "WT Escrow Services", account_number_last4: "9012", routing_number: "031100092" },
    ]);
    // Approvals — buyer done, seller pending
    await admin.from("deal_approvals").insert([
      { deal_id: deal2.id, user_id: userId, approval_side: "buyer", approver_name: "Michael Torres", approver_email: "mtorres@atlasfreight.com", approver_role: "VP Corporate Development", status: "completed", completed_at: new Date().toISOString() },
      { deal_id: deal2.id, user_id: userId, approval_side: "seller", approver_name: "Linda Park", approver_email: "lpark@meridian.com", approver_role: "General Counsel", status: "pending" },
    ]);
  }

  // ─── Demo 3: Unresolved Approval / Closing Blocker ───
  const { data: deal3 } = await admin.from("deals").insert({
    deal_name: "Demo — Blocked Close (Cipher Health)",
    deal_number: "",
    deal_value: 22000000,
    currency: "USD",
    escrow_amount: 2200000,
    owner_id: userId,
    created_by: userId,
    visibility: "private",
    deal_kind: "live",
    status: "active",
    deal_state: "blocked",
    blocked_reason: "Pending regulatory approval and outstanding seller counsel sign-off",
    buyer: "Titan Strategic Group",
    seller: "Cipher Health Partners",
    deal_type: "Merger",
    sector: "Healthcare Technology",
    target_company: "Cipher Health Systems",
    closing_date: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
  }).select("id").single();

  if (deal3) {
    results.blocked = deal3.id;
    // Wires are valid
    await admin.from("wire_instructions").insert([
      { deal_id: deal3.id, payee_entity: "Cipher Health Partners", amount: 19800000, currency: "USD", payment_type: "Purchase Price", verification_status: "verified", bank_name: "Goldman Sachs", account_holder: "Cipher Health Partners LP", account_number_last4: "3456", routing_number: "021000018" },
      { deal_id: deal3.id, payee_entity: "Escrow Agent — BNY Mellon", amount: 2200000, currency: "USD", payment_type: "Escrow Deposit", verification_status: "verified", bank_name: "BNY Mellon", account_holder: "BNY Mellon Escrow", account_number_last4: "7890", routing_number: "021000018" },
    ]);
    // Approvals — one declined, one pending
    await admin.from("deal_approvals").insert([
      { deal_id: deal3.id, user_id: userId, approval_side: "buyer", approver_name: "David Kim", approver_email: "dkim@titan.com", approver_role: "CEO", status: "completed", completed_at: new Date().toISOString() },
      { deal_id: deal3.id, user_id: userId, approval_side: "seller", approver_name: "Rachel Nguyen", approver_email: "rnguyen@cipher.com", approver_role: "General Counsel", status: "declined", declined_at: new Date().toISOString(), blocker_reason: "Outstanding regulatory clearance from FDA" },
      { deal_id: deal3.id, user_id: userId, approval_side: "regulatory", approver_name: "FDA CDRH Division", approver_email: "regulatory@fda.gov", approver_role: "Regulatory Body", status: "pending" },
    ]);
    // Conditions — some unmet
    await admin.from("conditions").insert([
      { deal_id: deal3.id, title: "FDA 510(k) clearance obtained", status: "NOT_STARTED" },
      { deal_id: deal3.id, title: "HSR Act filing approved", status: "IN_PROGRESS" },
      { deal_id: deal3.id, title: "IP assignment agreements executed", status: "SATISFIED" },
      { deal_id: deal3.id, title: "Key employee retention agreements signed", status: "NOT_STARTED" },
    ]);
  }

  return new Response(
    JSON.stringify({
      success: true,
      deals: results,
      message: "3 polished demo scenarios created: Healthy Close, Payout Mismatch, Blocked Close",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
