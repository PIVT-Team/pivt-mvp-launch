-- Week 1 kernel: generic transaction primitives + property extensions.
--
-- This migration adds the layer that all workspace modules (Deal Terms,
-- Obligations, DD, Compliance, Settlement, Funds Flow, Conditions, Execution,
-- Audit) read from and write to. All tables here are intentionally generic —
-- they're prefixed `tx_*` so the same schema can serve PIVT M&A in a later
-- shared-engine extraction. Property-specific extensions stay `re_*`.
--
-- Safe to re-run.

-- ───────────────────────────────────────────────────────────────────────
-- Helper — workspace membership check (used by every RLS policy below)
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.re_user_in_org(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.org_id = target_org AND m.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.re_user_in_org(UUID) TO authenticated;

-- Shared updated_at trigger (reuses touch_re_updated_at from migration 00001)
-- We add a thin alias so tx_* tables read more naturally.
CREATE OR REPLACE FUNCTION public.touch_tx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────────────
-- 1. tx_documents — generic file shelf shared by every module
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  category        TEXT NOT NULL DEFAULT 'uncategorized'
                  CHECK (category IN (
                    'psa', 'title', 'survey', 'environmental',
                    'financial', 'property', 'leasing', 'corporate',
                    'closing_package', 'wire', 'uncategorized'
                  )),
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      BIGINT,

  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'under_review', 'signed_off', 'rejected')),

  version         INTEGER NOT NULL DEFAULT 1,
  parent_doc_id   UUID REFERENCES public.tx_documents(id) ON DELETE SET NULL,

  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_documents_lookup
  ON public.tx_documents (workspace_id, transaction_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tx_documents_category
  ON public.tx_documents (transaction_id, category) WHERE deleted_at IS NULL;

ALTER TABLE public.tx_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_documents_all ON public.tx_documents;
CREATE POLICY tx_documents_all ON public.tx_documents
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_documents_touch ON public.tx_documents;
CREATE TRIGGER tx_documents_touch
  BEFORE UPDATE ON public.tx_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 2. tx_obligations — who owes what to whom, by when
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_obligations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  -- Who has to deliver (free text + optional FK to parties for the typed case)
  owed_by_side    TEXT NOT NULL CHECK (owed_by_side IN ('buyer', 'seller', 'title', 'lender', 'escrow', 'other')),
  owed_by_party   UUID REFERENCES public.re_parties(id) ON DELETE SET NULL,

  title           TEXT NOT NULL,
  description     TEXT,

  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'outstanding'
                  CHECK (status IN ('outstanding', 'satisfied', 'waived', 'overdue')),
  satisfied_at    TIMESTAMPTZ,
  satisfied_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Provenance: did a human enter this, or did Newton extract it?
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'newton')),
  source_ref      JSONB,  -- e.g. {doc_id, page, paragraph, confidence}

  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_obligations_lookup
  ON public.tx_obligations (workspace_id, transaction_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tx_obligations_status
  ON public.tx_obligations (transaction_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_obligations_due
  ON public.tx_obligations (transaction_id, due_date) WHERE deleted_at IS NULL AND status = 'outstanding';

ALTER TABLE public.tx_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_obligations_all ON public.tx_obligations;
CREATE POLICY tx_obligations_all ON public.tx_obligations
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_obligations_touch ON public.tx_obligations;
CREATE TRIGGER tx_obligations_touch
  BEFORE UPDATE ON public.tx_obligations
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 3. tx_funds_flow_lines — sources × uses ledger
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_funds_flow_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  -- Sources push money INTO the closing; Uses pull money OUT.
  direction       TEXT NOT NULL CHECK (direction IN ('source', 'use')),
  category        TEXT NOT NULL CHECK (category IN (
                    -- Sources
                    'buyer_equity', 'senior_debt', 'mezz_debt', 'seller_financing', 'earnest_money_credit',
                    -- Uses
                    'purchase_price', 'payoff_lender', 'taxes', 'broker_commission',
                    'escrow_fee', 'legal_fee', 'title_fee', 'recording_fee', 'transfer_tax',
                    'insurance_premium', 'wire_fee', 'other'
                  )),

  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'USD',

  -- Wire detail
  payee_party     UUID REFERENCES public.re_parties(id) ON DELETE SET NULL,
  bank_name       TEXT,
  account_last4   TEXT,
  routing_last4   TEXT,
  wire_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (wire_status IN ('pending', 'sent', 'confirmed', 'failed', 'not_applicable')),
  wire_sent_at    TIMESTAMPTZ,
  wire_confirmed_at TIMESTAMPTZ,

  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'newton')),
  source_ref      JSONB,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_funds_flow_lookup
  ON public.tx_funds_flow_lines (workspace_id, transaction_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tx_funds_flow_direction
  ON public.tx_funds_flow_lines (transaction_id, direction) WHERE deleted_at IS NULL;

ALTER TABLE public.tx_funds_flow_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_funds_flow_lines_all ON public.tx_funds_flow_lines;
CREATE POLICY tx_funds_flow_lines_all ON public.tx_funds_flow_lines
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_funds_flow_lines_touch ON public.tx_funds_flow_lines;
CREATE TRIGGER tx_funds_flow_lines_touch
  BEFORE UPDATE ON public.tx_funds_flow_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 4. tx_conditions_precedent — gating items required to close
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_conditions_precedent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('legal', 'title', 'financing', 'dd', 'approvals', 'funds_flow', 'other')),

  status          TEXT NOT NULL DEFAULT 'outstanding'
                  CHECK (status IN ('outstanding', 'satisfied', 'waived')),
  satisfied_at    TIMESTAMPTZ,
  satisfied_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence_doc_id UUID REFERENCES public.tx_documents(id) ON DELETE SET NULL,

  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'newton', 'derived')),
  source_ref      JSONB,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_conditions_lookup
  ON public.tx_conditions_precedent (workspace_id, transaction_id, deleted_at);

