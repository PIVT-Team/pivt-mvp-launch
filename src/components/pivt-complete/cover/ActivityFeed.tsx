/**
 * Real-time Deal Activity Feed — driven by deal_events + audit_log
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, FileUp, UserCheck, AlertTriangle, Send, Shield, CreditCard,
  CheckCircle2, Clock, Filter, ChevronDown, Inbox,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ActivityEvent {
  id: string;
  type: string;
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

function classifyEvent(eventType: string): string {
  if (eventType.includes('document') || eventType.includes('DOC') || eventType.includes('upload')) return 'document';
  if (eventType.includes('kyc') || eventType.includes('KYC') || eventType.includes('verif')) return 'kyc';
  if (eventType.includes('approv') || eventType.includes('APPROV')) return 'approval';
  if (eventType.includes('payment') || eventType.includes('wire') || eventType.includes('PAYMENT')) return 'payment';
  if (eventType.includes('escrow')) return 'escrow';
  return 'system';
}

function formatTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ActivityFeed: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [filter, setFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      supabase
        .from('deal_events')
        .select('id, event_type, actor_id, created_at, payload')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('audit_log')
        .select('id, action, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([eventsRes, auditRes]) => {
      const mapped: ActivityEvent[] = [];
      const seen = new Set<string>();

      (eventsRes.data || []).forEach((e: any) => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        mapped.push({
          id: e.id,
          type: classifyEvent(e.event_type),
          action: e.event_type.replace(/_/g, ' '),
          actor: 'System',
          target: e.event_type.replace(/_/g, ' '),
          timestamp: new Date(e.created_at),
        });
      });

      (auditRes.data || []).forEach((e: any) => {
        if (seen.has(e.id)) return;
        seen.add(e.id);
        mapped.push({
          id: e.id,
          type: classifyEvent(e.action),
          action: e.action,
          actor: 'System',
          target: e.action,
          timestamp: new Date(e.created_at),
        });
      });

      mapped.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setEvents(mapped.slice(0, 20));
      setLoading(false);
    });
  }, [dealId]);

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

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-4 text-center">Loading activity…</div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-6 text-center">
        <Inbox className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground">Live Activity</span>
        </div>
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
            const config = typeConfig[event.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="relative flex items-start gap-3 py-2.5 group"
              >
                <div className={`relative z-10 w-[30px] h-[30px] rounded-full border flex items-center justify-center shrink-0 border-border bg-card`}>
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{event.actor}</span>
                    <span className="text-[10px] text-muted-foreground">{event.action}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTimeAgo(event.timestamp)}</span>
                  </div>
                  <p className="text-xs text-foreground/80 truncate">{event.target}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
