-- ═══════════════════════════════════════════════════════════════════════════
-- Remember what a user said a document was, separately from what the
-- classifier decided it is.
--
-- WHY THIS EXISTS
-- `contract_documents.doc_type` serves two masters. A user picks it in the
-- upload panel, and `document-ai` then overwrites it with its own
-- classification. The panel lists documents by `doc_type`, so anything the
-- model resolved differently — most contracts land on OTHER — dropped out of
-- the list moments after the user watched it upload and parse.
--
-- The interim fix remembered the ids in `localStorage`, which works for one
-- browser: a colleague opening the same deal sees a different list, and
-- clearing site data loses it. This stores the user's answer where it belongs.
--
-- A file someone uploaded must never disappear because a model disagreed about
-- its type.
--
-- SAFETY: additive. One nullable column and one index. Existing rows keep
-- NULL — their origin is genuinely unknown, and the client keeps its
-- localStorage fallback so those documents stay visible to whoever uploaded
-- them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS uploaded_as text;

COMMENT ON COLUMN public.contract_documents.uploaded_as IS
  'The document type the uploader chose, never overwritten by classification. doc_type holds what the classifier decided. Filter user-facing lists on this.';

-- The panel's query is "everything on this deal that was uploaded as one of
-- these types".
CREATE INDEX IF NOT EXISTS contract_documents_deal_uploaded_as_idx
  ON public.contract_documents (deal_id, uploaded_as);

-- Backfill what can be known honestly: rows never touched by the classifier
-- still carry the type their uploader chose.
UPDATE public.contract_documents
   SET uploaded_as = doc_type::text
 WHERE uploaded_as IS NULL
   AND status IN ('UPLOADED', 'PROCESSING');
