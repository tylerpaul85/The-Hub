
CREATE TABLE public.staging_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_image_url text NOT NULL,
  room_type text,
  style text,
  prompt text,
  status text NOT NULL DEFAULT 'pending',
  result_urls jsonb,
  error_message text,
  listing_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staging_jobs TO authenticated;
GRANT ALL ON public.staging_jobs TO service_role;

ALTER TABLE public.staging_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX staging_jobs_user_id_idx ON public.staging_jobs(user_id);
CREATE INDEX staging_jobs_created_at_idx ON public.staging_jobs(created_at DESC);

CREATE POLICY "Users can view their own staging jobs"
  ON public.staging_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own staging jobs"
  ON public.staging_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own staging jobs"
  ON public.staging_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own staging jobs"
  ON public.staging_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Storage policies for staging-uploads bucket (private bucket; use signed URLs from server)
CREATE POLICY "Users can upload to their own folder in staging-uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'staging-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own staging-uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'staging-uploads'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can update their own staging-uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'staging-uploads'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can delete their own staging-uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'staging-uploads'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
  );
