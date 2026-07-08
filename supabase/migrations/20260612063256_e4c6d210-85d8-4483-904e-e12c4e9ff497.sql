
DROP POLICY IF EXISTS "tasks insert auth" ON public.tasks;
CREATE POLICY "tasks insert own or admin"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (created_by IS NULL OR auth.uid() = created_by)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR owner IS NULL
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "todos admin insert" ON public.todos;
CREATE POLICY "todos insert any auth"
ON public.todos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (created_by IS NULL OR created_by = auth.uid())
);
