-- Add INSERT policy for deal-documents storage bucket
CREATE POLICY "Authenticated users can upload deal documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deal-documents');