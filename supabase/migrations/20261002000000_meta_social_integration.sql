-- ============================================================
-- Meta (Facebook/Instagram) Social Integration & Analytics
-- ============================================================

-- 1. Connected Facebook Pages & Access Tokens
CREATE TABLE IF NOT EXISTS public.meta_page_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  brand_tag TEXT DEFAULT 'MSREG PP', -- Matches content_items.brand ('MSREG PP', 'MSREG LOZ', etc.)
  instagram_account_id TEXT,
  instagram_username TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.meta_page_configs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view active page configs
CREATE POLICY "Allow authenticated read meta_page_configs"
  ON public.meta_page_configs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users (staff/marketing/admin) to manage page configs
CREATE POLICY "Allow authenticated manage meta_page_configs"
  ON public.meta_page_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. History of Published Posts
CREATE TABLE IF NOT EXISTS public.meta_published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  page_id TEXT NOT NULL,
  facebook_post_id TEXT NOT NULL,
  permalink_url TEXT,
  message TEXT,
  media_type TEXT DEFAULT 'status', -- 'photo', 'video', 'status'
  media_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metrics JSONB DEFAULT '{}'::jsonb,
  metrics_updated_at TIMESTAMPTZ
);

ALTER TABLE public.meta_published_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read meta_published_posts"
  ON public.meta_published_posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert meta_published_posts"
  ON public.meta_published_posts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Add published_post_url column to content_items if not exists
ALTER TABLE public.content_items 
  ADD COLUMN IF NOT EXISTS published_post_url TEXT,
  ADD COLUMN IF NOT EXISTS published_post_id TEXT;
