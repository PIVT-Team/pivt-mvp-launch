ALTER TABLE public.admin_insights 
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS priority_rank integer,
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS target_org text;

CREATE INDEX IF NOT EXISTS idx_admin_insights_type_date ON public.admin_insights (insight_type, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_insights_status ON public.admin_insights (review_status);
CREATE INDEX IF NOT EXISTS idx_admin_insights_severity ON public.admin_insights (severity, generated_at DESC);