-- Add updated_at to comment tables
ALTER TABLE public.video_comments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.content_comments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

-- Ensure UPDATE permissions are granted for video_comments and task_comments (content_comments already has it)
GRANT UPDATE ON public.video_comments TO authenticated;
GRANT UPDATE ON public.task_comments TO authenticated;

-- Add RLS policies for updating comments (only author or admin)
-- Using public.has_role is assumed to be defined as in other policies.
CREATE POLICY "vc_update" ON public.video_comments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cc_update" ON public.content_comments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tc_update" ON public.task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
