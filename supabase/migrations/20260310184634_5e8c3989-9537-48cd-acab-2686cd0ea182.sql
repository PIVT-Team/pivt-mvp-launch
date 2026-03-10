ALTER TYPE public.contract_doc_status ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE public.contract_doc_status ADD VALUE IF NOT EXISTS 'PARSED';
ALTER TYPE public.contract_doc_status ADD VALUE IF NOT EXISTS 'PARSE_FAILED';
ALTER TYPE public.contract_doc_status ADD VALUE IF NOT EXISTS 'VERIFIED';