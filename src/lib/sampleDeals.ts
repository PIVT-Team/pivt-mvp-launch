// sampleDeals — 7 demo M&A transactions for showcasing the platform.
//
// Each deal carries a stable `seed_key` so the seeder is idempotent:
//   - "Load sample deals" → only creates missing seed_keys
//   - If all 7 already exist, surfaces a "already loaded" message
//   - Delete a sample deal individually → next "Load" only re-creates it
//
// Deals are designed to exercise different workspace states and feature
// surfaces:
//
//   1. Atlas Acquisition       — Golden path, ready_for_execution
//   2. Helios Acquisition      — Active KYC, demos manual approve/reject
//   3. Orion Health            — Awaiting approvals, demos approval queue
//   4. Ember Solutions         — Post-close, demos audit + reports
//   5. Lighthouse Capital      — Funds flow mismatch, demos discrepancy
//   6. Nimbus AI               — Complex cap table, demos doc-AI ingest
//   7. Vector IP               — Asset acquisition (different deal type)

export interface SampleStakeholder {
  shareholder_name: string;
  ownership_pct: number;
  payout_amount: number;
  escrow_holdback: number;
  role: string;
  verification_status: string;
  email?: string;
  stakeholder_type?: 'individual' | 'entity';
}

export interface SampleWire {
  payee_entity: string;
  amount: number;
  currency: string;
  payment_type: string;
  verification_status: string;
  bank_name: string;
  account_holder: string;
  account_number_last4: string;
  routing_number: string;
}

export interface SampleDocument {
  filename: string;
  doc_type: string;
  status: string;
}

export interface SampleApproval {
  approver_name: string;
  approver_email: string;
  approver_role: string;
  approval_side: 'buyer' | 'seller';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  blocker_reason?: string;
}

export interface SampleDeal {
  seed_key: string;
  deal_name: string;
  deal_value: number;
  currency: string;
  escrow_amount: number;
  buyer: string;
  seller: string;
  target_company: string;
  deal_type: string;
  sector: string;
  jurisdiction?: string;
  closing_date_offset_days: number; // +N from today
  status: string;
  deal_state: string;
  stakeholders: SampleStakeholder[];
  wires: SampleWire[];
  documents: SampleDocument[];
  approvals?: SampleApproval[];
}

