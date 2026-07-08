
DROP POLICY IF EXISTS "Authenticated users can view all marketing requests" ON public.marketing_requests;
CREATE POLICY "Admins can view marketing requests"
  ON public.marketing_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public can read marketing request files" ON storage.objects;
CREATE POLICY "Admins can read marketing request files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'marketing-request-uploads' AND public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
DROP POLICY IF EXISTS "No direct access" ON public.rate_limits;
CREATE POLICY "No direct access"
  ON public.rate_limits FOR ALL
  TO authenticated, anon
  USING (false) WITH CHECK (false);

REVOKE EXECUTE ON FUNCTION public.archive_on_publish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_delete_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_user_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_marketing_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_video_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_content_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, jsonb, text, text) FROM PUBLIC, anon;
