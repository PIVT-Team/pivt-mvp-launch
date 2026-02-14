import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface RiskCheck {
  label: string;
  status: 'pass' | 'fail' | 'pending';
  detail?: string;
}

interface Props {
  checks: RiskCheck[];
}

const statusIcon = (s: RiskCheck['status']) => {
  if (s === 'pass') return <CheckCircle2 className="w-3.5 h-3.5 text-validated" />;
  if (s === 'fail') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
  return <Clock className="w-3.5 h-3.5 text-discrepancy" />;
};

export const EscrowRiskIndicators: React.FC<Props> = ({ checks }) => {
  const passed = checks.filter(c => c.status === 'pass').length;

  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Escrow Risk Indicators</h3>
        </div>
        <span className="text-xs text-muted-foreground">{passed}/{checks.length} passed</span>
      </div>
      <div className="space-y-2">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
            {statusIcon(check.status)}
            <div className="flex-1">
              <p className="text-sm">{check.label}</p>
              {check.detail && <p className="text-[10px] text-muted-foreground mt-0.5">{check.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
