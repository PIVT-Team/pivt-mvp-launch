import React from 'react';
import { motion } from 'framer-motion';
import { useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { Lock, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, Info, Building2 } from 'lucide-react';

export const EscrowCover: React.FC = () => {
  const deal = useSelectedDeal();
  const escrowAmount = deal.consideration * 0.1;
  const released = escrowAmount * 0.3;
  const held = escrowAmount - released;

  // Interest calculation (simulated)
  const interestRate = 4.25;
  const clientSplit = 85;
  const platformSplit = 15;
  const openDate = new Date('2026-01-15');
  const closeDate = new Date(deal.closingDate || '2026-06-15');
  const holdingDays = Math.max(1, Math.round((closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24)));
  const grossInterest = held * (interestRate / 100) * (holdingDays / 365);
  const clientInterest = grossInterest * (clientSplit / 100);
  const platformInterest = grossInterest * (platformSplit / 100);

  const fmt = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  // Ledger entries
  const ledger = [
    { date: '2026-01-15', description: 'Escrow funded (partner institution)', debit: 0, credit: escrowAmount },
    { date: '2026-02-01', description: 'Working capital adjustment released', debit: released, credit: 0 },
    { date: '2026-02-14', description: 'Projected interest accrual', debit: 0, credit: grossInterest },
    { date: '2026-03-01', description: 'Advisory fee deducted', debit: escrowAmount * 0.005, credit: 0 },
    { date: '2026-06-15', description: 'Indemnity escrow release (scheduled)', debit: held * 0.5, credit: 0 },
    { date: '2027-01-15', description: 'Final escrow release (scheduled)', debit: held * 0.5, credit: 0 },
  ];

  let runningBalance = 0;
  const ledgerWithBalance = ledger.map(entry => {
    runningBalance += entry.credit - entry.debit;
    return { ...entry, balance: runningBalance };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Building2 className="w-3 h-3" />
          Partner: JPMorgan Chase • FBO Account
        </div>
      </div>

      {/* Non-custody notice */}
      <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/15 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-accent shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Total Escrow</span>
          </div>
          <p className="pivt-stat">{fmt(escrowAmount)}</p>
          <p className="text-xs text-muted-foreground mt-1">10% of deal value</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-4 h-4 text-validated" />
            <span className="text-sm text-muted-foreground">Released</span>
          </div>
          <p className="pivt-stat text-validated">{fmt(released)}</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-discrepancy" />
            <span className="text-sm text-muted-foreground">Held</span>
          </div>
          <p className="pivt-stat text-discrepancy">{fmt(held)}</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Projected Interest</span>
          </div>
          <p className="pivt-stat text-accent">{fmt(grossInterest)}</p>
          <p className="text-xs text-muted-foreground mt-1">{interestRate}% • {holdingDays}d hold</p>
        </motion.div>
      </div>

      {/* Interest Projection Card */}
      <motion.div {...fadeInUp} className="pivt-card p-5 border-l-2 border-l-accent">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Projected Interest Earnings</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium ml-auto">Projected (simulated for pilot environment)</span>
        </div>
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Holding Period</p>
            <p className="font-mono font-semibold mt-0.5">{holdingDays} days</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Interest Rate</p>
            <p className="font-mono font-semibold mt-0.5">{interestRate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross Interest</p>
            <p className="font-mono font-semibold mt-0.5">{fmt(grossInterest)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Client Share ({clientSplit}%)</p>
            <p className="font-mono font-semibold mt-0.5 text-validated">{fmt(clientInterest)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Platform Share ({platformSplit}%)</p>
            <p className="font-mono font-semibold mt-0.5 text-accent">{fmt(platformInterest)}</p>
          </div>
        </div>
      </motion.div>

      {/* Escrow Ledger */}
      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-medium">Escrow Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Debit</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Credit</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerWithBalance.map((entry, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.date}</td>
                  <td className="px-4 py-3 text-sm">{entry.description}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {entry.debit > 0 ? <span className="text-destructive">-{fmt(entry.debit)}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {entry.credit > 0 ? <span className="text-validated">+{fmt(entry.credit)}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{fmt(entry.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escrow Timeline */}
      <div className="pivt-card p-5">
        <h3 className="font-medium mb-4">Escrow Timeline</h3>
        <div className="space-y-4">
          {[
            { date: '2026-01-15', event: 'Escrow funded at partner institution', amount: escrowAmount, type: 'in' },
            { date: '2026-02-01', event: 'Working capital adjustment released', amount: released, type: 'out' },
            { date: '2026-08-15', event: 'Indemnity escrow release (scheduled)', amount: held * 0.5, type: 'pending' },
            { date: '2027-01-15', event: 'Final escrow release (scheduled)', amount: held * 0.5, type: 'pending' },
          ].map((evt, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${
                evt.type === 'in' ? 'bg-accent' : evt.type === 'out' ? 'bg-validated' : 'bg-muted-foreground'
              }`} />
              <span className="text-xs font-mono text-muted-foreground w-24">{evt.date}</span>
              <span className="flex-1 text-sm">{evt.event}</span>
              <span className={`font-mono text-sm ${evt.type === 'out' ? 'text-validated' : ''}`}>
                {evt.type === 'out' ? '-' : ''}{fmt(evt.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
