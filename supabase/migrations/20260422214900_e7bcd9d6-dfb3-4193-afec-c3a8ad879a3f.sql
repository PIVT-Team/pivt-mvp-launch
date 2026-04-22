CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMENT ON TABLE public.deal_events IS 'Canonical deal event log. Hash-chain columns only apply to events inserted after the audit-chain migration; existing historical rows are intentionally not backfilled.';

ALTER TABLE public.deal_events
  ADD COLUMN IF NOT EXISTS event_hash text,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS chain_sequence bigint;

COMMENT ON COLUMN public.deal_events.event_hash IS 'SHA-256 hash of this event row for tamper detection. Only populated for events created after the audit-chain migration.';
COMMENT ON COLUMN public.deal_events.prev_hash IS 'SHA-256 hash of the previous chained event for the same deal, or GENESIS for the first chained event after the audit-chain migration.';
COMMENT ON COLUMN public.deal_events.chain_sequence IS 'Per-deal monotonically increasing sequence for chained events created after the audit-chain migration.';

CREATE OR REPLACE FUNCTION public.compute_event_hash(event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event public.deal_events%ROWTYPE;
  v_input text;
BEGIN
  SELECT *
  INTO v_event
  FROM public.deal_events
  WHERE id = event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal_events row % not found', event_id;
  END IF;

  v_input := concat_ws(
    '|',
    COALESCE(v_event.deal_id::text, ''),
    COALESCE(v_event.event_type, ''),
    COALESCE(v_event.actor_id::text, ''),
    COALESCE(v_event.payload::text, '{}'),
    COALESCE(v_event.created_at::text, ''),
    COALESCE(v_event.prev_hash, 'GENESIS')
  );

  RETURN encode(digest(v_input, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev_hash text;
  v_prev_sequence bigint;
BEGIN
  /*
    Start the chain fresh from the first event inserted after this migration.
    Historical deal_events rows intentionally remain unhashed and are not backfilled.
  */
  SELECT de.event_hash, de.chain_sequence
  INTO v_prev_hash, v_prev_sequence
  FROM public.deal_events de
  WHERE de.deal_id = NEW.deal_id
    AND de.id <> NEW.id
    AND de.chain_sequence IS NOT NULL
  ORDER BY de.chain_sequence DESC
  LIMIT 1;

  UPDATE public.deal_events
  SET
    prev_hash = COALESCE(v_prev_hash, 'GENESIS'),
    chain_sequence = COALESCE(v_prev_sequence, 0) + 1
  WHERE id = NEW.id;

  UPDATE public.deal_events
  SET event_hash = public.compute_event_hash(NEW.id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_audit_event ON public.deal_events;

CREATE TRIGGER trg_hash_audit_event
AFTER INSERT ON public.deal_events
FOR EACH ROW
EXECUTE FUNCTION public.hash_audit_event();