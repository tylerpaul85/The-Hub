-- ==============================================================================
-- AGENT AUDIT SYSTEM: Migration 20260927000000_agent_audit_system.sql
-- ==============================================================================
-- Description:
-- Complete database schema for the Admin-Only Agent Audit system:
-- 1. FUB Data Sync Tables (agents, leads, notes, calls, texts, emails, tasks, appointments, deals, stage history, sync logs)
-- 2. Audit Integrity Rules (configurable thresholds, integrity flags table, detection views & scanner function)
-- 3. Audit Rubric & Claude Grading (rubric criteria table, sampled leads, grades, compliance flags, reports)
-- 4. Audit Calibration (calibration sets, leads, human vs Claude comparative grades)
-- 5. Strict Admin-Only Row-Level Security (RLS) on all tables via public.has_role(auth.uid(), 'admin')
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------------------------
-- 1. FUB DATA SYNC TABLES
-- ------------------------------------------------------------------------------

-- Sync run logs
CREATE TABLE IF NOT EXISTS public.fub_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'incremental', -- 'incremental' | 'full' | 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'completed' | 'failed'
  records_synced JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"agents": 12, "leads": 150, "notes": 80}
  error_message TEXT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FUB Users / Agents
CREATE TABLE IF NOT EXISTS public.fub_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FUB People / Leads
CREATE TABLE IF NOT EXISTS public.fub_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Unnamed',
  first_name TEXT,
  last_name TEXT,
  stage TEXT,
  source TEXT,
  assigned_user_fub_id BIGINT,
  assigned_user_name TEXT,
  price NUMERIC,
  contacted BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  last_communication TIMESTAMPTZ,
  last_sent_email TIMESTAMPTZ,
  last_sent_text TIMESTAMPTZ,
  last_outgoing_call TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_leads_assigned_user ON public.fub_leads (assigned_user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_leads_stage ON public.fub_leads (stage);
CREATE INDEX IF NOT EXISTS idx_fub_leads_updated_at ON public.fub_leads (fub_updated_at DESC);

-- FUB Notes
CREATE TABLE IF NOT EXISTS public.fub_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT NOT NULL,
  user_fub_id BIGINT,
  user_name TEXT,
  subject TEXT,
  body TEXT,
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_notes_person ON public.fub_notes (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_notes_user ON public.fub_notes (user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_notes_created ON public.fub_notes (fub_created_at);

-- FUB Calls
CREATE TABLE IF NOT EXISTS public.fub_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT NOT NULL,
  user_fub_id BIGINT,
  user_name TEXT,
  duration INT NOT NULL DEFAULT 0, -- in seconds
  outcome TEXT,
  direction TEXT, -- 'incoming' | 'outgoing'
  note TEXT,
  fub_created_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_calls_person ON public.fub_calls (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_calls_user ON public.fub_calls (user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_calls_created ON public.fub_calls (fub_created_at);

-- FUB Text Messages
CREATE TABLE IF NOT EXISTS public.fub_text_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT NOT NULL,
  user_fub_id BIGINT,
  user_name TEXT,
  direction TEXT, -- 'inbound' | 'outbound'
  body TEXT,
  fub_created_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_texts_person ON public.fub_text_messages (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_texts_user ON public.fub_text_messages (user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_texts_created ON public.fub_text_messages (fub_created_at);

-- FUB Emails
CREATE TABLE IF NOT EXISTS public.fub_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT NOT NULL,
  user_fub_id BIGINT,
  user_name TEXT,
  direction TEXT, -- 'inbound' | 'outbound'
  subject TEXT,
  body TEXT,
  fub_created_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_emails_person ON public.fub_emails (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_emails_user ON public.fub_emails (user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_emails_created ON public.fub_emails (fub_created_at);

-- FUB Tasks
CREATE TABLE IF NOT EXISTS public.fub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT NOT NULL,
  assigned_user_fub_id BIGINT,
  assigned_user_name TEXT,
  name TEXT NOT NULL,
  type TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_tasks_person ON public.fub_tasks (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_tasks_user ON public.fub_tasks (assigned_user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_tasks_completed ON public.fub_tasks (completed_at);

-- FUB Appointments
CREATE TABLE IF NOT EXISTS public.fub_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT,
  user_fub_id BIGINT,
  user_name TEXT,
  title TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  outcome TEXT,
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_appts_person ON public.fub_appointments (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_appts_user ON public.fub_appointments (user_fub_id);

-- FUB Deals
CREATE TABLE IF NOT EXISTS public.fub_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id BIGINT NOT NULL UNIQUE,
  person_fub_id BIGINT,
  user_fub_id BIGINT,
  user_name TEXT,
  pipeline_id BIGINT,
  pipeline_name TEXT,
  stage_id BIGINT,
  stage_name TEXT,
  name TEXT,
  price NUMERIC,
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_deals_user ON public.fub_deals (user_fub_id);

-- FUB Stage History
CREATE TABLE IF NOT EXISTS public.fub_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_event_id TEXT UNIQUE,
  person_fub_id BIGINT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by_user_fub_id BIGINT,
  changed_by_user_name TEXT,
  fub_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fub_stage_history_person ON public.fub_stage_history (person_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_stage_history_user ON public.fub_stage_history (changed_by_user_fub_id);
CREATE INDEX IF NOT EXISTS idx_fub_stage_history_created ON public.fub_stage_history (fub_created_at);

-- ------------------------------------------------------------------------------
-- 2. INTEGRITY RULES & THRESHOLDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_integrity_thresholds (
  key TEXT PRIMARY KEY,
  numeric_value NUMERIC,
  text_value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed configurable threshold defaults
INSERT INTO public.audit_integrity_thresholds (key, numeric_value, text_value, description)
VALUES
  ('short_call_seconds_cutoff', 10, NULL, 'Calls equal to or under this duration in seconds are considered short'),
  ('short_call_share_threshold_pct', 30, NULL, 'Percentage of calls under cutoff required to trigger an integrity flag'),
  ('call_cluster_minutes_window', 30, NULL, 'Window in minutes to evaluate rapid call clustering right before deadlines'),
  ('call_cluster_min_calls', 5, NULL, 'Minimum number of short calls inside cluster window to flag'),
  ('task_communication_window_hours', 24, NULL, 'Hours before/after task completion required to have a logged contact/note'),
  ('trash_without_note_window_hours', 48, NULL, 'Hours before/after lead moved to Trash/Lost that must contain a note'),
  ('duplicate_notes_min_leads', 4, NULL, 'Minimum number of distinct leads with identical or near-duplicate notes'),
  ('duplicate_notes_window_days', 7, NULL, 'Window in days to detect repeated duplicate notes per agent')
ON CONFLICT (key) DO NOTHING;

-- Integrity Flags Table
CREATE TABLE IF NOT EXISTS public.audit_integrity_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_fub_id BIGINT NOT NULL,
  agent_name TEXT,
  rule_key TEXT NOT NULL, -- 'short_calls' | 'clustered_calls' | 'ghost_task' | 'unjustified_lost_trash' | 'skipped_stage' | 'duplicate_notes'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of FUB record IDs (call IDs, task IDs, person IDs)
  evidence_summary TEXT,
  lead_fub_id BIGINT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'confirmed' | 'dismissed' | 'needs_human_review'
  claude_review_status TEXT, -- 'confirmed' | 'dismissed' | 'needs_human_review'
  claude_reasoning TEXT,
  claude_reviewed_at TIMESTAMPTZ,
  human_override_status TEXT, -- 'pending' | 'agreed' | 'disagreed'
  human_override_notes TEXT,
  human_override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  human_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_flags_agent ON public.audit_integrity_flags (agent_fub_id);
CREATE INDEX IF NOT EXISTS idx_audit_flags_status ON public.audit_integrity_flags (status);
CREATE INDEX IF NOT EXISTS idx_audit_flags_rule ON public.audit_integrity_flags (rule_key);

-- ------------------------------------------------------------------------------
-- 3. SQL INTEGRITY DETECTION VIEWS
-- ------------------------------------------------------------------------------

-- View: 1. High share of calls under 10 seconds or clustered calls
CREATE OR REPLACE VIEW public.view_audit_short_calls AS
WITH threshold AS (
  SELECT
    COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'short_call_seconds_cutoff'), 10) AS cutoff_sec,
    COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'short_call_share_threshold_pct'), 30) AS share_pct
)
SELECT
  c.user_fub_id AS agent_fub_id,
  c.user_name AS agent_name,
  COUNT(c.id) AS total_calls,
  COUNT(CASE WHEN c.duration <= t.cutoff_sec THEN 1 END) AS short_calls_count,
  ROUND(
    (COUNT(CASE WHEN c.duration <= t.cutoff_sec THEN 1 END)::numeric / NULLIF(COUNT(c.id), 0)) * 100,
    1
  ) AS short_calls_pct,
  JSONB_AGG(c.fub_id) FILTER (WHERE c.duration <= t.cutoff_sec) AS short_call_fub_ids
FROM public.fub_calls c
CROSS JOIN threshold t
WHERE c.user_fub_id IS NOT NULL
  AND c.fub_created_at >= (now() - INTERVAL '30 days')
GROUP BY c.user_fub_id, c.user_name, t.share_pct
HAVING COUNT(c.id) >= 10
   AND ROUND((COUNT(CASE WHEN c.duration <= t.cutoff_sec THEN 1 END)::numeric / NULLIF(COUNT(c.id), 0)) * 100, 1) >= t.share_pct;

-- View: 2. Tasks marked complete with no call/text/email/note within 24 hours
CREATE OR REPLACE VIEW public.view_audit_ghost_completed_tasks AS
WITH threshold AS (
  SELECT COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'task_communication_window_hours'), 24) AS window_hrs
)
SELECT
  t.id AS task_row_id,
  t.fub_id AS task_fub_id,
  t.assigned_user_fub_id AS agent_fub_id,
  t.assigned_user_name AS agent_name,
  t.person_fub_id AS lead_fub_id,
  t.name AS task_name,
  t.completed_at,
  'Completed task with no recorded call, text, email, or note within 24 hours' AS issue_description
FROM public.fub_tasks t
CROSS JOIN threshold th
WHERE t.is_completed = true
  AND t.completed_at IS NOT NULL
  AND t.completed_at >= (now() - INTERVAL '30 days')
  AND t.assigned_user_fub_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.fub_calls c
    WHERE c.person_fub_id = t.person_fub_id
      AND c.user_fub_id = t.assigned_user_fub_id
      AND c.fub_created_at BETWEEN (t.completed_at - (th.window_hrs || ' hours')::interval)
                               AND (t.completed_at + (th.window_hrs || ' hours')::interval)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.fub_text_messages tm
    WHERE tm.person_fub_id = t.person_fub_id
      AND tm.user_fub_id = t.assigned_user_fub_id
      AND tm.fub_created_at BETWEEN (t.completed_at - (th.window_hrs || ' hours')::interval)
                                AND (t.completed_at + (th.window_hrs || ' hours')::interval)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.fub_emails e
    WHERE e.person_fub_id = t.person_fub_id
      AND e.user_fub_id = t.assigned_user_fub_id
      AND e.fub_created_at BETWEEN (t.completed_at - (th.window_hrs || ' hours')::interval)
                               AND (t.completed_at + (th.window_hrs || ' hours')::interval)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.fub_notes n
    WHERE n.person_fub_id = t.person_fub_id
      AND n.user_fub_id = t.assigned_user_fub_id
      AND n.fub_created_at BETWEEN (t.completed_at - (th.window_hrs || ' hours')::interval)
                               AND (t.completed_at + (th.window_hrs || ' hours')::interval)
  );

-- View: 3. Leads moved to Lost/Trash with no note within 48 hours
CREATE OR REPLACE VIEW public.view_audit_unjustified_lost_trash AS
WITH threshold AS (
  SELECT COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'trash_without_note_window_hours'), 48) AS window_hrs
)
SELECT
  sh.id AS stage_history_id,
  sh.person_fub_id AS lead_fub_id,
  sh.changed_by_user_fub_id AS agent_fub_id,
  sh.changed_by_user_name AS agent_name,
  sh.from_stage,
  sh.to_stage,
  sh.fub_created_at AS changed_at,
  'Lead moved to ' || sh.to_stage || ' without any explanatory note within ' || th.window_hrs || ' hours' AS issue_description
FROM public.fub_stage_history sh
CROSS JOIN threshold th
WHERE LOWER(sh.to_stage) IN ('lost', 'trash', 'archived', 'unqualified')
  AND sh.fub_created_at >= (now() - INTERVAL '30 days')
  AND sh.changed_by_user_fub_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.fub_notes n
    WHERE n.person_fub_id = sh.person_fub_id
      AND n.fub_created_at BETWEEN (sh.fub_created_at - (th.window_hrs || ' hours')::interval)
                               AND (sh.fub_created_at + (th.window_hrs || ' hours')::interval)
  );

-- View: 4. Stage jumps that skip stages (e.g. Lead straight to Under Contract / Closed / Pending)
CREATE OR REPLACE VIEW public.view_audit_skipped_stages AS
SELECT
  sh.id AS stage_history_id,
  sh.person_fub_id AS lead_fub_id,
  sh.changed_by_user_fub_id AS agent_fub_id,
  sh.changed_by_user_name AS agent_name,
  sh.from_stage,
  sh.to_stage,
  sh.fub_created_at AS changed_at,
  'Skipped natural progression: moved directly from "' || COALESCE(sh.from_stage, 'None') || '" to "' || sh.to_stage || '"' AS issue_description
FROM public.fub_stage_history sh
WHERE (LOWER(COALESCE(sh.from_stage, '')) IN ('lead', '', 'unassigned', 'new')
       AND LOWER(sh.to_stage) IN ('under contract', 'pending', 'closed', 'past client'))
  AND sh.fub_created_at >= (now() - INTERVAL '30 days');

-- View: 5. Near-duplicate notes repeated across multiple leads
CREATE OR REPLACE VIEW public.view_audit_duplicate_notes AS
WITH threshold AS (
  SELECT
    COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'duplicate_notes_min_leads'), 4) AS min_leads,
    COALESCE((SELECT numeric_value FROM public.audit_integrity_thresholds WHERE key = 'duplicate_notes_window_days'), 7) AS window_days
)
SELECT
  n.user_fub_id AS agent_fub_id,
  n.user_name AS agent_name,
  TRIM(LOWER(n.body)) AS note_content_clean,
  COUNT(DISTINCT n.person_fub_id) AS distinct_leads_count,
  JSONB_AGG(DISTINCT n.person_fub_id) AS lead_fub_ids,
  JSONB_AGG(n.fub_id) AS note_fub_ids,
  'Note text repeated across ' || COUNT(DISTINCT n.person_fub_id) || ' different leads within ' || t.window_days || ' days' AS issue_description
FROM public.fub_notes n
CROSS JOIN threshold t
WHERE n.user_fub_id IS NOT NULL
  AND n.body IS NOT NULL
  AND LENGTH(TRIM(n.body)) >= 15
  AND n.fub_created_at >= (now() - (t.window_days || ' days')::interval)
GROUP BY n.user_fub_id, n.user_name, TRIM(LOWER(n.body)), t.window_days, t.min_leads
HAVING COUNT(DISTINCT n.person_fub_id) >= t.min_leads;

-- Function: Scan and populate audit_integrity_flags table from views
CREATE OR REPLACE FUNCTION public.fn_audit_generate_integrity_flags()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
  v_rec RECORD;
BEGIN
  -- 1. Short calls
  FOR v_rec IN SELECT * FROM public.view_audit_short_calls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_integrity_flags
      WHERE agent_fub_id = v_rec.agent_fub_id
        AND rule_key = 'short_calls'
        AND created_at >= (now() - INTERVAL '7 days')
    ) THEN
      INSERT INTO public.audit_integrity_flags (
        agent_fub_id, agent_name, rule_key, severity, title, description,
        evidence_record_ids, evidence_summary
      ) VALUES (
        v_rec.agent_fub_id, v_rec.agent_name, 'short_calls', 'high',
        'High Share of Short Calls (' || v_rec.short_calls_pct || '%)',
        v_rec.short_calls_count || ' of ' || v_rec.total_calls || ' calls in the last 30 days lasted under 10 seconds.',
        v_rec.short_call_fub_ids,
        v_rec.short_calls_pct || '% short calls across ' || v_rec.total_calls || ' total calls.'
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 2. Ghost tasks
  FOR v_rec IN SELECT * FROM public.view_audit_ghost_completed_tasks LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_integrity_flags
      WHERE rule_key = 'ghost_task'
        AND evidence_record_ids @> jsonb_build_array(v_rec.task_fub_id)
    ) THEN
      INSERT INTO public.audit_integrity_flags (
        agent_fub_id, agent_name, rule_key, severity, title, description,
        lead_fub_id, evidence_record_ids, evidence_summary
      ) VALUES (
        v_rec.agent_fub_id, v_rec.agent_name, 'ghost_task', 'medium',
        'Task Completed With No Contact ("' || v_rec.task_name || '")',
        v_rec.issue_description,
        v_rec.lead_fub_id,
        jsonb_build_array(v_rec.task_fub_id),
        'Task ID #' || v_rec.task_fub_id || ' completed at ' || v_rec.completed_at
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 3. Unjustified lost/trash
  FOR v_rec IN SELECT * FROM public.view_audit_unjustified_lost_trash LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_integrity_flags
      WHERE rule_key = 'unjustified_lost_trash'
        AND lead_fub_id = v_rec.lead_fub_id
        AND created_at >= (now() - INTERVAL '14 days')
    ) THEN
      INSERT INTO public.audit_integrity_flags (
        agent_fub_id, agent_name, rule_key, severity, title, description,
        lead_fub_id, evidence_record_ids, evidence_summary
      ) VALUES (
        v_rec.agent_fub_id, v_rec.agent_name, 'unjustified_lost_trash', 'medium',
        'Lead Moved to ' || v_rec.to_stage || ' Without Note',
        v_rec.issue_description,
        v_rec.lead_fub_id,
        jsonb_build_array(v_rec.lead_fub_id),
        'Lead ID #' || v_rec.lead_fub_id || ' moved from ' || COALESCE(v_rec.from_stage, 'Unknown') || ' to ' || v_rec.to_stage
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 4. Skipped stages
  FOR v_rec IN SELECT * FROM public.view_audit_skipped_stages LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_integrity_flags
      WHERE rule_key = 'skipped_stage'
        AND lead_fub_id = v_rec.lead_fub_id
        AND created_at >= (now() - INTERVAL '14 days')
    ) THEN
      INSERT INTO public.audit_integrity_flags (
        agent_fub_id, agent_name, rule_key, severity, title, description,
        lead_fub_id, evidence_record_ids, evidence_summary
      ) VALUES (
        v_rec.agent_fub_id, v_rec.agent_name, 'skipped_stage', 'high',
        'Stage Jump to ' || v_rec.to_stage,
        v_rec.issue_description,
        v_rec.lead_fub_id,
        jsonb_build_array(v_rec.lead_fub_id),
        'Direct jump from "' || COALESCE(v_rec.from_stage, 'None') || '" to "' || v_rec.to_stage || '" on lead #' || v_rec.lead_fub_id
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- 5. Duplicate notes
  FOR v_rec IN SELECT * FROM public.view_audit_duplicate_notes LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.audit_integrity_flags
      WHERE agent_fub_id = v_rec.agent_fub_id
        AND rule_key = 'duplicate_notes'
        AND created_at >= (now() - INTERVAL '7 days')
    ) THEN
      INSERT INTO public.audit_integrity_flags (
        agent_fub_id, agent_name, rule_key, severity, title, description,
        evidence_record_ids, evidence_summary
      ) VALUES (
        v_rec.agent_fub_id, v_rec.agent_name, 'duplicate_notes', 'medium',
        'Duplicate Note Across ' || v_rec.distinct_leads_count || ' Leads',
        v_rec.issue_description || ': "' || SUBSTRING(v_rec.note_content_clean, 1, 80) || '..."',
        v_rec.note_fub_ids,
        'Note template repeated across leads ' || v_rec.lead_fub_ids::text
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted_flags', v_inserted);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. AUDIT RUBRIC & CLAUDE GRADING
-- ------------------------------------------------------------------------------

-- Rubric Criteria Table
CREATE TABLE IF NOT EXISTS public.audit_rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Communication Quality',
  weight NUMERIC NOT NULL DEFAULT 1.0,
  anchor_1 TEXT NOT NULL, -- Low anchor
  anchor_3 TEXT NOT NULL, -- Medium anchor
  anchor_5 TEXT NOT NULL, -- High anchor
  description TEXT,
  examples TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed placeholder criteria (user will supply real rubric via UI)
INSERT INTO public.audit_rubric_criteria (key, name, category, weight, anchor_1, anchor_3, anchor_5, description, sort_order)
VALUES
  (
    'response_quality_and_clarity',
    'Response Quality & Clarity',
    'Conversation Quality',
    1.0,
    'One-word answers, dismissive tone, leaves buyer questions unanswered.',
    'Adequate responses that answer direct questions with standard information.',
    'Warm, proactive, thorough explanations that anticipate the client''s next question.',
    'Evaluates the depth, helpfulness, and tone of the agent''s messages.',
    1
  ),
  (
    'motivation_discovery',
    'Motivation & Timeline Discovery',
    'Discovery & Needs Assessment',
    1.0,
    'No questions asked about timeline, budget, motivation, or pre-approval status.',
    'Asks basic timeline or budget questions but does not dig deeper or log specifics.',
    'Systematically uncovers moving timeline, motivation drivers, and financial readiness.',
    'Grades whether the agent actively discovers what is driving the client to move.',
    2
  ),
  (
    'clear_call_to_action',
    'Clear Call-to-Action (CTA)',
    'Conversion Skills',
    1.0,
    'Conversation ends passively with no proposed next step or appointment ask.',
    'Vague CTA such as "let me know if you need anything" without specific times.',
    'Definitive, low-friction next step proposed (e.g. "Does Thursday at 4 or Friday at 10 work better?").',
    'Assesses whether the agent drives toward an appointment or defined next step.',
    3
  ),
  (
    'crm_documentation_integrity',
    'CRM Note & Stage Accuracy',
    'Data Integrity',
    1.0,
    'No notes explaining conversation context; stages do not reflect actual readiness.',
    'Occasional notes but lacks key details; stages updated with delay.',
    'Concise, detailed bullet notes summarizing every touchpoint; stage perfectly matched to timeline.',
    'Grades whether notes accurately represent what was discussed in calls/texts.',
    4
  )
ON CONFLICT (key) DO NOTHING;

-- Claude Batches Management
CREATE TABLE IF NOT EXISTS public.audit_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anthropic_batch_id TEXT UNIQUE,
  batch_type TEXT NOT NULL, -- 'lead_grading' | 'flag_review' | 'report_writing' | 'calibration'
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'processing' | 'ended' | 'failed'
  total_requests INT NOT NULL DEFAULT 0,
  completed_requests INT NOT NULL DEFAULT 0,
  audit_month TEXT, -- e.g. '2026-09'
  results_summary JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Sampled Leads for Claude Grading
CREATE TABLE IF NOT EXISTS public.audit_sampled_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_month TEXT NOT NULL, -- 'YYYY-MM'
  batch_id UUID REFERENCES public.audit_batches(id) ON DELETE SET NULL,
  agent_fub_id BIGINT NOT NULL,
  agent_name TEXT NOT NULL,
  person_fub_id BIGINT NOT NULL,
  anonymized_label TEXT NOT NULL DEFAULT 'Agent A',
  timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb, -- chronological array of activities with IDs and speaker
  grading_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'graded' | 'error'
  overall_score NUMERIC,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_sampled_leads_month ON public.audit_sampled_leads (audit_month, agent_fub_id);

-- Individual Lead Criterion Grades
CREATE TABLE IF NOT EXISTS public.audit_lead_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sampled_lead_id UUID NOT NULL REFERENCES public.audit_sampled_leads(id) ON DELETE CASCADE,
  criterion_id UUID REFERENCES public.audit_rubric_criteria(id) ON DELETE SET NULL,
  criterion_key TEXT NOT NULL,
  score INT, -- 1-5 or NULL if insufficient_evidence
  insufficient_evidence BOOLEAN NOT NULL DEFAULT false,
  cited_activity_ids JSONB DEFAULT '[]'::jsonb,
  excerpt TEXT,
  reasoning TEXT,
  -- Human review overrides
  human_override_score INT,
  human_override_notes TEXT,
  human_override_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'agreed' | 'disagreed'
  human_override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  human_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_lead_grades_lead ON public.audit_lead_grades (sampled_lead_id);

-- Compliance Flags (Fair Housing, Pricing Promises, etc. - NEVER scored)
CREATE TABLE IF NOT EXISTS public.audit_compliance_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sampled_lead_id UUID REFERENCES public.audit_sampled_leads(id) ON DELETE CASCADE,
  person_fub_id BIGINT NOT NULL,
  agent_fub_id BIGINT NOT NULL,
  agent_name TEXT,
  flag_type TEXT NOT NULL, -- 'fair_housing' | 'pricing_promise' | 'steering' | 'licensing' | 'other'
  exact_language TEXT NOT NULL,
  cited_activity_ids JSONB DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL DEFAULT 'high',
  human_review_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'dismissed'
  human_notes TEXT,
  human_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  human_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_compliance_agent ON public.audit_compliance_flags (agent_fub_id);

-- Monthly Audit Reports
CREATE TABLE IF NOT EXISTS public.audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_month TEXT NOT NULL, -- 'YYYY-MM'
  agent_fub_id BIGINT, -- NULL for team rollup report
  agent_name TEXT,
  report_type TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'team_rollup'
  precomputed_sql_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  claude_narrative TEXT,
  average_quality_score NUMERIC,
  total_leads_audited INT NOT NULL DEFAULT 0,
  open_flags_count INT NOT NULL DEFAULT 0,
  compliance_flags_count INT NOT NULL DEFAULT 0,
  human_notes TEXT,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_month ON public.audit_reports (audit_month, report_type);

-- ------------------------------------------------------------------------------
-- 5. CALIBRATION SUPPORT
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_calibration_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_calibration_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_set_id UUID NOT NULL REFERENCES public.audit_calibration_sets(id) ON DELETE CASCADE,
  person_fub_id BIGINT NOT NULL,
  agent_fub_id BIGINT,
  agent_name TEXT,
  lead_name TEXT,
  timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_calibration_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_lead_id UUID NOT NULL REFERENCES public.audit_calibration_leads(id) ON DELETE CASCADE,
  criterion_id UUID REFERENCES public.audit_rubric_criteria(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,
  human_score INT NOT NULL, -- 1-5
  human_notes TEXT,
  claude_score INT, -- 1-5 or NULL
  claude_reasoning TEXT,
  agreement_delta INT GENERATED ALWAYS AS (ABS(human_score - COALESCE(claude_score, human_score))) STORED,
  is_exact_match BOOLEAN GENERATED ALWAYS AS (human_score = claude_score) STORED,
  is_within_one BOOLEAN GENERATED ALWAYS AS (ABS(human_score - COALESCE(claude_score, human_score)) <= 1) STORED,
  claude_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. SQL COMPUTATION / ROLLUP VIEWS (NO CLAUDE MATH)
-- ------------------------------------------------------------------------------

-- Per-agent SQL metrics summary view
CREATE OR REPLACE VIEW public.view_audit_agent_monthly_metrics AS
SELECT
  a.fub_id AS agent_fub_id,
  a.name AS agent_name,
  COALESCE(leads_cnt.total_leads, 0) AS total_assigned_leads,
  COALESCE(calls_cnt.total_calls, 0) AS total_calls,
  COALESCE(calls_cnt.short_calls, 0) AS total_short_calls,
  ROUND(
    (COALESCE(calls_cnt.short_calls, 0)::numeric / NULLIF(COALESCE(calls_cnt.total_calls, 0), 0)) * 100,
    1
  ) AS short_calls_pct,
  COALESCE(texts_cnt.total_texts, 0) AS total_texts,
  COALESCE(emails_cnt.total_emails, 0) AS total_emails,
  COALESCE(tasks_cnt.total_tasks_completed, 0) AS tasks_completed,
  COALESCE(flags_cnt.open_flags_count, 0) AS open_integrity_flags_count,
  COALESCE(comp_cnt.compliance_flags_count, 0) AS compliance_flags_count,
  COALESCE(grades_agg.avg_rubric_score, 0) AS avg_rubric_score,
  COALESCE(grades_agg.leads_graded_count, 0) AS leads_graded_count
FROM public.fub_agents a
LEFT JOIN (
  SELECT assigned_user_fub_id, COUNT(*) AS total_leads
  FROM public.fub_leads
  GROUP BY assigned_user_fub_id
) leads_cnt ON leads_cnt.assigned_user_fub_id = a.fub_id
LEFT JOIN (
  SELECT user_fub_id,
         COUNT(*) AS total_calls,
         COUNT(CASE WHEN duration <= 10 THEN 1 END) AS short_calls
  FROM public.fub_calls
  WHERE fub_created_at >= (now() - INTERVAL '30 days')
  GROUP BY user_fub_id
) calls_cnt ON calls_cnt.user_fub_id = a.fub_id
LEFT JOIN (
  SELECT user_fub_id, COUNT(*) AS total_texts
  FROM public.fub_text_messages
  WHERE fub_created_at >= (now() - INTERVAL '30 days')
  GROUP BY user_fub_id
) texts_cnt ON texts_cnt.user_fub_id = a.fub_id
LEFT JOIN (
  SELECT user_fub_id, COUNT(*) AS total_emails
  FROM public.fub_emails
  WHERE fub_created_at >= (now() - INTERVAL '30 days')
  GROUP BY user_fub_id
) emails_cnt ON emails_cnt.user_fub_id = a.fub_id
LEFT JOIN (
  SELECT assigned_user_fub_id, COUNT(*) AS total_tasks_completed
  FROM public.fub_tasks
  WHERE is_completed = true AND completed_at >= (now() - INTERVAL '30 days')
  GROUP BY assigned_user_fub_id
) tasks_cnt ON tasks_cnt.assigned_user_fub_id = a.fub_id
LEFT JOIN (
  SELECT agent_fub_id, COUNT(*) AS open_flags_count
  FROM public.audit_integrity_flags
  WHERE status IN ('open', 'needs_human_review')
  GROUP BY agent_fub_id
) flags_cnt ON flags_cnt.agent_fub_id = a.fub_id
LEFT JOIN (
  SELECT agent_fub_id, COUNT(*) AS compliance_flags_count
  FROM public.audit_compliance_flags
  WHERE human_review_status = 'pending'
  GROUP BY agent_fub_id
) comp_cnt ON comp_cnt.agent_fub_id = a.fub_id
LEFT JOIN (
  SELECT sl.agent_fub_id,
         ROUND(AVG(COALESCE(lg.human_override_score, lg.score)), 2) AS avg_rubric_score,
         COUNT(DISTINCT sl.id) AS leads_graded_count
  FROM public.audit_sampled_leads sl
  JOIN public.audit_lead_grades lg ON lg.sampled_lead_id = sl.id
  WHERE lg.score IS NOT NULL OR lg.human_override_score IS NOT NULL
  GROUP BY sl.agent_fub_id
) grades_agg ON grades_agg.agent_fub_id = a.fub_id
WHERE a.is_active = true
  AND LOWER(a.name) NOT LIKE '%matt smith%';

-- ------------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY POLICIES (ADMIN-ONLY)
-- ------------------------------------------------------------------------------

-- Helper to enable RLS and grant Admin-only access
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'fub_sync_logs',
    'fub_agents',
    'fub_leads',
    'fub_notes',
    'fub_calls',
    'fub_text_messages',
    'fub_emails',
    'fub_tasks',
    'fub_appointments',
    'fub_deals',
    'fub_stage_history',
    'audit_integrity_thresholds',
    'audit_integrity_flags',
    'audit_rubric_criteria',
    'audit_batches',
    'audit_sampled_leads',
    'audit_lead_grades',
    'audit_compliance_flags',
    'audit_reports',
    'audit_calibration_sets',
    'audit_calibration_leads',
    'audit_calibration_grades'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I;', tbl);
    EXECUTE format('
      CREATE POLICY "Admins full access" ON public.%I
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), ''admin''::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role));
    ', tbl);
  END LOOP;
END $$;
