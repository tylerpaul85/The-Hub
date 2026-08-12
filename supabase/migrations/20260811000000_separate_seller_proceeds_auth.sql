-- ============================================================
-- Custom Auth System for Seller Proceeds
-- 1. Create seller_proceeds_accounts and seller_sessions
-- 2. Migrate data from agent_accounts
-- 3. Replace auth.uid() with auth.seller_uid()
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- 1. Create new tables
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seller_proceeds_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  phone text,
  office_location text DEFAULT '1043 Kingshighway, Rolla, MO 65401',
  office_phone text DEFAULT '(573) 451-2020',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.seller_proceeds_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_proceeds_accounts TO authenticated, anon;
GRANT ALL ON public.seller_proceeds_accounts TO service_role;
ALTER TABLE public.seller_proceeds_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.seller_sessions TO authenticated, anon;
GRANT ALL ON public.seller_sessions TO service_role;
ALTER TABLE public.seller_sessions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 2. Migrate existing accounts
-- ----------------------------------------------------------------

INSERT INTO public.seller_proceeds_accounts (id, email, password_hash, full_name, phone, office_location, office_phone, created_at, updated_at)
SELECT a.id, a.email, u.encrypted_password, a.full_name, a.phone, a.office_location, a.office_phone, a.created_at, a.updated_at
FROM public.agent_accounts a
JOIN auth.users u ON u.id = a.id
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. Update seller_net_sheets foreign key
-- ----------------------------------------------------------------

ALTER TABLE public.seller_net_sheets DROP CONSTRAINT seller_net_sheets_agent_id_fkey;
ALTER TABLE public.seller_net_sheets 
  ADD CONSTRAINT seller_net_sheets_agent_id_fkey 
  FOREIGN KEY (agent_id) REFERENCES public.seller_proceeds_accounts(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- 4. Custom Auth Utilities
-- ----------------------------------------------------------------

-- Read token from header
CREATE OR REPLACE FUNCTION public.seller_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  header_json jsonb;
  token_val uuid;
  acc_id uuid;
BEGIN
  BEGIN
    header_json := current_setting('request.headers', true)::jsonb;
    token_val := (header_json->>'x-seller-session')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF token_val IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT account_id INTO acc_id FROM public.seller_sessions WHERE token = token_val AND expires_at > now();
  RETURN acc_id;
END;
$$;

-- Login RPC
CREATE OR REPLACE FUNCTION public.seller_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc public.seller_proceeds_accounts;
  new_token uuid;
BEGIN
  SELECT * INTO acc FROM public.seller_proceeds_accounts WHERE LOWER(email) = LOWER(trim(p_email));
  
  IF acc.id IS NULL THEN
    RETURN json_build_object('error', 'Invalid login credentials');
  END IF;

  IF acc.password_hash = crypt(p_password, acc.password_hash) THEN
    -- Success
    INSERT INTO public.seller_sessions (account_id) VALUES (acc.id) RETURNING token INTO new_token;
    RETURN json_build_object(
      'token', new_token,
      'account', json_build_object(
        'id', acc.id,
        'email', acc.email,
        'full_name', acc.full_name,
        'phone', acc.phone,
        'office_location', acc.office_location,
        'office_phone', acc.office_phone,
        'created_at', acc.created_at
      )
    );
  ELSE
    RETURN json_build_object('error', 'Invalid login credentials');
  END IF;
END;
$$;

-- Signup RPC
CREATE OR REPLACE FUNCTION public.seller_signup(p_email text, p_password text, p_full_name text, p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_email text := LOWER(trim(p_email));
  acc_id uuid;
  new_token uuid;
BEGIN
  IF clean_email NOT LIKE '%@mattsmithrealestategroup.com' THEN
    RETURN json_build_object('error', 'Accounts are limited to @mattsmithrealestategroup.com email addresses.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.seller_proceeds_accounts WHERE email = clean_email) THEN
    RETURN json_build_object('error', 'An account with this email already exists.');
  END IF;

  INSERT INTO public.seller_proceeds_accounts (email, password_hash, full_name, phone)
  VALUES (clean_email, crypt(p_password, gen_salt('bf')), trim(p_full_name), p_phone)
  RETURNING id INTO acc_id;

  INSERT INTO public.seller_sessions (account_id) VALUES (acc_id) RETURNING token INTO new_token;

  RETURN json_build_object(
    'token', new_token,
    'account', json_build_object(
      'id', acc_id,
      'email', clean_email,
      'full_name', p_full_name,
      'phone', p_phone,
      'office_location', '1043 Kingshighway, Rolla, MO 65401',
      'office_phone', '(573) 451-2020',
      'created_at', now()
    )
  );
END;
$$;

-- Logout RPC
CREATE OR REPLACE FUNCTION public.seller_logout(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.seller_sessions WHERE token = p_token;
END;
$$;

-- Refresh / Get Profile RPC
CREATE OR REPLACE FUNCTION public.seller_get_profile(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc public.seller_proceeds_accounts;
BEGIN
  SELECT a.* INTO acc
  FROM public.seller_proceeds_accounts a
  JOIN public.seller_sessions s ON s.account_id = a.id
  WHERE s.token = p_token AND s.expires_at > now();

  IF acc.id IS NULL THEN
    RETURN json_build_object('error', 'Invalid or expired session');
  END IF;

  RETURN json_build_object(
    'account', json_build_object(
      'id', acc.id,
      'email', acc.email,
      'full_name', acc.full_name,
      'phone', acc.phone,
      'office_location', acc.office_location,
      'office_phone', acc.office_phone,
      'created_at', acc.created_at
    )
  );
END;
$$;

-- ----------------------------------------------------------------
-- 5. Update RLS Policies
-- ----------------------------------------------------------------

-- seller_net_sheets
DROP POLICY IF EXISTS "seller_net_sheets_select_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_select_policy" ON public.seller_net_sheets
  FOR SELECT TO authenticated, anon
  USING (
    agent_id = public.seller_uid() OR
    public.has_role(auth.uid(), 'admin') -- Keep admin fallback if needed via standard auth
  );

DROP POLICY IF EXISTS "seller_net_sheets_insert_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_insert_policy" ON public.seller_net_sheets
  FOR INSERT TO authenticated, anon
  WITH CHECK (agent_id = public.seller_uid());

DROP POLICY IF EXISTS "seller_net_sheets_update_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_update_policy" ON public.seller_net_sheets
  FOR UPDATE TO authenticated, anon
  USING (agent_id = public.seller_uid())
  WITH CHECK (agent_id = public.seller_uid());

DROP POLICY IF EXISTS "seller_net_sheets_delete_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_delete_policy" ON public.seller_net_sheets
  FOR DELETE TO authenticated, anon
  USING (agent_id = public.seller_uid());

-- RLS for seller_proceeds_accounts (Using public.seller_uid())
DROP POLICY IF EXISTS "seller_proceeds_accounts_select_policy" ON public.seller_proceeds_accounts;
CREATE POLICY "seller_proceeds_accounts_select_policy" ON public.seller_proceeds_accounts
  FOR SELECT TO authenticated, anon
  USING (id = public.seller_uid());

DROP POLICY IF EXISTS "seller_proceeds_accounts_update_policy" ON public.seller_proceeds_accounts;
CREATE POLICY "seller_proceeds_accounts_update_policy" ON public.seller_proceeds_accounts
  FOR UPDATE TO authenticated, anon
  USING (id = public.seller_uid())
  WITH CHECK (id = public.seller_uid());
