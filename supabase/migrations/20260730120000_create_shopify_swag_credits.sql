-- ============================================================
-- Shopify Swag Credits System Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shopify_swag_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL, -- Flexible name or email of the agent
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  balance numeric(10, 2) NOT NULL CHECK (balance >= 0),
  reason text NOT NULL,
  shopify_gift_card_id bigint NOT NULL UNIQUE,
  gift_card_code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Access control permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_swag_credits TO authenticated;
GRANT ALL ON public.shopify_swag_credits TO service_role;

ALTER TABLE public.shopify_swag_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "swag_credits_select_policy" ON public.shopify_swag_credits;
CREATE POLICY "swag_credits_select_policy" ON public.shopify_swag_credits
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );

DROP POLICY IF EXISTS "swag_credits_insert_policy" ON public.shopify_swag_credits;
CREATE POLICY "swag_credits_insert_policy" ON public.shopify_swag_credits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );

DROP POLICY IF EXISTS "swag_credits_update_policy" ON public.shopify_swag_credits;
CREATE POLICY "swag_credits_update_policy" ON public.shopify_swag_credits
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );

DROP POLICY IF EXISTS "swag_credits_delete_policy" ON public.shopify_swag_credits;
CREATE POLICY "swag_credits_delete_policy" ON public.shopify_swag_credits
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );

-- Update trigger
DROP TRIGGER IF EXISTS shopify_swag_credits_updated_at ON public.shopify_swag_credits;
CREATE TRIGGER shopify_swag_credits_updated_at BEFORE UPDATE ON public.shopify_swag_credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
