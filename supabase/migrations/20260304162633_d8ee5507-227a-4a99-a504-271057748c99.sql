
-- 1) Add new columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2) Backfill existing data
UPDATE public.deals SET owner_id = NULL, visibility = 'global_demo', is_demo = true WHERE deal_kind = 'demo';
UPDATE public.deals SET owner_id = created_by, visibility = 'private', is_demo = false WHERE deal_kind = 'live' OR deal_kind IS NULL;
UPDATE public.deals SET owner_id = NULL, visibility = 'global_demo', is_demo = false WHERE deal_kind = 'template';

-- 3) Drop ALL existing RLS policies on deals
DROP POLICY IF EXISTS "Admins can manage deals" ON public.deals;
DROP POLICY IF EXISTS "All authenticated can view template deals" ON public.deals;
DROP POLICY IF EXISTS "Creator can update deals" ON public.deals;
DROP POLICY IF EXISTS "Demo deals are read-only for non-admins" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals" ON public.deals;
DROP POLICY IF EXISTS "Users can view accessible deals" ON public.deals;

-- 4) New RLS policies on deals
CREATE POLICY "deals_select" ON public.deals FOR SELECT TO authenticated
  USING (visibility = 'global_demo' OR owner_id = auth.uid());

CREATE POLICY "deals_insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND visibility = 'private');

CREATE POLICY "deals_update" ON public.deals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND visibility = 'private');

CREATE POLICY "deals_delete" ON public.deals FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND visibility = 'private');

