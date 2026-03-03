import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Loader2,
  Zap, Eye, X, Download, Filter, ChevronDown, ChevronRight,
  ArrowRight, Shield, Clock, DollarSign, MapPin, Link2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';

// ── Types ──
interface ContractDocument {
  id: string;
  deal_id: string;
  doc_type: string;
  filename: string;
  file_url: string | null;
  status: string;
  uploaded_at: string;
  text_content: string | null;
}

interface Obligation {
  id: string;
  deal_id: string;
  source_document_id: string | null;
  obligation_type: string;
  status: string;
  timing_type: string;
  scheduled_date: string | null;
  payor_label: string | null;
  payee_label: string | null;
  amount_type: string;
  amount_value_minor: number | null;
  amount_currency: string | null;
  percent_basis_points: number | null;
  percent_base_reference: string | null;
  confidence_score: number;
  source_text_snippet: string | null;
  extracted_by: string;
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  mapping_status: string;
  instructions_confirmed: boolean;
}

const DOC_TYPES = ['SPA', 'FUNDS_FLOW', 'ESCROW_AGREEMENT', 'PAYOFF_LETTER', 'FEE_LETTER', 'OTHER'] as const;

const DOC_TYPE_LABELS: Record<string, string> = {
  SPA: 'Stock Purchase Agreement',
  FUNDS_FLOW: 'Funds Flow Memo',
  ESCROW_AGREEMENT: 'Escrow Agreement',
  PAYOFF_LETTER: 'Payoff Letter',
  FEE_LETTER: 'Fee Letter',
  OTHER: 'Other',
};

const OBLIGATION_TYPE_LABELS: Record<string, string> = {
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
  SUPERSEDED: { bg: 'bg-muted/40', text: 'text-muted-foreground' },
};

