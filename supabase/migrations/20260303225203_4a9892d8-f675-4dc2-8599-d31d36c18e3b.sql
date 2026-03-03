
-- Allow viewing conditions for demo deals
DROP POLICY IF EXISTS "Participants view conditions" ON public.conditions;
CREATE POLICY "Participants view conditions"
ON public.conditions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = conditions.deal_id AND (
      d.created_by IS NULL
      OR d.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = d.id AND dp.user_id = auth.uid())
    )
  )
);

-- Allow viewing cap_table for demo deals
DROP POLICY IF EXISTS "Participants view cap table" ON public.cap_table_entries;
CREATE POLICY "Participants view cap table"
ON public.cap_table_entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = cap_table_entries.deal_id AND (
      d.created_by IS NULL
      OR d.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = d.id AND dp.user_id = auth.uid())
    )
  )
);

-- Allow viewing deal_settings for demo deals
DROP POLICY IF EXISTS "Participants view deal_settings" ON public.deal_settings;
CREATE POLICY "Participants view deal_settings"
ON public.deal_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = deal_settings.deal_id AND (
      d.created_by IS NULL
      OR d.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM deal_participants dp WHERE dp.deal_id = d.id AND dp.user_id = auth.uid())
    )
  )
);
