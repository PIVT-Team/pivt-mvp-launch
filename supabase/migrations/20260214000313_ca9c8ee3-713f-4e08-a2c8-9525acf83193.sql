
-- KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'draft', 'submitted', 'in_review', 'approved', 'rejected');

-- Individual KYC
CREATE TABLE public.user_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kyc_type TEXT NOT NULL DEFAULT 'individual',
  full_legal_name TEXT,
  date_of_birth DATE,
  nationality TEXT,
  residential_address TEXT,
  role_at_org TEXT,
  status kyc_status NOT NULL DEFAULT 'not_started',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Organization KYB
CREATE TABLE public.org_kyb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_entity_name TEXT,
  country_jurisdiction TEXT,
  registration_number TEXT,
  registered_address TEXT,
  status kyc_status NOT NULL DEFAULT 'not_started',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- KYC/KYB document uploads metadata (files stored in storage)
CREATE TABLE public.kyc_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'org')),
  owner_id UUID NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('government_id', 'proof_of_address', 'incorporation_doc', 'beneficial_ownership', 'authorization_letter', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_kyb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_uploads ENABLE ROW LEVEL SECURITY;

-- user_kyc policies
CREATE POLICY "Users view own kyc" ON public.user_kyc FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own kyc" ON public.user_kyc FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own kyc" ON public.user_kyc FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all kyc" ON public.user_kyc FOR ALL USING (has_role(auth.uid(), 'admin'));

-- org_kyb policies
CREATE POLICY "Users view own kyb" ON public.org_kyb FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own kyb" ON public.org_kyb FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own kyb" ON public.org_kyb FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all kyb" ON public.org_kyb FOR ALL USING (has_role(auth.uid(), 'admin'));

-- kyc_uploads policies
CREATE POLICY "Users view own uploads" ON public.kyc_uploads FOR SELECT USING (
  (owner_type = 'user' AND owner_id IN (SELECT id FROM public.user_kyc WHERE user_id = auth.uid()))
  OR (owner_type = 'org' AND owner_id IN (SELECT id FROM public.org_kyb WHERE user_id = auth.uid()))
);
CREATE POLICY "Users insert own uploads" ON public.kyc_uploads FOR INSERT WITH CHECK (
  (owner_type = 'user' AND owner_id IN (SELECT id FROM public.user_kyc WHERE user_id = auth.uid()))
  OR (owner_type = 'org' AND owner_id IN (SELECT id FROM public.org_kyb WHERE user_id = auth.uid()))
);
CREATE POLICY "Admins manage all uploads" ON public.kyc_uploads FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_user_kyc_updated_at BEFORE UPDATE ON public.user_kyc
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_kyb_updated_at BEFORE UPDATE ON public.org_kyb
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

CREATE POLICY "Users upload own kyc docs" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own kyc docs" ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins manage kyc docs" ON storage.objects FOR ALL
USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'));
