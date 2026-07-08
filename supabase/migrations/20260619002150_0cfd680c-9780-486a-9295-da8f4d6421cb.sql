
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_task_id_idx ON public.notifications(task_id);
CREATE INDEX IF NOT EXISTS notifications_video_id_idx ON public.notifications(video_id);

CREATE OR REPLACE FUNCTION public.notify_on_task_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner IS NOT NULL AND (TG_OP='INSERT' OR NEW.owner IS DISTINCT FROM OLD.owner) THEN
    IF NEW.owner <> COALESCE(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications(user_id, type, message, content_id, task_id)
      VALUES (NEW.owner, 'task_assigned', 'You were assigned task "' || NEW.title || '"', NULL, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t_title text;
  commenter_email text;
  mention uuid;
BEGIN
  SELECT title INTO t_title FROM public.tasks WHERE id = NEW.task_id;
  SELECT email INTO commenter_email FROM public.profiles WHERE id = NEW.user_id;
  IF NEW.mentions IS NOT NULL THEN
    FOREACH mention IN ARRAY NEW.mentions LOOP
      IF mention <> NEW.user_id THEN
        INSERT INTO public.notifications(user_id, type, message, content_id, task_id)
        VALUES (mention, 'mention',
          COALESCE(commenter_email, 'Someone') || ' mentioned you on task "' || COALESCE(t_title, '') || '"',
          NULL, NEW.task_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_on_video_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        INSERT INTO public.notifications(user_id, type, message, content_id, video_id)
        VALUES (mention, 'mention',
          COALESCE(commenter_email, 'Someone') || ' mentioned you on video "' || COALESCE(v_title, '') || '"',
          NULL, NEW.video_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;
