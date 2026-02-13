/**
 * Newton Proactive Insights - Auto-surfacing risks and recommendations
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp, springConfig } from '@/lib/animations';
import {
  AlertTriangle, CheckCircle2, Info, TrendingUp, Clock,
  Shield, FileWarning, Users, Sparkles, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Insight {
  id: string;
  type: 'risk' | 'action' | 'info' | 'success';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: string;
  actionLabel?: string;
  actionSection?: string;
}

const severityColors: Record<string, string> = {
  critical: 'text-blocking border-blocking/20 bg-blocking/5',
  high: 'text-discrepancy border-discrepancy/20 bg-discrepancy/5',
  medium: 'text-amber-400 border-amber-400/20 bg-amber-400/5',
  low: 'text-muted-foreground border-border bg-muted/30',
};

const typeIcons: Record<string, React.ElementType> = {
  risk: AlertTriangle,
  action: Clock,
  info: Info,
  success: CheckCircle2,
};

export const NewtonInsights: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, pendingApprovals, waterfallTiers, setActiveSection } = usePIVTStore();

  const insights = useMemo<Insight[]>(() => {
    const items: Insight[] = [];

    // KYC risks
    const failedKyc = stakeholders.filter(s => s.kycStatus === 'failed');
    const pendingKyc = stakeholders.filter(s => s.kycStatus === 'pending');
    if (failedKyc.length > 0) {
      items.push({
        id: 'kyc-failed',
        type: 'risk',
        severity: 'critical',
        title: `${failedKyc.length} stakeholder${failedKyc.length > 1 ? 's' : ''} with failed KYC`,
        description: `${failedKyc.map(s => s.name).join(', ')} — payment execution blocked until KYC is resolved. Total at-risk payout: $${(failedKyc.reduce((s, k) => s + k.payoutAmount, 0) / 1e6).toFixed(0)}M.`,
        category: 'Compliance',
        actionLabel: 'Review Stakeholders',
        actionSection: 'stakeholders',
      });
    }
    if (pendingKyc.length > 0) {
      items.push({
        id: 'kyc-pending',
        type: 'action',
        severity: 'high',
        title: `${pendingKyc.length} KYC verification${pendingKyc.length > 1 ? 's' : ''} pending`,
        description: `${pendingKyc.map(s => s.name).join(', ')} require KYC completion before payment execution.`,
        category: 'Compliance',
        actionLabel: 'View KYC Status',
        actionSection: 'stakeholders',
      });
    }

    // Document discrepancies
    if (deal.discrepanciesFound > 0) {
      items.push({
        id: 'doc-discrepancies',
        type: 'risk',
        severity: deal.discrepanciesFound > 5 ? 'critical' : 'high',
        title: `${deal.discrepanciesFound} document discrepanc${deal.discrepanciesFound > 1 ? 'ies' : 'y'} detected`,
        description: `AI analysis found ${deal.discrepanciesFound} data inconsistencies across uploaded documents that require manual review before closing.`,
        category: 'Documents',
        actionLabel: 'Review Documents',
        actionSection: 'documents',
      });
    }

    // Pending documents
    const pendingDocs = documents.filter(d => d.status === 'pending');
    if (pendingDocs.length > 0) {
      items.push({
        id: 'docs-pending',
        type: 'action',
        severity: 'medium',
        title: `${pendingDocs.length} document${pendingDocs.length > 1 ? 's' : ''} awaiting verification`,
        description: `${pendingDocs.map(d => d.name).join(', ')} — verification needed to proceed with closing.`,
        category: 'Documents',
        actionLabel: 'Review Documents',
        actionSection: 'documents',
      });
    }

    // Pending approvals
    const criticalApprovals = pendingApprovals.filter(a => a.urgency === 'critical');
    if (criticalApprovals.length > 0) {
      items.push({
        id: 'approvals-critical',
        type: 'risk',
        severity: 'critical',
        title: `${criticalApprovals.length} critical approval${criticalApprovals.length > 1 ? 's' : ''} blocking progress`,
        description: criticalApprovals.map(a => `${a.type}: ${a.description}`).join('; '),
        category: 'Approvals',
        actionLabel: 'Review Approvals',
        actionSection: 'approvals',
      });
    }

    // Pending payments
    const pendingPayments = payments.filter(p => p.status === 'pending');
    if (pendingPayments.length > 0) {
      items.push({
        id: 'payments-pending',
        type: 'action',
        severity: 'medium',
        title: `$${(pendingPayments.reduce((s, p) => s + p.amount, 0) / 1e6).toFixed(0)}M in pending payments`,
        description: `${pendingPayments.length} payment${pendingPayments.length > 1 ? 's' : ''} awaiting approval and execution.`,
        category: 'Payments',
        actionLabel: 'View Payments',
        actionSection: 'payments',
      });
    }

    // Readiness assessment
    if (deal.readyToPayPercent >= 90) {
      items.push({
        id: 'ready-high',
        type: 'success',
        severity: 'low',
        title: 'High closing readiness',
        description: `${deal.codeName} is ${deal.readyToPayPercent}% ready for closing. All major workstreams are on track.`,
        category: 'Status',
      });
    } else if (deal.readyToPayPercent < 70) {
      items.push({
        id: 'ready-low',
        type: 'risk',
        severity: 'high',
        title: `Closing readiness at ${deal.readyToPayPercent}%`,
        description: `Below 70% threshold. Multiple workstreams need acceleration to meet the ${deal.closingDate} closing date.`,
        category: 'Status',
        actionLabel: 'View Command Center',
        actionSection: 'command',
      });
    }

    // Closing date proximity
    const daysToClose = Math.ceil((new Date(deal.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToClose <= 14 && daysToClose > 0) {
      items.push({
        id: 'closing-soon',
        type: 'info',
        severity: daysToClose <= 7 ? 'high' : 'medium',
        title: `${daysToClose} days until scheduled closing`,
        description: `${deal.codeName} closes on ${deal.closingDate}. Ensure all blocking items are resolved.`,
        category: 'Timeline',
        actionLabel: 'Closing Center',
        actionSection: 'closing',
      });
    }

    return items.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }, [deal, stakeholders, documents, payments, pendingApprovals]);

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const highCount = insights.filter(i => i.severity === 'high').length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-1">
        <Sparkles className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium text-muted-foreground">Newton Insights</span>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {criticalCount} critical
          </Badge>
        )}
        {highCount > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-discrepancy/30 text-discrepancy">
            {highCount} high
          </Badge>
        )}
      </div>

      {/* Insight cards */}
      <div className="space-y-2">
        {insights.map((insight) => {
          const Icon = typeIcons[insight.type];
          return (
            <motion.div
              key={insight.id}
              {...fadeInUp}
              className={`rounded-lg border p-3 ${severityColors[insight.severity]}`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{insight.title}</p>
                    <span className="text-[10px] opacity-50">{insight.category}</span>
                  </div>
                  <p className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{insight.description}</p>
                  {insight.actionLabel && insight.actionSection && (
                    <button
                      onClick={() => setActiveSection(insight.actionSection as any)}
                      className="mt-1.5 flex items-center gap-1 text-[10px] font-medium hover:opacity-80 transition-opacity"
                    >
                      {insight.actionLabel} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
