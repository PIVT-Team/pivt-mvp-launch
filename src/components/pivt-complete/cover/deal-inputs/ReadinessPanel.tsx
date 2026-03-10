import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { FileText, Users, Landmark, Shield, Loader2 } from 'lucide-react';
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
}

const statusConfig = {
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Ready' },
  needs_review: { color: 'text-amber-600', bg: 'bg-amber-500/10', label: 'Needs Review' },
  missing: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Missing' },
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

  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    const fetchReadiness = async () => {
      setLoading(true);

      if (isDemoDeal) {
        // Fallback demo data
        setCategories([
          { label: 'Documents Complete', icon: FileText, current: 5, total: 7, status: 'needs_review' },
          { label: 'Stakeholders Verified', icon: Users, current: 4, total: 6, status: 'needs_review' },
          { label: 'Obligations Confirmed', icon: Shield, current: 2, total: 6, status: 'missing' },
          { label: 'Wire Instructions Verified', icon: Landmark, current: 0, total: 3, status: 'missing' },
        ]);
        setLoading(false);
        return;
      }

      // Fetch live data in parallel
      const [docsRes, stakeholdersRes, obligationsRes, wiresRes, taxFormsRes, govDocsRes] = await Promise.all([
        supabase.from('contract_documents').select('id, status').eq('deal_id', dealId),
        supabase.from('cap_table_entries').select('id, verification_status').eq('deal_id', dealId),
        supabase.from('obligations').select('id, status').eq('deal_id', dealId),
        supabase.from('wire_instructions').select('id, verification_status').eq('deal_id', dealId),
        supabase.from('tax_forms').select('id, status').eq('deal_id', dealId),
        supabase.from('contract_documents').select('id').eq('deal_id', dealId).in('doc_type', ['BOARD_RESOLUTION', 'SHAREHOLDER_APPROVAL', 'WRITTEN_CONSENT', 'OFFICER_CERTIFICATE'] as any),
      ]);

      const docs = docsRes.data || [];
      const stakeholders = stakeholdersRes.data || [];
      const obligations = obligationsRes.data || [];
      const wires = wiresRes.data || [];
      const taxForms = taxFormsRes.data || [];
      const govDocs = govDocsRes.data || [];

      const docsComplete = docs.filter((d: any) => d.status === 'EXTRACTION_COMPLETE' || d.status === 'PARSED').length;
      const stakeholdersVerified = stakeholders.filter((s: any) => s.verification_status === 'verified').length;
      const obligationsConfirmed = obligations.filter((o: any) => o.status === 'CONFIRMED').length;
      const wiresVerified = wires.filter((w: any) => w.verification_status === 'verified').length;
      const taxSatisfied = taxForms.filter((t: any) => t.status === 'received' || t.status === 'verified').length;
      const wiresTotal = wires.length;

      setCategories([
        { label: 'Documents Complete', icon: FileText, current: docsComplete, total: Math.max(docs.length, 1), status: deriveStatus(docsComplete, docs.length) },
        { label: 'Stakeholders Verified', icon: Users, current: stakeholdersVerified, total: Math.max(stakeholders.length, 1), status: deriveStatus(stakeholdersVerified, stakeholders.length) },
        { label: 'Obligations Confirmed', icon: Shield, current: obligationsConfirmed, total: Math.max(obligations.length, 1), status: deriveStatus(obligationsConfirmed, obligations.length) },
        { label: 'Wire Instructions Verified', icon: Landmark, current: wiresVerified, total: Math.max(wires.length, 1), status: deriveStatus(wiresVerified, wires.length) },
        { label: 'Tax Forms Collected', icon: FileText, current: taxSatisfied, total: Math.max(taxForms.length, 1), status: deriveStatus(taxSatisfied, taxForms.length) },
        { label: 'Governance Docs Uploaded', icon: Shield, current: govDocs.length, total: Math.max(govDocs.length, 1), status: deriveStatus(govDocs.length, 1) },
      ]);
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
          Overall deal closing readiness score.
          {!isDemoDeal && <span className="text-accent"> Auto-calculated from all deal sections.</span>}
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
          return (
            <motion.div key={cat.label} {...fadeInUp} className="pivt-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <p className="text-sm font-medium">{cat.label}</p>
                </div>
                <Badge className={`text-[10px] ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">{cat.current} / {cat.total}</p>
            </motion.div>
          );
        })}
      </div>

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
