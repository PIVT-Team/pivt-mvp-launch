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
    buyer: "Apex Capital Partners",
    seller: "Northbridge Software",
    target_company: "Northbridge Software",
    sector: "Enterprise SaaS",
    deal_type: "Acquisition",
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
    buyer: "Meridian Holdings",
    seller: "CloudVault Security",
    target_company: "CloudVault Security",
    sector: "Cybersecurity",
    deal_type: "Acquisition",
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
    buyer: "Titan Strategic Group",
    seller: "NeuralPath AI",
    target_company: "NeuralPath AI",
    sector: "Artificial Intelligence",
    deal_type: "Acquisition",
  },
];

// ── Canonical demo stakeholders per deal ──
const ATLAS_STAKEHOLDERS = [
  { shareholder_name: "Sarah Chen", role: "Founder", stakeholder_type: "individual", ownership_pct: 30, payout_amount: 42750000, email: "schen@northbridge.io", verification_status: "verified" },
  { shareholder_name: "Marcus Williams", role: "Founder", stakeholder_type: "individual", ownership_pct: 20, payout_amount: 28500000, email: "mwilliams@northbridge.io", verification_status: "verified" },
  { shareholder_name: "Sequoia Capital Fund XIV", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 15, payout_amount: 21375000, email: "legal@sequoia.com", verification_status: "verified" },
  { shareholder_name: "Andreessen Horowitz", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 10, payout_amount: 14250000, email: "closings@a16z.com", verification_status: "sent" },
  { shareholder_name: "Tiger Global Management", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 8, payout_amount: 11400000, email: "ops@tigerglobal.com", verification_status: "verified" },
  { shareholder_name: "Employee Option Pool", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 7, payout_amount: 9975000, email: "esop@northbridge.io", verification_status: "sent" },
  { shareholder_name: "Index Ventures", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 6, payout_amount: 8550000, email: "legal@indexventures.com", verification_status: "verified" },
  { shareholder_name: "GIC Private Limited", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 4, payout_amount: 5700000, email: "investments@gic.com.sg", verification_status: "failed" },
  { shareholder_name: "Apex Capital Partners", role: "Buyer", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "deals@apexcap.com", verification_status: "verified" },
  { shareholder_name: "Cooley LLP", role: "Buyer Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@cooley.com", verification_status: "verified" },
  { shareholder_name: "Wilson Sonsini", role: "Seller Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@wsgr.com", verification_status: "verified" },
  { shareholder_name: "JPMorgan Chase", role: "Escrow Agent", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "escrow@jpmorgan.com", verification_status: "verified" },
];

const BEACON_STAKEHOLDERS = [
  { shareholder_name: "James Rodriguez", role: "Founder", stakeholder_type: "individual", ownership_pct: 35, payout_amount: 31150000, email: "jrod@cloudvault.io", verification_status: "verified" },
  { shareholder_name: "Priya Sharma", role: "Founder", stakeholder_type: "individual", ownership_pct: 25, payout_amount: 22250000, email: "psharma@cloudvault.io", verification_status: "verified" },
  { shareholder_name: "Accel Partners", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 15, payout_amount: 13350000, email: "legal@accel.com", verification_status: "verified" },
  { shareholder_name: "Insight Partners", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 10, payout_amount: 8900000, email: "ops@insightpartners.com", verification_status: "sent" },
  { shareholder_name: "Greylock Partners", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 8, payout_amount: 7120000, email: "legal@greylock.com", verification_status: "verified" },
  { shareholder_name: "ESOP Trust", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 7, payout_amount: 6230000, email: "esop@cloudvault.io", verification_status: "sent" },
  { shareholder_name: "Meridian Holdings", role: "Buyer", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "deals@meridian.com", verification_status: "verified" },
  { shareholder_name: "Latham & Watkins", role: "Buyer Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@lw.com", verification_status: "verified" },
  { shareholder_name: "Fenwick & West", role: "Seller Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@fenwick.com", verification_status: "verified" },
  { shareholder_name: "Bank of America", role: "Escrow Agent", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "escrow@bofa.com", verification_status: "sent" },
];

