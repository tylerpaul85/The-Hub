-- ============================================================
-- Email Signatures Feature
-- Three tables:
--   1. agent_signature_data  – per-agent editable fields
--   2. signature_team_config – single-row team-wide settings
--   3. signatures_push_log   – immutable push audit log
-- ============================================================

-- ----------------------------------------------------------------
-- 1. agent_signature_data
-- Stores every per-agent field needed to generate a signature.
-- Admins and marketing_coordinators manage this; agents never touch it.
-- ----------------------------------------------------------------
CREATE TABLE public.agent_signature_data (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  title              text,
  mobile_phone       text,
  office_phone       text,
  headshot_url       text,          -- permanent public Supabase Storage URL
  office1_label      text,
  office1_addr       text,
  office2_label      text,          -- NULL = single-office agent (gap suppressed in template)
  office2_addr       text,
  gmail_email        text,          -- email address to impersonate when pushing (may differ from login)
  last_pushed_at     timestamptz,
  last_push_status   text CHECK (last_push_status IN ('success', 'error')),
  last_push_error    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_signature_data TO authenticated;
GRANT ALL ON public.agent_signature_data TO service_role;
ALTER TABLE public.agent_signature_data ENABLE ROW LEVEL SECURITY;

-- Admins + marketing_coordinators can do everything; no one else can read this table
CREATE POLICY "sig_data_admin_marketing_all" ON public.agent_signature_data
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing_coordinator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE TRIGGER trg_agent_signature_data_updated
  BEFORE UPDATE ON public.agent_signature_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 2. signature_team_config
-- Single shared row with team-wide settings (links, accolades, icons).
-- Seeded with sensible defaults on creation.
-- ----------------------------------------------------------------
CREATE TABLE public.signature_team_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accolade_line1  text NOT NULL DEFAULT '#1 Real Estate Team in Missouri',
  accolade_line2  text NOT NULL DEFAULT '#18 in the Country by Sides',
  website_url     text NOT NULL DEFAULT 'https://mattsmithrealestategroup.com',
  valuation_url   text NOT NULL DEFAULT 'https://mattsmithrealestategroup.com/home-value',
  facebook_url    text NOT NULL DEFAULT 'https://facebook.com/mattsmithrealestategroup',
  instagram_url   text NOT NULL DEFAULT 'https://instagram.com/mattsmithrealestategroup',
  logo_url        text NOT NULL DEFAULT '',
  icon_fb_url     text NOT NULL DEFAULT '',
  icon_ig_url     text NOT NULL DEFAULT '',
  icon_web_url    text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signature_team_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.signature_team_config TO authenticated;
GRANT ALL ON public.signature_team_config TO service_role;
ALTER TABLE public.signature_team_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for live preview without a server round-trip)
CREATE POLICY "sig_config_select_all" ON public.signature_team_config
  FOR SELECT TO authenticated USING (true);

-- Only admins + marketing_coordinators can write
CREATE POLICY "sig_config_admin_marketing_write" ON public.signature_team_config
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing_coordinator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing_coordinator')
  );

CREATE TRIGGER trg_signature_team_config_updated
  BEFORE UPDATE ON public.signature_team_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed the single config row
INSERT INTO public.signature_team_config (
  accolade_line1, accolade_line2,
  website_url, valuation_url, facebook_url, instagram_url,
  logo_url, icon_fb_url, icon_ig_url, icon_web_url
) VALUES (
  '#1 Real Estate Team in Missouri',
  '#18 in the Country by Sides',
  'https://mattsmithrealestategroup.com',
  'https://mattsmithrealestategroup.com/home-value',
  'https://facebook.com/mattsmithrealestategroup',
  'https://instagram.com/mattsmithrealestategroup',
  '',
  '',
  '',
  ''
);

-- ----------------------------------------------------------------
-- 3. signatures_push_log
-- Immutable audit trail of every Gmail push attempt.
-- Service role inserts via server function; admins + marketing can read.
-- ----------------------------------------------------------------
CREATE TABLE public.signatures_push_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- agent whose sig was pushed
  pushed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,   -- admin/marketing who triggered it
  gmail_email text NOT NULL,
  status      text NOT NULL CHECK (status IN ('success', 'error')),
  error_msg   text,
  pushed_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signatures_push_log TO authenticated;
GRANT ALL ON public.signatures_push_log TO service_role;
ALTER TABLE public.signatures_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sig_log_admin_marketing_select" ON public.signatures_push_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'marketing_coordinator')
  );
