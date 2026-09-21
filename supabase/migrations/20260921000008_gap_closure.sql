-- =============================================================================
-- MloHub Forward Migration: 20260921000008_gap_closure.sql
-- Production gap closure pass -- 2026-09-21
-- =============================================================================
-- This migration runs AFTER 20260921000007_transaction_integrity_hardening.sql
-- which added STAFF_INVITATION to notification_event_type_enum.
-- By definition any prior transaction that ran ALTER TYPE...ADD VALUE has
-- already committed before this file begins. Using the enum value here is safe.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 0. invite_restaurant_member_secure
--    (moved from 00007 to guarantee post-commit enum boundary)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_restaurant_member_secure(
    p_restaurant_id     VARCHAR(80),
    p_email             TEXT,
    p_role              VARCHAR(30),
    p_invited_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_invitee_profile RECORD;
    v_existing_member RECORD;
    v_membership_id UUID := gen_random_uuid();
    v_invitation_token TEXT := encode(gen_random_bytes(24), 'hex');
    v_invitation_key TEXT := 'staff_invite_' || p_restaurant_id || '_' || md5(lower(trim(p_email)));
    v_existing_event RECORD;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = v_actor
          AND is_active = TRUE
          AND role IN ('OWNER', 'MANAGER')
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_actor
              AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        ) THEN
            RAISE EXCEPTION '403 Forbidden: Only restaurant owners/managers may invite staff members.';
        END IF;
    END IF;

    SELECT payload INTO v_existing_event
    FROM public.notification_event_outbox
    WHERE idempotency_key = v_invitation_key;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'membership_id', v_existing_event.payload->>'membership_id',
            'invited_email', lower(trim(p_email)),
            'role', v_existing_event.payload->>'role',
            'status', 'PENDING_ACCEPTANCE',
            'idempotent', true,
            'message', 'Invitation already queued for this restaurant and email.'
        );
    END IF;

    IF p_role NOT IN ('OWNER','MANAGER','KITCHEN_STAFF','CASHIER','STAFF') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid staff role "%". Allowed: OWNER, MANAGER, KITCHEN_STAFF, CASHIER, STAFF.', p_role;
    END IF;

    SELECT id, full_name INTO v_invitee_profile
    FROM public.profiles
    WHERE email = lower(trim(p_email))
    LIMIT 1;

    IF v_invitee_profile.id IS NOT NULL THEN
        SELECT id, role, is_active INTO v_existing_member
        FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = v_invitee_profile.id;

        IF FOUND AND v_existing_member.is_active = TRUE THEN
            RAISE EXCEPTION '409 Conflict: User % is already an active member of this restaurant with role %.', p_email, v_existing_member.role;
        END IF;
    END IF;

    INSERT INTO public.restaurant_members (
        id, restaurant_id, user_id, role, is_active, created_at, updated_at
    )
    VALUES (
        v_membership_id, p_restaurant_id, v_invitee_profile.id,
        p_role, FALSE, NOW(), NOW()
    )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_membership_id;

        IF v_membership_id IS NULL AND v_invitee_profile.id IS NOT NULL THEN
                SELECT id INTO v_membership_id
                FROM public.restaurant_members
                WHERE restaurant_id = p_restaurant_id
                    AND user_id = v_invitee_profile.id;
        END IF;

    PERFORM public.emit_notification_event(
        'STAFF_INVITATION'::notification_event_type_enum,
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'restaurant_id',     p_restaurant_id,
            'invited_email',     lower(trim(p_email)),
            'invited_full_name', COALESCE(p_invited_full_name, v_invitee_profile.full_name, 'Team Member'),
            'role',              p_role,
            'membership_id',     v_membership_id,
            'invitation_token',  v_invitation_token,
            'invited_by',        v_actor
        ),
        v_invitation_key
    );

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor, 'INVITE_RESTAURANT_STAFF', 'RESTAURANT', p_restaurant_id,
        jsonb_build_object(
            'invited_email', lower(trim(p_email)),
            'role', p_role,
            'membership_id', v_membership_id
        )
    );

    RETURN jsonb_build_object(
        'success',       true,
        'membership_id', v_membership_id,
        'invited_email', lower(trim(p_email)),
        'role',          p_role,
        'status',        'PENDING_ACCEPTANCE',
        'message',       'Invitation queued. The invitee will receive a notification to join the restaurant.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_restaurant_member_secure(VARCHAR, TEXT, VARCHAR, TEXT) TO authenticated;

COMMENT ON FUNCTION public.invite_restaurant_member_secure IS
'Staff invitation RPC. Defined in 00008 to guarantee the STAFF_INVITATION enum '
'value added in 00007 is fully committed before use. Notification queued via outbox.';


-- ----------------------------------------------------------------------------
-- 1. create_order_secure -- HARD REJECT when delivery zone not provided
--    Replaces the 00007 version which silently fell back to cheapest zone.
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

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
            order_id, menu_item_id, item_name, quantity, unit_price_tzs, line_total_tzs, special_notes
        ) VALUES (
            v_order_id, v_item.menu_item_id, v_item_name,
            v_item.quantity, v_trusted_price, v_trusted_price * v_item.quantity,
            v_item.special_notes
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success',           true,
        'order_id',          v_order_id,
        'order_number',      v_order_number,
        'subtotal_tzs',      v_subtotal,
        'service_fee_tzs',   v_service_fee,
        'delivery_fee_tzs',  v_delivery_fee,
        'total_tzs',         v_total,
        'estimated_ready_at', v_estimated_ready_at,
        'delivery_zone_id',  p_delivery_zone_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.create_order_secure IS
'Authoritative order creation. Delivery orders REQUIRE an explicit p_delivery_zone_id '
'(DELIVERY_ZONE_REQUIRED raised if omitted). Zone validated against branch. '
'Pickup/Dine-In: no zone validation, delivery_fee = 0.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_idempotency_key
    ON public.refund_requests (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.request_refund_restaurant_cancel_secure(
    p_order_id            VARCHAR(80),
    p_actor_user_id       UUID,
    p_reason_detail       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
    v_refund RECORD;
    v_refund_status TEXT;
    v_key TEXT := 'auto_refund_cancel_' || p_order_id;
    v_refund_id UUID;
BEGIN
    SELECT p.id, p.amount_tzs, p.user_id, p.restaurant_id
    INTO v_payment
    FROM public.payments p
    WHERE p.order_id = p_order_id
      AND p.status IN ('SUCCESS', 'CAPTURED', 'PAID')
    ORDER BY p.created_at ASC
    LIMIT 1
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'refunded', false);
    END IF;

    SELECT id, status INTO v_refund
    FROM public.refund_requests
    WHERE idempotency_key = v_key
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true, 'refunded', true,
            'refund_request_id', v_refund.id,
            'status', v_refund.status,
            'idempotent', true
        );
    END IF;

    INSERT INTO public.refund_requests (
        payment_id, order_id, customer_user_id, restaurant_id,
        requested_amount_tzs, reason_code, reason_detail, status,
        requested_by, idempotency_key, affected_items
    ) VALUES (
        v_payment.id, p_order_id, v_payment.user_id, v_payment.restaurant_id,
        v_payment.amount_tzs, 'RESTAURANT_CANCELLED',
        COALESCE(NULLIF(trim(p_reason_detail), ''), 'Order cancelled by restaurant'),
        'REQUESTED', p_actor_user_id, v_key, '[]'::jsonb
    )
    RETURNING id, status INTO v_refund_id, v_refund_status;

    RETURN jsonb_build_object(
        'success', true, 'refunded', true,
        'refund_request_id', v_refund_id,
        'status', v_refund_status,
        'idempotent', false
    );
EXCEPTION WHEN unique_violation THEN
    SELECT id, status INTO v_refund
    FROM public.refund_requests
    WHERE idempotency_key = v_key;
    RETURN jsonb_build_object(
        'success', true, 'refunded', true,
        'refund_request_id', v_refund.id,
        'status', v_refund.status,
        'idempotent', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund_restaurant_cancel_secure(VARCHAR, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.request_refund_restaurant_cancel_secure IS
'Single idempotent refund authority for restaurant cancellation of paid orders.';


-- ----------------------------------------------------------------------------
-- 2. transition_restaurant_order -- atomic paid-order cancellation refund
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_restaurant_order(
    p_order_id               VARCHAR(80),
    p_next_status            VARCHAR(30),
    p_actor_user_id          UUID    DEFAULT NULL,
    p_estimated_prep_minutes INTEGER DEFAULT NULL,
    p_cancellation_reason    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := COALESCE(p_actor_user_id, auth.uid());
    v_order RECORD;
    v_refund_id UUID;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    SELECT o.*, r.owner_user_id
    INTO v_order
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.restaurant_members rm
        WHERE rm.restaurant_id = v_order.restaurant_id
          AND rm.user_id = v_actor
          AND rm.is_active = TRUE
          AND rm.role IN ('OWNER','MANAGER','KITCHEN_STAFF')
    ) AND v_order.owner_user_id <> v_actor THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_actor
              AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        ) THEN
            RAISE EXCEPTION '403 Forbidden: You do not have authority over restaurant %.', v_order.restaurant_id;
        END IF;
    END IF;

    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already COMPLETED.', p_order_id;
    END IF;
    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already CANCELLED.', p_order_id;
    END IF;

    IF v_order.status = 'PENDING'   AND p_next_status NOT IN ('ACCEPTED','CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PENDING to %.', p_next_status;
    END IF;
    IF v_order.status = 'ACCEPTED'  AND p_next_status NOT IN ('PREPARING','CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition ACCEPTED to %.', p_next_status;
    END IF;
    IF v_order.status = 'PREPARING' AND p_next_status NOT IN ('READY','CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PREPARING to %.', p_next_status;
    END IF;
    IF v_order.status = 'READY'     AND p_next_status NOT IN ('COMPLETED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition READY to %.', p_next_status;
    END IF;

    -- PAYMENT GATE: PENDING to ACCEPTED requires captured payment
    IF v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED' THEN
        SELECT id INTO v_paid_payment
        FROM public.payments
        WHERE order_id = p_order_id
          AND status IN ('SUCCESS','CAPTURED','PAID')
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '402 Payment Required: Order % cannot be accepted -- no captured payment found.', p_order_id;
        END IF;
    END IF;

    -- CANCELLATION REFUND GATE: if paid, atomically create refund request
    IF p_next_status = 'CANCELLED' THEN
        SELECT (public.request_refund_restaurant_cancel_secure(
            p_order_id, v_actor, p_cancellation_reason
        )->>'refund_request_id')::UUID INTO v_refund_id;

        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE order_id = p_order_id
              AND status IN ('SUCCESS', 'CAPTURED', 'PAID')
        ) AND v_refund_id IS NULL THEN
            RAISE EXCEPTION '500 Internal Error: Could not create or verify refund request for paid order %. Cancellation aborted.', p_order_id;
        END IF;
    END IF;

    UPDATE public.orders
    SET status = p_next_status,
        estimated_prep_minutes = COALESCE(p_estimated_prep_minutes, estimated_prep_minutes),
        accepted_at   = CASE WHEN p_next_status = 'ACCEPTED'   THEN NOW() ELSE accepted_at   END,
        ready_at      = CASE WHEN p_next_status = 'READY'      THEN NOW() ELSE ready_at      END,
        completed_at  = CASE WHEN p_next_status = 'COMPLETED'  THEN NOW() ELSE completed_at  END,
        cancelled_at  = CASE WHEN p_next_status = 'CANCELLED'  THEN NOW() ELSE cancelled_at  END,
        cancellation_reason = CASE
            WHEN p_next_status = 'CANCELLED' AND p_cancellation_reason IS NOT NULL
            THEN p_cancellation_reason
            ELSE cancellation_reason
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor, 'ORDER_STATUS_TRANSITION', 'ORDER', p_order_id,
        jsonb_build_object(
            'from_status',      v_order.status,
            'to_status',        p_next_status,
            'restaurant_id',    v_order.restaurant_id,
            'payment_verified', (v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED'),
            'refund_request_id', v_refund_id
        )
    );

    RETURN jsonb_build_object(
        'success',           true,
        'order_id',          p_order_id,
        'from_status',       v_order.status,
        'to_status',         p_next_status,
        'transitioned_at',   NOW(),
        'refund_request_id', v_refund_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.transition_restaurant_order IS
'Authoritative order state machine (v2 from migration 00008). '
'PAYMENT GATE: PENDING to ACCEPTED requires captured payment. '
'CANCELLATION REFUND GATE: cancelling a PAID order atomically creates a '
'refund_requests record (idempotent). Cancellation aborted if refund creation fails.';


-- ----------------------------------------------------------------------------
-- 4. request_refund_admin_secure
--    Admin-callable refund authority used by the request-refund Edge Function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_refund_admin_secure(
    p_payment_id           VARCHAR(80),
    p_requested_amount_tzs BIGINT,
    p_reason_code          VARCHAR(50),
    p_reason_detail        TEXT,
    p_idempotency_key      TEXT,
    p_admin_user_id        UUID,
    p_affected_items       JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
    v_existing_refund RECORD;
    v_already_refunded BIGINT := 0;
    v_refund_id UUID := gen_random_uuid();
BEGIN
    IF p_admin_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Admin user ID required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_user_id
          AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Only platform admins may use request_refund_admin_secure.';
    END IF;

    SELECT id, status INTO v_existing_refund
    FROM public.refund_requests
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success',           true,
            'refund_request_id', v_existing_refund.id,
            'status',            v_existing_refund.status,
            'idempotent',        true
        );
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Payment % does not exist.', p_payment_id;
    END IF;

    IF v_payment.status NOT IN ('SUCCESS','CAPTURED','PAID','REFUNDED','PARTIALLY_REFUNDED') THEN
        RAISE EXCEPTION '400 Bad Request: Cannot refund payment in status %.', v_payment.status;
    END IF;

    SELECT COALESCE(SUM(requested_amount_tzs), 0) INTO v_already_refunded
    FROM public.refund_requests
    WHERE payment_id = p_payment_id
      AND status IN ('APPROVED','PROVIDER_PROCESSING','REFUNDED','PARTIALLY_REFUNDED','REQUESTED');

    IF (v_already_refunded + p_requested_amount_tzs) > v_payment.amount_tzs THEN
        RAISE EXCEPTION '400 Bad Request: Requested refund (%) would exceed payment amount (%). Already requested/refunded: %.',
            p_requested_amount_tzs, v_payment.amount_tzs, v_already_refunded;
    END IF;

    IF p_requested_amount_tzs <= 0 THEN
        RAISE EXCEPTION '400 Bad Request: Refund amount must be positive.';
    END IF;

    INSERT INTO public.refund_requests (
        payment_id,
        order_id,
        customer_user_id,
        restaurant_id,
        requested_amount_tzs,
        reason_code,
        reason_detail,
        status,
        requested_by,
        idempotency_key,
        affected_items
    ) VALUES (
        p_payment_id,
        v_payment.order_id,
        v_payment.user_id,
        v_payment.restaurant_id,
        p_requested_amount_tzs,
        p_reason_code,
        p_reason_detail,
        'REQUESTED',
        p_admin_user_id,
        p_idempotency_key,
        p_affected_items
    )
    RETURNING id INTO v_refund_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        p_admin_user_id, 'ADMIN_REFUND_REQUEST', 'PAYMENT', p_payment_id,
        jsonb_build_object(
            'refund_request_id',    v_refund_id,
            'requested_amount_tzs', p_requested_amount_tzs,
            'reason_code',          p_reason_code,
            'idempotency_key',      p_idempotency_key
        )
    );

    RETURN jsonb_build_object(
        'success',           true,
        'refund_request_id', v_refund_id,
        'status',            'REQUESTED',
        'idempotent',        false
    );
END;
$$;

-- Only service_role may call this -- edge function uses service role key
GRANT EXECUTE ON FUNCTION public.request_refund_admin_secure(VARCHAR, BIGINT, VARCHAR, TEXT, TEXT, UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.request_refund_admin_secure IS
'Admin-only refund authority for use by the request-refund Edge Function. '
'Accepts explicit admin_user_id (auth.uid() unavailable in service_role context). '
'Validates admin role, cumulative refund limits, creates idempotent refund_requests record.';


-- ----------------------------------------------------------------------------
-- 5. get_restaurant_menu_counts
--    Authoritative batch RPC for VerificationCenter authoritative dish counts.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_restaurant_menu_counts()
RETURNS TABLE (
    restaurant_id     VARCHAR(80),
    active_menu_count BIGINT,
    last_menu_update  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        mi.restaurant_id,
        COUNT(*) FILTER (WHERE mi.is_available = TRUE AND COALESCE(mi.is_archived, FALSE) = FALSE)
            AS active_menu_count,
        MAX(mi.updated_at) AS last_menu_update
    FROM public.menu_items mi
    GROUP BY mi.restaurant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_menu_counts() TO authenticated;

COMMENT ON FUNCTION public.get_restaurant_menu_counts IS
'Batch query: active dish count and last menu update per restaurant. '
'Used by admin VerificationCenter for authoritative (not client-hydrated) menu metrics.';


-- ----------------------------------------------------------------------------
-- 6. track_search_event
--    Writes a customer search event into the analytics tables.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_search_event(
    p_session_id   TEXT,
    p_event_id     TEXT,
    p_query        TEXT,
    p_result_count INTEGER,
    p_ward_name    TEXT   DEFAULT NULL,
    p_metadata     JSONB  DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'search_analytics_events'
    ) THEN
        INSERT INTO public.search_analytics_events (
            session_id, event_id, query, result_count, ward_name, metadata, created_at
        ) VALUES (
            p_session_id, p_event_id, lower(trim(p_query)),
            p_result_count, p_ward_name, p_metadata, NOW()
        )
        ON CONFLICT DO NOTHING;
    END IF;

    IF p_result_count = 0 AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'zero_result_events'
    ) THEN
        INSERT INTO public.zero_result_events (
            session_id, query, ward_name, metadata, created_at
        ) VALUES (
            p_session_id, lower(trim(p_query)), p_ward_name, p_metadata, NOW()
        )
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_search_event(TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB) TO authenticated, anon;

COMMENT ON FUNCTION public.track_search_event IS
'Records customer search events. Writes zero_result_events when result_count=0. '
'Idempotent (ON CONFLICT DO NOTHING). Privacy-safe: no PII, only session_id.';
