import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { FileText, Users, Landmark, Shield, Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useDealMetrics } from '@/hooks/useDealMetrics';

interface ReadinessCategory {
  label: string;
  icon: React.ElementType;
  current: number;
  total: number;
  rawTotal?: number;
  status: 'ready' | 'needs_review' | 'missing';
  detail?: string;
}

const statusConfig = {
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Ready', icon: CheckCircle2 },
  needs_review: { color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'In Progress', icon: Clock },
  missing: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Missing', icon: AlertTriangle },
};

function deriveStatus(current: number, total: number): 'ready' | 'needs_review' | 'missing' {
  if (total === 0) return 'missing';
  if (current >= total) return 'ready';
  if (current > 0) return 'needs_review';
  return 'missing';
}

export const ReadinessPanel: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { metrics, loading } = useDealMetrics(dealId);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const m = metrics;

  const categories: ReadinessCategory[] = [
    {
      label: 'Required Documents', icon: FileText,
      current: m.completedRequiredDocuments, total: m.requiredDocuments,
      rawTotal: m.totalUploadedDocuments,
      status: deriveStatus(m.completedRequiredDocuments, m.requiredDocuments),
      detail: `${m.totalUploadedDocuments} uploaded · ${m.completedRequiredDocuments}/${m.requiredDocuments} required complete`,
    },
    {
      label: 'Required Stakeholders', icon: Users,
      current: m.requiredVerifiedStakeholders, total: m.requiredStakeholders,
      rawTotal: m.totalStakeholders,
      status: deriveStatus(m.requiredVerifiedStakeholders, m.requiredStakeholders),
      detail: `${m.totalStakeholders} total · ${m.requiredVerifiedStakeholders}/${m.requiredStakeholders} required verified`,
    },
    {
      label: 'Obligations', icon: Shield,
      current: m.confirmedObligations, total: Math.max(m.totalObligations, 1),
      status: deriveStatus(m.confirmedObligations, m.totalObligations),
      detail: m.totalObligations === 0 ? 'No obligations extracted yet' : `${m.confirmedObligations}/${m.totalObligations} confirmed`,
    },
    {
      label: 'Wire Instructions', icon: Landmark,
      current: m.verifiedWireInstructions, total: Math.max(m.totalWireInstructions, 1),
      status: deriveStatus(m.verifiedWireInstructions, m.totalWireInstructions),
      detail: m.totalWireInstructions === 0 ? 'No wire instructions yet' : `${m.verifiedWireInstructions}/${m.totalWireInstructions} verified`,
    },
    {
      label: 'Required Approvals', icon: CheckCircle2,
      current: m.grantedRequiredApprovals, total: Math.max(m.requiredApprovals, 1),
      status: deriveStatus(m.grantedRequiredApprovals, m.requiredApprovals),
      detail: m.requiredApprovals === 0 ? 'No approvals configured' : `${m.grantedApprovals}/${m.totalApprovals} total · ${m.grantedRequiredApprovals}/${m.requiredApprovals} required approved`,
    },
    {
      label: 'Conditions', icon: Shield,
      current: m.conditionsSatisfied, total: Math.max(m.totalConditions, 1),
      status: deriveStatus(m.conditionsSatisfied, m.totalConditions),
      detail: m.totalConditions === 0 ? 'No conditions configured' : `${m.conditionsSatisfied}/${m.totalConditions} satisfied`,
    },
  ];

  const overallPct = m.readinessPercent;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Execution Readiness</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Canonical readiness score derived from all deal records.
          <span className="text-accent"> Updates automatically on any change.</span>
        </p>
      </motion.div>

      {/* Overall Score */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-4xl font-bold text-foreground">{overallPct}%</p>
            <p className="text-sm text-muted-foreground mt-1">Execution Readiness</p>
          </div>
          <Badge className={`text-xs ${overallPct >= 80 ? 'bg-emerald-500/10 text-emerald-600' : overallPct >= 50 ? 'bg-amber-500/10 text-amber-600' : 'bg-red-400/10 text-red-400'}`}>
            {overallPct >= 80 ? 'On Track' : overallPct >= 50 ? 'In Progress' : 'Action Required'}
          </Badge>
        </div>
        <Progress value={overallPct} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          {m.totalDealInputs} total deal inputs | {m.completedDealInputs}/{m.requiredDealInputs} required categories populated
        </p>
      </motion.div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(cat => {
          const pct = cat.total > 0 ? Math.round((cat.current / cat.total) * 100) : 0;
          const cfg = statusConfig[cat.status];
          const Icon = cat.icon;
          const StatusIcon = cfg.icon;
          return (
            <motion.div key={cat.label} {...fadeInUp} className="pivt-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <p className="text-sm font-medium">{cat.label}</p>
                </div>
                <Badge className={`text-[10px] gap-1 ${cfg.bg} ${cfg.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {cfg.label}
                </Badge>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">{cat.detail || `${cat.current} / ${cat.total}`}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Reconciliation Issues */}
      {m.reconciliationIssues.length > 0 && (
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Data Reconciliation Warnings
          </h4>
          <div className="space-y-2">
            {m.reconciliationIssues.map((issue, i) => (
              <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                issue.severity === 'error' ? 'bg-red-500/5 border border-red-500/15' : 'bg-amber-500/5 border border-amber-500/15'
              }`}>
                <span className="text-foreground">{issue.message}</span>
                <Badge className={`text-[9px] ${issue.severity === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {issue.severity}
                </Badge>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <h4 className="text-sm font-semibold mb-3">Status Legend</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${cfg.bg}`} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
