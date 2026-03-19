
-- Admin allowlist table (tracks approved admin emails)
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  added_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read
CREATE POLICY "allowlist_select" ON public.admin_allowlist
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Only super_admins can manage
CREATE POLICY "allowlist_manage" ON public.admin_allowlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "audit_log_insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Server-side allowlist check function
CREATE OR REPLACE FUNCTION public.is_approved_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_allowlist al
    JOIN auth.users au ON lower(au.email) = lower(al.email)
    WHERE au.id = _user_id
      AND al.is_active = true
  )
$$;

-- Update is_platform_admin to also require allowlist membership
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'super_admin', 'ops_admin', 'support_admin', 'read_only')
  ) AND EXISTS (
    SELECT 1 FROM public.admin_allowlist al
    JOIN auth.users au ON lower(au.email) = lower(al.email)
    WHERE au.id = _user_id AND al.is_active = true
  )
$$;

-- Seed joanna as super_admin
INSERT INTO public.admin_allowlist (email, role, added_by)
VALUES ('joanna@pivttech.ai', 'super_admin', 'system')
ON CONFLICT (email) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_email ON public.admin_allowlist (lower(email));
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
