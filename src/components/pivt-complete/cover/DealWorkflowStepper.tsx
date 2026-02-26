import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Circle, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface WorkflowStep {
  id: string;
  number: number;
  label: string;
  completionPct: number;
  blockers: number;
  isDueToday?: boolean;
}

type StepStatus = 'not_started' | 'in_progress' | 'needs_attention' | 'complete';

function deriveStatus(step: WorkflowStep): StepStatus {
  if (step.blockers > 0) return 'needs_attention';
  if (step.completionPct === 100) return 'complete';
  if (step.completionPct === 0) return 'not_started';
  return 'in_progress';
}

const STATUS_CONFIG: Record<StepStatus, { label: string; className: string; icon: React.ReactNode }> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-muted/60 text-muted-foreground border-border/50',
    icon: <Circle className="w-2.5 h-2.5" />,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-accent/10 text-accent border-accent/20',
    icon: <Loader2 className="w-2.5 h-2.5 animate-spin" />,
  },
  needs_attention: {
    label: 'Needs Attention',
    className: 'bg-blocking/10 text-blocking border-blocking/20',
    icon: <AlertTriangle className="w-2.5 h-2.5" />,
  },
  complete: {
    label: 'Complete',
    className: 'bg-validated/10 text-validated border-validated/20',
    icon: <CheckCircle2 className="w-2.5 h-2.5" />,
  },
};

interface TabGroup {
  id: string;
  label: string;
  stepIds: string[];
}

const TAB_GROUPS: TabGroup[] = [
  { id: 'people', label: 'People', stepIds: ['parties', 'kyc'] },
  { id: 'data', label: 'Data', stepIds: ['data-docs', 'reconciliation'] },
  { id: 'execution', label: 'Execution', stepIds: ['approvals', 'payments-escrow'] },
  { id: 'compliance', label: 'Compliance', stepIds: ['audit-reports'] },
];

interface DealWorkflowStepperProps {
  steps: WorkflowStep[];
  activeStepId: string;
  onStepClick: (stepId: string) => void;
}

export const DealWorkflowStepper: React.FC<DealWorkflowStepperProps> = ({
  steps, activeStepId, onStepClick,
}) => {
  const stepsMap = Object.fromEntries(steps.map(s => [s.id, s]));

  // Find which group the active step belongs to
  const activeGroupId = TAB_GROUPS.find(g => g.stepIds.includes(activeStepId))?.id ?? null;
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(activeGroupId);

  const isOverviewActive = activeStepId === 'overview';

  const handleGroupClick = (group: TabGroup) => {
    if (expandedGroupId === group.id) {
      // Already expanded — collapse
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(group.id);
      // Auto-select first sub-tab
      onStepClick(group.stepIds[0]);
    }
  };

  const handleSubTabClick = (stepId: string) => {
    onStepClick(stepId);
  };

  // Derive group-level status (worst status among children)
  const getGroupStatus = (group: TabGroup): StepStatus => {
    const childStatuses = group.stepIds.map(id => stepsMap[id] ? deriveStatus(stepsMap[id]) : 'not_started');
    if (childStatuses.includes('needs_attention')) return 'needs_attention';
    if (childStatuses.every(s => s === 'complete')) return 'complete';
    if (childStatuses.every(s => s === 'not_started')) return 'not_started';
    return 'in_progress';
  };

  return (
    <div className="pivt-card p-2">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Overview standalone tab */}
        <button
          onClick={() => {
            onStepClick('overview');
            setExpandedGroupId(null);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
            isOverviewActive
              ? 'text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
          }`}
          style={isOverviewActive ? {
            background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
          } : undefined}
        >
          Overview
        </button>

        <div className="w-px h-6 bg-border/50 mx-1" />

        {/* Grouped tabs */}
        {TAB_GROUPS.map(group => {
          const isExpanded = expandedGroupId === group.id;
          const groupContainsActive = group.stepIds.includes(activeStepId);
          const groupStatus = getGroupStatus(group);
          const statusCfg = STATUS_CONFIG[groupStatus];

          return (
            <div key={group.id} className="flex items-center gap-0.5">
              <button
                onClick={() => handleGroupClick(group)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  groupContainsActive
                    ? 'text-white shadow-md'
                    : isExpanded
                      ? 'bg-muted/80 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                style={groupContainsActive ? {
                  background: 'linear-gradient(90deg, hsl(var(--g2-from)), hsl(var(--g2-to)))',
                } : undefined}
              >
                <span>{group.label}</span>
                {/* Group status dot */}
                {!groupContainsActive && groupStatus === 'needs_attention' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blocking animate-pulse" />
                )}
                {!groupContainsActive && groupStatus === 'complete' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-validated" />
                )}
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isExpanded || groupContainsActive ? 'rotate-180' : ''}`} />
              </button>

              {/* Sub-tabs */}
              <AnimatePresence>
                {(isExpanded || groupContainsActive) && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-0.5 overflow-hidden"
                  >
                    {group.stepIds.map(stepId => {
                      const step = stepsMap[stepId];
                      if (!step) return null;
                      const isActive = stepId === activeStepId;
                      const status = deriveStatus(step);
                      const cfg = STATUS_CONFIG[status];

                      return (
                        <button
                          key={stepId}
                          onClick={() => handleSubTabClick(stepId)}
                          className={`flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 whitespace-nowrap ${
                            isActive
                              ? 'bg-accent/15 border border-accent/30'
                              : 'hover:bg-muted/60 border border-transparent'
                          }`}
                        >
                          <span className={`font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 gap-1 border ${cfg.className}`}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {group.id !== 'compliance' && <div className="w-px h-6 bg-border/30 mx-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