const CIPHER_STAKEHOLDERS = [
  { shareholder_name: "Dr. Anika Patel", role: "Founder", stakeholder_type: "individual", ownership_pct: 22, payout_amount: 47300000, email: "apatel@neuralpath.ai", verification_status: "verified" },
  { shareholder_name: "Ryan Kim", role: "Founder", stakeholder_type: "individual", ownership_pct: 18, payout_amount: 38700000, email: "rkim@neuralpath.ai", verification_status: "verified" },
  { shareholder_name: "Lightspeed Venture Partners", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 12, payout_amount: 25800000, email: "legal@lsvp.com", verification_status: "verified" },
  { shareholder_name: "Coatue Management", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 10, payout_amount: 21500000, email: "ops@coatue.com", verification_status: "verified" },
  { shareholder_name: "General Catalyst", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 8, payout_amount: 17200000, email: "legal@generalcatalyst.com", verification_status: "verified" },
  { shareholder_name: "Founders Fund", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 7, payout_amount: 15050000, email: "closings@foundersfund.com", verification_status: "verified" },
  { shareholder_name: "Bessemer Venture Partners", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 6, payout_amount: 12900000, email: "legal@bvp.com", verification_status: "verified" },
  { shareholder_name: "NVIDIA Ventures", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 5, payout_amount: 10750000, email: "ventures@nvidia.com", verification_status: "verified" },
  { shareholder_name: "Employee Option Pool", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 7, payout_amount: 15050000, email: "esop@neuralpath.ai", verification_status: "verified" },
  { shareholder_name: "Angel Syndicate", role: "Shareholder", stakeholder_type: "entity", ownership_pct: 5, payout_amount: 10750000, email: "admin@angelsyndicate.co", verification_status: "verified" },
  { shareholder_name: "Titan Strategic Group", role: "Buyer", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "deals@titanstrategic.com", verification_status: "verified" },
  { shareholder_name: "Sullivan & Cromwell", role: "Buyer Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@sullcrom.com", verification_status: "verified" },
  { shareholder_name: "Goodwin Procter", role: "Seller Counsel", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "closings@goodwin.com", verification_status: "verified" },
  { shareholder_name: "Citibank N.A.", role: "Escrow Agent", stakeholder_type: "entity", ownership_pct: 0, payout_amount: 0, email: "escrow@citi.com", verification_status: "sent" },
];

const DEAL_STAKEHOLDERS: Record<string, typeof ATLAS_STAKEHOLDERS> = {
  "a0000000-0000-0000-0000-000000000001": ATLAS_STAKEHOLDERS,
  "b0000000-0000-0000-0000-000000000002": BEACON_STAKEHOLDERS,
  "c0000000-0000-0000-0000-000000000003": CIPHER_STAKEHOLDERS,
};

