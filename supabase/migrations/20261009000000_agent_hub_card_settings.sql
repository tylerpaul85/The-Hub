-- 20261009000000_agent_hub_card_settings.sql
-- Documents the schema configuration for custom Agent Hub card ordering, visibility, and badge customization.

CREATE TABLE IF NOT EXISTS public.agent_hub_card_settings (
  card_id text PRIMARY KEY,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  badge_override text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.agent_hub_card_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_hub_card_settings' AND policyname = 'Allow public read'
  ) THEN
    CREATE POLICY "Allow public read" ON public.agent_hub_card_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_hub_card_settings' AND policyname = 'Allow service role and auth write'
  ) THEN
    CREATE POLICY "Allow service role and auth write" ON public.agent_hub_card_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
