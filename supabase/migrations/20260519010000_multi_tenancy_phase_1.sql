-- ────────────────────────────────────────────────────────────────────────
-- Multi-tenancy: Phase 1
-- ────────────────────────────────────────────────────────────────────────
-- The repo already had `organizations` and `organization_memberships`
-- tables (created in migrations 20260302184127 and 20260423000419,
-- respectively) but they were empty + only used by the checklist-templates
-- feature. This migration:
--   1. Extends `organizations` with the fields a real customer workspace
--      needs (slug, billing_email, org_type, created_by, updated_at,
--      legal_entity_name).
--   2. Adds `deals.org_id` so deals belong to a workspace.
--   3. Adds helper functions used by RLS (`user_org_ids`, `has_org_role`,
--      `demo_org_id`).
--   4. Backfills: every existing user gets a personal org (named after
--      their firm_name / full_name / email); demo deals get assigned to
--      a single shared "PIVT Demo" org.
--   5. Adds an org-membership-based SELECT policy to `deals` so anyone in
--      the org can read its deals (existing per-deal participant policies
--      remain alive during the transition).
--
-- Idempotent + additive: re-runs are safe; existing rows aren't disturbed.
-- The existing `organization_memberships.role` enum is `owner|editor|
-- viewer`; we use those same values rather than introducing a new enum.
-- ────────────────────────────────────────────────────────────────────────


-- ── 1. Extend the existing `organizations` table ──

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS org_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- org_type CHECK is added separately so we can re-run safely (ALTER ... ADD
-- COLUMN IF NOT EXISTS doesn't support inline CHECK constraints across all
-- Postgres versions).
DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_org_type_check
    CHECK (org_type IN ('customer', 'demo', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Slug uniqueness — only enforce when populated so legacy NULL rows don't
-- collide. The backfill below sets a unique slug for every personal org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
  ON public.organizations(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_org_type ON public.organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);


-- ── 2. deals.org_id ──

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals(org_id);


-- ── 3. Helper functions used by RLS ──

-- Returns the orgs a user belongs to. SECURITY DEFINER to avoid recursive
-- RLS on organization_memberships from inside the policy.
CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.organization_memberships WHERE user_id = _user_id;
$$;

-- Hierarchical role check using the existing schema's enum values
-- (owner > editor > viewer). RLS callers write `has_org_role(uid, oid,
-- 'viewer')` to mean "any member or above."
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND (
        role = _required_role
        OR (role = 'owner')
        OR (role = 'editor' AND _required_role = 'viewer')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE org_type = 'demo' LIMIT 1;
$$;


-- ── 4. Make the demo org visible to all authenticated users ──
-- Existing SELECT policy ("Authenticated users view organizations") was
-- already permissive. We keep it. But we make sure org_type='demo' rows
-- stay readable via the new policy if the open one is ever tightened.

DROP POLICY IF EXISTS "organizations_select_members_or_demo" ON public.organizations;
CREATE POLICY "organizations_select_members_or_demo" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    org_type = 'demo'
    OR id IN (SELECT public.user_org_ids(auth.uid()))
  );

-- Anyone authenticated can create a customer org (Phase 2 will gate to
-- one personal org per user; for now any signed-in user can create more,
-- which matches the OrgSwitcher "Create new workspace" UX).
DROP POLICY IF EXISTS "organizations_insert_self" ON public.organizations;
CREATE POLICY "organizations_insert_self" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    org_type = 'customer'
    AND (created_by IS NULL OR created_by = auth.uid())
  );


-- ── 5. Backfill: personal org per existing user + shared demo org ──

DO $$
DECLARE
  user_rec RECORD;
  new_org_id uuid;
  demo_id uuid;
  org_name text;
  org_slug text;
BEGIN
  -- Demo org first so the deal backfill below can reference it.
  SELECT id INTO demo_id FROM public.organizations WHERE org_type = 'demo' LIMIT 1;
  IF demo_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, org_type, legal_entity_name, billing_email)
    VALUES ('PIVT Demo', 'pivt-demo', 'demo', 'PIVT, Inc. (Demo)', 'demo@pivttech.ai')
    RETURNING id INTO demo_id;
  END IF;

  -- Personal org per existing user — only for users who don't already have
  -- a membership row (re-runs are safe).
  FOR user_rec IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_memberships m WHERE m.user_id = u.id
    )
  LOOP
    org_name := COALESCE(
      NULLIF(user_rec.raw_user_meta_data->>'firm_name', ''),
      NULLIF(user_rec.raw_user_meta_data->>'full_name', ''),
      split_part(user_rec.email, '@', 1)
    );
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substring(user_rec.id::text, 1, 8);

    INSERT INTO public.organizations (name, slug, org_type, created_by, billing_email)
    VALUES (org_name, org_slug, 'customer', user_rec.id, user_rec.email)
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_memberships (org_id, user_id, role)
    VALUES (new_org_id, user_rec.id, 'owner');

    -- Assign their existing real deals to their personal org. Only the
    -- ones they created (owner_id) AND that aren't already assigned AND
    -- that aren't demo deals (those go to the demo org below).
    UPDATE public.deals
       SET org_id = new_org_id
     WHERE owner_id = user_rec.id
       AND org_id IS NULL
       AND COALESCE(is_demo, false) = false;
  END LOOP;

  -- Demo deals → shared demo org.
  UPDATE public.deals
     SET org_id = demo_id
   WHERE COALESCE(is_demo, false) = true
     AND org_id IS NULL;
END $$;


-- ── 6. Add org-membership-based SELECT policy on deals ──
-- This is additive — the existing per-deal-participant policies (e.g.
-- `deals_select` from migration 20260304162633) stay in place. PostgreSQL
-- RLS is permissive by default: a user matching ANY policy can read.

DROP POLICY IF EXISTS "deals_select_org_members" ON public.deals;
CREATE POLICY "deals_select_org_members" ON public.deals FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL
    AND (
      org_id IN (SELECT public.user_org_ids(auth.uid()))
      OR org_id = public.demo_org_id()
    )
  );


-- ── 7. updated_at trigger on organizations ──

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
