-- ============================================================================
-- Fix issues table RLS to allow meeting runners to drop unassigned issues in
-- ============================================================================

-- 1. Relax the INSERT policy to allow assigning to an open meeting
DROP POLICY IF EXISTS "issues insert any auth" ON public.issues;
CREATE POLICY "issues insert any auth" ON public.issues
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 2. Relax the UPDATE policy to allow anyone to claim an unassigned issue,
--    or to allow anyone running a meeting to update issues inside that meeting.
DROP POLICY IF EXISTS "issues update admin or submitter" ON public.issues;
DROP POLICY IF EXISTS "issues update open meeting or submitter or admin" ON public.issues;
CREATE POLICY "issues update open meeting or submitter or admin" ON public.issues
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR meeting_id IS NULL
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR meeting_id IS NULL
  );
