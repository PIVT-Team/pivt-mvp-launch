CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid REFERENCES public.entities(id),
  entity_type text NOT NULL,
  canonical_name text NOT NULL,
  name_variants text[] DEFAULT ARRAY[]::text[],
  source_deal_id uuid REFERENCES public.deals(id),
  confidence double precision,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entities_entity_type_check CHECK (
    entity_type IN ('organization', 'person', 'instrument', 'bank_account', 'regulatory_body')
  ),
  CONSTRAINT entities_created_by_source_check CHECK (
    created_by_source IS NULL OR created_by_source IN ('ai_extraction', 'human_verified', 'imported')
  ),
  CONSTRAINT entities_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT entities_canonical_not_self_check CHECK (
    canonical_id IS NULL OR canonical_id <> id
  )
);

CREATE TABLE public.relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id),
  entity_from_id uuid NOT NULL REFERENCES public.entities(id),
  entity_to_id uuid NOT NULL REFERENCES public.entities(id),
  relationship_type text NOT NULL,
  provenance text,
  confidence double precision,
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relationships_type_check CHECK (
    relationship_type IN (
      'controls',
      'beneficially_owns',
      'signs_for',
      'pays_to',
      'acts_as_escrow',
      'acts_as_counsel',
      'acts_as_advisor',
      'is_counterparty_to'
    )
  ),
  CONSTRAINT relationships_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT relationships_not_self_check CHECK (
    entity_from_id <> entity_to_id
  )
);

CREATE TABLE public.entity_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_entity_id uuid NOT NULL REFERENCES public.entities(id),
  canonical_entity_id uuid NOT NULL REFERENCES public.entities(id),
  resolution_method text,
  confidence double precision,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id),
  CONSTRAINT entity_resolution_method_check CHECK (
    resolution_method IS NULL OR resolution_method IN ('automatic_name_match', 'human_confirmed', 'fuzzy_match')
  ),
  CONSTRAINT entity_resolution_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT entity_resolution_not_self_check CHECK (
    variant_entity_id <> canonical_entity_id
  ),
  CONSTRAINT entity_resolution_unique_pair UNIQUE (variant_entity_id, canonical_entity_id)
);

CREATE INDEX idx_entities_entity_type ON public.entities(entity_type);
CREATE INDEX idx_entities_canonical_id ON public.entities(canonical_id);
CREATE INDEX idx_entities_source_deal_id ON public.entities(source_deal_id);
CREATE INDEX idx_entities_name_variants_gin ON public.entities USING gin(name_variants);
CREATE INDEX idx_entities_canonical_name_trgm ON public.entities USING gin (canonical_name gin_trgm_ops);

CREATE INDEX idx_relationships_deal_from ON public.relationships(deal_id, entity_from_id);
CREATE INDEX idx_relationships_deal_to ON public.relationships(deal_id, entity_to_id);
CREATE INDEX idx_relationships_type ON public.relationships(relationship_type);

CREATE INDEX idx_entity_resolution_variant ON public.entity_resolution(variant_entity_id);
CREATE INDEX idx_entity_resolution_canonical ON public.entity_resolution(canonical_entity_id);

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_resolution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all entities"
ON public.entities
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can read accessible relationships"
ON public.relationships
FOR SELECT
TO authenticated
USING (public.is_deal_accessible(auth.uid(), deal_id));

