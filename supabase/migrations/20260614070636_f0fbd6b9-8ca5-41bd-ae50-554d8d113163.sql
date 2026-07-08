ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS videos_linked_content_item_id_idx ON public.videos(linked_content_item_id);