
ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS closing_gift_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS closing_gift_completed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Client Care can complete closing gift requests" ON public.marketing_requests;
CREATE POLICY "Client Care can complete closing gift requests"
  ON public.marketing_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'client_care') AND closing_gift IS NOT NULL)
  WITH CHECK (public.has_role(auth.uid(), 'client_care') AND closing_gift IS NOT NULL);
