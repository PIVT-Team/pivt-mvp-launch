-- Add stakeholder metadata columns to cap_table_entries
ALTER TABLE public.cap_table_entries
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Shareholder',
  ADD COLUMN IF NOT EXISTS stakeholder_type text NOT NULL DEFAULT 'individual';

-- Create a validation trigger for ownership basis limits
CREATE OR REPLACE FUNCTION public.validate_ownership_basis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  basis text;
  current_total numeric;
  new_total numeric;
BEGIN
  -- Determine ownership basis from role
  basis := CASE
    WHEN NEW.role IN ('Seller', 'Target', 'Shareholder', 'Founder', 'Employee', 'Advisor') THEN 'SELLER_EQUITY'
    WHEN NEW.role IN ('Buyer', 'Merger Sub', 'Investor', 'LP') THEN 'BUYER_EQUITY'
    ELSE 'NOT_APPLICABLE'
  END;

  -- Skip validation for non-equity roles
  IF basis = 'NOT_APPLICABLE' THEN
    RETURN NEW;
  END IF;

  -- Sum existing ownership for same basis, excluding current row (for updates)
  SELECT COALESCE(SUM(ownership_pct), 0) INTO current_total
  FROM public.cap_table_entries
  WHERE deal_id = NEW.deal_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND role IN (
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Seller'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Target'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Shareholder'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Founder'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Employee'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'SELLER_EQUITY' THEN 'Advisor'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'BUYER_EQUITY' THEN 'Buyer'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'BUYER_EQUITY' THEN 'Merger Sub'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'BUYER_EQUITY' THEN 'Investor'
        ELSE '__no_match__'
      END,
      CASE basis
        WHEN 'BUYER_EQUITY' THEN 'LP'
        ELSE '__no_match__'
      END
    );

  new_total := current_total + NEW.ownership_pct;

  IF new_total > 100 THEN
    RAISE EXCEPTION '% ownership cannot exceed 100%% (current: %%%, adding: %%%)',
      CASE basis WHEN 'SELLER_EQUITY' THEN 'Seller-side' ELSE 'Buyer-side' END,
      current_total,
      NEW.ownership_pct
    USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ownership_basis
  BEFORE INSERT OR UPDATE ON public.cap_table_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ownership_basis();