-- ============================================================================
-- MLOHUB RESTAURANT PHASE 2: DAILY OPERATIONS, ORDERS, KITCHEN & MODIFIERS
-- Migration: 20260928000200_restaurant_operations_and_modifiers.sql
-- ============================================================================
-- Establishes:
-- 1. Canonical notification event: RESTAURANT_NEW_PAID_ORDER
-- 2. Direct recipient routing for RESTAURANT_NEW_PAID_ORDER to restaurant staff
-- 3. In-App and Push notification templates for RESTAURANT_NEW_PAID_ORDER
-- 4. Authoritative order trigger emitting RESTAURANT_NEW_PAID_ORDER on payment SUCCESS
-- 5. Server-authoritative RPC replace_menu_item_modifiers_secure() with OWNER/MANAGER auth
-- 6. Comprehensive RLS policies on menu_modifier_groups and menu_modifier_options
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM EXTENSION FOR RESTAURANT_NEW_PAID_ORDER
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'notification_event_type_enum'
          AND e.enumlabel = 'RESTAURANT_NEW_PAID_ORDER'
    ) THEN
        ALTER TYPE public.notification_event_type_enum ADD VALUE 'RESTAURANT_NEW_PAID_ORDER';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION TEMPLATES FOR RESTAURANT_NEW_PAID_ORDER
-- ----------------------------------------------------------------------------
DELETE FROM public.notification_templates WHERE event_type = 'RESTAURANT_NEW_PAID_ORDER';

INSERT INTO public.notification_templates (event_type, channel, locale, title_template, body_template, allowlisted_keys)
VALUES
-- In-App (English)
('RESTAURANT_NEW_PAID_ORDER', 'IN_APP', 'en',
 'New paid order',
 'Order #{{order_number}} • TSh {{total_tzs}}',
 ARRAY['order_number', 'total_tzs']),

-- In-App (Swahili)
('RESTAURANT_NEW_PAID_ORDER', 'IN_APP', 'sw',
 'Oda mpya iliyolipwa',
 'Oda #{{order_number}} • TSh {{total_tzs}}',
 ARRAY['order_number', 'total_tzs']),

-- Push (English)
('RESTAURANT_NEW_PAID_ORDER', 'PUSH', 'en',
 'New paid order',
 'Order #{{order_number}} • TSh {{total_tzs}}',
 ARRAY['order_number', 'total_tzs']),

-- Push (Swahili)
('RESTAURANT_NEW_PAID_ORDER', 'PUSH', 'sw',
 'Oda mpya iliyolipwa',
 'Oda #{{order_number}} • TSh {{total_tzs}}',
 ARRAY['order_number', 'total_tzs']);

