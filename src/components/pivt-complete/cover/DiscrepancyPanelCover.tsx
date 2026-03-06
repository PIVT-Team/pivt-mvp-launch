import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink, Check, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { ClosingReadinessPanel } from './ClosingReadinessPanel';

interface Discrepancy {
  id: string;
  rule_key: string;
  severity: string;
  status: string;
  message: string;
  object_type: string;
  details: Record<string, unknown>;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  blocker: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Blocker' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

export const DiscrepancyPanelCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'blocker' | 'warn' | 'info'>('all');

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    supabase
      .from('discrepancies')
      .select('id, rule_key, severity, status, message, object_type, details')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const severityMap: Record<string, string> = { high: 'blocker', medium: 'warn', low: 'info' };
        setDiscrepancies((data || []).map(d => ({
          ...d,
          severity: severityMap[d.severity] || d.severity,
          details: (d.details || {}) as Record<string, unknown>,
        })));
        setLoading(false);
      });
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (discrepancies.length === 0) {
    return (
      <div className="space-y-6">
        <ClosingReadinessPanel dealId={dealId || undefined} />
        <div className="pivt-card border border-border/50 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold">No discrepancies identified yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Any execution blockers identified during validation, document review, or cross-check analysis will appear here.
          </p>
        </div>
      </div>
    );
  }

  const filtered = activeFilter === 'all'
    ? discrepancies
    : discrepancies.filter(d => d.severity === activeFilter);

  const blockers = discrepancies.filter(d => d.severity === 'blocker');
  const warnings = discrepancies.filter(d => d.severity === 'warn');
  const infos = discrepancies.filter(d => d.severity === 'info');
  const canExecute = blockers.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${canExecute ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            {canExecute ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">Pre-Execution Risk & Discrepancy Panel</h2>
            <p className="text-sm text-muted-foreground">{discrepancies.length} findings</p>
          </div>
        </div>
        <Badge className={`text-xs px-3 py-1 ${canExecute ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
          {canExecute ? 'Ready to Execute' : `${blockers.length} Blockers Remain`}
        </Badge>
      </div>

      <ClosingReadinessPanel dealId={dealId || undefined} />

      {/* Filter badges */}
      <div className="flex gap-3">
        {[
          { label: 'All', count: discrepancies.length, filter: 'all' as const, color: 'text-foreground', bg: 'bg-muted/50', border: 'border-border' },
          { label: 'Blockers', count: blockers.length, filter: 'blocker' as const, ...severityConfig.blocker },
          { label: 'Warnings', count: warnings.length, filter: 'warn' as const, ...severityConfig.warn },
          { label: 'Info', count: infos.length, filter: 'info' as const, ...severityConfig.info },
        ].map(({ label, count, filter, color, bg, border }) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`pivt-card px-4 py-3 flex items-center gap-3 border transition-all ${
              activeFilter === filter ? `${bg} ${border} ring-1 ring-primary/30` : 'border-border/30 hover:border-border'
            }`}
          >
            <div>
              <p className={`text-lg font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Discrepancy list */}
      <div className="space-y-2">
        {filtered.map((disc) => {
          const cfg = severityConfig[disc.severity] || severityConfig.info;
          const isExpanded = expandedId === disc.id;
          return (
            <div key={disc.id} className={`pivt-card border ${cfg.border} overflow-hidden`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : disc.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                <p className="text-sm flex-1">{disc.message}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
                  <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground">{disc.status}</Badge>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{disc.rule_key}</span>
                        <span>•</span>
                        <span>{disc.object_type}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
