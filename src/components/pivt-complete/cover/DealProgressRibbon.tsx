import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, ShieldCheck, Layers, Zap, CheckCircle2,
  AlertTriangle, ArrowRight,
} from 'lucide-react';
import { fadeInUp } from '@/lib/animations';

// ── Types ──
export type RibbonStageStatus = 'completed' | 'in_progress' | 'blocked' | 'not_started';

export interface RibbonStage {
  id: string;
  label: string;
  icon: React.ElementType;
  status: RibbonStageStatus;
  completionPct: number;
  detail: string;
}

export interface DealProgressData {
  stakeholdersAdded: number;
  stakeholdersRequired: number;
  compliancePassed: number;
  complianceTotal: number;
  complianceBlocked: boolean;
  conditionsSatisfied: number;
  conditionsTotal: number;
  documentsUploaded: number;
  documentsRequired: number;
  approvalsGranted: number;
  approvalsTotal: number;
  approvalsBlocked: boolean;
  paymentsExecuted: number;
  paymentsTotal: number;
  paymentsFailed: boolean;
}

// ── Computation ──
function deriveStageStatus(done: number, total: number, blocked: boolean): RibbonStageStatus {
  if (blocked) return 'blocked';
  if (total === 0) return 'not_started';
  if (done >= total) return 'completed';
  if (done > 0) return 'in_progress';
  return 'not_started';
}

export function computeRibbonStages(d: DealProgressData): RibbonStage[] {
  const pct = (done: number, total: number) => total === 0 ? 0 : Math.round((done / total) * 100);
  const detail = (done: number, total: number, unit: string) =>
    total === 0 ? `No ${unit} yet` : `${done}/${total} ${unit}`;

  return [
    {
      id: 'stakeholders',
      label: 'Stakeholders',
      icon: Users,
      status: deriveStageStatus(d.stakeholdersAdded, d.stakeholdersRequired, false),
      completionPct: pct(d.stakeholdersAdded, d.stakeholdersRequired),
      detail: detail(d.stakeholdersAdded, d.stakeholdersRequired, 'added'),
    },
    {
      id: 'deal-inputs',
      label: 'Deal Inputs',
      icon: Layers,
      status: deriveStageStatus(
        d.documentsUploaded + d.conditionsSatisfied,
        d.documentsRequired + d.conditionsTotal,
        false
      ),
      completionPct: pct(d.documentsUploaded + d.conditionsSatisfied, d.documentsRequired + d.conditionsTotal),
      detail: detail(d.documentsUploaded, d.documentsRequired, 'uploaded'),
    },
    {
      id: 'verification',
      label: 'Verification',
      icon: ShieldCheck,
      status: deriveStageStatus(d.compliancePassed, d.complianceTotal, d.complianceBlocked),
      completionPct: pct(d.compliancePassed, d.complianceTotal),
      detail: detail(d.compliancePassed, d.complianceTotal, 'passed'),
    },
    {
      id: 'execution',
      label: 'Execution',
      icon: Zap,
      status: deriveStageStatus(d.approvalsGranted, d.approvalsTotal, d.approvalsBlocked),
      completionPct: pct(d.approvalsGranted, d.approvalsTotal),
      detail: detail(d.approvalsGranted, d.approvalsTotal, 'approved'),
    },
    {
      id: 'settlement',
      label: 'Settlement',
      icon: CheckCircle2,
      status: deriveStageStatus(d.paymentsExecuted, d.paymentsTotal, d.paymentsFailed),
      completionPct: pct(d.paymentsExecuted, d.paymentsTotal),
      detail: detail(d.paymentsExecuted, d.paymentsTotal, 'executed'),
    },
  ];
}

export function computeNextAction(stages: RibbonStage[]): { label: string; stageId: string } | null {
  for (const stage of stages) {
    if (stage.status === 'blocked') {
      return { label: `${stage.label}: Blocked — resolve issues to continue`, stageId: stage.id };
    }
    if (stage.status === 'not_started') {
      return { label: `${stage.label}: Begin setup`, stageId: stage.id };
    }
    if (stage.status === 'in_progress') {
      return { label: `${stage.label}: ${stage.detail} — complete to advance`, stageId: stage.id };
    }
  }
  return null;
}

