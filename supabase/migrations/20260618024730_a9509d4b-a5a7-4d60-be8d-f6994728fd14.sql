ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_event_id_idx ON public.tasks(event_id);