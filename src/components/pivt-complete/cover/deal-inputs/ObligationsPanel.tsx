import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  AlertTriangle, CheckCircle2, Eye, X, Download, Filter, Shield, Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Obligation {
  id: string;
  obligation_type: string;
  status: string;
  payor_label: string | null;
  payee_label: string | null;
  amount_type: string;
  amount_value_minor: number | null;
  amount_currency: string | null;
  percent_basis_points: number | null;
  percent_base_reference: string | null;
  confidence_score: number;
  source_text_snippet: string | null;
  mapping_status: string;
  timing_type: string;
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE_PRICE_BASE: 'Base Purchase Price',
  PURCHASE_PRICE_ADJUSTMENT: 'Purchase Price Adjustment',
  ESCROW_HOLD_BACK: 'Escrow Holdback',
  DEBT_PAYOFF: 'Debt Payoff',
  SELLER_PROCEEDS: 'Seller Proceeds',
  BROKER_FEE: 'Broker Fee',
  LEGAL_FEE: 'Legal Fee',
  ADVISORY_FEE: 'Advisory Fee',
  TAX_WITHHOLDING: 'Tax Withholding',
  EARNOUT_RESERVE: 'Earnout Reserve',
  WORKING_CAPITAL_TRUE_UP: 'Working Capital True-Up',
  INDEMNITY_RESERVE: 'Indemnity Reserve',
  OTHER: 'Other',
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  DRAFT_EXTRACTED: { bg: 'bg-muted/60', text: 'text-muted-foreground' },
  NEEDS_REVIEW: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  CONFIRMED: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  REJECTED: { bg: 'bg-red-400/10', text: 'text-red-400' },
};

