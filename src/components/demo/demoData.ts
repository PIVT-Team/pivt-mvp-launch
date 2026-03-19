/**
 * Demo scenario data — Project Atlas: $185M mid-market acquisition.
 */

export const DEMO_DEAL = {
  name: 'Project Atlas',
  buyer: 'Northstar Capital Partners',
  seller: 'Harbor Ridge Holdings',
  value: 185_000_000,
  type: 'M&A — Asset Purchase',
  jurisdiction: 'Delaware',
  closingDate: '2026-04-15',
  escrowAmount: 18_500_000,
};

export interface DemoDocument {
  name: string;
  type: string;
  pages: number;
  size: string;
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  { name: 'Stock_Purchase_Agreement_Atlas_Final.pdf', type: 'Purchase Agreement', pages: 78, size: '4.2 MB' },
  { name: 'Funds_Flow_Memo_v3.pdf', type: 'Funds Flow Memorandum', pages: 12, size: '1.1 MB' },
  { name: 'Wire_Instructions_Buyer_Northstar.pdf', type: 'Buyer Wire Instructions', pages: 3, size: '340 KB' },
  { name: 'Wire_Instructions_Seller_HarborRidge.pdf', type: 'Seller Wire Instructions', pages: 3, size: '290 KB' },
  { name: 'Escrow_Agreement_Final.pdf', type: 'Escrow Agreement', pages: 18, size: '2.1 MB' },
  { name: 'IRS_W9_HarborRidge.pdf', type: 'IRS Tax Form (W-9)', pages: 2, size: '180 KB' },
];

export interface DemoStakeholder {
  id: string;
  name: string;
  entity: string;
  email: string;
  role: string;
  type: 'individual' | 'company';
}

export const DEMO_STAKEHOLDERS: DemoStakeholder[] = [
  { id: 'sh-1', name: 'Northstar Capital Partners', entity: 'Northstar Capital Partners LLC', email: 'closings@northstarcap.com', role: 'Buyer', type: 'company' },
  { id: 'sh-2', name: 'Harbor Ridge Holdings', entity: 'Harbor Ridge Holdings, LLC', email: 'legal@harborridge.com', role: 'Seller', type: 'company' },
  { id: 'sh-3', name: 'Sarah Chen', entity: 'Kirkland & Ellis LLP', email: 's.chen@kirkland.com', role: 'Buyer Counsel', type: 'individual' },
  { id: 'sh-4', name: 'Michael Torres', entity: 'Wachtell Lipton', email: 'm.torres@wachtell.com', role: 'Seller Counsel', type: 'individual' },
  { id: 'sh-5', name: 'JPMorgan Chase', entity: 'JPMorgan Chase Bank, N.A.', email: 'escrow.ops@jpmorgan.com', role: 'Escrow Agent', type: 'company' },
  { id: 'sh-6', name: 'David Park', entity: 'Northstar Capital Partners LLC', email: 'd.park@northstarcap.com', role: 'Deal Lead', type: 'individual' },
  { id: 'sh-7', name: 'Rebecca Liu', entity: 'Harbor Ridge Holdings, LLC', email: 'r.liu@harborridge.com', role: 'CFO', type: 'individual' },
  { id: 'sh-8', name: 'Lazard', entity: 'Lazard Frères & Co. LLC', email: 'advisory@lazard.com', role: 'Financial Advisor', type: 'company' },
  { id: 'sh-9', name: 'Continental Stock Transfer', entity: 'Continental Stock Transfer & Trust Co.', email: 'ops@continentalstock.com', role: 'Transfer Agent', type: 'company' },
  { id: 'sh-10', name: 'James Mitchell', entity: 'Harbor Ridge Holdings, LLC', email: 'j.mitchell@harborridge.com', role: 'Seller Signatory', type: 'individual' },
  { id: 'sh-11', name: 'Amanda Reeves', entity: 'Northstar Capital Partners LLC', email: 'a.reeves@northstarcap.com', role: 'Buyer Signatory', type: 'individual' },
  { id: 'sh-12', name: 'PwC', entity: 'PricewaterhouseCoopers LLP', email: 'tax.advisory@pwc.com', role: 'Tax Advisor', type: 'company' },
];

export type VerificationStatus = 'not_verified' | 'requested' | 'in_review' | 'verified';

export interface DemoObligation {
  recipient: string;
  amount: number;
  condition: string;
  timing: string;
  source: string;
}

export const DEMO_OBLIGATIONS: DemoObligation[] = [
  { recipient: 'Harbor Ridge Holdings', amount: 148_000_000, condition: 'All closing conditions met', timing: 'At closing', source: 'SPA §2.3' },
  { recipient: 'Escrow Agent — JPMorgan', amount: 18_500_000, condition: 'Indemnification holdback', timing: 'At closing', source: 'Escrow Agreement §4' },
  { recipient: 'Seller Legal Counsel', amount: 3_200_000, condition: 'Fee schedule approved', timing: 'At closing', source: 'Funds Flow Memo' },
  { recipient: 'Buyer Legal Counsel', amount: 2_800_000, condition: 'Fee schedule approved', timing: 'At closing', source: 'Funds Flow Memo' },
  { recipient: 'Financial Advisor — Lazard', amount: 9_250_000, condition: 'Success fee per engagement letter', timing: 'T+1 after closing', source: 'Funds Flow Memo' },
  { recipient: 'Transfer Agent', amount: 3_250_000, condition: 'Option cancellation payments', timing: 'T+5 after closing', source: 'SPA §2.5(c)' },
];

