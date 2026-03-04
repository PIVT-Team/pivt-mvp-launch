import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { RealDeal } from '@/hooks/useDealOperations';
import { supabase } from '@/integrations/supabase/client';

const DEAL_TYPES = [
  'Private Company Share Purchase',
  'Private Equity Acquisition',
  'Asset Acquisition',
  'Merger',
  'Leveraged Buyout',
  'Growth Equity',
  'Venture Investment',
  'Secondary Transaction',
  'Other',
];

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

interface EditDealDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: RealDeal;
  onSaved: (updated: RealDeal) => void;
}

export const EditDealDrawer: React.FC<EditDealDrawerProps> = ({ open, onOpenChange, deal, onSaved }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [dealName, setDealName] = useState('');
  const [dealType, setDealType] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [escrowAmount, setEscrowAmount] = useState('');
  const [signingDate, setSigningDate] = useState<Date | undefined>();
  const [closingDate, setClosingDate] = useState<Date | undefined>();
  const [buyer, setBuyer] = useState('');
  const [seller, setSeller] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [sector, setSector] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD']);

  // Initialize form from deal
  useEffect(() => {
    if (open && deal) {
      setDealName(deal.deal_name || '');
      setDealType(deal.deal_type || '');
      setDealValue(String(deal.deal_value || 0));
      setEscrowAmount(String(deal.escrow_amount || 0));
      setSigningDate((deal as any).signing_date ? new Date((deal as any).signing_date + 'T00:00:00') : undefined);
      setClosingDate(deal.closing_date ? new Date(deal.closing_date + 'T00:00:00') : undefined);
      setBuyer(deal.buyer || '');
      setSeller(deal.seller || '');
      setTargetCompany(deal.target_company || '');
      setSector(deal.sector || '');
      setJurisdiction(deal.jurisdiction || '');
      const currencies = deal.currency ? deal.currency.split(',').map(c => c.trim()).filter(Boolean) : ['USD'];
      setSelectedCurrencies(currencies);
    }
  }, [open, deal]);

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    if (!dealName.trim()) {
      toast({ title: 'Deal Name is required', variant: 'destructive' });
      return;
    }
    const value = parseFloat(dealValue);
    if (isNaN(value) || value <= 0) {
      toast({ title: 'Deal Value must be positive', variant: 'destructive' });
      return;
    }
    if (selectedCurrencies.length === 0) {
      toast({ title: 'Select at least one currency', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload: Record<string, any> = {
      deal_name: dealName.trim(),
      deal_type: dealType || null,
      deal_value: value,
      escrow_amount: parseFloat(escrowAmount) || 0,
      signing_date: signingDate ? format(signingDate, 'yyyy-MM-dd') : null,
      closing_date: closingDate ? format(closingDate, 'yyyy-MM-dd') : null,
      buyer: buyer.trim() || null,
      seller: seller.trim() || null,
      target_company: targetCompany.trim() || null,
      sector: sector.trim() || null,
      jurisdiction: jurisdiction.trim() || null,
      currency: selectedCurrencies.join(','),
    };

    const { data, error } = await supabase
      .from('deals')
      .update(payload as any)
      .eq('id', deal.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      toast({ title: 'Error saving deal', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Deal updated' });
    onSaved(data as RealDeal);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-lg">Edit Deal Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Read-only metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border/40">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deal ID</p>
              <p className="text-xs font-mono mt-0.5">{deal.deal_number}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</p>
              <p className="text-xs mt-0.5">{new Date(deal.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Transaction Overview */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Overview</h3>

            <div>
              <Label htmlFor="edit-deal-name">Deal Name *</Label>
              <Input id="edit-deal-name" value={dealName} onChange={e => setDealName(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label>Deal Type</Label>
              <Select value={dealType} onValueChange={setDealType}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DEAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sector</Label>
              <Input value={sector} onChange={e => setSector(e.target.value)} className="mt-1" placeholder="e.g. Technology" />
            </div>
          </div>

          {/* Parties */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parties</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Buyer</Label>
                <Input value={buyer} onChange={e => setBuyer(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Seller</Label>
                <Input value={seller} onChange={e => setSeller(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Target Company</Label>
              <Input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Financial Terms */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial Terms</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deal Value *</Label>
                <Input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} className="mt-1" min="0" />
              </div>
              <div>
                <Label>Escrow Amount</Label>
                <Input type="number" value={escrowAmount} onChange={e => setEscrowAmount(e.target.value)} className="mt-1" min="0" />
              </div>
            </div>

            {/* Multi-currency */}
            <div>
              <Label>Currencies *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2 min-h-[28px]">
                {selectedCurrencies.map(c => (
                  <Badge key={c} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => toggleCurrency(c)}>
                    {c} <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
              <Select onValueChange={v => { if (!selectedCurrencies.includes(v)) toggleCurrency(v); }}>
                <SelectTrigger><SelectValue placeholder="Add currency" /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_GROUPS.map(g => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.items.filter(i => !selectedCurrencies.includes(i.value)).map(i => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Jurisdiction & Timing */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jurisdiction & Timing</h3>
            <div>
              <Label>Jurisdiction</Label>
              <Input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} className="mt-1" placeholder="e.g. Delaware, USA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Signing Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !signingDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {signingDate ? format(signingDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={signingDate} onSelect={setSigningDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Expected Close Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !closingDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {closingDate ? format(closingDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={closingDate} onSelect={setClosingDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
