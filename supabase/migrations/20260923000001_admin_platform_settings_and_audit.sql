-- =============================================================================
-- MloHub Forward Migration: 20260923000001_admin_platform_settings_and_audit.sql
-- Administrative Financial & Operational Settings Authority + Audit Immutability
-- =============================================================================

-- 1. Helper: Check if user has SUPER_ADMIN platform role
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id AND (role = 'SUPER_ADMIN' OR 'SUPER_ADMIN' = ANY(roles))
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

-- 2. Platform Financial Settings Singleton Table
CREATE TABLE IF NOT EXISTS public.platform_financial_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
    currency VARCHAR(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
    customer_service_fee_tzs INTEGER NOT NULL DEFAULT 1500 CHECK (customer_service_fee_tzs >= 0),
    minimum_order_value_tzs INTEGER NOT NULL DEFAULT 2000 CHECK (minimum_order_value_tzs >= 0),
    default_commission_basis_points INTEGER NOT NULL DEFAULT 1000 CHECK (default_commission_basis_points >= 0 AND default_commission_basis_points <= 10000),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    change_reason TEXT NOT NULL DEFAULT 'Initial configuration'
);

-- Seed Singleton Row
INSERT INTO public.platform_financial_settings (
    id, currency, customer_service_fee_tzs, minimum_order_value_tzs, default_commission_basis_points, change_reason
) VALUES (
    TRUE, 'TZS', 1500, 2000, 1000, 'Initial configuration'
) ON CONFLICT (id) DO NOTHING;

-- 3. Platform Financial Settings History Table
CREATE TABLE IF NOT EXISTS public.platform_financial_settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    previous_service_fee_tzs INTEGER NOT NULL,
    new_service_fee_tzs INTEGER NOT NULL,
    previous_minimum_order_tzs INTEGER NOT NULL,
    new_minimum_order_tzs INTEGER NOT NULL,
    previous_commission_bps INTEGER NOT NULL,
    new_commission_bps INTEGER NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    change_reason TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_fin_settings_hist_date ON public.platform_financial_settings_history(changed_at DESC);

-- 4. Platform Operational Settings Singleton Table
CREATE TABLE IF NOT EXISTS public.platform_operational_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
    fresh_days INTEGER NOT NULL DEFAULT 7 CHECK (fresh_days > 0),
    recent_days INTEGER NOT NULL DEFAULT 14 CHECK (recent_days > fresh_days),
    stale_days INTEGER NOT NULL DEFAULT 30 CHECK (stale_days > recent_days),
    support_phone VARCHAR(30) NOT NULL DEFAULT '+255 700 000 000',
    support_email VARCHAR(100) NOT NULL DEFAULT 'support@mlohub.co.tz',
    support_hours VARCHAR(100) NOT NULL DEFAULT '07:00 AM - 11:00 PM EAT',
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    restaurant_applications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    customer_registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    change_reason TEXT NOT NULL DEFAULT 'Initial operational configuration'
);

-- Seed Operational Singleton Row
INSERT INTO public.platform_operational_settings (
    id, fresh_days, recent_days, stale_days, support_phone, support_email, support_hours,
    maintenance_mode, restaurant_applications_enabled, customer_registration_enabled, change_reason
) VALUES (
    TRUE, 7, 14, 30, '+255 700 000 000', 'support@mlohub.co.tz', '07:00 AM - 11:00 PM EAT',
    FALSE, TRUE, TRUE, 'Initial operational configuration'
) ON CONFLICT (id) DO NOTHING;

-- 5. RLS & Permissions for Settings Tables
ALTER TABLE public.platform_financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_financial_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_operational_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_financial_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_financial_settings_history FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_operational_settings FROM PUBLIC, anon, authenticated;

-- Allow authenticated admins to read settings & history
CREATE POLICY "Admins can read financial settings" ON public.platform_financial_settings
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read financial settings history" ON public.platform_financial_settings_history
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read operational settings" ON public.platform_operational_settings
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.platform_financial_settings TO authenticated, service_role;
GRANT SELECT ON public.platform_financial_settings_history TO authenticated, service_role;
GRANT SELECT ON public.platform_operational_settings TO authenticated, service_role;
GRANT ALL ON public.platform_financial_settings TO service_role;
GRANT ALL ON public.platform_financial_settings_history TO service_role;
GRANT ALL ON public.platform_operational_settings TO service_role;

