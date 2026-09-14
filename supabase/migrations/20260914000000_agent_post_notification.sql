-- ============================================================
-- Migration: 20260914000000_agent_post_notification.sql
-- Purpose: Agent notification on listing social media post status transition
-- ============================================================

-- 1. Add idempotency column to public.content_items
ALTER TABLE public.content_items 
  ADD COLUMN IF NOT EXISTS agent_notified_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_agent_notified_at 
  ON public.content_items(agent_notified_at);

-- 2. Create audit log table for notification attempts
CREATE TABLE IF NOT EXISTS public.agent_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  agent_email TEXT,
  agent_name TEXT,
  post_status TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'scheduled' or 'published'
  status TEXT NOT NULL,           -- 'sent', 'failed', 'skipped'
  resend_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_notification_logs_ci 
  ON public.agent_notification_logs(content_item_id);

CREATE INDEX IF NOT EXISTS idx_agent_notification_logs_email 
  ON public.agent_notification_logs(agent_email);

CREATE INDEX IF NOT EXISTS idx_agent_notification_logs_created_at 
  ON public.agent_notification_logs(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_notification_logs TO authenticated;
GRANT ALL ON public.agent_notification_logs TO service_role;

ALTER TABLE public.agent_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view agent notification logs" ON public.agent_notification_logs;
CREATE POLICY "Authenticated can view agent notification logs" 
  ON public.agent_notification_logs 
  FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Service role can manage agent notification logs" ON public.agent_notification_logs;
CREATE POLICY "Service role can manage agent notification logs" 
  ON public.agent_notification_logs 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 3. Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Create Postgres trigger function for notifying agent
CREATE OR REPLACE FUNCTION public.trg_notify_agent_on_post_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_has_listing BOOLEAN;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Guard 1: Must be transition into 'scheduled' or 'published'
  IF NEW.status NOT IN ('scheduled', 'published') THEN
    RETURN NEW;
  END IF;

  -- Guard 2: Must NOT have already been in 'scheduled' or 'published' (transition OUT of draft / review)
  IF OLD.status IN ('scheduled', 'published') THEN
    RETURN NEW;
  END IF;

  -- Guard 3: Hard idempotency check - agent must not have been notified already
  IF NEW.agent_notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Guard 4: Check if this content_item belongs to a listing in listing_posts
  SELECT EXISTS (
    SELECT 1 FROM public.listing_posts lp
    WHERE lp.calendar_entry_id = NEW.id
      AND lp.listing_id IS NOT NULL
  ) INTO v_has_listing;

  IF NOT v_has_listing THEN
    -- Non-listing content calendar post (e.g. general social media, holiday post), safely skip
    RETURN NEW;
  END IF;

  -- Dispatch async HTTP POST to the Supabase Edge Function
  -- pg_net sends the request in the background without blocking the database transaction
  PERFORM net.http_post(
    url := 'https://jxymjhmbaqstmrttjdib.supabase.co/functions/v1/notify-agent-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        current_setting('app.settings.service_role_key', true),
        current_setting('vault.service_role_key', true),
        ''
      )
    ),
    body := jsonb_build_object(
      'content_item_id', NEW.id,
      'new_status', NEW.status,
      'old_status', OLD.status
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never fail the user's status update transaction if the background webhook network dispatch errors
    RAISE WARNING 'trg_notify_agent_on_post_status_change encountered error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 5. Attach the trigger to public.content_items
DROP TRIGGER IF EXISTS trg_notify_agent_on_post_status_change ON public.content_items;
CREATE TRIGGER trg_notify_agent_on_post_status_change
  AFTER UPDATE OF status ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_agent_on_post_status_change();
