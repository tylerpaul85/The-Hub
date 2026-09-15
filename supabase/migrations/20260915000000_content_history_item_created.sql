-- Migration: Log Item Created in content_history
-- Updates log_content_changes trigger to fire on INSERT as well as UPDATE

CREATE OR REPLACE FUNCTION public.log_content_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := coalesce(auth.uid(), NEW.created_by);
BEGIN
  -- 1. On INSERT, automatically log the item creation event
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value, created_at)
    VALUES (NEW.id, uid, 'created', NULL, NEW.title, NEW.created_at);
    RETURN NEW;
  END IF;

  -- 2. On UPDATE, log individual field modifications
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'title', OLD.title, NEW.title);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'scheduled_at', OLD.scheduled_at::text, NEW.scheduled_at::text);
  END IF;
  IF NEW.target_publish_date IS DISTINCT FROM OLD.target_publish_date THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'target_publish_date', OLD.target_publish_date::text, NEW.target_publish_date::text);
  END IF;
  IF NEW.caption IS DISTINCT FROM OLD.caption THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'caption', OLD.caption, NEW.caption);
  END IF;
  IF NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'thumbnail_url', OLD.thumbnail_url, NEW.thumbnail_url);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'notes', OLD.notes, NEW.notes);
  END IF;
  IF NEW.link IS DISTINCT FROM OLD.link THEN
    INSERT INTO public.content_history(content_id, user_id, field, old_value, new_value)
    VALUES (NEW.id, uid, 'link', OLD.link, NEW.link);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to listen on both INSERT and UPDATE
DROP TRIGGER IF EXISTS content_items_history ON public.content_items;
CREATE TRIGGER content_items_history
  AFTER INSERT OR UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_content_changes();