-- 6. Secure Financial Settings Update RPC (SUPER_ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.update_platform_financial_settings_secure(
    p_service_fee_tzs INTEGER,
    p_minimum_order_tzs INTEGER,
    p_default_commission_bps INTEGER,
    p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old RECORD;
    v_new RECORD;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    -- Strict authorization: SUPER_ADMIN platform role required for financial policy mutations
    IF NOT public.is_super_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN role required to modify platform financial settings.';
    END IF;

    IF length(trim(COALESCE(p_change_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: A descriptive change reason (minimum 4 characters) is required.';
    END IF;

    IF p_service_fee_tzs < 0 OR p_minimum_order_tzs < 0 OR p_default_commission_bps < 0 OR p_default_commission_bps > 10000 THEN
        RAISE EXCEPTION '400 Bad Request: Financial parameters out of valid operational range.';
    END IF;

    -- Lock singleton row
    SELECT * INTO v_old
    FROM public.platform_financial_settings
    WHERE id = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '500 Internal Error: Platform financial settings singleton row not found.';
    END IF;

    -- Record in history
    INSERT INTO public.platform_financial_settings_history (
        previous_service_fee_tzs, new_service_fee_tzs,
        previous_minimum_order_tzs, new_minimum_order_tzs,
        previous_commission_bps, new_commission_bps,
        changed_by, change_reason, changed_at
    ) VALUES (
        v_old.customer_service_fee_tzs, p_service_fee_tzs,
        v_old.minimum_order_value_tzs, p_minimum_order_tzs,
        v_old.default_commission_basis_points, p_default_commission_bps,
        v_actor, p_change_reason, clock_timestamp()
    );

    -- Update singleton settings
    UPDATE public.platform_financial_settings
    SET
        customer_service_fee_tzs = p_service_fee_tzs,
        minimum_order_value_tzs = p_minimum_order_tzs,
        default_commission_basis_points = p_default_commission_bps,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        change_reason = p_change_reason
    WHERE id = TRUE
    RETURNING * INTO v_new;

    -- Atomic audit log insertion (same transaction)
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor), 'Super Admin'),
        'UPDATE_PLATFORM_FINANCIAL_SETTINGS',
        'PLATFORM_SETTINGS',
        'FINANCIAL',
        jsonb_build_object(
            'previous_service_fee_tzs', v_old.customer_service_fee_tzs,
            'new_service_fee_tzs', p_service_fee_tzs,
            'previous_minimum_order_tzs', v_old.minimum_order_value_tzs,
            'new_minimum_order_tzs', p_minimum_order_tzs,
            'previous_commission_bps', v_old.default_commission_basis_points,
            'new_commission_bps', p_default_commission_bps,
            'change_reason', p_change_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'currency', v_new.currency,
        'customer_service_fee_tzs', v_new.customer_service_fee_tzs,
        'minimum_order_value_tzs', v_new.minimum_order_value_tzs,
        'default_commission_basis_points', v_new.default_commission_basis_points,
        'updated_at', v_new.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_financial_settings_secure(INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_financial_settings_secure(INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- 7. Public Safe Financial Settings Read RPC
CREATE OR REPLACE FUNCTION public.get_public_platform_financial_settings()
RETURNS TABLE (
    currency VARCHAR(3),
    customer_service_fee_tzs INTEGER,
    minimum_order_value_tzs INTEGER,
    default_commission_basis_points INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        currency,
        customer_service_fee_tzs,
        minimum_order_value_tzs,
        default_commission_basis_points
    FROM public.platform_financial_settings
    WHERE id = TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_financial_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_financial_settings() TO anon, authenticated, service_role;

-- 8. Secure Operational Settings Update RPC (ADMIN or SUPER_ADMIN)
CREATE OR REPLACE FUNCTION public.update_platform_operational_settings_secure(
    p_fresh_days INTEGER,
    p_recent_days INTEGER,
    p_stale_days INTEGER,
    p_support_phone TEXT,
    p_support_email TEXT,
    p_support_hours TEXT,
    p_maintenance_mode BOOLEAN,
    p_restaurant_applications_enabled BOOLEAN,
    p_customer_registration_enabled BOOLEAN,
    p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old RECORD;
    v_new RECORD;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    IF length(trim(COALESCE(p_change_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: A descriptive change reason (minimum 4 characters) is required.';
    END IF;

    IF p_fresh_days <= 0 OR p_recent_days <= p_fresh_days OR p_stale_days <= p_recent_days THEN
        RAISE EXCEPTION '400 Bad Request: Freshness thresholds must satisfy: 0 < fresh < recent < stale.';
    END IF;

    SELECT * INTO v_old
    FROM public.platform_operational_settings
    WHERE id = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '500 Internal Error: Platform operational settings singleton row not found.';
    END IF;

    UPDATE public.platform_operational_settings
    SET
        fresh_days = p_fresh_days,
        recent_days = p_recent_days,
        stale_days = p_stale_days,
        support_phone = trim(p_support_phone),
        support_email = trim(p_support_email),
        support_hours = trim(p_support_hours),
        maintenance_mode = p_maintenance_mode,
        restaurant_applications_enabled = p_restaurant_applications_enabled,
        customer_registration_enabled = p_customer_registration_enabled,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        change_reason = p_change_reason
    WHERE id = TRUE
    RETURNING * INTO v_new;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor), 'Admin'),
        'UPDATE_PLATFORM_OPERATIONAL_SETTINGS',
        'PLATFORM_SETTINGS',
        'OPERATIONAL',
        jsonb_build_object(
            'fresh_days', p_fresh_days,
            'recent_days', p_recent_days,
            'stale_days', p_stale_days,
            'maintenance_mode', p_maintenance_mode,
            'restaurant_applications_enabled', p_restaurant_applications_enabled,
            'customer_registration_enabled', p_customer_registration_enabled,
            'change_reason', p_change_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'fresh_days', v_new.fresh_days,
        'recent_days', v_new.recent_days,
        'stale_days', v_new.stale_days,
        'support_phone', v_new.support_phone,
        'support_email', v_new.support_email,
        'support_hours', v_new.support_hours,
        'maintenance_mode', v_new.maintenance_mode,
        'restaurant_applications_enabled', v_new.restaurant_applications_enabled,
        'customer_registration_enabled', v_new.customer_registration_enabled,
        'updated_at', v_new.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_operational_settings_secure(INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_operational_settings_secure(INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;

-- 9. Public Safe Operational Settings Read RPC
CREATE OR REPLACE FUNCTION public.get_public_platform_operational_settings()
RETURNS TABLE (
    fresh_days INTEGER,
    recent_days INTEGER,
    stale_days INTEGER,
    support_phone VARCHAR(30),
    support_email VARCHAR(100),
    support_hours VARCHAR(100),
    maintenance_mode BOOLEAN,
    restaurant_applications_enabled BOOLEAN,
    customer_registration_enabled BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        fresh_days,
        recent_days,
        stale_days,
        support_phone,
        support_email,
        support_hours,
        maintenance_mode,
        restaurant_applications_enabled,
        customer_registration_enabled
    FROM public.platform_operational_settings
    WHERE id = TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_public_platform_operational_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_platform_operational_settings() TO anon, authenticated, service_role;

-- 10. Audit Log Immutability Protection
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: Modification or deletion of audit logs is strictly prohibited.';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();

REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- 11. Authoritative create_order_secure with Database Settings
CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_branch_id             UUID,
    p_items                 JSONB,
    p_fulfillment_type      VARCHAR(30)  DEFAULT 'Delivery',
    p_delivery_address      TEXT         DEFAULT NULL,
    p_special_instructions  TEXT         DEFAULT NULL,
    p_delivery_zone_id      UUID         DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_restaurant_id VARCHAR(80);
    v_branch RECORD;
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_subtotal INTEGER := 0;
    v_service_fee INTEGER := 1500;
    v_min_order_subtotal INTEGER := 2000;
    v_delivery_fee INTEGER := 0;
    v_total INTEGER := 0;
    v_item RECORD;
    v_trusted_price INTEGER;
    v_item_name TEXT;
    v_is_available BOOLEAN;
    v_is_archived BOOLEAN;
    v_line_subtotal INTEGER;
    v_items_count INTEGER := 0;
    v_total_units INTEGER := 0;
    v_op_status JSONB;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_zone RECORD;
    v_prep_quote INTEGER;
    v_estimated_ready_at TIMESTAMPTZ;
    v_item_stock_status item_stock_status_enum;
    v_item_unavail_until TIMESTAMPTZ;
    v_item_daypart_start TIME;
    v_item_daypart_end TIME;
    v_local_time TIMESTAMPTZ;
    v_local_clock TIME;
    v_maintenance BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

    -- Check maintenance mode
    SELECT maintenance_mode INTO v_maintenance
    FROM public.platform_operational_settings
    WHERE id = TRUE;

    IF v_maintenance IS TRUE THEN
        RAISE EXCEPTION '503 Service Unavailable: Platform is currently undergoing maintenance. New orders are temporarily paused.';
    END IF;

    -- Load authoritative financial settings from database singleton
    SELECT
        customer_service_fee_tzs,
        minimum_order_value_tzs
    INTO
        v_service_fee,
        v_min_order_subtotal
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    -- Fallback safety
    v_service_fee := COALESCE(v_service_fee, 1500);
    v_min_order_subtotal := COALESCE(v_min_order_subtotal, 2000);

    SELECT * INTO v_branch
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Active restaurant branch % not found.', p_branch_id;
    END IF;

    v_restaurant_id := v_branch.restaurant_id;

    v_op_status := public.get_branch_operational_status(
        p_branch_id,
        CASE WHEN p_fulfillment_type = 'Delivery'
             THEN 'RESTAURANT_DELIVERY'::branch_service_type_enum
             ELSE 'PICKUP'::branch_service_type_enum END
    );

    IF (v_op_status->>'available')::boolean IS FALSE THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant branch is currently not accepting orders: %', v_op_status->>'reason';
    END IF;

    v_prep_quote         := (v_op_status->>'estimated_prep_minutes')::integer;
    v_estimated_ready_at := v_now + (v_prep_quote || ' minutes')::INTERVAL;

    -- DELIVERY ZONE: hard reject if not provided for delivery orders
    IF p_fulfillment_type = 'Delivery' THEN
        IF p_delivery_zone_id IS NULL THEN
            RAISE EXCEPTION 'DELIVERY_ZONE_REQUIRED: Delivery orders require an explicit delivery_zone_id. '
                            'Fetch available zones for branch % and let the customer select one.', p_branch_id;
        END IF;

        SELECT * INTO v_zone
        FROM public.branch_delivery_zones
        WHERE id = p_delivery_zone_id
          AND branch_id = p_branch_id
          AND is_active = TRUE;

        IF NOT FOUND THEN
            IF EXISTS (SELECT 1 FROM public.branch_delivery_zones WHERE id = p_delivery_zone_id) THEN
                RAISE EXCEPTION 'DELIVERY_ZONE_UNSUPPORTED: Delivery zone % does not serve branch % or is inactive.',
                    p_delivery_zone_id, p_branch_id;
            ELSE
                RAISE EXCEPTION '404 Not Found: Delivery zone % does not exist.', p_delivery_zone_id;
            END IF;
        END IF;

        v_delivery_fee := v_zone.fee_tzs;
    ELSE
        v_delivery_fee := 0;
        v_zone := NULL;
    END IF;

    v_order_id     := 'ord_' || substr(md5(random()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 4);

    v_local_time  := timezone(COALESCE(v_branch.timezone, 'Africa/Dar_es_Salaam'), v_now);
    v_local_clock := v_local_time::time;

    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_items)
            AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION '400 Bad Request: Quantity must be at least 1.';
        END IF;

        SELECT
            COALESCE(bmi.price_tzs, mi.price_tzs),
            COALESCE(bmi.item_name, mi.item_name),
            COALESCE(bmi.is_available, mi.is_available),
            COALESCE(bmi.is_archived, mi.is_archived, false),
            COALESCE(bmi.stock_status, mi.stock_status, 'IN_STOCK'::item_stock_status_enum),
            COALESCE(bmi.unavailable_until, mi.unavailable_until),
            mi.daypart_start,
            mi.daypart_end
        INTO
            v_trusted_price, v_item_name, v_is_available, v_is_archived,
            v_item_stock_status, v_item_unavail_until,
            v_item_daypart_start, v_item_daypart_end
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_item_overrides bmi
            ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id
          AND mi.restaurant_id = v_restaurant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '404 Not Found: Menu item % not found in this restaurant.', v_item.menu_item_id;
        END IF;

        IF v_is_archived = TRUE THEN
            RAISE EXCEPTION '410 Gone: Menu item "%" has been removed from the menu.', v_item_name;
        END IF;

        IF v_is_available = FALSE THEN
            RAISE EXCEPTION '409 Conflict: Menu item "%" is currently unavailable.', v_item_name;
        END IF;

        IF v_item_stock_status = 'OUT_OF_STOCK' THEN
            RAISE EXCEPTION '409 Conflict: Menu item "%" is out of stock.', v_item_name;
        END IF;

        IF v_item_stock_status = 'TEMPORARILY_UNAVAILABLE'
           AND v_item_unavail_until IS NOT NULL
           AND v_item_unavail_until > v_now
        THEN
            RAISE EXCEPTION '409 Conflict: Menu item "%" is temporarily unavailable until %.', v_item_name, v_item_unavail_until;
        END IF;

        IF v_item_daypart_start IS NOT NULL AND v_item_daypart_end IS NOT NULL THEN
            IF v_local_clock < v_item_daypart_start OR v_local_clock > v_item_daypart_end THEN
                RAISE EXCEPTION '409 Conflict: Menu item "%" is only served between % and %.',
                    v_item_name, v_item_daypart_start, v_item_daypart_end;
            END IF;
        END IF;

        v_line_subtotal := v_trusted_price * v_item.quantity;
        v_subtotal      := v_subtotal + v_line_subtotal;
        v_items_count   := v_items_count + 1;
        v_total_units   := v_total_units + v_item.quantity;
    END LOOP;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Order must contain at least one item.';
    END IF;

    -- Enforce platform minimum order value from database settings
    IF v_subtotal < v_min_order_subtotal THEN
        RAISE EXCEPTION '400 Bad Request: Minimum order subtotal is % TZS (current subtotal: % TZS).',
            v_min_order_subtotal, v_subtotal;
    END IF;

    -- Enforce zone-specific minimum order value if greater
    IF v_zone IS NOT NULL AND v_zone.minimum_order_tzs IS NOT NULL THEN
        IF v_subtotal < v_zone.minimum_order_tzs THEN
            RAISE EXCEPTION '400 Bad Request: Minimum order for this delivery zone is % TZS (current subtotal: % TZS).',
                v_zone.minimum_order_tzs, v_subtotal;
        END IF;
    END IF;

    v_total := v_subtotal + v_service_fee + v_delivery_fee;

    INSERT INTO public.orders (
        id, order_number, customer_id, restaurant_id, branch_id,
        status, fulfillment_type, delivery_address, special_instructions,
        subtotal_tzs, service_fee_tzs, delivery_fee_tzs, total_amount_tzs,
        estimated_prep_minutes, estimated_ready_at, created_at, updated_at
    ) VALUES (
        v_order_id, v_order_number, v_user_id, v_restaurant_id, p_branch_id,
        'PENDING', p_fulfillment_type, p_delivery_address, p_special_instructions,
        v_subtotal, v_service_fee, v_delivery_fee, v_total,
        v_prep_quote, v_estimated_ready_at, v_now, v_now
    );

    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_items)
            AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        SELECT
            COALESCE(bmi.price_tzs, mi.price_tzs),
            COALESCE(bmi.item_name, mi.item_name)
        INTO v_trusted_price, v_item_name
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_item_overrides bmi
            ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id;

        INSERT INTO public.order_items (
            id, order_id, menu_item_id, item_name_snapshot,
            quantity, unit_price_tzs, line_total_tzs, special_notes
        ) VALUES (
            'oi_' || substr(md5(random()::text), 1, 16),
            v_order_id, v_item.menu_item_id, v_item_name,
            v_item.quantity, v_trusted_price,
            v_trusted_price * v_item.quantity, v_item.special_notes
        );
    END LOOP;

    RETURN jsonb_build_object(
        'order_id',                v_order_id,
        'order_number',            v_order_number,
        'subtotal_tzs',            v_subtotal,
        'service_fee_tzs',         v_service_fee,
        'delivery_fee_tzs',        v_delivery_fee,
        'total_amount_tzs',        v_total,
        'estimated_prep_minutes',  v_prep_quote,
        'estimated_ready_at',      v_estimated_ready_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) TO authenticated, service_role;
