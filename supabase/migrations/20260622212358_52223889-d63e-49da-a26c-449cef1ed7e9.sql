ALTER TABLE public.scorecard_measurables
  ADD COLUMN IF NOT EXISTS goal_direction text NOT NULL DEFAULT 'higher_is_better'
  CHECK (goal_direction IN ('higher_is_better','lower_is_better'));