// ── Visuals ──
const STATUS_CONFIG: Record<RibbonStageStatus, {
  ringColor: string;
  bgColor: string;
  textColor: string;
  label: string;
  dotShadow: string;
}> = {
  completed: {
    ringColor: 'ring-[hsl(var(--validated))]',
    bgColor: 'bg-validated/10',
    textColor: 'text-validated',
    label: 'Complete',
    dotShadow: 'shadow-[0_0_6px_hsl(var(--validated)/0.4)]',
  },
  in_progress: {
    ringColor: 'ring-amber-400',
    bgColor: 'bg-amber-400/10',
    textColor: 'text-amber-500',
    label: 'In Progress',
    dotShadow: 'shadow-[0_0_6px_rgba(251,191,36,0.4)]',
  },
  blocked: {
    ringColor: 'ring-[hsl(var(--blocking))]',
    bgColor: 'bg-blocking/10',
    textColor: 'text-blocking',
    label: 'Blocked',
    dotShadow: 'shadow-[0_0_6px_hsl(var(--blocking)/0.4)]',
  },
  not_started: {
    ringColor: 'ring-muted-foreground/20',
    bgColor: 'bg-muted/40',
    textColor: 'text-muted-foreground',
    label: 'Not Started',
    dotShadow: '',
  },
};

// ── Component ──
interface DealProgressRibbonProps {
  progressData: DealProgressData;
  onStageClick?: (stageId: string) => void;
}

export const DealProgressRibbon: React.FC<DealProgressRibbonProps> = ({
  progressData,
  onStageClick,
}) => {
  const stages = useMemo(() => computeRibbonStages(progressData), [progressData]);
  const nextAction = useMemo(() => computeNextAction(stages), [stages]);
  const overallPct = useMemo(
    () => Math.round(stages.reduce((s, st) => s + st.completionPct, 0) / stages.length),
    [stages],
  );

  return (
    <div className="space-y-3">
      <motion.div {...fadeInUp} className="pivt-panel overflow-hidden">
        <div className="h-1 bg-muted/30 w-full">
          <motion.div
            className="h-full rounded-r-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--g5-from)), hsl(var(--g5-to)))' }}
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {stages.map((stage, i) => {
            const cfg = STATUS_CONFIG[stage.status];
            const Icon = stage.icon;

            return (
              <React.Fragment key={stage.id}>
                <button
                  onClick={() => onStageClick?.(stage.id)}
                  className="group flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/30 transition-colors min-w-0 shrink-0"
                >
                  <div className={`w-8 h-8 rounded-lg ${cfg.bgColor} flex items-center justify-center ring-1 ${cfg.ringColor} transition-all`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.textColor}`} />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs font-semibold text-foreground leading-tight">{stage.label}</span>
                    <span className={`text-[10px] leading-tight ${cfg.textColor} font-medium`}>{stage.detail}</span>
                  </div>
                  <div className="w-10 h-1.5 bg-muted/40 rounded-full overflow-hidden ml-1">
                    <motion.div
                      className={`h-full rounded-full ${
                        stage.status === 'completed' ? 'bg-validated' :
                        stage.status === 'blocked' ? 'bg-blocking' :
                        stage.status === 'in_progress' ? 'bg-amber-400' :
                        'bg-muted-foreground/20'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(stage.completionPct, 2)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                    />
                  </div>
                </button>
                {i < stages.length - 1 && (
                  <div className="flex items-center shrink-0 px-0.5">
                    <div className={`w-4 h-px ${
                      stages[i + 1].status !== 'not_started' ? 'bg-accent/30' : 'bg-border/30'
                    }`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>

      {nextAction ? (
        <motion.div
          {...fadeInUp}
          className="pivt-next-action px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onStageClick?.(nextAction.stageId)}
        >
          <div className="w-8 h-8 rounded-xl bg-accent/12 flex items-center justify-center shrink-0 pivt-icon-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">Next Required Action</p>
            <p className="text-sm font-medium text-foreground mt-0.5 truncate">{nextAction.label}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-accent/60 shrink-0" />
        </motion.div>
      ) : (
        <motion.div {...fadeInUp} className="pivt-panel px-5 py-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-validated/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-validated" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-validated font-semibold">All Gates Clear</p>
            <p className="text-sm font-medium text-foreground mt-0.5">Deal is ready for execution</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};