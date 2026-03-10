-- Add DELETE policy for deal-documents bucket
CREATE POLICY "Authenticated users can delete deal documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'deal-documents');

-- Add UPDATE policy for deal-documents bucket
CREATE POLICY "Authenticated users can update deal documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'deal-documents')
WITH CHECK (bucket_id = 'deal-documents');