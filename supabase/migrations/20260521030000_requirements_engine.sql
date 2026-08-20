-- ═══════════════════════════════════════════════════════════════════════════
-- Requirements Engine — the shared spine for signatures, consents, and
-- external document collection.
--
-- These three features are one pattern:
--   source document → AI extraction → structured requirement → HUMAN REVIEW
--   → request → tracking → evidence → verification → completion → readiness
--
-- Rather than a signature-packet generator plus a separate consent tool plus a
-- separate document-request tool, they share these three tables and differ only
-- by `requirement_kind` and which extractor created the row.
--
-- COLUMN VOCABULARY: deliberately mirrors `tx_conditions_precedent` from the
-- real-estate kernel (title/description/category/status/satisfied_at/
-- satisfied_by/evidence/source/source_ref/sort_order/deleted_at). The kernel's
-- own header states the intent to serve M&A "in a later shared-engine
-- extraction"; matching names now makes that a merge rather than a rewrite.
-- We cannot build ON tx_* because every tx_* table requires a
-- `transaction_id` referencing `re_transactions` — a property record with an
-- APN and a street address.
--
-- SAFETY: additive only. New tables and one new cron job. Nothing existing is
-- altered. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. deal_requirements — "something must happen before this deal can close"
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_requirements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  requirement_kind  text NOT NULL
                    CHECK (requirement_kind IN
                      ('signature','consent','notice','external_document','condition')),

  -- ── shared vocabulary with tx_conditions_precedent ──
  title             text NOT NULL,
  description       text,
  category          text NOT NULL DEFAULT 'other',

  -- Action lifecycle. Human review is tracked separately in review_status so
  -- that "has a lawyer approved this?" and "where is it in the process?" are
  -- never conflated — the guardrail every one of the three briefs insists on.
  status            text NOT NULL DEFAULT 'not_started'
                    CHECK (status IN (
                      'not_started','draft_ready','sent','viewed','responded',
                      'under_review','satisfied','waived','not_required','issue')),

  satisfied_at      timestamptz,
  satisfied_by      uuid,
  evidence_doc_id   uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,

  source            text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual','ai','newton','derived','template')),
  -- Clause traceability: {document_id, document_version, filename, snippet,
  -- page, clause_ref}. This is what makes an AI finding auditable.
  source_ref        jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order        integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz,

  -- ── who ──
  entity_id         uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  counterparty_name  text,
  counterparty_email text,
  internal_owner_id  uuid,

  -- ── signature-specific (null for other kinds) ──
  signing_party      text,   -- "BuyerCo"
  signatory_name     text,   -- "Jane Smith"
  signatory_capacity text,   -- "CEO"
  signature_pages    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── consent-specific (null for other kinds) ──
  trigger_event     text,    -- "Change of control"
  requirement_type  text CHECK (requirement_type IN ('consent','notice','unclear') OR requirement_type IS NULL),

  -- ── lifecycle ──
  due_date          date,
  blocks_closing    boolean NOT NULL DEFAULT false,
  priority          text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),

  -- ── the human-review gate ──
  --
  -- AI extraction is a proposed interpretation, never a legal determination.
  -- A requirement cannot be acted on externally until review_status='approved'.
  -- Enforced below by requirement_requests_require_review, not left to the UI.
  review_status     text NOT NULL DEFAULT 'pending_review'
                    CHECK (review_status IN ('pending_review','approved','rejected')),
  reviewed_by       uuid,
  reviewed_at       timestamptz,
  review_notes      text,
  ai_confidence     numeric,
  ai_ambiguity      text CHECK (ai_ambiguity IN ('low','medium','high') OR ai_ambiguity IS NULL),

  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_requirements_deal_idx
  ON public.deal_requirements (deal_id, requirement_kind, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deal_requirements_blocking_idx
  ON public.deal_requirements (deal_id) WHERE blocks_closing AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deal_requirements_review_idx
  ON public.deal_requirements (deal_id, review_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deal_requirements_owner_idx
  ON public.deal_requirements (internal_owner_id, due_date) WHERE deleted_at IS NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. requirement_requests — one outbound ask, with its own reminder cadence
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.requirement_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id   uuid NOT NULL REFERENCES public.deal_requirements(id) ON DELETE CASCADE,
  deal_id          uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  channel          text NOT NULL DEFAULT 'email'
                   CHECK (channel IN ('email','docusign','manual_export')),
  recipient_name   text,
  recipient_email  text NOT NULL,

  -- Same token pattern as verification_requests: store only the hash, hand the
  -- raw token to the recipient once. Lets an external party act without a
  -- PIVT account.
  token_hash       text,
  expires_at       timestamptz,

  -- Nothing leaves the building without a person approving it.
  approved_to_send boolean NOT NULL DEFAULT false,
  approved_by      uuid,
  approved_at      timestamptz,

  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','queued','sent','opened','responded','cancelled','expired')),
  sent_at          timestamptz,
  opened_at        timestamptz,
  responded_at     timestamptz,
  cancelled_at     timestamptz,

  -- ── reminder cadence ──
  -- Days between reminders, e.g. {3,3,2} → reminder 1 after 3 days, 2 after a
  -- further 3, 3 after a further 2, then escalate. Reminders were previously
  -- client-side only (Zustand + localStorage) and therefore fired only while
  -- somebody had a browser tab open.
  auto_remind        boolean NOT NULL DEFAULT true,
  reminder_cadence_days integer[] NOT NULL DEFAULT '{3,3,2}',
  reminder_count     integer NOT NULL DEFAULT 0,
  last_reminder_at   timestamptz,
  next_reminder_at   timestamptz,
  escalate_to        uuid,
  escalated_at       timestamptz,

  external_ref     text,   -- DocuSign envelope id, etc.
  last_error       text,

  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requirement_requests_due_idx
  ON public.requirement_requests (next_reminder_at)
  WHERE auto_remind AND status IN ('sent','opened');
CREATE INDEX IF NOT EXISTS requirement_requests_req_idx
  ON public.requirement_requests (requirement_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS requirement_requests_token_idx
  ON public.requirement_requests (token_hash) WHERE token_hash IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. requirement_evidence — what came back, and whether it satisfies the ask
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.requirement_evidence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    uuid NOT NULL REFERENCES public.deal_requirements(id) ON DELETE CASCADE,
  deal_id           uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  request_id        uuid REFERENCES public.requirement_requests(id) ON DELETE SET NULL,

  document_id       uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  storage_path      text,
  filename          text,
  submitted_by_email text,
  submitted_at      timestamptz NOT NULL DEFAULT now(),

  -- ── AI verification: does what arrived satisfy what was asked for? ──
  verification_verdict text NOT NULL DEFAULT 'not_run'
                       CHECK (verification_verdict IN
                         ('not_run','verified','review_required','rejected')),
  verification_confidence numeric,
  -- [{code, message, severity}] e.g. expired, entity name mismatch, unreadable
  verification_issues  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- extracted facts: entity, jurisdiction, licence number, expiry, issuer
  verification_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at          timestamptz,

  -- ── human override — always available, always wins ──
  human_decision    text CHECK (human_decision IN ('accepted','rejected') OR human_decision IS NULL),
  decided_by        uuid,
  decided_at        timestamptz,
  decision_notes    text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requirement_evidence_req_idx
  ON public.requirement_evidence (requirement_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS requirement_evidence_review_idx
  ON public.requirement_evidence (deal_id, verification_verdict)
  WHERE human_decision IS NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. Guardrail: no external contact without human approval
--
-- All three briefs state this as a hard rule ("Nothing should be sent
-- automatically based solely on AI"; "PIVT should never independently decide
-- that consent is legally required and contact a counterparty"). A UI check is
-- not a rule — Test 1 found dual-control approval enforced only client-side and
-- bypassable by a direct API call. This is enforced in the database.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_requirement_review_before_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_review text;
  req_title  text;
BEGIN
  -- Only guards the transition into an actually-sent state.
  IF NEW.status NOT IN ('queued','sent') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('queued','sent','opened','responded') THEN
    RETURN NEW;  -- already past the gate; allow ordinary progression
  END IF;

  SELECT review_status, title INTO req_review, req_title
  FROM public.deal_requirements WHERE id = NEW.requirement_id;

  IF req_review IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION
      'Requirement "%" has not been reviewed and approved (review_status=%). An external request cannot be sent for an unreviewed requirement.',
      COALESCE(req_title, NEW.requirement_id::text), COALESCE(req_review, 'null')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT NEW.approved_to_send THEN
    RAISE EXCEPTION
      'Request for "%" is not approved to send. Set approved_to_send once a person has reviewed the outbound message.',
      COALESCE(req_title, NEW.requirement_id::text)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Schedule the first reminder off the send.
  IF NEW.next_reminder_at IS NULL AND NEW.auto_remind
     AND array_length(NEW.reminder_cadence_days, 1) >= 1 THEN
    NEW.next_reminder_at := now() + (NEW.reminder_cadence_days[1] || ' days')::interval;
  END IF;
  IF NEW.sent_at IS NULL AND NEW.status = 'sent' THEN
    NEW.sent_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_requests_require_review ON public.requirement_requests;
CREATE TRIGGER requirement_requests_require_review
  BEFORE INSERT OR UPDATE ON public.requirement_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_requirement_review_before_send();


-- ───────────────────────────────────────────────────────────────────────────
-- 5. Completion cascade
--
-- Feature 3 step 8: accepting a document should attach it, mark the requirement
-- complete, stop reminders, update readiness, write the audit event and notify
-- — "without someone manually updating three different places". Doing it in a
-- trigger means no caller can do half of it.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_requirement_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted boolean;
  req      public.deal_requirements%ROWTYPE;
BEGIN
  -- A human decision always wins; otherwise a high-confidence AI verdict.
  accepted := (NEW.human_decision = 'accepted')
              OR (NEW.human_decision IS NULL AND NEW.verification_verdict = 'verified');

  SELECT * INTO req FROM public.deal_requirements WHERE id = NEW.requirement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF accepted THEN
    UPDATE public.deal_requirements
    SET status          = 'satisfied',
        satisfied_at    = now(),
        -- NB: never coerce submitted_by_email here — it is an email address,
        -- and casting it to uuid throws the moment an AI-verified acceptance
        -- lands with no human decider.
        satisfied_by    = COALESCE(NEW.decided_by, satisfied_by),
        evidence_doc_id = COALESCE(NEW.document_id, evidence_doc_id),
        updated_at      = now()
    WHERE id = NEW.requirement_id;

    -- Stop chasing.
    UPDATE public.requirement_requests
    SET status = CASE WHEN status IN ('sent','opened','queued') THEN 'responded' ELSE status END,
        responded_at = COALESCE(responded_at, now()),
        auto_remind = false,
        next_reminder_at = NULL,
        updated_at = now()
    WHERE requirement_id = NEW.requirement_id;

  ELSIF NEW.human_decision = 'rejected' OR NEW.verification_verdict = 'rejected' THEN
    UPDATE public.deal_requirements
    SET status = 'issue', updated_at = now()
    WHERE id = NEW.requirement_id;

  ELSIF NEW.verification_verdict = 'review_required' THEN
    UPDATE public.deal_requirements
    SET status = 'under_review', updated_at = now()
    WHERE id = NEW.requirement_id;
  END IF;

  INSERT INTO public.audit_log (deal_id, user_id, action, details)
  VALUES (NEW.deal_id, NEW.decided_by,
    CASE WHEN accepted THEN 'requirement_satisfied' ELSE 'requirement_evidence_received' END,
    jsonb_build_object(
      'requirement_id', NEW.requirement_id,
      'requirement_title', req.title,
      'evidence_id', NEW.id,
      'filename', NEW.filename,
      'verdict', NEW.verification_verdict,
      'human_decision', NEW.human_decision,
      'accepted', accepted));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirement_evidence_apply ON public.requirement_evidence;
CREATE TRIGGER requirement_evidence_apply
  AFTER INSERT OR UPDATE ON public.requirement_evidence
  FOR EACH ROW EXECUTE FUNCTION public.apply_requirement_evidence();


-- ───────────────────────────────────────────────────────────────────────────
-- 6. Server-side reminder engine
--
-- Returns the requests that are due for a chase. A cron job calls this and
-- hands each row to the existing email queue. Escalates to the internal owner
-- once the cadence is exhausted rather than chasing forever.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.requirement_reminders_due(_limit integer DEFAULT 100)
RETURNS TABLE (
  request_id       uuid,
  requirement_id   uuid,
  deal_id          uuid,
  recipient_email  text,
  recipient_name   text,
  requirement_title text,
  due_date         date,
  reminder_number  integer,
  is_escalation    boolean,
  escalate_to      uuid,
  internal_owner_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rq.id, rq.requirement_id, rq.deal_id, rq.recipient_email, rq.recipient_name,
         r.title, r.due_date,
         rq.reminder_count + 1,
         -- true on the LAST reminder of the cadence, or once the due date has
         -- passed: this is the 'urgent reminder + internal escalation' step.
         (rq.reminder_count + 1 >= COALESCE(array_length(rq.reminder_cadence_days, 1), 0))
           OR (r.due_date IS NOT NULL AND r.due_date < current_date),
         rq.escalate_to, r.internal_owner_id
  FROM public.requirement_requests rq
  JOIN public.deal_requirements r ON r.id = rq.requirement_id
  WHERE rq.auto_remind
    AND rq.status IN ('sent','opened')
    AND rq.next_reminder_at IS NOT NULL
    AND rq.next_reminder_at <= now()
    AND r.status NOT IN ('satisfied','waived','not_required')
    AND r.deleted_at IS NULL
  ORDER BY rq.next_reminder_at
  LIMIT _limit;
$$;

-- Records that a reminder went out and schedules the next one.
CREATE OR REPLACE FUNCTION public.requirement_reminder_sent(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rq       public.requirement_requests%ROWTYPE;
  next_gap integer;
BEGIN
  SELECT * INTO rq FROM public.requirement_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  -- cadence array is 1-based; reminder_count is how many have already gone out
  next_gap := rq.reminder_cadence_days[rq.reminder_count + 2];

  UPDATE public.requirement_requests
  SET reminder_count   = reminder_count + 1,
      last_reminder_at = now(),
      next_reminder_at = CASE WHEN next_gap IS NULL
                              THEN NULL                       -- cadence exhausted
                              ELSE now() + (next_gap || ' days')::interval END,
      escalated_at     = CASE WHEN next_gap IS NULL THEN now() ELSE escalated_at END,
      updated_at       = now()
  WHERE id = _request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.requirement_reminders_due(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.requirement_reminder_sent(uuid) TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 7. RLS
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deal_requirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_requirements_select ON public.deal_requirements;
CREATE POLICY deal_requirements_select ON public.deal_requirements
  FOR SELECT TO authenticated USING (public.can_access_deal(auth.uid(), deal_id));
DROP POLICY IF EXISTS deal_requirements_write ON public.deal_requirements;
CREATE POLICY deal_requirements_write ON public.deal_requirements
  FOR ALL TO authenticated USING (public.can_write_deal(auth.uid(), deal_id))
  WITH CHECK (public.can_write_deal(auth.uid(), deal_id));
DROP POLICY IF EXISTS deal_requirements_service ON public.deal_requirements;
CREATE POLICY deal_requirements_service ON public.deal_requirements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS requirement_requests_select ON public.requirement_requests;
CREATE POLICY requirement_requests_select ON public.requirement_requests
  FOR SELECT TO authenticated USING (public.can_access_deal(auth.uid(), deal_id));
DROP POLICY IF EXISTS requirement_requests_write ON public.requirement_requests;
CREATE POLICY requirement_requests_write ON public.requirement_requests
  FOR ALL TO authenticated USING (public.can_write_deal(auth.uid(), deal_id))
  WITH CHECK (public.can_write_deal(auth.uid(), deal_id));
DROP POLICY IF EXISTS requirement_requests_service ON public.requirement_requests;
CREATE POLICY requirement_requests_service ON public.requirement_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS requirement_evidence_select ON public.requirement_evidence;
CREATE POLICY requirement_evidence_select ON public.requirement_evidence
  FOR SELECT TO authenticated USING (public.can_access_deal(auth.uid(), deal_id));
DROP POLICY IF EXISTS requirement_evidence_write ON public.requirement_evidence;
CREATE POLICY requirement_evidence_write ON public.requirement_evidence
  FOR ALL TO authenticated USING (public.can_write_deal(auth.uid(), deal_id))
  WITH CHECK (public.can_write_deal(auth.uid(), deal_id));
-- The external upload path runs as service_role after token validation, so the
-- external party never needs a row-level grant of their own.
DROP POLICY IF EXISTS requirement_evidence_service ON public.requirement_evidence;
CREATE POLICY requirement_evidence_service ON public.requirement_evidence
  FOR ALL TO service_role USING (true) WITH CHECK (true);
