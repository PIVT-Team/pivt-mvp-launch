import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, FileUp, Shield, CheckCircle2, CreditCard, XCircle } from 'lucide-react';

interface NextAction {
  label: string;
  type: 'doc' | 'compliance' | 'approval' | 'payment' | 'discrepancy';
}

const actionIcon = {
  doc: FileUp,
  compliance: Shield,
  approval: CheckCircle2,
  payment: CreditCard,
  discrepancy: XCircle,
};

export const NextActionsBanner: React.FC<{ actions: NextAction[]; blockerCount: number }> = ({ actions, blockerCount }) => {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-3 right-3 z-10 w-72 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-blocking" />
        <span className="text-xs font-semibold">{blockerCount} blocker{blockerCount !== 1 ? 's' : ''} to execute</span>
      </div>
      <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
        {actions.map((a, i) => {
          const Icon = actionIcon[a.type] || AlertTriangle;
          return (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer text-xs">
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{a.label}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
