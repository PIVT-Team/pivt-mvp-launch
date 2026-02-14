
-- Create escrow_accounts table for partner bank escrow architecture
CREATE TABLE public.escrow_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'FBO' CHECK (account_type IN ('FBO', 'Dedicated')),
  masked_account_number TEXT,
  interest_rate NUMERIC NOT NULL DEFAULT 4.25,
  interest_split_platform_percent NUMERIC NOT NULL DEFAULT 15,
  interest_split_client_percent NUMERIC NOT NULL DEFAULT 85,
  opened_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deal_id)
);

-- Enable RLS
ALTER TABLE public.escrow_accounts ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage escrow accounts"
ON public.escrow_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Participants can view escrow accounts for their deals
CREATE POLICY "Participants view escrow accounts"
ON public.escrow_accounts
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM deal_participants dp
  WHERE dp.deal_id = escrow_accounts.deal_id AND dp.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_escrow_accounts_updated_at
BEFORE UPDATE ON public.escrow_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
