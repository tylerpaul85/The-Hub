
-- 1. profiles: restrict SELECT
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- mention picker RPC (returns only id + email; deliberate internal directory)
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY p.email;
$$;
REVOKE ALL ON FUNCTION public.get_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated;

-- 2. videos UPDATE: only creator or admin
DROP POLICY IF EXISTS "videos_update_auth" ON public.videos;
CREATE POLICY "videos_update_owner_or_admin" ON public.videos
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. storage thumbnails INSERT: require owner = auth.uid()
DROP POLICY IF EXISTS "Auth upload thumbnails" ON storage.objects;
CREATE POLICY "Auth upload own thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-thumbnails' AND owner = auth.uid());

-- 4. Revoke EXECUTE on internal trigger functions from PUBLIC/authenticated
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_video_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_content_changes() FROM PUBLIC, anon, authenticated;
