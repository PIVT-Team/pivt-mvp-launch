
-- Verification request statuses
CREATE TYPE public.verification_request_status AS ENUM ('pending', 'sent', 'opened', 'submitted', 'verified', 'expired', 'revoked');

-- Verification requests table
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id uuid NOT NULL REFERENCES public.cap_table_entries(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  stakeholder_type text NOT NULL DEFAULT 'individual',
  token_hash text NOT NULL,
  status public.verification_request_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submission_data jsonb,
  created_by uuid
);

-- Indexes
CREATE INDEX idx_verification_requests_token ON public.verification_requests(token_hash);
CREATE INDEX idx_verification_requests_stakeholder ON public.verification_requests(stakeholder_id);
CREATE INDEX idx_verification_requests_deal ON public.verification_requests(deal_id);

-- RLS
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Deal owners can manage verification requests
CREATE POLICY "verification_requests_select" ON public.verification_requests
  FOR SELECT TO authenticated
  USING (can_access_deal(auth.uid(), deal_id));

CREATE POLICY "verification_requests_insert" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (can_write_deal(auth.uid(), deal_id));

CREATE POLICY "verification_requests_update" ON public.verification_requests
  FOR UPDATE TO authenticated
  USING (can_write_deal(auth.uid(), deal_id));

-- Public access for token-based verification (anon role via edge functions)
CREATE POLICY "verification_requests_anon_select" ON public.verification_requests
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "verification_requests_anon_update" ON public.verification_requests
  FOR UPDATE TO anon
  USING (true);

-- Add verification_status to cap_table_entries
ALTER TABLE public.cap_table_entries
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_sent';

-- Updated at trigger
CREATE TRIGGER update_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
