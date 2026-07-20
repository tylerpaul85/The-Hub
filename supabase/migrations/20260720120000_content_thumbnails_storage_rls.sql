-- ============================================================
-- Content Thumbnails Storage Bucket RLS Migration
-- Ensures content-thumbnails bucket exists and grants full upload/select permissions to authenticated users
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-thumbnails', 'content-thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop any conflicting or restrictive policies
DROP POLICY IF EXISTS "Allow authenticated insert to content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete content-thumbnails" ON storage.objects;

-- Create comprehensive policies for content-thumbnails bucket
CREATE POLICY "Allow authenticated insert to content-thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-thumbnails');

CREATE POLICY "Allow authenticated select content-thumbnails"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'content-thumbnails');

CREATE POLICY "Allow public select content-thumbnails"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'content-thumbnails');

CREATE POLICY "Allow authenticated update content-thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'content-thumbnails');

CREATE POLICY "Allow authenticated delete content-thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'content-thumbnails');
