-- =============================================================================
-- MloHub Forward Migration: 20260923000003_admin_governance_operations.sql
-- Restaurant Archiving, Worker Heartbeats, Real User Suspension & Attention Center
-- =============================================================================

-- 1. Restaurant Archiving Columns (Non-Destructive Governance)
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS archive_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_demo_data BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_restaurants_archived_at ON public.restaurants(archived_at);

-- 2. Secure Restaurant Archiving RPC (Replaces physical DELETE)
CREATE OR REPLACE FUNCTION public.archive_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_archive_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rest_name TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required to archive restaurants.';
    END IF;

    IF length(trim(COALESCE(p_archive_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: An archive reason of at least 4 characters is required.';
    END IF;

    SELECT name INTO v_rest_name FROM public.restaurants WHERE id = p_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % does not exist.', p_restaurant_id;
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Update restaurant to archived status, closed and delisted
    UPDATE public.restaurants
    SET
        archived_at = clock_timestamp(),
        archived_by = v_actor,
        archive_reason = trim(p_archive_reason),
        is_open = FALSE,
        is_published = FALSE,
        verification_status = 'SUSPENDED',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    -- Deactivate associated branches
    UPDATE public.restaurant_branches
    SET is_active = FALSE, updated_at = clock_timestamp()
    WHERE restaurant_id = p_restaurant_id;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'ARCHIVE_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'restaurant_name', v_rest_name,
            'reason', p_archive_reason,
            'archived_at', clock_timestamp()
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'archived_at', clock_timestamp()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_restaurant_secure(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- 3. Secure Restaurant Unarchiving / Reinstatement RPC
CREATE OR REPLACE FUNCTION public.unarchive_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT DEFAULT 'Reinstated by platform administrator'
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
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    UPDATE public.restaurants
    SET
        archived_at = NULL,
        archived_by = NULL,
        archive_reason = NULL,
        verification_status = 'PENDING_VERIFICATION',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'UNARCHIVE_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object('reason', p_reason),
        clock_timestamp()
    );

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.unarchive_restaurant_secure(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unarchive_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- 4. Worker Heartbeats Table for System Health Surveillance
CREATE TABLE IF NOT EXISTS public.system_worker_heartbeats (
    worker_name VARCHAR(100) PRIMARY KEY,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
    details JSONB DEFAULT '{}'::jsonb,
    error_count_last_hour INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.system_worker_heartbeats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.system_worker_heartbeats FROM PUBLIC, anon, authenticated;

CREATE POLICY "Admins can view worker heartbeats"
    ON public.system_worker_heartbeats
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.system_worker_heartbeats TO authenticated;
GRANT ALL ON public.system_worker_heartbeats TO service_role;

-- Seed default heartbeats for known background workers
INSERT INTO public.system_worker_heartbeats (worker_name, status, details)
VALUES
    ('process-notification-outbox', 'HEALTHY', '{"initialized": true}'::jsonb),
    ('reconcile-payments', 'HEALTHY', '{"initialized": true}'::jsonb)
ON CONFLICT (worker_name) DO NOTHING;

-- 5. Secure User Profile Suspension RPC (Real Account Governance)
CREATE OR REPLACE FUNCTION public.suspend_user_profile_secure(
    p_user_id UUID,
    p_should_suspend BOOLEAN,
    p_reason TEXT DEFAULT 'Terms of service review'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_target_role TEXT;
    v_new_status TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: User profile % not found.', p_user_id;
    END IF;

    IF v_target_role IN ('ADMIN', 'SUPER_ADMIN') AND NOT public.is_super_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Only SUPER_ADMIN can suspend platform administrators.';
    END IF;

    v_new_status := CASE WHEN p_should_suspend THEN 'SUSPENDED' ELSE 'ACTIVE' END;

    UPDATE public.profiles
    SET
        status = v_new_status,
        updated_at = clock_timestamp()
    WHERE id = p_user_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        CASE WHEN p_should_suspend THEN 'SUSPEND_USER' ELSE 'REACTIVATE_USER' END,
        'USER',
        p_user_id::text,
        jsonb_build_object('reason', p_reason, 'status', v_new_status),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', p_user_id,
        'status', v_new_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_user_profile_secure(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_user_profile_secure(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- 6. Truthful Server-Side Attention Summary RPC
CREATE OR REPLACE FUNCTION public.get_admin_attention_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_pending_apps INTEGER := 0;
    v_open_reports INTEGER := 0;
    v_suspended_rests INTEGER := 0;
    v_unverified_rests INTEGER := 0;
    v_stuck_orders INTEGER := 0;
    v_stuck_payments INTEGER := 0;
    v_pending_refunds INTEGER := 0;
    v_dead_letter_notifs INTEGER := 0;
    v_degraded_workers INTEGER := 0;

    v_critical JSONB := '[]'::jsonb;
    v_warning JSONB := '[]'::jsonb;
    v_info JSONB := '[]'::jsonb;
    v_is_optimal BOOLEAN := TRUE;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- 1. Pending Applications
    BEGIN
        SELECT COUNT(*) INTO v_pending_apps
        FROM public.restaurant_applications
        WHERE status = 'PENDING';
    EXCEPTION WHEN undefined_table THEN v_pending_apps := 0;
    END;

    -- 2. Open Customer Reports
    BEGIN
        SELECT COUNT(*) INTO v_open_reports
        FROM public.customer_discrepancy_reports
        WHERE status = 'OPEN';
    EXCEPTION WHEN undefined_table THEN
        BEGIN
            SELECT COUNT(*) INTO v_open_reports
            FROM public.data_reports
            WHERE status = 'OPEN';
        EXCEPTION WHEN undefined_table THEN v_open_reports := 0;
        END;
    END;

    -- 3. Suspended & Unverified Restaurants
    BEGIN
        SELECT
            COUNT(*) FILTER (WHERE verification_status = 'SUSPENDED' OR archived_at IS NOT NULL),
            COUNT(*) FILTER (WHERE verification_status = 'PENDING_VERIFICATION' AND archived_at IS NULL)
        INTO v_suspended_rests, v_unverified_rests
        FROM public.restaurants;
    EXCEPTION WHEN undefined_table THEN
        v_suspended_rests := 0;
        v_unverified_rests := 0;
    END;

    -- 4. Stuck Orders (PENDING > 15m or PREPARING > 60m)
    BEGIN
        SELECT COUNT(*) INTO v_stuck_orders
        FROM public.orders
        WHERE (status = 'PENDING' AND created_at < clock_timestamp() - INTERVAL '15 minutes')
           OR (status = 'PREPARING' AND updated_at < clock_timestamp() - INTERVAL '60 minutes');
    EXCEPTION WHEN undefined_table THEN v_stuck_orders := 0;
    END;

    -- 5. Stuck Payments (PENDING/PROCESSING > 15m)
    BEGIN
        SELECT COUNT(*) INTO v_stuck_payments
        FROM public.payments
        WHERE status IN ('PENDING', 'PROCESSING')
          AND created_at < clock_timestamp() - INTERVAL '15 minutes';
    EXCEPTION WHEN undefined_table THEN v_stuck_payments := 0;
    END;

    -- 6. Pending Refund Requests
    BEGIN
        SELECT COUNT(*) INTO v_pending_refunds
        FROM public.refund_requests
        WHERE status IN ('REQUESTED', 'PENDING');
    EXCEPTION WHEN undefined_table THEN v_pending_refunds := 0;
    END;

    -- 7. Dead Letter Notifications
    BEGIN
        SELECT COUNT(*) INTO v_dead_letter_notifs
        FROM public.notification_event_outbox
        WHERE status = 'DEAD_LETTER' OR (status = 'FAILED' AND retry_count >= 5);
    EXCEPTION WHEN undefined_table THEN v_dead_letter_notifs := 0;
    END;

    -- 8. Degraded / Stale Worker Heartbeats
    BEGIN
        SELECT COUNT(*) INTO v_degraded_workers
        FROM public.system_worker_heartbeats
        WHERE status <> 'HEALTHY'
           OR last_heartbeat < clock_timestamp() - INTERVAL '15 minutes';
    EXCEPTION WHEN undefined_table THEN v_degraded_workers := 0;
    END;

    -- Assemble Critical Queue Items
    IF v_dead_letter_notifs > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_notif_dead_letter',
            'severity', 'CRITICAL',
            'title', v_dead_letter_notifs || ' Dead-Letter Notification(s)',
            'description', 'Events exceeded retry ceiling in notification outbox. Requires inspection.',
            'targetTab', 'NOTIFICATIONS',
            'count', v_dead_letter_notifs
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_degraded_workers > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_worker_degraded',
            'severity', 'CRITICAL',
            'title', v_degraded_workers || ' Background Worker(s) Degraded',
            'description', 'Heartbeats stale or reporting failure states in edge functions.',
            'targetTab', 'HEALTH',
            'count', v_degraded_workers
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_suspended_rests > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_suspended_spots',
            'severity', 'CRITICAL',
            'title', v_suspended_rests || ' Suspended / Delisted Restaurant(s)',
            'description', 'Spots under compliance embargo or delisted for administrative review.',
            'targetTab', 'RESTAURANTS',
            'count', v_suspended_rests
        );
        v_is_optimal := FALSE;
    END IF;

    -- Assemble Warning Items
    IF v_stuck_payments > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_stuck_payments',
            'severity', 'HIGH',
            'title', v_stuck_payments || ' Unreconciled Payment(s) Stale',
            'description', 'Mobile money payments pending > 15 minutes awaiting provider reconciliation.',
            'targetTab', 'PAYMENTS',
            'count', v_stuck_payments
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_pending_refunds > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_pending_refunds',
            'severity', 'HIGH',
            'title', v_pending_refunds || ' Refund Request(s) Needing Action',
            'description', 'Customer refund claims awaiting administrator review and authorization.',
            'targetTab', 'REFUNDS',
            'count', v_pending_refunds
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_stuck_orders > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_stuck_orders',
            'severity', 'HIGH',
            'title', v_stuck_orders || ' Stalled Kitchen Order(s)',
            'description', 'Orders awaiting kitchen acceptance or exceeded prep quote.',
            'targetTab', 'ORDERS',
            'count', v_stuck_orders
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_open_reports > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_open_reports',
            'severity', 'MEDIUM',
            'title', v_open_reports || ' Open Discrepancy Report(s)',
            'description', 'Customers flagged catalog inaccuracies or missing menu dishes.',
            'targetTab', 'REPORTS',
            'count', v_open_reports
        );
        v_is_optimal := FALSE;
    END IF;

    -- Assemble Info Items
    IF v_pending_apps > 0 THEN
        v_info := v_info || jsonb_build_object(
            'id', 'info_pending_apps',
            'severity', 'INFO',
            'title', v_pending_apps || ' Vendor Application(s) Pending',
            'description', 'New restaurant registrations awaiting compliance credential audit.',
            'targetTab', 'APPLICATIONS',
            'count', v_pending_apps
        );
    END IF;

    IF v_unverified_rests > 0 THEN
        v_info := v_info || jsonb_build_object(
            'id', 'info_unverified_rests',
            'severity', 'INFO',
            'title', v_unverified_rests || ' Unverified Restaurant Spot(s)',
            'description', 'Spots without verified business license or active catalog items.',
            'targetTab', 'VERIFICATION',
            'count', v_unverified_rests
        );
    END IF;

    RETURN jsonb_build_object(
        'is_optimal', v_is_optimal,
        'critical_count', jsonb_array_length(v_critical),
        'warning_count', jsonb_array_length(v_warning),
        'info_count', jsonb_array_length(v_info),
        'critical', v_critical,
        'warning', v_warning,
        'info', v_info,
        'metrics', jsonb_build_object(
            'pending_applications', v_pending_apps,
            'open_reports', v_open_reports,
            'suspended_restaurants', v_suspended_rests,
            'unverified_restaurants', v_unverified_rests,
            'stuck_orders', v_stuck_orders,
            'stuck_payments', v_stuck_payments,
            'pending_refunds', v_pending_refunds,
            'dead_letter_notifications', v_dead_letter_notifs,
            'degraded_workers', v_degraded_workers
        ),
        'checked_at', clock_timestamp()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_attention_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_attention_summary() TO authenticated, service_role;
