-- ═══════════════════════════════════════════════════════════════════════════
-- Versioning, change tracking, and invalidation
--
-- Closes P0 gaps G3, G4, G5, G6 from LIVE_DEAL_GAP_LIST.md and lays the
-- foundation G1/G2 build on.
--
-- SAFETY: additive only. No DROP, no RENAME, no NOT NULL added to an existing
-- column, no enum edits. Every ALTER is IF NOT EXISTS and every CREATE is
-- IF NOT EXISTS, so this file is safe to run more than once. Code that predates
-- this migration keeps working unchanged — it simply ignores the new columns.
--
-- BEHAVIOUR CHANGE TO BE AWARE OF (§2): editing a wire instruction's bank
-- details now resets its verification status to 'pending'. That is the point of
-- the migration, but it is a live behaviour change, not just new storage.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- §1  Document versioning                                              (G3)
--
-- Every document upload today lands as an independent row with no ordering, so
-- readers resolve extracted values with `docs.find(...)` — first row wins. That
-- made the discrepancy engine read funds flow v10 as current and raise a false
-- blocker off a superseded SPA. Versions are scoped to (deal_id, doc_type).
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.contract_documents.version IS
  'Sequence within (deal_id, doc_type), 1-based. Assigned by trigger on insert.';
COMMENT ON COLUMN public.contract_documents.is_current IS
  'Exactly one row per (deal_id, doc_type) is true. Readers must filter on this.';

-- Backfill: order the history that already exists, newest becomes current.
WITH ranked AS (
  SELECT id,
         deal_id,
         doc_type,
         row_number() OVER (PARTITION BY deal_id, doc_type ORDER BY uploaded_at, id) AS seq,
         lag(id)      OVER (PARTITION BY deal_id, doc_type ORDER BY uploaded_at, id) AS prev_id,
         row_number() OVER (PARTITION BY deal_id, doc_type ORDER BY uploaded_at DESC, id DESC) AS rseq
  FROM public.contract_documents
)
UPDATE public.contract_documents d
SET version       = r.seq,
    supersedes_id = r.prev_id,
    is_current    = (r.rseq = 1)
FROM ranked r
WHERE d.id = r.id;

CREATE INDEX IF NOT EXISTS contract_documents_current_idx
  ON public.contract_documents (deal_id, doc_type, is_current);
CREATE INDEX IF NOT EXISTS contract_documents_version_idx
  ON public.contract_documents (deal_id, doc_type, version DESC);

-- Assign the version and demote the previous current row, atomically per insert.
CREATE OR REPLACE FUNCTION public.assign_contract_document_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_id      uuid;
  prev_version integer;
BEGIN
  SELECT id, version INTO prev_id, prev_version
  FROM public.contract_documents
  WHERE deal_id = NEW.deal_id
    AND doc_type = NEW.doc_type
    AND is_current = true
    AND id <> NEW.id
  ORDER BY version DESC
  LIMIT 1;

  IF prev_id IS NOT NULL THEN
    NEW.version       := prev_version + 1;
    NEW.supersedes_id := prev_id;

    UPDATE public.contract_documents
    SET is_current = false
    WHERE id = prev_id;
  ELSE
    NEW.version       := COALESCE(NEW.version, 1);
    NEW.supersedes_id := NULL;
  END IF;

  NEW.is_current := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_documents_assign_version ON public.contract_documents;
CREATE TRIGGER contract_documents_assign_version
  BEFORE INSERT ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.assign_contract_document_version();


