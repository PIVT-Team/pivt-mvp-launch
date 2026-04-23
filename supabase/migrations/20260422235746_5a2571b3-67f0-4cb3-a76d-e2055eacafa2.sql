CREATE TABLE public.regulatory_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_filed',
  filed_at DATE,
  waiting_period_end DATE,
  early_termination_granted_at DATE,
  cleared_at DATE,
  notes TEXT,
  assigned_to UUID REFERENCES public.deal_members(id) ON DELETE SET NULL,
  checklist_item_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_conditions_condition_type_check CHECK (condition_type IN ('hsr', 'cfius', 'state_puc', 'state_banking', 'state_insurance', 'eu_fsr', 'uk_nsi', 'other')),
  CONSTRAINT regulatory_conditions_status_check CHECK (status IN ('not_filed', 'filed', 'waiting_period_active', 'early_termination_requested', 'cleared', 'second_request', 'withdrawn'))
);

ALTER TABLE public.closing_checklist_items
ADD COLUMN regulatory_condition_id UUID UNIQUE;

ALTER TABLE public.regulatory_conditions
ADD CONSTRAINT regulatory_conditions_checklist_item_id_fkey
FOREIGN KEY (checklist_item_id)
REFERENCES public.closing_checklist_items(id)
ON DELETE SET NULL;

ALTER TABLE public.closing_checklist_items
ADD CONSTRAINT closing_checklist_items_regulatory_condition_id_fkey
FOREIGN KEY (regulatory_condition_id)
REFERENCES public.regulatory_conditions(id)
ON DELETE SET NULL;

CREATE INDEX idx_regulatory_conditions_deal_id ON public.regulatory_conditions(deal_id);
CREATE INDEX idx_regulatory_conditions_status ON public.regulatory_conditions(status);
CREATE INDEX idx_regulatory_conditions_assigned_to ON public.regulatory_conditions(assigned_to);

