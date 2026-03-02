-- Add unique index on deal_number to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS deals_deal_number_unique ON public.deals(deal_number);

-- Ensure deal_number column is NOT NULL (trigger always fills it)
ALTER TABLE public.deals ALTER COLUMN deal_number SET NOT NULL;