// ── Canonical demo documents per deal ──
// These are seeded into contract_documents so document counts are accurate everywhere.
const ATLAS_DOCUMENTS = [
  { filename: "Merger_Agreement_Northbridge_v4.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "CapTable_Northbridge_Final.xlsx", doc_type: "CAP_TABLE", status: "VERIFIED" },
  { filename: "Waterfall_Distribution_v3.xlsx", doc_type: "FUNDS_FLOW", status: "UPLOADED" },
  { filename: "Wire_Instructions_Sequoia.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_a16z.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "UPLOADED" },
  { filename: "Wire_Instructions_TigerGlobal.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_IndexVentures.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_GIC.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "UPLOADED" },
  { filename: "Escrow_Agreement_JPMorgan.pdf", doc_type: "ESCROW_AGREEMENT", status: "VERIFIED" },
  { filename: "Board_Resolutions_Northbridge.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Disclosure_Schedules_v2.pdf", doc_type: "DISCLOSURE_SCHEDULES", status: "VERIFIED" },
  { filename: "KYC_Package_Sequoia.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "KYC_Package_a16z.pdf", doc_type: "SPA", status: "UPLOADED" },
  { filename: "Tax_Certificates_Bundle.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Employment_Agreements_KeyExecs.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "IP_Assignment_Agreement.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Stockholder_Written_Consent.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "FIRPTA_Certificate.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Good_Standing_Certificate_DE.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Officers_Certificate.pdf", doc_type: "SPA", status: "VERIFIED" },
];

const BEACON_DOCUMENTS = [
  { filename: "Credit_Agreement_Beacon.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Security_Agreement.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Guaranty_Agreement.pdf", doc_type: "SPA", status: "UPLOADED" },
  { filename: "Intercreditor_Agreement.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Compliance_Certificate.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Financial_Statements_Q3.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Insurance_Certificate.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Wire_Instructions_Meridian.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_Accel.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_Insight.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "UPLOADED" },
  { filename: "Escrow_Agreement_BofA.pdf", doc_type: "ESCROW_AGREEMENT", status: "UPLOADED" },
  { filename: "Board_Resolution_CloudVault.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "IP_Due_Diligence_Report.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Penetration_Test_Results.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "SOC2_Type_II_Report.pdf", doc_type: "SPA", status: "VERIFIED" },
];

const CIPHER_DOCUMENTS = [
  { filename: "Merger_Agreement_NeuralPath_v6.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "CapTable_NeuralPath_Final.xlsx", doc_type: "CAP_TABLE", status: "VERIFIED" },
  { filename: "Waterfall_Distribution_NeuralPath.xlsx", doc_type: "FUNDS_FLOW", status: "VERIFIED" },
  { filename: "Escrow_Agreement_Citi.pdf", doc_type: "ESCROW_AGREEMENT", status: "VERIFIED" },
  { filename: "Disclosure_Schedules_NeuralPath.pdf", doc_type: "DISCLOSURE_SCHEDULES", status: "VERIFIED" },
  { filename: "Wire_Instructions_Lightspeed.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_Coatue.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_GeneralCatalyst.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_FoundersFund.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_Bessemer.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_NVIDIA.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_AngelSyndicate.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Wire_Instructions_ESOP.pdf", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
  { filename: "Board_Resolutions_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "IP_Assignment_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "AI_Model_License_Agreement.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Data_Processing_Agreement.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Employee_Offer_Letters_Bundle.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "FIRPTA_Certificate_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Good_Standing_DE.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Officers_Certificate_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Stockholder_Consent_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Tax_Certificates_NeuralPath.pdf", doc_type: "SPA", status: "VERIFIED" },
  { filename: "Transition_Services_Agreement.pdf", doc_type: "TSA", status: "UPLOADED" },
];

const DEAL_DOCUMENTS: Record<string, typeof ATLAS_DOCUMENTS> = {
  "a0000000-0000-0000-0000-000000000001": ATLAS_DOCUMENTS,
  "b0000000-0000-0000-0000-000000000002": BEACON_DOCUMENTS,
  "c0000000-0000-0000-0000-000000000003": CIPHER_DOCUMENTS,
};

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
    "wire_instructions",
    "payment_allocations",
    "verification_documents",
    "verification_requests",
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

  // ── Seed canonical stakeholders (cap_table_entries) for each demo deal ──
  const stkErrors: string[] = [];
  for (const dealId of dealIds) {
    const stakeholders = DEAL_STAKEHOLDERS[dealId] || [];
    for (const stk of stakeholders) {
      const { error } = await supabaseAdmin.from("cap_table_entries").insert({
        deal_id: dealId,
        ...stk,
      } as any);
      if (error) stkErrors.push(`${stk.shareholder_name}: ${error.message}`);
    }
  }

  // ── Seed canonical documents (contract_documents) for each demo deal ──
  const docErrors: string[] = [];
  for (const dealId of dealIds) {
    const docs = DEAL_DOCUMENTS[dealId] || [];
    for (const doc of docs) {
      const { error } = await supabaseAdmin.from("contract_documents").insert({
        deal_id: dealId,
        filename: doc.filename,
        doc_type: doc.doc_type,
        status: doc.status,
      } as any);
      if (error) docErrors.push(`${doc.filename}: ${error.message}`);
    }
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
    JSON.stringify({
      success: true,
      reset_at: new Date().toISOString(),
      deals: dealIds.length,
      stakeholder_errors: stkErrors,
      document_errors: docErrors,
      seeded: {
        atlas: { stakeholders: ATLAS_STAKEHOLDERS.length, documents: ATLAS_DOCUMENTS.length },
        beacon: { stakeholders: BEACON_STAKEHOLDERS.length, documents: BEACON_DOCUMENTS.length },
        cipher: { stakeholders: CIPHER_STAKEHOLDERS.length, documents: CIPHER_DOCUMENTS.length },
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
