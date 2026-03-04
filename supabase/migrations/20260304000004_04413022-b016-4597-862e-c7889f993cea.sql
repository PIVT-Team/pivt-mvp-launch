
-- 1. Create deal_kind enum
CREATE TYPE public.deal_kind AS ENUM ('demo', 'template', 'live');

-- 2. Add deal_kind column
ALTER TABLE public.deals ADD COLUMN deal_kind public.deal_kind NOT NULL DEFAULT 'live';

-- 3. Mark existing seeded deals as demo
UPDATE public.deals SET deal_kind = 'demo' WHERE seed_key IS NOT NULL;

-- 4. Expand status check constraint to include 'template' and 'settled'
ALTER TABLE public.deals DROP CONSTRAINT deals_status_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_status_check CHECK (status = ANY (ARRAY['draft','active','closing','closed','template','settled']));

-- 5. Create two template deals
INSERT INTO public.deals (deal_name, deal_value, deal_number, status, deal_kind, seed_key)
VALUES
  ('Standard M&A Close', 0, '', 'template', 'template', 'tpl_standard_ma'),
  ('Credit Facility / Escrow', 0, '', 'template', 'template', 'tpl_credit_facility');

-- 6. Seed template conditions for Standard M&A
INSERT INTO public.conditions (deal_id, title, status)
SELECT d.id, t.title, 'NOT_STARTED'::condition_status
FROM public.deals d
CROSS JOIN (VALUES
  ('SPA Fully Executed'),
  ('Fund Flow Instructions Verified'),
  ('All KYC/KYB Approved'),
  ('Board Resolution Approved'),
  ('Regulatory Approval Received'),
  ('Escrow Funded')
) AS t(title)
WHERE d.seed_key = 'tpl_standard_ma';

-- 7. Seed template conditions for Credit Facility
INSERT INTO public.conditions (deal_id, title, status)
SELECT d.id, t.title, 'NOT_STARTED'::condition_status
FROM public.deals d
CROSS JOIN (VALUES
  ('Lender Approval Received'),
  ('Tranche Schedule Confirmed'),
  ('Fund Flow Instructions Verified'),
  ('All KYC/KYB Approved'),
  ('Escrow Account Opened'),
  ('Compliance Sign-off')
) AS t(title)
WHERE d.seed_key = 'tpl_credit_facility';

-- 8. RLS: demo deals readable by all authenticated
CREATE POLICY "All authenticated can view demo deals"
ON public.deals FOR SELECT TO authenticated
USING (deal_kind = 'demo');

-- 9. Template deals readable by all authenticated
CREATE POLICY "All authenticated can view template deals"
ON public.deals FOR SELECT TO authenticated
USING (deal_kind = 'template');

-- 10. Prevent non-admin edits to demo deals
CREATE POLICY "Demo deals are read-only for non-admins"
ON public.deals FOR UPDATE TO authenticated
USING (deal_kind != 'demo' OR has_role(auth.uid(), 'admin'));
