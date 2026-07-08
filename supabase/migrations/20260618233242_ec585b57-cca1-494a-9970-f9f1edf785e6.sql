CREATE TYPE public.headline_kind AS ENUM ('announcement', 'cascade', 'issue');

CREATE TABLE public.headlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  kind public.headline_kind NOT NULL DEFAULT 'announcement',
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  meeting_id uuid REFERENCES public.l10_meetings(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  converted_issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.headlines TO authenticated;
GRANT ALL ON public.headlines TO service_role;

ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "headlines select all auth"
  ON public.headlines FOR SELECT TO authenticated USING (true);

CREATE POLICY "headlines insert any auth"
  ON public.headlines FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "headlines update any auth"
  ON public.headlines FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR submitted_by = auth.uid()
    OR (meeting_id IS NOT NULL AND public.is_l10_meeting_open(meeting_id))
    OR (meeting_id IS NULL)
  )
  WITH CHECK (true);

CREATE POLICY "headlines admin delete"
  ON public.headlines FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR submitted_by = auth.uid());

CREATE INDEX headlines_meeting_id_idx ON public.headlines(meeting_id);
CREATE INDEX headlines_created_at_idx ON public.headlines(created_at DESC);