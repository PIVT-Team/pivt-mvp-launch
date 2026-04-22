CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_closing_checklist_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'satisfied', 'waived', 'not_applicable') THEN
    RAISE EXCEPTION 'Invalid checklist status: %', NEW.status;
  END IF;

  IF NEW.source NOT IN ('template', 'manual', 'ai_generated') THEN
    RAISE EXCEPTION 'Invalid checklist source: %', NEW.source;
  END IF;

  IF NEW.category NOT IN ('Legal', 'Financial', 'Regulatory', 'Technical') THEN
    RAISE EXCEPTION 'Invalid checklist category: %', NEW.category;
  END IF;

  IF NEW.status = 'waived' AND coalesce(btrim(NEW.waiver_justification), '') = '' THEN
    RAISE EXCEPTION 'Waived checklist items require a waiver justification';
  END IF;

  IF NEW.status <> 'waived' THEN
    NEW.waiver_justification = NULL;
  END IF;

  IF NEW.status = 'satisfied' AND NEW.satisfied_at IS NULL THEN
    NEW.satisfied_at = now();
  END IF;

  IF NEW.status <> 'satisfied' THEN
    NEW.satisfied_at = NULL;
    NEW.satisfied_by = NULL;
    NEW.supporting_document_id = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.closing_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  parent_id uuid NULL REFERENCES public.closing_checklist_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'pending',
  category text NOT NULL DEFAULT 'Legal',
  responsible_party_id uuid NULL,
  entity_id uuid NULL REFERENCES public.entities(id) ON DELETE SET NULL,
  supporting_document_id uuid NULL REFERENCES public.deal_documents(id) ON DELETE SET NULL,
  satisfied_by uuid NULL,
  satisfied_at timestamptz NULL,
  waiver_justification text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'closing_checklist_items_responsible_party_id_fkey'
      AND conrelid = 'public.closing_checklist_items'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'deal_memberships'
    ) THEN
      EXECUTE 'ALTER TABLE public.closing_checklist_items ADD CONSTRAINT closing_checklist_items_responsible_party_id_fkey FOREIGN KEY (responsible_party_id) REFERENCES public.deal_memberships(id) ON DELETE SET NULL';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'deal_members'
    ) THEN
      EXECUTE 'ALTER TABLE public.closing_checklist_items ADD CONSTRAINT closing_checklist_items_responsible_party_id_fkey FOREIGN KEY (responsible_party_id) REFERENCES public.deal_members(id) ON DELETE SET NULL';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_deal_id ON public.closing_checklist_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_parent_id ON public.closing_checklist_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_deal_sort ON public.closing_checklist_items(deal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_deal_status ON public.closing_checklist_items(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_deal_category ON public.closing_checklist_items(deal_id, category);
CREATE INDEX IF NOT EXISTS idx_closing_checklist_items_entity_id ON public.closing_checklist_items(entity_id);

DROP TRIGGER IF EXISTS validate_closing_checklist_item_trigger ON public.closing_checklist_items;
CREATE TRIGGER validate_closing_checklist_item_trigger
BEFORE INSERT OR UPDATE ON public.closing_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_closing_checklist_item();

DROP TRIGGER IF EXISTS update_closing_checklist_items_updated_at ON public.closing_checklist_items;
CREATE TRIGGER update_closing_checklist_items_updated_at
BEFORE UPDATE ON public.closing_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.closing_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Checklist items viewable by deal participants" ON public.closing_checklist_items;
CREATE POLICY "Checklist items viewable by deal participants"
ON public.closing_checklist_items
FOR SELECT
TO authenticated
USING (can_access_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS "Checklist items creatable by deal editors" ON public.closing_checklist_items;
CREATE POLICY "Checklist items creatable by deal editors"
ON public.closing_checklist_items
FOR INSERT
TO authenticated
WITH CHECK (can_write_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS "Checklist items editable by deal editors" ON public.closing_checklist_items;
CREATE POLICY "Checklist items editable by deal editors"
ON public.closing_checklist_items
FOR UPDATE
TO authenticated
USING (can_write_deal(auth.uid(), deal_id))
WITH CHECK (can_write_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS "Checklist items removable by deal editors" ON public.closing_checklist_items;
CREATE POLICY "Checklist items removable by deal editors"
ON public.closing_checklist_items
FOR DELETE
TO authenticated
USING (can_write_deal(auth.uid(), deal_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'closing_checklist_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.closing_checklist_items;
  END IF;
END $$;