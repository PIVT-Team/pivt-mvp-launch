
-- Create deal_documents table for document ingestion pipeline
CREATE TABLE public.deal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_path TEXT,
  mime_type TEXT,
  page_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading',
  doc_type TEXT DEFAULT 'other',
  doc_type_confidence NUMERIC DEFAULT 0,
  extracted_text TEXT,
  extracted_fields JSONB DEFAULT '{}'::jsonb,
  validation_flags JSONB DEFAULT '[]'::jsonb,
  uploaded_by TEXT DEFAULT 'Current User',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

-- Policies: for now allow all authenticated users (demo-friendly)
CREATE POLICY "Authenticated users can view deal documents"
  ON public.deal_documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert deal documents"
  ON public.deal_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update deal documents"
  ON public.deal_documents FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete deal documents"
  ON public.deal_documents FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Allow anonymous access for demo mode
CREATE POLICY "Anon can view deal documents"
  ON public.deal_documents FOR SELECT
  USING (true);

CREATE POLICY "Anon can insert deal documents"
  ON public.deal_documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can update deal documents"
  ON public.deal_documents FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_deal_documents_updated_at
  BEFORE UPDATE ON public.deal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for deal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload deal documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-documents');

CREATE POLICY "Anyone can view deal documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-documents');
