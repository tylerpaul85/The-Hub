
-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  archived boolean NOT NULL DEFAULT false,
  owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Visibility: owner OR creator OR (admin AND target user not another admin)
CREATE POLICY "projects select scoped"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = owner
    OR auth.uid() = created_by
    OR (
      public.has_role(auth.uid(), 'admin')
      AND NOT public.has_role(COALESCE(owner, created_by), 'admin')
    )
  );

CREATE POLICY "projects insert own or admin"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR auth.uid() = created_by)
    AND (public.has_role(auth.uid(), 'admin') OR owner IS NULL OR owner = auth.uid())
  );

CREATE POLICY "projects update owner or admin"
  ON public.projects FOR UPDATE
  USING (auth.uid() = owner OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "projects delete admin"
  ON public.projects FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Task columns
ALTER TABLE public.tasks
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN requested_by_name text;

CREATE INDEX tasks_project_id_idx ON public.tasks(project_id);
CREATE INDEX tasks_requested_by_user_id_idx ON public.tasks(requested_by_user_id);

-- Tighten tasks SELECT policy: admins cannot see other admins' personal tasks
DROP POLICY IF EXISTS "tasks select own or admin" ON public.tasks;

CREATE POLICY "tasks select scoped"
  ON public.tasks FOR SELECT
  USING (
    auth.uid() = owner
    OR auth.uid() = created_by
    OR (
      public.has_role(auth.uid(), 'admin')
      AND NOT public.has_role(COALESCE(owner, created_by), 'admin')
    )
  );
