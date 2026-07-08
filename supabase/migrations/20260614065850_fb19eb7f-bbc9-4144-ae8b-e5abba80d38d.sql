
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS canva_link text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS blog_content text,
  ADD COLUMN IF NOT EXISTS blog_doc_link text,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS youtube_video_title text,
  ADD COLUMN IF NOT EXISTS email_subject_line text,
  ADD COLUMN IF NOT EXISTS meta_media_link text,
  ADD COLUMN IF NOT EXISTS meta_copy text;

ALTER TABLE public.content_comments
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_content_item_id_idx ON public.tasks(content_item_id);
