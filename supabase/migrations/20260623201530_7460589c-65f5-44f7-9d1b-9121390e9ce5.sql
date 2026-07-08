
-- INVENTORY TABLE
CREATE TABLE public.closing_gift_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size text NOT NULL,
  color text NOT NULL,
  color_hex text NOT NULL,
  quantity_available integer NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (size, color)
);

GRANT SELECT ON public.closing_gift_inventory TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.closing_gift_inventory TO authenticated;
GRANT ALL ON public.closing_gift_inventory TO service_role;

ALTER TABLE public.closing_gift_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inventory"
  ON public.closing_gift_inventory FOR SELECT
  USING (true);

CREATE POLICY "Admin/client care manage inventory"
  ON public.closing_gift_inventory FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'));

CREATE TRIGGER closing_gift_inventory_set_updated_at
  BEFORE UPDATE ON public.closing_gift_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REQUESTS TABLE
CREATE TABLE public.closing_gift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  client_first_name text NOT NULL,
  client_last_name text NOT NULL,
  shirts jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.closing_gift_requests TO authenticated;
GRANT INSERT ON public.closing_gift_requests TO anon;
GRANT ALL ON public.closing_gift_requests TO service_role;

ALTER TABLE public.closing_gift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a closing gift request"
  ON public.closing_gift_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin/client care can view all requests"
  ON public.closing_gift_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'));

CREATE POLICY "Users can view their own requests"
  ON public.closing_gift_requests FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Admin/client care can update requests"
  ON public.closing_gift_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'client_care'));

CREATE POLICY "Admin can delete requests"
  ON public.closing_gift_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER closing_gift_requests_set_updated_at
  BEFORE UPDATE ON public.closing_gift_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.notify_on_closing_gift_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shirt_count int;
  msg text;
BEGIN
  shirt_count := COALESCE(jsonb_array_length(NEW.shirts), 0);
  msg := NEW.agent_name || ' has requested closing gifts for '
         || NEW.client_first_name || ' ' || NEW.client_last_name
         || '. ' || shirt_count || ' shirt' || CASE WHEN shirt_count = 1 THEN '' ELSE 's' END || ' ordered.';
  INSERT INTO public.notifications(user_id, type, message, content_id)
  SELECT ur.user_id, 'closing_gift_request', msg, NULL
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','client_care');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_closing_gift_request
  AFTER INSERT ON public.closing_gift_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_closing_gift_request();

-- SEED INVENTORY
INSERT INTO public.closing_gift_inventory (size, color, color_hex, quantity_available)
SELECT s, c.color, c.hex, 5
FROM (VALUES ('XS'),('S'),('M'),('L'),('XL'),('XXL')) AS sizes(s)
CROSS JOIN (VALUES ('Navy Blue','#001F3F'), ('Gold','#C9A227')) AS c(color, hex)
ON CONFLICT (size, color) DO NOTHING;
