-- Add cover_photo_url to toolbox_open_houses for primary/starred cover photo selection
ALTER TABLE public.toolbox_open_houses ADD COLUMN IF NOT EXISTS cover_photo_url text;