export const SAMPLE_DEALS: SampleDeal[] = [
  // ───────────────────────────────────────────────
  // 1. Atlas Acquisition — Golden path (everything green, ready to execute)
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-atlas-v1',
    deal_name: 'Atlas Acquisition',
    deal_value: 420000000,
    currency: 'USD',
    escrow_amount: 21000000,
    buyer: 'Atlas Capital Partners',
    seller: 'Meridian Software Holdings',
    target_company: 'Meridian Software Inc.',
    deal_type: 'M&A',
    sector: 'Enterprise Software',
    jurisdiction: 'Delaware',
    closing_date_offset_days: 3,
    status: 'active',
    deal_state: 'ready_for_execution',
    stakeholders: [
      { shareholder_name: 'Meridian Software Holdings, LLC', ownership_pct: 78, payout_amount: 311220000, escrow_holdback: 16380000, role: 'Seller', verification_status: 'verified', email: 'cfo@meridian.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Atlas Capital Partners III LP', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'deals@atlas.com', stakeholder_type: 'entity' },
      { shareholder_name: 'David Sterling (Founder)', ownership_pct: 15, payout_amount: 59850000, escrow_holdback: 3150000, role: 'Founder', verification_status: 'verified', email: 'david@meridian.com', stakeholder_type: 'individual' },
      { shareholder_name: 'Sequoia Growth Fund VI', ownership_pct: 7, payout_amount: 27930000, escrow_holdback: 1470000, role: 'Investor', verification_status: 'verified', email: 'lp-services@sequoia.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Meridian Software Holdings, LLC', amount: 311220000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'verified', bank_name: 'JPMorgan Chase', account_holder: 'Meridian Software Holdings LLC', account_number_last4: '7890', routing_number: '021000021' },
      { payee_entity: 'Atlas Escrow — First American', amount: 21000000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'First American Trust', account_holder: 'First American Title', account_number_last4: '3456', routing_number: '021000089' },
      { payee_entity: 'David Sterling', amount: 59850000, currency: 'USD', payment_type: 'Founder Payout', verification_status: 'verified', bank_name: 'Goldman Sachs Private', account_holder: 'David Sterling', account_number_last4: '4521', routing_number: '021000018' },
    ],
    documents: [
      { filename: 'Stock Purchase Agreement — Executed.pdf', doc_type: 'SPA', status: 'PARSED' },
      { filename: 'Funds Flow Memorandum.xlsx', doc_type: 'FUNDS_FLOW', status: 'VERIFIED' },
      { filename: 'Escrow Agreement.pdf', doc_type: 'ESCROW_AGREEMENT', status: 'PARSED' },
      { filename: 'Wire Authorization Letter.pdf', doc_type: 'WIRE_INSTRUCTIONS', status: 'VERIFIED' },
      { filename: 'Disclosure Schedules.pdf', doc_type: 'DISCLOSURE_SCHEDULES', status: 'PARSED' },
    ],
    approvals: [
      { approver_name: 'Marcus Webb', approver_email: 'mwebb@atlas.com', approver_role: 'Managing Partner', approval_side: 'buyer', status: 'completed' },
      { approver_name: 'Lisa Chen', approver_email: 'lchen@meridian.com', approver_role: 'CFO', approval_side: 'seller', status: 'completed' },
    ],
  },

  // ───────────────────────────────────────────────
  // 2. Helios Acquisition — Active KYC, in diligence
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-helios-v1',
    deal_name: 'Helios Acquisition',
    deal_value: 185000000,
    currency: 'USD',
    escrow_amount: 9250000,
    buyer: 'Helios Growth Equity',
    seller: 'Quantum Diagnostics Inc.',
    target_company: 'Quantum Diagnostics',
    deal_type: 'M&A',
    sector: 'HealthTech',
    jurisdiction: 'Delaware',
    closing_date_offset_days: 28,
    status: 'active',
    deal_state: 'verification_pending',
    stakeholders: [
      { shareholder_name: 'Dr. Amelia Hart (CEO)', ownership_pct: 42, payout_amount: 73710000, escrow_holdback: 3885000, role: 'Founder', verification_status: 'pending', email: 'amelia@quantumdx.com', stakeholder_type: 'individual' },
      { shareholder_name: 'Helios Growth Equity Partners', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'deals@helios.com', stakeholder_type: 'entity' },
      { shareholder_name: 'NEA Healthcare Fund X', ownership_pct: 35, payout_amount: 61425000, escrow_holdback: 3237500, role: 'Investor', verification_status: 'verified', email: 'lp@nea.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Tiger Global Bio Fund', ownership_pct: 18, payout_amount: 31590000, escrow_holdback: 1665000, role: 'Investor', verification_status: 'sent', email: 'bio@tigerglobal.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Roberto Silva (CTO)', ownership_pct: 5, payout_amount: 8775000, escrow_holdback: 462500, role: 'Employee', verification_status: 'not_started', email: 'roberto@quantumdx.com', stakeholder_type: 'individual' },
    ],
    wires: [
      { payee_entity: 'Quantum Diagnostics Inc.', amount: 175750000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'pending', bank_name: 'Silicon Valley Bank', account_holder: 'Quantum Diagnostics Inc.', account_number_last4: '5621', routing_number: '121140399' },
      { payee_entity: 'Helios Escrow — Wells Fargo', amount: 9250000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Wells Fargo Trust', account_holder: 'Wells Fargo Title Services', account_number_last4: '2210', routing_number: '121000248' },
    ],
    documents: [
      { filename: 'Term Sheet — Executed.pdf', doc_type: 'TERM_SHEET', status: 'PARSED' },
      { filename: 'Letter of Intent.pdf', doc_type: 'LOI', status: 'PARSED' },
      { filename: 'KYC Package — Founders.pdf', doc_type: 'KYC_DOCUMENTS', status: 'PROCESSING' },
    ],
  },

  // ───────────────────────────────────────────────
  // 3. Orion Health — Awaiting approvals
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-orion-v1',
    deal_name: 'Orion Health Acquisition',
    deal_value: 275000000,
    currency: 'USD',
    escrow_amount: 13750000,
    buyer: 'Titan Healthcare Holdings',
    seller: 'Orion Medical Devices',
    target_company: 'Orion Medical',
    deal_type: 'M&A',
    sector: 'Medical Devices',
    jurisdiction: 'Delaware',
    closing_date_offset_days: 14,
    status: 'active',
    deal_state: 'conditions_pending',
    stakeholders: [
      { shareholder_name: 'Orion Medical Holdings', ownership_pct: 65, payout_amount: 169812500, escrow_holdback: 8937500, role: 'Seller', verification_status: 'verified', email: 'finance@orion-medical.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Titan Healthcare Holdings', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'mergers@titan-health.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Dr. Jennifer Park (Founder)', ownership_pct: 25, payout_amount: 65312500, escrow_holdback: 3437500, role: 'Founder', verification_status: 'verified', email: 'jpark@orion-medical.com', stakeholder_type: 'individual' },
      { shareholder_name: 'BlackRock Medical Innovation', ownership_pct: 10, payout_amount: 26125000, escrow_holdback: 1375000, role: 'Investor', verification_status: 'verified', email: 'innovation@blackrock.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Orion Medical Holdings', amount: 261250000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'verified', bank_name: 'Bank of America', account_holder: 'Orion Medical Holdings LLC', account_number_last4: '8842', routing_number: '026009593' },
      { payee_entity: 'Titan Escrow — Old Republic', amount: 13750000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Old Republic Trust', account_holder: 'Old Republic Escrow Services', account_number_last4: '1730', routing_number: '021000128' },
    ],
    documents: [
      { filename: 'Stock Purchase Agreement.pdf', doc_type: 'SPA', status: 'PARSED' },
      { filename: 'Funds Flow Memo.xlsx', doc_type: 'FUNDS_FLOW', status: 'VERIFIED' },
      { filename: 'Board Resolution — Titan.pdf', doc_type: 'BOARD_CONSENT', status: 'PARSED' },
    ],
    approvals: [
      { approver_name: 'Robert Hayes', approver_email: 'rhayes@titan-health.com', approver_role: 'CEO', approval_side: 'buyer', status: 'completed' },
      { approver_name: 'Linda Park', approver_email: 'lpark@titan-health.com', approver_role: 'CFO', approval_side: 'buyer', status: 'pending' },
      { approver_name: 'Dr. Jennifer Park', approver_email: 'jpark@orion-medical.com', approver_role: 'Founder/CEO', approval_side: 'seller', status: 'completed' },
      { approver_name: 'Michael Torres', approver_email: 'mtorres@orion-medical.com', approver_role: 'Board Chair', approval_side: 'seller', status: 'pending' },
    ],
  },

  // ───────────────────────────────────────────────
  // 4. Ember Solutions — Post-close, demos audit + reports
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-ember-v1',
    deal_name: 'Ember Solutions Buy-Out',
    deal_value: 45000000,
    currency: 'USD',
    escrow_amount: 2250000,
    buyer: 'Beacon Industrial Partners',
    seller: 'Ember Solutions Inc.',
    target_company: 'Ember Solutions',
    deal_type: 'M&A',
    sector: 'Industrial Automation',
    jurisdiction: 'Texas',
    closing_date_offset_days: -14,
    status: 'closed',
    deal_state: 'settled',
    stakeholders: [
      { shareholder_name: 'Ember Solutions Inc.', ownership_pct: 100, payout_amount: 42750000, escrow_holdback: 2250000, role: 'Seller', verification_status: 'verified', email: 'cfo@ember-solutions.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Beacon Industrial Partners', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'closings@beacon-ip.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Ember Solutions Inc.', amount: 42750000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'verified', bank_name: 'Frost Bank', account_holder: 'Ember Solutions Inc.', account_number_last4: '9923', routing_number: '114000093' },
      { payee_entity: 'Beacon Escrow — Stewart Title', amount: 2250000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Stewart Title Trust', account_holder: 'Stewart Title National', account_number_last4: '4001', routing_number: '113000023' },
    ],
    documents: [
      { filename: 'SPA — Final Executed.pdf', doc_type: 'SPA', status: 'PARSED' },
      { filename: 'Closing Certificate.pdf', doc_type: 'CLOSING_CERTIFICATE', status: 'PARSED' },
      { filename: 'Wire Confirmation — JPM.pdf', doc_type: 'WIRE_CONFIRMATION', status: 'VERIFIED' },
      { filename: 'Audit Trail Export.pdf', doc_type: 'AUDIT_REPORT', status: 'VERIFIED' },
    ],
    approvals: [
      { approver_name: 'Sarah Chen', approver_email: 'schen@beacon-ip.com', approver_role: 'Managing Director', approval_side: 'buyer', status: 'completed' },
      { approver_name: 'Tom Walsh', approver_email: 'twalsh@ember-solutions.com', approver_role: 'CEO', approval_side: 'seller', status: 'completed' },
    ],
  },

  // ───────────────────────────────────────────────
  // 5. Lighthouse Capital — Funds flow mismatch
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-lighthouse-v1',
    deal_name: 'Lighthouse Capital Recap',
    deal_value: 150000000,
    currency: 'USD',
    escrow_amount: 7500000,
    buyer: 'Northstar Strategic Capital',
    seller: 'Lighthouse Holdings',
    target_company: 'Lighthouse Capital LLC',
    deal_type: 'Recapitalization',
    sector: 'Financial Services',
    jurisdiction: 'New York',
    closing_date_offset_days: 21,
    status: 'active',
    deal_state: 'verification_pending',
    stakeholders: [
      { shareholder_name: 'Lighthouse Holdings LLC', ownership_pct: 55, payout_amount: 78375000, escrow_holdback: 4125000, role: 'Seller', verification_status: 'verified', email: 'ceo@lighthousecap.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Northstar Strategic Capital', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'deals@northstar-strategic.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Apollo Credit Partners', ownership_pct: 30, payout_amount: 42750000, escrow_holdback: 2250000, role: 'Investor', verification_status: 'verified', email: 'credit-partners@apollo.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Management Pool', ownership_pct: 15, payout_amount: 21375000, escrow_holdback: 1125000, role: 'Management', verification_status: 'pending', email: 'mgmt-pool@lighthousecap.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Lighthouse Holdings LLC', amount: 142500000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'pending', bank_name: 'Citibank Private', account_holder: 'Lighthouse Holdings LLC', account_number_last4: '7711', routing_number: '021000089' },
      { payee_entity: 'Northstar Escrow — Chicago Title', amount: 7500000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Chicago Title Trust', account_holder: 'Chicago Title National', account_number_last4: '3344', routing_number: '021000018' },
    ],
    documents: [
      { filename: 'Recapitalization Agreement.pdf', doc_type: 'SPA', status: 'PARSED' },
      { filename: 'Funds Flow — Lighthouse v2.xlsx', doc_type: 'FUNDS_FLOW', status: 'DISCREPANCY' },
      { filename: 'Source-of-Funds Letter.pdf', doc_type: 'SOURCE_OF_FUNDS', status: 'PARSED' },
    ],
  },

  // ───────────────────────────────────────────────
  // 6. Nimbus AI — Complex cap table, doc-AI demo
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-nimbus-v1',
    deal_name: 'Nimbus AI Acquisition',
    deal_value: 310000000,
    currency: 'USD',
    escrow_amount: 15500000,
    buyer: 'Vertex Tech Ventures',
    seller: 'Nimbus AI Inc.',
    target_company: 'Nimbus AI',
    deal_type: 'M&A',
    sector: 'AI / ML Infrastructure',
    jurisdiction: 'Delaware',
    closing_date_offset_days: 35,
    status: 'active',
    deal_state: 'verification_pending',
    stakeholders: [
      { shareholder_name: 'Dr. Emma Watson (Co-Founder, CEO)', ownership_pct: 22, payout_amount: 64790000, escrow_holdback: 3410000, role: 'Co-Founder', verification_status: 'verified', email: 'emma@nimbus.ai', stakeholder_type: 'individual' },
      { shareholder_name: 'Dr. Raj Patel (Co-Founder, CTO)', ownership_pct: 20, payout_amount: 58900000, escrow_holdback: 3100000, role: 'Co-Founder', verification_status: 'verified', email: 'raj@nimbus.ai', stakeholder_type: 'individual' },
      { shareholder_name: 'Andreessen Horowitz Fund VII', ownership_pct: 18, payout_amount: 53010000, escrow_holdback: 2790000, role: 'Series B Lead', verification_status: 'verified', email: 'lp@a16z.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Greylock Partners XV', ownership_pct: 12, payout_amount: 35340000, escrow_holdback: 1860000, role: 'Series A Lead', verification_status: 'verified', email: 'lp@greylock.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Founders Fund Growth III', ownership_pct: 10, payout_amount: 29450000, escrow_holdback: 1550000, role: 'Series B', verification_status: 'verified', email: 'lp@foundersfund.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Khosla Ventures Seed II', ownership_pct: 8, payout_amount: 23560000, escrow_holdback: 1240000, role: 'Seed', verification_status: 'verified', email: 'lp@khoslaventures.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Employee Stock Pool', ownership_pct: 10, payout_amount: 29450000, escrow_holdback: 1550000, role: 'Employee Pool', verification_status: 'pending', email: 'hr@nimbus.ai', stakeholder_type: 'entity' },
      { shareholder_name: 'Vertex Tech Ventures', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'deals@vertex-tv.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Nimbus AI Inc. — Seller Wire', amount: 294500000, currency: 'USD', payment_type: 'Purchase Price', verification_status: 'pending', bank_name: 'Silicon Valley Bank', account_holder: 'Nimbus AI Inc.', account_number_last4: '6624', routing_number: '121140399' },
      { payee_entity: 'Vertex Escrow — Fidelity National', amount: 15500000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Fidelity National Trust', account_holder: 'Fidelity National Title', account_number_last4: '8810', routing_number: '021000089' },
    ],
    documents: [
      { filename: 'Letter of Intent.pdf', doc_type: 'LOI', status: 'PARSED' },
      { filename: 'Cap Table v7 Final.xlsx', doc_type: 'CAP_TABLE', status: 'PROCESSING' },
      { filename: 'IP Assignment Schedule.pdf', doc_type: 'IP_ASSIGNMENT', status: 'PARSED' },
      { filename: 'Patent Portfolio Summary.pdf', doc_type: 'IP_ASSIGNMENT', status: 'PROCESSING' },
    ],
  },

  // ───────────────────────────────────────────────
  // 7. Vector IP — Asset acquisition (different deal type)
  // ───────────────────────────────────────────────
  {
    seed_key: 'sample-vector-v1',
    deal_name: 'Vector IP Asset Purchase',
    deal_value: 28000000,
    currency: 'USD',
    escrow_amount: 1400000,
    buyer: 'Pinnacle Patent Holdings',
    seller: 'Vector Innovations LLC',
    target_company: 'Vector IP Portfolio',
    deal_type: 'Asset Acquisition',
    sector: 'Intellectual Property',
    jurisdiction: 'California',
    closing_date_offset_days: 7,
    status: 'active',
    deal_state: 'ready_for_execution',
    stakeholders: [
      { shareholder_name: 'Vector Innovations LLC', ownership_pct: 100, payout_amount: 26600000, escrow_holdback: 1400000, role: 'Seller', verification_status: 'verified', email: 'patents@vector-innovations.com', stakeholder_type: 'entity' },
      { shareholder_name: 'Pinnacle Patent Holdings', ownership_pct: 0, payout_amount: 0, escrow_holdback: 0, role: 'Buyer', verification_status: 'verified', email: 'ip-acquisitions@pinnacle-patent.com', stakeholder_type: 'entity' },
    ],
    wires: [
      { payee_entity: 'Vector Innovations LLC', amount: 26600000, currency: 'USD', payment_type: 'Asset Purchase', verification_status: 'verified', bank_name: 'East West Bank', account_holder: 'Vector Innovations LLC', account_number_last4: '2245', routing_number: '322070381' },
      { payee_entity: 'Pinnacle IP Escrow', amount: 1400000, currency: 'USD', payment_type: 'Escrow Deposit', verification_status: 'verified', bank_name: 'Commerce Trust', account_holder: 'Commerce Escrow', account_number_last4: '5567', routing_number: '101000019' },
    ],
    documents: [
      { filename: 'Asset Purchase Agreement.pdf', doc_type: 'APA', status: 'PARSED' },
      { filename: 'Patent Assignment Schedule.pdf', doc_type: 'IP_ASSIGNMENT', status: 'PARSED' },
      { filename: 'Trademark Transfer Agreement.pdf', doc_type: 'IP_ASSIGNMENT', status: 'PARSED' },
    ],
    approvals: [
      { approver_name: 'Daniel Cho', approver_email: 'dcho@pinnacle-patent.com', approver_role: 'General Counsel', approval_side: 'buyer', status: 'completed' },
      { approver_name: 'Patricia Lee', approver_email: 'plee@vector-innovations.com', approver_role: 'Managing Member', approval_side: 'seller', status: 'completed' },
    ],
  },
];
