
-- Enums
CREATE TYPE public.rock_status AS ENUM ('on_track', 'off_track', 'complete');
CREATE TYPE public.issue_status AS ENUM ('open', 'solved', 'tabled', 'converted');

-- ROCKS
CREATE TABLE public.rocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  due_date date,
  status public.rock_status NOT NULL DEFAULT 'on_track',
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rocks TO authenticated;
GRANT ALL ON public.rocks TO service_role;
ALTER TABLE public.rocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rocks select all auth" ON public.rocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "rocks admin insert" ON public.rocks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rocks update admin or owner" ON public.rocks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner = auth.uid());
CREATE POLICY "rocks admin delete" ON public.rocks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ROCK MILESTONES
CREATE TABLE public.rock_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rock_milestones TO authenticated;
GRANT ALL ON public.rock_milestones TO service_role;
ALTER TABLE public.rock_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones select all auth" ON public.rock_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "milestones insert owner or admin" ON public.rock_milestones FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      EXISTS (SELECT 1 FROM public.rocks r WHERE r.id = rock_id AND r.owner = auth.uid())
    )
  );
CREATE POLICY "milestones delete admin or author" ON public.rock_milestones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- L10 MEETINGS
CREATE TABLE public.l10_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL,
  attendees uuid[] NOT NULL DEFAULT '{}',
  segue text,
  headlines text,
  conclude_notes text,
  meeting_rating int,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.l10_meetings TO authenticated;
GRANT ALL ON public.l10_meetings TO service_role;
ALTER TABLE public.l10_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings select all auth" ON public.l10_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings admin manage" ON public.l10_meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- L10 ROCK REVIEWS (per-meeting status snapshot)
CREATE TABLE public.l10_rock_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.l10_meetings(id) ON DELETE CASCADE,
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  status public.rock_status NOT NULL DEFAULT 'on_track',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, rock_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.l10_rock_reviews TO authenticated;
GRANT ALL ON public.l10_rock_reviews TO service_role;
ALTER TABLE public.l10_rock_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rock reviews select all auth" ON public.l10_rock_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "rock reviews admin manage" ON public.l10_rock_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ISSUES
CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.issue_status NOT NULL DEFAULT 'open',
  outcome_note text,
  meeting_id uuid REFERENCES public.l10_meetings(id) ON DELETE SET NULL,
  converted_rock_id uuid REFERENCES public.rocks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues select all auth" ON public.issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "issues insert any auth" ON public.issues FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "issues update admin or submitter" ON public.issues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR submitted_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR submitted_by = auth.uid());
CREATE POLICY "issues admin delete" ON public.issues FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- TODOS
CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date date NOT NULL DEFAULT (current_date + 7),
  completed boolean NOT NULL DEFAULT false,
  meeting_id uuid REFERENCES public.l10_meetings(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos select all auth" ON public.todos FOR SELECT TO authenticated USING (true);
CREATE POLICY "todos admin insert" ON public.todos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "todos update admin or owner" ON public.todos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR owner = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner = auth.uid());
CREATE POLICY "todos admin delete" ON public.todos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SCORECARD MEASURABLES
CREATE TABLE public.scorecard_measurables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  weekly_target numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scorecard_measurables TO authenticated;
GRANT ALL ON public.scorecard_measurables TO service_role;
ALTER TABLE public.scorecard_measurables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "measurables select all auth" ON public.scorecard_measurables FOR SELECT TO authenticated USING (true);
CREATE POLICY "measurables admin manage" ON public.scorecard_measurables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SCORECARD ENTRIES
CREATE TABLE public.scorecard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurable_id uuid NOT NULL REFERENCES public.scorecard_measurables(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.l10_meetings(id) ON DELETE CASCADE,
  actual_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(measurable_id, meeting_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scorecard_entries TO authenticated;
GRANT ALL ON public.scorecard_entries TO service_role;
ALTER TABLE public.scorecard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries select all auth" ON public.scorecard_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries admin manage" ON public.scorecard_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_rocks_updated_at BEFORE UPDATE ON public.rocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_l10_meetings_updated_at BEFORE UPDATE ON public.l10_meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
