ALTER TABLE public.discrepancies
ADD COLUMN IF NOT EXISTS resolution_type TEXT,
ADD COLUMN IF NOT EXISTS resolved_by UUID,
ADD COLUMN IF NOT EXISTS resolution_note TEXT;

ALTER TABLE public.field_corrections
ADD COLUMN IF NOT EXISTS resolution_type TEXT;

CREATE OR REPLACE FUNCTION public.validate_discrepancy_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'acknowledged', 'resolved', 'waived') THEN
    RAISE EXCEPTION 'Invalid discrepancy status: %', NEW.status;
  END IF;

  IF NEW.resolution_type IS NOT NULL
     AND NEW.resolution_type NOT IN ('ai_accepted', 'human_kept', 'human_corrected', 'waived') THEN
    RAISE EXCEPTION 'Invalid discrepancy resolution_type: %', NEW.resolution_type;
  END IF;

  IF NEW.status IN ('resolved', 'waived') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  END IF;

  IF NEW.status IN ('resolved', 'waived') AND NEW.resolved_by IS NULL THEN
    NEW.resolved_by = auth.uid();
  END IF;

  IF NEW.status = 'waived' THEN
    NEW.resolution_type = 'waived';
    IF coalesce(btrim(NEW.resolution_note), '') = '' THEN
      RAISE EXCEPTION 'Waived discrepancies require a written justification';
    END IF;
  END IF;

  IF NEW.resolution_type = 'human_kept' AND coalesce(btrim(NEW.resolution_note), '') = '' THEN
    RAISE EXCEPTION 'Keeping the current value requires a brief explanation';
  END IF;

  IF NEW.status NOT IN ('resolved', 'waived') THEN
    NEW.resolution_type = NULL;
    NEW.resolved_by = NULL;
    NEW.resolved_at = NULL;
    NEW.resolution_note = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_discrepancy_resolution_on_write ON public.discrepancies;
CREATE TRIGGER validate_discrepancy_resolution_on_write
BEFORE INSERT OR UPDATE ON public.discrepancies
FOR EACH ROW
EXECUTE FUNCTION public.validate_discrepancy_resolution();

CREATE INDEX IF NOT EXISTS idx_discrepancies_deal_status_resolution
  ON public.discrepancies (deal_id, status, resolution_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discrepancies_resolved_by
  ON public.discrepancies (resolved_by, resolved_at DESC)
  WHERE resolved_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_field_correction(
  p_table_name text,
  p_record_id uuid,
  p_field_name text,
  p_ai_output text,
  p_human_correction text,
  p_document_span jsonb DEFAULT NULL::jsonb,
  p_ai_confidence double precision DEFAULT NULL::double precision,
  p_resolution_type text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_id uuid;
  v_deal_type text;
  v_correction_id uuid;
  v_allowed_tables constant text[] := ARRAY[
    'cap_table_entries',
    'wire_instructions',
    'obligations',
    'discrepancies',
    'conditions',
    'contract_documents',
    'deal_approvals',
    'deals'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_table_name IS NULL OR btrim(p_table_name) = '' THEN
    RAISE EXCEPTION 'table_name is required';
  END IF;

  IF p_field_name IS NULL OR btrim(p_field_name) = '' THEN
    RAISE EXCEPTION 'field_name is required';
  END IF;

  IF p_resolution_type IS NOT NULL
     AND p_resolution_type NOT IN ('ai_accepted', 'human_kept', 'human_corrected', 'waived') THEN
    RAISE EXCEPTION 'Unsupported resolution_type: %', p_resolution_type;
  END IF;

  IF NOT (p_table_name = ANY (v_allowed_tables)) THEN
    RAISE EXCEPTION 'Unsupported correction target table: %', p_table_name;
  END IF;

  IF p_table_name = 'deals' THEN
    SELECT d.id, d.deal_type
    INTO v_deal_id, v_deal_type
    FROM public.deals d
    WHERE d.id = p_record_id;
  ELSE
    EXECUTE format(
      'SELECT t.deal_id FROM public.%I t WHERE t.id = $1',
      p_table_name
    )
    INTO v_deal_id
    USING p_record_id;

    SELECT d.deal_type
    INTO v_deal_type
    FROM public.deals d
    WHERE d.id = v_deal_id;
  END IF;

  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve deal_id for % record %', p_table_name, p_record_id;
  END IF;

  INSERT INTO public.field_corrections (
    deal_id,
    table_name,
    record_id,
    field_name,
    document_span,
    ai_output,
    ai_confidence,
    human_correction,
    deal_type,
    user_id,
    resolution_type
  )
  VALUES (
    v_deal_id,
    p_table_name,
    p_record_id,
    p_field_name,
    p_document_span,
    p_ai_output,
    p_ai_confidence,
    p_human_correction,
    v_deal_type,
    auth.uid(),
    p_resolution_type
  )
  RETURNING id INTO v_correction_id;

  RETURN v_correction_id;
END;
$$;