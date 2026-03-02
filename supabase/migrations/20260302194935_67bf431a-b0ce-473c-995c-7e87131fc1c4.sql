
-- ============================================================
-- PIVT Payment Execution Layer — Stripe-style M&A Disbursements
-- ============================================================

-- 1) Enums
CREATE TYPE public.disbursement_status AS ENUM (
  'draft','pending_conditions','pending_approvals','eligible',
  'executing','executed','settled','reconciled','failed'
);

CREATE TYPE public.consideration_type AS ENUM (
  'cash','shares','seller_note','earnout','rollover_equity',
  'debt_assumption','escrow_holdback','contingent'
);

CREATE TYPE public.consideration_status AS ENUM (
  'draft','pending','executed','confirmed'
);

CREATE TYPE public.allocation_logic_type AS ENUM (
  'fixed','percentage','pro_rata','threshold'
);

CREATE TYPE public.fx_risk_bearer AS ENUM ('buyer','seller','shared');

-- 2) fx_quotes
CREATE TABLE public.fx_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  source text NOT NULL DEFAULT 'mock',
  quoted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  spread_bps numeric DEFAULT 0,
  risk_bearer public.fx_risk_bearer DEFAULT 'buyer',
  hedge_reference_id text,
  hedge_type text,
  hedge_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fx_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fx_quotes" ON public.fx_quotes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view fx_quotes" ON public.fx_quotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = fx_quotes.deal_id AND dp.user_id = auth.uid()));

CREATE TRIGGER update_fx_quotes_updated_at BEFORE UPDATE ON public.fx_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) waterfall_tiers
CREATE TABLE public.waterfall_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  tier_rank int NOT NULL,
  name text NOT NULL,
  allocation_logic_type public.allocation_logic_type NOT NULL DEFAULT 'fixed',
  params jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waterfall_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage waterfall_tiers" ON public.waterfall_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view waterfall_tiers" ON public.waterfall_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = waterfall_tiers.deal_id AND dp.user_id = auth.uid()));

CREATE TRIGGER update_waterfall_tiers_updated_at BEFORE UPDATE ON public.waterfall_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) waterfall_allocations
CREATE TABLE public.waterfall_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  calculation_version_hash text NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  input_totals jsonb NOT NULL DEFAULT '{}',
  output_summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waterfall_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage waterfall_allocations" ON public.waterfall_allocations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view waterfall_allocations" ON public.waterfall_allocations FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = waterfall_allocations.deal_id AND dp.user_id = auth.uid()));

CREATE TRIGGER update_waterfall_allocations_updated_at BEFORE UPDATE ON public.waterfall_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) waterfall_allocation_lines
CREATE TABLE public.waterfall_allocation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waterfall_allocation_id uuid NOT NULL REFERENCES public.waterfall_allocations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  consideration_type public.consideration_type NOT NULL DEFAULT 'cash',
  amount_original numeric NOT NULL DEFAULT 0,
  currency_original text NOT NULL DEFAULT 'USD',
  settlement_currency text NOT NULL DEFAULT 'USD',
  priority_rank int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waterfall_allocation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage waterfall_allocation_lines" ON public.waterfall_allocation_lines FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view waterfall_allocation_lines" ON public.waterfall_allocation_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM waterfall_allocations wa
    JOIN deal_participants dp ON dp.deal_id = wa.deal_id
    WHERE wa.id = waterfall_allocation_lines.waterfall_allocation_id AND dp.user_id = auth.uid()
  ));

CREATE TRIGGER update_waterfall_allocation_lines_updated_at BEFORE UPDATE ON public.waterfall_allocation_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) disbursement_intents
CREATE TABLE public.disbursement_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  amount_original numeric NOT NULL DEFAULT 0,
  currency_original text NOT NULL DEFAULT 'USD',
  settlement_currency text NOT NULL DEFAULT 'USD',
  rail text NOT NULL DEFAULT 'wire',
  bank_account_ref text,
  consideration_type public.consideration_type NOT NULL DEFAULT 'cash',
  waterfall_allocation_id uuid REFERENCES public.waterfall_allocations(id),
  fx_quote_id uuid REFERENCES public.fx_quotes(id),
  status public.disbursement_status NOT NULL DEFAULT 'draft',
  required_conditions jsonb NOT NULL DEFAULT '[]',
  required_approvals jsonb NOT NULL DEFAULT '[]',
  execution_provider text NOT NULL DEFAULT 'mock',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursement_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage disbursement_intents" ON public.disbursement_intents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view disbursement_intents" ON public.disbursement_intents FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = disbursement_intents.deal_id AND dp.user_id = auth.uid()));

CREATE TRIGGER update_disbursement_intents_updated_at BEFORE UPDATE ON public.disbursement_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) consideration_records
CREATE TABLE public.consideration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  type public.consideration_type NOT NULL,
  status public.consideration_status NOT NULL DEFAULT 'draft',
  terms jsonb NOT NULL DEFAULT '{}',
  evidence_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consideration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage consideration_records" ON public.consideration_records FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view consideration_records" ON public.consideration_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = consideration_records.deal_id AND dp.user_id = auth.uid()));

CREATE TRIGGER update_consideration_records_updated_at BEFORE UPDATE ON public.consideration_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) audit_events (append-only)
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  before jsonb DEFAULT '{}',
  after jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Append-only: insert + select only, no update/delete
CREATE POLICY "Admins manage audit_events" ON public.audit_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants insert audit_events" ON public.audit_events FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "Participants view audit_events" ON public.audit_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = audit_events.deal_id AND dp.user_id = auth.uid()));

-- Enable realtime for disbursement_intents status tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.disbursement_intents;
