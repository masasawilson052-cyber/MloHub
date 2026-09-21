-- ============================================================================
-- MLOHUB PACK 4E: NOTIFICATIONS, COMMUNICATION & DELIVERY RELIABILITY
-- Migration: 20260918000005_pack4e_notifications_communication.sql
-- 
-- Canonical enterprise-grade event outbox, provider-neutral delivery pipeline,
-- multi-channel preferences, marketing consent isolation, push registry,
-- template engine, suppression management, and authoritative recipient resolution.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS & DOMAIN TYPES
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE notification_channel_enum AS ENUM (
        'IN_APP',
        'PUSH',
        'SMS',
        'EMAIL'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE communication_class_enum AS ENUM (
        'SECURITY',
        'TRANSACTIONAL_CRITICAL',
        'TRANSACTIONAL',
        'OPERATIONAL',
        'REMINDER',
        'SOCIAL',
        'MARKETING'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_priority_enum AS ENUM (
        'LOW',
        'NORMAL',
        'HIGH',
        'CRITICAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_delivery_status_enum AS ENUM (
        'PENDING',
        'SUPPRESSED',
        'QUEUED',
        'PROVIDER_ACCEPTED',
        'SENT',
        'PROVIDER_DELIVERED',
        'FAILED_RETRYABLE',
        'FAILED_PERMANENT',
        'EXPIRED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_event_type_enum AS ENUM (
        -- Orders
        'ORDER_CREATED',
        'ORDER_ACCEPTED',
        'ORDER_PREPARING',
        'ORDER_READY',
        'ORDER_COMPLETED',
        'ORDER_CANCELLED',
        -- Reservations
        'RESERVATION_CREATED',
        'RESERVATION_APPROVAL_REQUIRED',
        'RESERVATION_AWAITING_DEPOSIT',
        'RESERVATION_CONFIRMED',
        'RESERVATION_REMINDER',
        'RESERVATION_SEATED',
        'RESERVATION_COMPLETED',
        'RESERVATION_CANCELLED',
        'RESERVATION_REJECTED',
        'RESERVATION_NO_SHOW',
        -- Custom Meals
        'CUSTOM_MEAL_CREATED',
        'CUSTOM_MEAL_INVITATION_SENT',
        'CUSTOM_MEAL_QUOTE_RECEIVED',
        'CUSTOM_MEAL_QUOTE_ACCEPTED',
        'CUSTOM_MEAL_READY',
        -- Payments & Financial
        'PAYMENT_INITIATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_FAILED',
        'REFUND_REQUESTED',
        'REFUND_PROCESSED',
        'SETTLEMENT_GENERATED',
        'DISPUTE_OPENED',
        -- Reviews
        'REVIEW_SUBMITTED',
        'REVIEW_RESPONSE_PUBLISHED',
        'REVIEW_MODERATED',
        -- Security & Account
        'SECURITY_LOGIN_ALERT',
        'SECURITY_PASSWORD_CHANGED',
        'SECURITY_DEVICE_LINKED',
        -- Marketing & System
        'PROMOTIONAL_CAMPAIGN',
        'SYSTEM_ANNOUNCEMENT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION EVENT OUTBOX TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_event_outbox (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'nevt_' || substr(md5(random()::text), 1, 16),
    event_type notification_event_type_enum NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(180) UNIQUE NOT NULL,
    priority notification_priority_enum NOT NULL DEFAULT 'NORMAL',
    communication_class communication_class_enum NOT NULL DEFAULT 'TRANSACTIONAL',
    processing_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (processing_status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    worker_id VARCHAR(80),
    claimed_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_claim 
    ON public.notification_event_outbox(processing_status, lease_until, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_outbox_status_priority 
    ON public.notification_event_outbox(processing_status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
    ON public.notification_event_outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_idempotency 
    ON public.notification_event_outbox(idempotency_key);

-- ----------------------------------------------------------------------------
-- 3. ENHANCE PUBLIC.NOTIFICATIONS SCHEMA (DURABLE IN-APP STORE)
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS event_id VARCHAR(80) REFERENCES public.notification_event_outbox(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS communication_class communication_class_enum NOT NULL DEFAULT 'TRANSACTIONAL',
    ADD COLUMN IF NOT EXISTS priority notification_priority_enum NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'sw',
    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(150),
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe
    ON public.notifications(user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_opt 
    ON public.notifications(user_id, is_read, archived_at, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. PROVIDER-NEUTRAL DELIVERIES & ATTEMPTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'ndel_' || substr(md5(random()::text), 1, 16),
    notification_id VARCHAR(80) REFERENCES public.notifications(id) ON DELETE CASCADE,
    outbox_event_id VARCHAR(80) REFERENCES public.notification_event_outbox(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel notification_channel_enum NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    status notification_delivery_status_enum NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(180) UNIQUE NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    provider_message_id VARCHAR(150),
    provider_response JSONB DEFAULT '{}'::jsonb,
    error_code VARCHAR(80),
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    worker_id VARCHAR(80),
    claimed_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    template_id VARCHAR(80),
    template_version INTEGER,
    locale VARCHAR(10) DEFAULT 'sw',
    rendered_title VARCHAR(255),
    rendered_body TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_claim 
    ON public.notification_deliveries(status, lease_until, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_deliveries_user_status ON public.notification_deliveries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_outbox ON public.notification_deliveries(outbox_event_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_provider_msg ON public.notification_deliveries(provider, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_pending ON public.notification_deliveries(status, next_attempt_at) 
    WHERE status IN ('PENDING', 'FAILED_RETRYABLE');

-- Append-only attempt audit log
CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'natt_' || substr(md5(random()::text), 1, 16),
    delivery_id VARCHAR(80) NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    channel notification_channel_enum NOT NULL,
    provider VARCHAR(50) NOT NULL,
    status notification_delivery_status_enum NOT NULL,
    provider_message_id VARCHAR(150),
    provider_status_code VARCHAR(50),
    provider_raw_response JSONB DEFAULT '{}'::jsonb,
    error_code VARCHAR(80),
    error_message TEXT,
    attempted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration_ms INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_del ON public.notification_delivery_attempts(delivery_id, attempt_number);

-- ----------------------------------------------------------------------------
-- 5. USER PREFERENCES & MARKETING CONSENT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'nprf_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel notification_channel_enum NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'ALL',
    enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME WITHOUT TIME ZONE DEFAULT '22:00:00',
    quiet_hours_end TIME WITHOUT TIME ZONE DEFAULT '07:00:00',
    quiet_hours_timezone VARCHAR(50) DEFAULT 'Africa/Dar_es_Salaam',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, channel, category)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON public.notification_preferences(user_id, channel);

-- Explicit, decoupled marketing consent table
CREATE TABLE IF NOT EXISTS public.marketing_consents (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'mcon_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel notification_channel_enum NOT NULL,
    consented BOOLEAN NOT NULL DEFAULT false,
    consented_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    consent_policy_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_marketing_consents_user ON public.marketing_consents(user_id);

-- ----------------------------------------------------------------------------
-- 6. PUSH DEVICES & TOKEN REGISTRY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_devices (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'pdev_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
    device_model VARCHAR(100),
    app_version VARCHAR(30),
    os_version VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user ON public.push_devices(user_id, is_active);

CREATE TABLE IF NOT EXISTS public.push_device_tokens (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'ptok_' || substr(md5(random()::text), 1, 16),
    device_id VARCHAR(80) NOT NULL REFERENCES public.push_devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_type VARCHAR(20) NOT NULL DEFAULT 'EXPO' CHECK (token_type IN ('EXPO', 'FCM', 'APNS')),
    token VARCHAR(255) UNIQUE NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_active ON public.push_device_tokens(user_id, is_valid);

-- ----------------------------------------------------------------------------
-- 7. TEMPLATE REGISTRY & SUPPRESSIONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_templates (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'ntpl_' || substr(md5(random()::text), 1, 16),
    event_type VARCHAR(80) NOT NULL,
    channel notification_channel_enum NOT NULL,
    locale VARCHAR(10) NOT NULL CHECK (locale IN ('en', 'sw')),
    title_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    allowlisted_keys TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_type, channel, locale)
);

CREATE INDEX IF NOT EXISTS idx_templates_lookup ON public.notification_templates(event_type, channel, locale, is_active);

-- Suppression list (bounced emails, spam complaints, unsubs, carrier invalid numbers)
CREATE TABLE IF NOT EXISTS public.communication_suppressions (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'csup_' || substr(md5(random()::text), 1, 16),
    channel notification_channel_enum NOT NULL,
    destination VARCHAR(255) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('HARD_BOUNCE', 'SPAM_COMPLAINT', 'SPAM_REPORT', 'UNSUBSCRIBED', 'USER_MARKETING_OPT_OUT', 'INVALID_DESTINATION', 'INVALID_NUMBER', 'CARRIER_BLOCK', 'CARRIER_BLOCKED', 'DEVICE_NOT_REGISTERED', 'PROVIDER_SUPPRESSION', 'MANUAL_SUPPRESSION')),
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(channel, destination)
);

CREATE INDEX IF NOT EXISTS idx_suppressions_dest ON public.communication_suppressions(channel, destination);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.notification_event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_suppressions ENABLE ROW LEVEL SECURITY;

-- 8.1 Outbox & Attempts: Service role only
DROP POLICY IF EXISTS "Service role full access to outbox" ON public.notification_event_outbox;
CREATE POLICY "Service role full access to outbox" ON public.notification_event_outbox
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to delivery attempts" ON public.notification_delivery_attempts;
CREATE POLICY "Service role full access to delivery attempts" ON public.notification_delivery_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to suppressions" ON public.communication_suppressions;
CREATE POLICY "Service role full access to suppressions" ON public.communication_suppressions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8.2 Deliveries: Users see their own deliveries; service role full access
DROP POLICY IF EXISTS "Users view their own deliveries" ON public.notification_deliveries;
CREATE POLICY "Users view their own deliveries" ON public.notification_deliveries
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to deliveries" ON public.notification_deliveries;
CREATE POLICY "Service role full access to deliveries" ON public.notification_deliveries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8.3 Preferences: Users view and manage their own preferences
DROP POLICY IF EXISTS "Users view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users view their own preferences" ON public.notification_preferences
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users modify their own preferences" ON public.notification_preferences;
CREATE POLICY "Users modify their own preferences" ON public.notification_preferences
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to preferences" ON public.notification_preferences;
CREATE POLICY "Service role full access to preferences" ON public.notification_preferences
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8.4 Marketing Consents: Users view and modify their own consents
DROP POLICY IF EXISTS "Users view their own marketing consent" ON public.marketing_consents;
CREATE POLICY "Users view their own marketing consent" ON public.marketing_consents
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users modify their own marketing consent" ON public.marketing_consents;
CREATE POLICY "Users modify their own marketing consent" ON public.marketing_consents
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to marketing consent" ON public.marketing_consents;
CREATE POLICY "Service role full access to marketing consent" ON public.marketing_consents
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8.5 Push Devices & Tokens: Users manage their own devices; tokens strictly guarded
DROP POLICY IF EXISTS "Users manage their own push devices" ON public.push_devices;
CREATE POLICY "Users manage their own push devices" ON public.push_devices
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to push devices" ON public.push_devices;
CREATE POLICY "Service role full access to push devices" ON public.push_devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage their own push tokens" ON public.push_device_tokens;
DROP POLICY IF EXISTS "Users insert their own push tokens" ON public.push_device_tokens;
CREATE POLICY "Users insert their own push tokens" ON public.push_device_tokens
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own push tokens" ON public.push_device_tokens;
CREATE POLICY "Users update their own push tokens" ON public.push_device_tokens
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to push tokens" ON public.push_device_tokens;
CREATE POLICY "Service role full access to push tokens" ON public.push_device_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8.6 Templates: Authenticated users can read templates; service role modifies
DROP POLICY IF EXISTS "Public view active templates" ON public.notification_templates;
CREATE POLICY "Public view active templates" ON public.notification_templates
    FOR SELECT TO authenticated, anon USING (is_active = true);

DROP POLICY IF EXISTS "Service role manage templates" ON public.notification_templates;
CREATE POLICY "Service role manage templates" ON public.notification_templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. SERVER-AUTHORITATIVE RPCs & SECURITY DEFINER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Helper: Emit notification event outbox record (Idempotent)
CREATE OR REPLACE FUNCTION public.emit_notification_event(
    p_event_type notification_event_type_enum,
    p_aggregate_type VARCHAR(50),
    p_aggregate_id VARCHAR(80),
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key VARCHAR(180) DEFAULT NULL,
    p_priority notification_priority_enum DEFAULT 'NORMAL',
    p_communication_class communication_class_enum DEFAULT 'TRANSACTIONAL'
)
RETURNS VARCHAR(80)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_idempotency VARCHAR(180);
    v_existing_id VARCHAR(80);
    v_new_id VARCHAR(80);
BEGIN
    v_idempotency := COALESCE(p_idempotency_key, 'nevt_' || p_aggregate_type || '_' || p_aggregate_id || '_' || p_event_type::text || '_' || md5(p_payload::text));
    
    -- Check for existing idempotent emission
    SELECT id INTO v_existing_id
    FROM public.notification_event_outbox
    WHERE idempotency_key = v_idempotency;

    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    v_new_id := 'nevt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

    INSERT INTO public.notification_event_outbox (
        id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        idempotency_key,
        priority,
        communication_class,
        processing_status,
        created_at
    ) VALUES (
        v_new_id,
        p_event_type,
        p_aggregate_type,
        p_aggregate_id,
        p_payload,
        v_idempotency,
        p_priority,
        p_communication_class,
        'PENDING',
        timezone('utc'::text, now())
    );

    RETURN v_new_id;
EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_id
    FROM public.notification_event_outbox
    WHERE idempotency_key = v_idempotency;
    RETURN v_existing_id;
END;
$$;

-- Secure Device & Push Token Registration
CREATE OR REPLACE FUNCTION public.register_push_device_token_secure(
    p_device_fingerprint VARCHAR(100),
    p_platform VARCHAR(20),
    p_token VARCHAR(255),
    p_token_type VARCHAR(20) DEFAULT 'EXPO',
    p_device_model VARCHAR(100) DEFAULT NULL,
    p_app_version VARCHAR(30) DEFAULT NULL,
    p_os_version VARCHAR(30) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_device_id VARCHAR(80);
    v_token_id VARCHAR(80);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to register push device.';
    END IF;

    IF p_token IS NULL OR length(trim(p_token)) < 10 THEN
        RAISE EXCEPTION '400 Bad Request: Invalid push token.';
    END IF;

    -- Upsert device record
    INSERT INTO public.push_devices (
        user_id,
        device_fingerprint,
        platform,
        device_model,
        app_version,
        os_version,
        is_active,
        last_seen_at
    ) VALUES (
        v_user_id,
        p_device_fingerprint,
        LOWER(p_platform),
        p_device_model,
        p_app_version,
        p_os_version,
        true,
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, device_fingerprint)
    DO UPDATE SET
        platform = LOWER(p_platform),
        device_model = COALESCE(p_device_model, push_devices.device_model),
        app_version = COALESCE(p_app_version, push_devices.app_version),
        os_version = COALESCE(p_os_version, push_devices.os_version),
        is_active = true,
        last_seen_at = timezone('utc'::text, now())
    RETURNING id INTO v_device_id;

    -- Upsert token record
    INSERT INTO public.push_device_tokens (
        device_id,
        user_id,
        token_type,
        token,
        is_valid,
        updated_at
    ) VALUES (
        v_device_id,
        v_user_id,
        UPPER(p_token_type),
        p_token,
        true,
        timezone('utc'::text, now())
    )
    ON CONFLICT (token)
    DO UPDATE SET
        device_id = v_device_id,
        user_id = v_user_id,
        token_type = UPPER(p_token_type),
        is_valid = true,
        invalidated_at = NULL,
        invalidation_reason = NULL,
        updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_token_id;

    RETURN jsonb_build_object(
        'success', true,
        'device_id', v_device_id,
        'token_id', v_token_id,
        'token', p_token
    );
END;
$$;

-- Secure Token Deactivation (e.g. on DeviceNotRegistered from Expo/FCM)
CREATE OR REPLACE FUNCTION public.deactivate_push_device_token_secure(
    p_token VARCHAR(255),
    p_reason VARCHAR(100) DEFAULT 'DeviceNotRegistered'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.push_device_tokens
    SET
        is_valid = false,
        invalidated_at = timezone('utc'::text, now()),
        invalidation_reason = p_reason,
        updated_at = timezone('utc'::text, now())
    WHERE token = p_token;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'tokens_deactivated', v_updated_count,
        'reason', p_reason
    );
END;
$$;

-- Read & Archive In-App Notifications
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id VARCHAR(80))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.notifications
    SET is_read = true,
        read_at = COALESCE(read_at, timezone('utc'::text, now()))
    WHERE id = p_notification_id AND user_id = v_user_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', (v_updated > 0),
        'notification_id', p_notification_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.notifications
    SET is_read = true,
        read_at = timezone('utc'::text, now())
    WHERE user_id = v_user_id AND is_read = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_notification(p_notification_id VARCHAR(80))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_updated INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.notifications
    SET archived_at = timezone('utc'::text, now())
    WHERE id = p_notification_id AND user_id = v_user_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', (v_updated > 0),
        'notification_id', p_notification_id
    );
END;
$$;

-- Preference & Consent Updates
CREATE OR REPLACE FUNCTION public.update_notification_preference_secure(
    p_channel notification_channel_enum,
    p_category VARCHAR(50),
    p_enabled BOOLEAN,
    p_quiet_hours_enabled BOOLEAN DEFAULT false,
    p_quiet_hours_start TIME WITHOUT TIME ZONE DEFAULT '22:00:00',
    p_quiet_hours_end TIME WITHOUT TIME ZONE DEFAULT '07:00:00'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    INSERT INTO public.notification_preferences (
        user_id,
        channel,
        category,
        enabled,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        updated_at
    ) VALUES (
        v_user_id,
        p_channel,
        UPPER(p_category),
        p_enabled,
        p_quiet_hours_enabled,
        p_quiet_hours_start,
        p_quiet_hours_end,
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, channel, category)
    DO UPDATE SET
        enabled = p_enabled,
        quiet_hours_enabled = p_quiet_hours_enabled,
        quiet_hours_start = p_quiet_hours_start,
        quiet_hours_end = p_quiet_hours_end,
        updated_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'channel', p_channel,
        'category', UPPER(p_category),
        'enabled', p_enabled
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_marketing_consent_secure(
    p_channel notification_channel_enum,
    p_consented BOOLEAN,
    p_policy_version VARCHAR(20) DEFAULT 'v1.0',
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    INSERT INTO public.marketing_consents (
        user_id,
        channel,
        consented,
        consented_at,
        withdrawn_at,
        consent_policy_version,
        ip_address,
        user_agent,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_channel,
        p_consented,
        CASE WHEN p_consented THEN v_now ELSE NULL END,
        CASE WHEN NOT p_consented THEN v_now ELSE NULL END,
        p_policy_version,
        p_ip_address,
        p_user_agent,
        v_now,
        v_now
    )
    ON CONFLICT (user_id, channel)
    DO UPDATE SET
        consented = p_consented,
        consented_at = CASE WHEN p_consented THEN v_now ELSE marketing_consents.consented_at END,
        withdrawn_at = CASE WHEN NOT p_consented THEN v_now ELSE marketing_consents.withdrawn_at END,
        consent_policy_version = p_policy_version,
        ip_address = COALESCE(p_ip_address, marketing_consents.ip_address),
        user_agent = COALESCE(p_user_agent, marketing_consents.user_agent),
        updated_at = v_now;

    RETURN jsonb_build_object(
        'success', true,
        'channel', p_channel,
        'consented', p_consented
    );
END;
$$;

-- Authoritative Delivery Reachability Evaluator
-- Evaluates suppression, preferences, quiet hours, and marketing consent
CREATE OR REPLACE FUNCTION public.is_recipient_reachable(
    p_user_id UUID,
    p_channel notification_channel_enum,
    p_category VARCHAR(50),
    p_comm_class communication_class_enum,
    p_destination VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_suppressed BOOLEAN;
    v_suppression_reason TEXT;
    v_pref_enabled BOOLEAN;
    v_quiet_hours BOOLEAN;
    v_quiet_start TIME;
    v_quiet_end TIME;
    v_tz VARCHAR(50);
    v_user_time TIME;
    v_mkt_consented BOOLEAN;
BEGIN
    -- 1. Check suppression list (Hard blocks vs Marketing unsubs)
    IF p_destination IS NOT NULL THEN
        SELECT true, reason INTO v_suppressed, v_suppression_reason
        FROM public.communication_suppressions
        WHERE channel = p_channel AND LOWER(destination) = LOWER(p_destination)
        LIMIT 1;

        IF v_suppressed IS TRUE THEN
            -- Non-bypassable categories: HARD_BOUNCE, SPAM_COMPLAINT, CARRIER_BLOCK, INVALID_DESTINATION, etc.
            -- A critical / security communication MUST NOT bypass hard bounce, spam complaint, carrier block, or invalid destination!
            IF v_suppression_reason IN (
                'HARD_BOUNCE',
                'SPAM_COMPLAINT',
                'SPAM_REPORT',
                'INVALID_DESTINATION',
                'INVALID_NUMBER',
                'CARRIER_BLOCK',
                'CARRIER_BLOCKED',
                'DEVICE_NOT_REGISTERED',
                'PROVIDER_SUPPRESSION',
                'MANUAL_SUPPRESSION'
            ) THEN
                RETURN jsonb_build_object(
                    'reachable', false,
                    'status', 'SUPPRESSED',
                    'reason', 'SUPPRESSED: ' || v_suppression_reason,
                    'suppression_category', v_suppression_reason,
                    'bypass_permitted', false
                );
            END IF;

            -- Bypassable only for commercial/marketing opt-outs: USER_MARKETING_OPT_OUT, UNSUBSCRIBED
            IF p_comm_class NOT IN ('SECURITY', 'TRANSACTIONAL_CRITICAL') THEN
                RETURN jsonb_build_object(
                    'reachable', false,
                    'status', 'SUPPRESSED',
                    'reason', 'SUPPRESSED: ' || v_suppression_reason,
                    'suppression_category', v_suppression_reason,
                    'bypass_permitted', false
                );
            END IF;
        END IF;
    END IF;

    -- 2. Security & Critical bypass marketing opt-out, category preferences, and quiet hours
    IF p_comm_class IN ('SECURITY', 'TRANSACTIONAL_CRITICAL') THEN
        RETURN jsonb_build_object(
            'reachable', true,
            'status', 'QUEUED',
            'reason', 'CRITICAL_BYPASS',
            'bypass_permitted', true
        );
    END IF;

    -- 3. Marketing Consent Check (Strict isolation)
    IF p_comm_class = 'MARKETING' THEN
        SELECT consented INTO v_mkt_consented
        FROM public.marketing_consents
        WHERE user_id = p_user_id AND channel = p_channel;

        IF v_mkt_consented IS NOT TRUE THEN
            RETURN jsonb_build_object(
                'reachable', false,
                'status', 'SUPPRESSED',
                'reason', 'NO_MARKETING_CONSENT',
                'suppression_category', 'USER_MARKETING_OPT_OUT',
                'bypass_permitted', false
            );
        END IF;
    END IF;

    -- 4. User Channel & Category Preferences
    SELECT enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone
    INTO v_pref_enabled, v_quiet_hours, v_quiet_start, v_quiet_end, v_tz
    FROM public.notification_preferences
    WHERE user_id = p_user_id AND channel = p_channel AND category = UPPER(p_category);

    IF v_pref_enabled IS FALSE THEN
        RETURN jsonb_build_object(
            'reachable', false,
            'status', 'SUPPRESSED',
            'reason', 'USER_CHANNEL_DISABLED',
            'suppression_category', 'USER_CATEGORY_OPT_OUT',
            'bypass_permitted', false
        );
    END IF;

    -- 5. Quiet Hours check (Non-critical classes)
    IF v_quiet_hours IS TRUE AND v_quiet_start IS NOT NULL AND v_quiet_end IS NOT NULL THEN
        v_tz := COALESCE(v_tz, 'Africa/Dar_es_Salaam');
        v_user_time := (timezone(v_tz, now()))::time;

        IF v_quiet_start < v_quiet_end THEN
            IF v_user_time >= v_quiet_start AND v_user_time <= v_quiet_end THEN
                RETURN jsonb_build_object(
                    'reachable', false,
                    'status', 'SUPPRESSED',
                    'reason', 'QUIET_HOURS_ACTIVE',
                    'suppression_category', 'QUIET_HOURS',
                    'bypass_permitted', false
                );
            END IF;
        ELSE
            -- Spans midnight (e.g. 22:00 to 07:00)
            IF v_user_time >= v_quiet_start OR v_user_time <= v_quiet_end THEN
                RETURN jsonb_build_object(
                    'reachable', false,
                    'status', 'SUPPRESSED',
                    'reason', 'QUIET_HOURS_ACTIVE',
                    'suppression_category', 'QUIET_HOURS',
                    'bypass_permitted', false
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('reachable', true, 'status', 'QUEUED', 'reason', 'ALLOWED');
END;
$$;

-- Server-Authoritative Recipient Resolution Function
CREATE OR REPLACE FUNCTION public.resolve_event_recipients(
    p_event_type notification_event_type_enum,
    p_aggregate_type VARCHAR(50),
    p_aggregate_id VARCHAR(80),
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    recipient_user_id UUID,
    role_context VARCHAR(50),
    preferred_locale VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_aggregate_type = 'RESTAURANT' AND p_event_type::TEXT = 'STAFF_INVITATION' THEN
        -- Invitations are private: only the intended existing account receives
        -- an in-app notification. Unknown invitees use the external delivery
        -- worker with the invitation email/phone payload instead.
        IF p_payload ? 'invited_user_id' AND NULLIF(p_payload->>'invited_user_id', '') IS NOT NULL THEN
            RETURN QUERY
            SELECT (p_payload->>'invited_user_id')::UUID, 'INVITED_USER'::VARCHAR(50), 'sw'::VARCHAR(10);
        END IF;
    ELSIF p_aggregate_type = 'ORDER' THEN
        -- 1. Customer
        RETURN QUERY
        SELECT o.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        WHERE o.id = p_aggregate_id;

        -- 2. Restaurant authorized staff (OWNER, MANAGER, or ORDERS permission)
        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        JOIN public.restaurant_members rm ON rm.restaurant_id = o.restaurant_id
        WHERE o.id = p_aggregate_id
          AND rm.is_active = true
          AND ('ALL' = ANY(rm.permissions) OR 'ORDERS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));

    ELSIF p_aggregate_type = 'RESERVATION' THEN
        -- 1. Customer
        RETURN QUERY
        SELECT r.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r
        WHERE r.id = p_aggregate_id;

        -- 2. Restaurant authorized staff (OWNER, MANAGER, or RESERVATIONS permission)
        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r
        JOIN public.restaurant_members rm ON rm.restaurant_id = r.restaurant_id
        WHERE r.id = p_aggregate_id
          AND rm.is_active = true
          AND ('ALL' = ANY(rm.permissions) OR 'RESERVATIONS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));

    ELSIF p_aggregate_type = 'CUSTOM_MEAL' THEN
        -- 1. Customer
        RETURN QUERY
        SELECT cmr.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.custom_meal_requests cmr
        WHERE cmr.id = p_aggregate_id;

        -- 2. If quote event or invitation, notify target restaurant members
        IF p_payload ? 'target_restaurant_id' THEN
            RETURN QUERY
            SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
            FROM public.restaurant_members rm
            WHERE rm.restaurant_id = (p_payload->>'target_restaurant_id')
              AND rm.is_active = true;
        END IF;

    ELSIF p_aggregate_type = 'PAYMENT' OR p_aggregate_type = 'REFUND' THEN
        -- Strictly Isolated: Customer only for payments
        RETURN QUERY
        SELECT p.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.payments p
        WHERE p.id = p_aggregate_id;

    ELSIF p_aggregate_type = 'REVIEW' THEN
        -- Customer & Restaurant Owner
        RETURN QUERY
        SELECT rev.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev
        WHERE rev.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_OWNER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev
        JOIN public.restaurant_members rm ON rm.restaurant_id = rev.restaurant_id
        WHERE rev.id = p_aggregate_id
          AND rm.is_active = true
          AND rm.role IN ('OWNER', 'MANAGER');

    ELSIF p_aggregate_type IN ('SETTLEMENT', 'PAYOUT') THEN
        -- Financial authority ONLY: Restaurant Owner or Manager with FINANCE permission
        -- General staff (CHEF, SERVER) must NEVER receive settlement or payout notifications
        IF p_payload ? 'restaurant_id' THEN
            RETURN QUERY
            SELECT rm.user_id, 'RESTAURANT_FINANCE'::VARCHAR(50), 'sw'::VARCHAR(10)
            FROM public.restaurant_members rm
            WHERE rm.restaurant_id = (p_payload->>'restaurant_id')
              AND rm.is_active = true
              AND (rm.role = 'OWNER' OR ('FINANCE' = ANY(rm.permissions) AND rm.role = 'MANAGER'));
        END IF;

    ELSIF p_aggregate_type = 'ACCOUNT' THEN
        -- Direct user in payload
        IF p_payload ? 'user_id' THEN
            RETURN QUERY
            SELECT (p_payload->>'user_id')::UUID, 'ACCOUNT_HOLDER'::VARCHAR(50), 'sw'::VARCHAR(10);
        END IF;
    END IF;
END;
$$;

-- Record delivery attempt and update delivery status
CREATE OR REPLACE FUNCTION public.record_delivery_attempt_secure(
    p_delivery_id VARCHAR(80),
    p_provider VARCHAR(50),
    p_status notification_delivery_status_enum,
    p_provider_msg_id VARCHAR(150) DEFAULT NULL,
    p_status_code VARCHAR(50) DEFAULT NULL,
    p_raw_response JSONB DEFAULT '{}'::jsonb,
    p_error_code VARCHAR(80) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_del RECORD;
    v_next_attempt TIMESTAMPTZ := NULL;
    v_new_attempt_count INTEGER;
    v_effective_status notification_delivery_status_enum;
    v_sanitized_response JSONB;
    v_jitter_seconds INTEGER;
BEGIN
    SELECT * INTO v_del
    FROM public.notification_deliveries
    WHERE id = p_delivery_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Delivery % does not exist.', p_delivery_id;
    END IF;

    v_effective_status := p_status;

    -- Status Regression Protection (Monotonic progression)
    -- PROVIDER_DELIVERED cannot regress to SENT, QUEUED, PENDING, or FAILED_RETRYABLE
    IF v_del.status = 'PROVIDER_DELIVERED' AND p_status IN ('PENDING', 'QUEUED', 'SENT', 'PROVIDER_ACCEPTED', 'FAILED_RETRYABLE') THEN
        v_effective_status := 'PROVIDER_DELIVERED';
    -- FAILED_PERMANENT cannot regress to PENDING or QUEUED without explicit retry
    ELSIF v_del.status = 'FAILED_PERMANENT' AND p_status IN ('PENDING', 'QUEUED', 'FAILED_RETRYABLE') THEN
        v_effective_status := 'FAILED_PERMANENT';
    END IF;

    v_new_attempt_count := v_del.attempt_count + 1;

    -- Exponential backoff with jitter for retryable failure
    IF v_effective_status = 'FAILED_RETRYABLE' AND v_new_attempt_count < v_del.max_attempts THEN
        -- Jitter between 0 and 5 seconds
        v_jitter_seconds := floor(random() * 5)::INTEGER;
        v_next_attempt := timezone('utc'::text, now()) + ((POWER(2, v_new_attempt_count) * 30 + v_jitter_seconds) || ' seconds')::INTERVAL;
    ELSEIF v_effective_status = 'FAILED_RETRYABLE' AND v_new_attempt_count >= v_del.max_attempts THEN
        v_effective_status := 'FAILED_PERMANENT';
    END IF;

    -- Sanitize raw response: Redact authentication headers, bearer tokens, OTPs, PINs, secrets, passwords
    v_sanitized_response := COALESCE(p_raw_response, '{}'::jsonb)
        - 'authorization'
        - 'Authorization'
        - 'token'
        - 'accessToken'
        - 'access_token'
        - 'bearer'
        - 'otp'
        - 'pin'
        - 'password'
        - 'secret'
        - 'apiKey'
        - 'api_key';

    -- Insert attempt log
    INSERT INTO public.notification_delivery_attempts (
        delivery_id,
        attempt_number,
        channel,
        provider,
        status,
        provider_message_id,
        provider_status_code,
        provider_raw_response,
        error_code,
        error_message,
        duration_ms
    ) VALUES (
        p_delivery_id,
        v_new_attempt_count,
        v_del.channel,
        p_provider,
        v_effective_status,
        p_provider_msg_id,
        p_status_code,
        v_sanitized_response,
        p_error_code,
        p_error_message,
        p_duration_ms
    );

    -- Update delivery status
    UPDATE public.notification_deliveries
    SET
        status = v_effective_status,
        attempt_count = v_new_attempt_count,
        last_attempt_at = timezone('utc'::text, now()),
        next_attempt_at = v_next_attempt,
        provider_message_id = COALESCE(p_provider_msg_id, provider_message_id),
        provider_response = v_sanitized_response,
        error_code = p_error_code,
        error_message = p_error_message,
        delivered_at = CASE WHEN v_effective_status = 'PROVIDER_DELIVERED' THEN COALESCE(delivered_at, timezone('utc'::text, now())) ELSE delivered_at END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_delivery_id;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_id', p_delivery_id,
        'status', v_effective_status,
        'attempt_count', v_new_attempt_count
    );
END;
$$;

-- Add suppression helper
CREATE OR REPLACE FUNCTION public.record_suppression_secure(
    p_channel notification_channel_enum,
    p_destination VARCHAR(255),
    p_reason VARCHAR(50),
    p_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.communication_suppressions (
        channel,
        destination,
        reason,
        details,
        created_at
    ) VALUES (
        p_channel,
        LOWER(p_destination),
        p_reason,
        p_details,
        timezone('utc'::text, now())
    )
    ON CONFLICT (channel, destination)
    DO UPDATE SET
        reason = p_reason,
        details = COALESCE(p_details, communication_suppressions.details);

    RETURN jsonb_build_object('success', true, 'destination', p_destination, 'reason', p_reason);
END;
$$;


-- Secure Worker Claim: Pending Deliveries with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_pending_deliveries_secure(
    p_worker_id VARCHAR(80),
    p_batch_size INTEGER DEFAULT 10,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.notification_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_lease TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH candidate_deliveries AS (
        SELECT id
        FROM public.notification_deliveries
        WHERE status IN ('PENDING', 'FAILED_RETRYABLE', 'QUEUED')
          AND (lease_until IS NULL OR lease_until < v_now)
          AND (next_attempt_at IS NULL OR next_attempt_at <= v_now)
          AND attempt_count < max_attempts
        ORDER BY created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_deliveries d
    SET status = 'QUEUED',
        worker_id = p_worker_id,
        claimed_at = v_now,
        lease_until = v_lease,
        updated_at = v_now
    FROM candidate_deliveries cd
    WHERE d.id = cd.id
    RETURNING d.*;
END;
$$;

-- Secure Worker Claim: Outbox Events with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_outbox_events_secure(
    p_worker_id VARCHAR(80),
    p_batch_size INTEGER DEFAULT 10,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.notification_event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_lease TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH candidate_events AS (
        SELECT id
        FROM public.notification_event_outbox
        WHERE processing_status IN ('PENDING', 'PROCESSING')
          AND (lease_until IS NULL OR lease_until < v_now)
          AND (next_retry_at IS NULL OR next_retry_at <= v_now)
          AND retry_count < max_retries
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_event_outbox o
    SET processing_status = 'PROCESSING',
        worker_id = p_worker_id,
        claimed_at = v_now,
        lease_until = v_lease
    FROM candidate_events c
    WHERE o.id = c.id
    RETURNING o.*;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. DOMAIN EVENT TRIGGERS (NON-BLOCKING SAFE EMISSION)
-- ----------------------------------------------------------------------------

-- Trigger function for Order events
CREATE OR REPLACE FUNCTION public.trg_emit_order_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_evt notification_event_type_enum;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_evt := 'ORDER_CREATED';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'ACCEPTED' THEN v_evt := 'ORDER_ACCEPTED';
            WHEN 'PREPARING' THEN v_evt := 'ORDER_PREPARING';
            WHEN 'READY' THEN v_evt := 'ORDER_READY';
            WHEN 'COMPLETED' THEN v_evt := 'ORDER_COMPLETED';
            WHEN 'CANCELLED' THEN v_evt := 'ORDER_CANCELLED';
            ELSE v_evt := NULL;
        END CASE;
    END IF;

    IF v_evt IS NOT NULL THEN
        -- Atomic outbox emission: business state mutation + outbox event commit in the SAME transaction
        PERFORM public.emit_notification_event(
            p_event_type := v_evt,
            p_aggregate_type := 'ORDER',
            p_aggregate_id := NEW.id,
            p_payload := jsonb_build_object(
                'order_id', NEW.id,
                'order_number', NEW.order_number,
                'user_id', NEW.user_id,
                'restaurant_id', NEW.restaurant_id,
                'status', NEW.status,
                'total_tzs', NEW.total_tzs
            ),
            p_priority := CASE WHEN v_evt IN ('ORDER_CREATED', 'ORDER_READY', 'ORDER_CANCELLED') THEN 'HIGH'::notification_priority_enum ELSE 'NORMAL'::notification_priority_enum END,
            p_communication_class := 'TRANSACTIONAL'::communication_class_enum
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notification_event ON public.orders;
CREATE TRIGGER trg_orders_notification_event
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_emit_order_notification_event();

-- Trigger function for Reservation events
CREATE OR REPLACE FUNCTION public.trg_emit_reservation_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_evt notification_event_type_enum;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'PENDING_RESTAURANT_APPROVAL' THEN
            v_evt := 'RESERVATION_APPROVAL_REQUIRED';
        ELSIF NEW.status = 'AWAITING_DEPOSIT' THEN
            v_evt := 'RESERVATION_AWAITING_DEPOSIT';
        ELSIF NEW.status = 'CONFIRMED' THEN
            v_evt := 'RESERVATION_CONFIRMED';
        ELSE
            v_evt := 'RESERVATION_CREATED';
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'CONFIRMED' THEN v_evt := 'RESERVATION_CONFIRMED';
            WHEN 'SEATED' THEN v_evt := 'RESERVATION_SEATED';
            WHEN 'COMPLETED' THEN v_evt := 'RESERVATION_COMPLETED';
            WHEN 'CANCELLED' THEN v_evt := 'RESERVATION_CANCELLED';
            WHEN 'REJECTED' THEN v_evt := 'RESERVATION_REJECTED';
            WHEN 'NO_SHOW' THEN v_evt := 'RESERVATION_NO_SHOW';
            ELSE v_evt := NULL;
        END CASE;
    END IF;

    IF v_evt IS NOT NULL THEN
        -- Atomic outbox emission: business state mutation + outbox event commit in the SAME transaction
        PERFORM public.emit_notification_event(
            p_event_type := v_evt,
            p_aggregate_type := 'RESERVATION',
            p_aggregate_id := NEW.id,
            p_payload := jsonb_build_object(
                'reservation_id', NEW.id,
                'user_id', NEW.user_id,
                'restaurant_id', NEW.restaurant_id,
                'party_size', NEW.party_size,
                'reservation_date', NEW.reservation_date,
                'reservation_time', NEW.reservation_time,
                'status', NEW.status
            ),
            p_priority := 'HIGH'::notification_priority_enum,
            p_communication_class := 'TRANSACTIONAL'::communication_class_enum
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_notification_event ON public.reservations;
CREATE TRIGGER trg_reservations_notification_event
    AFTER INSERT OR UPDATE OF status ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_emit_reservation_notification_event();

-- Trigger function for Review Responses
CREATE OR REPLACE FUNCTION public.trg_emit_review_response_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.body IS DISTINCT FROM NEW.body) THEN
        -- Atomic outbox emission: business state mutation + outbox event commit in the SAME transaction
        PERFORM public.emit_notification_event(
            p_event_type := 'REVIEW_RESPONSE_PUBLISHED',
            p_aggregate_type := 'REVIEW',
            p_aggregate_id := NEW.review_id,
            p_payload := jsonb_build_object(
                'review_id', NEW.review_id,
                'restaurant_id', NEW.restaurant_id,
                'response_id', NEW.id
            ),
            p_priority := 'NORMAL'::notification_priority_enum,
            p_communication_class := 'SOCIAL'::communication_class_enum
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_response_notification_event ON public.review_responses;
CREATE TRIGGER trg_reviews_response_notification_event
    AFTER INSERT OR UPDATE OF body ON public.review_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_emit_review_response_notification_event();

-- ----------------------------------------------------------------------------
-- 11. CANONICAL BILINGUAL TEMPLATES SEED
-- ----------------------------------------------------------------------------

-- Orders: In-App, Push & SMS
INSERT INTO public.notification_templates (event_type, channel, locale, title_template, body_template, allowlisted_keys)
VALUES
-- In-App (Swahili)
('ORDER_CREATED', 'IN_APP', 'sw', 'Oda Imepokelewa: #{{order_number}}', 'Oda yako imepokelewa na mgahawa na inasubiri kuthibitishwa.', ARRAY['order_number']),
('ORDER_ACCEPTED', 'IN_APP', 'sw', 'Oda Imethibitishwa: #{{order_number}}', 'Mgahawa umethibitisha oda yako na maandalizi yataanza hivi punde.', ARRAY['order_number']),
('ORDER_PREPARING', 'IN_APP', 'sw', 'Oda Yako Inaandaliwa: #{{order_number}}', 'Wapishi wameanza kuandaa mlo wako safi jikoni.', ARRAY['order_number']),
('ORDER_READY', 'IN_APP', 'sw', 'Mlo Wako Uko Tayari: #{{order_number}}', 'Mlo wako tayari umekamilika na uko tayari kwa uchukuzi au uwasilishaji!', ARRAY['order_number']),
('ORDER_COMPLETED', 'IN_APP', 'sw', 'Oda Imekamilika: #{{order_number}}', 'Asante kwa kuchagua MloHub! Tunatumai umefurahia mlo wako.', ARRAY['order_number']),
('ORDER_CANCELLED', 'IN_APP', 'sw', 'Oda Imeghairiwa: #{{order_number}}', 'Oda yako #{{order_number}} imeghairiwa. Tafadhali angalia maelezo zaidi kwenye programu.', ARRAY['order_number']),

-- In-App (English)
('ORDER_CREATED', 'IN_APP', 'en', 'Order Received: #{{order_number}}', 'Your order has been received by the restaurant and is pending confirmation.', ARRAY['order_number']),
('ORDER_ACCEPTED', 'IN_APP', 'en', 'Order Confirmed: #{{order_number}}', 'The restaurant has confirmed your order and preparation will begin shortly.', ARRAY['order_number']),
('ORDER_PREPARING', 'IN_APP', 'en', 'Order In Preparation: #{{order_number}}', 'The kitchen has started preparing your fresh meal.', ARRAY['order_number']),
('ORDER_READY', 'IN_APP', 'en', 'Meal Ready: #{{order_number}}', 'Your meal is ready for pickup or delivery!', ARRAY['order_number']),
('ORDER_COMPLETED', 'IN_APP', 'en', 'Order Completed: #{{order_number}}', 'Thank you for dining with MloHub! We hope you enjoyed your meal.', ARRAY['order_number']),
('ORDER_CANCELLED', 'IN_APP', 'en', 'Order Cancelled: #{{order_number}}', 'Your order #{{order_number}} has been cancelled. Please check the app for details.', ARRAY['order_number']),

-- Push (Swahili)
('ORDER_CREATED', 'PUSH', 'sw', 'Oda Imepokelewa #{{order_number}}', 'Oda yako imepokelewa vizuri na MloHub.', ARRAY['order_number']),
('ORDER_READY', 'PUSH', 'sw', 'Mlo Tayari! #{{order_number}}', 'Mlo wako tayari umekamilika. Uko tayari kuchukuliwa!', ARRAY['order_number']),

-- Push (English)
('ORDER_CREATED', 'PUSH', 'en', 'Order Received #{{order_number}}', 'Your order has been successfully placed with MloHub.', ARRAY['order_number']),
('ORDER_READY', 'PUSH', 'en', 'Meal Ready! #{{order_number}}', 'Your meal is hot and ready for pickup or dispatch!', ARRAY['order_number']),

-- SMS (Swahili)
('ORDER_READY', 'SMS', 'sw', 'MloHub: Mlo wako wa oda #{{order_number}} uko tayari sasa. Karibu!', 'MloHub: Mlo wako wa oda #{{order_number}} uko tayari sasa. Karibu!', ARRAY['order_number']),
('ORDER_READY', 'SMS', 'en', 'MloHub: Your order #{{order_number}} is ready. Enjoy your meal!', 'MloHub: Your order #{{order_number}} is ready. Enjoy your meal!', ARRAY['order_number']),

-- Reservations: In-App, Push & SMS
('RESERVATION_CONFIRMED', 'IN_APP', 'sw', 'Meza Imethibitishwa', 'Nafasi yako ya meza kwa watu {{party_size}} tarehe {{reservation_date}} saa {{reservation_time}} imethibitishwa.', ARRAY['party_size', 'reservation_date', 'reservation_time']),
('RESERVATION_CONFIRMED', 'IN_APP', 'en', 'Table Reservation Confirmed', 'Your table for {{party_size}} guests on {{reservation_date}} at {{reservation_time}} is confirmed.', ARRAY['party_size', 'reservation_date', 'reservation_time']),
('RESERVATION_CONFIRMED', 'PUSH', 'sw', 'Meza Imethibitishwa!', 'Uhifadhi wako wa meza kwa watu {{party_size}} umethibitishwa na mgahawa.', ARRAY['party_size']),
('RESERVATION_CONFIRMED', 'PUSH', 'en', 'Table Confirmed!', 'Your table reservation for {{party_size}} guests is confirmed.', ARRAY['party_size']),
('RESERVATION_REMINDER', 'SMS', 'sw', 'MloHub Ukumbusho: Una nafasi ya meza leo saa {{reservation_time}}. Tunakusubiri!', 'MloHub Ukumbusho: Una nafasi ya meza leo saa {{reservation_time}}. Tunakusubiri!', ARRAY['reservation_time']),
('RESERVATION_REMINDER', 'SMS', 'en', 'MloHub Reminder: You have a table reserved today at {{reservation_time}}. See you soon!', 'MloHub Reminder: You have a table reserved today at {{reservation_time}}. See you soon!', ARRAY['reservation_time']),

-- Custom Meals
('CUSTOM_MEAL_CREATED', 'IN_APP', 'sw', 'Ombi la Mlo Maalum Limetumwa', 'Ombi lako la mlo maalum "{{dish_name}}" limetumwa kwa migahawa inayolingana.', ARRAY['dish_name']),
('CUSTOM_MEAL_CREATED', 'IN_APP', 'en', 'Custom Meal Request Submitted', 'Your request for "{{dish_name}}" has been sent to matching culinary partners.', ARRAY['dish_name']),
('CUSTOM_MEAL_QUOTE_RECEIVED', 'IN_APP', 'sw', 'Ofa Mpya ya Mlo Maalum', 'Mgahawa umekupa ofa ya TZS {{quote_amount}} kwa mlo wako wa "{{dish_name}}".', ARRAY['quote_amount', 'dish_name']),
('CUSTOM_MEAL_QUOTE_RECEIVED', 'IN_APP', 'en', 'New Custom Meal Quote', 'A restaurant quoted TZS {{quote_amount}} for your custom dish "{{dish_name}}".', ARRAY['quote_amount', 'dish_name']),

-- Reviews
('REVIEW_RESPONSE_PUBLISHED', 'IN_APP', 'sw', 'Jibu Kutoka Mgahawani', 'Mgahawa ulijibu tathmini yako. Gusa kusoma jibu lao.', ARRAY['restaurant_name']),
('REVIEW_RESPONSE_PUBLISHED', 'IN_APP', 'en', 'Restaurant Responded to Your Review', 'The restaurant replied to your feedback. Tap to view their message.', ARRAY['restaurant_name'])
,
('STAFF_INVITATION', 'IN_APP', 'sw', 'Mwaliko wa Timu ya Mgahawa', 'Umealikwa kujiunga na timu ya {{restaurant_name}} kama {{role}}.', ARRAY['restaurant_name', 'role']),
('STAFF_INVITATION', 'IN_APP', 'en', 'Restaurant Team Invitation', 'You have been invited to join {{restaurant_name}} as {{role}}.', ARRAY['restaurant_name', 'role']),
('STAFF_INVITATION', 'SMS', 'en', 'MloHub invitation: join {{restaurant_name}} as {{role}}. Use the secure invitation link sent to your email.', ARRAY['restaurant_name', 'role'])

ON CONFLICT (event_type, channel, locale) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    allowlisted_keys = EXCLUDED.allowlisted_keys,
    is_active = true,
    version = public.notification_templates.version + 1;

-- ----------------------------------------------------------------------------
-- 12. REALTIME PUBLICATION REFRESH
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_deliveries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
