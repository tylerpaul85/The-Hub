DROP POLICY IF EXISTS "tasks select auth" ON public.tasks;

CREATE POLICY "tasks select own or admin"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner
  OR auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);