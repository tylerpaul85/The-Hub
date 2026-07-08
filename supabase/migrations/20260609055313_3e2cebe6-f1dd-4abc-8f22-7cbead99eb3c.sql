
CREATE POLICY "Auth read thumbnails" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'content-thumbnails');
CREATE POLICY "Auth upload thumbnails" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-thumbnails');
CREATE POLICY "Auth update own thumbnails" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'content-thumbnails' AND owner = auth.uid());
CREATE POLICY "Auth delete own thumbnails" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'content-thumbnails' AND owner = auth.uid());
