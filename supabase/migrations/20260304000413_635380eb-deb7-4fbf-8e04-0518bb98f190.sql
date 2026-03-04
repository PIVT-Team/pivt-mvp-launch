
-- Add a template_blueprint JSONB column to deals for template deals only
-- This stores role_slots, compliance_checks, document_categories, approval_requirements
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS template_blueprint jsonb DEFAULT NULL;

-- Update the Standard M&A Close template with full blueprint
UPDATE public.deals
SET template_blueprint = '{
  "role_slots": [
    {"label": "Buyer", "required": true},
    {"label": "Seller", "required": true},
    {"label": "Buyer Counsel", "required": true},
    {"label": "Seller Counsel", "required": true},
    {"label": "Escrow Agent", "required": true}
  ],
  "compliance_checks": [
    {"label": "KYC – Individual Identity Verification", "category": "kyc"},
    {"label": "KYB – Entity Verification", "category": "kyb"},
    {"label": "Sanctions Screening (OFAC/EU/UN)", "category": "sanctions"},
    {"label": "UBO Verification", "category": "ubo"}
  ],
  "document_categories": [
    {"label": "Stock Purchase Agreement (SPA)", "doc_type": "SPA"},
    {"label": "Schedules & Exhibits", "doc_type": "SCHEDULE"},
    {"label": "Cap Table", "doc_type": "CAP_TABLE"},
    {"label": "Board Resolutions", "doc_type": "BOARD_RESOLUTION"},
    {"label": "Closing Statement", "doc_type": "CLOSING_STATEMENT"}
  ],
  "approval_requirements": [
    {"label": "Buyer Counsel Approval", "role": "buyer_counsel"},
    {"label": "Seller Counsel Approval", "role": "seller_counsel"},
    {"label": "Deal Administrator Approval", "role": "deal_admin"}
  ]
}'::jsonb
WHERE seed_key = 'tpl_standard_ma';

-- Delete existing conditions for the template and re-seed with the full set
DELETE FROM public.conditions WHERE deal_id = (SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma');

INSERT INTO public.conditions (deal_id, title, status) VALUES
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'SPA Fully Executed', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Board Approvals Obtained', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Funds Confirmed in Escrow', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Escrow Account Established', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Payment Instructions Verified', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'All KYC/KYB Approved', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Sanctions Screening Clear', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'UBO Verification Complete', 'NOT_STARTED'),
  ((SELECT id FROM public.deals WHERE seed_key = 'tpl_standard_ma'), 'Regulatory Approval Received', 'NOT_STARTED');
