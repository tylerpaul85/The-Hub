-- Add meta_first_comment column to content_items for automated first comment on Facebook posts
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS meta_first_comment text;
