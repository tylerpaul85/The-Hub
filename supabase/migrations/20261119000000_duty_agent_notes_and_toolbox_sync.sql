-- Migration: Add notes, email, and toolbox_agent_id to duty_calendar_agents; add note to agent_availability
-- Allows Client Care and Admins to store AI/admin notes on agents, link them to the marketing toolbox,
-- and store custom notes for agent no-go days (unavailability).

ALTER TABLE public.duty_calendar_agents
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS toolbox_agent_id uuid REFERENCES public.toolbox_agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_duty_agents_toolbox_agent_id 
  ON public.duty_calendar_agents(toolbox_agent_id);

ALTER TABLE public.agent_availability
  ADD COLUMN IF NOT EXISTS note text;
