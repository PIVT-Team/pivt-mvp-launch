import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSelectedDeal } from '@/stores/pivtStore';

// Demo discrepancy data
const DEMO_DISCREPANCIES = [
  {
    id: '1', rule_key: 'dual_counsel_missing', severity: 'blocker' as const, status: 'open' as const,
    message: 'Execution blocked: missing dual-counsel approvals (Buyer Counsel, Seller Counsel).',
    object_type: 'intent', details: { has_buyer_counsel: false, has_seller_counsel: true },
    why: 'Both buyer and seller counsel must sign off before any disbursement can execute. This prevents unauthorized fund movements.',
    fix_link: 'approvals',
  },
  {
    id: '2', rule_key: 'docs_not_executed', severity: 'blocker' as const, status: 'open' as const,
    message: 'Execution blocked: required documents are not fully executed.',
    object_type: 'deal', details: { total_docs: 5, incomplete: 2 },
    why: 'All deal documents must be executed (signed and countersigned) before funds can move.',
    fix_link: 'documents',
  },
  {
    id: '3', rule_key: 'fx_rate_outside_tolerance', severity: 'warn' as const, status: 'open' as const,
    message: 'Warning: FX rate moved beyond tolerance since quote.',
    object_type: 'intent', details: { currency_original: 'EUR', settlement_currency: 'USD' },
    why: 'Currency fluctuations may affect payout amounts. Consider re-quoting or locking the rate.',
    fix_link: null,
  },
  {
    id: '4', rule_key: 'large_payment_extra_approval', severity: 'warn' as const, status: 'acknowledged' as const,
    message: 'Warning: High-value disbursement requires additional approval.',
    object_type: 'intent', details: { amount: 12000000, threshold: 5000000 },
    why: 'Disbursements above $5M require PE Partner sign-off per firm policy.',
    fix_link: 'approvals',
  },
  {
    id: '5', rule_key: 'stale_deal_data', severity: 'info' as const, status: 'open' as const,
    message: 'Info: Deal data hasn\'t been updated recently—confirm details are current.',
    object_type: 'deal', details: { days_since_update: 18, threshold_days: 14 },
    why: 'Stale data increases execution risk. A quick review ensures accuracy before closing.',
    fix_link: null,
  },
];

const severityConfig = {
  blocker: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Blocker' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

export const DiscrepancyPanelCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const blockers = DEMO_DISCREPANCIES.filter(d => d.severity === 'blocker');
  const warnings = DEMO_DISCREPANCIES.filter(d => d.severity === 'warn');
  const infos = DEMO_DISCREPANCIES.filter(d => d.severity === 'info');

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
            <p className="text-sm text-muted-foreground">{deal.codeName} — {DEMO_DISCREPANCIES.length} findings</p>
          </div>
        </div>

        <Button
          disabled={!canExecute}
          className={`${canExecute ? 'pivt-btn-primary text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'} rounded-xl`}
        >
          {canExecute ? 'Ready to Execute' : `${blockers.length} Blockers Remain`}
        </Button>
      </div>

      {/* Summary Badges */}
      <div className="flex gap-3">
        {[
          { label: 'Blockers', count: blockers.length, severity: 'blocker' as const },
          { label: 'Warnings', count: warnings.length, severity: 'warn' as const },
          { label: 'Info', count: infos.length, severity: 'info' as const },
        ].map(({ label, count, severity }) => {
          const cfg = severityConfig[severity];
          return (
            <div key={severity} className={`pivt-card px-4 py-3 flex items-center gap-3 ${cfg.bg} ${cfg.border} border`}>
              <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
              <div>
                <p className={`text-lg font-bold ${cfg.color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Discrepancy List */}
      <div className="space-y-2">
        {DEMO_DISCREPANCIES.map((disc) => {
          const cfg = severityConfig[disc.severity];
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
                  {disc.status === 'acknowledged' && (
                    <Badge variant="outline" className="text-[10px] bg-muted/40">Acknowledged</Badge>
                  )}
                  <Badge variant="outline" className={`text-[10px] ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
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
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/30">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Why this matters</p>
                        <p className="text-sm">{disc.why}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{disc.rule_key}</span>
                        <span>•</span>
                        <span>{disc.object_type}</span>
                      </div>
                      <div className="flex gap-2">
                        {disc.severity === 'blocker' && disc.fix_link && (
                          <Button variant="outline" size="sm" className="text-xs gap-1.5">
                            <ExternalLink className="w-3 h-3" /> Fix: Go to {disc.fix_link}
                          </Button>
                        )}
                        {disc.severity !== 'blocker' && disc.status !== 'acknowledged' && (
                          <Button variant="outline" size="sm" className="text-xs gap-1.5">
                            <Check className="w-3 h-3" /> Acknowledge
                          </Button>
                        )}
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
