-- Add recipient_email column to public.shopify_swag_credits table
ALTER TABLE public.shopify_swag_credits
ADD COLUMN IF NOT EXISTS recipient_email text;

CREATE INDEX IF NOT EXISTS idx_shopify_swag_credits_recipient_email
ON public.shopify_swag_credits (recipient_email);