ALTER TABLE public.regulatory_conditions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.calculate_regulatory_deadlines()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.filed_at IS NULL THEN
    IF NEW.condition_type IN ('hsr', 'cfius') THEN
      NEW.waiting_period_end := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.condition_type = 'hsr' THEN
    NEW.waiting_period_end := NEW.filed_at + 30;
  ELSIF NEW.condition_type = 'cfius' THEN
    IF NEW.status = 'second_request' THEN
      NEW.waiting_period_end := NEW.filed_at + 75;
    ELSE
      NEW.waiting_period_end := NEW.filed_at + 30;
    END IF;
  END IF;

  IF NEW.status = 'cleared' AND NEW.cleared_at IS NULL THEN
    NEW.cleared_at := CURRENT_DATE;
  ELSIF NEW.status <> 'cleared' THEN
    NEW.cleared_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.regulatory_condition_checklist_status(_status TEXT, _filed_at DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF _status = 'cleared' THEN
    RETURN 'satisfied';
  ELSIF _status = 'withdrawn' THEN
    RETURN 'waived';
  ELSIF _status IN ('filed', 'waiting_period_active', 'early_termination_requested', 'second_request') OR _filed_at IS NOT NULL THEN
    RETURN 'in_progress';
  END IF;

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_regulatory_condition_to_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_checklist_status TEXT;
  v_checklist_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.condition_type
    WHEN 'hsr' THEN 'HSR clearance obtained'
    WHEN 'cfius' THEN 'CFIUS review completed'
    WHEN 'state_puc' THEN 'State PUC approval obtained'
    WHEN 'state_banking' THEN 'State banking approval obtained'
    WHEN 'state_insurance' THEN 'State insurance approval obtained'
    WHEN 'eu_fsr' THEN 'EU FSR review completed'
    WHEN 'uk_nsi' THEN 'UK NSI review completed'
    ELSE 'Regulatory condition satisfied'
  END;

  v_description := COALESCE(NULLIF(NEW.notes, ''), 'Regulatory closing condition tracked in the Verification workspace.');
  v_checklist_status := public.regulatory_condition_checklist_status(NEW.status, NEW.filed_at);

  IF TG_OP = 'INSERT' OR NEW.checklist_item_id IS NULL THEN
    INSERT INTO public.closing_checklist_items (
      deal_id,
      title,
      description,
      category,
      sort_order,
      source,
      status,
      responsible_party_id,
      waiver_justification,
      satisfied_at
    )
    VALUES (
      NEW.deal_id,
      v_title,
      v_description,
      'Regulatory',
      COALESCE((SELECT MAX(sort_order) + 1 FROM public.closing_checklist_items WHERE deal_id = NEW.deal_id), 0),
      'manual',
      v_checklist_status,
      NEW.assigned_to,
      CASE WHEN v_checklist_status = 'waived' THEN COALESCE(NULLIF(NEW.notes, ''), 'Regulatory condition withdrawn') ELSE NULL END,
      CASE WHEN v_checklist_status = 'satisfied' THEN COALESCE(NEW.cleared_at::timestamp, now()) ELSE NULL END
    )
    RETURNING id INTO v_checklist_id;

    UPDATE public.regulatory_conditions
    SET checklist_item_id = v_checklist_id
    WHERE id = NEW.id;

    UPDATE public.closing_checklist_items
    SET regulatory_condition_id = NEW.id
    WHERE id = v_checklist_id;

    RETURN NEW;
  END IF;

  UPDATE public.closing_checklist_items
  SET
    title = v_title,
    description = v_description,
    status = v_checklist_status,
    responsible_party_id = NEW.assigned_to,
    waiver_justification = CASE WHEN v_checklist_status = 'waived' THEN COALESCE(NULLIF(NEW.notes, ''), 'Regulatory condition withdrawn') ELSE NULL END,
    satisfied_at = CASE WHEN v_checklist_status = 'satisfied' THEN COALESCE(NEW.cleared_at::timestamp, now()) ELSE NULL END,
    updated_at = now(),
    regulatory_condition_id = NEW.id
  WHERE id = NEW.checklist_item_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_checklist_to_regulatory_condition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.regulatory_condition_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE NEW.status
    WHEN 'satisfied' THEN 'cleared'
    WHEN 'waived' THEN 'withdrawn'
    WHEN 'in_progress' THEN 'waiting_period_active'
    ELSE 'not_filed'
  END;

  UPDATE public.regulatory_conditions
  SET
    status = v_status,
    notes = COALESCE(NULLIF(NEW.description, ''), notes),
    cleared_at = CASE WHEN NEW.status = 'satisfied' THEN COALESCE(cleared_at, CURRENT_DATE) ELSE NULL END,
    checklist_item_id = NEW.id
  WHERE id = NEW.regulatory_condition_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_regulatory_deadlines_trigger
BEFORE INSERT OR UPDATE OF filed_at, status, condition_type
ON public.regulatory_conditions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_regulatory_deadlines();

CREATE TRIGGER sync_regulatory_condition_to_checklist_trigger
AFTER INSERT OR UPDATE OF status, filed_at, waiting_period_end, early_termination_granted_at, cleared_at, notes, assigned_to, condition_type
ON public.regulatory_conditions
FOR EACH ROW
EXECUTE FUNCTION public.sync_regulatory_condition_to_checklist();

CREATE TRIGGER sync_checklist_to_regulatory_condition_trigger
AFTER UPDATE OF status, description, satisfied_at, waiver_justification
ON public.closing_checklist_items
FOR EACH ROW
WHEN (NEW.regulatory_condition_id IS NOT NULL)
EXECUTE FUNCTION public.sync_checklist_to_regulatory_condition();

CREATE POLICY "Deal participants can view regulatory conditions"
ON public.regulatory_conditions
FOR SELECT
TO authenticated
USING (
  public.can_access_deal(auth.uid(), deal_id)
  OR public.is_deal_accessible(auth.uid(), deal_id)
  OR public.is_platform_admin(auth.uid())
);

CREATE POLICY "Deal editors can create regulatory conditions"
ON public.regulatory_conditions
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_write_deal(auth.uid(), deal_id)
  OR public.is_platform_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Deal editors can update regulatory conditions"
ON public.regulatory_conditions
FOR UPDATE
TO authenticated
USING (
  public.can_write_deal(auth.uid(), deal_id)
  OR public.is_platform_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.can_write_deal(auth.uid(), deal_id)
  OR public.is_platform_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Deal editors can delete regulatory conditions"
ON public.regulatory_conditions
FOR DELETE
TO authenticated
USING (
  public.can_write_deal(auth.uid(), deal_id)
  OR public.is_platform_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);