-- ============================================================================
-- Migration: Database Fee Engine, Dynamic Commission & Launch Date Tracker
-- ============================================================================
-- 1. Extend platform_financial_settings with granular fee & commission parameters
-- 2. Extend restaurants with launched_at and first-publish trigger
-- 3. Extend order_financial_snapshots with commission_reason
-- 4. Pure helper: compute_service_fee_tzs (exact integer math)
-- 5. Pure helper: resolve_commission_bps (role/window/policy precedence)
-- 6. Authoritative create_order_secure (updated fee & delivery minimum)
-- 7. Authoritative finalize_payment_capture_rpc (dynamic commission resolution)
-- 8. Custom meal fee integration (get_platform_service_fee & lock_custom_meal_quote_selection)
-- 9. Admin RPC: update_platform_fee_rules_secure
-- 10. Public RPC: get_public_fee_rules
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND platform_financial_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.platform_financial_settings
ADD COLUMN IF NOT EXISTS service_fee_bps INTEGER NOT NULL DEFAULT 300,
ADD COLUMN IF NOT EXISTS service_fee_min_tzs INTEGER NOT NULL DEFAULT 200,
ADD COLUMN IF NOT EXISTS service_fee_max_tzs INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS delivery_min_order_tzs INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN IF NOT EXISTS commission_bps_delivery INTEGER NOT NULL DEFAULT 800,
ADD COLUMN IF NOT EXISTS commission_bps_takeaway INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS commission_bps_dine_in INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_restaurant_free_days INTEGER NOT NULL DEFAULT 30;

-- Operational validation constraints
ALTER TABLE public.platform_financial_settings
DROP CONSTRAINT IF EXISTS platform_financial_settings_fee_checks;

ALTER TABLE public.platform_financial_settings
ADD CONSTRAINT platform_financial_settings_fee_checks CHECK (
    service_fee_bps >= 0 AND service_fee_bps <= 10000 AND
    service_fee_min_tzs >= 0 AND
    service_fee_max_tzs >= service_fee_min_tzs AND
    delivery_min_order_tzs >= 0 AND
    commission_bps_delivery >= 0 AND commission_bps_delivery <= 10000 AND
    commission_bps_takeaway >= 0 AND commission_bps_takeaway <= 10000 AND
    commission_bps_dine_in >= 0 AND commission_bps_dine_in <= 10000 AND
    new_restaurant_free_days >= 0
);

-- Initialize existing singleton row to authoritative fee parameters
UPDATE public.platform_financial_settings
SET
    service_fee_bps = 300,
    service_fee_min_tzs = 200,
    service_fee_max_tzs = 500,
    delivery_min_order_tzs = 5000,
    commission_bps_delivery = 800,
    commission_bps_takeaway = 500,
    commission_bps_dine_in = 0,
    new_restaurant_free_days = 30
WHERE id = TRUE;

-- ----------------------------------------------------------------------------
-- 2. EXTEND restaurants WITH launched_at AND AUTO-STAMP TRIGGER
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ;

-- Backfill existing published restaurants with created_at so they do NOT receive a new free month
UPDATE public.restaurants
SET launched_at = created_at
WHERE (launch_status = 'PUBLISHED' OR is_published = TRUE) AND launched_at IS NULL;

-- Trigger to stamp launched_at the first time launch_status becomes 'PUBLISHED' or is_published is TRUE
CREATE OR REPLACE FUNCTION public.set_restaurant_launched_at()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.launch_status = 'PUBLISHED' OR NEW.is_published = TRUE) AND NEW.launched_at IS NULL THEN
        NEW.launched_at := clock_timestamp();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_restaurant_launched_at ON public.restaurants;
CREATE TRIGGER trg_restaurant_launched_at
BEFORE INSERT OR UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.set_restaurant_launched_at();

-- ----------------------------------------------------------------------------
-- 3. EXTEND order_financial_snapshots WITH commission_reason
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_financial_snapshots
ADD COLUMN IF NOT EXISTS commission_reason TEXT;

