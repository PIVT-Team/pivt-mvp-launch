/**
 * Waterfall Store — Payout Priority + Calculation Engine
 * Deal-scoped: starts empty until user creates tiers or uploads a waterfall model.
 */
import { create } from 'zustand';

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
  ruleValue: number;
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

// ── Helpers ──

const uid = () => crypto.randomUUID();

// ── Calculation ──
//
// The arithmetic lives in supabase/functions/_shared/waterfall.ts and is the
// same code the engine persists with. Two things changed by adopting it:
//   * payouts are computed in integer cents and reconcile exactly;
//   * a PERCENT_OF_POOL tier now takes ruleValue percent of the pool — the
//     old local math ignored ruleValue and gave such a tier everything left.
import { computeLocal } from "@/services/waterfallService";
const calculateWaterfall = computeLocal;

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
  initForDeal: (dealId: string, poolAmount: number) => void;
}

function buildEmptyState(): WaterfallState {
  return {
    dealId: '',
    distributionPoolAmount: 0,
    currency: 'USD',
    tiers: [],
    unallocated: 0,
    hasDiscrepancy: false,
    lastCalculated: null,
  };
}

export const useWaterfallStore = create<WaterfallStore>()(
  (set, get) => ({
    waterfall: buildEmptyState(),
    auditLog: [],

    initForDeal: (dealId, poolAmount) => {
      const current = get().waterfall;
      if (current.dealId === dealId) {
        // Already initialized for this deal, just update pool if changed
        if (current.distributionPoolAmount !== poolAmount && poolAmount > 0) {
          const result = calculateWaterfall(poolAmount, current.tiers);
          set(s => ({ waterfall: { ...s.waterfall, distributionPoolAmount: poolAmount, ...result } }));
        }
        return;
      }
      // New deal — start empty
      set({
        waterfall: { ...buildEmptyState(), dealId, distributionPoolAmount: poolAmount },
        auditLog: [],
      });
    },

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
  })
);