-- 5) Create helper function for child table RLS
CREATE OR REPLACE FUNCTION public.can_access_deal(_user_id uuid, _deal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = _deal_id AND (visibility = 'global_demo' OR owner_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_deal(_user_id uuid, _deal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = _deal_id AND owner_id = _user_id AND visibility = 'private'
  )
$$;

-- 6) Rewrite child table policies using the new functions
-- For each child table: drop old policies, create new select + write policies

-- conditions
DROP POLICY IF EXISTS "Admins manage conditions" ON public.conditions;
DROP POLICY IF EXISTS "Participants insert conditions" ON public.conditions;
DROP POLICY IF EXISTS "Users view conditions via deal access" ON public.conditions;
CREATE POLICY "conditions_select" ON public.conditions FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "conditions_insert" ON public.conditions FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "conditions_update" ON public.conditions FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "conditions_delete" ON public.conditions FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- deal_participants
DROP POLICY IF EXISTS "Admins manage participants" ON public.deal_participants;
DROP POLICY IF EXISTS "Creator can add participants" ON public.deal_participants;
DROP POLICY IF EXISTS "Users view participants via deal access" ON public.deal_participants;
CREATE POLICY "deal_participants_select" ON public.deal_participants FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_participants_insert" ON public.deal_participants FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "deal_participants_delete" ON public.deal_participants FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- deal_settings
DROP POLICY IF EXISTS "Admins manage deal_settings" ON public.deal_settings;
DROP POLICY IF EXISTS "Anyone can insert deal_settings" ON public.deal_settings;
DROP POLICY IF EXISTS "Users view settings via deal access" ON public.deal_settings;
CREATE POLICY "deal_settings_select" ON public.deal_settings FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_settings_insert" ON public.deal_settings FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "deal_settings_update" ON public.deal_settings FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- deal_approvals
DROP POLICY IF EXISTS "Admins view all approvals" ON public.deal_approvals;
DROP POLICY IF EXISTS "Users manage own approvals" ON public.deal_approvals;
DROP POLICY IF EXISTS "Users view approvals via deal access" ON public.deal_approvals;
CREATE POLICY "deal_approvals_select" ON public.deal_approvals FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_approvals_insert" ON public.deal_approvals FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "deal_approvals_update" ON public.deal_approvals FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "deal_approvals_delete" ON public.deal_approvals FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- contract_documents
DROP POLICY IF EXISTS "Admins manage contract_documents" ON public.contract_documents;
DROP POLICY IF EXISTS "Participants insert contract_documents" ON public.contract_documents;
DROP POLICY IF EXISTS "Users view contract_docs via deal access" ON public.contract_documents;
CREATE POLICY "contract_documents_select" ON public.contract_documents FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "contract_documents_insert" ON public.contract_documents FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "contract_documents_update" ON public.contract_documents FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "contract_documents_delete" ON public.contract_documents FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- cap_table_entries
DROP POLICY IF EXISTS "Admins manage cap table" ON public.cap_table_entries;
DROP POLICY IF EXISTS "Participants insert cap_table" ON public.cap_table_entries;
DROP POLICY IF EXISTS "Users view cap_table via deal access" ON public.cap_table_entries;
CREATE POLICY "cap_table_select" ON public.cap_table_entries FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "cap_table_insert" ON public.cap_table_entries FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "cap_table_update" ON public.cap_table_entries FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "cap_table_delete" ON public.cap_table_entries FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- escrow_accounts
DROP POLICY IF EXISTS "Admins manage escrow" ON public.escrow_accounts;
CREATE POLICY "escrow_accounts_select" ON public.escrow_accounts FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "escrow_accounts_insert" ON public.escrow_accounts FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "escrow_accounts_update" ON public.escrow_accounts FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- escrow_transactions
DROP POLICY IF EXISTS "Admins manage escrow" ON public.escrow_transactions;
DROP POLICY IF EXISTS "Users view escrow_txns via deal access" ON public.escrow_transactions;
CREATE POLICY "escrow_txns_select" ON public.escrow_transactions FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "escrow_txns_insert" ON public.escrow_transactions FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- waterfall_tiers
DROP POLICY IF EXISTS "Admins manage waterfall_tiers" ON public.waterfall_tiers;
DROP POLICY IF EXISTS "Users view waterfall_tiers via deal access" ON public.waterfall_tiers;
CREATE POLICY "waterfall_tiers_select" ON public.waterfall_tiers FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "waterfall_tiers_insert" ON public.waterfall_tiers FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "waterfall_tiers_update" ON public.waterfall_tiers FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "waterfall_tiers_delete" ON public.waterfall_tiers FOR DELETE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- obligations
DROP POLICY IF EXISTS "Admins manage obligations" ON public.obligations;
DROP POLICY IF EXISTS "Participants insert obligations" ON public.obligations;
DROP POLICY IF EXISTS "Participants update obligations" ON public.obligations;
DROP POLICY IF EXISTS "Users view obligations via deal access" ON public.obligations;
CREATE POLICY "obligations_select" ON public.obligations FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "obligations_insert" ON public.obligations FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "obligations_update" ON public.obligations FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- discrepancies
DROP POLICY IF EXISTS "Admins manage discrepancies" ON public.discrepancies;
DROP POLICY IF EXISTS "Users view discrepancies via deal access" ON public.discrepancies;
CREATE POLICY "discrepancies_select" ON public.discrepancies FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "discrepancies_insert" ON public.discrepancies FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "discrepancies_update" ON public.discrepancies FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- disbursement_intents
DROP POLICY IF EXISTS "Admins manage disbursement_intents" ON public.disbursement_intents;
DROP POLICY IF EXISTS "Users view disbursements via deal access" ON public.disbursement_intents;
CREATE POLICY "disbursement_intents_select" ON public.disbursement_intents FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "disbursement_intents_insert" ON public.disbursement_intents FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "disbursement_intents_update" ON public.disbursement_intents FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- deal_parties
DROP POLICY IF EXISTS "Admins manage deal_parties" ON public.deal_parties;
DROP POLICY IF EXISTS "Participants view deal_parties" ON public.deal_parties;
CREATE POLICY "deal_parties_select" ON public.deal_parties FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_parties_insert" ON public.deal_parties FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- deal_user_roles
DROP POLICY IF EXISTS "Admins manage deal_user_roles" ON public.deal_user_roles;
DROP POLICY IF EXISTS "Users view deal_user_roles via deal access" ON public.deal_user_roles;
CREATE POLICY "deal_user_roles_select" ON public.deal_user_roles FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_user_roles_insert" ON public.deal_user_roles FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- deal_members
DROP POLICY IF EXISTS "Admins manage deal_members" ON public.deal_members;
DROP POLICY IF EXISTS "Members view own membership" ON public.deal_members;
CREATE POLICY "deal_members_select" ON public.deal_members FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_members_insert" ON public.deal_members FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- audit_events
DROP POLICY IF EXISTS "Admins manage audit_events" ON public.audit_events;
DROP POLICY IF EXISTS "Participants insert audit_events" ON public.audit_events;
DROP POLICY IF EXISTS "Users view audit_events via deal access" ON public.audit_events;
CREATE POLICY "audit_events_select" ON public.audit_events FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "audit_events_insert" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- execution_events
DROP POLICY IF EXISTS "Admins manage execution_events" ON public.execution_events;
DROP POLICY IF EXISTS "Executors insert execution_events" ON public.execution_events;
DROP POLICY IF EXISTS "Users view execution_events via deal access" ON public.execution_events;
CREATE POLICY "execution_events_select" ON public.execution_events FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "execution_events_insert" ON public.execution_events FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- deal_comments
DROP POLICY IF EXISTS "Admins view all comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Authors delete own comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Authors update own comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Participants insert comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Participants view deal comments" ON public.deal_comments;
DROP POLICY IF EXISTS "Users view comments via deal access" ON public.deal_comments;
CREATE POLICY "deal_comments_select" ON public.deal_comments FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "deal_comments_insert" ON public.deal_comments FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id) AND auth.uid() = author_user_id);
CREATE POLICY "deal_comments_update" ON public.deal_comments FOR UPDATE TO authenticated USING (auth.uid() = author_user_id AND can_write_deal(auth.uid(), deal_id));
CREATE POLICY "deal_comments_delete" ON public.deal_comments FOR DELETE TO authenticated USING (auth.uid() = author_user_id AND can_write_deal(auth.uid(), deal_id));

