/**
 * Timeline Store - Unified event feed across deals
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EventCategory =
  | 'milestone' | 'document' | 'payment' | 'approval'
  | 'compliance' | 'discrepancy' | 'integration' | 'system'
  | 'reminder' | 'report' | 'note';

export type EventSeverity = 'info' | 'warning' | 'error';
export type EventVisibility = 'internal' | 'external';

export interface RelatedObject {
  type: 'stakeholder' | 'document' | 'payment' | 'escrow' | 'approval' | 'deal' | 'discrepancy';
  id: string;
  label: string;
}

export interface TimelineAttachment {
  name: string;
  url: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  dealId: string;
  dealName: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorType: 'user' | 'system' | 'integration';
  eventCategory: EventCategory;
  title: string;
  description: string;
  relatedObjects: RelatedObject[];
  attachments: TimelineAttachment[];
  severity: EventSeverity;
  visibility: EventVisibility;
}

// Seed demo events
const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

const SEED_EVENTS: TimelineEvent[] = [
  {
    id: 'te1', timestamp: h(0.25), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'u1', actorName: 'Seller Counsel', actorRole: 'Counsel', actorType: 'user',
    eventCategory: 'document', title: 'Waterfall Schedule v3 uploaded',
    description: 'Pending review by buyer counsel before approval can proceed.',
    relatedObjects: [{ type: 'document', id: 'd3', label: 'Waterfall Schedule v3' }],
    attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te2', timestamp: h(0.5), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'admin', actorName: 'Deal Admin', actorRole: 'Admin', actorType: 'user',
    eventCategory: 'approval', title: 'Wire approval requested',
    description: 'Execute $24.5M wire to Sarah Chen — requires dual authorization.',
    relatedObjects: [
      { type: 'payment', id: 'p1', label: '$24.5M wire to Sarah Chen' },
      { type: 'stakeholder', id: 's1', label: 'Sarah Chen' },
    ],
    attachments: [], severity: 'warning', visibility: 'internal',
  },
  {
    id: 'te3', timestamp: h(0.75), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'compliance', actorName: 'Compliance Team', actorRole: 'Compliance', actorType: 'user',
    eventCategory: 'compliance', title: 'Tiger Global Management — KYC verified',
    description: 'All beneficial ownership documentation validated.',
    relatedObjects: [{ type: 'stakeholder', id: 's5', label: 'Tiger Global Management' }],
    attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te4', timestamp: h(1.5), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'treasury', actorName: 'Treasury', actorRole: 'Treasury', actorType: 'user',
    eventCategory: 'payment', title: '$14.8M wire executed to Tiger Global',
    description: 'Wire reference: WR-2026-0847. Funds confirmed received.',
    relatedObjects: [{ type: 'payment', id: 'p5', label: '$14.8M wire' }],
    attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te5', timestamp: h(2), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'newton', actorName: 'Newton AI', actorRole: 'System', actorType: 'system',
    eventCategory: 'discrepancy', title: 'Cap table discrepancy detected',
    description: 'Ownership percentages sum to 100.3% — review required before closing.',
    relatedObjects: [{ type: 'discrepancy', id: 'disc1', label: 'Ownership % mismatch' }],
    attachments: [], severity: 'error', visibility: 'internal',
  },
  {
    id: 'te6', timestamp: h(3), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'u2', actorName: 'Buyer Counsel', actorRole: 'Counsel', actorType: 'user',
    eventCategory: 'document', title: 'Merger Agreement verified',
    description: 'Executed merger agreement passed all validation checks.',
    relatedObjects: [{ type: 'document', id: 'd1', label: 'Merger Agreement (Executed)' }],
    attachments: [{ name: 'Merger Agreement.pdf', url: '#' }], severity: 'info', visibility: 'external',
  },
  {
    id: 'te7', timestamp: h(4), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'system', actorName: 'System', actorRole: 'System', actorType: 'system',
    eventCategory: 'compliance', title: 'GIC Private Limited — KYC failed',
    description: 'Beneficial ownership documentation incomplete. Re-submission required.',
    relatedObjects: [{ type: 'stakeholder', id: 's8', label: 'GIC Private Limited' }],
    attachments: [], severity: 'error', visibility: 'internal',
  },
  {
    id: 'te8', timestamp: h(6), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'partner', actorName: 'Senior Partner', actorRole: 'Partner', actorType: 'user',
    eventCategory: 'approval', title: 'Escrow Agreement terms approved',
    description: 'All parties have signed off on escrow terms.',
    relatedObjects: [{ type: 'escrow', id: 'esc1', label: 'Escrow Agreement' }],
    attachments: [], severity: 'info', visibility: 'external',
  },
  {
    id: 'te9', timestamp: h(8), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'treasury', actorName: 'Treasury', actorRole: 'Treasury', actorType: 'user',
    eventCategory: 'payment', title: '$18M escrow funded',
    description: 'Escrow holdback deposited at JPMorgan escrow account.',
    relatedObjects: [{ type: 'escrow', id: 'esc1', label: '$18M escrow holdback' }],
    attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te10', timestamp: h(10), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'tax', actorName: 'Tax Advisor', actorRole: 'Advisor', actorType: 'user',
    eventCategory: 'document', title: 'Tax Certificates Bundle uploaded',
    description: '12 certificates covering all jurisdictions.',
    relatedObjects: [{ type: 'document', id: 'd7', label: 'Tax Certificates Bundle' }],
    attachments: [{ name: 'Tax_Certs.zip', url: '#' }], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te11', timestamp: h(15), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'newton', actorName: 'Newton AI', actorRole: 'System', actorType: 'system',
    eventCategory: 'system', title: '42 documents processed',
    description: 'Entity extraction complete. 3 discrepancies flagged for review.',
    relatedObjects: [], attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te12', timestamp: h(1), dealId: 'beacon', dealName: 'Project BEACON',
    actorId: 'u3', actorName: 'Legal Ops', actorRole: 'Legal', actorType: 'user',
    eventCategory: 'document', title: 'NDA package uploaded',
    description: 'Non-disclosure agreements for all counterparties uploaded for review.',
    relatedObjects: [{ type: 'document', id: 'bd1', label: 'NDA Package' }],
    attachments: [], severity: 'info', visibility: 'internal',
  },
  {
    id: 'te13', timestamp: h(3), dealId: 'beacon', dealName: 'Project BEACON',
    actorId: 'system', actorName: 'PIVT Agent', actorRole: 'System', actorType: 'system',
    eventCategory: 'system', title: 'Compliance Agent flagged stakeholder',
    description: 'CloudVault Security — missing board resolution for signing authority.',
    relatedObjects: [{ type: 'stakeholder', id: 'bs1', label: 'CloudVault Security' }],
    attachments: [], severity: 'warning', visibility: 'internal',
  },
  {
    id: 'te14', timestamp: h(5), dealId: 'beacon', dealName: 'Project BEACON',
    actorId: 'admin', actorName: 'Deal Admin', actorRole: 'Admin', actorType: 'user',
    eventCategory: 'milestone', title: 'Diligence phase initiated',
    description: 'All preliminary documents received. Moving to due diligence.',
    relatedObjects: [{ type: 'deal', id: 'beacon', label: 'Project BEACON' }],
    attachments: [], severity: 'info', visibility: 'external',
  },
  {
    id: 'te15', timestamp: h(2), dealId: 'cipher', dealName: 'Project CIPHER',
    actorId: 'admin', actorName: 'Deal Admin', actorRole: 'Admin', actorType: 'user',
    eventCategory: 'approval', title: 'Final signing package submitted',
    description: 'Awaiting signatures from Titan Strategic Group.',
    relatedObjects: [{ type: 'approval', id: 'ca1', label: 'Signing Package' }],
    attachments: [], severity: 'info', visibility: 'external',
  },
  {
    id: 'te16', timestamp: h(7), dealId: 'cipher', dealName: 'Project CIPHER',
    actorId: 'system', actorName: 'PIVT Agent', actorRole: 'System', actorType: 'system',
    eventCategory: 'report', title: 'Payment Schedule Export generated',
    description: 'Exported by Joanna (Admin) — covers 18 recipients.',
    relatedObjects: [], attachments: [{ name: 'payment_schedule.xlsx', url: '#' }],
    severity: 'info', visibility: 'internal',
  },
  {
    id: 'te17', timestamp: h(12), dealId: 'cipher', dealName: 'Project CIPHER',
    actorId: 'compliance', actorName: 'Compliance Team', actorRole: 'Compliance', actorType: 'user',
    eventCategory: 'compliance', title: 'All 18 stakeholders KYC verified',
    description: 'Full compliance achieved ahead of signing deadline.',
    relatedObjects: [], attachments: [], severity: 'info', visibility: 'external',
  },
  {
    id: 'te18', timestamp: h(24), dealId: 'atlas', dealName: 'Project ATLAS',
    actorId: 'system', actorName: 'System', actorRole: 'System', actorType: 'system',
    eventCategory: 'reminder', title: 'Reminder sent: KYC expiring for a16z',
    description: 'KYC documentation for Andreessen Horowitz expires in 14 days.',
    relatedObjects: [{ type: 'stakeholder', id: 's4', label: 'Andreessen Horowitz' }],
    attachments: [], severity: 'warning', visibility: 'internal',
  },
];

interface TimelineStore {
  events: TimelineEvent[];
  addEvent: (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => void;
  deleteEvent: (id: string) => void;
  getEventsForDeal: (dealId: string) => TimelineEvent[];
  getAllEvents: () => TimelineEvent[];
}

export const useTimelineStore = create<TimelineStore>()(
  persist(
    (set, get) => ({
      events: SEED_EVENTS,
      addEvent: (event) => {
        const newEvent: TimelineEvent = {
          ...event,
          id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ events: [newEvent, ...s.events] }));
      },
      deleteEvent: (id) => set((s) => ({ events: s.events.filter(e => e.id !== id) })),
      getEventsForDeal: (dealId) => get().events.filter(e => e.dealId === dealId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      getAllEvents: () => [...get().events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }),
    { name: 'pivt-timeline-store' }
  )
);
