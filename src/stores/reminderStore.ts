import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReminderChannel = 'email' | 'slack' | 'clipboard';

export interface ReminderRecord {
  id: string;
  notificationId: string;
  dealId?: string;
  recipientName: string;
  recipientEmail: string;
  channel: ReminderChannel;
  message: string;
  sentAt: string;
  sentBy: string;
}

interface ReminderStore {
  reminders: ReminderRecord[];
  addReminder: (r: Omit<ReminderRecord, 'id' | 'sentAt'>) => ReminderRecord;
  getRemindersForNotification: (notificationId: string) => ReminderRecord[];
}

export const useReminderStore = create<ReminderStore>()(
  persist(
    (set, get) => ({
      reminders: [],

      addReminder: (r) => {
        const record: ReminderRecord = {
          ...r,
          id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sentAt: new Date().toISOString(),
        };
        set((s) => ({ reminders: [record, ...s.reminders] }));
        return record;
      },

      getRemindersForNotification: (notificationId) =>
        get().reminders.filter((r) => r.notificationId === notificationId),
    }),
    { name: 'pivt-reminders' }
  )
);

// Which notification types support reminders
export const REMINDER_ELIGIBLE_TYPES = new Set(['KYC', 'Payment', 'Approval', 'Discrepancy', 'Document']);

// Whether a specific notification title implies an outstanding action (not completed)
export function isActionable(title: string, severity: string): boolean {
  const completedKeywords = ['Approved', 'Confirmed', 'Granted', 'Verified', 'Synced', 'Resolved', 'Completed'];
  if (severity === 'success' || severity === 'info') {
    return !completedKeywords.some((kw) => title.includes(kw));
  }
  return true; // warnings and errors are actionable
}

// Context-aware recipient lookup
export interface ReminderRecipient {
  name: string;
  email: string;
  role: string;
}

export function getRecipientForNotification(type: string, entityId?: string): ReminderRecipient | null {
  // Demo mode: return realistic mock recipients based on type
  const recipients: Record<string, ReminderRecipient> = {
    KYC: { name: 'Innovation Ventures Fund II', email: 'compliance@innovationventures.com', role: 'Stakeholder' },
    Payment: { name: 'Sarah Chen', email: 'schen@northbridge.io', role: 'Finance Contact' },
    Approval: { name: 'James Morrison', email: 'jmorrison@pivt.io', role: 'Approver' },
    Discrepancy: { name: 'Alexandra Reed', email: 'areed@pivt.io', role: 'Deal Owner' },
    Document: { name: 'David Park', email: 'dpark@apexcap.com', role: 'Legal Counsel' },
  };
  return recipients[type] || null;
}

export function getDefaultMessage(type: string, title: string, dealName?: string): string {
  const deal = dealName || 'ATLAS-2024-001';
  const templates: Record<string, string> = {
    KYC: `This is a reminder that KYC verification is still pending for ${deal}. Please complete the required steps at your earliest convenience.`,
    Payment: `This is a reminder that wire instructions are still outstanding for ${deal}. Please provide the required banking details.`,
    Approval: `Your approval is required for ${deal}. Please review the pending items and provide your sign-off.`,
    Discrepancy: `A data discrepancy has been flagged on ${deal} and requires your review. Please investigate and resolve at your earliest convenience.`,
    Document: `A document signature is pending for ${deal}. Please review and sign the outstanding document.`,
  };
  return templates[type] || `This is a reminder regarding "${title}" on ${deal}. Please take the required action.`;
}
