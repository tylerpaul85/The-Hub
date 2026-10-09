-- Create toolbox_market_stats table for storing monthly MLS reports, key metrics, and social media assets

CREATE TABLE IF NOT EXISTS public.toolbox_market_stats (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    title TEXT NOT NULL,
    area TEXT DEFAULT 'MLS Market Area',
    summary_notes TEXT,
    pdf_url TEXT,
    pdf_name TEXT,
    pdf_size BIGINT,
    metrics JSONB DEFAULT '{}'::jsonb,
    graphics JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for speedy ordering by month / date
CREATE INDEX IF NOT EXISTS idx_toolbox_market_stats_created_at ON public.toolbox_market_stats(created_at DESC);

-- Enable RLS
ALTER TABLE public.toolbox_market_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access (agents and public portal)
CREATE POLICY "Public read market stats"
ON public.toolbox_market_stats
FOR SELECT
USING (true);

-- Allow authenticated users / service role write access
CREATE POLICY "Staff insert market stats"
ON public.toolbox_market_stats
FOR ALL
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
