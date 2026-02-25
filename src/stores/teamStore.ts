import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TeamRole = 'Admin' | 'Deal Manager' | 'Finance Ops' | 'Compliance' | 'Legal Counsel (Buyer)' | 'Legal Counsel (Seller)' | 'Viewer';

export type AccessScope = 'company-wide' | 'specific-deals';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  accessScope: AccessScope;
  dealIds: string[];
  status: 'active' | 'pending';
  invitedAt?: string;
  invitedBy?: string;
  acceptedAt?: string;
  inviteToken?: string;
}

interface TeamStore {
  members: TeamMember[];
  seeded: boolean;
  seedDemo: () => void;
  addInvite: (invite: Omit<TeamMember, 'id' | 'status' | 'invitedAt' | 'inviteToken'>) => TeamMember;
  acceptInvite: (token: string) => boolean;
  revokeInvite: (id: string) => void;
  removeMember: (id: string) => void;
  updateRole: (id: string, role: TeamRole) => void;
  resendInvite: (id: string) => void;
}

const SEED_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Alexandra Reed', email: 'areed@pivt.io', role: 'Admin', accessScope: 'company-wide', dealIds: [], status: 'active', acceptedAt: '2025-12-01T09:00:00Z' },
  { id: 'tm-2', name: 'James Morrison', email: 'jmorrison@pivt.io', role: 'Deal Manager', accessScope: 'company-wide', dealIds: [], status: 'active', acceptedAt: '2026-01-10T14:00:00Z' },
  { id: 'tm-3', name: 'Sarah Chen', email: 'schen@datastream.io', role: 'Legal Counsel (Buyer)', accessScope: 'specific-deals', dealIds: ['deal-001'], status: 'active', acceptedAt: '2026-01-20T11:00:00Z' },
  { id: 'tm-4', name: 'David Park', email: 'dpark@apexcap.com', role: 'Legal Counsel (Seller)', accessScope: 'specific-deals', dealIds: ['deal-001'], status: 'active', acceptedAt: '2026-02-01T16:00:00Z' },
  { id: 'tm-5', name: 'Emily Watson', email: 'ewatson@pivt.io', role: 'Viewer', accessScope: 'company-wide', dealIds: [], status: 'pending', invitedAt: '2026-02-20T10:00:00Z', invitedBy: 'Alexandra Reed', inviteToken: 'demo-token-001' },
];

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  'Admin': ['Create Deals', 'Edit Waterfall', 'Approve Payouts', 'View Documents', 'Manage Team', 'Configure Settings', 'Manage Integrations', 'KYC/KYB', 'Payments/Escrow', 'Reports'],
  'Deal Manager': ['Create Deals', 'Edit Waterfall', 'Approve Payouts', 'View Documents', 'KYC/KYB', 'Reports'],
  'Finance Ops': ['Payments/Escrow', 'View Documents', 'Reports'],
  'Compliance': ['KYC/KYB', 'View Documents', 'Reports'],
  'Legal Counsel (Buyer)': ['View Documents', 'Approve Payouts', 'Reports'],
  'Legal Counsel (Seller)': ['View Documents', 'Approve Payouts', 'Reports'],
  'Viewer': ['View Documents'],
};

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
      members: [],
      seeded: false,

      seedDemo: () => {
        if (get().seeded) return;
        set({ members: SEED_MEMBERS, seeded: true });
      },

      addInvite: (invite) => {
        const token = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const member: TeamMember = {
          ...invite,
          id: `tm-${Date.now()}`,
          status: 'pending',
          invitedAt: new Date().toISOString(),
          inviteToken: token,
        };
        set((s) => ({ members: [...s.members, member] }));
        return member;
      },

      acceptInvite: (token) => {
        const found = get().members.find((m) => m.inviteToken === token && m.status === 'pending');
        if (!found) return false;
        set((s) => ({
          members: s.members.map((m) =>
            m.inviteToken === token ? { ...m, status: 'active' as const, acceptedAt: new Date().toISOString() } : m
          ),
        }));
        return true;
      },

      revokeInvite: (id) =>
        set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

      removeMember: (id) =>
        set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

      updateRole: (id, role) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, role } : m)),
        })),

      resendInvite: (id) =>
        set((s) => ({
          members: s.members.map((m) =>
            m.id === id ? { ...m, invitedAt: new Date().toISOString() } : m
          ),
        })),
    }),
    { name: 'pivt-team' }
  )
);
