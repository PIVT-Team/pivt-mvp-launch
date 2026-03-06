import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Upload, CheckCircle2, Clock, DollarSign,
  FileSpreadsheet, Table2, Loader2, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

const FINANCIAL_DOC_TYPES = [
  { value: 'CAP_TABLE', label: 'Cap Table' },
  { value: 'WATERFALL_MODEL', label: 'Waterfall Model' },
  { value: 'PURCHASE_PRICE_ALLOCATION', label: 'Purchase Price Allocation' },
  { value: 'ESCROW_ALLOCATION', label: 'Escrow Allocation Model' },
  { value: 'DISTRIBUTION_SCHEDULE', label: 'Seller Distribution Schedule' },
] as const;

const CURRENCY_GROUPS = [
  { label: 'Major Currencies', items: [
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
    { value: 'GBP', label: 'GBP — British Pound' },
  ]},
  { label: 'Asia-Pacific', items: [
    { value: 'JPY', label: 'JPY — Japanese Yen' },
    { value: 'CNY', label: 'CNY — Chinese Yuan' },
    { value: 'AUD', label: 'AUD — Australian Dollar' },
    { value: 'SGD', label: 'SGD — Singapore Dollar' },
    { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
    { value: 'KRW', label: 'KRW — South Korean Won' },
    { value: 'INR', label: 'INR — Indian Rupee' },
  ]},
  { label: 'Americas', items: [
    { value: 'CAD', label: 'CAD — Canadian Dollar' },
    { value: 'BRL', label: 'BRL — Brazilian Real' },
    { value: 'MXN', label: 'MXN — Mexican Peso' },
  ]},
  { label: 'Europe (Other)', items: [
    { value: 'CHF', label: 'CHF — Swiss Franc' },
    { value: 'SEK', label: 'SEK — Swedish Krona' },
    { value: 'NOK', label: 'NOK — Norwegian Krone' },
    { value: 'DKK', label: 'DKK — Danish Krone' },
    { value: 'PLN', label: 'PLN — Polish Zloty' },
  ]},
  { label: 'Other', items: [
    { value: 'AED', label: 'AED — UAE Dirham' },
    { value: 'ZAR', label: 'ZAR — South African Rand' },
  ]},
];

interface FinancialDoc {
  id: string;
  doc_type: string;
  filename: string;
  status: string;
  uploaded_at: string;
}

const formatNumber = (v: string) => {
  const num = v.replace(/[^0-9.]/g, '');
  if (!num) return '';
  const parts = num.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const parseNumber = (v: string) => v.replace(/,/g, '');

export const FinancialInputs: React.FC = () => {
  const { dealId, isDemoDeal, realDeal } = useDealWorkspace();

  // Financial fields pre-filled from deal record
  const [dealValue, setDealValue] = useState('');
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD']);
  const [escrowAmount, setEscrowAmount] = useState('');
  const [sellerAllocation, setSellerAllocation] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  // Docs
  const [docs, setDocs] = useState<FinancialDoc[]>([]);
  const [selectedType, setSelectedType] = useState('CAP_TABLE');
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Pre-fill from deal record
  useEffect(() => {
    if (realDeal) {
      setDealValue(realDeal.deal_value ? formatNumber(realDeal.deal_value.toString()) : '');
      const currencies = realDeal.currency ? realDeal.currency.split(',').map(c => c.trim()).filter(Boolean) : ['USD'];
      setSelectedCurrencies(currencies);
      setEscrowAmount(realDeal.escrow_amount != null ? formatNumber(realDeal.escrow_amount.toString()) : '');
    }
  }, [realDeal]);

  // Fetch financial docs from contract_documents
  useEffect(() => {
    if (!dealId || isDemoDeal) {
      setLoadingDocs(false);
      return;
    }
    const fetch = async () => {
      setLoadingDocs(true);
      const financialDocTypes = ['CAP_TABLE', 'WATERFALL_MODEL', 'PURCHASE_PRICE_ALLOCATION', 'ESCROW_ALLOCATION', 'DISTRIBUTION_SCHEDULE'];
      const { data } = await supabase
        .from('contract_documents')
        .select('id, doc_type, filename, status, uploaded_at')
        .eq('deal_id', dealId)
        .in('doc_type', financialDocTypes as any);
      setDocs((data || []).map((d: any) => ({
        id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        status: d.status,
        uploaded_at: d.uploaded_at,
      })));
      setLoadingDocs(false);
    };
    fetch();
  }, [dealId, isDemoDeal]);

  // Save financial fields back to deal record
  const handleSave = useCallback(async () => {
    if (!dealId || isDemoDeal) return;
    setSaving(true);
    const { error } = await supabase
      .from('deals')
      .update({
        deal_value: parseFloat(parseNumber(dealValue)) || 0,
        currency: selectedCurrencies.join(','),
        escrow_amount: parseFloat(parseNumber(escrowAmount)) || 0,
      } as any)
      .eq('id', dealId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save financial inputs');
    } else {
      toast.success('Financial inputs saved');
    }
  }, [dealId, isDemoDeal, dealValue, currency, escrowAmount]);

  const handleUpload = useCallback(() => {
    const label = FINANCIAL_DOC_TYPES.find(t => t.value === selectedType)?.label || selectedType;
    const newDoc: FinancialDoc = {
      id: `fd-${Date.now()}`,
      doc_type: selectedType,
      filename: `${label.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      status: 'UPLOADED',
      uploaded_at: new Date().toISOString(),
    };
    setDocs(prev => [...prev, newDoc]);
    toast.success(`Uploaded: ${newDoc.filename}`);
  }, [selectedType]);

  const getLabel = (type: string) => FINANCIAL_DOC_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Financial Inputs</h2>
        <p className="text-sm text-muted-foreground mt-1">Financial structure of the transaction — models, allocations, and schedules.</p>
        {realDeal && <p className="text-xs text-accent mt-1">Pre-filled from deal creation. You may edit if needed.</p>}
      </motion.div>

      {/* ── Financial Documents ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Financial Documents</h3>
          </div>
          <p className="text-xs text-muted-foreground ml-8">Upload spreadsheets used to structure ownership and distributions.</p>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block">Document Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/40">
                {FINANCIAL_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Button onClick={handleUpload} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</Button>
          </div>

          {loadingDocs ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Filename</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-emerald-500 shrink-0" />{doc.filename}
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{getLabel(doc.doc_type)}</Badge></td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${doc.status === 'PARSED' || doc.status === 'EXTRACTION_COMPLETE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}`}>
                        {doc.status === 'PARSED' || doc.status === 'EXTRACTION_COMPLETE' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {docs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No financial inputs uploaded yet.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* ── Structured Financial Inputs ── */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3 mb-1">
            <DollarSign className="w-5 h-5 text-accent" />
            <h3 className="font-semibold">Financial Inputs</h3>
          </div>
          <p className="text-xs text-muted-foreground ml-8">Structured fields that feed the payment orchestration engine. {realDeal ? 'Pre-filled from deal creation.' : ''}</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label className="text-xs text-muted-foreground">Total Purchase Price</Label>
            <Input
              placeholder="e.g. 185,000,000"
              className="mt-1.5"
              value={dealValue}
              onChange={e => setDealValue(formatNumber(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <select
              className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              <option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>CHF</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Escrow Amount</Label>
            <Input
              placeholder="e.g. 5,000,000"
              className="mt-1.5"
              value={escrowAmount}
              onChange={e => setEscrowAmount(formatNumber(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Seller Proceeds Allocation</Label>
            <Input
              placeholder="e.g. Pro-rata by ownership"
              className="mt-1.5"
              value={sellerAllocation}
              onChange={e => setSellerAllocation(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Payment Schedule (if applicable)</Label>
              <Input
                placeholder="At closing / milestone-based"
                className="mt-1.5"
                value={paymentSchedule}
                onChange={e => setPaymentSchedule(e.target.value)}
              />
            </div>
            {!isDemoDeal && (
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