ALTER TABLE public.tx_conditions_precedent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_conditions_all ON public.tx_conditions_precedent;
CREATE POLICY tx_conditions_all ON public.tx_conditions_precedent
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_conditions_touch ON public.tx_conditions_precedent;
CREATE TRIGGER tx_conditions_touch
  BEFORE UPDATE ON public.tx_conditions_precedent
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 5. tx_readiness_dimensions — category scores feeding the Readiness Score
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_readiness_dimensions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  dimension       TEXT NOT NULL
                  CHECK (dimension IN ('legal', 'title', 'financing', 'dd', 'approvals', 'funds_flow')),
  score_pct       INTEGER NOT NULL DEFAULT 0 CHECK (score_pct BETWEEN 0 AND 100),
  notes           TEXT,

  -- Whether the score is hand-entered or derived from conditions/obligations
  source          TEXT NOT NULL DEFAULT 'derived'
                  CHECK (source IN ('manual', 'derived')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (transaction_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_tx_readiness_lookup
  ON public.tx_readiness_dimensions (workspace_id, transaction_id);

ALTER TABLE public.tx_readiness_dimensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_readiness_all ON public.tx_readiness_dimensions;
CREATE POLICY tx_readiness_all ON public.tx_readiness_dimensions
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_readiness_touch ON public.tx_readiness_dimensions;
CREATE TRIGGER tx_readiness_touch
  BEFORE UPDATE ON public.tx_readiness_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 6. tx_approvals — N-of-M signoff primitive
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  subject_kind    TEXT NOT NULL CHECK (subject_kind IN (
                    'closing_package', 'wire_authorization', 'settlement_statement',
                    'funds_flow', 'amendment', 'other'
                  )),
  subject_ref     UUID,

  required_count  INTEGER NOT NULL DEFAULT 1 CHECK (required_count >= 1),
  approvals       JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- shape: [{user_id, role, approved_at, note}]

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  resolved_at     TIMESTAMPTZ,

  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_approvals_lookup
  ON public.tx_approvals (workspace_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_approvals_subject
  ON public.tx_approvals (subject_kind, subject_ref) WHERE subject_ref IS NOT NULL;

ALTER TABLE public.tx_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_approvals_all ON public.tx_approvals;
CREATE POLICY tx_approvals_all ON public.tx_approvals
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS tx_approvals_touch ON public.tx_approvals;
CREATE TRIGGER tx_approvals_touch
  BEFORE UPDATE ON public.tx_approvals
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 7. tx_audit_log — append-only mutation log
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tx_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  actor_user_id   UUID,
  actor_email     TEXT,
  actor_source    TEXT NOT NULL DEFAULT 'manual'
                  CHECK (actor_source IN ('manual', 'newton', 'system')),

  table_name      TEXT NOT NULL,
  row_id          UUID,
  operation       TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),

  diff            JSONB,  -- {field: [old, new], ...}

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_audit_log_lookup
  ON public.tx_audit_log (workspace_id, transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_audit_log_row
  ON public.tx_audit_log (table_name, row_id) WHERE row_id IS NOT NULL;

ALTER TABLE public.tx_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tx_audit_log_select ON public.tx_audit_log;
CREATE POLICY tx_audit_log_select ON public.tx_audit_log
  FOR SELECT TO authenticated
  USING (public.re_user_in_org(workspace_id));
-- Inserts come from the trigger only; no insert policy for app code.

-- ───────────────────────────────────────────────────────────────────────
-- 8. Audit trigger — captures every mutation on the tx_/re_ tables
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tx_audit_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
  v_transaction UUID;
  v_diff JSONB;
  v_old JSONB;
  v_new JSONB;
  v_key TEXT;
BEGIN
  -- Resolve workspace + transaction context. Different tables expose these
  -- differently; we look at the row first, then walk to re_transactions.
  IF TG_TABLE_NAME = 're_transactions' THEN
    v_workspace := COALESCE(NEW.org_id, OLD.org_id);
    v_transaction := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 're_parties' OR TG_TABLE_NAME = 're_settlement_lines' THEN
    v_transaction := COALESCE(NEW.transaction_id, OLD.transaction_id);
    SELECT org_id INTO v_workspace FROM public.re_transactions WHERE id = v_transaction;
  ELSIF TG_TABLE_NAME LIKE 'tx_%' THEN
    v_workspace := COALESCE(NEW.workspace_id, OLD.workspace_id);
    v_transaction := COALESCE(NEW.transaction_id, OLD.transaction_id);
  ELSE
    -- Unknown table — skip.
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Build a compact diff on UPDATEs; full row on INSERT/DELETE
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_diff := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_new -> v_key IS DISTINCT FROM v_old -> v_key
         AND v_key NOT IN ('updated_at') THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_array(v_old -> v_key, v_new -> v_key));
      END IF;
    END LOOP;
    -- Skip "no real change" rows to keep the log clean.
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_diff := jsonb_build_object('_inserted', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_diff := jsonb_build_object('_deleted', to_jsonb(OLD));
  END IF;

  INSERT INTO public.tx_audit_log (
    workspace_id, transaction_id, actor_user_id, table_name, row_id, operation, diff
  ) VALUES (
    v_workspace,
    v_transaction,
    auth.uid(),
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    lower(TG_OP),
    v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to every tracked table
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      're_transactions','re_parties','re_settlement_lines',
      'tx_obligations','tx_funds_flow_lines','tx_conditions_precedent',
      'tx_readiness_dimensions','tx_documents','tx_approvals'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.tx_audit_capture()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 9. re_property_profile — richer property details (beyond address)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_property_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id        UUID NOT NULL UNIQUE REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  property_type         TEXT
                        CHECK (property_type IN (
                          'residential', 'multifamily', 'office', 'industrial',
                          'retail', 'land', 'mixed_use', 'hospitality'
                        )),
  legal_description     TEXT,
  zoning                TEXT,
  square_footage        INTEGER CHECK (square_footage IS NULL OR square_footage > 0),
  lot_size_sqft         INTEGER CHECK (lot_size_sqft IS NULL OR lot_size_sqft > 0),
  year_built            INTEGER CHECK (year_built IS NULL OR year_built BETWEEN 1700 AND 2100),

  current_owner_name    TEXT,
  ownership_structure   TEXT CHECK (ownership_structure IN ('individual', 'llc', 'lp', 'corp', 'trust', 'other')),

  -- Provenance — was this entered manually or extracted by Newton from public records / PSA?
  source                TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'newton')),
  source_ref            JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_property_profile_lookup
  ON public.re_property_profile (workspace_id, transaction_id);

ALTER TABLE public.re_property_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS re_property_profile_all ON public.re_property_profile;
CREATE POLICY re_property_profile_all ON public.re_property_profile
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS re_property_profile_touch ON public.re_property_profile;
CREATE TRIGGER re_property_profile_touch
  BEFORE UPDATE ON public.re_property_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 10. re_deal_terms — extracted from PSA, editable
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_deal_terms (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id              UUID NOT NULL UNIQUE REFERENCES public.re_transactions(id) ON DELETE CASCADE,

  -- Pricing
  purchase_price              NUMERIC(14,2),
  earnest_money               NUMERIC(14,2),
  additional_deposits         NUMERIC(14,2),

  -- Timing
  signing_date                DATE,
  due_diligence_deadline      DATE,
  financing_contingency_end   DATE,
  closing_date                DATE,

  -- Contingencies (boolean flags + free-text detail)
  inspection_contingency      BOOLEAN NOT NULL DEFAULT false,
  financing_contingency       BOOLEAN NOT NULL DEFAULT false,
  environmental_contingency   BOOLEAN NOT NULL DEFAULT false,
  estoppel_required           BOOLEAN NOT NULL DEFAULT false,
  lender_approval_required    BOOLEAN NOT NULL DEFAULT false,
  contingency_notes           TEXT,

  -- Adjustments / prorations
  tax_proration_method        TEXT,
  rent_proration_required     BOOLEAN NOT NULL DEFAULT false,
  cam_reconciliation_required BOOLEAN NOT NULL DEFAULT false,
  security_deposits_credited  BOOLEAN NOT NULL DEFAULT false,
  utility_adjustment_method   TEXT,

  source                      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'newton')),
  source_ref                  JSONB,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_deal_terms_lookup
  ON public.re_deal_terms (workspace_id, transaction_id);

ALTER TABLE public.re_deal_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS re_deal_terms_all ON public.re_deal_terms;
CREATE POLICY re_deal_terms_all ON public.re_deal_terms
  FOR ALL TO authenticated
  USING (public.re_user_in_org(workspace_id))
  WITH CHECK (public.re_user_in_org(workspace_id));

DROP TRIGGER IF EXISTS re_deal_terms_touch ON public.re_deal_terms;
CREATE TRIGGER re_deal_terms_touch
  BEFORE UPDATE ON public.re_deal_terms
  FOR EACH ROW EXECUTE FUNCTION public.touch_tx_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 11. re_parties extensions — entity_type as enum + ownership %
-- ───────────────────────────────────────────────────────────────────────
-- The existing CHECK constraint on entity_type was a free-text comment.
-- We add a stricter enum column alongside (entity_type_enum) so the form
-- can drive selection. Old text column stays for migration headroom.

ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS entity_type_enum TEXT
    CHECK (entity_type_enum IS NULL OR entity_type_enum IN ('LLC', 'LP', 'Corp', 'Trust', 'Partnership', 'Individual', 'Other'));

ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS ownership_pct NUMERIC(5,2)
    CHECK (ownership_pct IS NULL OR (ownership_pct >= 0 AND ownership_pct <= 100));

ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS authority_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS authority_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS authority_doc_id UUID REFERENCES public.tx_documents(id) ON DELETE SET NULL;

-- Also add deleted_at for soft delete + indexing parity
ALTER TABLE public.re_transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.re_parties
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_re_transactions_lookup
  ON public.re_transactions (org_id, deleted_at, status);
CREATE INDEX IF NOT EXISTS idx_re_parties_lookup
  ON public.re_parties (transaction_id, deleted_at);
