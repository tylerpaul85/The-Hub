-- Add meta_is_scheduled and meta_scheduled_publish_time to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS meta_is_scheduled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_scheduled_publish_time TIMESTAMPTZ;
