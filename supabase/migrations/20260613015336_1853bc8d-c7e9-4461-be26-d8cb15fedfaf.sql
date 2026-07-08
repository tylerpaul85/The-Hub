
-- toolbox_agents: restrict writes to admin/marketing_coordinator
DROP POLICY IF EXISTS "Authenticated can insert toolbox_agents" ON public.toolbox_agents;
DROP POLICY IF EXISTS "Authenticated can update toolbox_agents" ON public.toolbox_agents;
DROP POLICY IF EXISTS "Authenticated can delete toolbox_agents" ON public.toolbox_agents;

CREATE POLICY "Marketing can insert toolbox_agents" ON public.toolbox_agents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));
CREATE POLICY "Marketing can update toolbox_agents" ON public.toolbox_agents
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));
CREATE POLICY "Marketing can delete toolbox_agents" ON public.toolbox_agents
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));

-- toolbox_agent_content: restrict writes to admin/marketing_coordinator
DROP POLICY IF EXISTS "Authenticated can insert toolbox_agent_content" ON public.toolbox_agent_content;
DROP POLICY IF EXISTS "Authenticated can update toolbox_agent_content" ON public.toolbox_agent_content;
DROP POLICY IF EXISTS "Authenticated can delete toolbox_agent_content" ON public.toolbox_agent_content;

CREATE POLICY "Marketing can insert toolbox_agent_content" ON public.toolbox_agent_content
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));
CREATE POLICY "Marketing can update toolbox_agent_content" ON public.toolbox_agent_content
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));
CREATE POLICY "Marketing can delete toolbox_agent_content" ON public.toolbox_agent_content
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','marketing_coordinator']));

-- Storage: toolbox bucket — restrict destructive ops to owner or admin
DROP POLICY IF EXISTS "Auth can delete toolbox files" ON storage.objects;
DROP POLICY IF EXISTS "Auth can update toolbox files" ON storage.objects;

CREATE POLICY "Owner or admin can delete toolbox files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'toolbox' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Owner or admin can update toolbox files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'toolbox' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK (bucket_id = 'toolbox' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- Storage: task-deliverables bucket — restrict destructive ops to owner or admin
DROP POLICY IF EXISTS "task-deliverables delete auth" ON storage.objects;
DROP POLICY IF EXISTS "task-deliverables update auth" ON storage.objects;

CREATE POLICY "task-deliverables owner or admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-deliverables' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "task-deliverables owner or admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-deliverables' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK (bucket_id = 'task-deliverables' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));
