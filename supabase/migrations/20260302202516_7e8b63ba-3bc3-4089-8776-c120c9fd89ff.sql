
-- Backfill deal_number using a CTE instead of window function in UPDATE
WITH numbered AS (
  SELECT id, 'PIVT-' || to_char(created_at, 'YYYY') || '-' || lpad(ROW_NUMBER() OVER (ORDER BY created_at)::text, 6, '0') AS new_number
  FROM public.deals
  WHERE deal_number IS NULL OR deal_number = ''
)
UPDATE public.deals d
SET deal_number = numbered.new_number
FROM numbered
WHERE d.id = numbered.id;
