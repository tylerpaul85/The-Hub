
CREATE TABLE public.content_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT,
  file_path TEXT,
  drive_url TEXT,
  file_type TEXT,
  content_type TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  agent_name TEXT,
  listing_address TEXT,
  date_created DATE NOT NULL DEFAULT CURRENT_DATE,
  campaign_tag TEXT,
  notes TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_archive TO authenticated;
GRANT ALL ON public.content_archive TO service_role;

ALTER TABLE public.content_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view archive" ON public.content_archive FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert archive" ON public.content_archive FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Uploader or admin can update" ON public.content_archive FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Uploader or admin can delete" ON public.content_archive FOR DELETE TO authenticated USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_archive_updated_at BEFORE UPDATE ON public.content_archive FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX content_archive_created_at_idx ON public.content_archive(created_at DESC);
CREATE INDEX content_archive_content_type_idx ON public.content_archive(content_type);

-- Storage policies for content-archive bucket
CREATE POLICY "Auth can view archive files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'content-archive');
CREATE POLICY "Auth can upload archive files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-archive' AND auth.uid() = owner);
CREATE POLICY "Owner or admin can update archive files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'content-archive' AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Owner or admin can delete archive files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'content-archive' AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin')));
