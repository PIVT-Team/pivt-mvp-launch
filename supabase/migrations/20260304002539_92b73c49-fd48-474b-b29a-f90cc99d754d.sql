
-- Remove the policy that lets all authenticated users see demo deals
DROP POLICY IF EXISTS "All authenticated can view demo deals" ON public.deals;
