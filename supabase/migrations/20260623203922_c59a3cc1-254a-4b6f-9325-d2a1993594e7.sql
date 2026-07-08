
ALTER TABLE public.closing_gift_requests
  ADD COLUMN IF NOT EXISTS closing_date date,
  ADD COLUMN IF NOT EXISTS closing_location text CHECK (closing_location IN ('rolla','str','osage_beach')),
  ADD COLUMN IF NOT EXISTS comments text;

CREATE OR REPLACE FUNCTION public.notify_on_closing_gift_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  shirt_count int;
  loc_label text;
  msg text;
BEGIN
  shirt_count := COALESCE(jsonb_array_length(NEW.shirts), 0);
  loc_label := CASE NEW.closing_location
    WHEN 'rolla' THEN 'Rolla'
    WHEN 'str' THEN 'St. Robert'
    WHEN 'osage_beach' THEN 'Osage Beach'
    ELSE NULL
  END;
  msg := NEW.agent_name || ' has requested closing gifts for '
         || NEW.client_first_name || ' ' || NEW.client_last_name
         || '. ' || shirt_count || ' shirt' || CASE WHEN shirt_count = 1 THEN '' ELSE 's' END || ' ordered.';
  IF NEW.closing_date IS NOT NULL OR loc_label IS NOT NULL THEN
    msg := msg || ' Closing'
      || COALESCE(' on ' || to_char(NEW.closing_date, 'Mon DD, YYYY'), '')
      || COALESCE(' in ' || loc_label, '')
      || '.';
  END IF;
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT ur.user_id, 'closing_gift_request', msg, NULL
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','client_care');
  RETURN NEW;
END;
$function$;
