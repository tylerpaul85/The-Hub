-- Open Houses System: Extended open houses, visitor sign-ins, checklist templates & items

-- 1. Extend toolbox_open_houses
ALTER TABLE public.toolbox_open_houses 
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.toolbox_listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS host_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time text,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS toolbox_open_houses_listing_id_idx ON public.toolbox_open_houses(listing_id);
CREATE INDEX IF NOT EXISTS toolbox_open_houses_host_agent_idx ON public.toolbox_open_houses(host_agent_id);

-- 2. Visitor Sign-ins table
CREATE TABLE IF NOT EXISTS public.open_house_signins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES public.toolbox_open_houses(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  working_with_agent boolean NOT NULL DEFAULT false,
  agent_name text,
  buying_or_selling text NOT NULL DEFAULT 'just_browsing', -- 'buying', 'selling', 'both', 'just_browsing'
  timeframe text NOT NULL DEFAULT 'just_browsing', -- 'immediate', '1-3_months', '3-6_months', '6-12_months', 'just_browsing'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_house_signins_oh_idx ON public.open_house_signins(open_house_id);
CREATE INDEX IF NOT EXISTS open_house_signins_created_at_idx ON public.open_house_signins(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_house_signins TO authenticated;
GRANT INSERT ON public.open_house_signins TO anon;
GRANT ALL ON public.open_house_signins TO service_role;

ALTER TABLE public.open_house_signins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert open house signins" 
  ON public.open_house_signins FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view signins" 
  ON public.open_house_signins FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can update signins" 
  ON public.open_house_signins FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can delete signins" 
  ON public.open_house_signins FOR DELETE 
  TO authenticated 
  USING (true);

-- 3. Checklist Templates (Ops managed default checklist)
CREATE TABLE IF NOT EXISTS public.open_house_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  phase_order integer NOT NULL DEFAULT 1,
  task_text text NOT NULL,
  task_order integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_house_checklist_templates TO authenticated;
GRANT ALL ON public.open_house_checklist_templates TO service_role;

ALTER TABLE public.open_house_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklist templates" 
  ON public.open_house_checklist_templates FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated can manage checklist templates" 
  ON public.open_house_checklist_templates FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 4. Per-Open-House Checklist Items (Instance checkboxes)
CREATE TABLE IF NOT EXISTS public.open_house_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES public.toolbox_open_houses(id) ON DELETE CASCADE,
  phase text NOT NULL,
  phase_order integer NOT NULL DEFAULT 1,
  task_text text NOT NULL,
  task_order integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_house_checklist_items_oh_idx ON public.open_house_checklist_items(open_house_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_house_checklist_items TO authenticated;
GRANT ALL ON public.open_house_checklist_items TO service_role;

ALTER TABLE public.open_house_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklist items" 
  ON public.open_house_checklist_items FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated can manage checklist items" 
  ON public.open_house_checklist_items FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 5. Seed default template tasks if table is empty
INSERT INTO public.open_house_checklist_templates (phase, phase_order, task_text, task_order)
SELECT phase, phase_order, task_text, task_order FROM (VALUES
  ('After signing up / initial Open House email', 1, 'Listing agent gets with other agents on a game plan for prep and door-knocking', 1),
  ('After signing up / initial Open House email', 1, 'Once marketing flyer is approved by listing agent, send to clients/leads to invite them', 2),
  ('After signing up / initial Open House email', 1, 'Create a video text and send to at least 5 local agents to invite them', 3),
  ('After signing up / initial Open House email', 1, 'Invite people to the Facebook Event and share the marketing post', 4),

  ('3-4 Days Before', 2, 'Confirm you have everything from the Material List', 1),
  ('3-4 Days Before', 2, 'Go to the home, create a sneak-peek video inviting people, email to marketing', 2),
  ('3-4 Days Before', 2, 'Home is clean & welcoming — how does it smell?', 3),
  ('3-4 Days Before', 2, 'Grass is mowed', 4),
  ('3-4 Days Before', 2, 'Decluttered/depersonalized', 5),
  ('3-4 Days Before', 2, 'Vacant home: electric/water on?', 6),
  ('3-4 Days Before', 2, 'Occupied home: valuables hidden, clients have a plan to be gone + a pet plan', 7),

  ('1-2 Days Before', 3, 'Door-knock the neighborhood inviting neighbors (min. 25 doors)', 1),
  ('1-2 Days Before', 3, 'Map out where Open House signs will go (aerial printout)', 2),

  ('1 Hour Before', 4, 'Place Open House pointer signs at every turn directing traffic (20-25 signs)', 1),
  ('1 Hour Before', 4, 'Set up yard sign, welcome sign on door, sign-in sheet, snacks, etc.', 2),
  ('1 Hour Before', 4, 'Take video, post to social media (tag & check in at MSREG), go live if desired', 3),
  ('1 Hour Before', 4, 'Share video to at least 10 local Facebook groups', 4),

  ('After the Open House', 5, 'Listing agent divides leads; agents add their leads to CRM', 1),
  ('After the Open House', 5, 'Video text all leads before leaving the home (thank you)', 2),
  ('After the Open House', 5, 'Clean up home, collect all items, turn off lights, lock up', 3),
  ('After the Open House', 5, 'Pick up ALL yard signs & pointers (aerial printout)', 4),
  ('After the Open House', 5, 'Send feedback email to listing agent & LC with results and info on other agents who brought clients, so the listing agent can follow up with them', 5)
) AS v(phase, phase_order, task_text, task_order)
WHERE NOT EXISTS (SELECT 1 FROM public.open_house_checklist_templates LIMIT 1);
