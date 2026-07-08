-- 1. Add client_care to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client_care';
