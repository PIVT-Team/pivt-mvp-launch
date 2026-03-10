import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, DollarSign, FileSpreadsheet, Loader2, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { DealDocumentUploader } from './DealDocumentUploader';

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

  const [dealValue, setDealValue] = useState('');
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD']);
  const [escrowAmount, setEscrowAmount] = useState('');
  const [sellerAllocation, setSellerAllocation] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (realDeal) {
      setDealValue(realDeal.deal_value ? formatNumber(realDeal.deal_value.toString()) : '');
      const currencies = realDeal.currency ? realDeal.currency.split(',').map(c => c.trim()).filter(Boolean) : ['USD'];
      setSelectedCurrencies(currencies);
      setEscrowAmount(realDeal.escrow_amount != null ? formatNumber(realDeal.escrow_amount.toString()) : '');
    }
  }, [realDeal]);

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
    if (error) toast.error('Failed to save financial inputs');
    else toast.success('Financial inputs saved');
  }, [dealId, isDemoDeal, dealValue, selectedCurrencies, escrowAmount]);

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Financial Inputs</h2>
        <p className="text-sm text-muted-foreground mt-1">Financial structure of the transaction — models, allocations, and schedules.</p>
        {realDeal && <p className="text-xs text-accent mt-1">Pre-filled from deal creation. You may edit if needed.</p>}
      </motion.div>

      {/* ── Financial Documents (reusable uploader) ── */}
      <DealDocumentUploader
        dealId={dealId}
        isDemoDeal={isDemoDeal}
        docTypes={FINANCIAL_DOC_TYPES}
        icon={<FileSpreadsheet className="w-5 h-5 text-emerald-500" />}
        title="Financial Documents"
        description="Upload spreadsheets used to structure ownership and distributions."
        emptyStateText="No financial documents uploaded yet."
        allowSpreadsheets
      />

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
            <Input placeholder="e.g. 185,000,000" className="mt-1.5" value={dealValue} onChange={e => setDealValue(formatNumber(e.target.value))} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Currencies</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2 min-h-[28px]">
              {selectedCurrencies.map(c => (
                <Badge key={c} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => {
                  if (selectedCurrencies.length > 1) setSelectedCurrencies(prev => prev.filter(x => x !== c));
                }}>
                  {c} {selectedCurrencies.length > 1 && <X className="w-3 h-3" />}
                </Badge>
              ))}
            </div>
            <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm" value=""
              onChange={e => { if (e.target.value && !selectedCurrencies.includes(e.target.value)) setSelectedCurrencies(prev => [...prev, e.target.value]); }}>
              <option value="">Add currency…</option>
              {CURRENCY_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.filter(i => !selectedCurrencies.includes(i.value)).map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Escrow Amount</Label>
            <Input placeholder="e.g. 5,000,000" className="mt-1.5" value={escrowAmount} onChange={e => setEscrowAmount(formatNumber(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Seller Proceeds Allocation</Label>
            <Input placeholder="e.g. Pro-rata by ownership" className="mt-1.5" value={sellerAllocation} onChange={e => setSellerAllocation(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Payment Schedule (if applicable)</Label>
              <Input placeholder="At closing / milestone-based" className="mt-1.5" value={paymentSchedule} onChange={e => setPaymentSchedule(e.target.value)} />
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
