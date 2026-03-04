
-- Create compliance check type enum
CREATE TYPE public.compliance_check_type AS ENUM (
  'kyb_entity_verification',
  'ubo_verification',
  'sanctions_screening',
  'pep_screening',
  'tax_form_validation'
);

-- Create compliance check status enum
CREATE TYPE public.compliance_check_status AS ENUM (
  'pending',
  'submitted',
  'under_review',
  'passed',
  'failed'
);

-- Create compliance_checks table
CREATE TABLE public.compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  party_id uuid NOT NULL,
  check_type public.compliance_check_type NOT NULL,
  status public.compliance_check_status NOT NULL DEFAULT 'pending',
  document_id uuid REFERENCES public.contract_documents(id),
  reviewed_by uuid,
  review_timestamp timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "compliance_checks_select" ON public.compliance_checks
  FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));

CREATE POLICY "compliance_checks_insert" ON public.compliance_checks
  FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));

CREATE POLICY "compliance_checks_update" ON public.compliance_checks
  FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));

CREATE POLICY "compliance_checks_delete" ON public.compliance_checks
  FOR DELETE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));