const TIMING_LABELS: Record<string, string> = {
  AT_CLOSING: 'At Closing',
  PRE_CLOSING: 'Pre-Closing',
  POST_CLOSING: 'Post-Closing',
  ON_CONDITION: 'On Condition',
  ON_DATE: 'On Date',
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

function confidenceColor(score: number): string {
  if (score >= 0.9) return 'text-emerald-600';
  if (score >= 0.7) return 'text-amber-600';
  return 'text-red-400';
}

// ── Demo data ──
const DEMO_DOCS: ContractDocument[] = [
  { id: 'd1', deal_id: 'atlas', doc_type: 'SPA', filename: 'Atlas_SPA_v3_Final.pdf', file_url: null, status: 'EXTRACTION_COMPLETE', uploaded_at: '2026-02-28T10:30:00Z', text_content: 'Stock Purchase Agreement...' },
  { id: 'd2', deal_id: 'atlas', doc_type: 'FUNDS_FLOW', filename: 'FundsFlow_Atlas_v2.pdf', file_url: null, status: 'EXTRACTION_COMPLETE', uploaded_at: '2026-02-28T11:00:00Z', text_content: 'Funds Flow Memo...' },
  { id: 'd3', deal_id: 'atlas', doc_type: 'ESCROW_AGREEMENT', filename: 'Escrow_Agreement_JPMorgan.pdf', file_url: null, status: 'UPLOADED', uploaded_at: '2026-03-01T09:00:00Z', text_content: null },
];

const DEMO_OBLIGATIONS: Obligation[] = [
  { id: 'ob1', deal_id: 'atlas', source_document_id: 'd1', obligation_type: 'PURCHASE_PRICE_BASE', status: 'CONFIRMED', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Buyer (Apex Capital)', payee_label: 'Seller Shareholders', amount_type: 'FIXED', amount_value_minor: 280_000_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.98, source_text_snippet: '"The aggregate purchase price shall be Two Hundred Eighty Million Dollars ($280,000,000)"', extracted_by: 'AI', confirmed_by_user_id: 'u1', confirmed_at: '2026-03-01T14:00:00Z', mapping_status: 'MAPPED', instructions_confirmed: true },
  { id: 'ob2', deal_id: 'atlas', source_document_id: 'd1', obligation_type: 'ESCROW_HOLD_BACK', status: 'CONFIRMED', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Buyer (Apex Capital)', payee_label: 'Escrow Agent (JPMorgan)', amount_type: 'PERCENT_OF_BASE', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: 1000, percent_base_reference: 'PURCHASE_PRICE_BASE', confidence_score: 0.96, source_text_snippet: '"ten percent (10%) of the Purchase Price shall be deposited into the Escrow Account"', extracted_by: 'AI', confirmed_by_user_id: 'u1', confirmed_at: '2026-03-01T14:05:00Z', mapping_status: 'MAPPED', instructions_confirmed: true },
  { id: 'ob3', deal_id: 'atlas', source_document_id: 'd2', obligation_type: 'DEBT_PAYOFF', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Company', payee_label: 'Silicon Valley Bank', amount_type: 'FIXED', amount_value_minor: 45_000_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.88, source_text_snippet: '"Payoff of existing credit facility with SVB in the amount of $45,000,000"', extracted_by: 'AI', confirmed_by_user_id: null, confirmed_at: null, mapping_status: 'UNMAPPED', instructions_confirmed: false },
  { id: 'ob4', deal_id: 'atlas', source_document_id: 'd2', obligation_type: 'LEGAL_FEE', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Seller', payee_label: 'Wilson Sonsini', amount_type: 'FIXED', amount_value_minor: 3_500_000_00, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.82, source_text_snippet: '"Legal fees payable to Wilson Sonsini Goodrich & Rosati estimated at $3,500,000"', extracted_by: 'AI', confirmed_by_user_id: null, confirmed_at: null, mapping_status: 'UNMAPPED', instructions_confirmed: false },
  { id: 'ob5', deal_id: 'atlas', source_document_id: 'd2', obligation_type: 'BROKER_FEE', status: 'NEEDS_REVIEW', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Seller', payee_label: 'Goldman Sachs (Advisory)', amount_type: 'PERCENT_OF_BASE', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: 150, percent_base_reference: 'PURCHASE_PRICE_BASE', confidence_score: 0.75, source_text_snippet: '"Advisory fee of 1.5% of the aggregate consideration payable to Goldman Sachs"', extracted_by: 'AI', confirmed_by_user_id: null, confirmed_at: null, mapping_status: 'UNMAPPED', instructions_confirmed: false },
  { id: 'ob6', deal_id: 'atlas', source_document_id: 'd2', obligation_type: 'TAX_WITHHOLDING', status: 'DRAFT_EXTRACTED', timing_type: 'AT_CLOSING', scheduled_date: null, payor_label: 'Buyer', payee_label: 'IRS / Applicable Tax Authority', amount_type: 'UNKNOWN', amount_value_minor: null, amount_currency: 'USD', percent_basis_points: null, percent_base_reference: null, confidence_score: 0.55, source_text_snippet: '"withholding obligations under Section 1445 of the Code"', extracted_by: 'AI', confirmed_by_user_id: null, confirmed_at: null, mapping_status: 'UNMAPPED', instructions_confirmed: false },
];

// ── Main Component ──
export const ContractIngestionCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'documents' | 'obligations'>('documents');
  const [documents, setDocuments] = useState<ContractDocument[]>(DEMO_DOCS);
  const [obligations, setObligations] = useState<Obligation[]>(DEMO_OBLIGATIONS);
  const [selectedDocType, setSelectedDocType] = useState<string>('SPA');
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortByConfidence, setSortByConfidence] = useState(false);

  const deal = useSelectedDeal();

  // Simulate document upload
  const handleUpload = useCallback(() => {
    const newDoc: ContractDocument = {
      id: `d${Date.now()}`,
      deal_id: deal.id,
      doc_type: selectedDocType,
      filename: `${deal.codeName}_${selectedDocType}_${new Date().toISOString().slice(0, 10)}.pdf`,
      file_url: null,
      status: 'UPLOADED',
      uploaded_at: new Date().toISOString(),
      text_content: null,
    };
    setDocuments(prev => [...prev, newDoc]);
    toast.success(`Document uploaded: ${newDoc.filename}`);
  }, [deal, selectedDocType]);

  // Extract obligations from a document
  const handleExtract = useCallback(async (docId: string) => {
    setExtracting(docId);
    toast.info('Extracting obligations with AI...');

    // Simulate extraction (in production, call the edge function)
    setTimeout(() => {
      setDocuments(prev =>
        prev.map(d => d.id === docId ? { ...d, status: 'EXTRACTION_COMPLETE' } : d)
      );
      // Add some demo obligations
      const newObs: Obligation[] = [
        {
          id: `ob-${Date.now()}-1`,
          deal_id: deal.id,
          source_document_id: docId,
          obligation_type: 'OTHER',
          status: 'NEEDS_REVIEW',
          timing_type: 'AT_CLOSING',
          scheduled_date: null,
          payor_label: 'Buyer',
          payee_label: 'TBD',
          amount_type: 'UNKNOWN',
          amount_value_minor: null,
          amount_currency: 'USD',
          percent_basis_points: null,
          percent_base_reference: null,
          confidence_score: 0.65,
          source_text_snippet: 'Extracted from document...',
          extracted_by: 'AI',
          confirmed_by_user_id: null,
          confirmed_at: null,
          mapping_status: 'UNMAPPED',
          instructions_confirmed: false,
        },
      ];
      setObligations(prev => [...prev, ...newObs]);
      setExtracting(null);
      toast.success('Obligations extracted successfully');
    }, 3000);
  }, [deal]);

  // Confirm/Reject obligation
  const handleConfirm = useCallback((obId: string) => {
    setObligations(prev =>
      prev.map(o =>
        o.id === obId
          ? { ...o, status: 'CONFIRMED', confirmed_at: new Date().toISOString(), confirmed_by_user_id: 'current' }
          : o
      )
    );
    if (selectedObligation?.id === obId) {
      setSelectedObligation(prev => prev ? { ...prev, status: 'CONFIRMED' } : null);
    }
    toast.success('Obligation confirmed');
  }, [selectedObligation]);

  const handleReject = useCallback((obId: string) => {
    setObligations(prev =>
      prev.map(o => o.id === obId ? { ...o, status: 'REJECTED' } : o)
    );
    if (selectedObligation?.id === obId) {
      setSelectedObligation(prev => prev ? { ...prev, status: 'REJECTED' } : null);
    }
    toast.info('Obligation rejected');
  }, [selectedObligation]);

  // Filter & sort obligations
  const filteredObligations = React.useMemo(() => {
    let obs = [...obligations];
    if (statusFilter !== 'all') obs = obs.filter(o => o.status === statusFilter);
    if (sortByConfidence) obs.sort((a, b) => a.confidence_score - b.confidence_score);
    return obs;
  }, [obligations, statusFilter, sortByConfidence]);

  const stats = React.useMemo(() => ({
    total: obligations.length,
    needsReview: obligations.filter(o => o.status === 'NEEDS_REVIEW' || o.status === 'DRAFT_EXTRACTED').length,
    confirmed: obligations.filter(o => o.status === 'CONFIRMED').length,
    rejected: obligations.filter(o => o.status === 'REJECTED').length,
    lowConfidence: obligations.filter(o => o.confidence_score < 0.7).length,
  }), [obligations]);

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = ['Type', 'Status', 'Payor', 'Payee', 'Amount', 'Currency', 'Timing', 'Confidence', 'Source Doc'];
    const rows = obligations.map(o => [
      OBLIGATION_TYPE_LABELS[o.obligation_type] || o.obligation_type,
      o.status,
      o.payor_label || '',
      o.payee_label || '',
      formatAmount(o),
      o.amount_currency || '',
      TIMING_LABELS[o.timing_type] || o.timing_type,
      o.confidence_score.toFixed(2),
      documents.find(d => d.id === o.source_document_id)?.filename || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `obligations_${deal.codeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Obligations exported');
  }, [obligations, documents, deal]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>
            Contract Ingestion
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload closing documents → AI extracts obligations → Human review → Validate against intents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div {...fadeInUp} className="grid grid-cols-5 gap-4">
        {[
          { label: 'Documents', value: documents.length, icon: FileText },
          { label: 'Total Obligations', value: stats.total, icon: DollarSign },
          { label: 'Needs Review', value: stats.needsReview, icon: AlertTriangle, color: stats.needsReview > 0 ? 'text-amber-600' : undefined },
          { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Low Confidence', value: stats.lowConfidence, icon: Shield, color: stats.lowConfidence > 0 ? 'text-red-400' : undefined },
        ].map(s => (
          <div key={s.label} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="pivt-metric-label">{s.label}</span>
            </div>
            <p className={`text-xl font-semibold font-mono ${s.color || ''}`}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* AI Warning Banner */}
      {stats.needsReview > 0 && (
        <motion.div {...fadeInUp} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{stats.needsReview} AI-extracted obligation{stats.needsReview > 1 ? 's' : ''}</strong> require human review before execution can proceed.
          </p>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/50 pb-0">
        {(['documents', 'obligations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'documents' ? 'Documents' : `Obligations (${obligations.length})`}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <motion.div {...fadeInUp} className="space-y-4">
          {/* Upload Section */}
          <div className="pivt-card p-5">
            <h3 className="text-sm font-semibold mb-3">Upload Closing Document</h3>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
                <select
                  value={selectedDocType}
                  onChange={e => setSelectedDocType(e.target.value)}
                  className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40"
                >
                  {DOC_TYPES.map(t => (
                    <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleUpload} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload Document
              </Button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="pivt-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                        doc.status === 'EXTRACTION_COMPLETE' ? 'bg-emerald-500/10 text-emerald-600' :
                        doc.status === 'ERROR' ? 'bg-red-400/10 text-red-400' :
                        doc.status === 'TEXT_EXTRACTED' ? 'bg-blue-400/10 text-blue-400' :
                        'bg-muted/60 text-muted-foreground'
                      }`}>
                        {doc.status === 'EXTRACTION_COMPLETE' && <CheckCircle2 className="w-3 h-3" />}
                        {doc.status === 'ERROR' && <AlertTriangle className="w-3 h-3" />}
                        {doc.status === 'UPLOADED' && <Clock className="w-3 h-3" />}
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status === 'UPLOADED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          disabled={extracting === doc.id}
                          onClick={() => handleExtract(doc.id)}
                        >
                          {extracting === doc.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Extracting...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3" />
                              Extract Obligations
                            </>
                          )}
                        </Button>
                      )}
                      {doc.status === 'EXTRACTION_COMPLETE' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs"
                          onClick={() => setActiveTab('obligations')}
                        >
                          <Eye className="w-3 h-3" />
                          View Obligations
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Obligations Tab */}
      {activeTab === 'obligations' && (
        <motion.div {...fadeInUp} className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Status:</span>
            </div>
            {['all', 'NEEDS_REVIEW', 'DRAFT_EXTRACTED', 'CONFIRMED', 'REJECTED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setSortByConfidence(!sortByConfidence)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sortByConfidence
                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <Shield className="w-3 h-3" />
              Low confidence first
            </button>
          </div>

          {/* Obligations Table + Detail Drawer */}
          <div className="flex gap-4">
            <div className={`pivt-card overflow-hidden ${selectedObligation ? 'flex-1' : 'w-full'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Payee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timing</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Conf.</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObligations.map(ob => {
                    const style = STATUS_STYLES[ob.status] || STATUS_STYLES.DRAFT_EXTRACTED;
                    return (
                      <tr
                        key={ob.id}
                        className={`border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer ${
                          selectedObligation?.id === ob.id ? 'bg-accent/5' : ''
                        }`}
                        onClick={() => setSelectedObligation(ob)}
                      >
                        <td className="px-4 py-3 font-medium text-xs">
                          {OBLIGATION_TYPE_LABELS[ob.obligation_type] || ob.obligation_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[11px] font-medium px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
                            {ob.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{ob.payee_label || '—'}</td>
                        <td className="px-4 py-3 text-xs font-mono">{formatAmount(ob)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {TIMING_LABELS[ob.timing_type] || ob.timing_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono font-medium ${confidenceColor(ob.confidence_score)}`}>
                            {(ob.confidence_score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {(ob.status === 'NEEDS_REVIEW' || ob.status === 'DRAFT_EXTRACTED') && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleConfirm(ob.id)}>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Confirm obligation</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleReject(ob.id)}>
                                      <X className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reject obligation</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredObligations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No obligations match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Detail Drawer */}
            <AnimatePresence>
              {selectedObligation && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 380 }}
                  exit={{ opacity: 0, width: 0 }}
                  className="pivt-card overflow-hidden shrink-0"
                >
                  <div className="p-5 space-y-5 h-full overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Obligation Detail</h3>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedObligation(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                        <p className="text-sm font-medium">{OBLIGATION_TYPE_LABELS[selectedObligation.obligation_type]}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Payor</p>
                          <p className="text-xs">{selectedObligation.payor_label || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Payee</p>
                          <p className="text-xs">{selectedObligation.payee_label || '—'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                          <p className="text-sm font-mono font-medium">{formatAmount(selectedObligation)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Timing</p>
                          <p className="text-xs">{TIMING_LABELS[selectedObligation.timing_type]}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confidence</p>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedObligation.confidence_score * 100} className="h-2 flex-1" />
                          <span className={`text-xs font-mono font-medium ${confidenceColor(selectedObligation.confidence_score)}`}>
                            {(selectedObligation.confidence_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mapping Status</p>
                        <Badge variant="outline" className="text-xs">
                          {selectedObligation.mapping_status === 'MAPPED' && <Link2 className="w-3 h-3 mr-1" />}
                          {selectedObligation.mapping_status}
                        </Badge>
                      </div>

                      {selectedObligation.source_text_snippet && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source Excerpt</p>
                          <div className="bg-muted/30 rounded-lg p-3 text-xs italic text-muted-foreground border-l-2 border-accent/30">
                            "{selectedObligation.source_text_snippet}"
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Source Document</p>
                        <p className="text-xs">
                          {documents.find(d => d.id === selectedObligation.source_document_id)?.filename || 'Unknown'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Extracted By</p>
                        <p className="text-xs">{selectedObligation.extracted_by}</p>
                      </div>

                      {selectedObligation.confirmed_at && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confirmed At</p>
                          <p className="text-xs">{new Date(selectedObligation.confirmed_at).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(selectedObligation.status === 'NEEDS_REVIEW' || selectedObligation.status === 'DRAFT_EXTRACTED') && (
                      <div className="flex gap-2 pt-2 border-t border-border/30">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5"
                          onClick={() => handleConfirm(selectedObligation.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5"
                          onClick={() => handleReject(selectedObligation.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {selectedObligation.mapping_status === 'UNMAPPED' && selectedObligation.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5"
                        onClick={() => toast.info('Map to Intent UI coming soon')}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Map to Disbursement Intent
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
};
