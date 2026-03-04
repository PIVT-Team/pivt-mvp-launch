
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS buyer text,
ADD COLUMN IF NOT EXISTS seller text,
ADD COLUMN IF NOT EXISTS sector text,
ADD COLUMN IF NOT EXISTS deal_type text;
