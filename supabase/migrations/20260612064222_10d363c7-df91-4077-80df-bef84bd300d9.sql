
-- 1. l10_meetings: add completion fields
ALTER TABLE public.l10_meetings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed')),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid;

-- 2. helper: is the meeting still open?
CREATE OR REPLACE FUNCTION public.is_l10_meeting_open(_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _meeting_id IS NULL
      OR COALESCE((SELECT status FROM public.l10_meetings WHERE id = _meeting_id), 'in_progress') = 'in_progress';
$$;

-- 3. l10_meetings policies
DROP POLICY IF EXISTS "meetings admin manage" ON public.l10_meetings;
DROP POLICY IF EXISTS "meetings insert any auth" ON public.l10_meetings;
DROP POLICY IF EXISTS "meetings update open or admin" ON public.l10_meetings;
DROP POLICY IF EXISTS "meetings delete admin" ON public.l10_meetings;

CREATE POLICY "meetings insert any auth" ON public.l10_meetings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "meetings update open or admin" ON public.l10_meetings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR status = 'in_progress')
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "meetings delete admin" ON public.l10_meetings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. l10_rock_reviews policies
DROP POLICY IF EXISTS "rock reviews admin manage" ON public.l10_rock_reviews;
DROP POLICY IF EXISTS "rock reviews write open or admin" ON public.l10_rock_reviews;
CREATE POLICY "rock reviews write open or admin" ON public.l10_rock_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id));

-- 5. scorecard_entries policies
DROP POLICY IF EXISTS "entries admin manage" ON public.scorecard_entries;
DROP POLICY IF EXISTS "entries write open or admin" ON public.scorecard_entries;
CREATE POLICY "entries write open or admin" ON public.scorecard_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id));

-- scorecard_measurables stays admin-managed (no change)

-- 6. l10_meeting_issue_priorities
DROP POLICY IF EXISTS "priorities admin write" ON public.l10_meeting_issue_priorities;
DROP POLICY IF EXISTS "priorities write open or admin" ON public.l10_meeting_issue_priorities;
CREATE POLICY "priorities write open or admin" ON public.l10_meeting_issue_priorities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_l10_meeting_open(meeting_id));

-- 7. l10_meeting_ratings: lock when meeting completed
DROP POLICY IF EXISTS "ratings insert" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings update" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings delete" ON public.l10_meeting_ratings;
CREATE POLICY "ratings insert" ON public.l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (user_id = auth.uid() AND public.is_l10_meeting_open(meeting_id))
  );
CREATE POLICY "ratings update" ON public.l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (user_id = auth.uid() AND public.is_l10_meeting_open(meeting_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (user_id = auth.uid() AND public.is_l10_meeting_open(meeting_id))
  );
CREATE POLICY "ratings delete" ON public.l10_meeting_ratings
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (user_id = auth.uid() AND public.is_l10_meeting_open(meeting_id))
  );

-- 8. todos: extend update so any auth user can edit a to-do tied to an open meeting;
--          and lock to-dos tied to a completed meeting for non-admins.
DROP POLICY IF EXISTS "todos update admin or owner" ON public.todos;
DROP POLICY IF EXISTS "todos update open meeting or owner or admin" ON public.todos;
CREATE POLICY "todos update open meeting or owner or admin" ON public.todos
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR (meeting_id IS NULL AND owner = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR (meeting_id IS NULL AND owner = auth.uid())
  );

-- tighten todos insert so a non-admin cannot attach a new to-do to a closed meeting
DROP POLICY IF EXISTS "todos insert any auth" ON public.todos;
CREATE POLICY "todos insert any auth" ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR meeting_id IS NULL
      OR public.is_l10_meeting_open(meeting_id)
    )
  );

-- 9. issues: allow any auth to update an issue while it is being processed in an open meeting,
--           and block edits to issues tied to a completed meeting for non-admins.
DROP POLICY IF EXISTS "issues update admin or submitter" ON public.issues;
DROP POLICY IF EXISTS "issues update open meeting or submitter or admin" ON public.issues;
CREATE POLICY "issues update open meeting or submitter or admin" ON public.issues
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (meeting_id IS NULL AND submitted_by = auth.uid())
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
  );

-- 10. audit log: record edits to a completed l10_meetings record
CREATE OR REPLACE FUNCTION public.audit_completed_meeting_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    INSERT INTO public.security_audit_log (event_type, actor_user_id, target_id, metadata)
    VALUES (
      'l10_meeting.edit_after_complete',
      auth.uid(),
      NEW.id::text,
      jsonb_build_object(
        'meeting_date', NEW.meeting_date,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_l10_meeting_completed_edit ON public.l10_meetings;
CREATE TRIGGER audit_l10_meeting_completed_edit
AFTER UPDATE ON public.l10_meetings
FOR EACH ROW
EXECUTE FUNCTION public.audit_completed_meeting_edit();
