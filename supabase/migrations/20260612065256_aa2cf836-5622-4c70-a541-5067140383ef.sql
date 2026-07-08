
-- Allow todo owners to update their own todos regardless of meeting completion lock
DROP POLICY IF EXISTS "todos update open meeting or owner or admin" ON public.todos;
CREATE POLICY "todos update open meeting or owner or admin"
ON public.todos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR owner = auth.uid()
  OR ((meeting_id IS NOT NULL) AND public.is_l10_meeting_open(meeting_id))
  OR ((meeting_id IS NULL) AND (owner = auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR owner = auth.uid()
  OR ((meeting_id IS NOT NULL) AND public.is_l10_meeting_open(meeting_id))
  OR ((meeting_id IS NULL) AND (owner = auth.uid()))
);

-- Audit log when an admin deletes an L10 meeting
CREATE OR REPLACE FUNCTION public.audit_l10_meeting_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log (event_type, actor_user_id, target_id, metadata)
  VALUES (
    'l10_meeting.delete',
    auth.uid(),
    OLD.id::text,
    jsonb_build_object(
      'meeting_date', OLD.meeting_date,
      'status', OLD.status,
      'attendees', OLD.attendees
    )
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_l10_meeting_delete ON public.l10_meetings;
CREATE TRIGGER trg_audit_l10_meeting_delete
BEFORE DELETE ON public.l10_meetings
FOR EACH ROW EXECUTE FUNCTION public.audit_l10_meeting_delete();
