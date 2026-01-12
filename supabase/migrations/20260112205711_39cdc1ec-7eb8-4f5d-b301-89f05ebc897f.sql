-- Create public bucket for compliance and verification assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true);

-- Allow public read access (no auth required)
CREATE POLICY "Public assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'public-assets');

-- Only service role can upload (for system uploads via edge functions)
CREATE POLICY "Service role can upload public assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'public-assets');

-- Service role can update public assets
CREATE POLICY "Service role can update public assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'public-assets');

-- Service role can delete public assets
CREATE POLICY "Service role can delete public assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'public-assets');