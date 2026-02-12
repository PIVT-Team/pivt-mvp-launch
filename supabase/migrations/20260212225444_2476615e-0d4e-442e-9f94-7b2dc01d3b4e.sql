
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'participant');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'participant',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  organization TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name TEXT NOT NULL,
  deal_value NUMERIC NOT NULL DEFAULT 0,
  closing_date DATE,
  escrow_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closing', 'closed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Deal participants
CREATE TABLE public.deal_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  party_role TEXT NOT NULL DEFAULT 'viewer' CHECK (party_role IN ('buyer_counsel', 'seller_counsel', 'fund', 'pe_associate', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, user_id)
);
ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;

-- Cap table entries
CREATE TABLE public.cap_table_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  shareholder_name TEXT NOT NULL,
  ownership_pct NUMERIC NOT NULL DEFAULT 0,
  payout_amount NUMERIC NOT NULL DEFAULT 0,
  escrow_holdback NUMERIC DEFAULT 0,
  fees NUMERIC DEFAULT 0,
  net_payout NUMERIC GENERATED ALWAYS AS (payout_amount - COALESCE(escrow_holdback, 0) - COALESCE(fees, 0)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cap_table_entries ENABLE ROW LEVEL SECURITY;

-- Escrow tracking
CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'executed', 'released')),
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Approvals
CREATE TABLE public.deal_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  approval_side TEXT NOT NULL CHECK (approval_side IN ('buyer', 'seller')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_approvals ENABLE ROW LEVEL SECURITY;

-- Audit log (immutable)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Validation results
CREATE TABLE public.validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE NOT NULL,
  check_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('validated', 'discrepancy', 'blocking')),
  message TEXT,
  affected_field TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'participant');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON public.deal_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS POLICIES

-- Profiles: users see own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles: users can see own roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- Admins can manage roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Deals: admins see all, participants see their deals
CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants can view their deals" ON public.deals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = id AND dp.user_id = auth.uid())
);

-- Deal participants
CREATE POLICY "Admins manage participants" ON public.deal_participants FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants view own participation" ON public.deal_participants FOR SELECT USING (auth.uid() = user_id);

-- Cap table
CREATE POLICY "Admins manage cap table" ON public.cap_table_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants view cap table" ON public.cap_table_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = cap_table_entries.deal_id AND dp.user_id = auth.uid())
);

-- Escrow
CREATE POLICY "Admins manage escrow" ON public.escrow_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants view escrow" ON public.escrow_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = escrow_transactions.deal_id AND dp.user_id = auth.uid())
);

-- Approvals
CREATE POLICY "Admins view all approvals" ON public.deal_approvals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users manage own approvals" ON public.deal_approvals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Participants view deal approvals" ON public.deal_approvals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = deal_approvals.deal_id AND dp.user_id = auth.uid())
);

-- Audit log: read-only for deal participants and admins
CREATE POLICY "Admins view audit log" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert audit log" ON public.audit_log FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Participants view deal audit" ON public.audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = audit_log.deal_id AND dp.user_id = auth.uid())
);

-- Validation results
CREATE POLICY "Admins manage validation" ON public.validation_results FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants view validation" ON public.validation_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.deal_participants dp WHERE dp.deal_id = validation_results.deal_id AND dp.user_id = auth.uid())
);
