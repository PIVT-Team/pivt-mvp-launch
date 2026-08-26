import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { Banknote, CheckCircle2, Clock, AlertTriangle, Zap, XCircle, Loader2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePIVTStore } from '@/stores/pivtStore';
import { SimulationNotice } from './SimulationNotice';
import {
  getPortfolioPayments,
  type PortfolioPaymentsSummary,
  type DisbursementStatus,
} from '@/services/portfolioPaymentsService';

/**
 * Payments across every deal.
 *
 * This screen used to render six invented payments and a portfolio total
 * computed from them. It now reads `disbursement_intents`.
 *
 * Totals are shown per currency. The previous version added USD, EUR and GBP
 * together and printed the result with a dollar sign — on a payments screen
 * that is a wrong number presented as a total.
 */
const statusConfig: Record<DisbursementStatus, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-muted-foreground', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending_conditions: { color: 'text-amber-500', icon: <AlertTriangle className="w-3 h-3" />, label: 'Pending Conditions' },
  pending_approvals: { color: 'text-amber-500', icon: <Clock className="w-3 h-3" />, label: 'Pending Approvals' },
  eligible: { color: 'text-emerald-500', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Eligible' },
  executing: { color: 'text-blue-500', icon: <Zap className="w-3 h-3 animate-pulse" />, label: 'Executing' },
  executed: { color: 'text-blue-500', icon: <Zap className="w-3 h-3" />, label: 'Executed' },
  settled: { color: 'text-emerald-600', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Settled' },
  reconciled: { color: 'text-emerald-600', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Reconciled' },
  failed: { color: 'text-destructive', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
};

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

export const PortfolioPaymentsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const [data, setData] = useState<PortfolioPaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPortfolioPayments()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => {
        console.error('Portfolio payments query failed:', e);
        if (!cancelled) setError(e?.message || 'Could not load payments.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    setActiveSection('workspace');
  };

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      <motion.div {...fadeInUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.03em' }}>Portfolio Payments</h1>
            <p className="text-sm text-muted-foreground">Disbursement intents across every deal you can see. Click a row to open its workspace.</p>
          </div>
        </div>
      </motion.div>

      {data?.anySimulated && <SimulationNotice />}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading disbursement intents…
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <p className="text-sm font-medium text-red-500">Payments could not be loaded</p>
          <p className="text-xs text-muted-foreground mt-1">{error} No payment figures are shown below.</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
            <div className="pivt-card p-5">
              <p className="pivt-metric-label">Total by currency</p>
              {data.totalsByCurrency.length === 0
                ? <p className="text-xl font-semibold font-mono mt-2">—</p>
                : data.totalsByCurrency.map(t => (
                    <p key={t.currency} className="text-lg font-semibold font-mono mt-1">
                      {money(t.amount, t.currency)}
                      <span className="text-[10px] text-muted-foreground font-sans ml-2">{t.count} payment{t.count > 1 ? 's' : ''}</span>
                    </p>
                  ))}
              <p className="text-xs text-muted-foreground mt-1">never summed across currencies</p>
            </div>
            {[
              { label: 'Blocked', value: data.blockedCount, color: data.blockedCount > 0 ? 'text-amber-500' : '', sub: 'awaiting conditions or approvals' },
              { label: 'Executed', value: data.executedCount, color: '', sub: 'executing, settled or reconciled' },
              { label: 'Failed', value: data.failedCount, color: data.failedCount > 0 ? 'text-destructive' : '', sub: 'need attention' },
            ].map(card => (
              <div key={card.label} className="pivt-card p-5">
                <p className="pivt-metric-label">{card.label}</p>
                <p className={`text-xl font-semibold font-mono mt-2 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            ))}
          </motion.div>

          {data.truncated && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Showing the {data.payments.length} most recently updated payments. The totals above cover only those.</span>
            </div>
          )}

          {data.payments.length === 0 && (
            <div className="pivt-card p-8 text-center">
              <Banknote className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No payments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Disbursement intents appear here once a waterfall has been calculated on a deal.</p>
            </div>
          )}

          <motion.div {...fadeInUp} className="space-y-2">
            {data.payments.map(p => {
              const cfg = statusConfig[p.status];
              return (
                <div
                  key={p.id}
                  onClick={() => openDeal(p.dealId)}
                  className="pivt-card p-4 cursor-pointer hover:bg-muted/20 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.recipient}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      <span className="font-mono">{p.dealNumber}</span> · {p.dealName}
                      {p.isDemo && <Badge variant="outline" className="ml-2 text-[9px] uppercase tracking-wide">Demo</Badge>}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <span className="font-mono text-sm">{money(p.amount, p.currency)}</span>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.color}`}>
                      {cfg.icon}{cfg.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground w-24 text-right">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};
