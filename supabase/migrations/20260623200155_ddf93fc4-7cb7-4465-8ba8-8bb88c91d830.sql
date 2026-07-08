CREATE INDEX IF NOT EXISTS content_items_scheduled_at_idx ON public.content_items (scheduled_at);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS issues_meeting_status_idx ON public.issues (meeting_id, status);
CREATE INDEX IF NOT EXISTS issues_status_idx ON public.issues (status);