export interface DemoDiscrepancy {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  expected: string;
  actual: string;
  recommendation: string;
}

export const DEMO_DISCREPANCIES: DemoDiscrepancy[] = [
  {
    id: 'disc-1',
    title: 'Beneficiary name mismatch',
    severity: 'critical',
    category: 'Wire Instructions',
    expected: 'Harbor Ridge Holdings, LLC',
    actual: 'Harbor Ridge Holdings LLC',
    recommendation: 'Confirm legal entity name with seller counsel. Missing comma may cause wire rejection.',
  },
  {
    id: 'disc-2',
    title: 'ABA routing number discrepancy',
    severity: 'critical',
    category: 'Wire Instructions',
    expected: '021000089 (per Funds Flow Memo)',
    actual: '021000098 (per Wire Instructions)',
    recommendation: 'Transposed digits detected. Verify routing number with receiving bank before execution.',
  },
  {
    id: 'disc-3',
    title: 'Missing intermediary bank for international wire',
    severity: 'high',
    category: 'Wire Instructions',
    expected: 'SWIFT/BIC code required for Lazard fee payment',
    actual: 'No intermediary bank specified',
    recommendation: 'Request intermediary bank details from Lazard before processing international wire.',
  },
];

export interface DemoApproval {
  recipient: string;
  role: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed';
}

export const DEMO_APPROVALS: DemoApproval[] = [
  { recipient: 'Sarah Chen', role: 'Buyer Counsel', status: 'pending' },
  { recipient: 'Michael Torres', role: 'Seller Counsel', status: 'pending' },
  { recipient: 'David Park', role: 'Deal Lead — Northstar', status: 'pending' },
  { recipient: 'Rebecca Liu', role: 'CFO — Harbor Ridge', status: 'pending' },
];

export interface NewtonMessage {
  id: string;
  type: 'user' | 'newton' | 'system';
  text: string;
  delay: number;
}

export const STEP_MESSAGES: Record<string, NewtonMessage[]> = {
  create: [
    { id: 'c1', type: 'user', text: 'Create a new deal called Project Atlas. Buyer is Northstar Capital Partners, seller is Harbor Ridge Holdings. $185M asset purchase.', delay: 800 },
    { id: 'c2', type: 'newton', text: 'Creating **Project Atlas** — $185M asset purchase.\n\n- Buyer: Northstar Capital Partners\n- Seller: Harbor Ridge Holdings\n- Jurisdiction: Delaware\n\nDeal workspace is ready.', delay: 2500 },
    { id: 'c3', type: 'system', text: 'Deal created • Project Atlas — DEL-2026-0847', delay: 4200 },
  ],
  stakeholders: [
    { id: 's1', type: 'user', text: 'Upload stakeholder list and prepare verification requests.', delay: 600 },
    { id: 's2', type: 'newton', text: 'Processing stakeholder list for Project Atlas...', delay: 2000 },
    { id: 's3', type: 'system', text: '12 stakeholders imported', delay: 6000 },
  ],
  verification: [
    { id: 'v1', type: 'newton', text: 'Sending KYC/KYB verification requests to all stakeholders...', delay: 1000 },
    { id: 'v2', type: 'system', text: 'All stakeholders verified', delay: 8000 },
  ],
  upload: [
    { id: 'u1', type: 'user', text: 'Upload the closing binder. I have the SPA, funds flow memo, wire instructions for both sides, escrow agreement, and tax forms.', delay: 600 },
    { id: 'u2', type: 'newton', text: 'Processing **6 documents** for Project Atlas...', delay: 2000 },
    { id: 'u3', type: 'system', text: 'Documents classified and parsed', delay: 8000 },
  ],
  obligations: [
    { id: 'o1', type: 'user', text: 'Extract all payment obligations from the agreements.', delay: 500 },
    { id: 'o2', type: 'newton', text: 'Analyzing SPA, Funds Flow Memo, and Escrow Agreement...\n\nFound **6 payment obligations** totaling **$185.0M** across 6 recipients. All amounts reconcile with the purchase price.', delay: 2800 },
  ],
  discrepancies: [
    { id: 'd1', type: 'newton', text: 'Cross-referencing wire instructions against agreements...\n\n⚠️ **3 discrepancies detected** — 2 critical, 1 high severity.\n\nReview required before wire execution.', delay: 1200 },
  ],
  approvals: [
    { id: 'a1', type: 'user', text: 'Send approval requests to all parties via DocuSign.', delay: 500 },
    { id: 'a2', type: 'newton', text: 'Preparing approval packets for **4 signers**:\n- Sarah Chen (Buyer Counsel)\n- Michael Torres (Seller Counsel)\n- David Park (Deal Lead)\n- Rebecca Liu (CFO)\n\nSending via DocuSign...', delay: 2200 },
    { id: 'a3', type: 'system', text: 'All approval requests sent via DocuSign', delay: 5000 },
  ],
  wirepack: [
    { id: 'w1', type: 'newton', text: 'All discrepancies resolved. All approvals complete.\n\nGenerating bank-compatible **Wire Pack** for Project Atlas...', delay: 1000 },
    { id: 'w2', type: 'system', text: 'Wire Pack generated — ready for execution', delay: 3500 },
    { id: 'w3', type: 'newton', text: '✅ **Wire Pack Ready**\n\n- 6 verified payment instructions\n- $185.0M total disbursement\n- All compliance checks passed\n- PDF, CSV, and JSON formats available\n\nProject Atlas is ready for closing execution.', delay: 4500 },
  ],
};
