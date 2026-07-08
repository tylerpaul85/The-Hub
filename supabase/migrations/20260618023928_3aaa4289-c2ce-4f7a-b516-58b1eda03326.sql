ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer;

CREATE INDEX IF NOT EXISTS tasks_starred_idx ON public.tasks (starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS tasks_project_sort_idx ON public.tasks (project_id, sort_order);