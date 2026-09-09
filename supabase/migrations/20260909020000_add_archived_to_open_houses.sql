-- Add archived column to toolbox_open_houses
ALTER TABLE public.toolbox_open_houses ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS toolbox_open_houses_archived_idx ON public.toolbox_open_houses(archived);
