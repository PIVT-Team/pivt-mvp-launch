CREATE TABLE public.counterparty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  firm_name TEXT,
  role_type TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  kyc_verified_at TIMESTAMPTZ,
  deals_participated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT counterparty_profiles_role_type_check CHECK (
    role_type IS NULL OR role_type = ANY (ARRAY['counsel', 'escrow_agent', 'paying_agent', 'financial_advisor', 'management_rep'])
  ),
  CONSTRAINT counterparty_profiles_kyc_status_check CHECK (
    kyc_status = ANY (ARRAY['pending', 'submitted', 'verified', 'failed'])
  ),
  CONSTRAINT counterparty_profiles_deals_participated_check CHECK (deals_participated >= 0)
);

ALTER TABLE public.counterparty_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own counterparty profile"
ON public.counterparty_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own counterparty profile"
ON public.counterparty_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own counterparty profile"
ON public.counterparty_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.saved_bank_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_profile_id UUID NOT NULL REFERENCES public.counterparty_profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  bank_name TEXT,
  routing_number TEXT,
  swift_code TEXT,
  account_number_encrypted TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_bank_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved bank instructions"
ON public.saved_bank_instructions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = saved_bank_instructions.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own saved bank instructions"
ON public.saved_bank_instructions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = saved_bank_instructions.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own saved bank instructions"
ON public.saved_bank_instructions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = saved_bank_instructions.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = saved_bank_instructions.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own saved bank instructions"
ON public.saved_bank_instructions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = saved_bank_instructions.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
);

CREATE TABLE public.counterparty_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  counterparty_profile_id UUID REFERENCES public.counterparty_profiles(id) ON DELETE SET NULL,
  role_type TEXT,
  firm_name_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT counterparty_invitations_role_type_check CHECK (
    role_type IS NULL OR role_type = ANY (ARRAY['counsel', 'escrow_agent', 'paying_agent', 'financial_advisor', 'management_rep'])
  ),
  CONSTRAINT counterparty_invitations_status_check CHECK (
    status = ANY (ARRAY['pending', 'accepted', 'expired', 'revoked'])
  )
);

ALTER TABLE public.counterparty_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal editors can view counterparty invitations"
ON public.counterparty_invitations
FOR SELECT
TO authenticated
USING (can_access_deal(auth.uid(), deal_id));

CREATE POLICY "Deal editors can create counterparty invitations"
ON public.counterparty_invitations
FOR INSERT
TO authenticated
WITH CHECK (can_write_deal(auth.uid(), deal_id) AND auth.uid() = invited_by);

CREATE POLICY "Deal editors can update counterparty invitations"
ON public.counterparty_invitations
FOR UPDATE
TO authenticated
USING (can_write_deal(auth.uid(), deal_id))
WITH CHECK (can_write_deal(auth.uid(), deal_id));

CREATE TABLE public.counterparty_kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_profile_id UUID NOT NULL REFERENCES public.counterparty_profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT counterparty_kyc_documents_review_status_check CHECK (
    review_status = ANY (ARRAY['pending', 'approved', 'rejected'])
  )
);

ALTER TABLE public.counterparty_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own KYC documents"
ON public.counterparty_kyc_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = counterparty_kyc_documents.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
  OR can_access_deal(auth.uid(), deal_id)
);

CREATE POLICY "Users can create their own KYC documents"
ON public.counterparty_kyc_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = counterparty_kyc_documents.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Deal editors can review KYC documents"
ON public.counterparty_kyc_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = counterparty_kyc_documents.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
  OR can_write_deal(auth.uid(), deal_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.counterparty_profiles cp
    WHERE cp.id = counterparty_kyc_documents.counterparty_profile_id
      AND cp.user_id = auth.uid()
  )
  OR can_write_deal(auth.uid(), deal_id)
);

CREATE INDEX idx_counterparty_profiles_user_id
ON public.counterparty_profiles(user_id);

CREATE INDEX idx_saved_bank_instructions_profile_id
ON public.saved_bank_instructions(counterparty_profile_id);

CREATE INDEX idx_counterparty_invitations_deal_id
ON public.counterparty_invitations(deal_id);

CREATE INDEX idx_counterparty_invitations_email
ON public.counterparty_invitations(lower(email));

CREATE INDEX idx_counterparty_kyc_documents_profile_id
ON public.counterparty_kyc_documents(counterparty_profile_id);

CREATE INDEX idx_counterparty_kyc_documents_deal_id
ON public.counterparty_kyc_documents(deal_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('counterparty-kyc', 'counterparty-kyc', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Counterparties can upload their own KYC files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'counterparty-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Counterparties can view their own KYC files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'counterparty-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Counterparties can update their own KYC files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'counterparty-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'counterparty-kyc'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Deal editors can view shared KYC files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'counterparty-kyc'
  AND EXISTS (
    SELECT 1
    FROM public.counterparty_kyc_documents d
    JOIN public.counterparty_profiles cp ON cp.id = d.counterparty_profile_id
    WHERE d.file_path = name
      AND can_access_deal(auth.uid(), d.deal_id)
  )
);