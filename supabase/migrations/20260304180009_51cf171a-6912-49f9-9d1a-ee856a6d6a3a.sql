-- 1) Extend the contract_doc_type enum with binder document types
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'DISCLOSURE_SCHEDULES';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'WIRE_AUTHORIZATION';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'WIRE_INSTRUCTIONS';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'BOARD_CONSENT';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'SECRETARY_CERTIFICATE';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'OFFICER_CERTIFICATE';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'BRING_DOWN_CERTIFICATE';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'CAP_TABLE';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'WORKING_CAPITAL_STATEMENT';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'LEGAL_OPINION';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'EMPLOYMENT_AGREEMENT';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'IP_ASSIGNMENT';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'NON_COMPETE';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'TSA';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'THIRD_PARTY_CONSENT';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'W9';
ALTER TYPE contract_doc_type ADD VALUE IF NOT EXISTS 'GOOD_STANDING';

-- 2) Add binder support columns to contract_documents
ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS document_role text DEFAULT 'mutual',
  ADD COLUMN IF NOT EXISTS extracted_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requirement_group text DEFAULT 'Other';

-- 3) Create required_document_matrix table
CREATE TABLE IF NOT EXISTS public.required_document_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_type text NOT NULL,
  doc_type text NOT NULL,
  requirement_group text NOT NULL DEFAULT 'Core Closing',
  is_required boolean NOT NULL DEFAULT true,
  condition_expression text, -- e.g., 'escrow_amount > 0'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_type, doc_type)
);

ALTER TABLE public.required_document_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document matrix"
  ON public.required_document_matrix FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage document matrix"
  ON public.required_document_matrix FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Seed the required document matrix for common deal types
INSERT INTO public.required_document_matrix (deal_type, doc_type, requirement_group, is_required, condition_expression) VALUES
  -- M&A Acquisition
  ('M&A Acquisition', 'SPA', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'FUNDS_FLOW', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'ESCROW_AGREEMENT', 'Core Closing', true, 'escrow_amount > 0'),
  ('M&A Acquisition', 'OFFICER_CERTIFICATE', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'SECRETARY_CERTIFICATE', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'CAP_TABLE', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'WIRE_AUTHORIZATION', 'Core Closing', true, NULL),
  ('M&A Acquisition', 'DISCLOSURE_SCHEDULES', 'Ancillary', false, NULL),
  ('M&A Acquisition', 'LEGAL_OPINION', 'Ancillary', false, NULL),
  ('M&A Acquisition', 'GOOD_STANDING', 'Compliance', false, NULL),
  ('M&A Acquisition', 'W9', 'Tax', true, NULL),
  ('M&A Acquisition', 'BOARD_CONSENT', 'Approvals', true, NULL),
  -- Asset Purchase
  ('Asset Purchase', 'SPA', 'Core Closing', true, NULL),
  ('Asset Purchase', 'FUNDS_FLOW', 'Core Closing', true, NULL),
  ('Asset Purchase', 'ESCROW_AGREEMENT', 'Core Closing', true, 'escrow_amount > 0'),
  ('Asset Purchase', 'OFFICER_CERTIFICATE', 'Core Closing', true, NULL),
  ('Asset Purchase', 'CAP_TABLE', 'Core Closing', false, NULL),
  ('Asset Purchase', 'WIRE_AUTHORIZATION', 'Core Closing', true, NULL),
  ('Asset Purchase', 'IP_ASSIGNMENT', 'IP & Employment', true, NULL),
  ('Asset Purchase', 'EMPLOYMENT_AGREEMENT', 'IP & Employment', false, NULL),
  ('Asset Purchase', 'TSA', 'IP & Employment', false, NULL),
  ('Asset Purchase', 'WORKING_CAPITAL_STATEMENT', 'Financial', false, NULL),
  -- Secondary Transaction
  ('Secondary Transaction', 'SPA', 'Core Closing', true, NULL),
  ('Secondary Transaction', 'FUNDS_FLOW', 'Core Closing', true, NULL),
  ('Secondary Transaction', 'CAP_TABLE', 'Core Closing', true, NULL),
  ('Secondary Transaction', 'WIRE_AUTHORIZATION', 'Core Closing', true, NULL),
  ('Secondary Transaction', 'BOARD_CONSENT', 'Approvals', true, NULL),
  -- Debt Financing
  ('Debt Financing', 'SPA', 'Core Closing', true, NULL),
  ('Debt Financing', 'FUNDS_FLOW', 'Core Closing', true, NULL),
  ('Debt Financing', 'ESCROW_AGREEMENT', 'Core Closing', false, NULL),
  ('Debt Financing', 'PAYOFF_LETTER', 'Core Closing', true, NULL),
  ('Debt Financing', 'OFFICER_CERTIFICATE', 'Core Closing', true, NULL),
  ('Debt Financing', 'LEGAL_OPINION', 'Ancillary', true, NULL)
ON CONFLICT (deal_type, doc_type) DO NOTHING;