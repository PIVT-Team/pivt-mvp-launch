import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'KYC' | 'Payment' | 'Document' | 'Discrepancy' | 'Approval' | 'System';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  dealId?: string;
  entityId?: string;
  createdAt: string;
  read: boolean;
  actionRoute?: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  seeded: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  unreadCount: () => number;
  seedDemoNotifications: () => void;
}

const SEED_NOTIFICATIONS: Omit<AppNotification, 'id'>[] = [
  {
    type: 'Approval',
    severity: 'warning',
    title: 'Approval Required',
    description: 'Board approval needed for ATLAS-2024-001 closing conditions.',
    dealId: 'deal-001',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    read: false,
    actionRoute: '/pivt?section=workspace&tab=approvals',
  },
  {
    type: 'KYC',
    severity: 'error',
    title: 'KYC Verification Failed',
    description: 'Stakeholder James Whitfield failed AML screening — manual review required.',
    dealId: 'deal-001',
    entityId: 'sth-001',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    read: false,
    actionRoute: '/pivt?section=workspace&tab=kyc',
  },
  {
    type: 'Payment',
    severity: 'success',
    title: 'Wire Confirmed',
    description: '$4.2M escrow deposit verified by JPMorgan Chase.',
    dealId: 'deal-001',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    read: false,
    actionRoute: '/pivt?section=workspace&tab=escrow',
  },
  {
    type: 'Document',
    severity: 'info',
    title: 'Document Uploaded',
    description: 'Purchase Agreement v3.2 uploaded by external counsel.',
    dealId: 'deal-001',
    entityId: 'doc-005',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    read: false,
    actionRoute: '/pivt?section=workspace&tab=documents',
  },
  {
    type: 'Discrepancy',
    severity: 'warning',
    title: 'Discrepancy Detected',
    description: 'Cap table ownership sum exceeds 100% — 0.3% variance found.',
    dealId: 'deal-001',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    read: false,
    actionRoute: '/pivt?section=workspace&tab=waterfall',
  },
  {
    type: 'System',
    severity: 'info',
    title: 'Integration Synced',
    description: 'DocuSign integration completed full sync — 12 envelopes updated.',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    read: true,
    actionRoute: '/pivt?section=integrations',
  },
  {
    type: 'KYC',
    severity: 'success',
    title: 'KYC Approved',
    description: 'Stakeholder Sarah Chen passed identity verification.',
    dealId: 'deal-001',
    entityId: 'sth-002',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    read: true,
    actionRoute: '/pivt?section=workspace&tab=kyc',
  },
  {
    type: 'Approval',
    severity: 'info',
    title: 'Approval Granted',
    description: 'Legal counsel signed off on indemnification clause.',
    dealId: 'deal-001',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    read: true,
    actionRoute: '/pivt?section=workspace&tab=approvals',
  },
];

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      seeded: false,

      seedDemoNotifications: () => {
        if (get().seeded) return;
        set({
          notifications: SEED_NOTIFICATIONS.map((n, i) => ({
            ...n,
            id: `notif-seed-${i}`,
          })),
          seeded: true,
        });
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      clearAll: () => set({ notifications: [] }),

      addNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ],
        })),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: 'pivt-notifications' }
  )
);
