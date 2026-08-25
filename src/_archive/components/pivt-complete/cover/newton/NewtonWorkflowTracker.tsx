/**
 * Newton Workflow Tracker — Shows deal progress through closing stages.
 * Active/next stages are visually prominent; remaining stages are subtle.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Lock, CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export interface WorkflowStage {
  key: string;
  label: string;
  icon: React.ElementType;
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked';
  pct: number;
  subtitle: string;
  blockers?: string[];
}

interface Props {
  stages: WorkflowStage[];
  onStageClick?: (key: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
  blocked: 'Blocked',
};

export const NewtonWorkflowTracker: React.FC<Props> = ({ stages, onStageClick }) => {
  const completedCount = stages.filter(s => s.status === 'complete').length;
  const overallPct = stages.length > 0
    ? Math.round(stages.reduce((sum, s) => sum + s.pct, 0) / stages.length)
    : 0;

  // Find the first non-complete stage index to determine "active" and "next"
  const activeIdx = stages.findIndex(s => s.status === 'in_progress' || s.status === 'blocked');
  const nextIdx = activeIdx >= 0 ? activeIdx + 1 : stages.findIndex(s => s.status === 'not_started');

  const getEmphasis = (idx: number, status: string): 'primary' | 'secondary' | 'muted' => {
    if (status === 'complete') return 'secondary';
    if (idx === activeIdx) return 'primary';
    if (idx === nextIdx && stages[activeIdx]?.status !== 'not_started') return 'secondary';
    return 'muted';
  };

  return (
    <div className="pivt-card border border-border overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-gradient-to-r from-accent to-accent/60"
          initial={{ width: 0 }}
          animate={{ width: `${overallPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Closing Workflow</p>
            <Badge variant="outline" className="text-[9px] px-1.5 h-4">
              {completedCount}/{stages.length} · {overallPct}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          <TooltipProvider>
            {stages.map((stage, idx) => {
              const emphasis = getEmphasis(idx, stage.status);
              const Icon = stage.status === 'blocked' ? Lock
                : stage.status === 'complete' ? CheckCircle2
                : stage.icon;

              return (
                <Tooltip key={stage.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onStageClick?.(stage.key)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-center group',
                        // Primary (active stage) — full emphasis
                        emphasis === 'primary' && stage.status === 'blocked'
                          ? 'border-blocking/30 bg-blocking/5 shadow-sm'
                          : emphasis === 'primary'
                          ? 'border-accent/30 bg-accent/5 shadow-sm'
                        // Secondary (complete or next) — moderate emphasis
                        : emphasis === 'secondary' && stage.status === 'complete'
                          ? 'border-validated/15 bg-validated/3'
                          : emphasis === 'secondary'
                          ? 'border-border bg-card'
                        // Muted (future stages) — low emphasis
                        : 'border-border/50 bg-card/50 opacity-50 hover:opacity-75'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        emphasis === 'primary' && stage.status === 'blocked' ? 'bg-blocking/10' :
                        emphasis === 'primary' ? 'bg-accent/10' :
                        stage.status === 'complete' ? 'bg-validated/10' :
                        'bg-muted'
                      )}>
                        <Icon className={cn(
                          'w-3.5 h-3.5',
                          emphasis === 'primary' && stage.status === 'blocked' ? 'text-blocking' :
                          emphasis === 'primary' ? 'text-accent' :
                          stage.status === 'complete' ? 'text-validated' :
                          emphasis === 'muted' ? 'text-muted-foreground/40' :
                          'text-muted-foreground'
                        )} />
                      </div>
                      <span className={cn(
                        'text-[10px] font-medium leading-tight',
                        emphasis === 'muted' && 'text-muted-foreground/60'
                      )}>{stage.label}</span>
                      <span className={cn(
                        'text-[9px]',
                        emphasis === 'primary' && stage.status === 'blocked' ? 'text-blocking' :
                        emphasis === 'primary' ? 'text-accent' :
                        stage.status === 'complete' ? 'text-validated' :
                        'text-muted-foreground/40'
                      )}>{stage.pct}%</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-xs font-medium">{stage.label}: {STATUS_LABEL[stage.status]}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stage.subtitle}</p>
                    {stage.blockers && stage.blockers.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {stage.blockers.map((b, i) => (
                          <p key={i} className="text-[10px] text-blocking flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {b}
                          </p>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
