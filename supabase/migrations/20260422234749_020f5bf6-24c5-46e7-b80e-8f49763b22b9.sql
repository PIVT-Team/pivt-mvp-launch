CREATE OR REPLACE FUNCTION public.can_access_intelligence(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin(_user_id)
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'intelligence');
$$;

CREATE OR REPLACE FUNCTION public.get_deal_benchmark_panel(_deal_id uuid)
RETURNS TABLE (
  deal_id uuid,
  deal_type text,
  current_days_since_signing integer,
  benchmark_days_since_signing numeric,
  current_conditions_satisfied_pct numeric,
  benchmark_conditions_satisfied_pct numeric,
  current_open_discrepancies integer,
  benchmark_open_discrepancies numeric,
  benchmark_sample_size integer,
  has_minimum_group boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_deal(v_user_id, _deal_id)
     AND NOT public.is_deal_accessible(v_user_id, _deal_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH current_deal AS (
    SELECT d.id, d.deal_type, d.signing_date
    FROM public.deals d
    WHERE d.id = _deal_id
      AND d.deleted_at IS NULL
  ),
  current_conditions AS (
    SELECT
      c.deal_id,
      COUNT(*) FILTER (WHERE c.status = 'satisfied')::numeric AS satisfied_count,
      COUNT(*)::numeric AS total_count
    FROM public.conditions c
    WHERE c.deal_id = _deal_id
    GROUP BY c.deal_id
  ),
  current_discrepancies AS (
    SELECT
      d.deal_id,
      COUNT(*) FILTER (WHERE d.status NOT IN ('resolved', 'waived'))::integer AS open_count
    FROM public.discrepancies d
    WHERE d.deal_id = _deal_id
    GROUP BY d.deal_id
  ),
  comparable_closed_deals AS (
    SELECT d.id, d.deal_type, d.signing_date, d.closing_date
    FROM public.deals d
    JOIN current_deal cd ON cd.deal_type = d.deal_type
    WHERE d.deleted_at IS NULL
      AND d.id <> _deal_id
      AND d.deal_type IS NOT NULL
      AND d.status = 'closed'
      AND d.signing_date IS NOT NULL
      AND d.closing_date IS NOT NULL
  ),
  comparable_metrics AS (
    SELECT
      d.id,
      (d.closing_date::date - d.signing_date::date)::numeric AS days_since_signing,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE c.status = 'satisfied')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
        FROM public.conditions c
        WHERE c.deal_id = d.id
      ), 0) AS conditions_satisfied_pct,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE x.status NOT IN ('resolved', 'waived'))::numeric
        FROM public.discrepancies x
        WHERE x.deal_id = d.id
      ), 0) AS open_discrepancies
    FROM comparable_closed_deals d
  ),
  aggregates AS (
    SELECT
      COUNT(*)::integer AS sample_size,
      AVG(days_since_signing) AS avg_days_since_signing,
      AVG(conditions_satisfied_pct) AS avg_conditions_satisfied_pct,
      AVG(open_discrepancies) AS avg_open_discrepancies
    FROM comparable_metrics
  )
  SELECT
    cd.id,
    cd.deal_type,
    CASE
      WHEN cd.signing_date IS NULL THEN NULL
      ELSE (CURRENT_DATE - cd.signing_date::date)::integer
    END AS current_days_since_signing,
    CASE WHEN a.sample_size >= 5 THEN ROUND(a.avg_days_since_signing, 1) ELSE NULL END,
    COALESCE(ROUND((cc.satisfied_count / NULLIF(cc.total_count, 0)) * 100, 1), 0),
    CASE WHEN a.sample_size >= 5 THEN ROUND(a.avg_conditions_satisfied_pct, 1) ELSE NULL END,
    COALESCE(cd2.open_count, 0),
    CASE WHEN a.sample_size >= 5 THEN ROUND(a.avg_open_discrepancies, 1) ELSE NULL END,
    a.sample_size,
    (a.sample_size >= 5)
  FROM current_deal cd
  LEFT JOIN current_conditions cc ON cc.deal_id = cd.id
  LEFT JOIN current_discrepancies cd2 ON cd2.deal_id = cd.id
  CROSS JOIN aggregates a;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_condition_precedent_benchmarks(_deal_id uuid)
RETURNS TABLE (
  cp_type text,
  average_days_to_satisfaction numeric,
  current_days_outstanding integer,
  status_indicator text,
  benchmark_sample_size integer,
  has_minimum_group boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_access_deal(v_user_id, _deal_id)
     AND NOT public.is_deal_accessible(v_user_id, _deal_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH outstanding_cp AS (
    SELECT
      c.title AS cp_type,
      c.created_at,
      c.status
    FROM public.conditions c
    WHERE c.deal_id = _deal_id
      AND c.status <> 'satisfied'
  ),
  historical_cp AS (
    SELECT
      hc.title AS cp_type,
      COUNT(*) FILTER (WHERE hc.status = 'satisfied')::integer AS sample_size,
      AVG(
        CASE
          WHEN hc.status = 'satisfied' THEN EXTRACT(EPOCH FROM (hc.updated_at - hc.created_at)) / 86400.0
          ELSE NULL
        END
      ) AS avg_days_to_satisfaction
    FROM public.conditions hc
    JOIN public.deals d ON d.id = hc.deal_id
    WHERE d.deleted_at IS NULL
      AND d.status = 'closed'
    GROUP BY hc.title
  )
  SELECT
    oc.cp_type,
    CASE WHEN hc.sample_size >= 5 THEN ROUND(hc.avg_days_to_satisfaction, 1) ELSE NULL END,
    (CURRENT_DATE - oc.created_at::date)::integer AS current_days_outstanding,
    CASE
      WHEN hc.sample_size < 5 THEN 'insufficient-data'
      WHEN (CURRENT_DATE - oc.created_at::date) <= COALESCE(hc.avg_days_to_satisfaction, 0) THEN 'on-track'
      ELSE 'delayed'
    END AS status_indicator,
    COALESCE(hc.sample_size, 0) AS benchmark_sample_size,
    (COALESCE(hc.sample_size, 0) >= 5) AS has_minimum_group
  FROM outstanding_cp oc
  LEFT JOIN historical_cp hc ON hc.cp_type = oc.cp_type
  ORDER BY oc.cp_type;
END;
$$;