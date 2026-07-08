ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'horizontal',
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'MSREG';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'videos_video_type_check') THEN
    ALTER TABLE public.videos ADD CONSTRAINT videos_video_type_check CHECK (video_type IN ('horizontal','reel'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'videos_brand_check') THEN
    ALTER TABLE public.videos ADD CONSTRAINT videos_brand_check CHECK (brand IN ('MSREG','AON'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS videos_type_brand_idx ON public.videos (video_type, brand);