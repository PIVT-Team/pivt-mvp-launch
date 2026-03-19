
-- Sequence for access request ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.access_request_seq START 1;

-- Access requests table
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  contact_email text NOT NULL,
  company text NOT NULL,
  position text NOT NULL,
  message text,
  source text NOT NULL DEFAULT 'demo_request_access',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER update_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate ticket ID
CREATE OR REPLACE FUNCTION public.generate_access_request_ticket()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE seq_val BIGINT;
BEGIN
  IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN
    seq_val := nextval('public.access_request_seq');
    NEW.ticket_id := 'PIVT-REQ-' || lpad(seq_val::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_access_request_ticket
  BEFORE INSERT ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_access_request_ticket();

-- RLS: public insert (no auth required for lead capture), admin read
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert access requests"
  ON public.access_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view access requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
