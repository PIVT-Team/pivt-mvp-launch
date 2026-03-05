
-- Add verification tracking fields to cap_table_entries
ALTER TABLE public.cap_table_entries
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_provider text DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS verification_reference_id text;