-- ----------------------------------------------------------------------------
-- 3. UPDATE SERVER-AUTHORITATIVE RECIPIENT RESOLUTION FUNCTION
-- ----------------------------------------------------------------------------
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
    -- Canonical restaurant paid order alert: Exclusively to restaurant staff
    IF p_event_type = 'RESTAURANT_NEW_PAID_ORDER' THEN
        RETURN QUERY
        SELECT DISTINCT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        JOIN public.restaurant_members rm ON rm.restaurant_id = o.restaurant_id
        WHERE o.id = p_aggregate_id
          AND rm.is_active = TRUE
          AND (
              rm.role IN ('OWNER', 'MANAGER', 'CHEF')
              OR 'ALL' = ANY(rm.permissions)
              OR 'ORDERS' = ANY(rm.permissions)
              OR 'VIEW_ORDERS' = ANY(rm.permissions)
              OR 'MANAGE_ORDERS' = ANY(rm.permissions)
          );
        RETURN;
    END IF;

    IF p_aggregate_type = 'ORDER' THEN
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
        -- Target restaurant managers
        IF p_payload ? 'restaurant_id' THEN
            RETURN QUERY
            SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
            FROM public.restaurant_members rm
            WHERE rm.restaurant_id = (p_payload->>'restaurant_id')
              AND rm.is_active = true
              AND ('ALL' = ANY(rm.permissions) OR 'REVIEWS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
        END IF;

    ELSIF p_aggregate_type = 'APPLICATION' THEN
        -- Target applicant user
        IF p_payload ? 'applicant_user_id' THEN
            RETURN QUERY
            SELECT (p_payload->>'applicant_user_id')::UUID, 'APPLICANT'::VARCHAR(50), 'sw'::VARCHAR(10);
        END IF;

    ELSIF p_aggregate_type = 'USER' THEN
        -- Direct user notification
        RETURN QUERY
        SELECT p_aggregate_id::UUID, 'USER'::VARCHAR(50), 'sw'::VARCHAR(10);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ORDER NOTIFICATION TRIGGER EMITTING RESTAURANT_NEW_PAID_ORDER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_emit_order_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_evt notification_event_type_enum;
    v_is_new_paid BOOLEAN := FALSE;
BEGIN
    -- Check if payment just became SUCCESS
    IF NEW.payment_status = 'SUCCESS' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'SUCCESS') THEN
        v_is_new_paid := TRUE;
    END IF;

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

    -- Standard lifecycle event
    IF v_evt IS NOT NULL THEN
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

    -- Canonical Restaurant New Paid Order Event
    -- Emitted exclusively when order has confirmed payment
    IF v_is_new_paid THEN
        PERFORM public.emit_notification_event(
            p_event_type := 'RESTAURANT_NEW_PAID_ORDER'::notification_event_type_enum,
            p_aggregate_type := 'ORDER',
            p_aggregate_id := NEW.id,
            p_payload := jsonb_build_object(
                'order_id', NEW.id,
                'order_number', NEW.order_number,
                'restaurant_id', NEW.restaurant_id,
                'branch_id', NEW.branch_id,
                'total_tzs', NEW.total_tzs
            ),
            p_priority := 'HIGH'::notification_priority_enum,
            p_communication_class := 'TRANSACTIONAL'::communication_class_enum
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notification_event ON public.orders;
CREATE TRIGGER trg_orders_notification_event
    AFTER INSERT OR UPDATE OF status, payment_status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_emit_order_notification_event();

-- ----------------------------------------------------------------------------
-- 5. SERVER AUTHORITATIVE MODIFIER SAVE RPC: replace_menu_item_modifiers_secure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_menu_item_modifiers_secure(
    p_menu_item_id VARCHAR(80),
    p_groups JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id VARCHAR(80);
    v_is_authorized BOOLEAN := FALSE;
    v_group_elem JSONB;
    v_option_elem JSONB;
    v_group_id UUID;
    v_group_name TEXT;
    v_min_sel INT;
    v_max_sel INT;
    v_is_req BOOLEAN;
    v_grp_sort INT;
    v_opt_name TEXT;
    v_opt_delta BIGINT;
    v_opt_avail BOOLEAN;
    v_opt_sort INT;
    v_group_idx INT := 0;
    v_opt_idx INT := 0;
    v_total_options_inserted INT := 0;
BEGIN
    -- 1. Locate menu item and restaurant
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.menu_items
    WHERE id = p_menu_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Menu item "%" does not exist', p_menu_item_id;
    END IF;

    -- 2. Verify caller authorization (OWNER or MANAGER of the owning restaurant, or service_role/admin)
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSIF public.is_admin(auth.uid()) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = v_restaurant_id
              AND user_id = auth.uid()
              AND is_active = TRUE
              AND role IN ('OWNER', 'MANAGER')
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller must be OWNER or MANAGER of restaurant "%" to edit modifiers', v_restaurant_id;
    END IF;

    -- 3. Validate input payload is a JSON array
    IF p_groups IS NULL OR jsonb_typeof(p_groups) <> 'array' THEN
        RAISE EXCEPTION '400 Bad Request: p_groups must be a JSON array';
    END IF;

    -- 4. Atomically delete existing modifier groups and options for this menu item
    DELETE FROM public.menu_modifier_options
    WHERE group_id IN (
        SELECT id FROM public.menu_modifier_groups WHERE menu_item_id = p_menu_item_id
    );

    DELETE FROM public.menu_modifier_groups
    WHERE menu_item_id = p_menu_item_id;

    -- 5. Insert new groups and their respective options
    FOR v_group_elem IN SELECT * FROM jsonb_array_elements(p_groups)
    LOOP
        v_group_idx := v_group_idx + 1;
        v_group_name := trim(COALESCE(v_group_elem->>'name', ''));
        IF length(v_group_name) = 0 THEN
            RAISE EXCEPTION '400 Bad Request: Modifier group at index % has an empty name', v_group_idx;
        END IF;

        v_min_sel := COALESCE(
            (v_group_elem->>'minSelections')::INT,
            (v_group_elem->>'minSelect')::INT,
            (v_group_elem->>'min_selections')::INT,
            0
        );
        v_max_sel := COALESCE(
            (v_group_elem->>'maxSelections')::INT,
            (v_group_elem->>'maxSelect')::INT,
            (v_group_elem->>'max_selections')::INT,
            1
        );
        v_is_req := COALESCE(
            (v_group_elem->>'isRequired')::BOOLEAN,
            (v_group_elem->>'is_required')::BOOLEAN,
            FALSE
        );
        v_grp_sort := COALESCE(
            (v_group_elem->>'sortOrder')::INT,
            (v_group_elem->>'sort_order')::INT,
            v_group_idx
        );

        IF v_is_req AND v_min_sel < 1 THEN
            v_min_sel := 1;
        END IF;

        IF v_max_sel < v_min_sel THEN
            RAISE EXCEPTION '400 Bad Request: Modifier group "%" has maxSelections (%) < minSelections (%)',
                v_group_name, v_max_sel, v_min_sel;
        END IF;

        -- Group ID: reuse provided UUID or generate new
        IF v_group_elem ? 'id' AND length(v_group_elem->>'id') = 36 THEN
            v_group_id := (v_group_elem->>'id')::UUID;
        ELSE
            v_group_id := gen_random_uuid();
        END IF;

        INSERT INTO public.menu_modifier_groups (
            id,
            menu_item_id,
            name,
            min_selections,
            max_selections,
            is_required,
            sort_order,
            created_at
        ) VALUES (
            v_group_id,
            p_menu_item_id,
            v_group_name,
            v_min_sel,
            v_max_sel,
            v_is_req,
            v_grp_sort,
            clock_timestamp()
        );

        -- Insert child options if present
        v_opt_idx := 0;
        IF v_group_elem ? 'options' AND jsonb_typeof(v_group_elem->'options') = 'array' THEN
            FOR v_option_elem IN SELECT * FROM jsonb_array_elements(v_group_elem->'options')
            LOOP
                v_opt_idx := v_opt_idx + 1;
                v_opt_name := trim(COALESCE(v_option_elem->>'name', ''));
                IF length(v_opt_name) = 0 THEN
                    RAISE EXCEPTION '400 Bad Request: Option at index % in group "%" has an empty name',
                        v_opt_idx, v_group_name;
                END IF;

                v_opt_delta := COALESCE(
                    (v_option_elem->>'priceDeltaTzs')::BIGINT,
                    (v_option_elem->>'price_delta_tzs')::BIGINT,
                    0
                );
                IF v_opt_delta < 0 THEN
                    RAISE EXCEPTION '400 Bad Request: Option "%" in group "%" has negative price delta',
                        v_opt_name, v_group_name;
                END IF;

                v_opt_avail := COALESCE(
                    (v_option_elem->>'isAvailable')::BOOLEAN,
                    (v_option_elem->>'is_available')::BOOLEAN,
                    TRUE
                );
                v_opt_sort := COALESCE(
                    (v_option_elem->>'sortOrder')::INT,
                    (v_option_elem->>'sort_order')::INT,
                    v_opt_idx
                );

                INSERT INTO public.menu_modifier_options (
                    id,
                    group_id,
                    name,
                    price_delta_tzs,
                    is_available,
                    sort_order,
                    created_at
                ) VALUES (
                    COALESCE(
                        CASE WHEN v_option_elem ? 'id' AND length(v_option_elem->>'id') = 36
                             THEN (v_option_elem->>'id')::UUID
                             ELSE NULL END,
                        gen_random_uuid()
                    ),
                    v_group_id,
                    v_opt_name,
                    v_opt_delta,
                    v_opt_avail,
                    v_opt_sort,
                    clock_timestamp()
                );

                v_total_options_inserted := v_total_options_inserted + 1;
            END LOOP;
        END IF;

        IF v_opt_idx < v_min_sel THEN
            RAISE EXCEPTION '400 Bad Request: Modifier group "%" requires at least % option(s), but only % provided',
                v_group_name, v_min_sel, v_opt_idx;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'menu_item_id', p_menu_item_id,
        'groups_count', v_group_idx,
        'options_count', v_total_options_inserted
    );
END;
$$;

-- UUID Overload
CREATE OR REPLACE FUNCTION public.replace_menu_item_modifiers_secure(
    p_menu_item_id UUID,
    p_groups JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.replace_menu_item_modifiers_secure(p_menu_item_id::VARCHAR(80), p_groups);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_menu_item_modifiers_secure(VARCHAR(80), JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_menu_item_modifiers_secure(VARCHAR(80), JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.replace_menu_item_modifiers_secure(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_menu_item_modifiers_secure(UUID, JSONB) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. RLS POLICIES FOR MODIFIER GROUPS & OPTIONS
-- ----------------------------------------------------------------------------
-- Ensure RLS is active
ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;

-- Allow restaurant members to manage modifier groups for their restaurant's items
DROP POLICY IF EXISTS "Restaurant staff can manage modifier groups" ON public.menu_modifier_groups;
CREATE POLICY "Restaurant staff can manage modifier groups"
    ON public.menu_modifier_groups
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.menu_items mi
            JOIN public.restaurant_members rm ON rm.restaurant_id = mi.restaurant_id
            WHERE mi.id = menu_modifier_groups.menu_item_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = TRUE
              AND rm.role IN ('OWNER', 'MANAGER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.menu_items mi
            JOIN public.restaurant_members rm ON rm.restaurant_id = mi.restaurant_id
            WHERE mi.id = menu_modifier_groups.menu_item_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = TRUE
              AND rm.role IN ('OWNER', 'MANAGER')
        )
    );

-- Allow restaurant members to manage modifier options for their groups
DROP POLICY IF EXISTS "Restaurant staff can manage modifier options" ON public.menu_modifier_options;
CREATE POLICY "Restaurant staff can manage modifier options"
    ON public.menu_modifier_options
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.menu_modifier_groups mmg
            JOIN public.menu_items mi ON mi.id = mmg.menu_item_id
            JOIN public.restaurant_members rm ON rm.restaurant_id = mi.restaurant_id
            WHERE mmg.id = menu_modifier_options.group_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = TRUE
              AND rm.role IN ('OWNER', 'MANAGER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.menu_modifier_groups mmg
            JOIN public.menu_items mi ON mi.id = mmg.menu_item_id
            JOIN public.restaurant_members rm ON rm.restaurant_id = mi.restaurant_id
            WHERE mmg.id = menu_modifier_options.group_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = TRUE
              AND rm.role IN ('OWNER', 'MANAGER')
        )
    );
