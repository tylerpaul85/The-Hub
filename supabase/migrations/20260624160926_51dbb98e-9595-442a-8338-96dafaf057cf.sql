-- Fix content_items.brand default so inserts without an explicit brand pass the check
ALTER TABLE public.content_items ALTER COLUMN brand SET DEFAULT 'MSREG ALL';
ALTER TABLE public.content_archive ALTER COLUMN brand SET DEFAULT 'MSREG ALL';

-- Allow any authenticated meeting participant to record ratings for anyone during an open L10 meeting
DROP POLICY IF EXISTS "ratings insert" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings update" ON public.l10_meeting_ratings;
DROP POLICY IF EXISTS "ratings delete" ON public.l10_meeting_ratings;

CREATE POLICY "ratings insert" ON public.l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_l10_meeting_open(meeting_id));

CREATE POLICY "ratings update" ON public.l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_l10_meeting_open(meeting_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_l10_meeting_open(meeting_id));

CREATE POLICY "ratings delete" ON public.l10_meeting_ratings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_l10_meeting_open(meeting_id));