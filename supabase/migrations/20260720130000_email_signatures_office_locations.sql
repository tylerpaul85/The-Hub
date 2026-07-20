-- ============================================================
-- Email Signatures Team Office Locations Migration
-- Adds team-wide office addresses for Rolla, St. Robert, and Osage Beach,
-- and per-agent office visibility flags.
-- ============================================================

ALTER TABLE public.signature_team_config 
  ADD COLUMN IF NOT EXISTS office_rolla_addr text DEFAULT '1043 Kingshighway, Rolla, MO 65401',
  ADD COLUMN IF NOT EXISTS office_strobert_addr text DEFAULT '157 Saint Robert Blvd, St. Robert, MO 65584',
  ADD COLUMN IF NOT EXISTS office_osage_addr text DEFAULT '456 Shore Dr, Osage Beach, MO 65065';

ALTER TABLE public.agent_signature_data
  ADD COLUMN IF NOT EXISTS show_office_rolla boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_office_strobert boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_office_osage boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS office_rolla_addr text,
  ADD COLUMN IF NOT EXISTS office_strobert_addr text,
  ADD COLUMN IF NOT EXISTS office_osage_addr text;

-- Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
