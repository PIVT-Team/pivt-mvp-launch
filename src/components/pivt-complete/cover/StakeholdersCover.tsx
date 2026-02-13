import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export const StakeholdersCover: React.FC = () => {
  const { stakeholders } = usePIVTStore();

  const kycIcons = { verified: CheckCircle2, pending: Clock, failed: XCircle };
  const kycColors = { verified: 'text-validated', pending: 'text-discrepancy', failed: 'text-blocking' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stakeholders</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-validated">{stakeholders.filter(s => s.kycStatus === 'verified').length} Verified</span>
          <span className="text-discrepancy">{stakeholders.filter(s => s.kycStatus === 'pending').length} Pending</span>
          <span className="text-blocking">{stakeholders.filter(s => s.kycStatus === 'failed').length} Failed</span>
        </div>
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span>Role</span>
            <span className="text-right">Ownership</span>
            <span className="text-right">Payout</span>
            <span className="text-center">KYC</span>
          </div>
        </div>
        {stakeholders.map((s) => {
          const Icon = kycIcons[s.kycStatus];
          return (
            <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-6 items-center">
                <div className="col-span-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                <span className="text-sm text-muted-foreground">{s.role}</span>
                <span className="text-right font-mono">{s.ownershipPct}%</span>
                <span className="text-right font-mono">${(s.payoutAmount / 1e6).toFixed(0)}M</span>
                <div className="flex justify-center">
                  <Icon className={`w-4 h-4 ${kycColors[s.kycStatus]}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
