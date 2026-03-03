
-- Add seed_key column for idempotent demo seeding
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS seed_key text UNIQUE;

-- Set seed_key on existing Atlas deal
UPDATE public.deals SET seed_key = 'atlas_demo' WHERE id = 'a0000000-0000-0000-0000-000000000001';
