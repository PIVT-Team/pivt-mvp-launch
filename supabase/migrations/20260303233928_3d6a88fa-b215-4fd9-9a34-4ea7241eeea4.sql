
-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can create deals" ON public.deals;

-- Create new insert policy that allows both authenticated users and demo mode
CREATE POLICY "Users can create deals"
ON public.deals
FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = created_by)
  OR
  (created_by IS NULL)
);
