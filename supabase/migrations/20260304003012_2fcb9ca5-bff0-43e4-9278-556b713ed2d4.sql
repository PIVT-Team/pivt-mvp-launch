
-- ── Helper: check if user owns or participates in a deal ──
CREATE OR REPLACE FUNCTION public.is_deal_accessible(_user_id uuid, _deal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = _deal_id
      AND (
        created_by = _user_id
        OR deal_kind = 'demo'
        OR deal_kind = 'template'
        OR EXISTS (
          SELECT 1 FROM public.deal_participants dp
          WHERE dp.deal_id = _deal_id AND dp.user_id = _user_id
        )
      )
  )
$$;

-- ── Deals: tighten visibility ──
-- Drop old demo-visibility policy (already removed, but idempotent)
DROP POLICY IF EXISTS "All authenticated can view demo deals" ON public.deals;

-- Update the main participant visibility policy to also check created_by
DROP POLICY IF EXISTS "Participants can view their deals" ON public.deals;
CREATE POLICY "Users can view accessible deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR deal_kind = 'template'
    OR EXISTS (
      SELECT 1 FROM public.deal_participants dp
      WHERE dp.deal_id = deals.id AND dp.user_id = auth.uid()
    )
  );

-- ── Child tables: use parent deal ownership via the helper function ──
-- conditions
DROP POLICY IF EXISTS "Participants view conditions" ON public.conditions;
CREATE POLICY "Users view conditions via deal access" ON public.conditions
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- cap_table_entries
DROP POLICY IF EXISTS "Participants view cap table" ON public.cap_table_entries;
CREATE POLICY "Users view cap_table via deal access" ON public.cap_table_entries
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- contract_documents
DROP POLICY IF EXISTS "Participants view contract_documents" ON public.contract_documents;
CREATE POLICY "Users view contract_docs via deal access" ON public.contract_documents
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- deal_approvals
DROP POLICY IF EXISTS "Participants view deal approvals" ON public.deal_approvals;
CREATE POLICY "Users view approvals via deal access" ON public.deal_approvals
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- deal_participants
DROP POLICY IF EXISTS "Participants view own participation" ON public.deal_participants;
CREATE POLICY "Users view participants via deal access" ON public.deal_participants
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- deal_settings
DROP POLICY IF EXISTS "Participants view deal_settings" ON public.deal_settings;
CREATE POLICY "Users view settings via deal access" ON public.deal_settings
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- escrow_accounts
DROP POLICY IF EXISTS "Participants view escrow accounts" ON public.escrow_accounts;
CREATE POLICY "Users view escrow via deal access" ON public.escrow_accounts
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- escrow_transactions
DROP POLICY IF EXISTS "Participants view escrow" ON public.escrow_transactions;
CREATE POLICY "Users view escrow_txns via deal access" ON public.escrow_transactions
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- waterfall_tiers
DROP POLICY IF EXISTS "Participants view waterfall_tiers" ON public.waterfall_tiers;
CREATE POLICY "Users view waterfall_tiers via deal access" ON public.waterfall_tiers
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- deal_user_roles
DROP POLICY IF EXISTS "Participants view deal_user_roles" ON public.deal_user_roles;
CREATE POLICY "Users view deal_user_roles via deal access" ON public.deal_user_roles
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- obligations
DROP POLICY IF EXISTS "Participants view obligations" ON public.obligations;
CREATE POLICY "Users view obligations via deal access" ON public.obligations
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- disbursement_intents
DROP POLICY IF EXISTS "Participants view disbursement_intents" ON public.disbursement_intents;
CREATE POLICY "Users view disbursements via deal access" ON public.disbursement_intents
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- payment_instructions
DROP POLICY IF EXISTS "Participants view payment_instructions" ON public.payment_instructions;
CREATE POLICY "Users view payments via deal access" ON public.payment_instructions
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- ontology_documents
DROP POLICY IF EXISTS "Participants view ontology_documents" ON public.ontology_documents;
CREATE POLICY "Users view ontology_docs via deal access" ON public.ontology_documents
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- ontology_approvals
DROP POLICY IF EXISTS "Participants view ontology_approvals" ON public.ontology_approvals;
CREATE POLICY "Users view ontology_approvals via deal access" ON public.ontology_approvals
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- audit_events
DROP POLICY IF EXISTS "Participants view audit_events" ON public.audit_events;
CREATE POLICY "Users view audit_events via deal access" ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- execution_events
DROP POLICY IF EXISTS "Participants view execution_events" ON public.execution_events;
CREATE POLICY "Users view execution_events via deal access" ON public.execution_events
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- fx_quotes
DROP POLICY IF EXISTS "Participants view fx_quotes" ON public.fx_quotes;
CREATE POLICY "Users view fx_quotes via deal access" ON public.fx_quotes
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- deal_comments
DROP POLICY IF EXISTS "Participants view deal_comments" ON public.deal_comments;
CREATE POLICY "Users view comments via deal access" ON public.deal_comments
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- discrepancies
DROP POLICY IF EXISTS "Participants view discrepancies" ON public.discrepancies;
CREATE POLICY "Users view discrepancies via deal access" ON public.discrepancies
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));

-- consideration_records
DROP POLICY IF EXISTS "Participants view consideration_records" ON public.consideration_records;
CREATE POLICY "Users view consideration via deal access" ON public.consideration_records
  FOR SELECT TO authenticated
  USING (public.is_deal_accessible(auth.uid(), deal_id));
