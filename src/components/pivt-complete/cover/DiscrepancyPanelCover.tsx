import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronRight, ExternalLink, Check, FileCheck, FileX, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSelectedDeal } from '@/stores/pivtStore';
import { ClosingReadinessPanel } from './ClosingReadinessPanel';

// Demo binder-grade discrepancy data
const DEMO_DISCREPANCIES = [
  // Core Closing Blockers
  {
    id: '1', rule_key: 'missing_core_docs', severity: 'blocker' as const, status: 'open' as const,
    message: 'Missing required document: Escrow Agreement (deal has $200,000 escrow).',
    object_type: 'deal', details: { missing_type: 'ESCROW_AGREEMENT', requirement_group: 'Core Closing' },
    why: 'Escrow agreement must be uploaded and verified when the deal includes an escrow holdback. This prevents fund movement without proper escrow instructions.',
    fix_link: 'documents',
    category: 'Core Closing',
  },
  {
    id: '2', rule_key: 'purchase_price_consistency', severity: 'blocker' as const, status: 'open' as const,
    message: 'Purchase price mismatch: SPA states $12,800,000 but deal value is $12,500,000.',
    object_type: 'deal', details: { spa_price: 12800000, deal_value: 12500000, variance_pct: '2.40' },
    why: 'The purchase price in the SPA must match the deal value. This $300K discrepancy could indicate an amendment was not captured or a data entry error.',
    fix_link: 'deal-inputs',
    category: 'Cross-Document',
  },
  {
    id: '3', rule_key: 'funds_flow_arithmetic', severity: 'blocker' as const, status: 'open' as const,
    message: 'Funds flow imbalance: sources ($12,500,000) ≠ uses ($12,485,000).',
    object_type: 'deal', details: { total_sources: 12500000, total_uses: 12485000 },
    why: 'Sources and uses in the funds flow memo must balance. The $15K gap may represent unaccounted fees or a calculation error.',
    fix_link: 'deal-inputs',
    category: 'Cross-Document',
  },
  {
    id: '4', rule_key: 'dual_counsel_approval', severity: 'blocker' as const, status: 'open' as const,
    message: 'Execution blocked: missing dual-counsel approvals (Buyer Counsel, Seller Counsel).',
    object_type: 'intent', details: { has_buyer_counsel: false, has_seller_counsel: true },
    why: 'Both buyer and seller counsel must sign off before any disbursement can execute.',
    fix_link: 'approvals',
    category: 'Approvals',
  },
  // Binder Warnings
  {
    id: '5', rule_key: 'party_name_alignment', severity: 'warn' as const, status: 'open' as const,
    message: 'Buyer name mismatch: SPA says "Orion Data Systems, LLC" but deal has "Orion Data Systems".',
    object_type: 'deal', details: { spa_buyer: 'Orion Data Systems, LLC', deal_buyer: 'Orion Data Systems' },
    why: 'Entity name mismatches can cause legal complications. Confirm the exact legal entity name.',
    fix_link: null,
    category: 'Cross-Document',
  },
  {
    id: '6', rule_key: 'disclosure_schedules_missing', severity: 'warn' as const, status: 'open' as const,
    message: 'Disclosure Schedules has not been uploaded.',
    object_type: 'deal', details: { missing_type: 'DISCLOSURE_SCHEDULES' },
    why: 'Disclosure schedules are typically required attachments to the SPA.',
    fix_link: 'documents',
    category: 'Binder Docs',
  },
  {
    id: '7', rule_key: 'board_consent_missing', severity: 'warn' as const, status: 'open' as const,
    message: 'Board Consent has not been uploaded.',
    object_type: 'deal', details: { missing_type: 'BOARD_CONSENT' },
    why: 'Board consent or resolution may be required for corporate authorization of the transaction.',
    fix_link: 'documents',
    category: 'Approvals',
  },
  {
    id: '8', rule_key: 'large_payment_extra_approval', severity: 'warn' as const, status: 'acknowledged' as const,
    message: 'Warning: High-value disbursement requires additional approval.',
    object_type: 'intent', details: { amount: 12000000, threshold: 5000000 },
    why: 'Disbursements above $5M require PE Partner sign-off per firm policy.',
    fix_link: 'approvals',
    category: 'Payment',
  },
  // Info
  {
    id: '9', rule_key: 'good_standing_missing', severity: 'info' as const, status: 'open' as const,
    message: 'Good Standing Certificate has not been uploaded.',
    object_type: 'deal', details: { missing_type: 'GOOD_STANDING' },
    why: 'Good standing certificates confirm the entity is in compliance with state requirements.',
    fix_link: null,
    category: 'Compliance',
  },
];

