import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { Send, CheckCircle2, Clock, XCircle } from 'lucide-react';

export const PaymentsCover: React.FC = () => {
  const { payments } = usePIVTStore();
  const statusIcons = { pending: Clock, approved: CheckCircle2, executed: Send, failed: XCircle };
  const statusColors = { pending: 'text-discrepancy', approved: 'text-blue-500', executed: 'text-validated', failed: 'text-blocking' };

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Payments</h2>
        <span className="font-mono text-sm">Total: ${(total / 1e9).toFixed(2)}B</span>
      </div>
      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Recipient</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Status</span>
          </div>
        </div>
        {payments.map((p) => {
          const Icon = statusIcons[p.status];
          return (
            <motion.div key={p.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-4 items-center">
                <div className="col-span-2">
                  <p className="font-medium">{p.recipientName}</p>
                  <p className="text-xs text-muted-foreground">{p.method}</p>
                </div>
                <span className="text-right font-mono">${(p.amount / 1e6).toFixed(0)}M</span>
                <div className="flex justify-center">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColors[p.status]}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {p.status}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
