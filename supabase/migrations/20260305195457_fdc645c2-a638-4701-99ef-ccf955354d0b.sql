
-- Create a security definer function for soft-deleting deals
-- This bypasses RLS but enforces ownership checks internally
CREATE OR REPLACE FUNCTION public.soft_delete_deal(_deal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _visibility text;
  _is_demo boolean;
BEGIN
  -- Check deal exists and get ownership info
  SELECT owner_id, visibility, is_demo
  INTO _owner, _visibility, _is_demo
  FROM public.deals
  WHERE id = _deal_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF _is_demo OR _visibility = 'global_demo' THEN
    RAISE EXCEPTION 'Cannot delete demo deals';
  END IF;

  IF _owner IS NULL OR _owner != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.deals
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = _deal_id;

  RETURN true;
END;
$$;
