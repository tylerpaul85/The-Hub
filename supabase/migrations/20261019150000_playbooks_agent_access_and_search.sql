-- Migration: 20261019150000_playbooks_agent_access_and_search.sql
-- Description: Agent RLS policies for Playbooks, Group access validation, and search_playbooks RPC

-- 1. Agent select policy on playbooks:
-- Published playbooks that either have no assigned groups (open to all agents)
-- OR the current agent (via public.seller_uid()) is a member of an assigned group.
DROP POLICY IF EXISTS "playbooks_agent_select_policy" ON public.playbooks;
CREATE POLICY "playbooks_agent_select_policy" ON public.playbooks
  FOR SELECT TO authenticated, anon
  USING (
    (
      status = 'published' AND (
        NOT EXISTS (
          SELECT 1 FROM public.playbook_assigned_groups pag 
          WHERE pag.playbook_id = public.playbooks.id
        )
        OR
        EXISTS (
          SELECT 1 FROM public.playbook_assigned_groups pag
          JOIN public.playbook_group_members pgm ON pgm.group_id = pag.group_id
          WHERE pag.playbook_id = public.playbooks.id
            AND pgm.agent_id = public.seller_uid()
        )
      )
    )
    OR
    auth.role() = 'authenticated' -- Admin / internal hub user fallback
  );

-- 2. Playbook assigned groups read policy
DROP POLICY IF EXISTS "playbook_assigned_groups_agent_select_policy" ON public.playbook_assigned_groups;
CREATE POLICY "playbook_assigned_groups_agent_select_policy" ON public.playbook_assigned_groups
  FOR SELECT TO authenticated, anon
  USING (true);

-- 3. Playbook groups read policy
DROP POLICY IF EXISTS "playbook_groups_agent_select_policy" ON public.playbook_groups;
CREATE POLICY "playbook_groups_agent_select_policy" ON public.playbook_groups
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4. Playbook acknowledgments policies for agents
DROP POLICY IF EXISTS "playbook_acknowledgments_agent_select_policy" ON public.playbook_acknowledgments;
CREATE POLICY "playbook_acknowledgments_agent_select_policy" ON public.playbook_acknowledgments
  FOR SELECT TO authenticated, anon
  USING (
    agent_id = public.seller_uid()
    OR auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "playbook_acknowledgments_agent_insert_policy" ON public.playbook_acknowledgments;
CREATE POLICY "playbook_acknowledgments_agent_insert_policy" ON public.playbook_acknowledgments
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    agent_id = public.seller_uid()
  );

DROP POLICY IF EXISTS "playbook_acknowledgments_agent_update_policy" ON public.playbook_acknowledgments;
CREATE POLICY "playbook_acknowledgments_agent_update_policy" ON public.playbook_acknowledgments
  FOR UPDATE TO authenticated, anon
  USING (agent_id = public.seller_uid())
  WITH CHECK (agent_id = public.seller_uid());

-- 5. search_playbooks RPC function
-- Uses SECURITY INVOKER so RLS policies are applied automatically to the caller
CREATE OR REPLACE FUNCTION public.search_playbooks(query_text text, p_limit int DEFAULT 15)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  category text,
  summary text,
  tags text[],
  owner text,
  last_reviewed_at timestamptz,
  updated_at timestamptz,
  snippet text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  clean_query text;
BEGIN
  clean_query := trim(query_text);
  IF clean_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.slug,
    p.category,
    p.summary,
    p.tags,
    p.owner,
    p.last_reviewed_at,
    p.updated_at,
    CASE
      WHEN p.summary ILIKE '%' || clean_query || '%' THEN
        substring(p.summary FROM greatest(1, strpos(lower(p.summary), lower(clean_query)) - 30) FOR 160)
      WHEN p.content ILIKE '%' || clean_query || '%' THEN
        substring(p.content FROM greatest(1, strpos(lower(p.content), lower(clean_query)) - 30) FOR 160)
      ELSE
        coalesce(substring(p.summary FROM 1 FOR 140), substring(p.content FROM 1 FOR 140))
    END AS snippet
  FROM public.playbooks p
  WHERE
    p.status = 'published'
    AND (
      p.title ILIKE '%' || clean_query || '%'
      OR p.summary ILIKE '%' || clean_query || '%'
      OR p.content ILIKE '%' || clean_query || '%'
      OR p.category ILIKE '%' || clean_query || '%'
      OR array_to_string(p.tags, ' ') ILIKE '%' || clean_query || '%'
    )
  ORDER BY
    CASE WHEN p.title ILIKE '%' || clean_query || '%' THEN 1 ELSE 2 END,
    p.updated_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_playbooks(text, int) TO authenticated, anon;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
