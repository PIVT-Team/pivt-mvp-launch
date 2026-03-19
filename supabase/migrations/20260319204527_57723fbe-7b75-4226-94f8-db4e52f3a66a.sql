
-- Create is_platform_admin helper function using text cast to avoid enum transaction issue
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'super_admin', 'ops_admin', 'support_admin', 'read_only')
  )
$$;

-- Create contact_submissions table for support inbox
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'normal',
  category text NOT NULL DEFAULT 'other',
  assignee text,
  internal_notes text,
  tags text[] DEFAULT '{}',
  source text NOT NULL DEFAULT 'contact_page',
  related_user_id uuid,
  related_deal_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_submissions" ON public.contact_submissions
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "service_insert_submissions" ON public.contact_submissions
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "service_select_submissions" ON public.contact_submissions
  FOR SELECT TO service_role
  USING (true);

-- Create admin_insights table
CREATE TABLE IF NOT EXISTS public.admin_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL DEFAULT 'daily',
  title text NOT NULL,
  body text NOT NULL,
  evidence text,
  suggested_action text,
  severity text NOT NULL DEFAULT 'opportunity',
  confidence numeric DEFAULT 0.8,
  category text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_insights_select" ON public.admin_insights
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "admin_insights_update" ON public.admin_insights
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "service_insights_all" ON public.admin_insights
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
