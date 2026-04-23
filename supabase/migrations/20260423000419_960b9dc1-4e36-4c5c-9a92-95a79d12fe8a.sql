CREATE TABLE public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id),
  CONSTRAINT organization_memberships_role_check CHECK (role IN ('owner', 'editor', 'viewer'))
);

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = _user_id
      AND om.org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org_templates(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = _user_id
        AND om.org_id = _org_id
        AND om.role IN ('owner', 'editor')
    )
$$;

CREATE POLICY "Organization members can view memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (
  public.is_org_member(auth.uid(), org_id)
  OR public.is_platform_admin(auth.uid())
);

CREATE POLICY "Organization owners can manage memberships"
ON public.organization_memberships
FOR ALL
TO authenticated
USING (
  public.can_manage_org_templates(auth.uid(), org_id)
)
WITH CHECK (
  public.can_manage_org_templates(auth.uid(), org_id)
);

CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  previous_version_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  deal_types TEXT[] NOT NULL DEFAULT '{}',
  version TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name, version)
);

CREATE TABLE public.checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  condition_type TEXT,
  auto_apply_if JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_exclude_if JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_checklist_templates_org_id ON public.checklist_templates(org_id);
CREATE INDEX idx_checklist_templates_base_template_id ON public.checklist_templates(base_template_id);
CREATE INDEX idx_checklist_templates_published ON public.checklist_templates(org_id, is_published);
CREATE INDEX idx_checklist_template_items_template_id ON public.checklist_template_items(template_id, sort_order);
CREATE INDEX idx_checklist_template_items_parent_id ON public.checklist_template_items(parent_id);

ALTER TABLE public.deals
ADD COLUMN template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
ADD COLUMN template_version TEXT;

