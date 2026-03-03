
-- Enums for ontology + discrepancy system
CREATE TYPE public.ontology_entity_type AS ENUM ('core_entity', 'workflow_entity', 'compliance_entity', 'computed_entity');
CREATE TYPE public.ontology_status AS ENUM ('draft', 'active', 'deprecated');
CREATE TYPE public.discrepancy_severity AS ENUM ('blocker', 'warn', 'info');
CREATE TYPE public.discrepancy_scope AS ENUM ('deal', 'intent', 'document', 'party');
CREATE TYPE public.discrepancy_status AS ENUM ('open', 'acknowledged', 'resolved', 'suppressed');

-- 1) ontology_terms
CREATE TABLE public.ontology_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  definition text NOT NULL,
  entity_type public.ontology_entity_type NOT NULL,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb,
  example text,
  version text NOT NULL DEFAULT 'v0',
  status public.ontology_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ontology_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ontology_terms"
  ON public.ontology_terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage ontology_terms"
  ON public.ontology_terms FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ontology_terms_updated_at
  BEFORE UPDATE ON public.ontology_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) discrepancy_rules
CREATE TABLE public.discrepancy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  severity public.discrepancy_severity NOT NULL DEFAULT 'warn',
  enabled boolean NOT NULL DEFAULT true,
  scope public.discrepancy_scope NOT NULL DEFAULT 'deal',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discrepancy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read discrepancy_rules"
  ON public.discrepancy_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage discrepancy_rules"
  ON public.discrepancy_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_discrepancy_rules_updated_at
  BEFORE UPDATE ON public.discrepancy_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) discrepancies
CREATE TABLE public.discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id uuid NOT NULL,
  rule_key text NOT NULL,
  severity public.discrepancy_severity NOT NULL,
  status public.discrepancy_status NOT NULL DEFAULT 'open',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view discrepancies"
  ON public.discrepancies FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = discrepancies.deal_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage discrepancies"
  ON public.discrepancies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role (edge function) needs insert/update - handled by service_role key
