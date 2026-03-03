
-- Allow deal_settings insert for demo mode (no auth)
DROP POLICY IF EXISTS "Participants insert deal_settings" ON public.deal_settings;

CREATE POLICY "Anyone can insert deal_settings"
ON public.deal_settings
FOR INSERT
WITH CHECK (true);
