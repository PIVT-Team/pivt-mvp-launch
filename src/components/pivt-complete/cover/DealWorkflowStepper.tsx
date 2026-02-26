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
  not_started: 'bg-muted-foreground/30',
  in_progress: 'bg-amber-400',
  complete: 'bg-emerald-500',
  needs_attention: 'bg-red-400',
};

const STATUS_DOT_GLOW: Record<StepStatus, string> = {
  not_started: '',
  in_progress: 'shadow-[0_0_8px_rgba(251,191,36,0.45)]',
  complete: 'shadow-[0_0_8px_rgba(16,185,129,0.35)]',
  needs_attention: 'shadow-[0_0_8px_rgba(248,113,113,0.45)] animate-pulse',
};

interface DealWorkflowStepperProps {
  steps: WorkflowStep[];
  activeStepId: string;
  onStepClick: (stepId: string) => void;
}

export const DealWorkflowStepper: React.FC<DealWorkflowStepperProps> = ({
  steps, activeStepId, onStepClick,
}) => {
  const totalPct = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.completionPct, 0) / steps.length
    : 0;

  return (
    <div className="relative">
      <div
        className="pivt-workflow-nav relative flex items-center h-14 px-3 overflow-hidden"
      >
        {/* Gradient progress line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/20 rounded-full">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, hsl(var(--g5-from)), hsl(var(--g5-to)))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${totalPct}%` }}
            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>

        {steps.map((step, i) => {
          const isActive = step.id === activeStepId;
          const status = deriveStatus(step);

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onStepClick(step.id)}
                className={`relative flex items-center gap-2.5 px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap
                  ${isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]} ${STATUS_DOT_GLOW[status]} transition-all duration-300`} />

                {/* Label */}
                <span
                  className={isActive ? 'bg-clip-text text-transparent font-semibold' : ''}
                  style={isActive ? {
                    backgroundImage: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                  } : undefined}
                >
                  {step.label}
                </span>

                {/* Active underline — animates from left */}
                {isActive && (
                  <motion.div
                    layoutId="workflow-step-underline"
                    className="absolute bottom-0 left-4 right-4 h-[3px] rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                      boxShadow: '0 0 12px hsl(255 82% 58% / 0.25)',
                    }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>

              {/* Separator */}
              {i < steps.length - 1 && (
                <div className="w-px h-4 bg-border/20 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
