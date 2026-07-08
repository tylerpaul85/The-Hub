
CREATE TABLE public.project_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_private_notes TO authenticated;
GRANT ALL ON public.project_private_notes TO service_role;

ALTER TABLE public.project_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_private_notes_select" ON public.project_private_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_private_notes_insert" ON public.project_private_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_private_notes_update" ON public.project_private_notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_private_notes_delete" ON public.project_private_notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER set_project_private_notes_updated_at
  BEFORE UPDATE ON public.project_private_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
