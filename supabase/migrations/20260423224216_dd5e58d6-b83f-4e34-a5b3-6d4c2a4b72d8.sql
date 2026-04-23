-- Add Signature Packet metadata to deal_approvals (extends existing eSignature workflow)
ALTER TABLE public.deal_approvals
  ADD COLUMN IF NOT EXISTS packet_name text,
  ADD COLUMN IF NOT EXISTS packet_type text,
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_checklist_item_id uuid REFERENCES public.closing_checklist_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_condition_id uuid REFERENCES public.conditions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric;

CREATE INDEX IF NOT EXISTS idx_deal_approvals_packet_deal ON public.deal_approvals(deal_id) WHERE packet_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_approvals_envelope ON public.deal_approvals(envelope_id) WHERE envelope_id IS NOT NULL;

-- Trigger: when a packet's approval becomes 'completed', auto-mark linked checklist item & condition
CREATE OR REPLACE FUNCTION public.sync_signature_packet_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    IF NEW.linked_checklist_item_id IS NOT NULL THEN
      UPDATE public.closing_checklist_items
      SET status = 'satisfied',
          satisfied_at = COALESCE(satisfied_at, now()),
          satisfied_by = COALESCE(satisfied_by, NEW.user_id),
          updated_at = now()
      WHERE id = NEW.linked_checklist_item_id
        AND status NOT IN ('satisfied', 'waived');
    END IF;

    IF NEW.linked_condition_id IS NOT NULL THEN
      UPDATE public.conditions
      SET status = 'satisfied',
          satisfied_at = COALESCE(satisfied_at, now()),
          satisfied_by = COALESCE(satisfied_by, NEW.user_id),
          updated_at = now()
      WHERE id = NEW.linked_condition_id
        AND status <> 'satisfied';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_signature_packet_completion ON public.deal_approvals;
CREATE TRIGGER trg_sync_signature_packet_completion
AFTER UPDATE OF status ON public.deal_approvals
FOR EACH ROW
EXECUTE FUNCTION public.sync_signature_packet_completion();