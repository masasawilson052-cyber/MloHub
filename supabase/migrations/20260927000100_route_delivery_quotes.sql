-- ============================================================================
-- MIGRATION: 20260927000100_route_delivery_quotes.sql
-- MLOHUB: Server-Authoritative Route-Based Delivery Quote System
-- ============================================================================

-- 1. Create public.branch_delivery_pricing table
CREATE TABLE IF NOT EXISTS public.branch_delivery_pricing (
    branch_id UUID PRIMARY KEY REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    pricing_mode VARCHAR(30) NOT NULL DEFAULT 'ROUTE_DISTANCE',
    base_fee_tzs INTEGER NOT NULL DEFAULT 2000,
    included_distance_meters INTEGER NOT NULL DEFAULT 2000,
    billing_increment_meters INTEGER NOT NULL DEFAULT 1000,
    fee_per_increment_tzs INTEGER NOT NULL DEFAULT 500,
    minimum_fee_tzs INTEGER NOT NULL DEFAULT 2000,
    maximum_fee_tzs INTEGER NOT NULL DEFAULT 15000,
    max_delivery_distance_meters INTEGER NOT NULL DEFAULT 25000,
    configuration_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'branch_delivery_pricing' AND column_name = 'pricing_mode'
    ) THEN
        ALTER TABLE public.branch_delivery_pricing ADD COLUMN pricing_mode VARCHAR(30) NOT NULL DEFAULT 'ROUTE_DISTANCE';
    END IF;
END $$;

ALTER TABLE public.branch_delivery_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch delivery pricing is viewable by everyone"
    ON public.branch_delivery_pricing
    FOR SELECT
    USING (TRUE);

CREATE POLICY "Branch delivery pricing is manageable by service role and branch owners"
    ON public.branch_delivery_pricing
    FOR ALL
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurants r ON r.id = rb.restaurant_id
            WHERE rb.id = branch_delivery_pricing.branch_id
              AND (r.owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
        )
    );

-- 2. Create public.delivery_quotes table
CREATE TABLE IF NOT EXISTS public.delivery_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    saved_address_id UUID REFERENCES public.customer_saved_addresses(id) ON DELETE SET NULL,
    delivery_zone_id UUID REFERENCES public.branch_delivery_zones(id) ON DELETE SET NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    destination_latitude DOUBLE PRECISION NOT NULL,
    destination_longitude DOUBLE PRECISION NOT NULL,
    distance_meters INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    delivery_fee_tzs INTEGER NOT NULL,
    pricing_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_by_order_id VARCHAR(80) REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'delivery_quotes' AND column_name = 'saved_address_id'
    ) THEN
        ALTER TABLE public.delivery_quotes ADD COLUMN saved_address_id UUID REFERENCES public.customer_saved_addresses(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'delivery_quotes' AND column_name = 'delivery_zone_id'
    ) THEN
        ALTER TABLE public.delivery_quotes ADD COLUMN delivery_zone_id UUID REFERENCES public.branch_delivery_zones(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_user ON public.delivery_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_branch ON public.delivery_quotes(branch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_expires ON public.delivery_quotes(expires_at);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_consumed ON public.delivery_quotes(consumed_at);

ALTER TABLE public.delivery_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own delivery quotes"
    ON public.delivery_quotes
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 3. Add delivery quote tracking columns to public.orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_quote_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_quote_id UUID REFERENCES public.delivery_quotes(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_distance_meters'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_distance_meters INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_duration_seconds'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_duration_seconds INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_destination_latitude'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_destination_latitude DOUBLE PRECISION;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_destination_longitude'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_destination_longitude DOUBLE PRECISION;
    END IF;
END $$;

-- 4. Authoritative create_order_secure with Route-Based Quote Consumption
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
    v_service_fee INTEGER := 1500;
    v_min_order_subtotal INTEGER := 2000;
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
        customer_service_fee_tzs,
        minimum_order_value_tzs
    INTO
        v_service_fee,
        v_min_order_subtotal
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    v_service_fee := COALESCE(v_service_fee, 1500);
    v_min_order_subtotal := COALESCE(v_min_order_subtotal, 2000);

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
        ELSE
            RAISE EXCEPTION 'DELIVERY_PRICING_INVALID: Unsupported branch delivery pricing mode %.', v_pricing_mode;
        END IF;
    ELSE
        -- Takeaway / Dine-In has ZERO delivery fee
        v_delivery_fee := 0;
        v_zone := NULL;
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
        'total_tzs', v_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Permissions
REVOKE ALL ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;
