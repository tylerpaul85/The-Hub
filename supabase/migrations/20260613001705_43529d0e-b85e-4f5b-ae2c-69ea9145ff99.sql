ALTER TABLE public.toolbox_agents ADD COLUMN email TEXT;
UPDATE public.toolbox_agents SET email = identifier WHERE identifier IS NOT NULL;
CREATE INDEX idx_toolbox_agents_email ON public.toolbox_agents(email);