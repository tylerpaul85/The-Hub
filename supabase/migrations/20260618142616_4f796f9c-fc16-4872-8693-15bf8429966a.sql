
ALTER TABLE public.content_archive ALTER COLUMN brand SET DEFAULT 'PP';
UPDATE public.content_archive SET brand = 'PP' WHERE brand NOT IN ('LOZ','PP','AON','MSREG ALL');

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS email_body TEXT;

CREATE OR REPLACE FUNCTION public.archive_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  combined_notes TEXT;
  safe_brand TEXT;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    combined_notes := NULLIF(TRIM(BOTH E'\n' FROM COALESCE(NEW.caption, '') || CASE WHEN NEW.caption IS NOT NULL AND NEW.notes IS NOT NULL THEN E'\n\n' ELSE '' END || COALESCE(NEW.notes, '')), '');
    safe_brand := CASE WHEN NEW.brand IN ('LOZ','PP','AON','MSREG ALL') THEN NEW.brand ELSE 'PP' END;

    INSERT INTO public.content_archive (
      title, file_url, file_type, content_type, platforms,
      date_created, notes, uploaded_by, source_content_id, brand
    ) VALUES (
      NEW.title,
      NEW.thumbnail_url,
      CASE WHEN NEW.thumbnail_url IS NOT NULL THEN 'image/jpeg' ELSE NULL END,
      'Social Graphic',
      COALESCE(NEW.platforms, '{}'),
      COALESCE(NEW.scheduled_at::date, CURRENT_DATE),
      combined_notes,
      NEW.created_by,
      NEW.id,
      safe_brand
    )
    ON CONFLICT (source_content_id) DO UPDATE SET
      title = EXCLUDED.title,
      file_url = EXCLUDED.file_url,
      file_type = EXCLUDED.file_type,
      platforms = EXCLUDED.platforms,
      date_created = EXCLUDED.date_created,
      notes = EXCLUDED.notes,
      brand = EXCLUDED.brand,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;
