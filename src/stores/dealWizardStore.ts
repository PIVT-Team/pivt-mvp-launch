import { create } from 'zustand';

export type WizardMode = 'demo' | 'live';

export type WizardStep =
  | 'account' | 'kyc' | 'escrow-setup' | 'deal-basics' | 'parties'
  | 'documentation' | 'validation' | 'discrepancies'
  | 'approvals' | 'execution';

export const WIZARD_STEPS: { key: WizardStep; label: string; number: number }[] = [
  { key: 'account', label: 'Account & Entity', number: 1 },
  { key: 'kyc', label: 'KYC / KYB', number: 2 },
  { key: 'escrow-setup', label: 'Escrow Setup', number: 3 },
  { key: 'deal-basics', label: 'Deal Basics', number: 4 },
  { key: 'parties', label: 'Parties & Roles', number: 5 },
  { key: 'documentation', label: 'Documentation', number: 6 },
  { key: 'validation', label: 'Validation', number: 7 },
  { key: 'discrepancies', label: 'Discrepancies', number: 8 },
  { key: 'approvals', label: 'Approvals', number: 9 },
  { key: 'execution', label: 'Execution', number: 10 },
];

export interface AccountData {
  fullName: string;
  role: string;
  organization: string;
  jurisdiction: string;
  email: string;
  phone: string;
}

export interface KycData {
  govIdUploaded: boolean;
  proofOfAddressUploaded: boolean;
  corpDocUploaded: boolean;
  attestation: boolean;
  status: 'not_started' | 'in_review' | 'approved';
}

export type EscrowStatus = 'pending' | 'active' | 'funded' | 'disbursed' | 'closed';

export interface EscrowSetupData {
  institution: string;
  accountType: 'FBO' | 'Dedicated';
  interestRate: string;
  clientSplit: string;
  platformSplit: string;
  status: EscrowStatus;
  maskedAccount: string;
  maskedRouting: string;
  referenceCode: string;
  fundingReceiptUploaded: boolean;
}

export interface Beneficiary {
  id: string;
  name: string;
  entityType: 'Individual' | 'Corporation' | 'Fund' | 'Trust';
  jurisdiction: string;
  payoutAmount: number;
  bankDetailsMasked: string;
  status: 'pending' | 'verified';
  changeFlag: boolean;
}

export interface DealBasicsData {
  dealName: string;
  dealType: string;
  buyerLegalName: string;
  sellerLegalName: string;
  transactionValue: string;
  signingDate: string;
  targetCloseDate: string;
  currency: string;
}

export interface PartyContact {
  name: string;
  email: string;
}

export interface PartiesData {
  buyerCounsel: PartyContact;
  sellerCounsel: PartyContact;
  fundContact: PartyContact;
  escrowAgent: PartyContact;
}

export interface DocUpload {
  id: string;
  name: string;
  type: string;
  status: 'uploaded' | 'parsed' | 'error';
  isSample?: boolean;
}

export interface ValidationItem {
  id: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface Discrepancy {
  id: string;
  lineItem: string;
  expected: string;
  provided: string;
  variance: string;
  severity: 'high' | 'medium' | 'low';
  resolved: boolean;
  assignedTo: string;
}

export interface ApprovalCard {
  id: string;
  role: string;
  status: 'pending' | 'approved' | 'changes_requested';
  signedAt?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  dealRef: string;
}

const initialEscrowSetup: EscrowSetupData = {
  institution: '',
  accountType: 'FBO',
  interestRate: '4.25',
  clientSplit: '85',
  platformSplit: '15',
  status: 'pending',
  maskedAccount: '',
  maskedRouting: '',
  referenceCode: '',
  fundingReceiptUploaded: false,
};

interface DealWizardStore {
  isOpen: boolean;
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  wizardMode: WizardMode;

  // Data
  account: AccountData;
  kyc: KycData;
  escrowSetup: EscrowSetupData;
  dealBasics: DealBasicsData;
  parties: PartiesData;
  documents: DocUpload[];
  validationResults: ValidationItem[];
  discrepancies: Discrepancy[];
  approvals: ApprovalCard[];
  beneficiaries: Beneficiary[];
  auditLog: AuditEntry[];
  confirmationId: string | null;

  // Actions
  openWizard: () => void;
  closeWizard: () => void;
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setWizardMode: (mode: WizardMode) => void;
  completeStep: (step: WizardStep) => void;

