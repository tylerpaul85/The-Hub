
CREATE TABLE public.toolbox_open_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  agent_name text,
  open_house_at timestamptz,
  status text NOT NULL DEFAULT 'upcoming',
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_open_houses TO authenticated;
GRANT ALL ON public.toolbox_open_houses TO service_role;
ALTER TABLE public.toolbox_open_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view open_houses" ON public.toolbox_open_houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert open_houses" ON public.toolbox_open_houses FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update open_houses" ON public.toolbox_open_houses FOR UPDATE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner or admin can delete open_houses" ON public.toolbox_open_houses FOR DELETE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.toolbox_open_house_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES public.toolbox_open_houses(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  file_url text,
  drive_url text,
  thumbnail_url text,
  name text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX toolbox_open_house_assets_oh_idx ON public.toolbox_open_house_assets(open_house_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_open_house_assets TO authenticated;
GRANT ALL ON public.toolbox_open_house_assets TO service_role;
ALTER TABLE public.toolbox_open_house_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view oh assets" ON public.toolbox_open_house_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert oh assets" ON public.toolbox_open_house_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update oh assets" ON public.toolbox_open_house_assets FOR UPDATE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner or admin can delete oh assets" ON public.toolbox_open_house_assets FOR DELETE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.toolbox_open_house_captions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES public.toolbox_open_houses(id) ON DELETE CASCADE,
  caption_text text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX toolbox_open_house_captions_oh_idx ON public.toolbox_open_house_captions(open_house_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_open_house_captions TO authenticated;
GRANT ALL ON public.toolbox_open_house_captions TO service_role;
ALTER TABLE public.toolbox_open_house_captions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view oh captions" ON public.toolbox_open_house_captions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert oh captions" ON public.toolbox_open_house_captions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update oh captions" ON public.toolbox_open_house_captions FOR UPDATE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner or admin can delete oh captions" ON public.toolbox_open_house_captions FOR DELETE TO authenticated USING ((auth.uid() = created_by) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_oh_updated_at BEFORE UPDATE ON public.toolbox_open_houses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
