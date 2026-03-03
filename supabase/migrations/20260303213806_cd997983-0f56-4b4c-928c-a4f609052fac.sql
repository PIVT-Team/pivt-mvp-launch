
-- 1. Deal-level execution role enum
CREATE TYPE public.deal_execution_role AS ENUM ('VIEWER', 'EDITOR', 'APPROVER', 'EXECUTOR');

-- 2. Deal user roles table
CREATE TABLE public.deal_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role deal_execution_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (deal_id, user_id, role)
);

ALTER TABLE public.deal_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deal_user_roles"
  ON public.deal_user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants view deal_user_roles"
  ON public.deal_user_roles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = deal_user_roles.deal_id AND dp.user_id = auth.uid()
  ));

-- 3. Deal settings table for execution authority config
CREATE TABLE public.deal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  enforce_separation_of_duties BOOLEAN NOT NULL DEFAULT true,
  require_dual_execution BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deal_settings"
  ON public.deal_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants view deal_settings"
  ON public.deal_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = deal_settings.deal_id AND dp.user_id = auth.uid()
  ));

-- 4. Execution events audit table
CREATE TABLE public.execution_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  intent_id UUID NOT NULL REFERENCES public.disbursement_intents(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  performed_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage execution_events"
  ON public.execution_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants view execution_events"
  ON public.execution_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = execution_events.deal_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Executors insert execution_events"
  ON public.execution_events FOR INSERT
  WITH CHECK (auth.uid() = performed_by_user_id);

-- 5. Security definer function for checking deal-level roles
CREATE OR REPLACE FUNCTION public.has_deal_role(_user_id UUID, _deal_id UUID, _role deal_execution_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deal_user_roles
    WHERE user_id = _user_id AND deal_id = _deal_id AND role = _role
  )
$$;

-- 6. Trigger for deal_settings updated_at
CREATE TRIGGER update_deal_settings_updated_at
  BEFORE UPDATE ON public.deal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
