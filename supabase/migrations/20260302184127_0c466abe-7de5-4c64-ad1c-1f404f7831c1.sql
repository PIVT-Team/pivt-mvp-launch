
-- 1) Sequence for deal numbers
CREATE SEQUENCE IF NOT EXISTS public.deal_number_seq START 1;

-- 2) Add deal_number column to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deal_number TEXT UNIQUE;

-- 3) Trigger function to auto-generate deal_number on INSERT
CREATE OR REPLACE FUNCTION public.generate_deal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  IF NEW.deal_number IS NULL OR NEW.deal_number = '' THEN
    seq_val := nextval('public.deal_number_seq');
    NEW.deal_number := 'PIVT-' || to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deals_generate_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_deal_number();

-- 4) Backfill existing deals that have no deal_number
UPDATE public.deals
SET deal_number = 'PIVT-' || to_char(created_at, 'YYYY') || '-' || lpad((nextval('public.deal_number_seq'))::text, 6, '0')
WHERE deal_number IS NULL;

-- Make deal_number NOT NULL after backfill
ALTER TABLE public.deals ALTER COLUMN deal_number SET NOT NULL;

-- ========== ONTOLOGY ENUMS ==========

CREATE TYPE public.party_type AS ENUM ('BUYER', 'SELLER', 'ESCROW_AGENT', 'LENDER', 'OTHER');
CREATE TYPE public.deal_member_role AS ENUM ('BUYER_COUNSEL', 'SELLER_COUNSEL', 'DEAL_LEAD', 'FINANCE_APPROVER', 'OPERATIONS', 'VIEWER');
CREATE TYPE public.condition_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SATISFIED', 'WAIVED', 'BLOCKED');
CREATE TYPE public.ontology_approval_type AS ENUM ('LEGAL_SIGNOFF', 'FINANCE_SIGNOFF', 'KYC_APPROVAL', 'KYB_APPROVAL');
CREATE TYPE public.ontology_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.ontology_doc_type AS ENUM ('SPA', 'ESCROW_AGREEMENT', 'PAYMENT_INSTRUCTIONS', 'OTHER');
CREATE TYPE public.payment_status AS ENUM ('DRAFT', 'READY', 'SENT', 'CONFIRMED');

-- ========== ONTOLOGY TABLES ==========

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage organizations" ON public.organizations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Deal Parties
CREATE TABLE public.deal_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  party_type public.party_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, organization_id, party_type)
);
ALTER TABLE public.deal_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage deal_parties" ON public.deal_parties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view deal_parties" ON public.deal_parties FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = deal_parties.deal_id AND dp.user_id = auth.uid())
);

-- Deal Members
CREATE TABLE public.deal_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.deal_member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id, role)
);
ALTER TABLE public.deal_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage deal_members" ON public.deal_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members view own membership" ON public.deal_members FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Conditions
CREATE TABLE public.conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status public.condition_status NOT NULL DEFAULT 'NOT_STARTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage conditions" ON public.conditions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view conditions" ON public.conditions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = conditions.deal_id AND dp.user_id = auth.uid())
);

-- Ontology Approvals (distinct from existing deal_approvals)
CREATE TABLE public.ontology_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  condition_id UUID REFERENCES public.conditions(id) ON DELETE SET NULL,
  approval_type public.ontology_approval_type NOT NULL,
  status public.ontology_approval_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ontology_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ontology_approvals" ON public.ontology_approvals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view ontology_approvals" ON public.ontology_approvals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = ontology_approvals.deal_id AND dp.user_id = auth.uid())
);

-- Ontology Documents (distinct from existing deal_documents)
CREATE TABLE public.ontology_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  doc_type public.ontology_doc_type NOT NULL DEFAULT 'OTHER',
  title TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ontology_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ontology_documents" ON public.ontology_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view ontology_documents" ON public.ontology_documents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = ontology_documents.deal_id AND dp.user_id = auth.uid())
);

-- Payment Instructions
CREATE TABLE public.payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment_instructions" ON public.payment_instructions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Participants view payment_instructions" ON public.payment_instructions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = payment_instructions.deal_id AND dp.user_id = auth.uid())
);
