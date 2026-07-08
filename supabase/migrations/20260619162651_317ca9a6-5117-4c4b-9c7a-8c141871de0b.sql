
-- Allow all roles except client_care to delete videos and content items
DROP POLICY IF EXISTS "videos_delete_admin" ON public.videos;
CREATE POLICY "videos_delete_non_client_care"
ON public.videos
FOR DELETE
TO authenticated
USING (NOT public.has_role(auth.uid(), 'client_care'::app_role));

DROP POLICY IF EXISTS "Marketing can delete content" ON public.content_items;
CREATE POLICY "Non client care can delete content"
ON public.content_items
FOR DELETE
TO authenticated
USING (NOT public.has_role(auth.uid(), 'client_care'::app_role));

-- Add separate graphic and video link fields for Facebook/Meta posts
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS meta_graphic_link text,
  ADD COLUMN IF NOT EXISTS meta_video_link text;
