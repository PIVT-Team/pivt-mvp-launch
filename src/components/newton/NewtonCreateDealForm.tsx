/**
 * Newton Create Deal Inline Form — Compact deal creation within chat
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';

interface Props {
  onSubmit: (data: {
    deal_name: string;
    deal_value: number;
    buyer?: string;
    seller?: string;
    target_company?: string;
    deal_type?: string;
    closing_date?: string;
  }) => void;
  isLoading: boolean;
  onCancel: () => void;
}

const DEAL_TYPES = [
  "Private Company Share Purchase", "Private Equity Acquisition", "Asset Acquisition",
  "Merger", "Leveraged Buyout", "Growth Equity", "Other",
];

export const NewtonCreateDealForm: React.FC<Props> = ({ onSubmit, isLoading, onCancel }) => {
  const [form, setForm] = useState({
    deal_name: '',
    deal_value: '',
    buyer: '',
    seller: '',
    target_company: '',
    deal_type: '',
    closing_date: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deal_name || !form.deal_value) return;
    onSubmit({
      deal_name: form.deal_name,
      deal_value: Number(form.deal_value),
      buyer: form.buyer || undefined,
      seller: form.seller || undefined,
      target_company: form.target_company || undefined,
      deal_type: form.deal_type || undefined,
      closing_date: form.closing_date || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-muted/40 border border-border rounded-xl p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground">Create New Deal</p>

      <div className="space-y-1">
        <Label className="text-[11px]">Deal Name *</Label>
        <Input
          value={form.deal_name}
          onChange={e => set('deal_name', e.target.value)}
          placeholder="Project Aurora"
          className="h-8 text-xs"
          required
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Deal Value *</Label>
          <Input
            type="number"
            value={form.deal_value}
            onChange={e => set('deal_value', e.target.value)}
            placeholder="50000000"
            className="h-8 text-xs"
            required
            min={0}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Deal Type</Label>
          <Select value={form.deal_type} onValueChange={v => set('deal_type', v)} disabled={isLoading}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {DEAL_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Buyer</Label>
          <Input value={form.buyer} onChange={e => set('buyer', e.target.value)} placeholder="Buyer entity" className="h-8 text-xs" disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Seller</Label>
          <Input value={form.seller} onChange={e => set('seller', e.target.value)} placeholder="Seller entity" className="h-8 text-xs" disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Target Company</Label>
          <Input value={form.target_company} onChange={e => set('target_company', e.target.value)} placeholder="Target Co." className="h-8 text-xs" disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Close Date</Label>
          <Input type="date" value={form.closing_date} onChange={e => set('closing_date', e.target.value)} className="h-8 text-xs" disabled={isLoading} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={isLoading || !form.deal_name || !form.deal_value}>
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          Create Deal
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
