-- ============================================================
-- Special Events: Tables, RLS Policies, Indexes, and Storage
-- ============================================================

-- 1. Create special_events table
CREATE TABLE IF NOT EXISTS public.special_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  description             TEXT,
  event_date              DATE NOT NULL,
  start_time              TIME,                    -- e.g. '18:00:00'
  end_time                TIME,                    -- e.g. '21:00:00'
  location                TEXT,
  event_type              TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'community' | 'sponsorship'
  cover_image_url         TEXT,
  
  -- Signup & Committee Configuration
  requires_rsvp           BOOLEAN NOT NULL DEFAULT true,
  allows_committee        BOOLEAN NOT NULL DEFAULT false,
  capacity_mode           TEXT NOT NULL DEFAULT 'none',    -- 'none' | 'simple' | 'group'
  
  -- Simple Cap Settings
  max_capacity            INTEGER,
  enable_waitlist         BOOLEAN NOT NULL DEFAULT true,
  
  -- Group / Team Cap Settings (e.g. Golf Tournament)
  max_groups              INTEGER,                 -- null = uncapped groups
  max_per_group           INTEGER DEFAULT 4,       -- e.g. 4 people per group
  
  -- Google Calendar Sync Settings
  google_calendar_id      TEXT,
  google_event_id         TEXT,
  sync_google_calendar    BOOLEAN NOT NULL DEFAULT false,
  
  -- Lifecycle & Audit
  archived                BOOLEAN NOT NULL DEFAULT false,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create special_event_groups table
CREATE TABLE IF NOT EXISTS public.special_event_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create special_event_signups table
CREATE TABLE IF NOT EXISTS public.special_event_signups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                UUID NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name              TEXT,
  agent_email             TEXT,
  group_id                UUID REFERENCES public.special_event_groups(id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'waitlist' | 'cancelled'
  notes                   TEXT,
  google_calendar_synced  BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.special_event_signups ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.special_event_signups ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.special_event_signups ADD COLUMN IF NOT EXISTS agent_email TEXT;

-- 4. Create special_event_committee table
CREATE TABLE IF NOT EXISTS public.special_event_committee (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name  TEXT,
  agent_email TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.special_event_committee ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.special_event_committee ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.special_event_committee ADD COLUMN IF NOT EXISTS agent_email TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS special_events_date_idx ON public.special_events (event_date);
CREATE INDEX IF NOT EXISTS special_events_type_idx ON public.special_events (event_type);
CREATE INDEX IF NOT EXISTS special_events_archived_idx ON public.special_events (archived);
CREATE INDEX IF NOT EXISTS special_event_groups_event_id_idx ON public.special_event_groups (event_id);
CREATE INDEX IF NOT EXISTS special_event_signups_event_id_idx ON public.special_event_signups (event_id);
CREATE INDEX IF NOT EXISTS special_event_signups_user_id_idx ON public.special_event_signups (user_id);
CREATE INDEX IF NOT EXISTS special_event_signups_email_idx ON public.special_event_signups (agent_email);
CREATE INDEX IF NOT EXISTS special_event_signups_group_id_idx ON public.special_event_signups (group_id);
CREATE INDEX IF NOT EXISTS special_event_committee_event_id_idx ON public.special_event_committee (event_id);
CREATE INDEX IF NOT EXISTS special_event_committee_user_id_idx ON public.special_event_committee (user_id);
CREATE INDEX IF NOT EXISTS special_event_committee_email_idx ON public.special_event_committee (agent_email);

-- Enable RLS
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_event_committee ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_events TO authenticated;
GRANT ALL ON public.special_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_event_groups TO authenticated;
GRANT ALL ON public.special_event_groups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_event_signups TO authenticated;
GRANT ALL ON public.special_event_signups TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_event_committee TO authenticated;
GRANT ALL ON public.special_event_committee TO service_role;

-- RLS Policies for special_events
CREATE POLICY "special_events select auth" ON public.special_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "special_events insert admin or marketing" ON public.special_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_events update admin or marketing" ON public.special_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_events delete admin" ON public.special_events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for special_event_groups
CREATE POLICY "special_event_groups select auth" ON public.special_event_groups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "special_event_groups insert auth" ON public.special_event_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "special_event_groups update admin or creator" ON public.special_event_groups
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_event_groups delete admin or creator" ON public.special_event_groups
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

-- RLS Policies for special_event_signups
CREATE POLICY "special_event_signups select auth" ON public.special_event_signups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "special_event_signups insert auth" ON public.special_event_signups
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_event_signups update auth" ON public.special_event_signups
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_event_signups delete auth" ON public.special_event_signups
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

-- RLS Policies for special_event_committee
CREATE POLICY "special_event_committee select auth" ON public.special_event_committee
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "special_event_committee insert auth" ON public.special_event_committee
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_event_committee update auth" ON public.special_event_committee
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE POLICY "special_event_committee delete auth" ON public.special_event_committee
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'marketing_coordinator')
  );

-- Storage bucket for event cover photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('special-event-covers', 'special-event-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "special_event_covers_select"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'special-event-covers');

CREATE POLICY "special_event_covers_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'special-event-covers');

CREATE POLICY "special_event_covers_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'special-event-covers');

CREATE POLICY "special_event_covers_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'special-event-covers' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'marketing_coordinator')));
