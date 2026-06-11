-- create_workspace RPC — atomic org + owner membership.
--
-- Problem this fixes: OrgSwitcher does two separate INSERTs (organizations,
-- organization_memberships). The membership insert fails under RLS because
-- the user isn't yet a member of the just-created org — classic
-- chicken-and-egg.
--
-- Solution: SECURITY DEFINER function that runs as the migration owner,
-- bypassing RLS, but only acts on behalf of the calling auth.uid(). The
-- function only ever:
--   1. Creates an org with created_by = caller
--   2. Adds the caller as owner of that org
--
-- The caller cannot pass arbitrary user_ids — they always become the owner.
-- So this is safe to expose to authenticated users.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.create_workspace(
  workspace_name TEXT,
  billing_email_in TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   UUID;
  v_user_id  UUID := auth.uid();
  v_email    TEXT;
  v_slug     TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF workspace_name IS NULL OR TRIM(workspace_name) = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  -- Derive a slug — lowercased name + random 6-char suffix for uniqueness.
  v_slug := REGEXP_REPLACE(LOWER(TRIM(workspace_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := REGEXP_REPLACE(v_slug, '^-|-$', '', 'g');
  v_slug := SUBSTRING(v_slug FROM 1 FOR 40) || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);

  -- Pull caller's email for default billing if not provided.
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Create the workspace
  INSERT INTO public.organizations (name, slug, org_type, created_by, billing_email)
  VALUES (
    TRIM(workspace_name),
    v_slug,
    'customer',
    v_user_id,
    COALESCE(NULLIF(TRIM(COALESCE(billing_email_in, '')), ''), v_email)
  )
  RETURNING id INTO v_org_id;

  -- Add the caller as owner.
  INSERT INTO public.organization_memberships (org_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO authenticated;
