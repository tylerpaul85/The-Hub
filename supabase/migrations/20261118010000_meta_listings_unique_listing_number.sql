-- ============================================================
-- Enforce Unique Constraint on listing_number for meta_listings
-- ============================================================

-- 1. Create Unique Index on listing_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_listings_unique_listing_number 
  ON public.meta_listings (listing_number);

-- 2. Add Unique Constraint using the index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meta_listings_listing_number_key'
  ) THEN
    ALTER TABLE public.meta_listings 
      ADD CONSTRAINT meta_listings_listing_number_key 
      UNIQUE USING INDEX idx_meta_listings_unique_listing_number;
  END IF;
END $$;
