ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_brand_check;
ALTER TABLE public.content_archive DROP CONSTRAINT IF EXISTS content_archive_brand_check;

UPDATE public.content_items SET brand = 'MSREG PP' WHERE brand = 'MSREG' OR brand IS NULL;
UPDATE public.content_archive SET brand = 'MSREG PP' WHERE brand = 'MSREG' OR brand IS NULL;

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_brand_check CHECK (brand = ANY (ARRAY['MSREG LOZ'::text, 'MSREG PP'::text, 'AON'::text]));
ALTER TABLE public.content_archive
  ADD CONSTRAINT content_archive_brand_check CHECK (brand = ANY (ARRAY['MSREG LOZ'::text, 'MSREG PP'::text, 'AON'::text]));

ALTER TABLE public.content_items ALTER COLUMN brand SET DEFAULT 'MSREG PP';
ALTER TABLE public.content_archive ALTER COLUMN brand SET DEFAULT 'MSREG PP';