-- payment_instructions
DROP POLICY IF EXISTS "Admins manage payment_instructions" ON public.payment_instructions;
DROP POLICY IF EXISTS "Users view payments via deal access" ON public.payment_instructions;
CREATE POLICY "payment_instructions_select" ON public.payment_instructions FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "payment_instructions_insert" ON public.payment_instructions FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));
CREATE POLICY "payment_instructions_update" ON public.payment_instructions FOR UPDATE TO authenticated USING (can_write_deal(auth.uid(), deal_id));

-- ontology_approvals
DROP POLICY IF EXISTS "Admins manage ontology_approvals" ON public.ontology_approvals;
DROP POLICY IF EXISTS "Users view ontology_approvals via deal access" ON public.ontology_approvals;
CREATE POLICY "ontology_approvals_select" ON public.ontology_approvals FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "ontology_approvals_insert" ON public.ontology_approvals FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- ontology_documents
DROP POLICY IF EXISTS "Admins manage ontology_documents" ON public.ontology_documents;
DROP POLICY IF EXISTS "Users view ontology_documents via deal access" ON public.ontology_documents;
CREATE POLICY "ontology_documents_select" ON public.ontology_documents FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "ontology_documents_insert" ON public.ontology_documents FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- consideration_records
DROP POLICY IF EXISTS "Admins manage consideration_records" ON public.consideration_records;
DROP POLICY IF EXISTS "Users view consideration via deal access" ON public.consideration_records;
CREATE POLICY "consideration_records_select" ON public.consideration_records FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "consideration_records_insert" ON public.consideration_records FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- fx_quotes
DROP POLICY IF EXISTS "Admins manage fx_quotes" ON public.fx_quotes;
DROP POLICY IF EXISTS "Users view fx_quotes via deal access" ON public.fx_quotes;
CREATE POLICY "fx_quotes_select" ON public.fx_quotes FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "fx_quotes_insert" ON public.fx_quotes FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- validation_results
CREATE POLICY "validation_results_select" ON public.validation_results FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "validation_results_insert" ON public.validation_results FOR INSERT TO authenticated WITH CHECK (can_write_deal(auth.uid(), deal_id));

-- audit_log
DROP POLICY IF EXISTS "Admins insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Participants insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Participants view deal audit" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated USING (can_access_deal(auth.uid(), deal_id));
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update demo-reset function's deal inserts to include new columns
-- (This is handled in the edge function code, not SQL)
