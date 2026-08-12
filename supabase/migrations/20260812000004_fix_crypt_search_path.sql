CREATE OR REPLACE FUNCTION public.seller_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  acc public.seller_proceeds_accounts;
  new_token uuid;
BEGIN
  SELECT * INTO acc FROM public.seller_proceeds_accounts WHERE LOWER(email) = LOWER(trim(p_email));
  
  IF acc.id IS NULL THEN
    RETURN json_build_object('error', 'Invalid login credentials');
  END IF;

  IF acc.password_hash = extensions.crypt(p_password, acc.password_hash) THEN
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

CREATE OR REPLACE FUNCTION public.seller_signup(p_email text, p_password text, p_full_name text, p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
  VALUES (clean_email, extensions.crypt(p_password, extensions.gen_salt('bf')), trim(p_full_name), p_phone)
  RETURNING id INTO acc_id;

  INSERT INTO public.seller_sessions (account_id) VALUES (acc_id) RETURNING token INTO new_token;

  RETURN json_build_object(
    'token', new_token,
    'account', json_build_object(
      'id', acc_id,
      'email', clean_email,
      'full_name', trim(p_full_name),
      'phone', p_phone
    )
  );
END;
$$;
