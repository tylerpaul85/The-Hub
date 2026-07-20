-- ============================================================
-- Agent Accounts & Seller Net Proceeds Tool Migration
-- 1. public.agent_accounts  - Scoped agent profiles with domain enforcement
-- 2. public.seller_net_sheets - Agent saved seller net proceeds sheets
-- ============================================================

-- ----------------------------------------------------------------
-- 1. agent_accounts Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_accounts (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL UNIQUE,
  full_name       text NOT NULL,
  phone           text,
  office_location text DEFAULT '1043 Kingshighway, Rolla, MO 65401',
  office_phone    text DEFAULT '(573) 451-2020',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_accounts TO authenticated;
GRANT ALL ON public.agent_accounts TO service_role;
ALTER TABLE public.agent_accounts ENABLE ROW LEVEL SECURITY;

-- Domain enforcement trigger function
CREATE OR REPLACE FUNCTION public.check_agent_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(NEW.email) NOT LIKE '%@mattsmithrealestategroup.com' THEN
    RAISE EXCEPTION 'Accounts are limited to @mattsmithrealestategroup.com email addresses.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_agent_email_domain ON public.agent_accounts;
CREATE TRIGGER trg_check_agent_email_domain
  BEFORE INSERT OR UPDATE ON public.agent_accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_agent_email_domain();

-- RLS Policies for agent_accounts
DROP POLICY IF EXISTS "agent_accounts_select_policy" ON public.agent_accounts;
CREATE POLICY "agent_accounts_select_policy" ON public.agent_accounts
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "agent_accounts_insert_policy" ON public.agent_accounts;
CREATE POLICY "agent_accounts_insert_policy" ON public.agent_accounts
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "agent_accounts_update_policy" ON public.agent_accounts;
CREATE POLICY "agent_accounts_update_policy" ON public.agent_accounts
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ----------------------------------------------------------------
-- 2. seller_net_sheets Table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_net_sheets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_address text NOT NULL,
  agent_name       text NOT NULL,
  agent_cell       text,
  agent_email      text,
  office_address   text DEFAULT '1043 Kingshighway, Rolla, MO 65401',
  office_phone     text DEFAULT '(573) 451-2020',
  num_scenarios    int NOT NULL DEFAULT 1 CHECK (num_scenarios IN (1, 2, 3)),
  sheet_data       jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_net_sheets TO authenticated;
GRANT ALL ON public.seller_net_sheets TO service_role;
ALTER TABLE public.seller_net_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_net_sheets
DROP POLICY IF EXISTS "seller_net_sheets_select_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_select_policy" ON public.seller_net_sheets
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "seller_net_sheets_insert_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_insert_policy" ON public.seller_net_sheets
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "seller_net_sheets_update_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_update_policy" ON public.seller_net_sheets
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "seller_net_sheets_delete_policy" ON public.seller_net_sheets;
CREATE POLICY "seller_net_sheets_delete_policy" ON public.seller_net_sheets
  FOR DELETE TO authenticated
  USING (agent_id = auth.uid());
