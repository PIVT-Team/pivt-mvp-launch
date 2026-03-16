/**
 * Newton Workflow Tracker — Shows deal progress through closing stages
 * with real data-driven counts and statuses.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Upload, UserCheck, FileText, CheckSquare, Settings, ShieldCheck,
  AlertTriangle, Lock, CheckCircle2, Clock,
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

const STATUS_STYLE: Record<string, { dot: string; text: string; ring: string }> = {
  not_started: { dot: 'bg-muted-foreground/30', text: 'text-muted-foreground', ring: 'ring-border' },
  in_progress: { dot: 'bg-accent', text: 'text-accent', ring: 'ring-accent/30' },
  complete: { dot: 'bg-validated', text: 'text-validated', ring: 'ring-validated/30' },
  blocked: { dot: 'bg-blocking', text: 'text-blocking', ring: 'ring-blocking/30' },
};

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
            {stages.map((stage) => {
              const style = STATUS_STYLE[stage.status];
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
                        stage.status === 'complete' ? 'border-validated/20 bg-validated/3' :
                        stage.status === 'blocked' ? 'border-blocking/20 bg-blocking/3' :
                        stage.status === 'in_progress' ? 'border-accent/20 bg-accent/3' :
                        'border-border bg-card hover:border-accent/15'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center',
                        stage.status === 'complete' ? 'bg-validated/10' :
                        stage.status === 'blocked' ? 'bg-blocking/10' :
                        stage.status === 'in_progress' ? 'bg-accent/10' :
                        'bg-muted'
                      )}>
                        <Icon className={cn('w-3.5 h-3.5', style.text)} />
                      </div>
                      <span className="text-[10px] font-medium leading-tight">{stage.label}</span>
                      <span className={cn('text-[9px]', style.text)}>{stage.pct}%</span>
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
