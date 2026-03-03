
-- ══════════════════════════════════════════════════════════════
-- Contract Ingestion v1: Documents → Obligations → Validation
-- ══════════════════════════════════════════════════════════════

-- 1. Enums
CREATE TYPE public.contract_doc_type AS ENUM (
  'SPA', 'FUNDS_FLOW', 'ESCROW_AGREEMENT', 'PAYOFF_LETTER', 'FEE_LETTER', 'OTHER'
);

CREATE TYPE public.contract_doc_status AS ENUM (
  'UPLOADED', 'TEXT_EXTRACTED', 'EXTRACTION_COMPLETE', 'ERROR'
);

CREATE TYPE public.obligation_type AS ENUM (
  'PURCHASE_PRICE_BASE', 'PURCHASE_PRICE_ADJUSTMENT',
  'ESCROW_HOLD_BACK', 'DEBT_PAYOFF', 'SELLER_PROCEEDS',
  'BROKER_FEE', 'LEGAL_FEE', 'ADVISORY_FEE',
  'TAX_WITHHOLDING', 'EARNOUT_RESERVE', 'WORKING_CAPITAL_TRUE_UP',
  'INDEMNITY_RESERVE', 'OTHER'
);

CREATE TYPE public.obligation_status AS ENUM (
  'DRAFT_EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'SUPERSEDED'
);

CREATE TYPE public.obligation_timing AS ENUM (
  'AT_CLOSING', 'PRE_CLOSING', 'POST_CLOSING', 'ON_CONDITION', 'ON_DATE'
);

CREATE TYPE public.obligation_amount_type AS ENUM (
  'FIXED', 'PERCENT_OF_BASE', 'FORMULA', 'UNKNOWN'
);

CREATE TYPE public.obligation_mapping_status AS ENUM (
  'UNMAPPED', 'PARTIALLY_MAPPED', 'MAPPED'
);

-- 2. contract_documents table
CREATE TABLE public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  doc_type public.contract_doc_type NOT NULL DEFAULT 'OTHER',
  filename text NOT NULL,
  file_url text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  text_content text,
  status public.contract_doc_status NOT NULL DEFAULT 'UPLOADED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contract_documents"
  ON public.contract_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants view contract_documents"
  ON public.contract_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = contract_documents.deal_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Participants insert contract_documents"
  ON public.contract_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = contract_documents.deal_id AND dp.user_id = auth.uid()
  ));

-- 3. obligations table
CREATE TABLE public.obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  obligation_type public.obligation_type NOT NULL DEFAULT 'OTHER',
  status public.obligation_status NOT NULL DEFAULT 'DRAFT_EXTRACTED',
  
  -- Timing
  timing_type public.obligation_timing NOT NULL DEFAULT 'AT_CLOSING',
  scheduled_date date,
  
  -- Parties
  payor_label text,
  payee_label text,
  
  -- Amount model
  amount_type public.obligation_amount_type NOT NULL DEFAULT 'UNKNOWN',
  amount_value_minor bigint,
  amount_currency text DEFAULT 'USD',
  percent_basis_points int,
  percent_base_reference text,
  formula_text text,
  tolerance_minor bigint DEFAULT 0,
  
  -- Full extracted structure
  structured_json jsonb DEFAULT '{}'::jsonb,
  
  -- Provenance
  confidence_score numeric DEFAULT 0,
  source_text_snippet text,
  extracted_by text DEFAULT 'AI',
  confirmed_by_user_id uuid,
  confirmed_at timestamptz,
  
  -- Mapping to execution
  mapped_intent_ids jsonb DEFAULT '[]'::jsonb,
  mapping_status public.obligation_mapping_status NOT NULL DEFAULT 'UNMAPPED',
  mapping_notes text,
  
  -- Payment instructions (guardrailed)
  payment_instructions_source text,
  payment_instructions_text text,
  instructions_confirmed boolean DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage obligations"
  ON public.obligations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants view obligations"
  ON public.obligations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = obligations.deal_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Participants insert obligations"
  ON public.obligations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = obligations.deal_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Participants update obligations"
  ON public.obligations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_participants dp
    WHERE dp.deal_id = obligations.deal_id AND dp.user_id = auth.uid()
  ));

-- 4. obligation_intent_map (join table)
CREATE TABLE public.obligation_intent_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  intent_id uuid NOT NULL REFERENCES public.disbursement_intents(id) ON DELETE CASCADE,
  allocation_value_minor bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obligation_id, intent_id)
);

ALTER TABLE public.obligation_intent_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage obligation_intent_map"
  ON public.obligation_intent_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants view obligation_intent_map"
  ON public.obligation_intent_map FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obligations o
    JOIN public.deal_participants dp ON dp.deal_id = o.deal_id
    WHERE o.id = obligation_intent_map.obligation_id AND dp.user_id = auth.uid()
  ));

-- 5. Updated_at triggers
CREATE TRIGGER update_contract_documents_updated_at
  BEFORE UPDATE ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_obligations_updated_at
  BEFORE UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Indexes
CREATE INDEX idx_contract_documents_deal_id ON public.contract_documents(deal_id);
CREATE INDEX idx_obligations_deal_id ON public.obligations(deal_id);
CREATE INDEX idx_obligations_source_doc ON public.obligations(source_document_id);
CREATE INDEX idx_obligations_status ON public.obligations(status);
CREATE INDEX idx_obligation_intent_map_obligation ON public.obligation_intent_map(obligation_id);
CREATE INDEX idx_obligation_intent_map_intent ON public.obligation_intent_map(intent_id);
