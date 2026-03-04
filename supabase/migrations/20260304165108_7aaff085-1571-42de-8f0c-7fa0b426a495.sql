
-- Tax Recipients table
CREATE TABLE public.tax_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'entity' CHECK (recipient_type IN ('individual', 'entity')),
  tax_residency text NOT NULL DEFAULT 'us' CHECK (tax_residency IN ('us', 'non_us')),
  email text,
  linked_stakeholder_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_recipients_select" ON public.tax_recipients FOR SELECT USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "tax_recipients_insert" ON public.tax_recipients FOR INSERT WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "tax_recipients_update" ON public.tax_recipients FOR UPDATE USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "tax_recipients_delete" ON public.tax_recipients FOR DELETE USING (can_write_deal(auth.uid(), deal_id));

-- Tax Forms table
CREATE TABLE public.tax_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.tax_recipients(id) ON DELETE CASCADE,
  form_type text NOT NULL CHECK (form_type IN ('W9', 'W8BEN', 'W8BENE')),
  status text NOT NULL DEFAULT 'required' CHECK (status IN ('required', 'received', 'verified', 'expired')),
  tin_last4 text,
  signed_date date,
  expires_on date,
  document_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_forms_select" ON public.tax_forms FOR SELECT USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "tax_forms_insert" ON public.tax_forms FOR INSERT WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "tax_forms_update" ON public.tax_forms FOR UPDATE USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "tax_forms_delete" ON public.tax_forms FOR DELETE USING (can_write_deal(auth.uid(), deal_id));

-- Add updated_at triggers
CREATE TRIGGER update_tax_recipients_updated_at BEFORE UPDATE ON public.tax_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_forms_updated_at BEFORE UPDATE ON public.tax_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed discrepancy rule for missing tax forms
INSERT INTO public.discrepancy_rules (rule_key, name, description, severity, enabled, scope, config)
VALUES ('missing_tax_form', 'Missing Tax Form', 'Required tax documentation (W-9/W-8BEN/W-8BEN-E) must be collected before funds can be released.', 'blocker', true, 'deal', '{}');
