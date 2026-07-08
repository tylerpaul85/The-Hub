
-- Add brand column to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'MSREG';
DO $$ BEGIN
  ALTER TABLE public.content_items ADD CONSTRAINT content_items_brand_check CHECK (brand IN ('MSREG','AON'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add brand column to content_archive
ALTER TABLE public.content_archive ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'MSREG';
DO $$ BEGIN
  ALTER TABLE public.content_archive ADD CONSTRAINT content_archive_brand_check CHECK (brand IN ('MSREG','AON'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS content_items_brand_idx ON public.content_items(brand);
CREATE INDEX IF NOT EXISTS content_archive_brand_idx ON public.content_archive(brand);

-- Remap platforms helper
CREATE OR REPLACE FUNCTION public._remap_content_platform(_p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _p IN ('Instagram','Facebook','Meta') THEN 'Meta'
    WHEN _p IN ('Email','Mailchimp') THEN 'Mailchimp'
    WHEN _p IN ('YouTube','Blog') THEN _p
    ELSE NULL
  END
$$;

UPDATE public.content_items SET platforms = COALESCE((
  SELECT array_agg(DISTINCT m) FROM (
    SELECT public._remap_content_platform(p) AS m
    FROM unnest(platforms) AS p
  ) s WHERE m IS NOT NULL
), '{}');

UPDATE public.content_archive SET platforms = COALESCE((
  SELECT array_agg(DISTINCT m) FROM (
    SELECT public._remap_content_platform(p) AS m
    FROM unnest(platforms) AS p
  ) s WHERE m IS NOT NULL
), '{}');

DROP FUNCTION public._remap_content_platform(text);
