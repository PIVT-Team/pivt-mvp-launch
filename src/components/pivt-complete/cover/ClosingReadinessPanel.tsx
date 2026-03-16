import React from 'react';
import { Shield, FileText, Users, CreditCard, CheckCircle2, AlertTriangle, ArrowRight, ClipboardCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDealMetrics } from '@/hooks/useDealMetrics';
import type { DealMetrics } from '@/services/dealMetricsService';

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

function deriveNextSteps(g: DealMetrics['gates']): NextStep[] {
  const steps: NextStep[] = [];
  if (!g.stakeholdersConfigured) steps.push({ label: 'Add buyer and seller stakeholders', severity: 'blocker' });
  if (!g.sellerVerified) steps.push({ label: 'Complete seller-side verification', severity: 'blocker' });
  if (!g.buyerVerified) steps.push({ label: 'Complete buyer-side verification', severity: 'blocker' });
  if (!g.spaUploaded) steps.push({ label: 'Upload SPA / Purchase Agreement', severity: 'blocker' });
  if (!g.wireInstructionsUploaded) steps.push({ label: 'Upload wire instructions', severity: 'blocker' });
  if (!g.paymentsApproved) steps.push({ label: 'Approve all payment instructions', severity: 'warning' });
  if (!g.approvalsComplete) steps.push({ label: 'Complete required approvals', severity: 'warning' });
  return steps;
}

interface ClosingReadinessPanelProps {
  dealId?: string;
}

export const ClosingReadinessPanel: React.FC<ClosingReadinessPanelProps> = ({ dealId }) => {
  const { metrics, loading } = useDealMetrics(dealId);

  if (loading || !metrics) {
    return (
      <div className="pivt-card border border-border/50 p-5 flex items-center justify-center h-32">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = metrics;
  const stakeholderScore = m.requiredStakeholders > 0
    ? Math.round((m.requiredVerifiedStakeholders / m.requiredStakeholders) * 100)
    : 0;
  const docScore = m.requiredDocuments > 0
    ? Math.round((m.completedRequiredDocuments / m.requiredDocuments) * 100)
    : 0;
  const approvalScore = m.requiredApprovals > 0
    ? Math.round((m.grantedRequiredApprovals / m.requiredApprovals) * 100)
    : 0;
  const paymentScore = m.totalWireInstructions > 0
    ? Math.round((m.verifiedWireInstructions / m.totalWireInstructions) * 100)
    : 0;

  const pillars: PillarScore[] = [
    {
      label: 'Stakeholders',
      icon: Users,
      score: m.gates.stakeholdersConfigured ? Math.max(stakeholderScore, 25) : 0,
      detail: `${m.totalStakeholders} total | ${m.requiredVerifiedStakeholders}/${m.requiredStakeholders} required verified`,
    },
    {
      label: 'Documents',
      icon: FileText,
      score: docScore,
      detail: `${m.totalUploadedDocuments} uploaded | ${m.completedRequiredDocuments}/${m.requiredDocuments} required complete`,
    },
    {
      label: 'Approvals',
      icon: ClipboardCheck,
      score: approvalScore,
      detail: `${m.grantedRequiredApprovals}/${m.requiredApprovals} required approved`,
    },
    {
      label: 'Payments',
      icon: CreditCard,
      score: paymentScore,
      detail: `${m.verifiedWireInstructions}/${m.totalWireInstructions} wires verified`,
    },
  ];

  const overallScore = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);
  const nextSteps = deriveNextSteps(m.gates);

  return (
    <div className="pivt-card border border-border/50 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Closing Readiness</h3>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-xs font-mono ${getOverallBg(overallScore)}`}>
            {m.gates.readyToClose ? 'Ready' : overallScore >= 50 ? 'In Progress' : 'Blocked'}
          </Badge>
          <span className={`text-2xl font-bold font-mono ${getScoreColor(overallScore)}`}>
            {overallScore}%
          </span>
        </div>
      </div>

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
                <AlertTriangle className={`w-3 h-3 shrink-0 ${
                  step.severity === 'blocker' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <span className="flex-1">{step.label}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {m.gates.readyToClose && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-center">
          <p className="text-xs font-medium text-emerald-600">All gates clear — ready for execution</p>
        </div>
      )}
    </div>
  );
};
