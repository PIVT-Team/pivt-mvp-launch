/**
 * Waterfall Store — Payout Priority + Calculation Engine
 * Persisted to localStorage for demo mode.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ──

export type TierCategory = 'expense' | 'debt' | 'preferred' | 'common' | 'other';
export type TierRuleType = 'FIXED_AMOUNT' | 'PERCENT_OF_POOL' | 'PRO_RATA' | 'WATERFALL_CAP';
export type AllocationType = 'FIXED_AMOUNT' | 'PERCENT_OF_TIER' | 'PRO_RATA';
export type TierStatus = 'READY' | 'PENDING' | 'BLOCKED';

export interface RecipientPrerequisites {
  kycRequired: boolean;
  wireRequired: boolean;
  approvalRequired: boolean;
}

export interface RecipientAllocation {
  id: string;
  stakeholderId: string | null;
  externalName: string;
  externalEmail: string;
  entityType: 'individual' | 'entity';
  allocationType: AllocationType;
  amountOrPercent: number;
  prerequisites: RecipientPrerequisites;
  // computed
  computedPayout: number;
  computedPctOfPool: number;
  status: TierStatus;
}

export interface WaterfallTier {
  id: string;
  priority: number;
  name: string;
  tierCategory: TierCategory;
  ruleType: TierRuleType;
  ruleValue: number; // amount or percent depending on ruleType
  capAmount: number | null;
  recipients: RecipientAllocation[];
  // computed
  computedTotal: number;
  status: TierStatus;
  expanded: boolean;
}

export interface WaterfallState {
  dealId: string;
  distributionPoolAmount: number;
  currency: string;
  tiers: WaterfallTier[];
  unallocated: number;
  hasDiscrepancy: boolean;
  lastCalculated: string | null;
}

// ── Seed Data for ATLAS ──

const uid = () => crypto.randomUUID();

const SEED_RECIPIENTS_T1: RecipientAllocation[] = [
  { id: uid(), stakeholderId: null, externalName: 'Goodwin Procter LLP', externalEmail: 'billing@goodwinlaw.com', entityType: 'entity', allocationType: 'FIXED_AMOUNT', amountOrPercent: 1_800_000, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: null, externalName: 'Houlihan Lokey Advisory', externalEmail: 'advisory@hl.com', entityType: 'entity', allocationType: 'FIXED_AMOUNT', amountOrPercent: 1_100_000, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: null, externalName: 'Regulatory Filing Fees', externalEmail: 'ops@pivt.com', entityType: 'entity', allocationType: 'FIXED_AMOUNT', amountOrPercent: 300_000, prerequisites: { kycRequired: false, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'PENDING' },
];

const SEED_RECIPIENTS_T2: RecipientAllocation[] = [
  { id: uid(), stakeholderId: null, externalName: 'Senior Credit Facility (SVB)', externalEmail: 'loans@svb.com', entityType: 'entity', allocationType: 'FIXED_AMOUNT', amountOrPercent: 72_000_000, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
];

const SEED_RECIPIENTS_T3: RecipientAllocation[] = [
  { id: uid(), stakeholderId: null, externalName: 'Escrow Agent (Citibank)', externalEmail: 'escrow@citi.com', entityType: 'entity', allocationType: 'FIXED_AMOUNT', amountOrPercent: 18_000_000, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
];

const SEED_RECIPIENTS_T4: RecipientAllocation[] = [
  { id: uid(), stakeholderId: 's3', externalName: 'Sequoia Capital Fund XIV', externalEmail: 'legal@sequoia.com', entityType: 'entity', allocationType: 'PERCENT_OF_TIER', amountOrPercent: 30, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: 's4', externalName: 'Andreessen Horowitz', externalEmail: 'closings@a16z.com', entityType: 'entity', allocationType: 'PERCENT_OF_TIER', amountOrPercent: 25, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'PENDING' },
  { id: uid(), stakeholderId: 's5', externalName: 'Tiger Global Management', externalEmail: 'ops@tigerglobal.com', entityType: 'entity', allocationType: 'PERCENT_OF_TIER', amountOrPercent: 20, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: 's7', externalName: 'Index Ventures', externalEmail: 'legal@indexventures.com', entityType: 'entity', allocationType: 'PERCENT_OF_TIER', amountOrPercent: 15, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: 's8', externalName: 'GIC Private Limited', externalEmail: 'investments@gic.com.sg', entityType: 'entity', allocationType: 'PERCENT_OF_TIER', amountOrPercent: 10, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false }, computedPayout: 0, computedPctOfPool: 0, status: 'BLOCKED' },
];

const SEED_RECIPIENTS_T5: RecipientAllocation[] = [
  { id: uid(), stakeholderId: 's1', externalName: 'Sarah Chen', externalEmail: 'schen@northbridge.io', entityType: 'individual', allocationType: 'PRO_RATA', amountOrPercent: 30, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: 's2', externalName: 'Marcus Williams', externalEmail: 'mwilliams@northbridge.io', entityType: 'individual', allocationType: 'PRO_RATA', amountOrPercent: 20, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'READY' },
  { id: uid(), stakeholderId: 's6', externalName: 'Employee Option Pool', externalEmail: 'esop@northbridge.io', entityType: 'entity', allocationType: 'PRO_RATA', amountOrPercent: 7, prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: true }, computedPayout: 0, computedPctOfPool: 0, status: 'PENDING' },
];

const SEED_TIERS: WaterfallTier[] = [
  { id: uid(), priority: 1, name: 'Transaction Expenses', tierCategory: 'expense', ruleType: 'FIXED_AMOUNT', ruleValue: 3_200_000, capAmount: null, recipients: SEED_RECIPIENTS_T1, computedTotal: 0, status: 'READY', expanded: false },
  { id: uid(), priority: 2, name: 'Senior Secured Debt', tierCategory: 'debt', ruleType: 'FIXED_AMOUNT', ruleValue: 72_000_000, capAmount: null, recipients: SEED_RECIPIENTS_T2, computedTotal: 0, status: 'READY', expanded: false },
  { id: uid(), priority: 3, name: 'Escrow Holdback', tierCategory: 'other', ruleType: 'FIXED_AMOUNT', ruleValue: 18_000_000, capAmount: null, recipients: SEED_RECIPIENTS_T3, computedTotal: 0, status: 'READY', expanded: false },
  { id: uid(), priority: 4, name: 'Series B Preferred', tierCategory: 'preferred', ruleType: 'FIXED_AMOUNT', ruleValue: 47_800_000, capAmount: null, recipients: SEED_RECIPIENTS_T4, computedTotal: 0, status: 'PENDING', expanded: false },
  { id: uid(), priority: 5, name: 'Common Distribution', tierCategory: 'common', ruleType: 'PERCENT_OF_POOL', ruleValue: 100, capAmount: null, recipients: SEED_RECIPIENTS_T5, computedTotal: 0, status: 'PENDING', expanded: false },
];

// ── Calculation Engine ──

function calculateWaterfall(pool: number, tiers: WaterfallTier[]): { tiers: WaterfallTier[]; unallocated: number; hasDiscrepancy: boolean } {
  let remaining = pool;
  let hasDiscrepancy = false;

  const computed = tiers
    .sort((a, b) => a.priority - b.priority)
    .map(tier => {
      let tierAmount = 0;

      switch (tier.ruleType) {
        case 'FIXED_AMOUNT':
          tierAmount = Math.min(tier.ruleValue, remaining);
          break;
        case 'PERCENT_OF_POOL':
          tierAmount = remaining; // takes whatever is left
          break;
        case 'PRO_RATA':
          tierAmount = remaining;
          break;
        case 'WATERFALL_CAP':
          tierAmount = Math.min(tier.ruleValue, remaining);
          break;
      }

      if (tier.capAmount !== null && tier.capAmount > 0) {
        tierAmount = Math.min(tierAmount, tier.capAmount);
      }

      // Allocate to recipients
      const recipients = allocateRecipients(tier.recipients, tierAmount, pool);

      // Compute tier status from recipients
      const hasBlocked = recipients.some(r => r.status === 'BLOCKED');
      const hasPending = recipients.some(r => r.status === 'PENDING');
      const tierStatus: TierStatus = hasBlocked ? 'BLOCKED' : hasPending ? 'PENDING' : 'READY';

      remaining -= tierAmount;

      return { ...tier, computedTotal: tierAmount, recipients, status: tierStatus };
    });

  if (remaining < -0.01) hasDiscrepancy = true;

  return { tiers: computed, unallocated: Math.max(remaining, 0), hasDiscrepancy };
}

function allocateRecipients(recipients: RecipientAllocation[], tierTotal: number, poolTotal: number): RecipientAllocation[] {
  // Sum for pro-rata shares
  const proRataRecipients = recipients.filter(r => r.allocationType === 'PRO_RATA');
  const proRataSum = proRataRecipients.reduce((s, r) => s + r.amountOrPercent, 0);

  let fixedUsed = 0;
  const fixedRecipients = recipients.filter(r => r.allocationType === 'FIXED_AMOUNT');
  fixedRecipients.forEach(r => { fixedUsed += r.amountOrPercent; });

  const pctRecipients = recipients.filter(r => r.allocationType === 'PERCENT_OF_TIER');
  const pctSum = pctRecipients.reduce((s, r) => s + r.amountOrPercent, 0);

  return recipients.map(r => {
    let payout = 0;

    switch (r.allocationType) {
      case 'FIXED_AMOUNT':
        payout = Math.min(r.amountOrPercent, tierTotal);
        break;
      case 'PERCENT_OF_TIER':
        payout = (r.amountOrPercent / 100) * tierTotal;
        break;
      case 'PRO_RATA':
        payout = proRataSum > 0 ? (r.amountOrPercent / proRataSum) * (tierTotal - fixedUsed - (pctSum / 100) * tierTotal) : 0;
        break;
    }

    // Compute status from prerequisites (demo: simulate based on stakeholderId patterns)
    let status: TierStatus = 'READY';
    if (r.status === 'BLOCKED') status = 'BLOCKED';
    else if (r.status === 'PENDING') status = 'PENDING';

    return {
      ...r,
      computedPayout: Math.max(payout, 0),
      computedPctOfPool: poolTotal > 0 ? (payout / poolTotal) * 100 : 0,
    };
  });
}

// ── Audit ──

export interface WaterfallAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details?: string;
}

// ── Store ──

interface WaterfallStore {
  waterfall: WaterfallState;
  auditLog: WaterfallAuditEntry[];

  // Actions
  setDistributionPool: (amount: number) => void;
  addTier: (name: string, category: TierCategory, ruleType: TierRuleType, ruleValue: number) => void;
  updateTier: (tierId: string, updates: Partial<Pick<WaterfallTier, 'name' | 'tierCategory' | 'ruleType' | 'ruleValue' | 'capAmount'>>) => void;
  deleteTier: (tierId: string) => void;
  duplicateTier: (tierId: string) => void;
  toggleTierExpand: (tierId: string) => void;
  addRecipient: (tierId: string, recipient: Omit<RecipientAllocation, 'id' | 'computedPayout' | 'computedPctOfPool' | 'status'>) => void;
  updateRecipient: (tierId: string, recipientId: string, updates: Partial<RecipientAllocation>) => void;
  removeRecipient: (tierId: string, recipientId: string) => void;
  recalculate: () => void;
  addAuditEntry: (action: string, details?: string) => void;
  resetToSeed: () => void;
}

function buildInitialState(): WaterfallState {
  const result = calculateWaterfall(185_000_000, SEED_TIERS);
  return {
    dealId: 'atlas',
    distributionPoolAmount: 185_000_000,
    currency: 'USD',
    tiers: result.tiers,
    unallocated: result.unallocated,
    hasDiscrepancy: result.hasDiscrepancy,
    lastCalculated: new Date().toISOString(),
  };
}

export const useWaterfallStore = create<WaterfallStore>()(
  persist(
    (set, get) => ({
      waterfall: buildInitialState(),
      auditLog: [
        { id: uid(), timestamp: '2026-02-14 09:30', actor: 'Deal Admin', action: 'Waterfall initialized from deal data' },
        { id: uid(), timestamp: '2026-02-13 14:12', actor: 'System', action: 'Calculation engine validated — no discrepancies' },
      ],

      setDistributionPool: (amount) => {
        set(s => {
          const result = calculateWaterfall(amount, s.waterfall.tiers);
          return { waterfall: { ...s.waterfall, distributionPoolAmount: amount, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Distribution pool updated', `New amount: $${(amount / 1e6).toFixed(0)}M`);
      },

      addTier: (name, category, ruleType, ruleValue) => {
        set(s => {
          const newTier: WaterfallTier = {
            id: uid(), priority: s.waterfall.tiers.length + 1, name, tierCategory: category,
            ruleType, ruleValue, capAmount: null, recipients: [],
            computedTotal: 0, status: 'PENDING', expanded: true,
          };
          const tiers = [...s.waterfall.tiers, newTier];
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Tier created', name);
      },

      updateTier: (tierId, updates) => {
        set(s => {
          const tiers = s.waterfall.tiers.map(t => t.id === tierId ? { ...t, ...updates } : t);
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Tier updated', `Tier ${tierId}`);
      },

      deleteTier: (tierId) => {
        const tierName = get().waterfall.tiers.find(t => t.id === tierId)?.name || '';
        set(s => {
          const tiers = s.waterfall.tiers.filter(t => t.id !== tierId).map((t, i) => ({ ...t, priority: i + 1 }));
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Tier deleted', tierName);
      },

      duplicateTier: (tierId) => {
        set(s => {
          const source = s.waterfall.tiers.find(t => t.id === tierId);
          if (!source) return s;
          const dup: WaterfallTier = {
            ...source,
            id: uid(),
            name: `${source.name} (Copy)`,
            priority: s.waterfall.tiers.length + 1,
            recipients: source.recipients.map(r => ({ ...r, id: uid() })),
            expanded: true,
          };
          const tiers = [...s.waterfall.tiers, dup];
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Tier duplicated', tierId);
      },

      toggleTierExpand: (tierId) => {
        set(s => ({
          waterfall: {
            ...s.waterfall,
            tiers: s.waterfall.tiers.map(t => t.id === tierId ? { ...t, expanded: !t.expanded } : t),
          },
        }));
      },

      addRecipient: (tierId, recipient) => {
        set(s => {
          const tiers = s.waterfall.tiers.map(t => {
            if (t.id !== tierId) return t;
            const newR: RecipientAllocation = {
              ...recipient, id: uid(), computedPayout: 0, computedPctOfPool: 0,
              status: (!recipient.prerequisites.kycRequired && !recipient.prerequisites.wireRequired) ? 'READY' : 'PENDING',
            };
            return { ...t, recipients: [...t.recipients, newR] };
          });
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Recipient added', `to tier ${tierId}`);
      },

      updateRecipient: (tierId, recipientId, updates) => {
        set(s => {
          const tiers = s.waterfall.tiers.map(t => {
            if (t.id !== tierId) return t;
            return { ...t, recipients: t.recipients.map(r => r.id === recipientId ? { ...r, ...updates } : r) };
          });
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
      },

      removeRecipient: (tierId, recipientId) => {
        set(s => {
          const tiers = s.waterfall.tiers.map(t => {
            if (t.id !== tierId) return t;
            return { ...t, recipients: t.recipients.filter(r => r.id !== recipientId) };
          });
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Recipient removed');
      },

      recalculate: () => {
        set(s => {
          const result = calculateWaterfall(s.waterfall.distributionPoolAmount, s.waterfall.tiers);
          return { waterfall: { ...s.waterfall, ...result, lastCalculated: new Date().toISOString() } };
        });
        get().addAuditEntry('Calculations run');
      },

      addAuditEntry: (action, details) => {
        set(s => ({
          auditLog: [
            { id: uid(), timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), actor: 'Deal Admin', action, details },
            ...s.auditLog,
          ].slice(0, 100),
        }));
      },

      resetToSeed: () => {
        set({ waterfall: buildInitialState(), auditLog: [] });
      },
    }),
    { name: 'pivt-waterfall-store' }
  )
);
