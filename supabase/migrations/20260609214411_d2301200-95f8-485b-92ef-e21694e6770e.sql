DELETE FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE u.id = ur.user_id
);

DELETE FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE u.id = p.id
)
OR NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = p.id
);