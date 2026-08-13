-- ============================================================
-- Google OAuth support: pending_invites, pending_approval, 
-- domain validation, and updated new-user trigger
-- ============================================================

-- 1. Add pending_approval flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT false;

-- 2. Create pending_invites table
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        public.app_role NOT NULL DEFAULT 'contributor',
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  redeemed_at TIMESTAMPTZ,
  UNIQUE (email)
);

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_invites TO authenticated;
GRANT ALL ON public.pending_invites TO service_role;

-- Admins can do everything
CREATE POLICY "Admins manage invites" ON public.pending_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Overwrite handle_new_user to:
--    a) Validate email domain (reject non-MSREG)
--    b) Check pending_invites for pre-assigned role
--    c) Mark pending_approval if no invite found
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain   TEXT;
  is_first_user  BOOLEAN;
  invite_row     public.pending_invites%ROWTYPE;
  assigned_role  public.app_role;
  is_pending     BOOLEAN := false;
BEGIN
  -- Extract domain from email
  email_domain := split_part(NEW.email, '@', 2);

  -- Hard block: reject any email not on the MSREG workspace domain.
  -- This fires even if the client-side hd param was bypassed.
  IF lower(email_domain) <> 'mattsmithrealestategroup.com' THEN
    RAISE EXCEPTION 'Sign-in restricted to @mattsmithrealestategroup.com accounts. Got: %', NEW.email;
  END IF;

  -- Check for a valid (non-expired, non-redeemed) pending invite
  SELECT * INTO invite_row
  FROM public.pending_invites
  WHERE lower(email) = lower(NEW.email)
    AND redeemed_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF invite_row.id IS NOT NULL THEN
    -- Invited user: use the pre-assigned role
    assigned_role := invite_row.role;
    -- Mark invite as redeemed
    UPDATE public.pending_invites
       SET redeemed_at = now()
     WHERE id = invite_row.id;
  ELSE
    -- Check if this is the very first user (make them admin)
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
    IF is_first_user THEN
      assigned_role := 'admin'::public.app_role;
    ELSE
      -- No invite, not first user → contributor with pending approval
      assigned_role := 'contributor'::public.app_role;
      is_pending := true;
    END IF;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, email, first_name, last_name, pending_approval)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    is_pending
  )
  ON CONFLICT (id) DO UPDATE
    SET pending_approval = EXCLUDED.pending_approval;

  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
