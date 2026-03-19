/**
 * Top stepper showing demo progress.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import {
  Plus, Upload, FileSearch, AlertTriangle, PenTool, Download,
  CheckCircle2, ArrowRight, Users, ShieldCheck,
} from 'lucide-react';

export type DemoStep =
  | 'intro' | 'create' | 'stakeholders' | 'verification'
  | 'upload' | 'obligations' | 'discrepancies' | 'approvals' | 'wirepack' | 'outro';

const VISIBLE_STEPS: { id: DemoStep; label: string; icon: React.ElementType }[] = [
  { id: 'create', label: 'Create Deal', icon: Plus },
  { id: 'stakeholders', label: 'Stakeholders', icon: Users },
  { id: 'verification', label: 'KYC / KYB', icon: ShieldCheck },
  { id: 'upload', label: 'Upload Docs', icon: Upload },
  { id: 'obligations', label: 'Extract', icon: FileSearch },
  { id: 'discrepancies', label: 'Verify', icon: AlertTriangle },
  { id: 'approvals', label: 'Approve', icon: PenTool },
  { id: 'wirepack', label: 'Wire Pack', icon: Download },
];

interface Props {
  currentStep: DemoStep;
}

export const DemoStepper: React.FC<Props> = ({ currentStep }) => {
  const currentIdx = VISIBLE_STEPS.findIndex(s => s.id === currentStep);

  if (currentStep === 'intro' || currentStep === 'outro') return null;

  return (
    <div className="flex items-center gap-1 justify-center py-3 px-4 flex-wrap">
      {VISIBLE_STEPS.map((step, i) => {
        const isActive = step.id === currentStep;
        const isDone = i < currentIdx;
        return (
          <React.Fragment key={step.id}>
            <div className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              isActive ? 'bg-accent/10 text-accent' : isDone ? 'text-validated' : 'text-muted-foreground/40'
            )}>
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <step.icon className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{step.label}</span>
            </div>
            {i < VISIBLE_STEPS.length - 1 && (
              <ArrowRight className={cn('w-3 h-3', i < currentIdx ? 'text-validated' : 'text-muted-foreground/20')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
