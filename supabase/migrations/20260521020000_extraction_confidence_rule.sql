-- Follow-up to 20260521010000. Registers one additional discrepancy rule.
--
-- Kept as its own file rather than edited into the previous migration, which
-- has already been applied — applied migrations should stay immutable so the
-- file history matches what actually ran against the database.
--
-- SAFETY: one idempotent INSERT. Safe to run more than once.

INSERT INTO public.discrepancy_rules (rule_key, name, description, severity, enabled, scope, config)
VALUES (
  'low_extraction_confidence',
  'Low Extraction Confidence',
  'A document whose AI extraction scored below the confidence threshold is supplying values to closing checks without human review.',
  'warn',
  true,
  'document',
  '{"min_confidence": 0.7}'
)
ON CONFLICT (rule_key) DO NOTHING;
