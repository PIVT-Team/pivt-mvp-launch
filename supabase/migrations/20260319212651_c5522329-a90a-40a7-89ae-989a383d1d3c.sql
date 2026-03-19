CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_category text NOT NULL DEFAULT 'general',
  metadata jsonb DEFAULT '{}'::jsonb,
  page_path text,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_user_time ON public.user_activity_events (user_id, created_at DESC);
CREATE INDEX idx_user_activity_type ON public.user_activity_events (event_type, created_at DESC);
CREATE INDEX idx_user_activity_session ON public.user_activity_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_user_activity_category ON public.user_activity_events (event_category, created_at DESC);

ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity"
  ON public.user_activity_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all activity"
  ON public.user_activity_events FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Service role full access"
  ON public.user_activity_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);