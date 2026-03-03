
-- Fix broken RLS policy on deals table (dp.deal_id = dp.id -> dp.deal_id = deals.id)
DROP POLICY IF EXISTS "Participants can view their deals" ON public.deals;
CREATE POLICY "Participants can view their deals"
ON public.deals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = deals.id AND dp.user_id = auth.uid()
  )
);

-- Allow authenticated users to create deals
CREATE POLICY "Authenticated users can create deals"
ON public.deals FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Allow deal creator to update their deals
CREATE POLICY "Creator can update deals"
ON public.deals FOR UPDATE
USING (auth.uid() = created_by);

-- Allow deal creators to insert participants for their new deals
DROP POLICY IF EXISTS "Admins manage participants" ON public.deal_participants;
CREATE POLICY "Admins manage participants"
ON public.deal_participants FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator can add participants"
ON public.deal_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow participants to insert deal_settings
CREATE POLICY "Participants insert deal_settings"
ON public.deal_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = deal_settings.deal_id AND dp.user_id = auth.uid()
  )
);

-- Allow participants to insert conditions
CREATE POLICY "Participants insert conditions"
ON public.conditions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = conditions.deal_id AND dp.user_id = auth.uid()
  )
);

-- Allow participants to insert cap_table_entries
CREATE POLICY "Participants insert cap_table"
ON public.cap_table_entries FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deal_participants dp
    WHERE dp.deal_id = cap_table_entries.deal_id AND dp.user_id = auth.uid()
  )
);

-- Allow participants to insert audit_log for their deals
CREATE POLICY "Participants insert audit_log"
ON public.audit_log FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);
