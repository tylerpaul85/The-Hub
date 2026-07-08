
-- Add target publish date to content_items
ALTER TABLE public.content_items 
  ADD COLUMN IF NOT EXISTS target_publish_date date;

-- Comments
CREATE TABLE IF NOT EXISTS public.content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_comments TO authenticated;
GRANT ALL ON public.content_comments TO service_role;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read comments" ON public.content_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert own comments" ON public.content_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author or admin delete comments" ON public.content_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- History
CREATE TABLE IF NOT EXISTS public.content_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.content_history TO authenticated;
GRANT ALL ON public.content_history TO service_role;
ALTER TABLE public.content_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read history" ON public.content_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert history" ON public.content_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow authenticated to view all profiles (needed to show commenter names)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Authenticated view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- History logging trigger
CREATE OR REPLACE FUNCTION public.log_content_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
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

DROP TRIGGER IF EXISTS content_items_history ON public.content_items;
CREATE TRIGGER content_items_history
  AFTER UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.log_content_changes();

-- Comment notification trigger: notify all other authenticated users
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_title text;
  commenter_email text;
BEGIN
  SELECT title INTO c_title FROM public.content_items WHERE id = NEW.content_id;
  SELECT email INTO commenter_email FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT p.id, 'comment',
    COALESCE(commenter_email, 'Someone') || ' commented on "' || COALESCE(c_title, 'a content item') || '"',
    NEW.content_id
  FROM public.profiles p
  WHERE p.id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_comments_notify ON public.content_comments;
CREATE TRIGGER content_comments_notify
  AFTER INSERT ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
