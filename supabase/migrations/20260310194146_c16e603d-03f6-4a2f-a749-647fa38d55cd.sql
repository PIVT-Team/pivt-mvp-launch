
-- Wire instructions parsed from documents
CREATE TABLE public.wire_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  payer_entity text,
  payee_entity text NOT NULL,
  bank_name text,
  account_holder text,
  account_number_last4 text,
  routing_number text,
  swift_bic text,
  iban text,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'Purchase Price',
  verification_status text NOT NULL DEFAULT 'pending',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payment allocations parsed from funds flow
CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  source_wire_id uuid REFERENCES public.wire_instructions(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  allocation_type text NOT NULL DEFAULT 'seller_proceeds',
  status text NOT NULL DEFAULT 'unmatched',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.wire_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- wire_instructions policies
CREATE POLICY wire_instructions_select ON public.wire_instructions FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY wire_instructions_insert ON public.wire_instructions FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY wire_instructions_update ON public.wire_instructions FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY wire_instructions_delete ON public.wire_instructions FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- payment_allocations policies
CREATE POLICY payment_allocations_select ON public.payment_allocations FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY payment_allocations_insert ON public.payment_allocations FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY payment_allocations_update ON public.payment_allocations FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY payment_allocations_delete ON public.payment_allocations FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- Service role insert policies for edge functions
CREATE POLICY wire_instructions_service_insert ON public.wire_instructions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY payment_allocations_service_insert ON public.payment_allocations FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY wire_instructions_service_delete ON public.wire_instructions FOR DELETE TO service_role USING (true);
CREATE POLICY payment_allocations_service_delete ON public.payment_allocations FOR DELETE TO service_role USING (true);