-- ----------------------------------------------------------------------------
-- 4. PURE FUNCTION: compute_service_fee_tzs (Exact Integer Math)
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
    v_raw INTEGER;
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

    -- Integer division, half-up rounding to canonical integer
    v_raw := (p_subtotal_tzs * v_bps + 5000) / 10000;
    v_clamped := LEAST(GREATEST(v_raw, v_min), v_max);
    v_fee := ((v_clamped + 5) / 10) * 10;

    RETURN v_fee;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.compute_service_fee_tzs(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_service_fee_tzs(INTEGER, TEXT) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. RESOLVE COMMISSION BPS (Order Types & Precedence Engine)
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

    -- Precedence (a): Dine-In -> 0 bps, reason 'DINE_IN'
    IF v_norm IN ('dine-in', 'dine_in', 'dinein', 'reservation', 'booking') THEN
        RETURN QUERY SELECT 0::INTEGER, NULL::UUID, 'DINE_IN'::TEXT;
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

-- Commission resolution reveals negotiated deals: private to service_role
REVOKE ALL ON FUNCTION public.resolve_commission_bps(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_commission_bps(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. RECREATE create_order_secure (With Dynamic Fee & Delivery Minimum)
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
    v_trusted_unit_price INTEGER;
    v_quote_distance INTEGER := NULL;
    v_quote_duration INTEGER := NULL;
    v_quote_dest_lat DOUBLE PRECISION := NULL;
    v_quote_dest_lng DOUBLE PRECISION := NULL;
    v_pricing_mode VARCHAR(30) := 'ROUTE_DISTANCE';
    v_is_delivery BOOLEAN := FALSE;
BEGIN
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

    v_is_delivery := (lower(trim(COALESCE(p_fulfillment_type, ''))) = 'delivery');

    SELECT * INTO v_branch
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Branch % is inactive or does not exist.', p_branch_id;
    END IF;

    v_restaurant_id := v_branch.restaurant_id;

    -- DELIVERY PRICING & ROUTE QUOTE VALIDATION
    IF v_is_delivery THEN
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
        v_zone_min_order := 0;
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
    IF v_is_delivery THEN
        -- Delivery minimum: delivery_min_order_tzs or zone minimum (whichever is higher)
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

    RETURN jsonb_build_object(
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
-- 7. RECREATE finalize_payment_capture_rpc (With Dynamic Commission Resolution)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_payment_capture_rpc(
    p_payment_id VARCHAR(80),
    p_provider_reference TEXT,
    p_gateway_reference TEXT,
    p_captured_amount_tzs BIGINT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_order RECORD;
    v_res RECORD;
    v_batch_id UUID;
    v_food_tzs BIGINT := 0;
    v_service_fee_tzs BIGINT := 0;
    v_delivery_fee_tzs BIGINT := 0;
    v_commission_tzs BIGINT := 0;
    v_net_payable_tzs BIGINT := 0;
    v_commission_bps INTEGER := 800;
    v_policy_id UUID := NULL;
    v_commission_reason TEXT := 'DEFAULT';
    v_authoritative_total BIGINT := 0;
BEGIN
    -- 1. Locate payment
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record % not found', p_payment_id;
    END IF;

    -- 2. Idempotency check: Already has snapshot or batch?
    IF EXISTS (
        SELECT 1 FROM public.financial_posting_batches
        WHERE idempotency_key = p_idempotency_key
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Payment capture already processed (idempotent)');
    END IF;

    -- 3. Verify payment amount
    IF v_payment.amount_tzs <> p_captured_amount_tzs THEN
        RAISE EXCEPTION 'Captured amount % does not match recorded payment amount %',
            p_captured_amount_tzs, v_payment.amount_tzs;
    END IF;

    -- 4. Derive Authoritative Financials based on Transaction Type
    -- Case A: Standard Order
    IF v_payment.order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM public.orders WHERE id = v_payment.order_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Linked order % not found', v_payment.order_id;
        END IF;

        v_food_tzs := v_order.subtotal_tzs;
        v_service_fee_tzs := v_order.service_fee_tzs;
        v_delivery_fee_tzs := COALESCE(v_order.delivery_fee_tzs, 0);
        v_authoritative_total := v_order.total_tzs;

        -- Resolve commission bps dynamically from policy, new-restaurant promo, or fulfillment default
        SELECT bps, policy_id, reason
        INTO v_commission_bps, v_policy_id, v_commission_reason
        FROM public.resolve_commission_bps(
            v_order.restaurant_id,
            v_order.dining_option,
            v_order.created_at
        );

        v_commission_bps := COALESCE(v_commission_bps, 800);
        v_commission_reason := COALESCE(v_commission_reason, 'DEFAULT');

        -- Half-up canonical integer rounding
        v_commission_tzs := (v_food_tzs * v_commission_bps + 5000) / 10000;
        v_net_payable_tzs := v_food_tzs - v_commission_tzs + v_delivery_fee_tzs;

        IF v_authoritative_total <> p_captured_amount_tzs THEN
            RAISE EXCEPTION 'Authoritative order total % does not match captured amount %',
                v_authoritative_total, p_captured_amount_tzs;
        END IF;

        -- Create Order Financial Snapshot (Immutable) with commission_reason
        INSERT INTO public.order_financial_snapshots (
            order_id, restaurant_id, payment_id, gross_food_sales_tzs,
            customer_service_fee_tzs, restaurant_delivery_fee_tzs, discount_tzs,
            platform_commission_tzs, restaurant_net_payable_tzs, commission_policy_id,
            commission_basis_points_snapshot, currency, commission_reason
        ) VALUES (
            v_order.id, v_order.restaurant_id, v_payment.id, v_food_tzs,
            v_service_fee_tzs, v_delivery_fee_tzs, 0,
            v_commission_tzs, v_net_payable_tzs, v_policy_id,
            v_commission_bps, 'TZS', v_commission_reason
        ) ON CONFLICT (order_id) DO NOTHING;

        -- Create Balanced Posting Batch
        INSERT INTO public.financial_posting_batches (
            batch_type, total_amount_tzs, is_balanced, idempotency_key
        ) VALUES (
            'PAYMENT_CAPTURE', p_captured_amount_tzs, FALSE, p_idempotency_key
        ) RETURNING id INTO v_batch_id;

        -- Balanced double-entry postings:
        -- DEBIT  PROVIDER_RECEIVABLE : total
        -- CREDIT RESTAURANT_PAYABLE  : net_payable (food - comm + delivery)
        -- CREDIT PLATFORM_REVENUE    : comm + service_fee
        INSERT INTO public.financial_ledger_entries (
            batch_id, entry_type, entity_type, entity_id, restaurant_id, customer_user_id,
            payment_id, amount_tzs, direction, account_type, reference_type, reference_id,
            description, idempotency_key
        ) VALUES (
            v_batch_id, 'PAYMENT_COLLECTION', 'ORDER', v_order.id, v_order.restaurant_id, v_payment.user_id,
            v_payment.id, p_captured_amount_tzs, 'DEBIT', 'PROVIDER_RECEIVABLE', 'ORDER_PAYMENT', v_order.order_number,
            'Customer payment collected via payment gateway', p_idempotency_key || '_debit_prov'
        ), (
            v_batch_id, 'RESTAURANT_PAYABLE_CREDIT', 'ORDER', v_order.id, v_order.restaurant_id, v_payment.user_id,
            v_payment.id, v_net_payable_tzs, 'CREDIT', 'RESTAURANT_PAYABLE', 'ORDER_PAYMENT', v_order.order_number,
            'Merchant payable entitlement for order food and delivery', p_idempotency_key || '_credit_rest'
        ), (
            v_batch_id, 'PLATFORM_COMMISSION', 'ORDER', v_order.id, v_order.restaurant_id, v_payment.user_id,
            v_payment.id, (v_commission_tzs + v_service_fee_tzs), 'CREDIT', 'PLATFORM_REVENUE', 'ORDER_PAYMENT', v_order.order_number,
            'Platform commission and customer service fee revenue', p_idempotency_key || '_credit_plat'
        );

        PERFORM public.close_and_verify_posting_batch(v_batch_id);

        -- Update Order payment status
        UPDATE public.orders
        SET payment_status = 'SUCCESS', updated_at = clock_timestamp()
        WHERE id = v_order.id;

    -- Case B: Reservation Deposit
    ELSIF v_payment.reservation_id IS NOT NULL THEN
        SELECT * INTO v_res FROM public.reservations WHERE id = v_payment.reservation_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Linked reservation % not found', v_payment.reservation_id;
        END IF;

        -- Create Balanced Posting Batch for Deposit Hold (NOT restaurant payable yet!)
        INSERT INTO public.financial_posting_batches (
            batch_type, total_amount_tzs, is_balanced, idempotency_key
        ) VALUES (
            'RESERVATION_DEPOSIT_CAPTURE', p_captured_amount_tzs, FALSE, p_idempotency_key
        ) RETURNING id INTO v_batch_id;

        -- DEBIT  PROVIDER_RECEIVABLE          : deposit
        -- CREDIT RESERVATION_DEPOSIT_HOLDING  : deposit
        INSERT INTO public.financial_ledger_entries (
            batch_id, entry_type, entity_type, entity_id, restaurant_id, customer_user_id,
            payment_id, amount_tzs, direction, account_type, reference_type, reference_id,
            description, idempotency_key
        ) VALUES (
            v_batch_id, 'RESERVATION_DEPOSIT_HELD', 'RESERVATION', v_res.id, v_res.restaurant_id, v_payment.user_id,
            v_payment.id, p_captured_amount_tzs, 'DEBIT', 'PROVIDER_RECEIVABLE', 'RESERVATION_DEPOSIT', v_res.id,
            'Reservation deposit captured via provider', p_idempotency_key || '_debit_prov'
        ), (
            v_batch_id, 'RESERVATION_DEPOSIT_HELD', 'RESERVATION', v_res.id, v_res.restaurant_id, v_payment.user_id,
            v_payment.id, p_captured_amount_tzs, 'CREDIT', 'RESERVATION_DEPOSIT_HOLDING', 'RESERVATION_DEPOSIT', v_res.id,
            'Reservation deposit held pending reservation fulfillment', p_idempotency_key || '_credit_holding'
        );

        PERFORM public.close_and_verify_posting_batch(v_batch_id);
    END IF;

    -- Update Payment status
    UPDATE public.payments
    SET status = 'SUCCESS',
        paid_at = clock_timestamp(),
        webhook_verified = TRUE,
        provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        updated_at = clock_timestamp()
    WHERE id = v_payment.id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment.id,
        'batch_id', v_batch_id,
        'amount_tzs', p_captured_amount_tzs
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_payment_capture_rpc(VARCHAR, TEXT, TEXT, BIGINT, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_payment_capture_rpc(VARCHAR, TEXT, TEXT, BIGINT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 8. CUSTOM MEALS: get_platform_service_fee & lock_custom_meal_quote_selection
-- ----------------------------------------------------------------------------
-- 1-arg overload: defaults to Delivery
CREATE OR REPLACE FUNCTION public.get_platform_service_fee(p_subtotal_tzs INTEGER DEFAULT 0)
RETURNS INTEGER AS $$
BEGIN
    RETURN public.compute_service_fee_tzs(p_subtotal_tzs, 'Delivery');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2-arg overload: explicit fulfillment type
CREATE OR REPLACE FUNCTION public.get_platform_service_fee(p_subtotal_tzs INTEGER, p_fulfillment_type TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN public.compute_service_fee_tzs(p_subtotal_tzs, p_fulfillment_type);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_platform_service_fee(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_service_fee(INTEGER) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_platform_service_fee(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_service_fee(INTEGER, TEXT) TO anon, authenticated, service_role;

-- Recreate lock_custom_meal_quote_selection passing mapped fulfillment type
CREATE OR REPLACE FUNCTION public.lock_custom_meal_quote_selection(
    p_request_id VARCHAR(80),
    p_quote_id VARCHAR(80)
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req RECORD;
    v_quote RECORD;
    v_items JSONB;
    v_service_fee INTEGER;
    v_grand_total INTEGER;
    v_snapshot JSONB;
    v_effective_mode TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to select quote.';
    END IF;

    -- 1. Lock request row FOR UPDATE to prevent race condition
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    IF v_req.user_id != v_user_id AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Caller does not own this custom meal request.';
    END IF;

    IF v_req.status = 'QUOTE_ACCEPTED' THEN
        RAISE EXCEPTION '409 Conflict: A quote has already been accepted for this request.';
    END IF;

    IF v_req.status IN ('ORDER_CREATED', 'COMPLETED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION '400 Bad Request: Request is not in a selectable state (status: %).', v_req.status;
    END IF;

    -- 2. Lock and validate target quote
    SELECT * INTO v_quote
    FROM public.restaurant_quotes
    WHERE id = p_quote_id AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Quote % does not exist for request %.', p_quote_id, p_request_id;
    END IF;

    IF v_quote.status NOT IN ('SUBMITTED', 'REVISED', 'OFFERED') THEN
        RAISE EXCEPTION '400 Bad Request: Quote is not active (status: %).', v_quote.status;
    END IF;

    IF v_quote.valid_until IS NOT NULL AND v_quote.valid_until <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: Selected quote has expired.';
    END IF;

    -- 3. Mark selected quote ACCEPTED
    UPDATE public.restaurant_quotes
    SET status = 'ACCEPTED'
    WHERE id = p_quote_id;

    -- 4. Mark all competing active quotes for this request as SUPERSEDED / REJECTED
    UPDATE public.restaurant_quotes
    SET status = 'SUPERSEDED'
    WHERE request_id = p_request_id AND id != p_quote_id AND status IN ('SUBMITTED', 'REVISED', 'OFFERED');

    -- 5. Calculate platform fee based on fulfillment mode
    v_effective_mode := CASE
        WHEN upper(trim(COALESCE(v_quote.fulfillment_mode, v_req.fulfillment_mode, ''))) = 'PICKUP' THEN 'Takeaway'
        ELSE 'Delivery'
    END;

    v_service_fee := public.get_platform_service_fee(v_quote.subtotal_tzs, v_effective_mode);
    v_grand_total := v_quote.total_tzs + v_service_fee;

    SELECT jsonb_agg(jsonb_build_object(
        'name', qi.name,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price_tzs', qi.unit_price_tzs,
        'line_total_tzs', qi.line_total_tzs
    )) INTO v_items
    FROM public.restaurant_quote_items qi
    WHERE qi.quote_id = p_quote_id;

    v_snapshot := jsonb_build_object(
        'quote_id', p_quote_id,
        'revision_number', v_quote.revision_number,
        'restaurant_id', v_quote.restaurant_id,
        'branch_id', v_quote.branch_id,
        'subtotal_tzs', v_quote.subtotal_tzs,
        'delivery_fee_tzs', v_quote.delivery_fee_tzs,
        'service_fee_tzs', v_service_fee,
        'grand_total_tzs', v_grand_total,
        'estimated_prep_minutes', v_quote.estimated_prep_minutes,
        'promised_ready_at', v_quote.promised_ready_at,
        'fulfillment_mode', v_quote.fulfillment_mode,
        'chef_notes', v_quote.chef_notes,
        'dietary_acknowledged', v_quote.dietary_acknowledged,
        'allergy_acknowledged', v_quote.allergy_acknowledged,
        'line_items', COALESCE(v_items, '[]'::jsonb),
        'locked_at', NOW()
    );

    -- 6. Update request record
    UPDATE public.custom_meal_requests SET
        accepted_quote_id = p_quote_id,
        locked_quote_snapshot = v_snapshot,
        status = 'QUOTE_ACCEPTED',
        status_message_en = 'Quote accepted. Please proceed to payment to finalize order.',
        status_message_sw = 'Ofa imekubaliwa. Tafadhali kamilisha malipo kuthibitisha agizo.',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'quote_id', p_quote_id,
        'restaurant_id', v_quote.restaurant_id,
        'grand_total_tzs', v_grand_total,
        'service_fee_tzs', v_service_fee,
        'status', 'QUOTE_ACCEPTED',
        'snapshot', v_snapshot
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.lock_custom_meal_quote_selection(VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_custom_meal_quote_selection(VARCHAR, VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. ADMIN RPC: update_platform_fee_rules_secure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_platform_fee_rules_secure(
    p_service_fee_bps INTEGER,
    p_service_fee_min_tzs INTEGER,
    p_service_fee_max_tzs INTEGER,
    p_delivery_min_order_tzs INTEGER,
    p_commission_bps_delivery INTEGER,
    p_commission_bps_takeaway INTEGER,
    p_commission_bps_dine_in INTEGER,
    p_new_restaurant_free_days INTEGER,
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
    PERFORM public.require_admin_aal2();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    IF NOT public.is_super_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN role required to modify platform financial fee rules.';
    END IF;

    IF length(trim(COALESCE(p_change_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: A descriptive change reason (minimum 4 characters) is required.';
    END IF;

    -- Validate ranges
    IF p_service_fee_bps < 0 OR p_service_fee_bps > 10000 OR
       p_service_fee_min_tzs < 0 OR
       p_service_fee_max_tzs < p_service_fee_min_tzs OR
       p_delivery_min_order_tzs < 0 OR
       p_commission_bps_delivery < 0 OR p_commission_bps_delivery > 10000 OR
       p_commission_bps_takeaway < 0 OR p_commission_bps_takeaway > 10000 OR
       p_commission_bps_dine_in < 0 OR p_commission_bps_dine_in > 10000 OR
       p_new_restaurant_free_days < 0
    THEN
        RAISE EXCEPTION '400 Bad Request: Fee parameters out of operational bounds.';
    END IF;

    -- Lock singleton row
    SELECT * INTO v_old
    FROM public.platform_financial_settings
    WHERE id = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '500 Internal Error: Platform financial settings singleton row not found.';
    END IF;

    -- Update singleton settings
    UPDATE public.platform_financial_settings
    SET
        service_fee_bps = p_service_fee_bps,
        service_fee_min_tzs = p_service_fee_min_tzs,
        service_fee_max_tzs = p_service_fee_max_tzs,
        delivery_min_order_tzs = p_delivery_min_order_tzs,
        commission_bps_delivery = p_commission_bps_delivery,
        commission_bps_takeaway = p_commission_bps_takeaway,
        commission_bps_dine_in = p_commission_bps_dine_in,
        new_restaurant_free_days = p_new_restaurant_free_days,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        change_reason = p_change_reason
    WHERE id = TRUE
    RETURNING * INTO v_new;

    -- Atomic audit log entry
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor), 'Super Admin'),
        'UPDATE_PLATFORM_FEE_RULES',
        'PLATFORM_SETTINGS',
        'FINANCIAL_FEES',
        jsonb_build_object(
            'previous', jsonb_build_object(
                'service_fee_bps', v_old.service_fee_bps,
                'service_fee_min_tzs', v_old.service_fee_min_tzs,
                'service_fee_max_tzs', v_old.service_fee_max_tzs,
                'delivery_min_order_tzs', v_old.delivery_min_order_tzs,
                'commission_bps_delivery', v_old.commission_bps_delivery,
                'commission_bps_takeaway', v_old.commission_bps_takeaway,
                'commission_bps_dine_in', v_old.commission_bps_dine_in,
                'new_restaurant_free_days', v_old.new_restaurant_free_days
            ),
            'new', jsonb_build_object(
                'service_fee_bps', p_service_fee_bps,
                'service_fee_min_tzs', p_service_fee_min_tzs,
                'service_fee_max_tzs', p_service_fee_max_tzs,
                'delivery_min_order_tzs', p_delivery_min_order_tzs,
                'commission_bps_delivery', p_commission_bps_delivery,
                'commission_bps_takeaway', p_commission_bps_takeaway,
                'commission_bps_dine_in', p_commission_bps_dine_in,
                'new_restaurant_free_days', p_new_restaurant_free_days
            ),
            'change_reason', p_change_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'service_fee_bps', v_new.service_fee_bps,
        'service_fee_min_tzs', v_new.service_fee_min_tzs,
        'service_fee_max_tzs', v_new.service_fee_max_tzs,
        'delivery_min_order_tzs', v_new.delivery_min_order_tzs,
        'commission_bps_delivery', v_new.commission_bps_delivery,
        'commission_bps_takeaway', v_new.commission_bps_takeaway,
        'commission_bps_dine_in', v_new.commission_bps_dine_in,
        'new_restaurant_free_days', v_new.new_restaurant_free_days,
        'updated_at', v_new.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_fee_rules_secure(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_fee_rules_secure(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. PUBLIC RPC: get_public_fee_rules (Customer-Facing Values Only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_fee_rules()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row RECORD;
BEGIN
    SELECT
        service_fee_bps,
        service_fee_min_tzs,
        service_fee_max_tzs,
        delivery_min_order_tzs,
        minimum_order_value_tzs,
        currency
    INTO v_row
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    RETURN jsonb_build_object(
        'service_fee_bps', COALESCE(v_row.service_fee_bps, 300),
        'service_fee_min_tzs', COALESCE(v_row.service_fee_min_tzs, 200),
        'service_fee_max_tzs', COALESCE(v_row.service_fee_max_tzs, 500),
        'delivery_min_order_tzs', COALESCE(v_row.delivery_min_order_tzs, 5000),
        'minimum_order_value_tzs', COALESCE(v_row.minimum_order_value_tzs, 2000),
        'currency', COALESCE(v_row.currency, 'TZS')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_fee_rules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_fee_rules() TO anon, authenticated, service_role;
