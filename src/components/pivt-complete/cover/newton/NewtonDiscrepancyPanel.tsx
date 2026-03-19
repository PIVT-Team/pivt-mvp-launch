/**
 * Newton Wire Discrepancy Panel — Premium side-by-side comparison UI.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, X, Edit3, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DiscrepancyItem {
  id: string;
  rule_key: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expected_value?: string;
  actual_value?: string;
  recommendation: string;
  affected_entities: { type: string; id: string; label: string }[];
  resolved?: boolean;
}

interface Props {
  discrepancies: DiscrepancyItem[];
  onResolve?: (id: string) => void;
  onClose?: () => void;
  dealName?: string;
}

const severityConfig = {
  critical: { bg: 'bg-destructive/5', border: 'border-destructive/20', badge: 'bg-destructive/10 text-destructive', icon: '🔴' },
  high: { bg: 'bg-blocking/5', border: 'border-blocking/20', badge: 'bg-blocking/10 text-blocking', icon: '🟠' },
  medium: { bg: 'bg-warning/5', border: 'border-warning/20', badge: 'bg-warning/10 text-warning', icon: '🟡' },
  low: { bg: 'bg-muted', border: 'border-border', badge: 'bg-muted text-muted-foreground', icon: '🔵' },
};

export const NewtonDiscrepancyPanel: React.FC<Props> = ({ discrepancies, onResolve, onClose, dealName }) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const critical = discrepancies.filter(d => d.severity === 'critical' && !d.resolved).length;
  const high = discrepancies.filter(d => d.severity === 'high' && !d.resolved).length;
  const resolved = discrepancies.filter(d => d.resolved).length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blocking" />
            Wire Discrepancy Analysis
          </h3>
          {dealName && <p className="text-xs text-muted-foreground mt-0.5">{dealName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
            {critical} critical
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blocking/10 text-blocking font-medium">
            {high} high
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-validated/10 text-validated font-medium">
            {resolved} resolved
          </span>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Discrepancy List */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
        <AnimatePresence initial={false}>
          {discrepancies.map(d => {
            const cfg = severityConfig[d.severity];
            const isExpanded = expandedId === d.id;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn('px-4 py-3', d.resolved && 'opacity-50')}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <span className="text-sm mt-0.5">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate">{d.title}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', cfg.badge)}>
                        {d.severity}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {d.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />}
                </div>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 ml-7 space-y-3"
                    >
                      {/* Side-by-side comparison */}
                      {(d.expected_value || d.actual_value) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-validated/5 border border-validated/10 p-2.5">
                            <p className="text-[10px] font-medium text-validated mb-1">Expected</p>
                            <p className="text-xs font-mono">{d.expected_value || '—'}</p>
                          </div>
                          <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
                            <p className="text-[10px] font-medium text-destructive mb-1">Actual</p>
                            <p className="text-xs font-mono">{d.actual_value || '—'}</p>
                          </div>
                        </div>
                      )}

                      {/* Affected entities */}
                      {d.affected_entities.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">Affected</p>
                          <div className="flex flex-wrap gap-1">
                            {d.affected_entities.slice(0, 5).map((e, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {e.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      <div className="rounded-lg bg-accent/5 border border-accent/10 p-2.5">
                        <p className="text-[10px] font-medium text-accent mb-1">Recommendation</p>
                        <p className="text-xs text-foreground">{d.recommendation}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!d.resolved && onResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] rounded-lg border-validated/20 text-validated hover:bg-validated/10"
                            onClick={(e) => { e.stopPropagation(); onResolve(d.id); }}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Resolved
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg">
                          <Edit3 className="w-3 h-3 mr-1" /> Edit Data
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg">
                          <Mail className="w-3 h-3 mr-1" /> Request Clarification
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {discrepancies.length === 0 && (
        <div className="py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-validated mx-auto mb-2" />
          <p className="text-sm font-medium">No discrepancies detected</p>
          <p className="text-xs text-muted-foreground">All wire instructions reconcile cleanly</p>
        </div>
      )}
    </div>
  );
};
