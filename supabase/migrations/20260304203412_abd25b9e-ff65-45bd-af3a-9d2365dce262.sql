ALTER TABLE public.deals ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.deals ADD COLUMN deleted_by UUID DEFAULT NULL;

-- Update the SELECT policy to exclude soft-deleted deals
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (visibility = 'global_demo' OR owner_id = auth.uid())
);

-- Update DELETE policy: only own non-demo deals
DROP POLICY IF EXISTS "deals_delete" ON public.deals;
CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  AND visibility = 'private'
  AND is_demo = false
);

-- Update UPDATE policy to allow soft-delete of own non-demo deals
DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  AND visibility = 'private'
  AND is_demo = false
);