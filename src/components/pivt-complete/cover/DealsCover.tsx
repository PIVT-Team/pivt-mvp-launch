import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';

export const DealsCover: React.FC = () => {
  const { deals, selectedDealId, setSelectedDealId, setActiveSection } = usePIVTStore();

  const statusColors: Record<string, string> = {
    drafting: 'bg-muted-foreground',
    diligence: 'bg-blue-500',
    signing: 'bg-purple-500',
    closing: 'bg-accent',
    completed: 'bg-validated',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Active Deals</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total Portfolio: </span>
          <span className="font-mono font-semibold text-foreground">
            ${(deals.reduce((s, d) => s + d.consideration, 0) / 1e9).toFixed(1)}B
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        {deals.map((deal) => (
          <motion.div
            key={deal.id}
            {...fadeInUp}
            onClick={() => { setSelectedDealId(deal.id); setActiveSection('command'); }}
            className={`pivt-card p-5 cursor-pointer transition-all hover:shadow-md ${
              selectedDealId === deal.id ? 'border-accent ring-1 ring-accent/20' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg">{deal.codeName}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[deal.status]}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{deal.buyerName} → {deal.targetCompany}</p>
                <p className="text-xs text-muted-foreground mt-1">{deal.sector} · Closing {deal.closingDate}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold">${(deal.consideration / 1e9).toFixed(1)}B</p>
                <p className="text-xs text-muted-foreground mt-1">{deal.totalRecipients} recipients</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
              <span>{deal.documentsUploaded} docs</span>
              <span className={deal.discrepanciesFound > 0 ? 'text-discrepancy font-medium' : 'text-validated'}>
                {deal.discrepanciesFound} discrepancies
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${deal.readyToPayPercent}%` }} />
                </div>
                <span className="font-mono">{deal.readyToPayPercent}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
