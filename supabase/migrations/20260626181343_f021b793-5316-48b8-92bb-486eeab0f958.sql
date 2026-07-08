
DROP POLICY IF EXISTS availability_own_write ON public.agent_availability;
ALTER TABLE public.duty_calendar_agents DROP COLUMN IF EXISTS user_id;
CREATE POLICY availability_authenticated_write ON public.agent_availability
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
