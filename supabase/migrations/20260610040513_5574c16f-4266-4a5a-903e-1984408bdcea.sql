-- Rebuild video_stage enum to: idea, scheduled, ready_to_edit, ready_to_post
CREATE TYPE public.video_stage_new AS ENUM ('idea','scheduled','ready_to_edit','ready_to_post');

ALTER TABLE public.videos ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE public.videos
  ALTER COLUMN stage TYPE public.video_stage_new
  USING (
    CASE stage::text
      WHEN 'idea' THEN 'idea'
      WHEN 'filming' THEN 'scheduled'
      WHEN 'offloaded' THEN 'ready_to_edit'
      WHEN 'editing' THEN 'ready_to_edit'
      WHEN 'ready' THEN 'ready_to_post'
      ELSE 'idea'
    END
  )::public.video_stage_new;
ALTER TABLE public.videos ALTER COLUMN stage SET DEFAULT 'idea'::public.video_stage_new;

DROP TYPE public.video_stage;
ALTER TYPE public.video_stage_new RENAME TO video_stage;