
-- Add ownership/source/updated_at to measurables
ALTER TABLE public.scorecard_measurables
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_scorecard_measurables_updated_at ON public.scorecard_measurables;
CREATE TRIGGER set_scorecard_measurables_updated_at
  BEFORE UPDATE ON public.scorecard_measurables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Weekly entries table (Monday-anchored)
CREATE TABLE IF NOT EXISTS public.scorecard_weekly_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurable_id uuid NOT NULL REFERENCES public.scorecard_measurables(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  actual_value numeric NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (measurable_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scorecard_weekly_entries TO authenticated;
GRANT ALL ON public.scorecard_weekly_entries TO service_role;

ALTER TABLE public.scorecard_weekly_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly entries select all auth" ON public.scorecard_weekly_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "weekly entries owner or admin insert" ON public.scorecard_weekly_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.scorecard_measurables m WHERE m.id = measurable_id AND m.owner_id = auth.uid())
  );

CREATE POLICY "weekly entries owner or admin update" ON public.scorecard_weekly_entries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.scorecard_measurables m WHERE m.id = measurable_id AND m.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.scorecard_measurables m WHERE m.id = measurable_id AND m.owner_id = auth.uid())
  );

CREATE POLICY "weekly entries admin delete" ON public.scorecard_weekly_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_scorecard_weekly_entries_updated_at ON public.scorecard_weekly_entries;
CREATE TRIGGER set_scorecard_weekly_entries_updated_at
  BEFORE UPDATE ON public.scorecard_weekly_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Weekly reminder: notify owners who haven't submitted for the current week (Mon-Sun)
CREATE OR REPLACE FUNCTION public.send_scorecard_weekly_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wk date := (date_trunc('week', now() AT TIME ZONE 'UTC'))::date; -- ISO Monday
  inserted int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT m.owner_id
    FROM public.scorecard_measurables m
    WHERE m.owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.scorecard_measurables m2
        LEFT JOIN public.scorecard_weekly_entries e
          ON e.measurable_id = m2.id AND e.week_start = wk
        WHERE m2.owner_id = m.owner_id AND e.id IS NULL
        HAVING false
      ) = false
  LOOP
    -- Skip if owner has submitted ALL of their metrics
    IF EXISTS (
      SELECT 1 FROM public.scorecard_measurables m2
      LEFT JOIN public.scorecard_weekly_entries e
        ON e.measurable_id = m2.id AND e.week_start = wk
      WHERE m2.owner_id = r.owner_id AND e.id IS NULL
    ) THEN
      INSERT INTO public.notifications(user_id, type, message, content_id)
      VALUES (r.owner_id, 'scorecard_reminder',
        'Submit your scorecard numbers for the week of ' || to_char(wk, 'Mon DD'),
        NULL);
      inserted := inserted + 1;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;
