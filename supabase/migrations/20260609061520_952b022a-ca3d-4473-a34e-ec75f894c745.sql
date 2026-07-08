
-- Extend content_status enum
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'pending_re_approval';

-- Revision note column
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS revision_note text;

-- Mentions on existing comments
ALTER TABLE public.content_comments ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- Video pipeline
DO $$ BEGIN
  CREATE TYPE public.video_stage AS ENUM ('idea','filming','offloaded','editing','ready');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  drive_link text,
  estimated_publish_date date,
  filmed_by text,
  edited_by text,
  duration text,
  campaign_tag text,
  priority public.content_priority NOT NULL DEFAULT 'normal',
  stage public.video_stage NOT NULL DEFAULT 'idea',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_select_auth" ON public.videos;
DROP POLICY IF EXISTS "videos_insert_auth" ON public.videos;
DROP POLICY IF EXISTS "videos_update_auth" ON public.videos;
DROP POLICY IF EXISTS "videos_delete_admin" ON public.videos;
CREATE POLICY "videos_select_auth" ON public.videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "videos_insert_auth" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "videos_update_auth" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "videos_delete_admin" ON public.videos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vc_select" ON public.video_comments;
DROP POLICY IF EXISTS "vc_insert" ON public.video_comments;
DROP POLICY IF EXISTS "vc_delete" ON public.video_comments;
CREATE POLICY "vc_select" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "vc_insert" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "vc_delete" ON public.video_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Update comment-notify to include mentions
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_title text;
  commenter_email text;
  mention uuid;
BEGIN
  SELECT title INTO c_title FROM public.content_items WHERE id = NEW.content_id;
  SELECT email INTO commenter_email FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT p.id, 'comment',
    COALESCE(commenter_email, 'Someone') || ' commented on "' || COALESCE(c_title, 'a content item') || '"',
    NEW.content_id
  FROM public.profiles p
  WHERE p.id <> NEW.user_id;
  IF NEW.mentions IS NOT NULL THEN
    FOREACH mention IN ARRAY NEW.mentions LOOP
      IF mention <> NEW.user_id THEN
        INSERT INTO public.notifications(user_id, type, message, content_id)
        VALUES (mention, 'mention',
          COALESCE(commenter_email, 'Someone') || ' mentioned you on "' || COALESCE(c_title, 'a content item') || '"',
          NEW.content_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

-- Status-change notifications
CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'needs_revision' AND NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, message, content_id)
      VALUES (NEW.created_by, 'needs_revision',
        '"' || NEW.title || '" needs revision' ||
          CASE WHEN NEW.revision_note IS NOT NULL THEN ': ' || left(NEW.revision_note, 140) ELSE '' END,
        NEW.id);
    ELSIF NEW.status = 'pending_re_approval' THEN
      INSERT INTO public.notifications(user_id, type, message, content_id)
      SELECT ur.user_id, 'pending_re_approval',
        '"' || NEW.title || '" is ready for re-approval', NEW.id
      FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_content_status_notify ON public.content_items;
CREATE TRIGGER trg_content_status_notify
AFTER UPDATE OF status ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

-- Video comment notifications (mentions)
CREATE OR REPLACE FUNCTION public.notify_on_video_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  commenter_email text;
  mention uuid;
BEGIN
  SELECT title INTO v_title FROM public.videos WHERE id = NEW.video_id;
  SELECT email INTO commenter_email FROM public.profiles WHERE id = NEW.user_id;
  IF NEW.mentions IS NOT NULL THEN
    FOREACH mention IN ARRAY NEW.mentions LOOP
      IF mention <> NEW.user_id THEN
        INSERT INTO public.notifications(user_id, type, message, content_id)
        VALUES (mention, 'mention',
          COALESCE(commenter_email, 'Someone') || ' mentioned you on video "' || COALESCE(v_title, '') || '"',
          NULL);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_video_comment_notify ON public.video_comments;
CREATE TRIGGER trg_video_comment_notify
AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_video_comment();

REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_status_change() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_video_comment() FROM PUBLIC, authenticated, anon;
