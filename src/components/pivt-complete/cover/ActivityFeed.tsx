/**
 * Real-time Deal Activity Feed
 */
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp, springConfig } from '@/lib/animations';
import {
  Activity, FileUp, UserCheck, AlertTriangle, Send, Shield, CreditCard,
  CheckCircle2, Clock, Filter, ChevronDown, Bell,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ActivityEvent {
  id: string;
  type: 'document' | 'kyc' | 'approval' | 'payment' | 'escrow' | 'system';
  action: string;
  actor: string;
  target: string;
  timestamp: Date;
  details?: string;
  severity?: 'info' | 'warning' | 'critical';
}

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  document: { icon: FileUp, color: 'text-validated' },
  kyc: { icon: UserCheck, color: 'text-accent' },
  approval: { icon: Send, color: 'text-amber-400' },
  payment: { icon: CreditCard, color: 'text-accent/70' },
  escrow: { icon: Shield, color: 'text-cyan-400' },
  system: { icon: Activity, color: 'text-muted-foreground' },
};

// Generate demo activity events
const generateDemoEvents = (dealName: string): ActivityEvent[] => {
  const now = Date.now();
  const events: ActivityEvent[] = [
    { id: 'e1', type: 'document', action: 'uploaded', actor: 'Seller Counsel', target: 'Waterfall Schedule v3', timestamp: new Date(now - 15 * 60000), details: 'Pending review by buyer counsel' },
    { id: 'e2', type: 'approval', action: 'requested', actor: 'Deal Admin', target: 'Execute $840M wire to Sarah Chen', timestamp: new Date(now - 32 * 60000), severity: 'warning', details: 'Requires dual authorization' },
    { id: 'e3', type: 'kyc', action: 'verified', actor: 'Compliance', target: 'Tiger Global Management', timestamp: new Date(now - 45 * 60000) },
    { id: 'e4', type: 'payment', action: 'executed', actor: 'Treasury', target: '$224M wire to Tiger Global', timestamp: new Date(now - 90 * 60000), details: 'Wire reference: WR-2026-0847' },
    { id: 'e5', type: 'system', action: 'flagged', actor: 'Newton AI', target: 'Cap table discrepancy detected', timestamp: new Date(now - 120 * 60000), severity: 'critical', details: 'Ownership percentages sum to 100.3% — review required' },
    { id: 'e6', type: 'document', action: 'verified', actor: 'Buyer Counsel', target: 'Merger Agreement (Executed)', timestamp: new Date(now - 180 * 60000) },
    { id: 'e7', type: 'kyc', action: 'failed', actor: 'System', target: 'GIC Private Limited', timestamp: new Date(now - 240 * 60000), severity: 'critical', details: 'Beneficial ownership documentation incomplete' },
    { id: 'e8', type: 'approval', action: 'approved', actor: 'Senior Partner', target: 'Escrow Agreement terms', timestamp: new Date(now - 360 * 60000) },
    { id: 'e9', type: 'escrow', action: 'funded', actor: 'Treasury', target: '$280M escrow holdback', timestamp: new Date(now - 480 * 60000), details: 'Funds received at JPMorgan escrow account' },
    { id: 'e10', type: 'document', action: 'uploaded', actor: 'Tax Advisor', target: 'Tax Certificates Bundle', timestamp: new Date(now - 600 * 60000) },
    { id: 'e11', type: 'payment', action: 'approved', actor: 'Deal Admin', target: '$560M wire to Marcus Williams', timestamp: new Date(now - 720 * 60000) },
    { id: 'e12', type: 'system', action: 'analyzed', actor: 'Newton AI', target: '108 documents processed', timestamp: new Date(now - 900 * 60000), details: 'Entity extraction complete. 3 discrepancies flagged for review.' },
  ];
  return events;
};

function formatTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ActivityFeed: React.FC = () => {
  const deal = useSelectedDeal();
  const [filter, setFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const events = useMemo(() => generateDemoEvents(deal.codeName), [deal.codeName]);

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => e.type === filter);

  const filterOptions = [
    { value: 'all', label: 'All Activity' },
    { value: 'document', label: 'Documents' },
    { value: 'kyc', label: 'KYC' },
    { value: 'approval', label: 'Approvals' },
    { value: 'payment', label: 'Payments' },
    { value: 'escrow', label: 'Escrow' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground">Live Activity</span>
          <div className="w-1.5 h-1.5 rounded-full bg-validated animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3 mr-1" />
            {filterOptions.find(f => f.value === filter)?.label || 'Filter'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Filter pills */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1 overflow-hidden"
          >
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setShowFilters(false); }}
                className={`px-2 py-1 rounded-full text-[10px] border transition-colors ${
                  filter === opt.value
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'border-border text-muted-foreground hover:border-accent/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          {filteredEvents.map((event, i) => {
            const config = typeConfig[event.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="relative flex items-start gap-3 py-2.5 group"
              >
                {/* Timeline dot */}
                <div className={`relative z-10 w-[30px] h-[30px] rounded-full border flex items-center justify-center shrink-0 ${
                  event.severity === 'critical'
                    ? 'border-blocking/30 bg-blocking/10'
                    : event.severity === 'warning'
                      ? 'border-discrepancy/30 bg-discrepancy/10'
                      : 'border-border bg-card'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${
                    event.severity === 'critical' ? 'text-blocking' :
                    event.severity === 'warning' ? 'text-discrepancy' :
                    config.color
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{event.actor}</span>
                    <span className="text-[10px] text-muted-foreground">{event.action}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTimeAgo(event.timestamp)}</span>
                  </div>
                  <p className="text-xs text-foreground/80 truncate">{event.target}</p>
                  {event.details && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{event.details}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