// Demo binder readiness
const DEMO_BINDER_READINESS = {
  score: 62,
  core_docs: { required: 3, present: 2 }, // SPA + Funds Flow present, Escrow missing
  total_docs: { required: 8, present: 5 },
  uploaded_types: ['SPA', 'FUNDS_FLOW', 'CAP_TABLE', 'WIRE_AUTHORIZATION', 'OFFICER_CERTIFICATE'],
  missing_required: ['ESCROW_AGREEMENT', 'SECRETARY_CERTIFICATE', 'BOARD_CONSENT'],
};

const severityConfig = {
  blocker: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Blocker' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

export const DiscrepancyPanelCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'blocker' | 'warn' | 'info'>('all');

  const filtered = activeFilter === 'all'
    ? DEMO_DISCREPANCIES
    : DEMO_DISCREPANCIES.filter(d => d.severity === activeFilter);

  const blockers = DEMO_DISCREPANCIES.filter(d => d.severity === 'blocker');
  const warnings = DEMO_DISCREPANCIES.filter(d => d.severity === 'warn');
  const infos = DEMO_DISCREPANCIES.filter(d => d.severity === 'info');

  const canExecute = blockers.length === 0;
  const binder = DEMO_BINDER_READINESS;

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

      {/* Binder Readiness Card */}
      <div className="pivt-card border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Closing Binder Readiness</h3>
          </div>
          <span className={`text-2xl font-bold ${binder.score >= 80 ? 'text-emerald-500' : binder.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
            {binder.score}%
          </span>
        </div>

        <Progress value={binder.score} className="h-2" />

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground">Core Docs</p>
            <p className="font-semibold">{binder.core_docs.present}/{binder.core_docs.required}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Total Required</p>
            <p className="font-semibold">{binder.total_docs.present}/{binder.total_docs.required}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Execution Gate</p>
            <p className={`font-semibold ${canExecute ? 'text-emerald-500' : 'text-red-500'}`}>
              {canExecute ? 'PASS' : 'FAIL'}
            </p>
          </div>
        </div>

        {/* Uploaded vs Missing */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-emerald-500" /> Uploaded
            </p>
            <div className="flex flex-wrap gap-1">
              {binder.uploaded_types.map(t => (
                <Badge key={t} variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {t.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <FileX className="w-3 h-3 text-red-500" /> Missing Required
            </p>
            <div className="flex flex-wrap gap-1">
              {binder.missing_required.map(t => (
                <Badge key={t} variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">
                  {t.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Closing Readiness Score */}
      <ClosingReadinessPanel dealId={deal?.id} />

      {/* Summary Badges with filter */}
      <div className="flex gap-3">
        {[
          { label: 'All', count: DEMO_DISCREPANCIES.length, filter: 'all' as const, color: 'text-foreground', bg: 'bg-muted/50', border: 'border-border' },
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

      {/* Key Value Conflicts Summary */}
      {blockers.some(b => ['purchase_price_consistency', 'escrow_amount_consistency', 'funds_flow_arithmetic'].includes(b.rule_key)) && (
        <div className="pivt-card border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Key Value Conflicts
          </h3>
          <div className="space-y-1.5">
            {blockers
              .filter(b => ['purchase_price_consistency', 'escrow_amount_consistency', 'funds_flow_arithmetic'].includes(b.rule_key))
              .map(b => (
                <p key={b.id} className="text-xs text-red-400">• {b.message}</p>
              ))}
          </div>
        </div>
      )}

      {/* Discrepancy List */}
      <div className="space-y-2">
        {filtered.map((disc) => {
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
                  {disc.category && (
                    <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground">{disc.category}</Badge>
                  )}
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
                        {disc.category && (
                          <>
                            <span>•</span>
                            <span>{disc.category}</span>
                          </>
                        )}
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
