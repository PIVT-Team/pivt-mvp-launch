CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

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
SET search_path = public, extensions
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