  updateAccount: (data: Partial<AccountData>) => void;
  updateKyc: (data: Partial<KycData>) => void;
  updateEscrowSetup: (data: Partial<EscrowSetupData>) => void;
  activateEscrow: () => void;
  markEscrowFunded: () => void;
  updateDealBasics: (data: Partial<DealBasicsData>) => void;
  updateParties: (data: Partial<PartiesData>) => void;
  addDocument: (doc: DocUpload) => void;
  removeDocument: (id: string) => void;
  runValidation: () => void;
  resolveDiscrepancy: (id: string) => void;
  approveRole: (id: string) => void;
  canExecute: () => { ready: boolean; blockers: string[] };
  executeSimulated: () => void;
  addAuditEntry: (action: string) => void;
  prefillDemo: () => void;
  resetWizard: () => void;
}

const initialAccount: AccountData = { fullName: '', role: '', organization: '', jurisdiction: '', email: '', phone: '' };
const initialKyc: KycData = { govIdUploaded: false, proofOfAddressUploaded: false, corpDocUploaded: false, attestation: false, status: 'not_started' };
const initialDealBasics: DealBasicsData = { dealName: '', buyerLegalName: '', sellerLegalName: '', transactionValue: '', targetCloseDate: '', currency: 'USD' };
const initialParties: PartiesData = {
  buyerCounsel: { name: '', email: '' },
  sellerCounsel: { name: '', email: '' },
  fundContact: { name: '', email: '' },
  escrowAgent: { name: '', email: '' },
};

const DEMO_BENEFICIARIES: Beneficiary[] = [
  { id: 'b1', name: 'Andreessen Horowitz Fund VII', entityType: 'Fund', jurisdiction: 'Delaware, USA', payoutAmount: 8500000, bankDetailsMasked: 'JPM ****4821', status: 'verified', changeFlag: false },
  { id: 'b2', name: 'Sequoia Capital Global Growth', entityType: 'Fund', jurisdiction: 'Cayman Islands', payoutAmount: 12800000, bankDetailsMasked: 'Citi ****7293', status: 'verified', changeFlag: false },
  { id: 'b3', name: 'GIC Private Limited', entityType: 'Corporation', jurisdiction: 'Singapore', payoutAmount: 7400000, bankDetailsMasked: 'DBS ****1847', status: 'pending', changeFlag: false },
  { id: 'b4', name: 'Tiger Global Management', entityType: 'Fund', jurisdiction: 'New York, USA', payoutAmount: 6800000, bankDetailsMasked: 'GS ****5512', status: 'verified', changeFlag: false },
  { id: 'b5', name: 'Northbridge Founders Trust', entityType: 'Trust', jurisdiction: 'Delaware, USA', payoutAmount: 40700000, bankDetailsMasked: 'BNY ****3398', status: 'verified', changeFlag: false },
  { id: 'b6', name: 'Jane Chen (Individual)', entityType: 'Individual', jurisdiction: 'California, USA', payoutAmount: 18500000, bankDetailsMasked: 'WF ****6641', status: 'verified', changeFlag: false },
];

const DEMO_DOCS: DocUpload[] = [
  { id: 'd1', name: 'Cap Table - ATLAS.xlsx', type: 'Cap Table', status: 'parsed', isSample: true },
  { id: 'd2', name: 'Waterfall Schedule v3.xlsx', type: 'Waterfall', status: 'parsed', isSample: true },
  { id: 'd3', name: 'Escrow Agreement.pdf', type: 'Escrow Agreement', status: 'parsed', isSample: true },
  { id: 'd4', name: 'Closing Checklist.pdf', type: 'Closing Checklist', status: 'parsed', isSample: true },
  { id: 'd5', name: 'Fee Schedule.xlsx', type: 'Fee Schedule', status: 'parsed', isSample: true },
];

const DEMO_VALIDATION: ValidationItem[] = [
  { id: 'v1', check: 'Entity matching', status: 'pass', message: '28/28 entities matched across documents' },
  { id: 'v2', check: 'Total reconciliation', status: 'pass', message: 'Waterfall total matches deal consideration ($2.8B)' },
  { id: 'v3', check: 'Escrow holdback %', status: 'warning', message: 'Escrow holdback is 10% — verify against agreement terms' },
  { id: 'v4', check: 'Fee schedule completeness', status: 'pass', message: 'All fee line items accounted for' },
  { id: 'v5', check: 'Missing wire instructions', status: 'fail', message: '2 recipients missing wire instructions' },
  { id: 'v6', check: 'KYC completion', status: 'fail', message: '1 entity KYC not yet approved (GIC Private Limited)' },
];

const DEMO_DISCREPANCIES: Discrepancy[] = [
  { id: 'dc1', lineItem: 'Andreessen Horowitz payout', expected: '$280,000,000', provided: '$278,500,000', variance: '-$1,500,000', severity: 'high', resolved: false, assignedTo: 'Seller Counsel' },
  { id: 'dc2', lineItem: 'Wire instructions - a16z', expected: 'Present', provided: 'Missing', variance: 'N/A', severity: 'high', resolved: false, assignedTo: 'Fund Ops' },
  { id: 'dc3', lineItem: 'GIC KYC status', expected: 'Approved', provided: 'Failed', variance: 'N/A', severity: 'medium', resolved: false, assignedTo: 'Compliance' },
];

const INITIAL_APPROVALS: ApprovalCard[] = [
  { id: 'ap1', role: 'Buyer Counsel', status: 'pending' },
  { id: 'ap2', role: 'Seller Counsel', status: 'pending' },
  { id: 'ap3', role: 'Fund', status: 'pending' },
  { id: 'ap4', role: 'Escrow Agent', status: 'pending' },
];

export const useDealWizardStore = create<DealWizardStore>((set, get) => ({
  isOpen: false,
  currentStep: 'account',
  completedSteps: new Set<WizardStep>(),
  wizardMode: 'demo',

  account: { ...initialAccount },
  kyc: { ...initialKyc },
  escrowSetup: { ...initialEscrowSetup },
  dealBasics: { ...initialDealBasics },
  parties: { ...initialParties },
  documents: [],
  validationResults: [],
  discrepancies: [],
  approvals: INITIAL_APPROVALS.map(a => ({ ...a })),
  beneficiaries: [],
  auditLog: [],
  confirmationId: null,

  openWizard: () => set({ isOpen: true, currentStep: 'account' }),
  closeWizard: () => set({ isOpen: false }),
  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === get().currentStep);
    if (idx < WIZARD_STEPS.length - 1) {
      get().completeStep(get().currentStep);
      set({ currentStep: WIZARD_STEPS[idx + 1].key });
    }
  },

  prevStep: () => {
    const idx = WIZARD_STEPS.findIndex(s => s.key === get().currentStep);
    if (idx > 0) set({ currentStep: WIZARD_STEPS[idx - 1].key });
  },

  setWizardMode: (mode) => {
    set({ wizardMode: mode });
    if (mode === 'demo') get().prefillDemo();
  },

  completeStep: (step) => {
    const completed = new Set(get().completedSteps);
    completed.add(step);
    set({ completedSteps: completed });
  },

  updateAccount: (data) => set((s) => ({ account: { ...s.account, ...data } })),
  updateKyc: (data) => set((s) => ({ kyc: { ...s.kyc, ...data } })),
  updateEscrowSetup: (data) => set((s) => ({ escrowSetup: { ...s.escrowSetup, ...data } })),

  activateEscrow: () => {
    const last4Acct = Math.floor(1000 + Math.random() * 9000).toString();
    const last4Route = Math.floor(1000 + Math.random() * 9000).toString();
    const refCode = `PIVT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    set((s) => ({
      escrowSetup: {
        ...s.escrowSetup,
        status: 'active',
        maskedAccount: last4Acct,
        maskedRouting: last4Route,
        referenceCode: refCode,
      },
    }));
    get().addAuditEntry('Escrow account activated');
    get().addAuditEntry('Funding instructions generated');
    get().completeStep('escrow-setup');
  },

  markEscrowFunded: () => {
    set((s) => ({
      escrowSetup: { ...s.escrowSetup, status: 'funded', fundingReceiptUploaded: true },
    }));
    get().addAuditEntry('Escrow marked as funded');
  },

  updateDealBasics: (data) => set((s) => ({ dealBasics: { ...s.dealBasics, ...data } })),
  updateParties: (data) => set((s) => ({ parties: { ...s.parties, ...data } })),

  addDocument: (doc) => set((s) => ({ documents: [...s.documents, doc] })),
  removeDocument: (id) => set((s) => ({ documents: s.documents.filter(d => d.id !== id) })),

  runValidation: () => {
    set({
      validationResults: DEMO_VALIDATION,
      discrepancies: DEMO_DISCREPANCIES.map(d => ({ ...d })),
    });
  },

  resolveDiscrepancy: (id) => set((s) => ({
    discrepancies: s.discrepancies.map(d => d.id === id ? { ...d, resolved: true } : d),
  })),

  approveRole: (id) => set((s) => ({
    approvals: s.approvals.map(a => a.id === id ? { ...a, status: 'approved' as const, signedAt: new Date().toISOString() } : a),
  })),

  canExecute: () => {
    const s = get();
    const blockers: string[] = [];
    if (s.kyc.status !== 'approved') blockers.push('KYC/KYB not approved');
    if (s.escrowSetup.status !== 'funded') blockers.push('Escrow not funded');
    if (s.validationResults.length === 0) blockers.push('Validation not complete');
    const unresolvedHigh = s.discrepancies.filter(d => d.severity === 'high' && !d.resolved).length;
    if (unresolvedHigh > 0) blockers.push(`${unresolvedHigh} high-severity discrepancies unresolved`);
    if (!s.approvals.every(a => a.status === 'approved')) blockers.push('Not all approvals obtained');
    const unverifiedBeneficiaries = s.beneficiaries.filter(b => b.status !== 'verified').length;
    if (unverifiedBeneficiaries > 0) blockers.push(`${unverifiedBeneficiaries} beneficiaries not verified`);
    return { ready: blockers.length === 0, blockers };
  },

  addAuditEntry: (action) => {
    const s = get();
    const entry: AuditEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: s.account.fullName || 'System',
      action,
      dealRef: s.dealBasics.dealName || 'New Deal',
    };
    set((state) => ({ auditLog: [...state.auditLog, entry] }));
  },

  executeSimulated: () => {
    const id = `PIVT-${Date.now().toString(36).toUpperCase()}`;
    set((s) => ({
      confirmationId: id,
      escrowSetup: { ...s.escrowSetup, status: 'disbursed' },
    }));
    get().addAuditEntry('Execution instruction packet generated');
    get().addAuditEntry(`Confirmation ID issued: ${id}`);
    get().completeStep('execution');
  },

  prefillDemo: () => {
    const refCode = `PIVT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    set({
      account: {
        fullName: 'Alexandra Reynolds',
        role: 'Fund Ops',
        organization: 'Apex Capital Partners',
        jurisdiction: 'Delaware, USA',
        email: 'areynolds@apexcap.com',
        phone: '+1 (212) 555-0142',
      },
      kyc: { govIdUploaded: true, proofOfAddressUploaded: true, corpDocUploaded: true, attestation: true, status: 'approved' },
      escrowSetup: {
        institution: 'JPMorgan Chase',
        accountType: 'FBO',
        interestRate: '4.25',
        clientSplit: '85',
        platformSplit: '15',
        status: 'funded',
        maskedAccount: '7842',
        maskedRouting: '0210',
        referenceCode: refCode,
        fundingReceiptUploaded: true,
      },
      dealBasics: {
        dealName: 'Project ATLAS',
        buyerLegalName: 'Apex Capital Partners LLC',
        sellerLegalName: 'Northbridge Software Inc.',
        transactionValue: '185,000,000',
        targetCloseDate: '2026-03-15',
        currency: 'USD',
      },
      parties: {
        buyerCounsel: { name: 'James Mitchell', email: 'jmitchell@kirkland.com' },
        sellerCounsel: { name: 'Patricia Wong', email: 'pwong@wachtell.com' },
        fundContact: { name: 'David Nakamura', email: 'dnakamura@apexcap.com' },
        escrowAgent: { name: 'Robert Hayes', email: 'rhayes@jpmorgan.com' },
      },
      documents: DEMO_DOCS.map(d => ({ ...d })),
      beneficiaries: DEMO_BENEFICIARIES.map(b => ({ ...b })),
      auditLog: [
        { id: 'a1', timestamp: '2026-02-10T09:00:00Z', actor: 'Alexandra Reynolds', action: 'Escrow account activated', dealRef: 'Project ATLAS' },
        { id: 'a2', timestamp: '2026-02-10T09:00:01Z', actor: 'Alexandra Reynolds', action: 'Funding instructions generated', dealRef: 'Project ATLAS' },
        { id: 'a3', timestamp: '2026-02-11T14:30:00Z', actor: 'Alexandra Reynolds', action: 'Escrow marked as funded', dealRef: 'Project ATLAS' },
        { id: 'a4', timestamp: '2026-02-12T10:15:00Z', actor: 'System', action: 'Interest rate set: 4.25%', dealRef: 'Project ATLAS' },
        { id: 'a5', timestamp: '2026-02-12T10:15:01Z', actor: 'System', action: 'Interest split configured: 85% client / 15% platform', dealRef: 'Project ATLAS' },
      ],
    });
  },

  resetWizard: () => set({
    isOpen: false,
    currentStep: 'account',
    completedSteps: new Set<WizardStep>(),
    wizardMode: 'demo',
    account: { ...initialAccount },
    kyc: { ...initialKyc },
    escrowSetup: { ...initialEscrowSetup },
    dealBasics: { ...initialDealBasics },
    parties: { ...initialParties },
    documents: [],
    validationResults: [],
    discrepancies: [],
    approvals: INITIAL_APPROVALS.map(a => ({ ...a })),
    beneficiaries: [],
    auditLog: [],
    confirmationId: null,
  }),
}));
