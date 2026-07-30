-- 1. Drop the old dependent policy first to avoid Postgres dependency error
DROP POLICY IF EXISTS "swag_credits_select_policy" ON public.shopify_swag_credits;

-- 2. Alter the table structure
ALTER TABLE public.shopify_swag_credits DROP COLUMN IF EXISTS agent_id;
ALTER TABLE public.shopify_swag_credits ADD COLUMN IF NOT EXISTS agent_name text NOT NULL;

-- 3. Re-create the selection policy to match the new schema
CREATE POLICY "swag_credits_select_policy" ON public.shopify_swag_credits
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );
