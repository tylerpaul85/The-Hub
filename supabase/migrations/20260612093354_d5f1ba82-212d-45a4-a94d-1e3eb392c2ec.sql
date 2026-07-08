
-- 1) L10 meetings: prevent non-admins from changing status
DROP POLICY IF EXISTS "meetings update open or admin" ON public.l10_meetings;
CREATE POLICY "meetings update open or admin" ON public.l10_meetings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR status = 'in_progress')
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (auth.uid() IS NOT NULL AND status = 'in_progress')
  );

-- 2) Event checklist items: only admin or event creator/host can update
DROP POLICY IF EXISTS checklist_update_admin_or_completer ON public.event_checklist_items;
CREATE POLICY checklist_update_admin_or_host ON public.event_checklist_items
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_checklist_items.event_id
        AND (e.created_by = auth.uid() OR auth.uid() = ANY(e.hosts))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_checklist_items.event_id
        AND (e.created_by = auth.uid() OR auth.uid() = ANY(e.hosts))
    )
  );

-- 3) Task comments: scope SELECT to users with access to the parent task
DROP POLICY IF EXISTS "task_comments select auth" ON public.task_comments;
CREATE POLICY "task_comments select via task" ON public.task_comments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (t.owner = auth.uid() OR t.created_by = auth.uid())
    )
  );

-- 4) Task deliverables: same scoping
DROP POLICY IF EXISTS "deliverables select auth" ON public.task_deliverables;
CREATE POLICY "deliverables select via task" ON public.task_deliverables
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_deliverables.task_id
        AND (t.owner = auth.uid() OR t.created_by = auth.uid())
    )
  );

-- 5) Marketing request upload bucket: restrict public inserts to the incoming/ prefix
DROP POLICY IF EXISTS "Public can upload marketing request files" ON storage.objects;
CREATE POLICY "Public can upload marketing request files" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'marketing-request-uploads'
    AND (storage.foldername(name))[1] = 'incoming'
  );

-- 6) Revoke EXECUTE from anon on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.audit_completed_meeting_edit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.audit_l10_meeting_delete() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_l10_meeting_open(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_l10_meeting_open(uuid) TO authenticated;
