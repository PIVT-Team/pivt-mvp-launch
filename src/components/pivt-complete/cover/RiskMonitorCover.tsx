import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { ShieldAlert, ShieldCheck, AlertTriangle, Ban, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePIVTStore } from '@/stores/pivtStore';

const MOCK_RISK_DATA = [
  {
    id: 'deal-atlas', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142',
    blockers: 2, warnings: 3, infos: 1, executionReadiness: 42,
    topBlocker: 'Missing dual-counsel approvals', lastUpdated: '2026-02-14 09:12',
  },
  {
    id: 'deal-beacon', deal: 'Project BEACON', dealNumber: 'PIVT-2026-000143',
    blockers: 0, warnings: 1, infos: 2, executionReadiness: 88,
    topBlocker: null, lastUpdated: '2026-02-13 16:45',
  },
  {
    id: 'deal-cipher', deal: 'Project CIPHER', dealNumber: 'PIVT-2026-000144',
    blockers: 1, warnings: 2, infos: 0, executionReadiness: 65,
    topBlocker: 'FX rate not locked for GBP settlement', lastUpdated: '2026-02-12 11:00',
  },
  {
    id: 'deal-delta', deal: 'Project DELTA', dealNumber: 'PIVT-2026-000145',
    blockers: 0, warnings: 0, infos: 1, executionReadiness: 100,
    topBlocker: null, lastUpdated: '2026-02-11 08:30',
  },
];

export const RiskMonitorCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();

  const totalBlockers = MOCK_RISK_DATA.reduce((s, d) => s + d.blockers, 0);
  const totalWarnings = MOCK_RISK_DATA.reduce((s, d) => s + d.warnings, 0);
  const dealsReady = MOCK_RISK_DATA.filter(d => d.blockers === 0 && d.warnings === 0).length;
  const avgReadiness = Math.round(MOCK_RISK_DATA.reduce((s, d) => s + d.executionReadiness, 0) / MOCK_RISK_DATA.length);

  const handleNavigate = (dealId: string) => {
    setSelectedDealId(dealId);
    setActiveSection('workspace');
  };

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      <motion.div {...fadeInUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalBlockers > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            {totalBlockers > 0 ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.03em' }}>Risk Monitor</h1>
            <p className="text-sm text-muted-foreground">Portfolio-wide discrepancy oversight. Click a deal to view its Execution tab.</p>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
        {[
          { label: 'Blockers', value: totalBlockers, color: totalBlockers > 0 ? 'text-red-500' : 'text-emerald-500', sub: 'across all deals' },
          { label: 'Warnings', value: totalWarnings, color: totalWarnings > 0 ? 'text-amber-500' : 'text-emerald-500', sub: 'require attention' },
          { label: 'Deals Ready', value: `${dealsReady}/${MOCK_RISK_DATA.length}`, color: '', sub: 'no blockers or warnings' },
          { label: 'Avg Readiness', value: `${avgReadiness}%`, color: '', sub: 'execution readiness' },
        ].map(card => (
          <div key={card.label} className="pivt-card p-5">
            <p className="pivt-metric-label">{card.label}</p>
            <p className={`text-xl font-semibold font-mono mt-2 ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Deal Risk Cards */}
      <motion.div {...fadeInUp} className="space-y-3">
        {MOCK_RISK_DATA.map(d => {
          const hasBlockers = d.blockers > 0;
          return (
            <div
              key={d.id}
              onClick={() => handleNavigate(d.id)}
              className={`pivt-card p-5 cursor-pointer hover:bg-muted/20 transition-colors border-l-4 ${
                hasBlockers ? 'border-red-500/40' : d.warnings > 0 ? 'border-amber-500/40' : 'border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    hasBlockers ? 'bg-red-500/10' : d.warnings > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                  }`}>
                    {hasBlockers ? <Ban className="w-4 h-4 text-red-500" /> : d.warnings > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{d.deal}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{d.dealNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    {d.blockers > 0 && <Badge variant="outline" className="text-[10px] text-red-500 bg-red-500/5">{d.blockers} blockers</Badge>}
                    {d.warnings > 0 && <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/5">{d.warnings} warnings</Badge>}
                    {d.infos > 0 && <Badge variant="outline" className="text-[10px] text-blue-500 bg-blue-500/5">{d.infos} info</Badge>}
                  </div>

                  <div className="w-32">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Readiness</span>
                      <span className="text-xs font-mono font-medium">{d.executionReadiness}%</span>
                    </div>
                    <Progress value={d.executionReadiness} className="h-1.5" />
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              {d.topBlocker && (
                <p className="text-xs text-red-400 mt-2 ml-[52px]">⚠ {d.topBlocker}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 ml-[52px]">Last updated: {d.lastUpdated}</p>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};
