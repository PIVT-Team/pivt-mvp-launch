CREATE TABLE public.field_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field_name text NOT NULL,
  document_span jsonb,
  ai_output text,
  ai_confidence double precision,
  human_correction text,
  deal_type text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_field_corrections_deal_field
  ON public.field_corrections (deal_id, field_name);

CREATE INDEX idx_field_corrections_table_field
  ON public.field_corrections (table_name, field_name);

CREATE INDEX idx_field_corrections_created_at
  ON public.field_corrections (created_at DESC);

ALTER TABLE public.field_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read corrections for accessible deals"
ON public.field_corrections
FOR SELECT
TO authenticated
USING (public.can_access_deal(auth.uid(), deal_id));

CREATE POLICY "Users can record corrections for writable deals"
ON public.field_corrections
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_write_deal(auth.uid(), deal_id)
);

CREATE OR REPLACE FUNCTION public.record_field_correction(
  p_table_name text,
  p_record_id uuid,
  p_field_name text,
  p_ai_output text,
  p_human_correction text,
  p_document_span jsonb DEFAULT NULL,
  p_ai_confidence double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
    user_id
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
    auth.uid()
  )
  RETURNING id INTO v_correction_id;

  RETURN v_correction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_field_correction(text, uuid, text, text, text, jsonb, double precision) TO authenticated;