ALTER TABLE public.closing_checklist_items
ADD COLUMN template_item_id UUID REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
ADD COLUMN template_version TEXT,
ADD COLUMN was_added_post_template BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN deleted_from_template BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.bump_minor_version(_version text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_year integer;
  v_minor integer;
BEGIN
  IF _version IS NULL OR btrim(_version) = '' THEN
    RETURN to_char(current_date, 'YYYY') || '.1';
  END IF;

  v_year := split_part(_version, '.', 1)::integer;
  v_minor := COALESCE(NULLIF(split_part(_version, '.', 2), ''), '0')::integer + 1;

  RETURN v_year::text || '.' || v_minor::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.template_rule_matches(_rules jsonb, _deal_type text, _deal_value numeric)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_type text;
  v_deal_size_above numeric;
  v_deal_size_below numeric;
BEGIN
  IF _rules IS NULL OR _rules = '{}'::jsonb THEN
    RETURN true;
  END IF;

  v_deal_type := NULLIF(_rules ->> 'deal_type', '');
  v_deal_size_above := NULLIF(_rules ->> 'deal_size_above', '')::numeric;
  v_deal_size_below := NULLIF(_rules ->> 'deal_size_below', '')::numeric;

  IF v_deal_type IS NOT NULL AND _deal_type IS DISTINCT FROM v_deal_type THEN
    RETURN false;
  END IF;

  IF v_deal_size_above IS NOT NULL AND COALESCE(_deal_value, 0) <= v_deal_size_above THEN
    RETURN false;
  END IF;

  IF v_deal_size_below IS NOT NULL AND COALESCE(_deal_value, 0) >= v_deal_size_below THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_checklist_template_version(_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current public.checklist_templates%ROWTYPE;
  v_new_template_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_current
  FROM public.checklist_templates
  WHERE id = _template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  IF NOT public.can_manage_org_templates(auth.uid(), v_current.org_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.checklist_templates (
    org_id,
    base_template_id,
    previous_version_id,
    name,
    deal_types,
    version,
    is_published,
    created_by
  ) VALUES (
    v_current.org_id,
    COALESCE(v_current.base_template_id, v_current.id),
    v_current.id,
    v_current.name,
    v_current.deal_types,
    public.bump_minor_version(v_current.version),
    false,
    auth.uid()
  )
  RETURNING id INTO v_new_template_id;

  INSERT INTO public.checklist_template_items (
    template_id,
    parent_id,
    title,
    description,
    condition_type,
    auto_apply_if,
    auto_exclude_if,
    sort_order
  )
  SELECT
    v_new_template_id,
    NULL,
    item.title,
    item.description,
    item.condition_type,
    item.auto_apply_if,
    item.auto_exclude_if,
    item.sort_order
  FROM public.checklist_template_items item
  WHERE item.template_id = v_current.id
    AND item.parent_id IS NULL
  ORDER BY item.sort_order;

  WITH old_items AS (
    SELECT id, title
    FROM public.checklist_template_items
    WHERE template_id = v_current.id
      AND parent_id IS NULL
  ),
  new_items AS (
    SELECT id, title
    FROM public.checklist_template_items
    WHERE template_id = v_new_template_id
      AND parent_id IS NULL
  )
  INSERT INTO public.checklist_template_items (
    template_id,
    parent_id,
    title,
    description,
    condition_type,
    auto_apply_if,
    auto_exclude_if,
    sort_order
  )
  SELECT
    v_new_template_id,
    ni.id,
    child.title,
    child.description,
    child.condition_type,
    child.auto_apply_if,
    child.auto_exclude_if,
    child.sort_order
  FROM public.checklist_template_items child
  JOIN old_items oi ON oi.id = child.parent_id
  JOIN new_items ni ON ni.title = oi.title
  WHERE child.template_id = v_current.id
    AND child.parent_id IS NOT NULL;

  RETURN v_new_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_checklist_template_diff(_from_template_id uuid, _to_template_id uuid)
RETURNS TABLE(change_type text, item_title text, previous_description text, next_description text, previous_condition_type text, next_condition_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH from_items AS (
    SELECT title, description, condition_type
    FROM public.checklist_template_items
    WHERE template_id = _from_template_id
  ),
  to_items AS (
    SELECT title, description, condition_type
    FROM public.checklist_template_items
    WHERE template_id = _to_template_id
  )
  SELECT
    CASE
      WHEN f.title IS NULL THEN 'added'
      WHEN t.title IS NULL THEN 'removed'
      WHEN f.description IS DISTINCT FROM t.description OR f.condition_type IS DISTINCT FROM t.condition_type THEN 'changed'
      ELSE 'unchanged'
    END AS change_type,
    COALESCE(t.title, f.title) AS item_title,
    f.description,
    t.description,
    f.condition_type,
    t.condition_type
  FROM from_items f
  FULL OUTER JOIN to_items t ON t.title = f.title
  WHERE f.title IS NULL
     OR t.title IS NULL
     OR f.description IS DISTINCT FROM t.description
     OR f.condition_type IS DISTINCT FROM t.condition_type
$$;

CREATE OR REPLACE FUNCTION public.apply_checklist_template_to_deal(_deal_id uuid, _template_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal public.deals%ROWTYPE;
  v_template public.checklist_templates%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_deal
  FROM public.deals
  WHERE id = _deal_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF NOT public.can_write_deal(auth.uid(), _deal_id)
     AND NOT public.is_platform_admin(auth.uid())
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_template
  FROM public.checklist_templates
  WHERE id = _template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  IF NOT public.is_org_member(auth.uid(), v_template.org_id)
     AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.closing_checklist_items
  WHERE deal_id = _deal_id
    AND source = 'template';

  WITH eligible_items AS (
    SELECT *
    FROM public.checklist_template_items item
    WHERE item.template_id = _template_id
      AND public.template_rule_matches(item.auto_apply_if, v_deal.deal_type, v_deal.deal_value)
      AND NOT public.template_rule_matches(item.auto_exclude_if, v_deal.deal_type, v_deal.deal_value)
  ), inserted_parents AS (
    INSERT INTO public.closing_checklist_items (
      deal_id,
      parent_id,
      title,
      description,
      category,
      sort_order,
      source,
      status,
      template_item_id,
      template_version
    )
    SELECT
      _deal_id,
      NULL,
      item.title,
      item.description,
      'Legal',
      item.sort_order,
      'template',
      'pending',
      item.id,
      v_template.version
    FROM eligible_items item
    WHERE item.parent_id IS NULL
    ORDER BY item.sort_order
    RETURNING id, template_item_id
  )
  INSERT INTO public.closing_checklist_items (
    deal_id,
    parent_id,
    title,
    description,
    category,
    sort_order,
    source,
    status,
    template_item_id,
    template_version
  )
  SELECT
    _deal_id,
    parents.id,
    child.title,
    child.description,
    'Legal',
    child.sort_order,
    'template',
    'pending',
    child.id,
    v_template.version
  FROM eligible_items child
  JOIN inserted_parents parents ON parents.template_item_id = child.parent_id
  WHERE child.parent_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.deals
  SET template_id = _template_id,
      template_version = v_template.version,
      updated_at = now()
  WHERE id = _deal_id;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_checklist_template_analytics(_template_id uuid)
RETURNS TABLE(
  deals_using_template bigint,
  most_commonly_added jsonb,
  most_commonly_deleted jsonb,
  avg_completion_rate_with_template numeric,
  avg_completion_rate_without_template numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH template_deals AS (
    SELECT d.id
    FROM public.deals d
    WHERE d.template_id = _template_id
      AND d.deleted_at IS NULL
  ),
  added_items AS (
    SELECT jsonb_agg(jsonb_build_object('title', title, 'count', item_count) ORDER BY item_count DESC) AS payload
    FROM (
      SELECT c.title, COUNT(*) AS item_count
      FROM public.closing_checklist_items c
      WHERE c.deal_id IN (SELECT id FROM template_deals)
        AND c.was_added_post_template = true
      GROUP BY c.title
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) ranked
  ),
  deleted_items AS (
    SELECT jsonb_agg(jsonb_build_object('title', title, 'count', item_count) ORDER BY item_count DESC) AS payload
    FROM (
      SELECT c.title, COUNT(*) AS item_count
      FROM public.closing_checklist_items c
      WHERE c.deal_id IN (SELECT id FROM template_deals)
        AND c.deleted_from_template = true
      GROUP BY c.title
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) ranked
  ),
  completion_with AS (
    SELECT AVG(completed_ratio) AS avg_ratio
    FROM (
      SELECT c.deal_id,
             COUNT(*) FILTER (WHERE c.status = 'satisfied')::numeric / NULLIF(COUNT(*), 0) AS completed_ratio
      FROM public.closing_checklist_items c
      WHERE c.deal_id IN (SELECT id FROM template_deals)
      GROUP BY c.deal_id
    ) s
  ),
  completion_without AS (
    SELECT AVG(completed_ratio) AS avg_ratio
    FROM (
      SELECT c.deal_id,
             COUNT(*) FILTER (WHERE c.status = 'satisfied')::numeric / NULLIF(COUNT(*), 0) AS completed_ratio
      FROM public.closing_checklist_items c
      JOIN public.deals d ON d.id = c.deal_id
      WHERE d.template_id IS NULL
        AND d.deleted_at IS NULL
      GROUP BY c.deal_id
    ) s
  )
  SELECT
    (SELECT COUNT(*) FROM template_deals),
    COALESCE((SELECT payload FROM added_items), '[]'::jsonb),
    COALESCE((SELECT payload FROM deleted_items), '[]'::jsonb),
    COALESCE((SELECT round(avg_ratio * 100, 1) FROM completion_with), 0),
    COALESCE((SELECT round(avg_ratio * 100, 1) FROM completion_without), 0)
$$;

CREATE POLICY "Organization members can view checklist templates"
ON public.checklist_templates
FOR SELECT
TO authenticated
USING (
  public.is_org_member(auth.uid(), org_id)
  OR public.is_platform_admin(auth.uid())
);

CREATE POLICY "Organization editors can create checklist templates"
ON public.checklist_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_org_templates(auth.uid(), org_id)
  AND created_by = auth.uid()
);

CREATE POLICY "Organization editors can update checklist templates"
ON public.checklist_templates
FOR UPDATE
TO authenticated
USING (
  public.can_manage_org_templates(auth.uid(), org_id)
)
WITH CHECK (
  public.can_manage_org_templates(auth.uid(), org_id)
);

CREATE POLICY "Organization editors can delete checklist templates"
ON public.checklist_templates
FOR DELETE
TO authenticated
USING (
  public.can_manage_org_templates(auth.uid(), org_id)
);

CREATE POLICY "Organization members can view checklist template items"
ON public.checklist_template_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND (public.is_org_member(auth.uid(), t.org_id) OR public.is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "Organization editors can create checklist template items"
ON public.checklist_template_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND public.can_manage_org_templates(auth.uid(), t.org_id)
  )
);

CREATE POLICY "Organization editors can update checklist template items"
ON public.checklist_template_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND public.can_manage_org_templates(auth.uid(), t.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND public.can_manage_org_templates(auth.uid(), t.org_id)
  )
);

CREATE POLICY "Organization editors can delete checklist template items"
ON public.checklist_template_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND public.can_manage_org_templates(auth.uid(), t.org_id)
  )
);

CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_template_items_updated_at
BEFORE UPDATE ON public.checklist_template_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();