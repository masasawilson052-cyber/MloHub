-- =============================================================================
-- MloHub Forward Migration: 20260924000003_customer_commerce_profile_closure.sql
-- Menu Modifiers Validation, Custom Meal Open Budget & Reorder Truth Engine
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. SERVER-AUTHORITATIVE MENU MODIFIER VALIDATION FUNCTION (Phase 31)
-- Validates groups, options, required selections, and loads real price deltas
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_menu_item_modifiers(
    p_menu_item_id VARCHAR(80),
    p_selected_modifiers JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_delta BIGINT := 0;
    v_snapshot JSONB := '[]'::jsonb;
    v_grp RECORD;
    v_opt RECORD;
    v_sel RECORD;
    v_opt_id_text TEXT;
    v_opt_id UUID;
    v_selected_count INTEGER;
    v_opt_ids_for_group TEXT[];
BEGIN
    -- If no modifiers supplied or empty array
    IF p_selected_modifiers IS NULL OR jsonb_array_length(p_selected_modifiers) = 0 THEN
        -- Check if any modifier groups for this item are marked IS_REQUIRED
        FOR v_grp IN
            SELECT * FROM public.menu_modifier_groups
            WHERE menu_item_id = p_menu_item_id AND is_required = TRUE
        LOOP
            RAISE EXCEPTION '400 Bad Request: Modifier group "%" is required.', v_grp.name;
        END LOOP;

        RETURN jsonb_build_object(
            'price_delta_tzs', 0,
            'snapshot', '[]'::jsonb
        );
    END IF;

    -- Validate each modifier group configured for the menu item
    FOR v_grp IN
        SELECT * FROM public.menu_modifier_groups
        WHERE menu_item_id = p_menu_item_id
    LOOP
        v_selected_count := 0;
        v_opt_ids_for_group := ARRAY[]::TEXT[];

        -- Find customer selections matching this group
        FOR v_sel IN
            SELECT * FROM jsonb_to_recordset(p_selected_modifiers)
            AS (group_id UUID, option_ids JSONB)
            WHERE group_id = v_grp.id
        LOOP
            -- Loop over option_ids in this selection
            FOR v_opt_id_text IN
                SELECT jsonb_array_elements_text(v_sel.option_ids)
            LOOP
                -- Prevent duplicates in selection
                IF v_opt_id_text = ANY(v_opt_ids_for_group) THEN
                    RAISE EXCEPTION '400 Bad Request: Duplicate modifier option selected in group "%".', v_grp.name;
                END IF;
                v_opt_ids_for_group := array_append(v_opt_ids_for_group, v_opt_id_text);
                v_opt_id := v_opt_id_text::UUID;

                -- Load option strictly from DB
                SELECT * INTO v_opt
                FROM public.menu_modifier_options
                WHERE id = v_opt_id AND group_id = v_grp.id;

                IF NOT FOUND THEN
                    RAISE EXCEPTION '404 Not Found: Modifier option % does not belong to group "%".', v_opt_id_text, v_grp.name;
                END IF;

                IF v_opt.is_available = FALSE THEN
                    RAISE EXCEPTION '409 Conflict: Modifier option "%" is currently out of stock.', v_opt.name;
                END IF;

                v_selected_count := v_selected_count + 1;
                v_total_delta := v_total_delta + v_opt.price_delta_tzs;

                v_snapshot := v_snapshot || jsonb_build_object(
                    'group_id', v_grp.id,
                    'group_name', v_grp.name,
                    'option_id', v_opt.id,
                    'option_name', v_opt.name,
                    'price_delta_tzs', v_opt.price_delta_tzs
                );
            END LOOP;
        END LOOP;

        -- Enforce required
        IF v_grp.is_required = TRUE AND v_selected_count = 0 THEN
            RAISE EXCEPTION '400 Bad Request: Selection required for modifier group "%".', v_grp.name;
        END IF;

        -- Enforce min selections
        IF v_selected_count > 0 AND v_selected_count < v_grp.min_selections THEN
            RAISE EXCEPTION '400 Bad Request: Minimum % selections required for "%" (received %).',
                v_grp.min_selections, v_grp.name, v_selected_count;
        END IF;

        -- Enforce max selections
        IF v_selected_count > v_grp.max_selections THEN
            RAISE EXCEPTION '400 Bad Request: Maximum % selections allowed for "%" (received %).',
                v_grp.max_selections, v_grp.name, v_selected_count;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'price_delta_tzs', v_total_delta,
        'snapshot', v_snapshot
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_menu_item_modifiers(VARCHAR, JSONB) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. CREATE_ORDER_SECURE WITH MODIFIER PARSING & CALCULATION (Phase 32)
-- ----------------------------------------------------------------------------

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
    v_base_trusted_price INTEGER;
    v_item_name TEXT;
    v_is_available BOOLEAN;
    v_is_archived BOOLEAN;
    v_line_subtotal INTEGER;
    v_items_count INTEGER := 0;
    v_total_units INTEGER := 0;
    v_op_status JSONB;
    v_now TIMESTAMPTZ := clock_timestamp();
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
    v_mod_result JSONB;
    v_mod_delta INTEGER;
    v_mod_snapshot JSONB;
    v_trusted_unit_price INTEGER;
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

    -- DELIVERY ZONE: required for delivery orders
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
            RAISE EXCEPTION 'DELIVERY_ZONE_UNSUPPORTED: Delivery zone % does not serve branch % or is inactive.',
                p_delivery_zone_id, p_branch_id;
        END IF;

        v_delivery_fee := v_zone.fee_tzs;
    ELSE
        v_delivery_fee := 0;
        v_zone := NULL;
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
        v_prep_quote,
        v_now,
        v_now
    );

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

