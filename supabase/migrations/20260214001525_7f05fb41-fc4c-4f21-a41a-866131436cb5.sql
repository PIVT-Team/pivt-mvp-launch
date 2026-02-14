
-- Add banking/wire fields to user_kyc
ALTER TABLE public.user_kyc
  ADD COLUMN bank_name TEXT,
  ADD COLUMN bank_address TEXT,
  ADD COLUMN account_holder_name TEXT,
  ADD COLUMN account_number_last4 TEXT,
  ADD COLUMN routing_number TEXT,
  ADD COLUMN swift_bic TEXT,
  ADD COLUMN iban TEXT,
  ADD COLUMN bank_country TEXT,
  ADD COLUMN wire_currency TEXT DEFAULT 'USD',
  ADD COLUMN intermediary_bank TEXT,
  ADD COLUMN bank_verified BOOLEAN DEFAULT false;
