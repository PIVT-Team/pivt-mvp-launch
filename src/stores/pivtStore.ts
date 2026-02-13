/**
 * PIVT Unified Store - Single source of truth for Cover/Glass modes
 */
import { create } from 'zustand';

export type ViewMode = 'cover' | 'glass';

export type ActiveSection =
  | 'command' | 'deals' | 'waterfall' | 'stakeholders' | 'documents'
  | 'escrow' | 'approvals' | 'payments' | 'reports' | 'audit';

export type EntityType = 'deal' | 'stakeholder' | 'document' | 'payment' | 'escrow' | 'approval';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  status?: string;
  metadata?: Record<string, any>;
}

// Demo deal data
export interface DemoDeal {
  id: string;
  name: string;
  codeName: string;
  consideration: number;
  status: 'drafting' | 'diligence' | 'signing' | 'closing' | 'completed';
  buyerName: string;
  targetCompany: string;
  sector: string;
  totalRecipients: number;
  documentsUploaded: number;
  discrepanciesFound: number;
  readyToPayPercent: number;
  closingDate: string;
}

export interface DemoStakeholder {
  id: string;
  name: string;
  role: string;
  email: string;
  kycStatus: 'verified' | 'pending' | 'failed';
  payoutAmount: number;
  ownershipPct: number;
}

export interface DemoDocument {
  id: string;
  name: string;
  type: string;
  status: 'verified' | 'pending' | 'rejected';
  uploadedAt: string;
}

export interface DemoPayment {
  id: string;
  recipientName: string;
  amount: number;
  status: 'pending' | 'approved' | 'executed' | 'failed';
  method: string;
}

export interface WaterfallTier {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  recipients: number;
}

export interface PendingApproval {
  id: string;
  type: string;
  dealName: string;
  description: string;
  requestedBy: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
}

// --- Demo Data ---
const DEMO_DEALS: DemoDeal[] = [
  {
    id: 'atlas', name: 'Project ATLAS', codeName: 'ATLAS',
    consideration: 2_800_000_000, status: 'closing',
    buyerName: 'Apex Capital Partners', targetCompany: 'DataStream Technologies',
    sector: 'Enterprise SaaS', totalRecipients: 28, documentsUploaded: 108,
    discrepanciesFound: 3, readyToPayPercent: 87,
    closingDate: '2026-03-15',
  },
  {
    id: 'beacon', name: 'Project BEACON', codeName: 'BEACON',
    consideration: 1_250_000_000, status: 'diligence',
    buyerName: 'Meridian Holdings', targetCompany: 'CloudVault Security',
    sector: 'Cybersecurity', totalRecipients: 25, documentsUploaded: 75,
    discrepanciesFound: 7, readyToPayPercent: 62,
    closingDate: '2026-04-30',
  },
  {
    id: 'cipher', name: 'Project CIPHER', codeName: 'CIPHER',
    consideration: 4_500_000_000, status: 'signing',
    buyerName: 'Titan Strategic Group', targetCompany: 'NeuralPath AI',
    sector: 'Artificial Intelligence', totalRecipients: 48, documentsUploaded: 145,
    discrepanciesFound: 1, readyToPayPercent: 94,
    closingDate: '2026-02-28',
  },
];

const DEMO_STAKEHOLDERS: DemoStakeholder[] = [
  { id: 's1', name: 'Sarah Chen', role: 'Founder & CEO', email: 'schen@datastream.io', kycStatus: 'verified', payoutAmount: 840_000_000, ownershipPct: 30 },
  { id: 's2', name: 'Marcus Williams', role: 'CTO & Co-Founder', email: 'mwilliams@datastream.io', kycStatus: 'verified', payoutAmount: 560_000_000, ownershipPct: 20 },
  { id: 's3', name: 'Sequoia Capital Fund XIV', role: 'Series A Lead', email: 'legal@sequoia.com', kycStatus: 'verified', payoutAmount: 420_000_000, ownershipPct: 15 },
  { id: 's4', name: 'Andreessen Horowitz', role: 'Series B Lead', email: 'closings@a16z.com', kycStatus: 'pending', payoutAmount: 280_000_000, ownershipPct: 10 },
  { id: 's5', name: 'Tiger Global Management', role: 'Growth Investor', email: 'ops@tigerglobal.com', kycStatus: 'verified', payoutAmount: 224_000_000, ownershipPct: 8 },
  { id: 's6', name: 'Employee Option Pool', role: 'ESOP Trust', email: 'esop@datastream.io', kycStatus: 'pending', payoutAmount: 196_000_000, ownershipPct: 7 },
  { id: 's7', name: 'Index Ventures', role: 'Series C Investor', email: 'legal@indexventures.com', kycStatus: 'verified', payoutAmount: 168_000_000, ownershipPct: 6 },
  { id: 's8', name: 'GIC Private Limited', role: 'Pre-IPO Investor', email: 'investments@gic.com.sg', kycStatus: 'failed', payoutAmount: 112_000_000, ownershipPct: 4 },
];

