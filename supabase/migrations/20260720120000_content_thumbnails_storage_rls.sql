-- ============================================================
-- Tasks, Marketing Requests & Content Storage Bucket RLS Migration
-- Ensures task-deliverables, marketing-request-uploads, and content-thumbnails
-- storage buckets exist and grant full upload/select permissions to authenticated users
-- ============================================================

-- 1. Ensure Buckets Exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('task-deliverables', 'task-deliverables', true),
  ('marketing-request-uploads', 'marketing-request-uploads', true),
  ('content-thumbnails', 'content-thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop any restrictive policies on storage.objects
DROP POLICY IF EXISTS "Allow authenticated insert to task-deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select task-deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select task-deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update task-deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete task-deliverables" ON storage.objects;
DROP POLICY IF EXISTS "task-deliverables insert auth" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated insert to marketing-request-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select marketing-request-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select marketing-request-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update marketing-request-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete marketing-request-uploads" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated insert to content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update content-thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete content-thumbnails" ON storage.objects;

-- 3. Create permissive policies for task-deliverables
CREATE POLICY "Allow authenticated insert to task-deliverables"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-deliverables');

CREATE POLICY "Allow authenticated select task-deliverables"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-deliverables');

CREATE POLICY "Allow public select task-deliverables"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'task-deliverables');

CREATE POLICY "Allow authenticated update task-deliverables"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'task-deliverables');

CREATE POLICY "Allow authenticated delete task-deliverables"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-deliverables');

-- 4. Create permissive policies for marketing-request-uploads
CREATE POLICY "Allow authenticated insert to marketing-request-uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing-request-uploads');

CREATE POLICY "Allow authenticated select marketing-request-uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketing-request-uploads');

CREATE POLICY "Allow public select marketing-request-uploads"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'marketing-request-uploads');

CREATE POLICY "Allow authenticated update marketing-request-uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketing-request-uploads');

CREATE POLICY "Allow authenticated delete marketing-request-uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketing-request-uploads');

-- 5. Create permissive policies for content-thumbnails
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
