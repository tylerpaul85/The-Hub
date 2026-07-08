
-- issue_notes
CREATE TABLE public.issue_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_notes TO authenticated;
GRANT ALL ON public.issue_notes TO service_role;
ALTER TABLE public.issue_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issue_notes read" ON public.issue_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "issue_notes insert" ON public.issue_notes FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "issue_notes update" ON public.issue_notes FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "issue_notes delete" ON public.issue_notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX issue_notes_issue_idx ON public.issue_notes(issue_id);

-- l10_meeting_issue_priorities
CREATE TABLE public.l10_meeting_issue_priorities (
  meeting_id uuid NOT NULL REFERENCES public.l10_meetings(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  rank int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, issue_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.l10_meeting_issue_priorities TO authenticated;
GRANT ALL ON public.l10_meeting_issue_priorities TO service_role;
ALTER TABLE public.l10_meeting_issue_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "priorities read" ON public.l10_meeting_issue_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "priorities admin write" ON public.l10_meeting_issue_priorities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- l10_meeting_ratings
CREATE TABLE public.l10_meeting_ratings (
  meeting_id uuid NOT NULL REFERENCES public.l10_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.l10_meeting_ratings TO authenticated;
GRANT ALL ON public.l10_meeting_ratings TO service_role;
ALTER TABLE public.l10_meeting_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings read" ON public.l10_meeting_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings self insert" ON public.l10_meeting_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ratings self update" ON public.l10_meeting_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ratings self delete" ON public.l10_meeting_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER l10_meeting_ratings_updated BEFORE UPDATE ON public.l10_meeting_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- link todos back to issues
ALTER TABLE public.todos ADD COLUMN issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL;
