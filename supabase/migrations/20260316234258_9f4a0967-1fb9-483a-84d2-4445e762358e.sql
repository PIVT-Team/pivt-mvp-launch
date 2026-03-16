
-- Add source metadata columns to cap_table_entries
ALTER TABLE public.cap_table_entries
  ADD COLUMN IF NOT EXISTS created_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_updated_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_reason text;

-- Add source metadata columns to wire_instructions
ALTER TABLE public.wire_instructions
  ADD COLUMN IF NOT EXISTS created_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_updated_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_reason text;

-- Add source metadata columns to payment_allocations
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS created_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_updated_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_reason text;

-- Add source metadata columns to discrepancies
ALTER TABLE public.discrepancies
  ADD COLUMN IF NOT EXISTS created_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_updated_by_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_reason text;
