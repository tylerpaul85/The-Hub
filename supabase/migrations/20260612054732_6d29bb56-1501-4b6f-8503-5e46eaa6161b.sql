
-- Add converted_task_id link on marketing_requests
ALTER TABLE public.marketing_requests ADD COLUMN IF NOT EXISTS converted_task_id uuid;

-- Task status enum
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo','in_progress','needs_review','revision_needed','complete');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','normal','high');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  description text,
  originating_request_id uuid REFERENCES public.marketing_requests(id) ON DELETE SET NULL,
  agent_name text,
  agent_email text,
  attached_request_files text[] NOT NULL DEFAULT '{}',
  deliverable_sent_at timestamptz,
  deliverable_sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks select auth" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks insert auth" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tasks update auth" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "tasks delete admin" ON public.tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DELIVERABLES
CREATE TABLE public.task_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url text,
  link_url text,
  label text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_deliverables TO authenticated;
GRANT ALL ON public.task_deliverables TO service_role;
ALTER TABLE public.task_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliverables select auth" ON public.task_deliverables FOR SELECT TO authenticated USING (true);
CREATE POLICY "deliverables insert auth" ON public.task_deliverables FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "deliverables update own/admin" ON public.task_deliverables FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "deliverables delete own/admin" ON public.task_deliverables FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- COMMENTS
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments select auth" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments insert own" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "task_comments update own" ON public.task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "task_comments delete own/admin" ON public.task_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Notify on task comment mentions + new task assignment
CREATE OR REPLACE FUNCTION public.notify_on_task_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
        INSERT INTO public.notifications(user_id, type, message, content_id)
        VALUES (mention, 'mention',
          COALESCE(commenter_email, 'Someone') || ' mentioned you on task "' || COALESCE(t_title, '') || '"',
          NULL);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $fn$;
CREATE TRIGGER trg_notify_on_task_comment AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_comment();

CREATE OR REPLACE FUNCTION public.notify_on_task_assign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.owner IS NOT NULL AND (TG_OP='INSERT' OR NEW.owner IS DISTINCT FROM OLD.owner) THEN
    IF NEW.owner <> COALESCE(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications(user_id, type, message, content_id)
      VALUES (NEW.owner, 'task_assigned', 'You were assigned task "' || NEW.title || '"', NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;
CREATE TRIGGER trg_notify_on_task_assign AFTER INSERT OR UPDATE OF owner ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assign();
