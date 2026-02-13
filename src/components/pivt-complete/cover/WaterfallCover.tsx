import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';

export const WaterfallCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { waterfallTiers } = usePIVTStore();
  const total = waterfallTiers.reduce((s, t) => s + t.amount, 0);
  const isReconciled = Math.abs(total - deal.consideration) < 1000;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Waterfall Distribution</h2>
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          isReconciled ? 'bg-validated/10 text-validated' : 'bg-blocking/10 text-blocking'
        }`}>
          {isReconciled ? '✓ Reconciled' : '✗ Mismatch'}
        </div>
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Tier</span>
            <span className="text-right">Amount</span>
            <span className="text-right">%</span>
            <span className="text-right">Recipients</span>
          </div>
        </div>
        {waterfallTiers.map((tier, i) => (
          <motion.div
            key={tier.id}
            {...fadeInUp}
            className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
          >
            <div className="grid grid-cols-5 items-center">
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-1 h-8 rounded-full bg-accent" style={{ opacity: 1 - i * 0.15 }} />
                <span className="font-medium">{tier.name}</span>
              </div>
              <span className="text-right font-mono">${(tier.amount / 1e6).toFixed(0)}M</span>
              <span className="text-right font-mono text-muted-foreground">{tier.percentage}%</span>
              <span className="text-right text-muted-foreground">{tier.recipients}</span>
            </div>
          </motion.div>
        ))}
        <div className="p-4 bg-muted/50 border-t border-border">
          <div className="grid grid-cols-5 items-center font-semibold">
            <span className="col-span-2">Total</span>
            <span className="text-right font-mono">${(total / 1e9).toFixed(2)}B</span>
            <span className="text-right font-mono">100%</span>
            <span className="text-right">{waterfallTiers.reduce((s, t) => s + t.recipients, 0)}</span>
          </div>
        </div>
      </div>

      {/* Visual breakdown bar */}
      <div className="pivt-card p-4">
        <p className="text-sm text-muted-foreground mb-3">Distribution Breakdown</p>
        <div className="flex h-6 rounded-lg overflow-hidden">
          {waterfallTiers.map((tier, i) => {
            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-accent'];
            return (
              <div
                key={tier.id}
                className={`${colors[i % colors.length]} transition-all`}
                style={{ width: `${tier.percentage}%` }}
                title={`${tier.name}: ${tier.percentage}%`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          {waterfallTiers.map((tier, i) => {
            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-accent'];
            return (
              <div key={tier.id} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                <span className="text-muted-foreground">{tier.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
