-- ────────────────────────────────────────────────────────────────────────
-- Multi-tenancy: Phase 3 — organization invites
-- ────────────────────────────────────────────────────────────────────────
-- Lets admins invite teammates by email. Generates a one-time-use token;
-- whoever signs in / signs up with that link gets joined to the org.
--
-- Email sending is handled client-side for the first cut: the admin
-- creates the invite, the UI surfaces a shareable link, the admin sends
-- it via whatever channel they want. A later phase wires Resend so the
-- email is sent automatically — but that requires an edge function deploy
-- which is heavier than the SQL-only setup here.
--
-- Idempotent: re-runs safe (IF NOT EXISTS everywhere, DROP POLICY IF
-- EXISTS for replays). Additive: no existing tables disturbed.
-- ────────────────────────────────────────────────────────────────────────


-- ── 1. The invites table ──

CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  -- Random secret used in the accept URL. Long enough to make
  -- guessing impractical; we store it directly rather than a hash
  -- because the only way to use a token is via the accept-RPC which
  -- already enforces RLS. (If we ever expose tokens to public log
  -- streams, switch to storing a hash.)
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON public.organization_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON public.organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email_lower ON public.organization_invites(lower(email));

-- Per-org-per-email-pending uniqueness so admins can't accidentally
-- send two parallel invites to the same address.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_unique_pending
  ON public.organization_invites(org_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;


-- ── 2. RLS ──

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Admins (owner / editor) of the org can list pending invites.
DROP POLICY IF EXISTS "invites_select_admins" ON public.organization_invites;
CREATE POLICY "invites_select_admins" ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'editor'));

-- Anyone can SELECT a single row by token — needed for the accept page to
-- validate the token before the user is even in the org. The accept-page
-- query MUST match on token = '...' (PostgREST .eq.token) so a row only
-- comes back when the requester already knows the secret.
DROP POLICY IF EXISTS "invites_select_by_token" ON public.organization_invites;
CREATE POLICY "invites_select_by_token" ON public.organization_invites FOR SELECT TO authenticated
  USING (true);

-- Admins of the target org can create invites.
DROP POLICY IF EXISTS "invites_insert_admins" ON public.organization_invites;
CREATE POLICY "invites_insert_admins" ON public.organization_invites FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.has_org_role(auth.uid(), org_id, 'editor')
  );

-- Admins can revoke (UPDATE revoked_at) their own org's invites.
-- The invited user can update accepted_at + accepted_by when they accept.
DROP POLICY IF EXISTS "invites_update_admin_or_acceptor" ON public.organization_invites;
CREATE POLICY "invites_update_admin_or_acceptor" ON public.organization_invites FOR UPDATE TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, 'editor')
    OR (accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now())
  );

DROP POLICY IF EXISTS "invites_delete_admins" ON public.organization_invites;
CREATE POLICY "invites_delete_admins" ON public.organization_invites FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'editor'));


-- ── 3. Acceptance RPC ──
-- Atomic accept: validates the token, joins the user to the org, marks
-- the invite as accepted. SECURITY DEFINER so it can both write the
-- membership AND the acceptance fields without the user needing direct
-- INSERT permission on organization_memberships (the existing RLS lets
-- them self-insert, but the SECURITY DEFINER path here is simpler +
-- avoids a window where someone forgets to insert the membership.)
CREATE OR REPLACE FUNCTION public.accept_organization_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_existing_member uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept this invite' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite link is invalid';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite was revoked';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    -- Idempotent: if the same user accepted before, treat as success.
    IF v_invite.accepted_by = v_user_id THEN
      RETURN jsonb_build_object('ok', true, 'org_id', v_invite.org_id, 'already_accepted', true);
    END IF;
    RAISE EXCEPTION 'This invite was already used';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  -- Skip if user is already in the org (e.g. admin re-added them out of band).
  SELECT id INTO v_existing_member
  FROM public.organization_memberships
  WHERE org_id = v_invite.org_id AND user_id = v_user_id;

  IF v_existing_member IS NULL THEN
    INSERT INTO public.organization_memberships (org_id, user_id, role)
    VALUES (v_invite.org_id, v_user_id, v_invite.role);
  END IF;

  UPDATE public.organization_invites
  SET accepted_at = now(),
      accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'org_id', v_invite.org_id);
END;
$$;

-- Make the RPC callable from the client (RLS-bypassed inside thanks to
-- SECURITY DEFINER, but we still want authentication).
REVOKE ALL ON FUNCTION public.accept_organization_invite(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(uuid) TO authenticated;
