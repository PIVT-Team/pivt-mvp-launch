
-- 1. Create deal_state enum
CREATE TYPE public.deal_state AS ENUM (
  'draft',
  'verification_pending',
  'structuring',
  'conditions_pending',
  'ready_for_execution',
  'executing',
  'settled',
  'archived'
);

-- 2. Add state columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_state public.deal_state NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS state_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- 3. Create deal_events table
CREATE TABLE public.deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_state TEXT,
  new_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Index for fast lookups
CREATE INDEX idx_deal_events_deal_id ON public.deal_events(deal_id);
CREATE INDEX idx_deal_events_created_at ON public.deal_events(created_at DESC);

-- 5. RLS on deal_events
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_events_select" ON public.deal_events
  FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));

CREATE POLICY "deal_events_insert" ON public.deal_events
  FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));
