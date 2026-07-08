
-- Add new role enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing_coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'video_editor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'videographer';

-- Helper: does the user hold ANY of the supplied role names (compared as text to avoid enum literal cache issues)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = ANY(_roles)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) TO authenticated;
