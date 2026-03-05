
-- Drop existing restrictive policies on deals
DROP POLICY IF EXISTS "deals_select" ON public.deals;
DROP POLICY IF EXISTS "deals_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_update" ON public.deals;
DROP POLICY IF EXISTS "deals_delete" ON public.deals;

-- Recreate as PERMISSIVE policies

-- SELECT: see global_demo deals + own private deals (exclude soft-deleted)
CREATE POLICY "deals_select" ON public.deals
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (visibility = 'global_demo' OR owner_id = auth.uid())
  );

-- INSERT: only private deals owned by the user
CREATE POLICY "deals_insert" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid() AND visibility = 'private'
  );

-- UPDATE: owner can update their own private, non-demo deals
CREATE POLICY "deals_update" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  )
  WITH CHECK (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  );

-- DELETE (hard delete): owner can delete own private, non-demo deals
CREATE POLICY "deals_delete" ON public.deals
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid() AND visibility = 'private' AND is_demo = false
  );
