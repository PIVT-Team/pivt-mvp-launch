import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  number: number;
  label: string;
  completionPct: number;
  blockers: number;
  isDueToday?: boolean;
}

interface DealWorkflowStepperProps {
  steps: WorkflowStep[];
  activeStepId: string;
  onStepClick: (stepId: string) => void;
}

export const DealWorkflowStepper: React.FC<DealWorkflowStepperProps> = ({
  steps, activeStepId, onStepClick,
}) => {
  const activeIdx = steps.findIndex(s => s.id === activeStepId);

  return (
    <div className="pivt-card p-4 overflow-x-auto">
      <div className="flex items-start min-w-max">
        {steps.map((step, i) => {
          const isActive = step.id === activeStepId;
          const isComplete = step.completionPct === 100;
          const isPast = i < activeIdx;

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <button
                onClick={() => onStepClick(step.id)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer min-w-[100px] relative"
              >
                {/* Badge */}
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.12 }}
                  className={`
                    w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-150 relative
                    ${isComplete || isPast
                      ? 'text-accent-foreground'
                      : isActive
                        ? 'text-accent-foreground'
                        : 'border border-border text-muted-foreground'
                    }
                  `}
                  style={{
                    background: isComplete || isPast
                      ? 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))'
                      : isActive
                        ? 'linear-gradient(90deg, hsl(var(--g3-from)), hsl(var(--g3-to)))'
                        : 'transparent',
                    boxShadow: isActive
                      ? '0 0 20px hsl(255 82% 58% / 0.35), 0 0 6px hsl(255 82% 58% / 0.25)'
                      : isPast || isComplete
                        ? '0 0 8px hsl(231 100% 62% / 0.15)'
                        : 'none',
                  }}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                  {/* Active glow ring */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-[-3px] rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, hsl(var(--g3-from) / 0.3), hsl(var(--g3-to) / 0.15))',
                      }}
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  {/* Inner circle on top of glow */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        background: 'linear-gradient(90deg, hsl(var(--g3-from)), hsl(var(--g3-to)))',
                      }}
                    >
                      {step.number}
                    </div>
                  )}
                </motion.div>

                {/* Label */}
                <span className={`text-[11px] font-medium text-center leading-tight transition-colors duration-150 ${
                  isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`}>
                  {step.label}
                </span>

                {/* Mini status */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-mono ${
                    step.completionPct === 100
                      ? 'text-validated'
                      : step.completionPct >= 50
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                  }`}>
                    {step.completionPct}%
                  </span>
                  {step.blockers > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-discrepancy font-medium">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {step.blockers}
                    </span>
                  )}
                  {step.isDueToday && (
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-blocking">Due today</span>
                  )}
                </div>
              </button>

              {/* Connector line with G5 gradient progress */}
              {i < steps.length - 1 && (
                <div className="flex-1 min-w-[24px] max-w-[60px] flex items-center pt-4 px-1">
                  <div className="w-full h-0.5 rounded-full relative overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{
                        width: i < activeIdx ? '100%' : i === activeIdx ? '50%' : '0%',
                      }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      style={{
                        background: 'linear-gradient(90deg, hsl(var(--g5-from)), hsl(var(--g5-to)))',
                      }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
