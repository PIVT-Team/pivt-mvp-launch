/**
 * Newton Create Deal Inline Form — Structured deal creation within chat
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { ChecklistTemplateManager } from '@/components/pivt-complete/cover/ChecklistTemplateManager';
import type { Database } from '@/integrations/supabase/types';

type TemplateRow = Database['public']['Tables']['checklist_templates']['Row'];

export interface NewtonCreateDealPayload {
  deal_name: string;
  deal_value: number;
  buyer: string;
  seller?: string;
  target_company?: string;
  deal_type: string;
  closing_date: string;
  jurisdiction?: string;
  internal_reference?: string;
  primary_deal_owner: string;
  template_id?: string;
  template_version?: string;
}

interface Props {
  onSubmit: (data: NewtonCreateDealPayload) => void;
  isLoading: boolean;
  onCancel: () => void;
  initialValues?: Partial<NewtonCreateDealPayload>;
  currentUserLabel?: string;
}

const DEAL_TYPES = [
  'Private Company Share Purchase',
  'Private Equity Acquisition',
  'Asset Acquisition',
  'Merger',
  'Leveraged Buyout',
  'Growth Equity',
  'Other',
];

const DEFAULT_FORM = {
  deal_name: '',
  deal_value: '',
  buyer: '',
  seller: '',
  target_company: '',
  deal_type: '',
  closing_date: '',
  jurisdiction: '',
  internal_reference: '',
  primary_deal_owner: '',
};

export const NewtonCreateDealForm: React.FC<Props> = ({
  onSubmit,
  isLoading,
  onCancel,
  initialValues,
  currentUserLabel,
}) => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null);

  const initialForm = useMemo(() => ({
    ...DEFAULT_FORM,
    ...Object.fromEntries(
      Object.entries(initialValues || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
    ),
    primary_deal_owner:
      (initialValues?.primary_deal_owner as string | undefined)
      || currentUserLabel
      || '',
  }), [initialValues, currentUserLabel]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const set = (k: keyof typeof DEFAULT_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const hasSellerOrTarget = Boolean(form.seller.trim() || form.target_company.trim());
  const canSubmit =
    Boolean(form.deal_name.trim())
    && Boolean(form.deal_type.trim())
    && Boolean(form.buyer.trim())
    && Boolean(form.closing_date)
    && Boolean(form.primary_deal_owner.trim())
    && hasSellerOrTarget;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      deal_name: form.deal_name.trim(),
      deal_type: form.deal_type.trim(),
      buyer: form.buyer.trim(),
      seller: form.seller.trim() || undefined,
      target_company: form.target_company.trim() || undefined,
      closing_date: form.closing_date,
      deal_value: form.deal_value.trim() ? Number(form.deal_value) : 0,
      jurisdiction: form.jurisdiction.trim() || undefined,
      internal_reference: form.internal_reference.trim() || undefined,
      primary_deal_owner: form.primary_deal_owner.trim(),
      template_id: selectedTemplate?.id,
      template_version: selectedTemplate?.version,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-muted/40 border border-border rounded-xl p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground">Create New Deal</p>

      <div className="space-y-1">
        <Label className="text-[11px]">Deal Name *</Label>
        <Input
          value={form.deal_name}
          onChange={(e) => set('deal_name', e.target.value)}
          placeholder="Project Aurora"
          className="h-8 text-xs"
          required
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Deal Type *</Label>
          <Select value={form.deal_type} onValueChange={(v) => set('deal_type', v)} disabled={isLoading}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {DEAL_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Target Close Date *</Label>
          <Input
            type="date"
            value={form.closing_date}
            onChange={(e) => set('closing_date', e.target.value)}
            className="h-8 text-xs"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Buyer *</Label>
          <Input
            value={form.buyer}
            onChange={(e) => set('buyer', e.target.value)}
            placeholder="Buyer entity"
            className="h-8 text-xs"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Seller</Label>
          <Input
            value={form.seller}
            onChange={(e) => set('seller', e.target.value)}
            placeholder="Seller entity"
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Target Company</Label>
          <Input
            value={form.target_company}
            onChange={(e) => set('target_company', e.target.value)}
            placeholder="Target Co."
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Deal Size (optional)</Label>
          <Input
            type="number"
            value={form.deal_value}
            onChange={(e) => set('deal_value', e.target.value)}
            placeholder="50000000"
            className="h-8 text-xs"
            min={0}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Matter ID / Internal Ref (optional)</Label>
          <Input
            value={form.internal_reference}
            onChange={(e) => set('internal_reference', e.target.value)}
            placeholder="MAT-2026-001"
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Jurisdiction (optional)</Label>
          <Input
            value={form.jurisdiction}
            onChange={(e) => set('jurisdiction', e.target.value)}
            placeholder="Delaware"
            className="h-8 text-xs"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Primary Deal Owner *</Label>
        <Input
          value={form.primary_deal_owner}
          onChange={(e) => set('primary_deal_owner', e.target.value)}
          placeholder="Name or email"
          className="h-8 text-xs"
          required
          disabled={isLoading}
        />
      </div>

      <ChecklistTemplateManager
        mode="inline-selector"
        selectedTemplateId={selectedTemplate?.id || null}
        onSelectTemplate={setSelectedTemplate}
        dealTypeFilter={form.deal_type || undefined}
        dealValue={form.deal_value.trim() ? Number(form.deal_value) : undefined}
      />

      {!hasSellerOrTarget && (
        <p className="text-[10px] text-muted-foreground">Provide at least a Seller or Target Company.</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={isLoading || !canSubmit}>
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
