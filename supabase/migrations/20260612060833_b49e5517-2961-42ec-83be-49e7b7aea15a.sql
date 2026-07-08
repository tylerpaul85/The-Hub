
-- Tighten write policies: owner-or-admin only on toolbox_* and tasks

-- toolbox_listings
DROP POLICY IF EXISTS "Authenticated can insert listings" ON public.toolbox_listings;
DROP POLICY IF EXISTS "Authenticated can update listings" ON public.toolbox_listings;
DROP POLICY IF EXISTS "Authenticated can delete listings" ON public.toolbox_listings;
CREATE POLICY "Authenticated can insert listings" ON public.toolbox_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update listings" ON public.toolbox_listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete listings" ON public.toolbox_listings
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- toolbox_assets
DROP POLICY IF EXISTS "Authenticated can insert toolbox_assets" ON public.toolbox_assets;
DROP POLICY IF EXISTS "Authenticated can update toolbox_assets" ON public.toolbox_assets;
DROP POLICY IF EXISTS "Authenticated can delete toolbox_assets" ON public.toolbox_assets;
CREATE POLICY "Authenticated can insert toolbox_assets" ON public.toolbox_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update toolbox_assets" ON public.toolbox_assets
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete toolbox_assets" ON public.toolbox_assets
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- toolbox_captions
DROP POLICY IF EXISTS "Authenticated can insert toolbox_captions" ON public.toolbox_captions;
DROP POLICY IF EXISTS "Authenticated can update toolbox_captions" ON public.toolbox_captions;
DROP POLICY IF EXISTS "Authenticated can delete toolbox_captions" ON public.toolbox_captions;
CREATE POLICY "Authenticated can insert toolbox_captions" ON public.toolbox_captions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update toolbox_captions" ON public.toolbox_captions
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete toolbox_captions" ON public.toolbox_captions
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- toolbox_brand_assets
DROP POLICY IF EXISTS "Authenticated can insert brand_assets" ON public.toolbox_brand_assets;
DROP POLICY IF EXISTS "Authenticated can update brand_assets" ON public.toolbox_brand_assets;
DROP POLICY IF EXISTS "Authenticated can delete brand_assets" ON public.toolbox_brand_assets;
CREATE POLICY "Authenticated can insert brand_assets" ON public.toolbox_brand_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update brand_assets" ON public.toolbox_brand_assets
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete brand_assets" ON public.toolbox_brand_assets
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- toolbox_educational
DROP POLICY IF EXISTS "Authenticated can insert educational" ON public.toolbox_educational;
DROP POLICY IF EXISTS "Authenticated can update educational" ON public.toolbox_educational;
DROP POLICY IF EXISTS "Authenticated can delete educational" ON public.toolbox_educational;
CREATE POLICY "Authenticated can insert educational" ON public.toolbox_educational
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can update educational" ON public.toolbox_educational
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner or admin can delete educational" ON public.toolbox_educational
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- tasks
DROP POLICY IF EXISTS "tasks insert auth" ON public.tasks;
DROP POLICY IF EXISTS "tasks update auth" ON public.tasks;
CREATE POLICY "tasks insert auth" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (created_by IS NULL OR auth.uid() = created_by));
CREATE POLICY "Owner or admin can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = owner
    OR auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
  );

-- event_checklist_items: only admin or the user completing the item can update
DROP POLICY IF EXISTS "checklist_update_auth" ON public.event_checklist_items;
CREATE POLICY "checklist_update_admin_or_completer" ON public.event_checklist_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR completed_by = auth.uid() OR completed_by IS NULL)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR completed_by = auth.uid() OR completed_by IS NULL);

-- event_content_suggestions: admin-only mutations (no creator column)
DROP POLICY IF EXISTS "suggestions_update_auth" ON public.event_content_suggestions;
DROP POLICY IF EXISTS "suggestions_delete_auth" ON public.event_content_suggestions;
CREATE POLICY "suggestions_update_admin" ON public.event_content_suggestions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "suggestions_delete_admin" ON public.event_content_suggestions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Revoke anon EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.notify_on_task_comment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_task_assign() FROM PUBLIC, anon;
