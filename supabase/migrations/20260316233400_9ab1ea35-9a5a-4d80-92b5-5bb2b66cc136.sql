
-- Newton Intake System Tables

-- 1. Newton uploads — tracks every file uploaded through Newton
CREATE TABLE public.newton_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text,
  detected_type text, -- stakeholder_spreadsheet, funds_flow, wire_instructions, general
  user_override_type text, -- user can override detected type
  status text NOT NULL DEFAULT 'uploaded', -- uploaded, classifying, classified, extracting, extracted, error
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newton_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newton_uploads_select" ON public.newton_uploads FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "newton_uploads_insert" ON public.newton_uploads FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_uploads_update" ON public.newton_uploads FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_uploads_service" ON public.newton_uploads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Newton extractions — structured data extracted from uploads
CREATE TABLE public.newton_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.newton_uploads(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  extraction_type text NOT NULL, -- stakeholders, payout_rows, wire_details, general_fields
  extracted_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_summary jsonb DEFAULT '{}'::jsonb, -- { total_rows, missing_fields, confidence }
  confidence_score numeric DEFAULT 0,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newton_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newton_extractions_select" ON public.newton_extractions FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "newton_extractions_insert" ON public.newton_extractions FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_extractions_update" ON public.newton_extractions FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_extractions_service" ON public.newton_extractions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Newton proposed actions — actions Newton suggests based on extractions
CREATE TABLE public.newton_proposed_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.newton_uploads(id) ON DELETE CASCADE,
  extraction_id uuid REFERENCES public.newton_extractions(id) ON DELETE SET NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- import_stakeholder_data, create_missing_stakeholders, prepare_kyc_kyb_requests, etc.
  action_label text NOT NULL, -- human-readable label
  description text, -- what this action will do
  impact_level text NOT NULL DEFAULT 'low', -- low, medium, high
  preview_data jsonb DEFAULT '{}'::jsonb, -- preview of what will change
  status text NOT NULL DEFAULT 'proposed', -- proposed, approved, rejected, executing, completed, failed
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  execution_result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newton_proposed_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newton_proposed_actions_select" ON public.newton_proposed_actions FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "newton_proposed_actions_insert" ON public.newton_proposed_actions FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_proposed_actions_update" ON public.newton_proposed_actions FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "newton_proposed_actions_service" ON public.newton_proposed_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
