import React from 'react';
import { motion } from 'framer-motion';

export interface WorkflowStep {
  id: string;
  number: number;
  label: string;
  completionPct: number;
  blockers: number;
  isDueToday?: boolean;
}

type StepStatus = 'not_started' | 'in_progress' | 'needs_attention' | 'complete';

export function deriveStatus(step: WorkflowStep): StepStatus {
  if (step.blockers > 0) return 'needs_attention';
  if (step.completionPct === 100) return 'complete';
  if (step.completionPct === 0) return 'not_started';
  return 'in_progress';
}

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: 'bg-muted-foreground/40',
  in_progress: 'bg-amber-400',
  complete: 'bg-emerald-500',
  needs_attention: 'bg-red-500',
};

const STATUS_DOT_GLOW: Record<StepStatus, string> = {
  not_started: '',
  in_progress: 'shadow-[0_0_6px_rgba(251,191,36,0.5)]',
  complete: 'shadow-[0_0_6px_rgba(16,185,129,0.4)]',
  needs_attention: 'shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse',
};

interface DealWorkflowStepperProps {
  steps: WorkflowStep[];
  activeStepId: string;
  onStepClick: (stepId: string) => void;
}

export const DealWorkflowStepper: React.FC<DealWorkflowStepperProps> = ({
  steps, activeStepId, onStepClick,
}) => {
  // Calculate overall progress for the gradient line
  const totalPct = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.completionPct, 0) / steps.length
    : 0;

  return (
    <div className="relative">
      {/* Glass bar */}
      <div
        className="relative flex items-center h-14 px-2 rounded-2xl border border-border/50 overflow-hidden"
        style={{
          background: 'hsl(var(--card) / 0.7)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Gradient progress line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/30 rounded-full">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--g5-from)), hsl(var(--g5-to)))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${totalPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {steps.map((step, i) => {
          const isActive = step.id === activeStepId;
          const status = deriveStatus(step);

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onStepClick(step.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                  hover:scale-[1.03]
                `}
              >
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]} ${STATUS_DOT_GLOW[status]} transition-all`} />

                {/* Label */}
                <span
                  className={isActive ? 'bg-clip-text text-transparent font-semibold' : ''}
                  style={isActive ? {
                    backgroundImage: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                  } : undefined}
                >
                  {step.label}
                </span>

                {/* Active underline */}
                {isActive && (
                  <motion.div
                    layoutId="workflow-step-underline"
                    className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>

              {/* Separator between items */}
              {i < steps.length - 1 && (
                <div className="w-px h-5 bg-border/30 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
