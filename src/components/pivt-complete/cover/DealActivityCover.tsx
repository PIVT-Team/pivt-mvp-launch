import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useSelectedDeal } from '@/stores/pivtStore';
import {
  Bell, Clock, MessageSquare, CheckCircle2, AlertTriangle, XCircle, Info,
  FileText, Users, CreditCard, Shield, Search, Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ActivityView = 'notifications' | 'timeline' | 'discussions';

// ── Notifications ──
const NOTIFICATIONS = [
  { id: 'n1', category: 'error' as const, title: 'KYC Verification Failed', desc: 'GIC Private Limited — OFAC flag triggered', object: 'Stakeholder: GIC Private Limited', time: '2 min ago' },
  { id: 'n2', category: 'warning' as const, title: 'Wire Instructions Missing', desc: 'a16z trust account bank details incomplete', object: 'Stakeholder: Andreessen Horowitz', time: '15 min ago' },
  { id: 'n3', category: 'success' as const, title: 'Approval Received', desc: 'Buyer Counsel approved payout execution', object: 'Approval: Payout Execution', time: '32 min ago' },
  { id: 'n4', category: 'warning' as const, title: 'Discrepancy Detected', desc: 'ESOP pool ownership 7.2% vs cap table 7.0%', object: 'Cap Table: Employee Option Pool', time: '1 hr ago' },
  { id: 'n5', category: 'info' as const, title: 'Document Uploaded', desc: 'Waterfall Schedule v3 uploaded by Deal Admin', object: 'Document: Waterfall Schedule v3', time: '2 hr ago' },
  { id: 'n6', category: 'success' as const, title: 'Payment Executed', desc: '$224M wire to Tiger Global Management completed', object: 'Payment: Tiger Global', time: '3 hr ago' },
  { id: 'n7', category: 'info' as const, title: 'Reconciliation Run Complete', desc: 'Newton validation pass — 2 unresolved items', object: 'Reconciliation', time: '5 hr ago' },
];

const categoryConfig = {
  success: { icon: CheckCircle2, color: 'text-validated', bg: 'bg-validated/10', border: 'border-validated/20' },
  warning: { icon: AlertTriangle, color: 'text-discrepancy', bg: 'bg-discrepancy/10', border: 'border-discrepancy/20' },
  error: { icon: XCircle, color: 'text-blocking', bg: 'bg-blocking/10', border: 'border-blocking/20' },
  info: { icon: Info, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
};

// ── Timeline ──
const TIMELINE_EVENTS = [
  { time: '2026-02-14 09:12', action: 'Waterfall Schedule v3 uploaded', actor: 'Deal Admin', category: 'document' },
  { time: '2026-02-14 09:08', action: 'Newton reconciliation pass completed — 2 unresolved', actor: 'System', category: 'reconciliation' },
  { time: '2026-02-13 16:45', action: 'KYC verification failed — GIC Private Limited', actor: 'System', category: 'compliance' },
  { time: '2026-02-13 14:20', action: 'Buyer Counsel approved payout execution', actor: 'Buyer Counsel', category: 'approval' },
  { time: '2026-02-12 11:00', action: 'Wire executed: $224M to Tiger Global Management', actor: 'Payment Gateway', category: 'payment' },
  { time: '2026-02-11 15:30', action: 'Cap table reconciliation triggered', actor: 'Deal Admin', category: 'data' },
  { time: '2026-02-10 14:32', action: 'Discrepancy detected: ownership % mismatch', actor: 'Newton AI', category: 'reconciliation' },
  { time: '2026-02-10 10:00', action: 'Wire instructions updated for a16z', actor: 'Sarah Chen', category: 'data' },
  { time: '2026-02-08 10:15', action: 'Escrow account funded — $280M', actor: 'Escrow Agent', category: 'payment' },
  { time: '2026-02-05 08:00', action: 'Deal created', actor: 'Deal Admin', category: 'deal' },
];

const timelineCategories = ['all', 'approval', 'document', 'payment', 'data', 'reconciliation', 'compliance', 'deal'];

// ── Discussions ──
const DISCUSSIONS = [
  { id: 'd1', objectType: 'Discrepancy', objectName: 'ESOP Pool Ownership Mismatch', messages: 3, lastAuthor: 'Alexandra Reed', lastMessage: 'Confirmed with CFO — correct value is 7.0%. Updating cap table.', time: '30 min ago' },
  { id: 'd2', objectType: 'Document', objectName: 'Waterfall Schedule v3', messages: 5, lastAuthor: 'James Morrison', lastMessage: 'Seller counsel has reviewed and approved allocation methodology.', time: '2 hr ago' },
  { id: 'd3', objectType: 'Stakeholder', objectName: 'GIC Private Limited', messages: 2, lastAuthor: 'David Park', lastMessage: 'OFAC team escalated — awaiting compliance review from Singapore office.', time: '4 hr ago' },
  { id: 'd4', objectType: 'Approval', objectName: 'Payout Execution — Sarah Chen $840M', messages: 4, lastAuthor: 'Emily Watson', lastMessage: 'Dual-auth satisfied. Ready for final release confirmation.', time: '1 day ago' },
  { id: 'd5', objectType: 'Cap Table', objectName: 'Tiger Global Ownership Row', messages: 1, lastAuthor: 'Deal Admin', lastMessage: 'Minor rounding variance ($12K) within threshold — no action needed.', time: '2 days ago' },
];

const objectIcons: Record<string, React.ElementType> = {
  Discrepancy: AlertTriangle,
  Document: FileText,
  Stakeholder: Users,
  Approval: CheckCircle2,
  'Cap Table': CreditCard,
};

export const DealActivityCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [view, setView] = useState<ActivityView>('notifications');
  const [notifFilter, setNotifFilter] = useState<string>('all');
  const [timelineFilter, setTimelineFilter] = useState<string>('all');

  const views: { id: ActivityView; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'notifications', label: 'Notifications', icon: Bell, count: NOTIFICATIONS.filter(n => n.category === 'error' || n.category === 'warning').length },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare, count: DISCUSSIONS.length },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Activity</h2>
        <p className="text-sm text-muted-foreground">Deal-scoped notifications, timeline, and object discussions for {deal.codeName}</p>
      </div>

      {/* Section toggle */}
      <div className="flex gap-1 rounded-xl p-1 bg-muted/40">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
              view === v.id ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
            {v.count !== undefined && v.count > 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">{v.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Notifications View ── */}
      {view === 'notifications' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {['all', 'error', 'warning', 'success', 'info'].map(cat => (
              <button key={cat} onClick={() => setNotifFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${notifFilter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="pivt-card divide-y divide-border">
            {NOTIFICATIONS
              .filter(n => notifFilter === 'all' || n.category === notifFilter)
              .map(n => {
                const cfg = categoryConfig[n.category];
                const Icon = cfg.icon;
                return (
                  <motion.div key={n.id} {...fadeInUp} className="p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className={`p-1.5 rounded-lg ${cfg.bg} ${cfg.border} border`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{n.object}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{n.time}</span>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Timeline View ── */}
      {view === 'timeline' && (
        <div className="space-y-3">
          <div className="flex gap-1 flex-wrap">
            {timelineCategories.map(cat => (
              <button key={cat} onClick={() => setTimelineFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${timelineFilter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="pivt-card p-5">
            <div className="relative pl-5 space-y-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border" />
              {TIMELINE_EVENTS
                .filter(e => timelineFilter === 'all' || e.category === timelineFilter)
                .map((entry, i) => (
                  <div key={i} className="relative flex items-start gap-3">
                    <div className="absolute left-[-14px] w-2.5 h-2.5 rounded-full bg-accent mt-1.5 border-2 border-background" />
                    <div className="flex-1">
                      <p className="text-sm">{entry.action}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{entry.actor}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{entry.category}</Badge>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{entry.time}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Discussions View ── */}
      {view === 'discussions' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Discussions are attached to specific deal objects. No global threads.</p>
          <div className="pivt-card divide-y divide-border">
            {DISCUSSIONS.map(d => {
              const ObjIcon = objectIcons[d.objectType] || FileText;
              return (
                <motion.div key={d.id} {...fadeInUp} className="p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="p-1.5 rounded-lg bg-muted/50">
                    <ObjIcon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">{d.objectType}</Badge>
                      <span className="text-sm font-medium truncate">{d.objectName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      <span className="font-medium">{d.lastAuthor}:</span> {d.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">{d.time}</span>
                    <Badge variant="outline" className="text-[9px]">
                      <MessageSquare className="w-2.5 h-2.5 mr-1" />{d.messages}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};
