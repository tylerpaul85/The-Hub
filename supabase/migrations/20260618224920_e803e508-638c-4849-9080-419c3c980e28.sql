ALTER TABLE public.toolbox_listings ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS toolbox_listings_archived_idx ON public.toolbox_listings(archived);