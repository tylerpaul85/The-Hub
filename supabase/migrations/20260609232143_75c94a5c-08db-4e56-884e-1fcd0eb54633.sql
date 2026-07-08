
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', '')
  );
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'admin'::public.app_role ELSE 'contributor'::public.app_role END);
  RETURN NEW;
END; $function$;

DROP FUNCTION IF EXISTS public.get_team_members();
CREATE OR REPLACE FUNCTION public.get_team_members()
 RETURNS TABLE(id uuid, email text, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.email, p.first_name, p.last_name FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
  ORDER BY COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email);
$function$;

-- Allow admins to manage ratings on behalf of any attendee
DROP POLICY IF EXISTS "ratings self insert" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings self update" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings self delete" ON public.l10_meeting_ratings;

CREATE POLICY "ratings insert" ON public.l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ratings update" ON public.l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ratings delete" ON public.l10_meeting_ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
