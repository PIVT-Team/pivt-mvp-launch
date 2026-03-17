/**
 * Newton Activity Timeline — Shows what Newton and the user have done on this deal.
 * Pulls from agent_runs and deal_events for real activity data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Sparkles,
  ChevronDown, Upload, Users, FileText, DollarSign,
  Shield, CheckSquare, Landmark, Receipt, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ActivityEntry {
  id: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
  source: 'newton' | 'user' | 'system';
  icon?: React.ElementType;
}

// Map event types to human-readable descriptions and icons
const EVENT_MAP: Record<string, { label: string; icon: React.ElementType; status: ActivityEntry['status'] }> = {
  'stakeholder_import': { label: 'Imported stakeholder data', icon: Users, status: 'success' },
  'stakeholder_created': { label: 'Stakeholder record created', icon: Users, status: 'success' },
  'kyc_request_sent': { label: 'KYC/KYB verification request sent', icon: Shield, status: 'info' },
  'kyc_verified': { label: 'Stakeholder KYC verified', icon: Shield, status: 'success' },
  'document_uploaded': { label: 'Document uploaded', icon: Upload, status: 'info' },
  'document_parsed': { label: 'Document parsed and reviewed', icon: FileText, status: 'success' },
  'funds_flow_parsed': { label: 'Funds flow spreadsheet parsed', icon: DollarSign, status: 'success' },
  'wire_matched': { label: 'Wire instructions matched to payees', icon: Landmark, status: 'success' },
  'wire_mismatch': { label: 'Wire instruction mismatch detected', icon: Landmark, status: 'warning' },
  'obligations_extracted': { label: 'Payment obligations extracted from agreements', icon: FileText, status: 'success' },
  'approval_created': { label: 'Approval request prepared', icon: CheckSquare, status: 'info' },
  'approval_sent': { label: 'Approval sent via DocuSign', icon: CheckSquare, status: 'info' },
  'approval_completed': { label: 'Approval signature received', icon: CheckSquare, status: 'success' },
  'approval_declined': { label: 'Approval declined', icon: CheckSquare, status: 'error' },
  'tax_form_received': { label: 'Tax form received', icon: Receipt, status: 'success' },
  'tax_form_missing': { label: 'Missing tax form flagged', icon: Receipt, status: 'warning' },
  'analysis_started': { label: 'Deal analysis started', icon: Sparkles, status: 'info' },
  'analysis_completed': { label: 'Deal analysis completed', icon: Sparkles, status: 'success' },
  'analysis_failed': { label: 'Deal analysis failed', icon: Sparkles, status: 'error' },
  'discrepancy_found': { label: 'Discrepancy detected', icon: AlertTriangle, status: 'warning' },
  'discrepancy_resolved': { label: 'Discrepancy resolved', icon: AlertTriangle, status: 'success' },
  'readiness_updated': { label: 'Deal readiness status updated', icon: Zap, status: 'info' },
  'state_transition': { label: 'Deal state advanced', icon: Zap, status: 'success' },
};

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  success: { dot: 'bg-validated', text: 'text-validated' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-500' },
  error: { dot: 'bg-blocking', text: 'text-blocking' },
  info: { dot: 'bg-accent', text: 'text-accent' },
};

interface Props {
  dealId: string | null;
  /** Locally added entries from user actions in this session */
  localEntries?: ActivityEntry[];
}

export const NewtonActivityTimeline: React.FC<Props> = ({ dealId, localEntries = [] }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);

    const [agentRes, eventsRes] = await Promise.all([
      supabase.from('agent_runs')
        .select('id, agent_type, status, created_at, summary_text, finding_count')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('deal_events')
        .select('id, event_type, created_at, payload, new_state')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const agentEntries: ActivityEntry[] = (agentRes.data || []).map((r: any) => {
      const statusKey = r.status === 'completed' ? 'analysis_completed'
        : r.status === 'running' ? 'analysis_started'
        : r.status === 'failed' ? 'analysis_failed' : 'analysis_started';
      const mapped = EVENT_MAP[statusKey] || EVENT_MAP['analysis_started'];
      return {
        id: r.id,
        description: r.summary_text || `${mapped.label} (${r.finding_count || 0} findings)`,
        timestamp: new Date(r.created_at),
        status: mapped.status,
        source: 'newton' as const,
        icon: mapped.icon,
      };
    });

    const dealEntries: ActivityEntry[] = (eventsRes.data || []).map((e: any) => {
      const mapped = EVENT_MAP[e.event_type];
      if (mapped) {
        return {
          id: e.id,
          description: mapped.label,
          timestamp: new Date(e.created_at),
          status: mapped.status,
          source: 'system' as const,
          icon: mapped.icon,
        };
      }
      return {
        id: e.id,
        description: e.event_type.replace(/_/g, ' '),
        timestamp: new Date(e.created_at),
        status: 'info' as const,
        source: 'system' as const,
        icon: Zap,
      };
    });

    // Merge, dedupe, sort descending
    const all = [...localEntries, ...agentEntries, ...dealEntries]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 25);

    setEntries(all);
    setLoading(false);
  }, [dealId, localEntries]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  if (!dealId) return null;

  const visibleEntries = collapsed ? entries.slice(0, 3) : entries.slice(0, 10);
  const hasMore = entries.length > (collapsed ? 3 : 10);

  return (
    <div className="pivt-card border border-border overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Newton Activity</span>
          {entries.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4">{entries.length}</Badge>
          )}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', !collapsed && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {loading && entries.length === 0 ? (
                <p className="text-[10px] text-muted-foreground py-4 text-center">Loading activity…</p>
              ) : entries.length === 0 ? (
                <div className="text-center py-6">
                  <Sparkles className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground">No activity yet. Use the chat above to start working on this deal.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-0">
                    {visibleEntries.map((entry, i) => {
                      const style = STATUS_STYLES[entry.status];
                      const Icon = entry.icon || Sparkles;
                      const timeStr = formatRelativeTime(entry.timestamp);

                      return (
                        <div key={entry.id} className="relative flex items-start gap-3 py-2 pl-0 group">
                          {/* Dot */}
                          <div className={cn('w-[15px] h-[15px] rounded-full border-2 border-card flex items-center justify-center shrink-0 z-10', style.dot)}>
                            <div className="w-[5px] h-[5px] rounded-full bg-card" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 -mt-0.5">
                            <div className="flex items-center gap-1.5">
                              <Icon className={cn('w-3 h-3 shrink-0', style.text)} />
                              <span className="text-[11px] text-foreground leading-snug truncate">{entry.description}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-muted-foreground">{timeStr}</span>
                              {entry.source === 'newton' && (
                                <Badge variant="outline" className="text-[8px] px-1 h-3.5 border-accent/20 text-accent">Newton</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hasMore && (
                    <button
                      onClick={() => setCollapsed(false)}
                      className="text-[10px] text-accent hover:underline mt-1 ml-6"
                    >
                      Show more activity
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
