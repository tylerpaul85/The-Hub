-- Alter agent_signature_data to refer to toolbox_agents instead of auth.users
ALTER TABLE public.agent_signature_data DROP CONSTRAINT IF EXISTS agent_signature_data_user_id_fkey;
ALTER TABLE public.agent_signature_data DROP CONSTRAINT IF EXISTS agent_signature_data_user_id_key;
ALTER TABLE public.agent_signature_data RENAME COLUMN user_id TO toolbox_agent_id;

ALTER TABLE public.agent_signature_data
  ADD CONSTRAINT agent_signature_data_toolbox_agent_id_key UNIQUE (toolbox_agent_id),
  ADD CONSTRAINT agent_signature_data_toolbox_agent_id_fkey FOREIGN KEY (toolbox_agent_id) REFERENCES public.toolbox_agents(id) ON DELETE CASCADE;

-- Alter signatures_push_log to refer to toolbox_agents instead of auth.users
ALTER TABLE public.signatures_push_log DROP CONSTRAINT IF EXISTS signatures_push_log_user_id_fkey;
ALTER TABLE public.signatures_push_log RENAME COLUMN user_id TO toolbox_agent_id;

ALTER TABLE public.signatures_push_log
  ADD CONSTRAINT signatures_push_log_toolbox_agent_id_fkey FOREIGN KEY (toolbox_agent_id) REFERENCES public.toolbox_agents(id) ON DELETE SET NULL;
