-- Migration: 20261019160000_playbook_categories_and_import_fields.sql
-- Description: Playbook categories table, source tracking, sort ordering, and GHL import metadata

CREATE TABLE IF NOT EXISTS public.playbook_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add import & hierarchy tracking columns to playbooks if they do not exist
ALTER TABLE public.playbooks
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.playbook_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS subcategory TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS source_ref TEXT;

-- Indexes for performance and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_playbooks_source_ref 
    ON public.playbooks (source_ref) 
    WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playbooks_source 
    ON public.playbooks (source);

CREATE INDEX IF NOT EXISTS idx_playbooks_sort_order 
    ON public.playbooks (sort_order);

CREATE INDEX IF NOT EXISTS idx_playbooks_category_id 
    ON public.playbooks (category_id);

-- Enable RLS on playbook_categories
ALTER TABLE public.playbook_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to playbook_categories"
ON public.playbook_categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated and anon read on playbook_categories"
ON public.playbook_categories FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
