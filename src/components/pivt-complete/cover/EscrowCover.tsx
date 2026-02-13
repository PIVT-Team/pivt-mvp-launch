import React from 'react';
import { motion } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { Lock, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export const EscrowCover: React.FC = () => {
  const deal = useSelectedDeal();
  const escrowAmount = deal.consideration * 0.1;
  const released = escrowAmount * 0.3;
  const held = escrowAmount - released;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>

      <div className="grid grid-cols-3 gap-4">
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Total Escrow</span>
          </div>
          <p className="pivt-stat">${(escrowAmount / 1e6).toFixed(0)}M</p>
          <p className="text-xs text-muted-foreground mt-1">10% of deal value</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-4 h-4 text-validated" />
            <span className="text-sm text-muted-foreground">Released</span>
          </div>
          <p className="pivt-stat text-validated">${(released / 1e6).toFixed(0)}M</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-discrepancy" />
            <span className="text-sm text-muted-foreground">Held</span>
          </div>
          <p className="pivt-stat text-discrepancy">${(held / 1e6).toFixed(0)}M</p>
        </motion.div>
      </div>

      <div className="pivt-card p-5">
        <h3 className="font-medium mb-4">Escrow Timeline</h3>
        <div className="space-y-4">
          {[
            { date: '2026-01-15', event: 'Escrow funded', amount: escrowAmount, type: 'in' },
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
                {evt.type === 'out' ? '-' : ''}${(evt.amount / 1e6).toFixed(0)}M
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
