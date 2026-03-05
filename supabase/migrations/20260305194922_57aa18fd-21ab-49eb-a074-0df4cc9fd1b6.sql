
-- Drop all existing deals policies
DROP POLICY IF EXISTS "deals_select" ON public.deals;
DROP POLICY IF EXISTS "deals_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_update" ON public.deals;
DROP POLICY IF EXISTS "deals_delete" ON public.deals;

-- Recreate as explicitly PERMISSIVE

CREATE POLICY "deals_select" ON public.deals
  AS PERMISSIVE
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (visibility = 'global_demo' OR owner_id = auth.uid())
  );

CREATE POLICY "deals_insert" ON public.deals
  AS PERMISSIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid() AND visibility = 'private'
  );

CREATE POLICY "deals_update" ON public.deals
  AS PERMISSIVE
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  )
  WITH CHECK (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  );

CREATE POLICY "deals_delete" ON public.deals
  AS PERMISSIVE
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  );
