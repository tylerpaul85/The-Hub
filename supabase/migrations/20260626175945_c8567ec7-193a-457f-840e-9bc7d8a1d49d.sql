
-- Roster
CREATE TABLE public.duty_calendar_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  office text NOT NULL CHECK (office IN ('rolla','str','loz')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, office)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_calendar_agents TO authenticated;
GRANT ALL ON public.duty_calendar_agents TO service_role;
ALTER TABLE public.duty_calendar_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duty_agents_select_all" ON public.duty_calendar_agents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "duty_agents_admin_write" ON public.duty_calendar_agents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'));

CREATE TRIGGER trg_duty_agents_updated BEFORE UPDATE ON public.duty_calendar_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Availability
CREATE TABLE public.agent_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.duty_calendar_agents(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_end date NOT NULL,
  reason text CHECK (reason IS NULL OR reason IN ('vacation','sick','personal','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_end >= date_start)
);
CREATE INDEX idx_agent_availability_agent ON public.agent_availability(agent_id);
CREATE INDEX idx_agent_availability_range ON public.agent_availability(date_start, date_end);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_availability TO authenticated;
GRANT ALL ON public.agent_availability TO service_role;
ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_select_all" ON public.agent_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "availability_own_write" ON public.agent_availability
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.duty_calendar_agents a WHERE a.id = agent_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.duty_calendar_agents a WHERE a.id = agent_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care')
  );

CREATE TRIGGER trg_agent_availability_updated BEFORE UPDATE ON public.agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Duty calendar
CREATE TABLE public.duty_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  office text NOT NULL CHECK (office IN ('rolla','str','loz')),
  duty_day int NOT NULL CHECK (duty_day BETWEEN 1 AND 31),
  assigned_agent_id uuid REFERENCES public.duty_calendar_agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, office, duty_day)
);
CREATE INDEX idx_duty_calendar_lookup ON public.duty_calendar(year, month, office);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_calendar TO authenticated;
GRANT ALL ON public.duty_calendar TO service_role;
ALTER TABLE public.duty_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duty_calendar_select_all" ON public.duty_calendar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "duty_calendar_admin_write" ON public.duty_calendar
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'));

CREATE TRIGGER trg_duty_calendar_updated BEFORE UPDATE ON public.duty_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify admins/client care when an OOO is submitted
CREATE OR REPLACE FUNCTION public.notify_on_ooo_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_name text;
  msg text;
BEGIN
  SELECT name INTO a_name FROM public.duty_calendar_agents WHERE id = NEW.agent_id;
  msg := COALESCE(a_name, 'An agent') || ' submitted OOO from '
    || to_char(NEW.date_start,'Mon DD, YYYY')
    || ' to ' || to_char(NEW.date_end,'Mon DD, YYYY')
    || COALESCE(' (' || NEW.reason || ')', '');
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT ur.user_id, 'ooo_request', msg, NULL
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','client_care');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ooo_request
  AFTER INSERT ON public.agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ooo_request();
