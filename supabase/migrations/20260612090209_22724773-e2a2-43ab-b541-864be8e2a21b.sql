-- Recurring task templates
CREATE TABLE IF NOT EXISTS public.recurring_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','custom')),
  day_of_week smallint CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 31),
  interval_days integer CHECK (interval_days BETWEEN 1 AND 365),
  next_due_on date NOT NULL,
  last_generated_on date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_task_templates TO authenticated;
GRANT ALL ON public.recurring_task_templates TO service_role;

ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring select own or admin"
  ON public.recurring_task_templates FOR SELECT
  USING (auth.uid() = owner OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "recurring insert own or admin"
  ON public.recurring_task_templates FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR auth.uid() = created_by)
    AND (public.has_role(auth.uid(), 'admin') OR owner IS NULL OR owner = auth.uid())
  );

CREATE POLICY "recurring update owner or admin"
  ON public.recurring_task_templates FOR UPDATE
  USING (auth.uid() = owner OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "recurring delete admin or creator"
  ON public.recurring_task_templates FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER recurring_task_templates_updated_at
  BEFORE UPDATE ON public.recurring_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link tasks back to their template
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid REFERENCES public.recurring_task_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_recurring_template_id_idx ON public.tasks(recurring_template_id);

-- Compute the next due date based on frequency
CREATE OR REPLACE FUNCTION public.next_recurrence_after(
  _from date, _frequency text, _day_of_week smallint, _day_of_month smallint, _interval_days integer
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d date;
  target_dom int;
  month_len int;
BEGIN
  IF _frequency = 'daily' THEN
    RETURN _from + 1;
  ELSIF _frequency = 'weekly' THEN
    RETURN _from + 7;
  ELSIF _frequency = 'biweekly' THEN
    RETURN _from + 14;
  ELSIF _frequency = 'custom' THEN
    RETURN _from + COALESCE(_interval_days, 1);
  ELSIF _frequency = 'monthly' THEN
    target_dom := COALESCE(_day_of_month, EXTRACT(DAY FROM _from)::int);
    d := (date_trunc('month', _from) + interval '1 month')::date;
    month_len := EXTRACT(DAY FROM (date_trunc('month', d) + interval '1 month - 1 day'))::int;
    RETURN d + (LEAST(target_dom, month_len) - 1);
  END IF;
  RETURN _from + 1;
END;
$$;

-- Generate any pending recurring task instances
CREATE OR REPLACE FUNCTION public.generate_recurring_task_instances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  created_count int := 0;
  iter_due date;
  guard int;
BEGIN
  FOR r IN
    SELECT * FROM public.recurring_task_templates
    WHERE active = true AND next_due_on <= CURRENT_DATE
  LOOP
    iter_due := r.next_due_on;
    guard := 0;
    WHILE iter_due <= CURRENT_DATE AND guard < 60 LOOP
      INSERT INTO public.tasks (title, description, owner, due_date, priority, status, created_by, recurring_template_id)
      VALUES (r.title, r.description, r.owner, iter_due, r.priority, 'todo', r.created_by, r.id);
      created_count := created_count + 1;
      iter_due := public.next_recurrence_after(iter_due, r.frequency, r.day_of_week, r.day_of_month, r.interval_days);
      guard := guard + 1;
    END LOOP;
    UPDATE public.recurring_task_templates
      SET next_due_on = iter_due, last_generated_on = CURRENT_DATE
      WHERE id = r.id;
  END LOOP;
  RETURN created_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_recurring_task_instances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_task_instances() TO service_role;

-- Schedule daily generation
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-recurring-tasks') THEN
    PERFORM cron.unschedule('generate-recurring-tasks');
  END IF;
END $$;

SELECT cron.schedule(
  'generate-recurring-tasks',
  '5 0 * * *',
  $cron$ SELECT public.generate_recurring_task_instances(); $cron$
);

-- Run once now to backfill / pick up any already-due templates
SELECT public.generate_recurring_task_instances();