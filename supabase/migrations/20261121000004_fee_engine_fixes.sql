-- ============================================================================
-- Migration: Fee Engine Fixes (Order Items, BIGINT Math, Dine-In Setting)
-- ============================================================================
-- 1. compute_service_fee_tzs: BIGINT arithmetic prevents 32-bit integer overflow
-- 2. resolve_commission_bps: Dine-in returns commission_bps_dine_in ('DINE_IN'),
--                            Reservations return 0 ('RESERVATION')
-- 3. create_order_secure: Restores order_items insert loop with modifier snapshots,
--                         validates fulfillment_type at top, uses v_zone_min_order,
--                         and preserves 'success', TRUE in returned JSON
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PURE FUNCTION: compute_service_fee_tzs (Safe BIGINT Arithmetic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_service_fee_tzs(
    p_subtotal_tzs INTEGER,
    p_fulfillment_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_bps INTEGER := 300;
    v_min INTEGER := 200;
    v_max INTEGER := 500;
    v_raw BIGINT;
    v_clamped INTEGER;
    v_fee INTEGER;
BEGIN
    -- Return 0 for NULL or <= 0 subtotal
    IF p_subtotal_tzs IS NULL OR p_subtotal_tzs <= 0 THEN
        RETURN 0;
    END IF;

    -- Return 0 for any non-delivery type (Takeaway, Dine-in, Pickup, Reservation)
    IF lower(trim(COALESCE(p_fulfillment_type, ''))) != 'delivery' THEN
        RETURN 0;
    END IF;

    -- Load platform financial settings singleton
    SELECT
        service_fee_bps,
        service_fee_min_tzs,
        service_fee_max_tzs
    INTO
        v_bps,
        v_min,
        v_max
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    v_bps := COALESCE(v_bps, 300);
    v_min := COALESCE(v_min, 200);
    v_max := COALESCE(v_max, 500);

    -- Integer division, half-up rounding using BIGINT arithmetic to prevent 32-bit overflow
    v_raw := (p_subtotal_tzs::BIGINT * v_bps + 5000) / 10000;
    v_clamped := LEAST(GREATEST(v_raw, v_min::BIGINT), v_max::BIGINT)::INTEGER;
    v_fee := (((v_clamped + 5) / 10) * 10)::INTEGER;

    RETURN v_fee;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.compute_service_fee_tzs(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_service_fee_tzs(INTEGER, TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. RESOLVE COMMISSION BPS (Dine-In Setting & Reservation Reason)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_commission_bps(
    p_restaurant_id TEXT,
    p_fulfillment_type TEXT,
    p_at TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS TABLE (
    bps INTEGER,
    policy_id UUID,
    reason TEXT
) AS $$
DECLARE
    v_norm TEXT := lower(trim(COALESCE(p_fulfillment_type, '')));
    v_at TIMESTAMPTZ := COALESCE(p_at, clock_timestamp());
    v_comm_delivery INTEGER := 800;
    v_comm_takeaway INTEGER := 500;
    v_comm_dine_in INTEGER := 0;
    v_free_days INTEGER := 30;
    v_launched_at TIMESTAMPTZ;
    v_policy RECORD;
    v_is_unknown BOOLEAN := FALSE;
BEGIN
    -- Read platform defaults
    SELECT
        commission_bps_delivery,
        commission_bps_takeaway,
        commission_bps_dine_in,
        new_restaurant_free_days
    INTO
        v_comm_delivery,
        v_comm_takeaway,
        v_comm_dine_in,
        v_free_days
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    v_comm_delivery := COALESCE(v_comm_delivery, 800);
    v_comm_takeaway := COALESCE(v_comm_takeaway, 500);
    v_comm_dine_in  := COALESCE(v_comm_dine_in, 0);
    v_free_days     := COALESCE(v_free_days, 30);

    -- Precedence (a1): Reservations return 0 bps, reason 'RESERVATION'
    IF v_norm IN ('reservation', 'booking') THEN
        RETURN QUERY SELECT 0::INTEGER, NULL::UUID, 'RESERVATION'::TEXT;
        RETURN;
    END IF;

    -- Precedence (a2): Dine-In uses platform_financial_settings.commission_bps_dine_in, reason 'DINE_IN'
    IF v_norm IN ('dine-in', 'dine_in', 'dinein') THEN
        RETURN QUERY SELECT v_comm_dine_in, NULL::UUID, 'DINE_IN'::TEXT;
        RETURN;
    END IF;

    -- Precedence (b): Inside new-restaurant free window -> 0 bps, reason 'NEW_RESTAURANT_FREE_MONTH'
    SELECT launched_at INTO v_launched_at
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF v_launched_at IS NOT NULL AND v_at >= v_launched_at AND v_at < (v_launched_at + (v_free_days || ' days')::INTERVAL) THEN
        RETURN QUERY SELECT 0::INTEGER, NULL::UUID, 'NEW_RESTAURANT_FREE_MONTH'::TEXT;
        RETURN;
    END IF;

    -- Identify unknown order types
    IF v_norm NOT IN ('delivery', 'takeaway', 'pickup') THEN
        v_is_unknown := TRUE;
    END IF;

    -- Precedence (c): Active merchant policy -> its rate for delivery, LEAST(policy, takeaway) for takeaway/pickup
    SELECT * INTO v_policy
    FROM public.merchant_fee_policies
    WHERE restaurant_id = p_restaurant_id
      AND effective_from <= v_at
      AND (effective_until IS NULL OR effective_until > v_at)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF FOUND THEN
        IF v_norm IN ('takeaway', 'pickup') THEN
            RETURN QUERY SELECT LEAST(v_policy.commission_basis_points, v_comm_takeaway)::INTEGER, v_policy.id, 'MERCHANT_POLICY'::TEXT;
        ELSE
            RETURN QUERY SELECT v_policy.commission_basis_points::INTEGER, v_policy.id, 'MERCHANT_POLICY'::TEXT;
        END IF;
        RETURN;
    END IF;

    -- Precedence (d): Default for order type, reason 'DEFAULT' (or 'UNKNOWN_TYPE')
    IF v_is_unknown THEN
        RETURN QUERY SELECT v_comm_delivery, NULL::UUID, 'UNKNOWN_TYPE'::TEXT;
    ELSIF v_norm IN ('takeaway', 'pickup') THEN
        RETURN QUERY SELECT v_comm_takeaway, NULL::UUID, 'DEFAULT'::TEXT;
    ELSE
        RETURN QUERY SELECT v_comm_delivery, NULL::UUID, 'DEFAULT'::TEXT;
    END IF;
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.resolve_commission_bps(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_commission_bps(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. RECREATE create_order_secure (Restores order_items & 'success', TRUE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_branch_id             UUID,
    p_items                 JSONB,
    p_fulfillment_type      VARCHAR(30)  DEFAULT 'Delivery',
    p_delivery_address      TEXT         DEFAULT NULL,
    p_special_instructions  TEXT         DEFAULT NULL,
    p_delivery_zone_id      UUID         DEFAULT NULL,
    p_delivery_quote_id     UUID         DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_restaurant_id VARCHAR(80);
    v_branch RECORD;
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_subtotal INTEGER := 0;
    v_service_fee INTEGER := 0;
    v_delivery_min_order_tzs INTEGER := 5000;
    v_min_order_subtotal INTEGER := 2000;
    v_effective_min_order INTEGER := 2000;
    v_delivery_fee INTEGER := 0;
    v_total INTEGER := 0;
    v_item RECORD;
    v_base_trusted_price INTEGER;
    v_item_name TEXT;
    v_is_available BOOLEAN;
    v_is_archived BOOLEAN;
    v_line_subtotal INTEGER;
    v_items_count INTEGER := 0;
    v_total_units INTEGER := 0;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_zone RECORD;
    v_zone_min_order INTEGER := 0;
    v_quote RECORD;
    v_prep_quote INTEGER;
    v_item_stock_status item_stock_status_enum;
    v_item_unavail_until TIMESTAMPTZ;
    v_item_daypart_start TIME;
    v_item_daypart_end TIME;
    v_local_time TIMESTAMPTZ;
    v_local_clock TIME;
    v_maintenance BOOLEAN := FALSE;
    v_mod_result JSONB;
    v_mod_delta INTEGER;
    v_mod_snapshot JSONB;
    v_trusted_unit_price INTEGER;
    v_quote_distance INTEGER := NULL;
    v_quote_duration INTEGER := NULL;
    v_quote_dest_lat DOUBLE PRECISION := NULL;
    v_quote_dest_lng DOUBLE PRECISION := NULL;
    v_pricing_mode VARCHAR(30) := 'ROUTE_DISTANCE';
BEGIN
    -- Validate exact fulfillment type at very top before any other work
    IF p_fulfillment_type IS NULL OR p_fulfillment_type NOT IN ('Delivery', 'Takeaway', 'Dine-In') THEN
        RAISE EXCEPTION '400 Bad Request: INVALID_FULFILLMENT_TYPE: %', p_fulfillment_type;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

    -- Block suspended users authoritatively
    IF NOT public.is_active_profile(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: User account is suspended or inactive.';
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
        delivery_min_order_tzs,
        minimum_order_value_tzs
    INTO
        v_delivery_min_order_tzs,
        v_min_order_subtotal
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    v_delivery_min_order_tzs := COALESCE(v_delivery_min_order_tzs, 5000);
    v_min_order_subtotal     := COALESCE(v_min_order_subtotal, 2000);

    SELECT * INTO v_branch
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Branch % is inactive or does not exist.', p_branch_id;
    END IF;

    v_restaurant_id := v_branch.restaurant_id;

    -- DELIVERY PRICING & ROUTE QUOTE VALIDATION
    IF p_fulfillment_type = 'Delivery' THEN
        SELECT pricing_mode INTO v_pricing_mode
        FROM public.branch_delivery_pricing
        WHERE branch_id = p_branch_id;

        v_pricing_mode := COALESCE(v_pricing_mode, 'ROUTE_DISTANCE');

        IF v_pricing_mode = 'ROUTE_DISTANCE' THEN
            IF p_delivery_quote_id IS NULL THEN
                RAISE EXCEPTION 'DELIVERY_QUOTE_REQUIRED: Route-distance delivery requires a valid route delivery quote.';
            END IF;

            -- Authoritative Route-Based Quote
            SELECT * INTO v_quote
            FROM public.delivery_quotes
            WHERE id = p_delivery_quote_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION '404 Not Found: Delivery quote % not found.', p_delivery_quote_id;
            END IF;

            IF v_quote.user_id != v_user_id THEN
                RAISE EXCEPTION '403 Forbidden: Delivery quote does not belong to this customer.';
            END IF;

            IF v_quote.branch_id != p_branch_id THEN
                RAISE EXCEPTION '400 Bad Request: Delivery quote branch does not match order branch.';
            END IF;

            IF v_quote.consumed_at IS NOT NULL THEN
                RAISE EXCEPTION '409 Conflict: Delivery quote has already been consumed by order %.', v_quote.consumed_by_order_id;
            END IF;

            IF v_quote.expires_at <= v_now THEN
                RAISE EXCEPTION '410 Gone: Delivery quote has expired. Please refresh your quote.';
            END IF;

            v_delivery_fee := v_quote.delivery_fee_tzs;
            v_quote_distance := v_quote.distance_meters;
            v_quote_duration := v_quote.duration_seconds;
            v_quote_dest_lat := v_quote.destination_latitude;
            v_quote_dest_lng := v_quote.destination_longitude;
        ELSIF v_pricing_mode = 'FIXED_ZONE' THEN
            IF p_delivery_zone_id IS NULL THEN
                RAISE EXCEPTION 'DELIVERY_ZONE_REQUIRED: Fixed-zone delivery requires a valid delivery zone.';
            END IF;

            SELECT * INTO v_zone
            FROM public.branch_delivery_zones
            WHERE id = p_delivery_zone_id
              AND branch_id = p_branch_id
              AND is_active = TRUE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'DELIVERY_ZONE_UNSUPPORTED: Delivery zone % does not serve branch % or is inactive.',
                    p_delivery_zone_id, p_branch_id;
            END IF;

            v_delivery_fee := v_zone.fee_tzs;
            v_zone_min_order := COALESCE(v_zone.minimum_order_tzs, 0);
        ELSE
            RAISE EXCEPTION 'DELIVERY_PRICING_INVALID: Unsupported branch delivery pricing mode %.', v_pricing_mode;
        END IF;
    ELSE
        -- Takeaway / Dine-In has ZERO delivery fee
        v_delivery_fee := 0;
        p_delivery_quote_id := NULL;
    END IF;

    v_order_id     := 'ord_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 4);

    v_local_time  := timezone(COALESCE(v_branch.timezone, 'Africa/Dar_es_Salaam'), v_now);
    v_local_clock := v_local_time::time;

    -- Loop over items and calculate authoritative subtotal including validated modifiers
    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_items)
            AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT, selected_modifiers JSONB)
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
            v_base_trusted_price, v_item_name, v_is_available, v_is_archived,
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

        -- Validate modifiers server-side
        v_mod_result := public.validate_menu_item_modifiers(v_item.menu_item_id, v_item.selected_modifiers);
        v_mod_delta  := (v_mod_result->>'price_delta_tzs')::integer;
        v_trusted_unit_price := v_base_trusted_price + v_mod_delta;

        v_line_subtotal := v_trusted_unit_price * v_item.quantity;
        v_subtotal      := v_subtotal + v_line_subtotal;
        v_items_count   := v_items_count + 1;
        v_total_units   := v_total_units + v_item.quantity;
    END LOOP;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Order must contain at least one item.';
    END IF;

    -- Enforce authoritative minimum order limits
    IF p_fulfillment_type = 'Delivery' THEN
        v_effective_min_order := GREATEST(v_delivery_min_order_tzs, v_zone_min_order);
        IF v_subtotal < v_effective_min_order THEN
            RAISE EXCEPTION '400 Bad Request: MIN_ORDER_DELIVERY:% Minimum for delivery is % TZS (current: % TZS).',
                v_effective_min_order, v_effective_min_order, v_subtotal;
        END IF;
    ELSE
        -- Takeaway / Dine-In global minimum
        IF v_subtotal < v_min_order_subtotal THEN
            RAISE EXCEPTION '400 Bad Request: MIN_ORDER_GLOBAL:% Minimum order subtotal is % TZS (current: % TZS).',
                v_min_order_subtotal, v_min_order_subtotal, v_subtotal;
        END IF;
    END IF;

    -- Compute authoritative customer service fee via exact integer engine
    v_service_fee := public.compute_service_fee_tzs(v_subtotal, p_fulfillment_type);

    v_total := v_subtotal + v_service_fee + v_delivery_fee;

    -- Insert authoritative public.orders record
    INSERT INTO public.orders (
        id,
        order_number,
        user_id,
        restaurant_id,
        branch_id,
        status,
        payment_status,
        subtotal_tzs,
        service_fee_tzs,
        total_tzs,
        delivery_fee_tzs,
        dining_option,
        delivery_address,
        special_instructions,
        delivery_quote_id,
        delivery_distance_meters,
        delivery_duration_seconds,
        delivery_destination_latitude,
        delivery_destination_longitude,
        estimated_prep_minutes,
        created_at,
        updated_at
    )
    VALUES (
        v_order_id,
        v_order_number,
        v_user_id,
        v_restaurant_id,
        p_branch_id,
        'PENDING',
        'PENDING',
        v_subtotal,
        v_service_fee,
        v_total,
        v_delivery_fee,
        p_fulfillment_type,
        p_delivery_address,
        p_special_instructions,
        p_delivery_quote_id,
        v_quote_distance,
        v_quote_duration,
        v_quote_dest_lat,
        v_quote_dest_lng,
        v_prep_quote,
        v_now,
        v_now
    );

    -- Atomically consume quote if applicable
    IF p_delivery_quote_id IS NOT NULL THEN
        UPDATE public.delivery_quotes
        SET consumed_at = v_now,
            consumed_by_order_id = v_order_id
        WHERE id = p_delivery_quote_id;
    END IF;

    -- Insert order items with validated modifier snapshots
    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_items)
            AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT, selected_modifiers JSONB)
    LOOP
        SELECT
            COALESCE(bmi.price_tzs, mi.price_tzs),
            COALESCE(bmi.item_name, mi.item_name)
        INTO v_base_trusted_price, v_item_name
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_item_overrides bmi
            ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id;

        v_mod_result := public.validate_menu_item_modifiers(v_item.menu_item_id, v_item.selected_modifiers);
        v_mod_delta  := (v_mod_result->>'price_delta_tzs')::integer;
        v_mod_snapshot := v_mod_result->'snapshot';
        v_trusted_unit_price := v_base_trusted_price + v_mod_delta;

        INSERT INTO public.order_items (
            id,
            order_id,
            menu_item_id,
            item_name,
            item_name_snapshot,
            unit_price_tzs,
            price_snapshot,
            quantity,
            total_price_tzs,
            special_notes,
            selected_modifiers
        )
        VALUES (
            'item_ord_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
            v_order_id,
            v_item.menu_item_id,
            v_item_name,
            v_item_name,
            v_trusted_unit_price,
            v_trusted_unit_price,
            v_item.quantity,
            v_trusted_unit_price * v_item.quantity,
            v_item.special_notes,
            v_mod_snapshot
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal_tzs', v_subtotal,
        'service_fee_tzs', v_service_fee,
        'delivery_fee_tzs', v_delivery_fee,
        'total_tzs', v_total,
        'fulfillment_type', p_fulfillment_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. UTILITY RPC: get_function_def (For Verification Diagnostics)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_function_def(p_function_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = p_function_name
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_function_def(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_function_def(TEXT) TO service_role;
