
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  hosts UUID[] NOT NULL DEFAULT '{}',
  headcount INTEGER,
  budget NUMERIC(12,2),
  notes TEXT,
  linked_listing TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_auth" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_admin_insert" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "events_admin_update" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "events_admin_delete" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checklist_items TO authenticated;
GRANT ALL ON public.event_checklist_items TO service_role;
ALTER TABLE public.event_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_select_auth" ON public.event_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_insert_auth" ON public.event_checklist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "checklist_update_auth" ON public.event_checklist_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "checklist_delete_admin" ON public.event_checklist_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX event_checklist_items_event_idx ON public.event_checklist_items(event_id);

CREATE TABLE public.event_content_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL,
  suggested_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  content_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_content_suggestions TO authenticated;
GRANT ALL ON public.event_content_suggestions TO service_role;
ALTER TABLE public.event_content_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestions_select_auth" ON public.event_content_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "suggestions_insert_auth" ON public.event_content_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "suggestions_update_auth" ON public.event_content_suggestions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "suggestions_delete_auth" ON public.event_content_suggestions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE INDEX event_content_suggestions_event_idx ON public.event_content_suggestions(event_id);
