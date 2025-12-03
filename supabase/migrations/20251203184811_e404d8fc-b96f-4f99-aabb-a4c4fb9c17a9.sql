-- Create RLS policies for campaign-media bucket

-- Policy: Anyone can read campaign media (bucket is public)
CREATE POLICY "Anyone can read campaign media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campaign-media');

-- Policy: Authenticated users can upload media to their own folder
CREATE POLICY "Users can upload media to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Authenticated users can update their own media
CREATE POLICY "Users can update own media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Authenticated users can delete their own media
CREATE POLICY "Users can delete own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);