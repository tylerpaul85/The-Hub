-- ============================================================
-- Meta Home Listings Catalog & Automated Feed Runs
-- ============================================================

-- 1. Meta Listings Table
CREATE TABLE IF NOT EXISTS public.meta_listings (
  id UUID PRIMARY KEY, -- Ruuster listing UUID
  listing_number TEXT NOT NULL,
  first_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  price NUMERIC,
  old_price NUMERIC,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  sqft NUMERIC,
  lot_acres NUMERIC,
  property_type TEXT,
  status TEXT,
  label TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  excluded BOOLEAN DEFAULT FALSE NOT NULL,
  missing_fields TEXT[] DEFAULT '{}'::text[],
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_meta_listings_status ON public.meta_listings (status);
CREATE INDEX IF NOT EXISTS idx_meta_listings_excluded ON public.meta_listings (excluded);
CREATE INDEX IF NOT EXISTS idx_meta_listings_listing_number ON public.meta_listings (listing_number);
CREATE INDEX IF NOT EXISTS idx_meta_listings_updated_at ON public.meta_listings (updated_at DESC);

-- Enable RLS
ALTER TABLE public.meta_listings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (staff/marketing) to view listings
CREATE POLICY "Allow authenticated read meta_listings"
  ON public.meta_listings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users (staff/marketing) to update exclusion and listing state
CREATE POLICY "Allow authenticated update meta_listings"
  ON public.meta_listings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role full access (bypasses RLS by default, but explicitly allow for safety)
CREATE POLICY "Allow service_role all on meta_listings"
  ON public.meta_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Meta Feed Runs Table
CREATE TABLE IF NOT EXISTS public.meta_feed_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  listing_count INTEGER DEFAULT 0 NOT NULL,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for runs history
CREATE INDEX IF NOT EXISTS idx_meta_feed_runs_run_time ON public.meta_feed_runs (run_time DESC);

-- Enable RLS
ALTER TABLE public.meta_feed_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read meta_feed_runs"
  ON public.meta_feed_runs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert meta_feed_runs"
  ON public.meta_feed_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service_role all on meta_feed_runs"
  ON public.meta_feed_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
