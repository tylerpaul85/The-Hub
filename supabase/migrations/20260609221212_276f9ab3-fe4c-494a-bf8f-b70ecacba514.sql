
-- Categories
CREATE TABLE public.process_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_categories TO authenticated;
GRANT ALL ON public.process_categories TO service_role;
ALTER TABLE public.process_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read categories" ON public.process_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.process_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.process_categories(name) VALUES
  ('Social Media'),('Listing Marketing'),('Event Planning'),('Video'),('Brand Guidelines'),('Onboarding');

-- Processes
CREATE TABLE public.processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category_id uuid REFERENCES public.process_categories(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist_mode boolean NOT NULL DEFAULT false,
  last_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processes TO authenticated;
GRANT ALL ON public.processes TO service_role;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read processes" ON public.processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage processes" ON public.processes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER processes_updated_at BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Runs
CREATE TABLE public.process_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_runs TO authenticated;
GRANT ALL ON public.process_runs TO service_role;
ALTER TABLE public.process_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin runs" ON public.process_runs FOR SELECT TO authenticated
  USING (started_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own runs" ON public.process_runs FOR INSERT TO authenticated
  WITH CHECK (started_by = auth.uid());
CREATE POLICY "update own runs" ON public.process_runs FOR UPDATE TO authenticated
  USING (started_by = auth.uid()) WITH CHECK (started_by = auth.uid());

-- Run steps
CREATE TABLE public.process_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.process_runs(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  label text NOT NULL,
  checked_at timestamptz,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(run_id, step_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_run_steps TO authenticated;
GRANT ALL ON public.process_run_steps TO service_role;
ALTER TABLE public.process_run_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read run steps" ON public.process_run_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND (r.started_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "insert run steps" ON public.process_run_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND r.started_by = auth.uid()));
CREATE POLICY "update run steps" ON public.process_run_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND r.started_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.process_runs r WHERE r.id = run_id AND r.started_by = auth.uid()));