REVOKE ALL ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. CUSTOM MEAL REQUEST WITH OPEN BUDGET & PRIVACY TRUTH (Phase 43 & 46)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_structured_custom_meal_request(
    p_title VARCHAR(150),
    p_description TEXT,
    p_occasion custom_meal_occasion_enum,
    p_servings INTEGER,
    p_cuisine_type VARCHAR(80),
    p_budget_type budget_type_enum,
    p_budget_min_tzs INTEGER,
    p_budget_max_tzs INTEGER,
    p_spice_level spice_level_enum,
    p_ingredients_requested TEXT[],
    p_ingredients_to_avoid TEXT[],
    p_dietary_tags TEXT[],
    p_allergens TEXT[],
    p_desired_at TIMESTAMPTZ,
    p_quote_deadline TIMESTAMPTZ,
    p_fulfillment_mode custom_meal_fulfillment_enum,
    p_customer_area VARCHAR(100),
    p_landmark VARCHAR(150),
    p_exact_delivery_address TEXT,
    p_exact_delivery_phone VARCHAR(30),
    p_reference_images TEXT[] DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_request_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_active_count INTEGER;
    v_expires_at TIMESTAMPTZ;
    v_eff_budget_min INTEGER;
    v_eff_budget_max INTEGER;
    v_legacy_budget INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to create custom meal request.';
    END IF;

    IF nullif(btrim(p_title),'') IS NULL OR nullif(btrim(p_customer_area),'') IS NULL THEN
        RAISE EXCEPTION 'Food name and service area are required.';
    END IF;

    -- Serialize active-request check
    PERFORM id FROM public.profiles WHERE id = v_user_id FOR UPDATE;

    SELECT COUNT(*) INTO v_active_count
    FROM public.custom_meal_requests
    WHERE user_id = v_user_id
      AND status IN ('PENDING', 'QUOTES_RECEIVED', 'QUOTE_ACCEPTED');

    IF v_active_count >= 3 THEN
        RAISE EXCEPTION '429 Too Many Requests: Maximum 3 active custom meal requests permitted simultaneously.';
    END IF;

    IF p_desired_at IS NULL OR p_desired_at <= NOW() + INTERVAL '30 minutes' THEN
        RAISE EXCEPTION '400 Bad Request: desired_at must be at least 30 minutes in the future.';
    END IF;

    IF p_quote_deadline IS NULL OR p_quote_deadline >= p_desired_at OR p_quote_deadline <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: quote_deadline must be in the future and before desired_at.';
    END IF;

    IF p_servings IS NULL OR p_servings < 1 THEN
        RAISE EXCEPTION '400 Bad Request: Servings must be at least 1.';
    END IF;

    -- Truthful Budget Type Validation (Phase 43)
    IF p_budget_type = 'FIXED' THEN
        IF p_budget_min_tzs IS NULL OR p_budget_min_tzs < 5000 THEN
            RAISE EXCEPTION '400 Bad Request: Fixed budget must be at least 5,000 TZS.';
        END IF;
        v_eff_budget_min := p_budget_min_tzs;
        v_eff_budget_max := p_budget_min_tzs;
        v_legacy_budget  := p_budget_min_tzs;
    ELSIF p_budget_type = 'RANGE' THEN
        IF p_budget_min_tzs IS NULL OR p_budget_min_tzs < 5000 OR p_budget_max_tzs IS NULL OR p_budget_max_tzs < p_budget_min_tzs THEN
            RAISE EXCEPTION '400 Bad Request: Enter a valid budget range of at least 5,000 TZS.';
        END IF;
        v_eff_budget_min := p_budget_min_tzs;
        v_eff_budget_max := p_budget_max_tzs;
        v_legacy_budget  := p_budget_min_tzs;
    ELSIF p_budget_type = 'OPEN_TO_QUOTES' THEN
        -- Open budget preserves NULL values without false defaults
        v_eff_budget_min := NULL;
        v_eff_budget_max := NULL;
        v_legacy_budget  := 0;
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid budget type %.', p_budget_type;
    END IF;

    v_request_id := 'req_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-REQ-' || substr(to_char(NOW(), 'YYMMDDHH24MISS'), 3) || '-' || substr(md5(random()::text), 1, 4);
    v_expires_at := p_desired_at;

    -- Insert request row
    INSERT INTO public.custom_meal_requests (
        id, order_number, user_id, dish_name, title, special_instructions,
        budget_tzs, budget_type, budget_min_tzs, budget_max_tzs, servings_count,
        dining_option, fulfillment_mode, delivery_location, customer_area, landmark,
        exact_delivery_address, exact_delivery_phone, occasion, cuisine_type, spice_level,
        ingredients_requested, ingredients_to_avoid, dietary_tags, allergens,
        desired_at, quote_deadline, expires_at, reference_images, status,
        status_message_en, status_message_sw, updated_at
    ) VALUES (
        v_request_id, v_order_number, v_user_id, p_title, p_title, p_description,
        v_legacy_budget, p_budget_type, v_eff_budget_min, v_eff_budget_max,
        p_servings::text, p_fulfillment_mode::text, p_fulfillment_mode,
        COALESCE(p_customer_area, 'Dar es Salaam'), p_customer_area, p_landmark,
        NULL, NULL, -- Redacted until winner quote payment
        p_occasion, COALESCE(NULLIF(trim(p_cuisine_type), ''), 'Swahili'), p_spice_level,
        COALESCE(p_ingredients_requested, '{}'), COALESCE(p_ingredients_to_avoid, '{}'),
        COALESCE(p_dietary_tags, '{}'), COALESCE(p_allergens, '{}'),
        p_desired_at, p_quote_deadline, v_expires_at, COALESCE(p_reference_images, '{}'),
        'PENDING', 'Request created. Finding qualified kitchens...', 'Ombi limeundwa. Inatafuta wapishi...',
        clock_timestamp()
    );

    -- Insert private contact details into protected relation if provided
    IF (p_exact_delivery_address IS NOT NULL AND btrim(p_exact_delivery_address) <> '') OR
       (p_exact_delivery_phone IS NOT NULL AND btrim(p_exact_delivery_phone) <> '') THEN
        INSERT INTO public.custom_meal_delivery_details (
            request_id,
            user_id,
            exact_delivery_address,
            exact_delivery_phone,
            landmark,
            updated_at
        ) VALUES (
            v_request_id,
            v_user_id,
            p_exact_delivery_address,
            p_exact_delivery_phone,
            p_landmark,
            clock_timestamp()
        )
        ON CONFLICT (request_id) DO UPDATE SET
            exact_delivery_address = EXCLUDED.exact_delivery_address,
            exact_delivery_phone = EXCLUDED.exact_delivery_phone,
            landmark = EXCLUDED.landmark,
            updated_at = clock_timestamp();
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_request_id,
        'order_number', v_order_number,
        'budget_type', p_budget_type,
        'budget_min_tzs', v_eff_budget_min,
        'budget_max_tzs', v_eff_budget_max
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_structured_custom_meal_request TO authenticated, service_role;

-- RPC: set_custom_meal_delivery_details_secure (Phase 46)
CREATE OR REPLACE FUNCTION public.set_custom_meal_delivery_details_secure(
    p_request_id VARCHAR(80),
    p_delivery_address TEXT,
    p_delivery_phone VARCHAR(30),
    p_landmark VARCHAR(150) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_req RECORD;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % not found.', p_request_id;
    END IF;

    IF v_req.user_id != v_actor THEN
        RAISE EXCEPTION '403 Forbidden: You do not own this custom meal request.';
    END IF;

    IF v_req.status IN ('COMPLETED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION '400 Bad Request: Cannot update delivery details on % request.', v_req.status;
    END IF;

    -- Save in secure delivery details table
    INSERT INTO public.custom_meal_delivery_details (
        request_id, user_id, exact_delivery_address, exact_delivery_phone, landmark, updated_at
    ) VALUES (
        p_request_id, v_actor, p_delivery_address, p_delivery_phone, p_landmark, clock_timestamp()
    )
    ON CONFLICT (request_id) DO UPDATE SET
        exact_delivery_address = EXCLUDED.exact_delivery_address,
        exact_delivery_phone = EXCLUDED.exact_delivery_phone,
        landmark = EXCLUDED.landmark,
        updated_at = clock_timestamp();

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', p_request_id,
        'delivery_address', p_delivery_address,
        'delivery_phone', p_delivery_phone
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_custom_meal_delivery_details_secure(VARCHAR, TEXT, VARCHAR, VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. PREPARE REORDER SECURE RPC (Phase 63 & 64)
-- Checks item availability, price changes, and modifier validity
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prepare_reorder_secure(
    p_order_id VARCHAR(80)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_order RECORD;
    v_item RECORD;
    v_mi RECORD;
    v_curr_price INTEGER;
    v_available_items JSONB := '[]'::jsonb;
    v_price_changed_items JSONB := '[]'::jsonb;
    v_unavailable_items JSONB := '[]'::jsonb;
    v_restaurant_available BOOLEAN := FALSE;
    v_mod_valid BOOLEAN;
    v_mod_result JSONB;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % not found.', p_order_id;
    END IF;

    IF v_order.user_id != v_actor THEN
        RAISE EXCEPTION '403 Forbidden: You can only reorder your own orders.';
    END IF;

    -- Check restaurant visibility
    v_restaurant_available := public.is_restaurant_customer_visible(v_order.restaurant_id);

    IF NOT v_restaurant_available THEN
        RETURN jsonb_build_object(
            'restaurant_available', FALSE,
            'restaurant_id', v_order.restaurant_id,
            'available_items', '[]'::jsonb,
            'price_changed_items', '[]'::jsonb,
            'unavailable_items', '[]'::jsonb
        );
    END IF;

    -- Evaluate each historical order item
    FOR v_item IN
        SELECT oi.*
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
    LOOP
        SELECT
            mi.*,
            COALESCE(bmi.price_tzs, mi.price_tzs) AS eff_price,
            COALESCE(bmi.is_available, mi.is_available) AS eff_available,
            COALESCE(bmi.stock_status, mi.stock_status, 'IN_STOCK'::item_stock_status_enum) AS eff_stock_status
        INTO v_mi
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_item_overrides bmi
            ON bmi.menu_item_id = mi.id AND bmi.branch_id = v_order.branch_id
        WHERE mi.id = v_item.menu_item_id;

        -- Check item existence and availability
        IF NOT FOUND OR v_mi.is_archived = TRUE OR v_mi.eff_available = FALSE OR v_mi.eff_stock_status = 'OUT_OF_STOCK' THEN
            v_unavailable_items := v_unavailable_items || jsonb_build_object(
                'menu_item_id', v_item.menu_item_id,
                'name', v_item.item_name_snapshot,
                'historical_price_tzs', v_item.unit_price_tzs,
                'reason', 'Item is currently unavailable or out of stock'
            );
        ELSE
            v_curr_price := v_mi.eff_price;

            -- Check if historical modifiers are still valid
            v_mod_valid := TRUE;
            IF v_item.selected_modifiers IS NOT NULL AND jsonb_array_length(v_item.selected_modifiers) > 0 THEN
                BEGIN
                    v_mod_result := public.validate_menu_item_modifiers(v_item.menu_item_id, v_item.selected_modifiers);
                EXCEPTION WHEN OTHERS THEN
                    v_mod_valid := FALSE;
                END;
            END IF;

            IF NOT v_mod_valid THEN
                v_unavailable_items := v_unavailable_items || jsonb_build_object(
                    'menu_item_id', v_item.menu_item_id,
                    'name', v_item.item_name_snapshot,
                    'historical_price_tzs', v_item.unit_price_tzs,
                    'reason', 'Customization options have changed. Please re-select modifiers.'
                );
            ELSIF v_curr_price != v_item.unit_price_tzs THEN
                v_price_changed_items := v_price_changed_items || jsonb_build_object(
                    'menu_item_id', v_item.menu_item_id,
                    'name', v_item.item_name_snapshot,
                    'historical_price_tzs', v_item.unit_price_tzs,
                    'current_price_tzs', v_curr_price,
                    'quantity', v_item.quantity,
                    'selected_modifiers', v_item.selected_modifiers,
                    'special_notes', v_item.special_notes
                );
            ELSE
                v_available_items := v_available_items || jsonb_build_object(
                    'menu_item_id', v_item.menu_item_id,
                    'name', v_item.item_name_snapshot,
                    'price_tzs', v_curr_price,
                    'quantity', v_item.quantity,
                    'selected_modifiers', v_item.selected_modifiers,
                    'special_notes', v_item.special_notes
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'restaurant_available', TRUE,
        'restaurant_id', v_order.restaurant_id,
        'branch_id', v_order.branch_id,
        'available_items', v_available_items,
        'price_changed_items', v_price_changed_items,
        'unavailable_items', v_unavailable_items
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_reorder_secure(VARCHAR) TO authenticated, service_role;
