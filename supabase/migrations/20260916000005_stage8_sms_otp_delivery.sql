-- ============================================================================
-- MLOHUB STAGE 8 MIGRATION: SMS DELIVERY & SECURE OTP AUDIT ARCHITECTURE
-- Migration: 20260916000005_stage8_sms_otp_delivery.sql
-- ============================================================================

-- 1. Ensure phone_verified_at exists on public.profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'phone_verified_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone_verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Enhance public.otp_challenges with invalidation tracking and index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'otp_challenges'
        AND column_name = 'invalidated_at'
    ) THEN
        ALTER TABLE public.otp_challenges ADD COLUMN invalidated_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Ensure max_attempts defaults to 5
    ALTER TABLE public.otp_challenges ALTER COLUMN max_attempts SET DEFAULT 5;
END $$;

CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_created
ON public.otp_challenges(phone, created_at DESC);

-- 3. Create Immutable SMS Logs Table (sms_logs)
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'sms_log_' || substr(md5(random()::text), 1, 16),
    recipient VARCHAR(30) NOT NULL,
    carrier VARCHAR(50),
    template_id VARCHAR(80) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- NEXTSMS, BEEM_AFRICA, SANDBOX
    provider_message_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'SENT', -- QUEUED, SENT, DELIVERED, FAILED
    error_message TEXT,
    latency_ms INTEGER,
    cost_tzs NUMERIC(10,2) DEFAULT 0.00,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON public.sms_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON public.sms_logs(created_at DESC);

-- 4. Enable Row Level Security (RLS) on sms_logs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for sms_logs
-- Admins can view all SMS delivery logs
DROP POLICY IF EXISTS "Admins can view all SMS logs" ON public.sms_logs;
CREATE POLICY "Admins can view all SMS logs"
ON public.sms_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('ADMIN'::user_role_enum, 'SUPER_ADMIN'::user_role_enum) OR 'ADMIN'::user_role_enum = ANY(profiles.roles) OR 'SUPER_ADMIN'::user_role_enum = ANY(profiles.roles))
    )
);

-- Service Role has unrestricted access for Edge Functions
DROP POLICY IF EXISTS "Service role full access on sms_logs" ON public.sms_logs;
CREATE POLICY "Service role full access on sms_logs"
ON public.sms_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No public direct inserts, updates, or deletes
DROP POLICY IF EXISTS "Deny public mutations on sms_logs" ON public.sms_logs;
CREATE POLICY "Deny public mutations on sms_logs"
ON public.sms_logs
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Trigger to auto-update updated_at on sms_logs
CREATE OR REPLACE FUNCTION public.handle_sms_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_logs_updated_at ON public.sms_logs;
CREATE TRIGGER trg_sms_logs_updated_at
    BEFORE UPDATE ON public.sms_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sms_logs_updated_at();

