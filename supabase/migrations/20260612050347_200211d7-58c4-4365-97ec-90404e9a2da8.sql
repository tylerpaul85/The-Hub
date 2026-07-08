
CREATE TABLE public.toolbox_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  agent_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_listings TO authenticated;
GRANT ALL ON public.toolbox_listings TO service_role;
ALTER TABLE public.toolbox_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view listings" ON public.toolbox_listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert listings" ON public.toolbox_listings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update listings" ON public.toolbox_listings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete listings" ON public.toolbox_listings FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_toolbox_listings_updated BEFORE UPDATE ON public.toolbox_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.toolbox_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.toolbox_listings(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  file_url TEXT,
  drive_url TEXT,
  thumbnail_url TEXT,
  name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_assets TO authenticated;
GRANT ALL ON public.toolbox_assets TO service_role;
ALTER TABLE public.toolbox_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view toolbox_assets" ON public.toolbox_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert toolbox_assets" ON public.toolbox_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update toolbox_assets" ON public.toolbox_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete toolbox_assets" ON public.toolbox_assets FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_toolbox_assets_listing ON public.toolbox_assets(listing_id);

CREATE TABLE public.toolbox_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.toolbox_listings(id) ON DELETE CASCADE,
  caption_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_captions TO authenticated;
GRANT ALL ON public.toolbox_captions TO service_role;
ALTER TABLE public.toolbox_captions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view toolbox_captions" ON public.toolbox_captions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert toolbox_captions" ON public.toolbox_captions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update toolbox_captions" ON public.toolbox_captions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete toolbox_captions" ON public.toolbox_captions FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_toolbox_captions_listing ON public.toolbox_captions(listing_id);

CREATE TABLE public.toolbox_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_brand_assets TO authenticated;
GRANT ALL ON public.toolbox_brand_assets TO service_role;
ALTER TABLE public.toolbox_brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand_assets" ON public.toolbox_brand_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert brand_assets" ON public.toolbox_brand_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update brand_assets" ON public.toolbox_brand_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete brand_assets" ON public.toolbox_brand_assets FOR DELETE TO authenticated USING (true);

CREATE TABLE public.toolbox_educational (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT,
  drive_url TEXT,
  caption TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_educational TO authenticated;
GRANT ALL ON public.toolbox_educational TO service_role;
ALTER TABLE public.toolbox_educational ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view educational" ON public.toolbox_educational FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert educational" ON public.toolbox_educational FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update educational" ON public.toolbox_educational FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete educational" ON public.toolbox_educational FOR DELETE TO authenticated USING (true);
