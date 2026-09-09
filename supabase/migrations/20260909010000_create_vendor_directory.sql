-- ============================================================
-- Vendor Directory: Categories, Vendors, and Review Requests
-- ============================================================

-- 1. Create vendor_categories table
CREATE TABLE IF NOT EXISTS public.vendor_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT DEFAULT 'Wrench',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES public.vendor_categories(id) ON DELETE RESTRICT,
  region          TEXT NOT NULL DEFAULT 'st_robert_rolla', -- 'st_robert_rolla' | 'lake_of_the_ozarks'
  name            TEXT NOT NULL,
  primary_contact TEXT,
  phone           TEXT NOT NULL,
  email           TEXT,
  website         TEXT,
  specialty_notes TEXT,
  is_preferred    BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' | 'flagged' | 'archived'
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create vendor_requests table (Review Queue for additions / removals / flags)
CREATE TABLE IF NOT EXISTS public.vendor_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type    TEXT NOT NULL,                  -- 'add' | 'remove' | 'flag'
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  vendor_id       UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name     TEXT NOT NULL,
  region          TEXT,                           -- 'st_robert_rolla' | 'lake_of_the_ozarks'
  category_id     UUID REFERENCES public.vendor_categories(id) ON DELETE SET NULL,
  primary_contact TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  specialty_notes TEXT,
  reason          TEXT NOT NULL,
  agent_name      TEXT NOT NULL,
  agent_email     TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS vendor_categories_sort_idx ON public.vendor_categories (sort_order, name);
CREATE INDEX IF NOT EXISTS vendors_category_idx ON public.vendors (category_id);
CREATE INDEX IF NOT EXISTS vendors_region_idx ON public.vendors (region);
CREATE INDEX IF NOT EXISTS vendors_status_idx ON public.vendors (status);
CREATE INDEX IF NOT EXISTS vendors_name_idx ON public.vendors (name);
CREATE INDEX IF NOT EXISTS vendor_requests_status_idx ON public.vendor_requests (status);
CREATE INDEX IF NOT EXISTS vendor_requests_created_idx ON public.vendor_requests (created_at DESC);

-- Enable RLS
ALTER TABLE public.vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_requests ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_categories TO authenticated;
GRANT ALL ON public.vendor_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_requests TO authenticated;
GRANT ALL ON public.vendor_requests TO service_role;

-- RLS Policies
-- vendor_categories: anyone authenticated can read; admin or marketing can edit
CREATE POLICY "vendor_categories select auth" ON public.vendor_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendor_categories modify admin" ON public.vendor_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'));

-- vendors: anyone authenticated can read; admin or marketing can edit
CREATE POLICY "vendors select auth" ON public.vendors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendors modify admin" ON public.vendors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'));

-- vendor_requests: anyone authenticated can read and insert; admin or marketing can update/delete
CREATE POLICY "vendor_requests select auth" ON public.vendor_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vendor_requests insert auth" ON public.vendor_requests
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "vendor_requests modify admin" ON public.vendor_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'));

CREATE POLICY "vendor_requests delete admin" ON public.vendor_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator'));

-- Pre-seed default categories for Home Services & Vendor Guide
INSERT INTO public.vendor_categories (name, slug, icon, sort_order)
VALUES
  ('Mortgage & Lending', 'mortgage-lending', 'Landmark', 10),
  ('Title Companies', 'title-companies', 'FileCheck', 20),
  ('Home Inspectors', 'home-inspectors', 'ClipboardCheck', 30),
  ('General Contractors & Handyman', 'general-contractors', 'Hammer', 40),
  ('HVAC Heating & Cooling', 'hvac', 'Flame', 50),
  ('Electricians', 'electricians', 'Zap', 60),
  ('Plumbing', 'plumbing', 'Droplet', 70),
  ('Roofing & Gutters', 'roofing', 'Home', 80),
  ('Landscaping & Lawn Care', 'landscaping', 'Trees', 90),
  ('Insurance (Home & Auto)', 'insurance', 'Shield', 100),
  ('Photography, Media & Marketing', 'photography-media', 'Camera', 110),
  ('Cleaning & Housekeeping', 'cleaning-services', 'Sparkles', 120),
  ('Pest & Termite Control', 'pest-control', 'Bug', 130),
  ('Septic & Sewer Services', 'septic-sewer', 'Wrench', 140),
  ('Well Inspection & Drilling', 'well-inspection', 'Compass', 150),
  ('Flooring & Carpet', 'flooring-carpet', 'Layers', 160),
  ('Painting & Drywall', 'painting-drywall', 'Paintbrush', 170),
  ('Tree Service & Removal', 'tree-service', 'TreePine', 180),
  ('Surveyors & Engineering', 'surveyors-engineering', 'Ruler', 190),
  ('Structural & Foundation Repair', 'structural-foundation', 'Building', 200),
  ('Appliance Repair & Installation', 'appliance-repair', 'Tv', 210),
  ('Junk Removal & Hauling', 'junk-removal', 'Truck', 220),
  ('Window & Glass Repair', 'window-glass', 'Maximize', 230),
  ('Locksmith & Security', 'locksmith-security', 'Key', 240),
  ('Moving & Storage', 'moving-storage', 'PackageOpen', 250),
  ('Home Staging & Interior Design', 'home-staging', 'Palette', 260),
  ('Pool & Spa Maintenance', 'pool-spa', 'Waves', 270),
  ('Dock & Shoreline Services', 'dock-shoreline', 'Anchor', 280),
  ('Estate Sales & Auctioneers', 'estate-sales', 'Gavel', 290),
  ('Other Home Services', 'other-services', 'Wrench', 300)
ON CONFLICT (slug) DO NOTHING;
