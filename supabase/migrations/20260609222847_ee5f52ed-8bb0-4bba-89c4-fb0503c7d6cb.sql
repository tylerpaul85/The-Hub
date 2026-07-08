-- Marketing Requests feature
CREATE TABLE IF NOT EXISTS public.marketing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  agent_email text NOT NULL,
  request_types text[] NOT NULL DEFAULT '{}',
  scope text NOT NULL CHECK (scope IN ('personal','listing')),
  property_address text,
  deadline date,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  copy_notes text,
  file_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decline_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  converted_content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  converted_video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_requests TO authenticated;
GRANT INSERT ON public.marketing_requests TO anon;
GRANT ALL ON public.marketing_requests TO service_role;

ALTER TABLE public.marketing_requests ENABLE ROW LEVEL SECURITY;

-- Public form: anyone can submit
CREATE POLICY "Anyone can submit a marketing request"
  ON public.marketing_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Logged-in users can view all
CREATE POLICY "Authenticated users can view all marketing requests"
  ON public.marketing_requests FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update / delete
CREATE POLICY "Admins can update marketing requests"
  ON public.marketing_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete marketing requests"
  ON public.marketing_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_marketing_requests_updated_at
  BEFORE UPDATE ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify admins when a new request is submitted
CREATE OR REPLACE FUNCTION public.notify_admins_on_marketing_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT ur.user_id, 'marketing_request',
    'New marketing request from ' || NEW.agent_name,
    NULL
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_on_marketing_request
  AFTER INSERT ON public.marketing_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_marketing_request();

-- RLS for storage uploads bucket (bucket itself created via tool)
CREATE POLICY "Public can upload marketing request files"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'marketing-request-uploads');

CREATE POLICY "Public can read marketing request files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'marketing-request-uploads');