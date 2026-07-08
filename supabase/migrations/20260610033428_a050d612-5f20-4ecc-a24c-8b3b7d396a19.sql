
ALTER TABLE public.content_archive
  ADD COLUMN IF NOT EXISTS source_content_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS content_archive_source_content_id_key
  ON public.content_archive(source_content_id)
  WHERE source_content_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  combined_notes TEXT;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    combined_notes := NULLIF(TRIM(BOTH E'\n' FROM COALESCE(NEW.caption, '') || CASE WHEN NEW.caption IS NOT NULL AND NEW.notes IS NOT NULL THEN E'\n\n' ELSE '' END || COALESCE(NEW.notes, '')), '');

    INSERT INTO public.content_archive (
      title, file_url, file_type, content_type, platforms,
      date_created, notes, uploaded_by, source_content_id
    ) VALUES (
      NEW.title,
      NEW.thumbnail_url,
      CASE WHEN NEW.thumbnail_url IS NOT NULL THEN 'image/jpeg' ELSE NULL END,
      'Social Graphic',
      COALESCE(NEW.platforms, '{}'),
      COALESCE(NEW.scheduled_at::date, CURRENT_DATE),
      combined_notes,
      NEW.created_by,
      NEW.id
    )
    ON CONFLICT (source_content_id) DO UPDATE SET
      title = EXCLUDED.title,
      file_url = EXCLUDED.file_url,
      file_type = EXCLUDED.file_type,
      platforms = EXCLUDED.platforms,
      date_created = EXCLUDED.date_created,
      notes = EXCLUDED.notes,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_items_archive_on_publish ON public.content_items;
CREATE TRIGGER content_items_archive_on_publish
  AFTER INSERT OR UPDATE OF status ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.archive_on_publish();
