
-- Agent runs table for tracking AI agent executions
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  agent_type text NOT NULL DEFAULT 'funds_flow_validation',
  agent_version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'queued',
  triggered_by uuid,
  input_snapshot jsonb DEFAULT '{}'::jsonb,
  findings jsonb DEFAULT '[]'::jsonb,
  finding_count integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  summary_text text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_runs_deal_id ON public.agent_runs(deal_id);
CREATE INDEX idx_agent_runs_agent_type ON public.agent_runs(agent_type);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);

-- RLS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_select" ON public.agent_runs
  FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));

CREATE POLICY "agent_runs_insert" ON public.agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));

CREATE POLICY "agent_runs_update" ON public.agent_runs
  FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));

-- Service role full access for edge functions
CREATE POLICY "agent_runs_service_all" ON public.agent_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
