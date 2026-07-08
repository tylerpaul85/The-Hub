-- Agents table for branded content
CREATE TABLE public.toolbox_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  headshot_url TEXT,
  identifier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_agents TO authenticated;
GRANT ALL ON public.toolbox_agents TO service_role;
ALTER TABLE public.toolbox_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view toolbox_agents" ON public.toolbox_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert toolbox_agents" ON public.toolbox_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update toolbox_agents" ON public.toolbox_agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete toolbox_agents" ON public.toolbox_agents FOR DELETE TO authenticated USING (true);
CREATE TRIGGER set_toolbox_agents_updated_at BEFORE UPDATE ON public.toolbox_agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agent branded content items
CREATE TABLE public.toolbox_agent_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.toolbox_agents(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'Other',
  title TEXT NOT NULL,
  file_url TEXT,
  drive_url TEXT,
  caption TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_agent_content TO authenticated;
GRANT ALL ON public.toolbox_agent_content TO service_role;
ALTER TABLE public.toolbox_agent_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view toolbox_agent_content" ON public.toolbox_agent_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert toolbox_agent_content" ON public.toolbox_agent_content FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update toolbox_agent_content" ON public.toolbox_agent_content FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete toolbox_agent_content" ON public.toolbox_agent_content FOR DELETE TO authenticated USING (true);
CREATE TRIGGER set_toolbox_agent_content_updated_at BEFORE UPDATE ON public.toolbox_agent_content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_toolbox_agent_content_agent ON public.toolbox_agent_content(agent_id);