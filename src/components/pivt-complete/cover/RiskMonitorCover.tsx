import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { ShieldAlert, ShieldCheck, AlertTriangle, Ban, ArrowRight, Loader2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePIVTStore } from '@/stores/pivtStore';
import { getPortfolioRisk, type PortfolioRisk } from '@/services/portfolioRiskService';

/**
 * Portfolio-wide risk.
 *
 * This screen used to render four invented deals — "Project ATLAS" at 42%
 * readiness — to everyone who opened it. It now reads open discrepancies,
 * pending approvals and unverified wires for the deals the viewer can actually
 * see.
 *
 * There is no execution-readiness percentage here on purpose. That number has
 * one definition, on the deal's own Execution tab; a second one computed from
 * cheaper signals would disagree with it, and a readiness figure that changes
 * depending on which screen you are looking at is worse than none.
 */
export const RiskMonitorCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const [risk, setRisk] = useState<PortfolioRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPortfolioRisk()
      .then((r) => { if (!cancelled) { setRisk(r); setError(null); } })
      .catch((e) => {
        // An empty risk monitor and a broken one look identical, and the wrong
        // one is the reassuring one.
        console.error('Portfolio risk query failed:', e);
        if (!cancelled) setError(e?.message || 'Could not load portfolio risk.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleNavigate = (dealId: string) => {
    setSelectedDealId(dealId);
    setActiveSection('workspace');
  };

  const totals = risk?.totals;
  const hasBlockers = (totals?.blockers ?? 0) > 0;

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      <motion.div {...fadeInUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasBlockers ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            {hasBlockers ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.03em' }}>Risk Monitor</h1>
            <p className="text-sm text-muted-foreground">Open discrepancies across every deal you can see. Click a deal to open its workspace.</p>
          </div>
        </div>
      </motion.div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading discrepancies…
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
          <p className="text-sm font-medium text-red-500">Risk could not be loaded</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error} Nothing below is showing a clean portfolio — it is showing nothing at all.
          </p>
        </div>
      )}

      {!loading && !error && risk && (
        <>
          <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
            {[
              { label: 'Blockers', value: totals!.blockers, color: totals!.blockers > 0 ? 'text-red-500' : 'text-emerald-500', sub: 'open, across all deals' },
              { label: 'Warnings', value: totals!.warnings, color: totals!.warnings > 0 ? 'text-amber-500' : 'text-emerald-500', sub: 'open, require attention' },
              { label: 'Deals Clear', value: `${totals!.dealsClear}/${totals!.dealCount}`, color: '', sub: 'no blockers or warnings' },
              { label: 'Pending Approvals', value: totals!.pendingApprovals, color: totals!.pendingApprovals > 0 ? 'text-amber-500' : '', sub: 'awaiting a decision' },
            ].map(card => (
              <div key={card.label} className="pivt-card p-5">
                <p className="pivt-metric-label">{card.label}</p>
                <p className={`text-xl font-semibold font-mono mt-2 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            ))}
          </motion.div>

          {risk.truncated && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Showing the {risk.deals.length} most recently updated deals. Older deals are not counted in the totals above.</span>
            </div>
          )}

          {risk.deals.length === 0 && (
            <div className="pivt-card p-8 text-center">
              <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No deals yet</p>
              <p className="text-xs text-muted-foreground mt-1">Risk appears here once a deal exists and has been checked.</p>
            </div>
          )}

          <motion.div {...fadeInUp} className="space-y-3">
            {risk.deals.map(d => {
              const blocked = d.blockers > 0;
              return (
                <div
                  key={d.id}
                  onClick={() => handleNavigate(d.id)}
                  className={`pivt-card p-5 cursor-pointer hover:bg-muted/20 transition-colors border-l-4 ${
                    blocked ? 'border-red-500/40' : d.warnings > 0 ? 'border-amber-500/40' : 'border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        blocked ? 'bg-red-500/10' : d.warnings > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                      }`}>
                        {blocked ? <Ban className="w-4 h-4 text-red-500" /> : d.warnings > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {d.dealName}
                          {d.isDemo && <Badge variant="outline" className="text-[9px] uppercase tracking-wide">Demo</Badge>}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{d.dealNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {d.blockers > 0 && <Badge variant="outline" className="text-[10px] text-red-500 bg-red-500/5">{d.blockers} blocker{d.blockers > 1 ? 's' : ''}</Badge>}
                        {d.warnings > 0 && <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/5">{d.warnings} warning{d.warnings > 1 ? 's' : ''}</Badge>}
                        {d.infos > 0 && <Badge variant="outline" className="text-[10px] text-blue-500 bg-blue-500/5">{d.infos} info</Badge>}
                        {d.pendingApprovals > 0 && <Badge variant="outline" className="text-[10px]">{d.pendingApprovals} approval{d.pendingApprovals > 1 ? 's' : ''} pending</Badge>}
                        {d.unverifiedWires > 0 && <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/5">{d.unverifiedWires} wire{d.unverifiedWires > 1 ? 's' : ''} unverified</Badge>}
                        {d.blockers === 0 && d.warnings === 0 && d.infos === 0 && d.pendingApprovals === 0 && d.unverifiedWires === 0 && (
                          <span className="text-[10px] text-muted-foreground">Nothing open</span>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>

                  {d.topIssue && (
                    <p className={`text-xs mt-2 ml-[52px] ${blocked ? 'text-red-400' : 'text-amber-400'}`}>
                      {blocked ? '⛔' : '⚠'} {d.topIssue}
                    </p>
                  )}
                  {d.lastActivity && (
                    <p className="text-[10px] text-muted-foreground mt-1 ml-[52px]">
                      Last updated: {new Date(d.lastActivity).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};
