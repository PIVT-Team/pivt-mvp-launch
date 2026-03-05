
-- Create verification_submissions table
CREATE TABLE public.verification_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_accepted boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_submissions ENABLE ROW LEVEL SECURITY;

-- Public access for token-based submissions (via edge functions with service role)
CREATE POLICY "verification_submissions_anon_insert" ON public.verification_submissions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "verification_submissions_select" ON public.verification_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.verification_requests vr
    WHERE vr.id = verification_submissions.verification_request_id
    AND can_access_deal(auth.uid(), vr.deal_id)
  ));

-- Create verification_documents table
CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  doc_type text NOT NULL DEFAULT 'OTHER',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_documents_anon_insert" ON public.verification_documents
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "verification_documents_select" ON public.verification_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.verification_requests vr
    WHERE vr.id = verification_documents.verification_request_id
    AND can_access_deal(auth.uid(), vr.deal_id)
  ));

-- Add manual review fields to verification_requests
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS verification_type text NOT NULL DEFAULT 'KYC',
  ADD COLUMN IF NOT EXISTS verified_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS manual_review_notes text;

-- Create verification-documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can upload (public portal uses presigned URLs via edge fn)
CREATE POLICY "verification_docs_upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'verification-documents');

CREATE POLICY "verification_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-documents');
