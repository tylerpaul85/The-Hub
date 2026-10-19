-- Migration: 20261019140000_playbooks_system.sql
-- Description: Playbooks Library, Access Groups, Version History & Acknowledgment Tracking

CREATE TABLE IF NOT EXISTS public.playbook_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbook_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.playbook_groups(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.seller_proceeds_accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, agent_id)
);

CREATE TABLE IF NOT EXISTS public.playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    summary TEXT,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    owner TEXT NOT NULL DEFAULT 'Matt Smith',
    owner_id UUID,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
    last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_reviewed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbook_assigned_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.playbook_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (playbook_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.playbook_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    change_summary TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbook_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.seller_proceeds_accounts(id) ON DELETE CASCADE,
    version_acknowledged INTEGER NOT NULL DEFAULT 1,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (playbook_id, agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON public.playbooks (status);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON public.playbooks (category);
CREATE INDEX IF NOT EXISTS idx_playbooks_last_reviewed ON public.playbooks (last_reviewed_at);
CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook ON public.playbook_versions (playbook_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_playbook_assigned_groups_playbook ON public.playbook_assigned_groups (playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_assigned_groups_group ON public.playbook_assigned_groups (group_id);
CREATE INDEX IF NOT EXISTS idx_playbook_group_members_group ON public.playbook_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_playbook_acknowledgments_playbook ON public.playbook_acknowledgments (playbook_id);

-- Enable RLS
ALTER TABLE public.playbook_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_assigned_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Service role & authenticated policies
CREATE POLICY "Allow service role full access to playbook_groups"
ON public.playbook_groups FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to playbook_group_members"
ON public.playbook_group_members FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to playbooks"
ON public.playbooks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to playbook_assigned_groups"
ON public.playbook_assigned_groups FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to playbook_versions"
ON public.playbook_versions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to playbook_acknowledgments"
ON public.playbook_acknowledgments FOR ALL USING (true) WITH CHECK (true);

-- Authenticated internal read policies
CREATE POLICY "Allow authenticated read playbook_groups"
ON public.playbook_groups FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read playbooks"
ON public.playbooks FOR SELECT USING (auth.role() = 'authenticated');

-- Create storage bucket for playbooks if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('playbooks', 'playbooks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for playbooks bucket
CREATE POLICY "Allow public read on playbooks bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'playbooks');

CREATE POLICY "Allow authenticated insert on playbooks bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'playbooks');

CREATE POLICY "Allow authenticated update on playbooks bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'playbooks');

-- Force schema reload
NOTIFY pgrst, 'reload schema';
