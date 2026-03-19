
-- Auth events table for tracking all authentication activity
CREATE TABLE public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  email text,
  login_method text DEFAULT 'password',
  device_type text,
  browser text,
  ip_hash text,
  approximate_location text,
  user_agent text,
  session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all auth events
CREATE POLICY "admin_select_auth_events" ON public.auth_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Authenticated users can insert their own events
CREATE POLICY "users_insert_own_auth_events" ON public.auth_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anonymous inserts for failed login tracking (no user_id)
CREATE POLICY "anon_insert_auth_events" ON public.auth_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND event_type = 'failed_login_attempt');

-- Service role full access
CREATE POLICY "service_all_auth_events" ON public.auth_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for fast analytics queries
CREATE INDEX idx_auth_events_created_at ON public.auth_events (created_at DESC);
CREATE INDEX idx_auth_events_user_id ON public.auth_events (user_id);
CREATE INDEX idx_auth_events_event_type ON public.auth_events (event_type);
