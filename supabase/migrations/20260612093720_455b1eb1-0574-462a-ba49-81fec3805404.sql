
-- Content items: extend write access to marketing_coordinator
DROP POLICY IF EXISTS "Admins insert content" ON public.content_items;
CREATE POLICY "Marketing can insert content" ON public.content_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));

DROP POLICY IF EXISTS "Admins update content" ON public.content_items;
CREATE POLICY "Marketing can update content" ON public.content_items
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));

DROP POLICY IF EXISTS "Admins delete content" ON public.content_items;
CREATE POLICY "Marketing can delete content" ON public.content_items
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));

-- Videos: allow video team to move/update any card
DROP POLICY IF EXISTS videos_update_owner_or_admin ON public.videos;
CREATE POLICY videos_update_video_team ON public.videos
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator','video_editor','videographer'])
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator','video_editor','videographer'])
  );
