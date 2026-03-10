
-- Add extended fields to deal_approvals for DocuSign workflow
ALTER TABLE public.deal_approvals
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS approver_email text,
  ADD COLUMN IF NOT EXISTS approver_role text,
  ADD COLUMN IF NOT EXISTS approval_type text DEFAULT 'Legal Sign-off',
  ADD COLUMN IF NOT EXISTS required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'docusign',
  ADD COLUMN IF NOT EXISTS envelope_id text,
  ADD COLUMN IF NOT EXISTS recipient_id_ds text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_document_url text,
  ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocker_reason text,
  ADD COLUMN IF NOT EXISTS related_document_id uuid;

-- Create docusign_connections table
CREATE TABLE IF NOT EXISTS public.docusign_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  account_id text,
  account_name text,
  email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  base_uri text,
  status text NOT NULL DEFAULT 'disconnected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docusign_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docusign_conn_select" ON public.docusign_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "docusign_conn_insert" ON public.docusign_connections
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "docusign_conn_update" ON public.docusign_connections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "docusign_conn_delete" ON public.docusign_connections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