const DEMO_DOCUMENTS: DemoDocument[] = [
  { id: 'd1', name: 'Merger Agreement (Executed)', type: 'Legal', status: 'verified', uploadedAt: '2026-01-15' },
  { id: 'd2', name: 'Cap Table - Final', type: 'Financial', status: 'verified', uploadedAt: '2026-01-20' },
  { id: 'd3', name: 'Waterfall Schedule v3', type: 'Financial', status: 'pending', uploadedAt: '2026-02-01' },
  { id: 'd4', name: 'Escrow Agreement', type: 'Legal', status: 'verified', uploadedAt: '2026-01-18' },
  { id: 'd5', name: 'KYC Package - Sequoia', type: 'Compliance', status: 'verified', uploadedAt: '2026-01-22' },
  { id: 'd6', name: 'Wire Instructions - a16z', type: 'Banking', status: 'pending', uploadedAt: '2026-02-05' },
  { id: 'd7', name: 'Tax Certificates Bundle', type: 'Tax', status: 'verified', uploadedAt: '2026-01-25' },
  { id: 'd8', name: 'Board Resolutions', type: 'Corporate', status: 'verified', uploadedAt: '2026-01-10' },
];

const DEMO_PAYMENTS: DemoPayment[] = [
  { id: 'p1', recipientName: 'Sarah Chen', amount: 840_000_000, status: 'approved', method: 'Wire Transfer' },
  { id: 'p2', recipientName: 'Marcus Williams', amount: 560_000_000, status: 'approved', method: 'Wire Transfer' },
  { id: 'p3', recipientName: 'Sequoia Capital Fund XIV', amount: 420_000_000, status: 'pending', method: 'Wire Transfer' },
  { id: 'p4', recipientName: 'Andreessen Horowitz', amount: 280_000_000, status: 'pending', method: 'Wire Transfer' },
  { id: 'p5', recipientName: 'Tiger Global Management', amount: 224_000_000, status: 'executed', method: 'Wire Transfer' },
];

const DEMO_WATERFALL: WaterfallTier[] = [
  { id: 'w1', name: 'Senior Secured Debt', amount: 280_000_000, percentage: 10, recipients: 2 },
  { id: 'w2', name: 'Transaction Expenses', amount: 84_000_000, percentage: 3, recipients: 5 },
  { id: 'w3', name: 'Escrow Holdback', amount: 280_000_000, percentage: 10, recipients: 1 },
  { id: 'w4', name: 'Preferred Return', amount: 560_000_000, percentage: 20, recipients: 4 },
  { id: 'w5', name: 'Common Distribution', amount: 1_596_000_000, percentage: 57, recipients: 16 },
];

const DEMO_APPROVALS: PendingApproval[] = [
  { id: 'a1', type: 'Payout Execution', dealName: 'Project ATLAS', description: 'Execute $840M wire to Sarah Chen', requestedBy: 'Deal Admin', urgency: 'high', createdAt: '2026-02-12' },
  { id: 'a2', type: 'Document Review', dealName: 'Project ATLAS', description: 'Approve Waterfall Schedule v3', requestedBy: 'Seller Counsel', urgency: 'critical', createdAt: '2026-02-11' },
  { id: 'a3', type: 'KYC Override', dealName: 'Project BEACON', description: 'Override KYC for GIC Private Limited', requestedBy: 'Compliance', urgency: 'medium', createdAt: '2026-02-10' },
];

interface PIVTStore {
  // Mode
  viewMode: ViewMode;
  activeSection: ActiveSection;
  setViewMode: (mode: ViewMode) => void;
  setActiveSection: (section: ActiveSection) => void;
  toggleMode: () => void;

  // Entity selection (synced across modes)
  selectedEntity: Entity | null;
  setSelectedEntity: (entity: Entity | null) => void;

  // Selected deal
  selectedDealId: string;
  setSelectedDealId: (id: string) => void;

  // Data
  deals: DemoDeal[];
  stakeholders: DemoStakeholder[];
  documents: DemoDocument[];
  payments: DemoPayment[];
  waterfallTiers: WaterfallTier[];
  pendingApprovals: PendingApproval[];

  // Helpers
  getSelectedDeal: () => DemoDeal;
  getTotalDealValue: () => number;
}

export const usePIVTStore = create<PIVTStore>((set, get) => ({
  viewMode: 'cover',
  activeSection: 'command',
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveSection: (section) => set({ activeSection: section }),
  toggleMode: () => set((s) => ({ viewMode: s.viewMode === 'cover' ? 'glass' : 'cover' })),

  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),

  selectedDealId: 'atlas',
  setSelectedDealId: (id) => set({ selectedDealId: id }),

  deals: DEMO_DEALS,
  stakeholders: DEMO_STAKEHOLDERS,
  documents: DEMO_DOCUMENTS,
  payments: DEMO_PAYMENTS,
  waterfallTiers: DEMO_WATERFALL,
  pendingApprovals: DEMO_APPROVALS,

  getSelectedDeal: () => {
    const state = get();
    return state.deals.find(d => d.id === state.selectedDealId) || state.deals[0];
  },
  getTotalDealValue: () => {
    return get().deals.reduce((sum, d) => sum + d.consideration, 0);
  },
}));

// Selector hooks
export const useMode = () => usePIVTStore((s) => s.viewMode);
export const useActiveSection = () => usePIVTStore((s) => s.activeSection);
export const useSelectedDeal = () => usePIVTStore((s) => s.deals.find(d => d.id === s.selectedDealId) || s.deals[0]);
