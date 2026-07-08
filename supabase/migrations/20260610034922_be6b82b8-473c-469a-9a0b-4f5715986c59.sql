
-- ============== SECURITY AUDIT LOG ==============
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id   text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_log_created_at_idx ON public.security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_event_type_idx ON public.security_audit_log (event_type);
CREATE INDEX IF NOT EXISTS security_audit_log_actor_idx ON public.security_audit_log (actor_user_id);

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read. No INSERT/UPDATE/DELETE policies => append-only via SECURITY DEFINER function.
DROP POLICY IF EXISTS "audit_log_admin_read" ON public.security_audit_log;
CREATE POLICY "audit_log_admin_read" ON public.security_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Logger function (SECURITY DEFINER => can write past RLS)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _target_user_id uuid DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.security_audit_log (
    event_type, actor_user_id, target_user_id, target_id, metadata, ip_address, user_agent
  ) VALUES (
    _event_type,
    auth.uid(),
    _target_user_id,
    _target_id,
    COALESCE(_metadata, '{}'::jsonb),
    NULLIF(_ip_address, '')::inet,
    _user_agent
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, jsonb, text, text) TO authenticated, service_role;

-- ============== AUTO-LOG DELETES ==============
CREATE OR REPLACE FUNCTION public.audit_delete_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev text;
  title_text text;
BEGIN
  ev := 'delete.' || TG_TABLE_NAME;
  title_text := COALESCE(
    (to_jsonb(OLD)->>'title'),
    (to_jsonb(OLD)->>'name'),
    (to_jsonb(OLD)->>'description'),
    NULL
  );
  INSERT INTO public.security_audit_log (event_type, actor_user_id, target_id, metadata)
  VALUES (ev, auth.uid(), (to_jsonb(OLD)->>'id'),
          jsonb_build_object('table', TG_TABLE_NAME, 'title', title_text));
  RETURN OLD;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_items','content_archive','rocks','todos','issues','videos','processes','marketing_requests'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_delete_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER audit_delete_%I AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_delete_trigger()', t, t);
  END LOOP;
END $$;

-- Audit role changes
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_audit_log (event_type, actor_user_id, target_user_id, metadata)
    VALUES ('user_role.add', auth.uid(), NEW.user_id, jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_audit_log (event_type, actor_user_id, target_user_id, metadata)
    VALUES ('user_role.remove', auth.uid(), OLD.user_id, jsonb_build_object('role', OLD.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

-- ============== RATE LIMITS ==============
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text NOT NULL,
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

GRANT ALL ON public.rate_limits TO service_role;
-- No grants for anon/authenticated: only SECURITY DEFINER functions touch this.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allows callers to increment and check a rate limit window atomically.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _bucket text,
  _key text,
  _window_seconds integer,
  _max integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w timestamptz;
  c integer;
BEGIN
  w := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limits (bucket, key, window_start, count)
  VALUES (_bucket, _key, w, 1)
  ON CONFLICT (bucket, key, window_start) DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO c;
  -- Best-effort cleanup of old rows
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '7 days';
  RETURN c <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO anon, authenticated, service_role;