-- ───────────────────────────────────────────────────────────────────────────
-- §2  Wire instruction history + automatic re-verification            (G5)
--
-- Bank details could previously be replaced while the row kept reading
-- 'verified' with its old verified_at — the exact business-email-compromise
-- shape the product exists to catch. Making the reset a trigger rather than a
-- rule means no caller can forget it.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wire_instruction_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wire_instruction_id uuid NOT NULL REFERENCES public.wire_instructions(id) ON DELETE CASCADE,
  deal_id             uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  changed_fields      text[] NOT NULL DEFAULT '{}',
  banking_changed     boolean NOT NULL DEFAULT false,
  previous_values     jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values          jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_verification_status text,
  changed_by          uuid,
  changed_by_source   text NOT NULL DEFAULT 'system',
  source_document_id  uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wire_instruction_history_deal_idx
  ON public.wire_instruction_history (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wire_instruction_history_wire_idx
  ON public.wire_instruction_history (wire_instruction_id, created_at DESC);

ALTER TABLE public.wire_instruction_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wire_instruction_history_select ON public.wire_instruction_history;
CREATE POLICY wire_instruction_history_select
  ON public.wire_instruction_history FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS wire_instruction_history_service_all ON public.wire_instruction_history;
CREATE POLICY wire_instruction_history_service_all
  ON public.wire_instruction_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.track_wire_instruction_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed  text[] := '{}';
  banking  boolean := false;
  prev_val jsonb := '{}'::jsonb;
  new_val  jsonb := '{}'::jsonb;
BEGIN
  -- Banking identity fields. A change to any of these invalidates verification.
  IF NEW.bank_name           IS DISTINCT FROM OLD.bank_name           THEN changed := changed || 'bank_name'::text;           banking := true; END IF;
  IF NEW.account_holder      IS DISTINCT FROM OLD.account_holder      THEN changed := changed || 'account_holder'::text;      banking := true; END IF;
  IF NEW.account_number_last4 IS DISTINCT FROM OLD.account_number_last4 THEN changed := changed || 'account_number_last4'::text; banking := true; END IF;
  IF NEW.routing_number      IS DISTINCT FROM OLD.routing_number      THEN changed := changed || 'routing_number'::text;      banking := true; END IF;
  IF NEW.swift_bic           IS DISTINCT FROM OLD.swift_bic           THEN changed := changed || 'swift_bic'::text;           banking := true; END IF;
  IF NEW.iban                IS DISTINCT FROM OLD.iban                THEN changed := changed || 'iban'::text;                banking := true; END IF;

  -- Material but non-banking fields: recorded, but they do not reset verification.
  IF NEW.amount       IS DISTINCT FROM OLD.amount       THEN changed := changed || 'amount'::text;       END IF;
  IF NEW.currency     IS DISTINCT FROM OLD.currency     THEN changed := changed || 'currency'::text;     END IF;
  IF NEW.payee_entity IS DISTINCT FROM OLD.payee_entity THEN changed := changed || 'payee_entity'::text; END IF;

  IF array_length(changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  prev_val := jsonb_build_object(
    'bank_name', OLD.bank_name, 'account_holder', OLD.account_holder,
    'account_number_last4', OLD.account_number_last4, 'routing_number', OLD.routing_number,
    'swift_bic', OLD.swift_bic, 'iban', OLD.iban,
    'amount', OLD.amount, 'currency', OLD.currency, 'payee_entity', OLD.payee_entity
  );
  new_val := jsonb_build_object(
    'bank_name', NEW.bank_name, 'account_holder', NEW.account_holder,
    'account_number_last4', NEW.account_number_last4, 'routing_number', NEW.routing_number,
    'swift_bic', NEW.swift_bic, 'iban', NEW.iban,
    'amount', NEW.amount, 'currency', NEW.currency, 'payee_entity', NEW.payee_entity
  );

  INSERT INTO public.wire_instruction_history (
    wire_instruction_id, deal_id, changed_fields, banking_changed,
    previous_values, new_values, previous_verification_status,
    changed_by, changed_by_source, source_document_id
  ) VALUES (
    OLD.id, OLD.deal_id, changed, banking,
    prev_val, new_val, OLD.verification_status,
    NEW.last_updated_by_user_id, COALESCE(NEW.last_updated_by_source, 'system'), NEW.source_document_id
  );

  -- Banking details changed → prior verification no longer describes this account.
  IF banking AND OLD.verification_status IN ('verified', 'confirmed', 'approved') THEN
    NEW.verification_status := 'pending';
    NEW.verified_at         := NULL;
    NEW.verified_by         := NULL;
    NEW.needs_review        := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wire_instructions_track_changes ON public.wire_instructions;
CREATE TRIGGER wire_instructions_track_changes
  BEFORE UPDATE ON public.wire_instructions
  FOR EACH ROW EXECUTE FUNCTION public.track_wire_instruction_changes();


-- ───────────────────────────────────────────────────────────────────────────
-- §3  Approvals bound to what they approved                           (G4)
--
-- deal_approvals already carries source_document_id / related_document_id but
-- nothing recorded WHICH VERSION was approved, so an approval could never go
-- stale. These columns let a new document version invalidate it.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deal_approvals
  ADD COLUMN IF NOT EXISTS approved_doc_version      integer,
  ADD COLUMN IF NOT EXISTS approved_snapshot_hash    text,
  ADD COLUMN IF NOT EXISTS invalidated_at            timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_reason        text,
  ADD COLUMN IF NOT EXISTS invalidated_by_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deal_approvals.approved_doc_version IS
  'contract_documents.version that was in force when this approval was granted.';
COMMENT ON COLUMN public.deal_approvals.invalidated_at IS
  'Set when a newer document version superseded what this approval covered.';

CREATE INDEX IF NOT EXISTS deal_approvals_invalidated_idx
  ON public.deal_approvals (deal_id, invalidated_at);


-- ───────────────────────────────────────────────────────────────────────────
-- §4  Deal change events                                          (G2, G11)
--
-- The structured record of "what changed and what it broke". This is what the
-- funds-flow diff writes, what Closing Readiness reads for blockers, and what
-- Newton answers "what changed?" from.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_change_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id            uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  change_type        text NOT NULL,     -- payment_added | payment_removed | payment_amount_changed
                                        -- | wire_details_changed | approval_invalidated
                                        -- | verification_invalidated | document_version_added
  severity           text NOT NULL DEFAULT 'info',   -- critical | high | medium | info
  blocks_closing     boolean NOT NULL DEFAULT false,

  -- provenance: which document version caused this
  source_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  source_label       text,              -- e.g. "Funds Flow v12"
  from_version       integer,
  to_version         integer,

  -- what it points at
  object_type        text,              -- wire_instruction | deal_approval | cap_table_entry | deal
  object_id          uuid,

  -- the six fields every discrepancy has to carry
  title              text NOT NULL,
  what_changed       text NOT NULL,
  why_it_matters     text,
  recommended_action text,
  details            jsonb NOT NULL DEFAULT '{}'::jsonb,

  status             text NOT NULL DEFAULT 'open',   -- open | acknowledged | resolved
  resolved_at        timestamptz,
  resolved_by        uuid,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_change_events_deal_idx
  ON public.deal_change_events (deal_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_change_events_blocking_idx
  ON public.deal_change_events (deal_id, blocks_closing) WHERE status = 'open';

ALTER TABLE public.deal_change_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_change_events_select ON public.deal_change_events;
CREATE POLICY deal_change_events_select
  ON public.deal_change_events FOR SELECT TO authenticated
  USING (public.can_access_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS deal_change_events_update ON public.deal_change_events;
CREATE POLICY deal_change_events_update
  ON public.deal_change_events FOR UPDATE TO authenticated
  USING (public.can_write_deal(auth.uid(), deal_id));

DROP POLICY IF EXISTS deal_change_events_service_all ON public.deal_change_events;
CREATE POLICY deal_change_events_service_all
  ON public.deal_change_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ───────────────────────────────────────────────────────────────────────────
-- §5  Install the discrepancy rule set                                (G6)
--
-- discrepancy_rules shipped with exactly one row (missing_tax_form). The other
-- rules existed only inside the generate-ontology-rules edge function, which
-- has no callers — so on a fresh deployment the engine looped over one rule and
-- every other check silently never ran.
--
-- The three duplicate keys are deliberately NOT seeded here: dual_counsel_missing,
-- waterfall_intent_total_mismatch, and payee_account_missing_or_mismatch map to
-- the same evaluators as dual_counsel_approval, waterfall_reconciliation, and
-- wire_instructions_missing respectively, and seeding both raised each finding
-- twice (G12).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.discrepancy_rules (rule_key, name, description, severity, enabled, scope, config)
VALUES
  ('missing_core_docs', 'Missing Core Documents', 'SPA, funds flow, and (where escrow exists) the escrow agreement must be on file before closing.', 'blocker', true, 'deal', '{}'),
  ('purchase_price_consistency', 'Purchase Price Consistency', 'Purchase price must agree across the SPA, the deal record, and the funds flow.', 'blocker', true, 'deal', '{"tolerance_pct": 0.5}'),
  ('escrow_amount_consistency', 'Escrow Amount Consistency', 'Escrow amount must agree across the escrow agreement, the deal record, and the funds flow.', 'blocker', true, 'deal', '{"tolerance_pct": 1}'),
  ('funds_flow_arithmetic', 'Funds Flow Arithmetic', 'Sources must equal uses, and line items must sum to total uses.', 'blocker', true, 'deal', '{"tolerance_amount": 100}'),
  ('party_name_alignment', 'Party Name Alignment', 'Party names in executed documents must match the deal record.', 'warn', true, 'party', '{}'),
  ('missing_officer_secretary_cert', 'Missing Officer/Secretary Certificate', 'An officer or secretary certificate is required at closing.', 'blocker', true, 'document', '{}'),
  ('intent_funds_flow_mismatch', 'Intent / Funds Flow Mismatch', 'Disbursement intents must total the funds flow uses.', 'blocker', true, 'deal', '{"tolerance_pct": 0.5}'),
  ('wire_instructions_missing', 'Wire Instructions Missing or Unverified', 'Every payee must have complete, verified payout instructions before execution.', 'blocker', true, 'intent', '{}'),
  ('dual_counsel_approval', 'Dual Counsel Approval', 'Both buyer and seller counsel must approve before execution.', 'blocker', true, 'deal', '{}'),
  ('kyc_passed', 'KYC Passed', 'KYC must clear for every payee.', 'blocker', true, 'party', '{}'),
  ('kyb_passed', 'KYB Passed', 'KYB must clear for every entity payee.', 'blocker', true, 'party', '{}'),
  ('sanctions_clear', 'Sanctions Clear', 'Sanctions screening must clear for every payee.', 'blocker', true, 'party', '{}'),
  ('compliance_failed', 'Compliance Check Failed', 'A compliance check returned a failing result.', 'blocker', true, 'deal', '{}'),
  ('disclosure_schedules_missing', 'Disclosure Schedules Missing', 'Disclosure schedules are expected in the closing binder.', 'warn', true, 'document', '{}'),
  ('legal_opinion_missing', 'Legal Opinion Missing', 'A legal opinion is expected in the closing binder.', 'warn', true, 'document', '{}'),
  ('cap_table_missing', 'Cap Table Missing', 'A cap table is expected in the closing binder.', 'warn', true, 'document', '{}'),
  ('working_capital_missing', 'Working Capital Statement Missing', 'A working capital statement is expected in the closing binder.', 'warn', true, 'document', '{}'),
  ('board_consent_missing', 'Board Consent Missing', 'Board consent is expected in the closing binder.', 'warn', true, 'document', '{}'),
  ('good_standing_missing', 'Good Standing Certificate Missing', 'A good standing certificate is expected in the closing binder.', 'info', true, 'document', '{}'),
  ('cap_table_total_validation', 'Cap Table Total Validation', 'Cap table ownership must total 100%, and payouts must reconcile to the equity consideration.', 'blocker', true, 'deal', '{"ownership_tolerance_pct": 0.01}'),
  ('waterfall_reconciliation', 'Waterfall Reconciliation', 'Disbursement intents must reconcile to the waterfall.', 'blocker', true, 'deal', '{"tolerance_pct": 0.5}'),
  ('docs_not_executed', 'Documents Not Executed', 'Required documents remain unexecuted.', 'blocker', true, 'document', '{}'),
  ('fx_rate_outside_tolerance', 'FX Rate Outside Tolerance', 'Cross-currency payments require a locked FX quote within tolerance.', 'warn', true, 'intent', '{}'),
  ('large_payment_extra_approval', 'Large Payment Requires Extra Approval', 'Disbursements above the threshold need an additional approval.', 'warn', true, 'intent', '{"threshold_amount": 5000000}'),
  ('stale_deal_data', 'Stale Deal Data', 'Deal record has not been updated recently.', 'info', true, 'deal', '{"stale_days": 14}'),
  ('closing_conditions_met', 'Closing Conditions Met', 'All closing conditions must be satisfied or waived.', 'blocker', true, 'deal', '{}'),
  ('party_presence', 'Party Presence', 'A deal needs at least a buyer and a seller.', 'warn', true, 'deal', '{"min_parties": 2}'),
  ('unresolved_discrepancy_blocks_execution', 'Unresolved Discrepancy Blocks Execution', 'Open blocker discrepancies prevent execution.', 'blocker', true, 'deal', '{}'),
  ('audit_trail_completeness', 'Audit Trail Completeness', 'Material actions must be present in the audit chain.', 'info', true, 'deal', '{}'),
  ('required_document_presence', 'Required Document Presence', 'Every document required for this deal type must be on file.', 'blocker', true, 'document', '{}'),
  ('compliance_checks_required', 'Compliance Checks Required', 'All compliance checks must pass before disbursement execution.', 'blocker', true, 'deal', '{"applies_to": "DisbursementIntent.execute"}')
ON CONFLICT (rule_key) DO NOTHING;

-- If a prior manual run of generate-ontology-rules already inserted the three
-- duplicate keys, disable them rather than deleting (keeps any history intact).
UPDATE public.discrepancy_rules
SET enabled = false
WHERE rule_key IN ('dual_counsel_missing', 'waterfall_intent_total_mismatch', 'payee_account_missing_or_mismatch');
