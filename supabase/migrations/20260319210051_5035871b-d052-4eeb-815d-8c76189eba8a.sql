
-- Update handle_new_user to also check admin_allowlist and assign the correct role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowlist_role text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Check if the new user is on the admin allowlist
  SELECT role INTO _allowlist_role
  FROM public.admin_allowlist
  WHERE lower(email) = lower(NEW.email) AND is_active = true
  LIMIT 1;

  IF _allowlist_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _allowlist_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Always assign participant role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'participant')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
