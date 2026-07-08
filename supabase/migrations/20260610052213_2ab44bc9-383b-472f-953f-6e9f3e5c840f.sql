
DROP POLICY IF EXISTS "Anyone can submit a marketing request" ON public.marketing_requests;
CREATE POLICY "Anyone can submit a marketing request"
  ON public.marketing_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(agent_name, '')) BETWEEN 1 AND 200
    AND length(coalesce(agent_email, '')) BETWEEN 3 AND 320
    AND agent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );
