-- =============================================================================
-- MloHub Forward Migration: 20260923000002_admin_announcements_and_intelligence.sql
-- Platform Announcements Delivery Architecture + Search Demand Intelligence
-- =============================================================================

-- 1. Extend Platform Announcements Table with Scheduling and Actionable CTAs
ALTER TABLE public.platform_announcements
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cta_label VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cta_url VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_window
    ON public.platform_announcements(is_active, starts_at, expires_at);

-- 2. Platform Announcement Receipts Table (Tracks Read & Dismiss States)
CREATE TABLE IF NOT EXISTS public.platform_announcement_receipts (
    announcement_id UUID NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_receipts_user
    ON public.platform_announcement_receipts(user_id);

-- RLS for receipts
ALTER TABLE public.platform_announcement_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_announcement_receipts FROM PUBLIC, anon;

-- Users can manage their own receipts
CREATE POLICY "Users can manage own announcement receipts"
    ON public.platform_announcement_receipts
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Administrators can read aggregate metrics
CREATE POLICY "Admins can view all announcement receipts"
    ON public.platform_announcement_receipts
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.platform_announcement_receipts TO authenticated;
GRANT ALL ON public.platform_announcement_receipts TO service_role;

-- 3. Publish Announcement Secure RPC (ADMIN / SUPER_ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.publish_platform_announcement_secure(
    p_title_en TEXT,
    p_title_sw TEXT,
    p_body_en TEXT,
    p_body_sw TEXT,
    p_target_audience VARCHAR(30) DEFAULT 'ALL',
    p_priority VARCHAR(20) DEFAULT 'NORMAL',
    p_starts_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_cta_label VARCHAR(100) DEFAULT NULL,
    p_cta_url VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_announcement_id UUID;
    v_actor_name TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required to publish announcements.';
    END IF;

    IF length(trim(COALESCE(p_title_en, ''))) < 3 THEN
        RAISE EXCEPTION '400 Bad Request: Announcement title must be at least 3 characters.';
    END IF;

    IF length(trim(COALESCE(p_body_en, ''))) < 5 THEN
        RAISE EXCEPTION '400 Bad Request: Announcement body must be at least 5 characters.';
    END IF;

    IF p_target_audience NOT IN ('ALL', 'CUSTOMERS', 'RESTAURANTS', 'ADMINS') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid target audience %.', p_target_audience;
    END IF;

    IF p_priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid priority %.', p_priority;
    END IF;

    IF p_expires_at IS NOT NULL AND p_expires_at <= COALESCE(p_starts_at, clock_timestamp()) THEN
        RAISE EXCEPTION '400 Bad Request: Expiration time must be after the start time.';
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Insert announcement row
    INSERT INTO public.platform_announcements (
        title_en, title_sw, body_en, body_sw,
        target_audience, priority, starts_at, expires_at,
        cta_label, cta_url, sent_at, is_active, created_by
    ) VALUES (
        trim(p_title_en), trim(p_title_sw), trim(p_body_en), trim(p_body_sw),
        p_target_audience, p_priority, COALESCE(p_starts_at, clock_timestamp()), p_expires_at,
        trim(p_cta_label), trim(p_cta_url), clock_timestamp(), TRUE, v_actor
    ) RETURNING id INTO v_announcement_id;

    -- Emit notification event to outbox for distribution
    BEGIN
        INSERT INTO public.notification_event_outbox (
            event_type,
            aggregate_type,
            aggregate_id,
            payload,
            status,
            idempotency_key
        ) VALUES (
            'SYSTEM_ANNOUNCEMENT',
            'ANNOUNCEMENT',
            v_announcement_id::text,
            jsonb_build_object(
                'announcement_id', v_announcement_id,
                'target_audience', p_target_audience,
                'priority', p_priority,
                'title_en', p_title_en,
                'title_sw', p_title_sw,
                'body_en', p_body_en,
                'body_sw', p_body_sw,
                'cta_label', p_cta_label,
                'cta_url', p_cta_url
            ),
            'PENDING',
            'announcement_publish_' || v_announcement_id::text
        );
    EXCEPTION WHEN undefined_table THEN
        -- If notification_event_outbox does not exist in testing, proceed cleanly
        NULL;
    END;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'PUBLISH_PLATFORM_ANNOUNCEMENT',
        'ANNOUNCEMENT',
        v_announcement_id::text,
        jsonb_build_object(
            'title', p_title_en,
            'audience', p_target_audience,
            'priority', p_priority,
            'starts_at', p_starts_at,
            'expires_at', p_expires_at
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'announcement_id', v_announcement_id,
        'target_audience', p_target_audience,
        'priority', p_priority,
        'starts_at', COALESCE(p_starts_at, clock_timestamp()),
        'expires_at', p_expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) TO authenticated, service_role;

-- 4. Deactivate Announcement Secure RPC
CREATE OR REPLACE FUNCTION public.deactivate_platform_announcement_secure(
    p_announcement_id UUID,
    p_reason TEXT DEFAULT 'Administrative deactivation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    UPDATE public.platform_announcements
    SET
        is_active = FALSE,
        updated_at = clock_timestamp()
    WHERE id = p_announcement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Announcement % not found.', p_announcement_id;
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'DEACTIVATE_PLATFORM_ANNOUNCEMENT',
        'ANNOUNCEMENT',
        p_announcement_id::text,
        jsonb_build_object('reason', p_reason),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'announcement_id', p_announcement_id,
        'is_active', FALSE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_platform_announcement_secure(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_platform_announcement_secure(UUID, TEXT) TO authenticated, service_role;

-- 5. Admin Announcements History & Telemetry RPC
CREATE OR REPLACE FUNCTION public.get_admin_announcements_history()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT jsonb_agg(ann_row) INTO v_result
    FROM (
        SELECT
            pa.id,
            pa.title_en,
            pa.title_sw,
            pa.body_en,
            pa.body_sw,
            pa.target_audience,
            pa.priority,
            pa.starts_at,
            pa.expires_at,
            pa.sent_at,
            pa.is_active,
            pa.cta_label,
            pa.cta_url,
            pa.created_at,
            pa.created_by,
            p.full_name AS created_by_name,
            CASE
                WHEN pa.is_active = FALSE THEN 'DISABLED'
                WHEN pa.expires_at IS NOT NULL AND pa.expires_at < clock_timestamp() THEN 'EXPIRED'
                WHEN pa.starts_at > clock_timestamp() THEN 'SCHEDULED'
                ELSE 'LIVE'
            END AS calculated_status,
            COALESCE(r.read_count, 0) AS read_count,
            COALESCE(r.dismissed_count, 0) AS dismissed_count
        FROM public.platform_announcements pa
        LEFT JOIN public.profiles p ON p.id = pa.created_by
        LEFT JOIN (
            SELECT
                announcement_id,
                COUNT(read_at) AS read_count,
                COUNT(dismissed_at) AS dismissed_count
            FROM public.platform_announcement_receipts
            GROUP BY announcement_id
        ) r ON r.announcement_id = pa.id
        ORDER BY pa.created_at DESC
        LIMIT 50
    ) ann_row;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_announcements_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_announcements_history() TO authenticated, service_role;

-- 6. Server-Side Aggregation for Search & Demand (ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.get_admin_search_demand_metrics(
    p_from TIMESTAMPTZ DEFAULT (clock_timestamp() - INTERVAL '30 days'),
    p_to TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_total_searches BIGINT := 0;
    v_zero_result_searches BIGINT := 0;
    v_success_rate NUMERIC;
    v_zero_result_rate NUMERIC;
    v_top_queries JSONB := '[]'::jsonb;
    v_supply_gaps JSONB := '[]'::jsonb;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- Count total searches
    BEGIN
        SELECT COUNT(*) INTO v_total_searches
        FROM public.search_analytics_events
        WHERE created_at >= p_from AND created_at <= p_to;
    EXCEPTION WHEN undefined_table THEN
        v_total_searches := 0;
    END;

    -- Count zero result searches
    BEGIN
        SELECT COUNT(*) INTO v_zero_result_searches
        FROM public.zero_result_events
        WHERE created_at >= p_from AND created_at <= p_to;
    EXCEPTION WHEN undefined_table THEN
        BEGIN
            SELECT COUNT(*) INTO v_zero_result_searches
            FROM public.search_analytics_events
            WHERE created_at >= p_from AND created_at <= p_to AND is_zero_result = TRUE;
        EXCEPTION WHEN undefined_table THEN
            v_zero_result_searches := 0;
        END;
    END;

    -- Truthful calculation: if 0 searches, return NULL (not 100%)
    IF v_total_searches = 0 THEN
        v_success_rate := NULL;
        v_zero_result_rate := NULL;
    ELSE
        v_zero_result_rate := ROUND((v_zero_result_searches::numeric / v_total_searches::numeric) * 100, 1);
        v_success_rate := 100.0 - v_zero_result_rate;
    END IF;

    -- Top 8 Queries
    BEGIN
        SELECT jsonb_agg(q_row) INTO v_top_queries
        FROM (
            SELECT
                LOWER(TRIM(query)) AS query,
                COUNT(*) AS count
            FROM public.search_analytics_events
            WHERE created_at >= p_from AND created_at <= p_to
              AND query IS NOT NULL AND TRIM(query) <> ''
            GROUP BY LOWER(TRIM(query))
            ORDER BY count DESC
            LIMIT 8
        ) q_row;
    EXCEPTION WHEN OTHERS THEN
        v_top_queries := '[]'::jsonb;
    END;

    -- Top 6 Supply Gaps by Ward
    BEGIN
        SELECT jsonb_agg(g_row) INTO v_supply_gaps
        FROM (
            SELECT
                COALESCE(ward_name, 'Unknown Area') AS ward_name,
                LOWER(TRIM(query)) AS query,
                COUNT(*) AS count
            FROM public.zero_result_events
            WHERE created_at >= p_from AND created_at <= p_to
              AND query IS NOT NULL AND TRIM(query) <> ''
            GROUP BY COALESCE(ward_name, 'Unknown Area'), LOWER(TRIM(query))
            ORDER BY count DESC
            LIMIT 6
        ) g_row;
    EXCEPTION WHEN OTHERS THEN
        v_supply_gaps := '[]'::jsonb;
    END;

    RETURN jsonb_build_object(
        'total_searches', v_total_searches,
        'zero_result_searches', v_zero_result_searches,
        'success_rate', v_success_rate,
        'zero_result_rate', v_zero_result_rate,
        'top_queries', COALESCE(v_top_queries, '[]'::jsonb),
        'supply_gaps', COALESCE(v_supply_gaps, '[]'::jsonb),
        'period_from', p_from,
        'period_to', p_to
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_search_demand_metrics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_search_demand_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
