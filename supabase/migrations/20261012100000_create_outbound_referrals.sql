-- Migration: 20261012100000_create_outbound_referrals.sql
-- Description: Create outbound_referrals table for agent referral submissions to Client Care (Nancy)

CREATE TABLE IF NOT EXISTS public.outbound_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    agent_email TEXT,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    transaction_type TEXT NOT NULL, -- 'buying' | 'selling' | 'both'
    timeline TEXT NOT NULL,
    buying_area TEXT,
    buying_budget TEXT,
    buying_criteria TEXT,
    selling_address TEXT,
    assigned_agent TEXT,
    broker_address TEXT,
    broker_email TEXT,
    broker_phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'placed' | 'closed' | 'archived'
    assigned_to TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient filtering and searching
CREATE INDEX IF NOT EXISTS idx_outbound_referrals_created_at ON public.outbound_referrals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_referrals_status ON public.outbound_referrals (status);
CREATE INDEX IF NOT EXISTS idx_outbound_referrals_agent_name ON public.outbound_referrals (agent_name);
CREATE INDEX IF NOT EXISTS idx_outbound_referrals_client_name ON public.outbound_referrals (client_name);

-- Enable Row Level Security
ALTER TABLE public.outbound_referrals ENABLE ROW LEVEL SECURITY;

-- Allow public and authenticated users to submit outbound referrals
CREATE POLICY "Allow insert outbound referrals"
ON public.outbound_referrals
FOR INSERT
WITH CHECK (true);

-- Allow authenticated users and service role to view referrals
CREATE POLICY "Allow authenticated read outbound referrals"
ON public.outbound_referrals
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow staff to update referrals (e.g. status changes, notes)
CREATE POLICY "Allow staff update outbound referrals"
ON public.outbound_referrals
FOR UPDATE
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
