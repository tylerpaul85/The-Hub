
-- Drop OLD brand constraints first so the backfill values are accepted
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_brand_check;
ALTER TABLE public.content_archive DROP CONSTRAINT IF EXISTS content_archive_brand_check;

-- Backfill brands
UPDATE public.content_items SET brand = 'LOZ' WHERE brand = 'MSREG LOZ';
UPDATE public.content_items SET brand = 'PP' WHERE brand = 'MSREG PP';
UPDATE public.content_items SET brand = 'MSREG ALL' WHERE brand NOT IN ('LOZ','PP','AON','MSREG ALL');

UPDATE public.content_archive SET brand = 'LOZ' WHERE brand = 'MSREG LOZ';
UPDATE public.content_archive SET brand = 'PP' WHERE brand = 'MSREG PP';
UPDATE public.content_archive SET brand = 'MSREG ALL' WHERE brand NOT IN ('LOZ','PP','AON','MSREG ALL');

-- Collapse Meta PP / Meta LOZ → Meta and dedupe
UPDATE public.content_items
SET platforms = (
  SELECT ARRAY(
    SELECT DISTINCT CASE WHEN p IN ('Meta PP','Meta LOZ') THEN 'Meta' ELSE p END
    FROM unnest(platforms) AS p
  )
)
WHERE platforms && ARRAY['Meta PP','Meta LOZ'];

UPDATE public.content_archive
SET platforms = (
  SELECT ARRAY(
    SELECT DISTINCT CASE WHEN p IN ('Meta PP','Meta LOZ') THEN 'Meta' ELSE p END
    FROM unnest(platforms) AS p
  )
)
WHERE platforms && ARRAY['Meta PP','Meta LOZ'];

-- Add NEW brand constraints
ALTER TABLE public.content_items ADD CONSTRAINT content_items_brand_check
  CHECK (brand = ANY (ARRAY['LOZ','PP','AON','MSREG ALL']));
ALTER TABLE public.content_archive ADD CONSTRAINT content_archive_brand_check
  CHECK (brand = ANY (ARRAY['LOZ','PP','AON','MSREG ALL']));
