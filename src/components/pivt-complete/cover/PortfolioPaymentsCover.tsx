import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { Banknote, CheckCircle2, Clock, AlertTriangle, Zap, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePIVTStore } from '@/stores/pivtStore';
import { SampleDataNotice } from './SampleDataNotice';

const MOCK_PORTFOLIO_PAYMENTS = [
  { id: '1', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sarah Chen', amount: 55_500_000, currency: 'USD', status: 'eligible', updatedAt: '2026-02-14' },
  { id: '2', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Marcus Williams', amount: 37_000_000, currency: 'USD', status: 'pending_approvals', updatedAt: '2026-02-14' },
  { id: '3', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sequoia Capital Fund XIV', amount: 27_750_000, currency: 'EUR', status: 'pending_conditions', updatedAt: '2026-02-13' },
  { id: '4', deal: 'Project BEACON', dealNumber: 'PIVT-2026-000143', recipient: 'Andreessen Horowitz', amount: 18_500_000, currency: 'USD', status: 'executing', updatedAt: '2026-02-12' },
  { id: '5', deal: 'Project CIPHER', dealNumber: 'PIVT-2026-000144', recipient: 'Tiger Global Management', amount: 14_800_000, currency: 'GBP', status: 'settled', updatedAt: '2026-02-10' },
  { id: '6', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Employee Option Pool', amount: 12_950_000, currency: 'USD', status: 'draft', updatedAt: '2026-02-15' },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-muted-foreground', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending_conditions: { color: 'text-amber-500', icon: <AlertTriangle className="w-3 h-3" />, label: 'Pending Conditions' },
  pending_approvals: { color: 'text-amber-500', icon: <Clock className="w-3 h-3" />, label: 'Pending Approvals' },
  eligible: { color: 'text-emerald-500', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Eligible' },
  executing: { color: 'text-blue-500', icon: <Zap className="w-3 h-3 animate-pulse" />, label: 'Executing' },
  settled: { color: 'text-emerald-600', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Settled' },
  failed: { color: 'text-destructive', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
};

const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;

export const PortfolioPaymentsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();

  const totalValue = MOCK_PORTFOLIO_PAYMENTS.reduce((s, p) => s + p.amount, 0);
  const settled = MOCK_PORTFOLIO_PAYMENTS.filter(p => p.status === 'settled');
  const blocked = MOCK_PORTFOLIO_PAYMENTS.filter(p => ['pending_conditions', 'pending_approvals'].includes(p.status));

  const handleDealClick = (dealNumber: string) => {
    // Find deal by number and navigate to workspace execution tab
    const dealMap: Record<string, string> = {
      'PIVT-2026-000142': 'deal-atlas',
      'PIVT-2026-000143': 'deal-beacon',
      'PIVT-2026-000144': 'deal-cipher',
    };
    const dealId = dealMap[dealNumber];
    if (dealId) {
      setSelectedDealId(dealId);
      setActiveSection('workspace');
    }
  };

  return (
    <motion.div {...staggerChildren} className="space-y-8">
      <SampleDataNotice what="This portfolio payments view" className="mb-4" />
      <motion.div {...fadeInUp}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ letterSpacing: '-0.03em' }}>Portfolio Payments</h1>
            <p className="text-sm text-muted-foreground">Read-only aggregate view across all deals. Edit payments inside each Deal → Execution.</p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Pipeline', value: fmt(totalValue), sub: `${MOCK_PORTFOLIO_PAYMENTS.length} intents` },
          { label: 'Settled', value: fmt(settled.reduce((s, p) => s + p.amount, 0)), sub: `${settled.length} completed` },
          { label: 'Blocked', value: `${blocked.length}`, sub: 'need resolution', color: 'text-amber-500' },
          { label: 'Active Deals', value: '3', sub: 'with payment activity' },
        ].map(card => (
          <div key={card.label} className="pivt-card p-5">
            <p className="pivt-metric-label">{card.label}</p>
            <p className={`text-xl font-semibold font-mono mt-2 ${card.color || ''}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Payments Table */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <h3 className="font-medium text-sm">All Disbursement Intents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Click a deal to navigate to its Execution tab</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                {['Deal', 'Recipient', 'Amount', 'Currency', 'Status', 'Updated'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PORTFOLIO_PAYMENTS.map(p => {
                const cfg = statusConfig[p.status] || statusConfig.draft;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/20 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => handleDealClick(p.dealNumber)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium">{p.deal}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.dealNumber}</p>
                    </td>
                    <td className="px-5 py-3">{p.recipient}</td>
                    <td className="px-5 py-3 font-mono">{fmt(p.amount)}</td>
                    <td className="px-5 py-3">{p.currency}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{p.updatedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
