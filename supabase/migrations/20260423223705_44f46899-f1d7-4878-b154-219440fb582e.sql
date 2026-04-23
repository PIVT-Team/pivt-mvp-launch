-- Extend conditions table with CP-tracking fields
ALTER TABLE public.conditions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_document_id uuid REFERENCES public.deal_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_note text,
  ADD COLUMN IF NOT EXISTS at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS at_risk_reason text,
  ADD COLUMN IF NOT EXISTS waiver_justification text,
  ADD COLUMN IF NOT EXISTS satisfied_at timestamptz,
  ADD COLUMN IF NOT EXISTS satisfied_by uuid;

CREATE INDEX IF NOT EXISTS idx_conditions_deal_id ON public.conditions(deal_id);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON public.conditions(status);