function formatAmount(ob: Obligation): string {
  if (ob.amount_type === 'FIXED' && ob.amount_value_minor != null) {
    const val = ob.amount_value_minor / 100;
    return `${ob.amount_currency || 'USD'} ${val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(2)}M` : `$${val.toLocaleString()}`}`;
  }
  if (ob.amount_type === 'PERCENT_OF_BASE' && ob.percent_basis_points != null) {
    return `${(ob.percent_basis_points / 100).toFixed(2)}% of ${ob.percent_base_reference || 'Base'}`;
  }
  if (ob.amount_type === 'FORMULA') return 'Formula';
  return 'Unknown';
}

const DEMO: Obligation[] = [
  { id: 'ob1', obligation_type: 'PURCHASE_PRICE_BASE', status: 'CONFIRMED', timing_type: 'AT_CLOSING', payor_label: 'Buyer (Apex Capital)', payee_label: 'Seller Shareholders', amount_type: 'FIXED', amount_value_minor: 280_000_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.98, source_text_snippet: '"$280,000,000"', mapping_status: 'MAPPED' },
  { id: 'ob2', obligation_type: 'ESCROW_HOLD_BACK', status: 'CONFIRMED', timing_type: 'AT_CLOSING', payor_label: 'Buyer', payee_label: 'Escrow Agent (JPMorgan)', amount_type: 'PERCENT_OF_BASE', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: 1000, percent_base_reference: 'PURCHASE_PRICE_BASE', confidence_score: 0.96, source_text_snippet: '"10% escrow"', mapping_status: 'MAPPED' },
  { id: 'ob3', obligation_type: 'DEBT_PAYOFF', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', payor_label: 'Company', payee_label: 'Silicon Valley Bank', amount_type: 'FIXED', amount_value_minor: 45_000_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.88, source_text_snippet: '"Payoff $45M SVB"', mapping_status: 'UNMAPPED' },
  { id: 'ob4', obligation_type: 'LEGAL_FEE', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', payor_label: 'Seller', payee_label: 'Wilson Sonsini', amount_type: 'FIXED', amount_value_minor: 3_500_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.82, source_text_snippet: '"Legal fees $3.5M"', mapping_status: 'UNMAPPED' },
  { id: 'ob5', obligation_type: 'BROKER_FEE', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', payor_label: 'Seller', payee_label: 'Goldman Sachs', amount_type: 'PERCENT_OF_BASE', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: 150, percent_base_reference: 'PURCHASE_PRICE_BASE', confidence_score: 0.75, source_text_snippet: '"1.5% advisory fee"', mapping_status: 'UNMAPPED' },
  { id: 'ob6', obligation_type: 'TAX_WITHHOLDING', status: 'DRAFT_EXTRACTED', timing_type: 'AT_CLOSING', payor_label: 'Buyer', payee_label: 'IRS', amount_type: 'UNKNOWN', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.55, source_text_snippet: '"Section 1445 withholding"', mapping_status: 'UNMAPPED' },
];

export const ObligationsPanel: React.FC = () => {
  const [obligations, setObligations] = useState<Obligation[]>(DEMO);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Obligation | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return obligations;
    return obligations.filter(o => o.status === statusFilter);
  }, [obligations, statusFilter]);

  const stats = useMemo(() => ({
    total: obligations.length,
    needsReview: obligations.filter(o => o.status === 'NEEDS_REVIEW' || o.status === 'DRAFT_EXTRACTED').length,
    confirmed: obligations.filter(o => o.status === 'CONFIRMED').length,
  }), [obligations]);

  const handleConfirm = useCallback((id: string) => {
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'CONFIRMED' } : o));
    toast.success('Obligation confirmed');
  }, []);

  const handleReject = useCallback((id: string) => {
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'REJECTED' } : o));
    toast.info('Obligation rejected');
  }, []);

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Obligations</h2>
        <p className="text-sm text-muted-foreground mt-1">AI-extracted obligations from contract documents.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="pivt-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="pivt-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.needsReview}</p>
          <p className="text-xs text-muted-foreground">Needs Review</p>
        </div>
        <div className="pivt-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
          <p className="text-xs text-muted-foreground">Confirmed</p>
        </div>
      </div>

      {stats.needsReview > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{stats.needsReview}</strong> obligation{stats.needsReview > 1 ? 's' : ''} require human review.
          </p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {['all', 'NEEDS_REVIEW', 'DRAFT_EXTRACTED', 'CONFIRMED', 'REJECTED'].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === f ? 'bg-accent/15 text-accent' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'}`}>
            {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="pivt-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border/30">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsible Party</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(ob => {
              const st = STATUS_STYLES[ob.status] || STATUS_STYLES.DRAFT_EXTRACTED;
              return (
                <tr key={ob.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelected(ob)}>
                  <td className="px-4 py-2.5 font-medium">{TYPE_LABELS[ob.obligation_type] || ob.obligation_type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ob.payor_label || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{formatAmount(ob)}</td>
                  <td className="px-4 py-2.5 text-xs">{ob.timing_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${st.bg} ${st.text}`}>{ob.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    {(ob.status === 'NEEDS_REVIEW' || ob.status === 'DRAFT_EXTRACTED') && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => handleConfirm(ob.id)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-400" onClick={() => handleReject(ob.id)}>
                          <X className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No obligations match the current filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <motion.div {...fadeInUp} className="pivt-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{TYPE_LABELS[selected.obligation_type] || selected.obligation_type}</h4>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-muted-foreground">Payor</span><p>{selected.payor_label || '—'}</p></div>
            <div><span className="text-xs text-muted-foreground">Payee</span><p>{selected.payee_label || '—'}</p></div>
            <div><span className="text-xs text-muted-foreground">Amount</span><p className="font-mono">{formatAmount(selected)}</p></div>
            <div><span className="text-xs text-muted-foreground">Confidence</span><p>{(selected.confidence_score * 100).toFixed(0)}%</p></div>
          </div>
          {selected.source_text_snippet && (
            <div className="bg-muted/30 rounded-lg p-3 text-xs italic text-muted-foreground">{selected.source_text_snippet}</div>
          )}
        </motion.div>
      )}
    </div>
  );
};
