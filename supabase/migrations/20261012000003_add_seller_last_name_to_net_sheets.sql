-- Migration: Add seller_last_name column to public.seller_net_sheets
ALTER TABLE public.seller_net_sheets
  ADD COLUMN IF NOT EXISTS seller_last_name text;
