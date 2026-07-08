ALTER TABLE public.toolbox_open_house_assets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';
ALTER TABLE public.toolbox_open_house_captions ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Branded Photos and Copy';
CREATE INDEX IF NOT EXISTS toolbox_oh_assets_category_idx ON public.toolbox_open_house_assets(open_house_id, category);
-- Migrate existing rows into sensible categories
UPDATE public.toolbox_open_house_assets SET category = 'Branded Photos and Copy' WHERE asset_type = 'photo' AND category = 'Other';
UPDATE public.toolbox_open_house_assets SET category = 'Flyer' WHERE asset_type = 'graphic' AND category = 'Other';