CREATE POLICY "Authenticated users can read all entity resolutions"
ON public.entity_resolution
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can create entity resolutions"
ON public.entity_resolution
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can update entity resolutions"
ON public.entity_resolution
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can delete entity resolutions"
ON public.entity_resolution
FOR DELETE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE VIEW public.deal_entity_graph
WITH (security_invoker = true)
AS
SELECT
  r.deal_id,
  r.id AS relationship_id,
  r.relationship_type,
  r.provenance,
  r.confidence AS relationship_confidence,
  r.effective_date,
  r.created_at AS relationship_created_at,
  ef.id AS entity_from_id,
  ef.entity_type AS entity_from_type,
  ef.canonical_name AS entity_from_name,
  ef.name_variants AS entity_from_variants,
  ef.metadata AS entity_from_metadata,
  COALESCE(erf.canonical_entity_id, ef.canonical_id, ef.id) AS entity_from_canonical_id,
  COALESCE(cef.canonical_name, cdf.canonical_name, ef.canonical_name) AS entity_from_canonical_name,
  et.id AS entity_to_id,
  et.entity_type AS entity_to_type,
  et.canonical_name AS entity_to_name,
  et.name_variants AS entity_to_variants,
  et.metadata AS entity_to_metadata,
  COALESCE(ert.canonical_entity_id, et.canonical_id, et.id) AS entity_to_canonical_id,
  COALESCE(cet.canonical_name, cdt.canonical_name, et.canonical_name) AS entity_to_canonical_name
FROM public.relationships r
JOIN public.entities ef ON ef.id = r.entity_from_id
JOIN public.entities et ON et.id = r.entity_to_id
LEFT JOIN public.entity_resolution erf ON erf.variant_entity_id = ef.id
LEFT JOIN public.entities cef ON cef.id = erf.canonical_entity_id
LEFT JOIN public.entities cdf ON cdf.id = ef.canonical_id
LEFT JOIN public.entity_resolution ert ON ert.variant_entity_id = et.id
LEFT JOIN public.entities cet ON cet.id = ert.canonical_entity_id
LEFT JOIN public.entities cdt ON cdt.id = et.canonical_id;

GRANT SELECT ON public.deal_entity_graph TO authenticated;

CREATE OR REPLACE FUNCTION public.search_entities(search_term text, entity_type text DEFAULT NULL)
RETURNS TABLE (
  entity_id uuid,
  canonical_id uuid,
  entity_type text,
  canonical_name text,
  matched_name text,
  similarity_score real,
  source_deal_id uuid,
  metadata jsonb,
  created_by_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidate_names AS (
    SELECT
      e.id AS entity_id,
      COALESCE(e.canonical_id, e.id) AS canonical_id,
      e.entity_type,
      e.canonical_name,
      e.source_deal_id,
      e.metadata,
      e.created_by_source,
      e.canonical_name AS matched_name,
      similarity(lower(e.canonical_name), lower(search_term)) AS similarity_score
    FROM public.entities e
    WHERE search_term IS NOT NULL
      AND btrim(search_term) <> ''
      AND (entity_type IS NULL OR e.entity_type = entity_type)

    UNION ALL

    SELECT
      e.id AS entity_id,
      COALESCE(e.canonical_id, e.id) AS canonical_id,
      e.entity_type,
      e.canonical_name,
      e.source_deal_id,
      e.metadata,
      e.created_by_source,
      variant_name AS matched_name,
      similarity(lower(variant_name), lower(search_term)) AS similarity_score
    FROM public.entities e
    CROSS JOIN LATERAL unnest(COALESCE(e.name_variants, ARRAY[]::text[])) AS variant_name
    WHERE search_term IS NOT NULL
      AND btrim(search_term) <> ''
      AND (entity_type IS NULL OR e.entity_type = entity_type)
  ), ranked_matches AS (
    SELECT
      candidate_names.*,
      row_number() OVER (
        PARTITION BY candidate_names.entity_id
        ORDER BY candidate_names.similarity_score DESC, candidate_names.matched_name
      ) AS rn
    FROM candidate_names
    WHERE candidate_names.similarity_score > 0.1
  )
  SELECT
    ranked_matches.entity_id,
    ranked_matches.canonical_id,
    ranked_matches.entity_type,
    ranked_matches.canonical_name,
    ranked_matches.matched_name,
    ranked_matches.similarity_score,
    ranked_matches.source_deal_id,
    ranked_matches.metadata,
    ranked_matches.created_by_source
  FROM ranked_matches
  WHERE ranked_matches.rn = 1
  ORDER BY ranked_matches.similarity_score DESC, ranked_matches.canonical_name ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_entities(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_entities(text, text) TO authenticated;