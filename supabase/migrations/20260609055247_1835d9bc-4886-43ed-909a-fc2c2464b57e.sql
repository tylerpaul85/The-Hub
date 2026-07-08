
DROP POLICY IF EXISTS "Authenticated insert history" ON public.content_history;
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
REVOKE INSERT ON public.content_history FROM authenticated;
REVOKE INSERT ON public.notifications FROM authenticated;
