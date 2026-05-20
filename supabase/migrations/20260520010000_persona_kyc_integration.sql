-- Persona KYC/KYB integration
--
-- Adds three tables + one column to enable Persona as a verification path
-- alongside the existing email-link + manual-review flow. Mirroring artifacts
-- locally (inquiry_id, account_id, evidence URL, watchlist Report) is
-- vendor-switch insurance: if we ever leave Persona, auditors can still
-- self-serve evidence from our storage without our API key.
--
-- Design notes:
--   • persona_inquiries is the canonical record per verification attempt.
--     Keyed by (stakeholder_id, kind) so each cap_table_entries row can hold
--     one in-flight + many historical inquiries.
--   • persona_webhook_events stores every received webhook for idempotency
--     (Persona retries up to 8x; same event.id can land twice). We never
--     trust SDK callbacks — webhooks are the only source of truth.
--   • organization_persona_templates is the per-org override hook. Enterprise
--     customers can later swap in their own Persona templates without
--     forking the codebase.
--   • cap_table_entries.persona_account_id enables cross-deal verification
--     reuse: when adding a stakeholder, if their email matches a prior
--     Persona Account, we offer "Reuse verification from [Deal X]".

-- ──────────────────────────────────────────────────────────────────────
-- 1. persona_inquiries — one row per inquiry attempt
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.persona_inquiries (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                    UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  stakeholder_id             UUID REFERENCES public.cap_table_entries(id) ON DELETE CASCADE,
  org_id                     UUID,
  kind                       TEXT NOT NULL CHECK (kind IN ('kyc', 'kyb', 'watchlist')),
  -- Persona identifiers (returned by Persona API)
  persona_inquiry_id         TEXT,                          -- inq_xxx
  persona_account_id         TEXT,                          -- act_xxx (Persona's identity-of-record)
  persona_template_id        TEXT NOT NULL,                 -- itmpl_xxx
  reference_id               TEXT NOT NULL,                 -- our stakeholder_id, passed to Persona for Account dedup
  -- Lifecycle
  status                     TEXT NOT NULL DEFAULT 'created'
                             CHECK (status IN ('created','pending','expired','completed','failed','approved','declined','needs_review')),
  initiated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at               TIMESTAMPTZ,
  last_event_at              TIMESTAMPTZ,
  -- Evidence (mirrored from Persona so we can survive a vendor switch)
  evidence_url               TEXT,                          -- signed URL or Persona-hosted report PDF
  watchlist_report_id        TEXT,                          -- rep_xxx (linked watchlist Report)
  -- Raw payload of the most recent webhook for debugging / audit
  raw_payload                JSONB,
  -- Who kicked it off
  initiated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_inquiries_deal_id          ON public.persona_inquiries(deal_id);
CREATE INDEX IF NOT EXISTS idx_persona_inquiries_stakeholder_id   ON public.persona_inquiries(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_persona_inquiries_inquiry_id       ON public.persona_inquiries(persona_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_persona_inquiries_account_id       ON public.persona_inquiries(persona_account_id);
CREATE INDEX IF NOT EXISTS idx_persona_inquiries_reference_id     ON public.persona_inquiries(reference_id);
CREATE INDEX IF NOT EXISTS idx_persona_inquiries_status           ON public.persona_inquiries(status);

ALTER TABLE public.persona_inquiries ENABLE ROW LEVEL SECURITY;

-- Read: members of the deal's org (uses existing helper if present, else
-- falls back to deal_participants).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_access_deal') THEN
    EXECUTE 'CREATE POLICY "persona_inquiries_select" ON public.persona_inquiries
             FOR SELECT TO authenticated
             USING (can_access_deal(auth.uid(), deal_id))';
  ELSE
    EXECUTE 'CREATE POLICY "persona_inquiries_select" ON public.persona_inquiries
             FOR SELECT TO authenticated
             USING (EXISTS (SELECT 1 FROM public.deal_participants dp
                            WHERE dp.deal_id = persona_inquiries.deal_id
                              AND dp.user_id = auth.uid()))';
  END IF;
END $$;

-- Insert/Update: only the edge function (service role bypasses RLS) writes
-- here in practice, but allow deal members to insert so a "Verify identity"
-- click from the client can stub a row before the edge function lands.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_write_deal') THEN
    EXECUTE 'CREATE POLICY "persona_inquiries_insert" ON public.persona_inquiries
             FOR INSERT TO authenticated
             WITH CHECK (can_write_deal(auth.uid(), deal_id))';
    EXECUTE 'CREATE POLICY "persona_inquiries_update" ON public.persona_inquiries
             FOR UPDATE TO authenticated
             USING (can_write_deal(auth.uid(), deal_id))';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. persona_webhook_events — idempotent event log
-- ──────────────────────────────────────────────────────────────────────
--
-- Persona retries up to 8x with exponential backoff. We must dedupe by
-- event.id, otherwise a "completed" event could mark an inquiry approved,
-- then a later replay could re-fire approval side-effects (re-write audit,
-- re-trigger watchlist, re-send notifications).
CREATE TABLE IF NOT EXISTS public.persona_webhook_events (
  event_id            TEXT PRIMARY KEY,                    -- evt_xxx (Persona's event UUID)
  event_type          TEXT NOT NULL,                       -- e.g. inquiry.completed, inquiry.failed
  persona_inquiry_id  TEXT,
  persona_account_id  TEXT,
  signature_verified  BOOLEAN NOT NULL DEFAULT false,
  payload             JSONB NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ,
  processing_error    TEXT
);

CREATE INDEX IF NOT EXISTS idx_persona_webhook_events_inquiry_id ON public.persona_webhook_events(persona_inquiry_id);
CREATE INDEX IF NOT EXISTS idx_persona_webhook_events_account_id ON public.persona_webhook_events(persona_account_id);
CREATE INDEX IF NOT EXISTS idx_persona_webhook_events_type       ON public.persona_webhook_events(event_type);

ALTER TABLE public.persona_webhook_events ENABLE ROW LEVEL SECURITY;

-- Webhook table is service-role only. Admins can read for debugging.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'CREATE POLICY "persona_webhook_events_admin_select"
             ON public.persona_webhook_events FOR SELECT TO authenticated
             USING (has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 3. organization_persona_templates — per-org template overrides
-- ──────────────────────────────────────────────────────────────────────
--
-- Default templates come from env vars (PERSONA_DEFAULT_KYC_TEMPLATE etc).
-- An org can override with its own template_id, e.g. an enterprise customer
-- with stricter region-specific KYB requirements.
CREATE TABLE IF NOT EXISTS public.organization_persona_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('kyc','kyb','watchlist')),
  persona_template_id TEXT NOT NULL,
  -- Active flag lets an org disable a kind entirely (e.g. "we don't do KYB
  -- via Persona, we do it manually").
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_org_persona_templates_org_id ON public.organization_persona_templates(org_id);

ALTER TABLE public.organization_persona_templates ENABLE ROW LEVEL SECURITY;

-- Read for any org member; write only for owners/editors.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_org_ids') THEN
    EXECUTE 'CREATE POLICY "org_persona_templates_select"
             ON public.organization_persona_templates FOR SELECT TO authenticated
             USING (org_id IN (SELECT * FROM user_org_ids(auth.uid())))';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_org_role') THEN
    EXECUTE 'CREATE POLICY "org_persona_templates_manage"
             ON public.organization_persona_templates FOR ALL TO authenticated
             USING (has_org_role(auth.uid(), org_id, ARRAY[''owner'',''editor'']))
             WITH CHECK (has_org_role(auth.uid(), org_id, ARRAY[''owner'',''editor'']))';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 4. cap_table_entries.persona_account_id — cross-deal reuse handle
-- ──────────────────────────────────────────────────────────────────────
--
-- When we mark a stakeholder verified via Persona, we also persist the
-- Persona Account ID here. Next time the same email appears on another
-- deal, we can fast-path: "Reuse verification from [Other Deal] — last
-- verified Mar 12, 2026" rather than re-doing the full inquiry.
ALTER TABLE public.cap_table_entries
  ADD COLUMN IF NOT EXISTS persona_account_id          TEXT,
  ADD COLUMN IF NOT EXISTS persona_last_inquiry_id     TEXT,
  ADD COLUMN IF NOT EXISTS persona_last_verified_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cap_table_persona_account ON public.cap_table_entries(persona_account_id);

-- ──────────────────────────────────────────────────────────────────────
-- 5. Updated-at triggers
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_persona_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS persona_inquiries_touch ON public.persona_inquiries;
CREATE TRIGGER persona_inquiries_touch
  BEFORE UPDATE ON public.persona_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_persona_updated_at();

DROP TRIGGER IF EXISTS org_persona_templates_touch ON public.organization_persona_templates;
CREATE TRIGGER org_persona_templates_touch
  BEFORE UPDATE ON public.organization_persona_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_persona_updated_at();
