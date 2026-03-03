
-- Allow all authenticated users to see demo deals (created_by IS NULL)
DROP POLICY IF EXISTS "Participants can view their deals" ON public.deals;
CREATE POLICY "Participants can view their deals"
ON public.deals FOR SELECT
USING (
  created_by IS NULL
  OR auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = deals.id AND dp.user_id = auth.uid()
  )
);
