import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { FileText, Users, Landmark, Shield, Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

interface ReadinessCategory {
  label: string;
  icon: React.ElementType;
  current: number;
  total: number;
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
  const { dealId, isDemoDeal } = useDealWorkspace();
  const [categories, setCategories] = useState<ReadinessCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<Array<{ action: string; time: string }>>([]);

  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    const fetchReadiness = async () => {
      setLoading(true);

      if (isDemoDeal) {
        setCategories([
          { label: 'Documents Complete', icon: FileText, current: 5, total: 7, status: 'needs_review' },
          { label: 'Stakeholders Verified', icon: Users, current: 4, total: 6, status: 'needs_review' },
          { label: 'Obligations Confirmed', icon: Shield, current: 2, total: 6, status: 'missing' },
          { label: 'Wire Instructions Verified', icon: Landmark, current: 0, total: 3, status: 'missing' },
        ]);
        setLoading(false);
        return;
      }

      // Fetch live data in parallel — graph-backed readiness
      const [docsRes, stakeholdersRes, obligationsRes, wiresRes, taxFormsRes, govDocsRes, discrepRes, approvalsRes, auditRes] = await Promise.all([
        supabase.from('contract_documents').select('id, status').eq('deal_id', dealId),
        supabase.from('cap_table_entries').select('id, verification_status').eq('deal_id', dealId),
        supabase.from('obligations').select('id, status').eq('deal_id', dealId),
        supabase.from('wire_instructions').select('id, verification_status').eq('deal_id', dealId),
        supabase.from('tax_forms').select('id, status').eq('deal_id', dealId),
        supabase.from('contract_documents').select('id').eq('deal_id', dealId).in('doc_type', ['BOARD_CONSENT', 'OFFICER_CERTIFICATE', 'SECRETARY_CERTIFICATE'] as any),
        supabase.from('discrepancies').select('id, status').eq('deal_id', dealId).neq('status', 'resolved'),
        supabase.from('deal_approvals').select('id, status, required').eq('deal_id', dealId),
        // Fetch recent orchestration events for activity preview
        supabase.from('audit_log').select('action, created_at').eq('deal_id', dealId)
          .in('action', ['document_workflow_processed', 'wire_instructions_created', 'payment_allocations_created', 'deal_graph_rebuilt', 'discrepancy_engine_triggered', 'cap_table_processed', 'spa_processed'] as any)
          .order('created_at', { ascending: false }).limit(5),
      ]);

      const docs = docsRes.data || [];
      const stakeholders = stakeholdersRes.data || [];
      const obligations = obligationsRes.data || [];
      const wires = wiresRes.data || [];
      const taxForms = taxFormsRes.data || [];
      const govDocs = govDocsRes.data || [];
      const discrepancies = discrepRes.data || [];
      const approvals = approvalsRes.data || [];

      const docsComplete = docs.filter((d: any) => d.status === 'EXTRACTION_COMPLETE' || d.status === 'PARSED').length;
      const stakeholdersVerified = stakeholders.filter((s: any) => s.verification_status === 'verified').length;
      const obligationsConfirmed = obligations.filter((o: any) => o.status === 'CONFIRMED').length;
      const wiresVerified = wires.filter((w: any) => w.verification_status === 'verified').length;
      const taxSatisfied = taxForms.filter((t: any) => t.status === 'received' || t.status === 'verified').length;
      const discrepResolved = discrepancies.length === 0;
      const approvalsCompleted = approvals.filter((a: any) => a.status === 'approved' || a.status === 'completed').length;
      const requiredApprovals = approvals.filter((a: any) => a.required).length;

      setCategories([
        {
          label: 'Documents Complete', icon: FileText,
          current: docsComplete, total: Math.max(docs.length, 1),
          status: deriveStatus(docsComplete, docs.length),
          detail: `${docsComplete} of ${docs.length} parsed`,
        },
        {
          label: 'Stakeholders Verified', icon: Users,
          current: stakeholdersVerified, total: Math.max(stakeholders.length, 1),
          status: deriveStatus(stakeholdersVerified, stakeholders.length),
          detail: `${stakeholdersVerified} of ${stakeholders.length} verified`,
        },
        {
          label: 'Obligations Confirmed', icon: Shield,
          current: obligationsConfirmed, total: Math.max(obligations.length, 1),
          status: deriveStatus(obligationsConfirmed, obligations.length),
          detail: `${obligationsConfirmed} of ${obligations.length} confirmed`,
        },
        {
          label: 'Wire Instructions Verified', icon: Landmark,
          current: wiresVerified, total: Math.max(wires.length, 1),
          status: deriveStatus(wiresVerified, wires.length),
          detail: wires.length === 0 ? 'No wires extracted yet' : `${wiresVerified} of ${wires.length} verified`,
        },
        {
          label: 'Tax Forms Collected', icon: FileText,
          current: taxSatisfied, total: Math.max(taxForms.length, 1),
          status: deriveStatus(taxSatisfied, taxForms.length),
        },
        {
          label: 'Governance Docs', icon: Shield,
          current: govDocs.length, total: Math.max(govDocs.length, 1),
          status: deriveStatus(govDocs.length, 1),
        },
        {
          label: 'Discrepancies Resolved', icon: AlertTriangle,
          current: discrepResolved ? 1 : 0, total: 1,
          status: discrepResolved ? 'ready' : 'needs_review',
          detail: discrepancies.length > 0 ? `${discrepancies.length} open` : 'None outstanding',
        },
        {
          label: 'Approvals Completed', icon: CheckCircle2,
          current: approvalsCompleted, total: Math.max(requiredApprovals, 1),
          status: deriveStatus(approvalsCompleted, requiredApprovals),
          detail: requiredApprovals === 0 ? 'No approvals configured' : `${approvalsCompleted} of ${requiredApprovals}`,
        },
      ]);

      // Recent orchestration events
      setRecentEvents((auditRes.data || []).map((e: any) => ({
        action: e.action.replace(/_/g, ' '),
        time: new Date(e.created_at).toLocaleString(),
      })));

      setLoading(false);
    };
    fetchReadiness();
  }, [dealId, isDemoDeal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCurrent = categories.reduce((s, c) => s + c.current, 0);
  const totalRequired = categories.reduce((s, c) => s + c.total, 0);
  const overallPct = totalRequired > 0 ? Math.round((totalCurrent / totalRequired) * 100) : 0;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Execution Readiness</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Graph-derived readiness score computed from all deal sections.
          {!isDemoDeal && <span className="text-accent"> Updates automatically on document upload and verification.</span>}
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
        <p className="text-xs text-muted-foreground mt-2">{totalCurrent} of {totalRequired} requirements satisfied</p>
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

      {/* Recent Orchestration Events */}
      {recentEvents.length > 0 && (
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            Recent Workflow Events
          </h4>
          <div className="space-y-2">
            {recentEvents.map((evt, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground capitalize">{evt.action}</span>
                <span className="text-muted-foreground font-mono">{evt.time}</span>
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
