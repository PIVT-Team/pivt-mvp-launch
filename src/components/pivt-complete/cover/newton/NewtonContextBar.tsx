/**
 * Newton Context Bar — Shows execution readiness or empty state.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

interface Props {
  operationMode: 'global' | 'deal';
  readinessPct: number;
  blockerCount: number;
  dealName?: string;
}

export const NewtonContextBar: React.FC<Props> = ({ operationMode, readinessPct, blockerCount, dealName }) => {
  if (operationMode === 'global') {
    return (
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground/50" />
          <div>
            <p className="text-xs text-muted-foreground">No deal selected</p>
            <p className="text-[11px] text-muted-foreground/70">Create or open a deal to begin</p>
          </div>
        </div>
      </div>
    );
  }

  const barColor = readinessPct >= 80 ? 'bg-validated' : readinessPct >= 40 ? 'bg-accent' : 'bg-blocking';
  const textColor = readinessPct >= 80 ? 'text-validated' : readinessPct >= 40 ? 'text-accent' : 'text-blocking';

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">Execution Readiness: <span className={textColor}>{readinessPct}%</span></span>
        {readinessPct === 100 && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-validated" />
            <span className="text-[10px] text-validated font-medium">Ready</span>
          </div>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${readinessPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {blockerCount > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <AlertTriangle className="w-3 h-3 text-blocking" />
          <span className="text-[11px] text-muted-foreground">
            {blockerCount} blocker{blockerCount !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}
    </div>
  );
};
