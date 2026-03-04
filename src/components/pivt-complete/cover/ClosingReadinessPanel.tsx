import React from 'react';
import { Shield, FileText, Users, CreditCard, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface PillarScore {
  label: string;
  icon: React.ElementType;
  score: number;
  detail: string;
}

interface NextStep {
  label: string;
  severity: 'blocker' | 'warning';
}

interface ClosingReadinessProps {
  documents?: { uploaded: number; required: number };
  approvals?: { approved: number; required: number };
  compliance?: { passed: number; total: number };
  payments?: { ready: number; total: number };
  nextSteps?: NextStep[];
  onNavigate?: (section: string) => void;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
};

const getBarColor = (score: number) => {
  if (score >= 80) return '[&>div]:bg-emerald-500';
  if (score >= 50) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
};

const getOverallBg = (score: number) => {
  if (score >= 80) return 'border-emerald-500/20 bg-emerald-500/5';
  if (score >= 50) return 'border-amber-500/20 bg-amber-500/5';
  return 'border-red-500/20 bg-red-500/5';
};

// Demo data for the Nimbus deal
const DEMO_DOCUMENTS = { uploaded: 5, required: 8 };
const DEMO_APPROVALS = { approved: 5, required: 7 };
const DEMO_COMPLIANCE = { passed: 7, total: 10 };
const DEMO_PAYMENTS = { ready: 3, total: 4 };

const DEMO_NEXT_STEPS: NextStep[] = [
  { label: 'Upload Seller W-9', severity: 'blocker' },
  { label: 'Complete sanctions screening for Buyer', severity: 'blocker' },
  { label: 'Approve disbursement for escrow agent', severity: 'warning' },
  { label: 'Upload Escrow Agreement', severity: 'blocker' },
];

export const ClosingReadinessPanel: React.FC<ClosingReadinessProps> = ({
  documents = DEMO_DOCUMENTS,
  approvals = DEMO_APPROVALS,
  compliance = DEMO_COMPLIANCE,
  payments = DEMO_PAYMENTS,
  nextSteps = DEMO_NEXT_STEPS,
  onNavigate,
}) => {
  const calcPct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0;

  const pillars: PillarScore[] = [
    {
      label: 'Documents',
      icon: FileText,
      score: calcPct(documents.uploaded, documents.required),
      detail: `${documents.uploaded}/${documents.required}`,
    },
    {
      label: 'Approvals',
      icon: Users,
      score: calcPct(approvals.approved, approvals.required),
      detail: `${approvals.approved}/${approvals.required}`,
    },
    {
      label: 'Compliance',
      icon: Shield,
      score: calcPct(compliance.passed, compliance.total),
      detail: `${compliance.passed}/${compliance.total}`,
    },
    {
      label: 'Payments',
      icon: CreditCard,
      score: calcPct(payments.ready, payments.total),
      detail: `${payments.ready}/${payments.total}`,
    },
  ];

  const overallScore = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);

  return (
    <div className="pivt-card border border-border/50 p-5 space-y-5">
      {/* Header with overall score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Closing Readiness</h3>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-xs font-mono ${getOverallBg(overallScore)}`}>
            {overallScore >= 80 ? 'Ready' : overallScore >= 50 ? 'In Progress' : 'Blocked'}
          </Badge>
          <span className={`text-2xl font-bold font-mono ${getScoreColor(overallScore)}`}>
            {overallScore}%
          </span>
        </div>
      </div>

      {/* 4 Pillar Progress Bars */}
      <div className="space-y-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{pillar.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-mono">{pillar.detail}</span>
                  <span className={`text-xs font-bold font-mono ${getScoreColor(pillar.score)}`}>
                    {pillar.score}%
                  </span>
                </div>
              </div>
              <Progress value={pillar.score} className={`h-2 ${getBarColor(pillar.score)}`} />
            </div>
          );
        })}
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Steps</p>
          <div className="space-y-1.5">
            {nextSteps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                  step.severity === 'blocker'
                    ? 'bg-red-500/5 border border-red-500/15'
                    : 'bg-amber-500/5 border border-amber-500/15'
                }`}
              >
                {step.severity === 'blocker' ? (
                  <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                )}
                <span className="flex-1">{step.label}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
