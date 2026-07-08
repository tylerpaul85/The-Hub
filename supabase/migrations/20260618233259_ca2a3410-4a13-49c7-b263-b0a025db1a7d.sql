DROP POLICY "headlines update any auth" ON public.headlines;

CREATE POLICY "headlines update scoped"
  ON public.headlines FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR meeting_id IS NULL
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR meeting_id IS NULL
  );