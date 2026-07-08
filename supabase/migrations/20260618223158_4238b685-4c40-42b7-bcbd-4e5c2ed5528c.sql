-- Allow client_care to read closing-gift marketing requests
CREATE POLICY "Client care can view closing gift requests"
  ON public.marketing_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'client_care') AND closing_gift IS NOT NULL);

-- Allow client_care to read storage uploads for marketing requests (used by those requests)
CREATE POLICY "Client care can read marketing request files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'marketing-request-uploads' AND public.has_role(auth.uid(), 'client_care'));

-- Update notify trigger: notify admins as before AND client_care when closing_gift present
CREATE OR REPLACE FUNCTION public.notify_admins_on_marketing_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cg_msg text;
BEGIN
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT ur.user_id, 'marketing_request',
    'New marketing request from ' || NEW.agent_name,
    NULL
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  IF NEW.closing_gift IS NOT NULL THEN
    cg_msg := 'Closing Gift Package request from ' || NEW.agent_name
      || COALESCE(' • Closing ' || (NEW.closing_gift->>'closing_date'), '')
      || COALESCE(' • Office ' || (NEW.closing_gift->>'office_location'), '')
      || COALESCE(' • Shirts ' || (NEW.closing_gift->>'shirt_count'), '');
    INSERT INTO public.notifications(user_id, type, message, content_id)
    SELECT ur.user_id, 'closing_gift_request', cg_msg, NULL
    FROM public.user_roles ur
    WHERE ur.role = 'client_care';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_admins_on_marketing_request() FROM PUBLIC, anon, authenticated;
