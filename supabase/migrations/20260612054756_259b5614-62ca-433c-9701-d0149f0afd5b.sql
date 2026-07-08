
CREATE POLICY "task-deliverables read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-deliverables');
CREATE POLICY "task-deliverables insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-deliverables');
CREATE POLICY "task-deliverables update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task-deliverables');
CREATE POLICY "task-deliverables delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-deliverables');
