
-- 1) Drop strict FKs on audit log so writes don't fail when a referenced user is missing
ALTER TABLE public.security_audit_log DROP CONSTRAINT IF EXISTS security_audit_log_target_user_id_fkey;
ALTER TABLE public.security_audit_log DROP CONSTRAINT IF EXISTS security_audit_log_actor_user_id_fkey;

-- 2) Re-key existing orphan profiles/user_roles to match auth.users by email
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id AS new_id, p.id AS old_id, u.email
    FROM auth.users u
    JOIN public.profiles p ON lower(p.email) = lower(u.email)
    WHERE p.id <> u.id
      AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id)
  LOOP
    UPDATE public.user_roles SET user_id = r.new_id WHERE user_id = r.old_id;
    UPDATE public.profiles SET id = r.new_id WHERE id = r.old_id;
  END LOOP;
END $$;

-- 3) Update handle_new_user trigger to re-key any matching-email profile to the new auth user id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_profile_id uuid;
  is_first_user boolean;
BEGIN
  -- If a profile already exists for this email under a different id, re-key it
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
    AND id <> NEW.id
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.user_roles SET user_id = NEW.id WHERE user_id = existing_profile_id;
    UPDATE public.profiles
      SET id = NEW.id,
          first_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name',''), first_name),
          last_name  = COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name',''), last_name)
      WHERE id = existing_profile_id;
  ELSE
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Ensure the user has a role: keep any re-keyed role, else assign one
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, CASE WHEN is_first_user THEN 'admin'::public.app_role ELSE 'contributor'::public.app_role END);
  END IF;

  RETURN NEW;
END;
$function$;
