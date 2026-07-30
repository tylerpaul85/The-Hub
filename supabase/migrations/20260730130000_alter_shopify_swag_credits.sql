-- Alter shopify_swag_credits to use flexible agent_name instead of agent_id
ALTER TABLE public.shopify_swag_credits DROP COLUMN IF EXISTS agent_id;
ALTER TABLE public.shopify_swag_credits ADD COLUMN IF NOT EXISTS agent_name text NOT NULL;

-- Update RLS policies to match the new schema (remove auth.uid() check since it's admin/marketing internal only)
DROP POLICY IF EXISTS "swag_credits_select_policy" ON public.shopify_swag_credits;
CREATE POLICY "swag_credits_select_policy" ON public.shopify_swag_credits
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'marketing_coordinator'::public.app_role)
  );
