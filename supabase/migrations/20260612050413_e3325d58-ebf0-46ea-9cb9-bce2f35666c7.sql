
CREATE POLICY "Auth can view toolbox files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'toolbox');
CREATE POLICY "Auth can upload toolbox files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'toolbox');
CREATE POLICY "Auth can update toolbox files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'toolbox');
CREATE POLICY "Auth can delete toolbox files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'toolbox');
