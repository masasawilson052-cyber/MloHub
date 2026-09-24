-- =============================================================================
-- MloHub Forward Migration: 20260924000001_payment_order_runtime_truth_closure.sql
-- Canonical Payment Enums, Atomic Cancellation & OUT_FOR_DELIVERY State Machine
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. DYNAMIC PLATFORM SERVICE FEE FUNCTION (Phase 47)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_service_fee(
    p_subtotal_tzs INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_fee INTEGER;
BEGIN
    SELECT customer_service_fee_tzs
    INTO v_fee
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    RETURN COALESCE(v_fee, 1500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_service_fee(INTEGER) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. HARDEN RESTAURANT CANCELLATION REFUND HELPER (Phase 54)
-- Strictly check payments.status = 'SUCCESS' (canonical DB payment status)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_refund_restaurant_cancel_secure(
    p_order_id            VARCHAR(80),
    p_actor_user_id       UUID,
    p_reason_detail       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_refund RECORD;
    v_refund_status TEXT;
    v_key TEXT := 'auto_refund_cancel_' || p_order_id;
    v_refund_id UUID;
BEGIN
    IF auth.uid() IS NULL OR (p_actor_user_id IS NOT NULL AND p_actor_user_id IS DISTINCT FROM auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: This refund helper requires authenticated execution.';
    END IF;

    -- Strict query: payments.status must be canonical SUCCESS only
    SELECT p.id, p.amount_tzs, p.user_id, p.restaurant_id
    INTO v_payment
    FROM public.payments p
    WHERE p.order_id = p_order_id
      AND p.status = 'SUCCESS'
    ORDER BY p.paid_at DESC NULLS LAST, p.created_at ASC
    LIMIT 1
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'refunded', false);
    END IF;

    -- Check if refund request already exists for this order
    SELECT id, status INTO v_refund
    FROM public.refund_requests
    WHERE idempotency_key = v_key
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'refunded', true,
            'refund_request_id', v_refund.id,
            'status', v_refund.status,
            'idempotent', true
        );
    END IF;

    -- Insert canonical refund request with fail-closed semantics
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
        'success', true,
        'refunded', true,
        'refund_request_id', v_refund_id,
        'status', v_refund_status,
        'idempotent', false
    );
EXCEPTION WHEN unique_violation THEN
    SELECT id, status INTO v_refund
    FROM public.refund_requests
    WHERE idempotency_key = v_key;
    RETURN jsonb_build_object(
        'success', true,
        'refunded', true,
        'refund_request_id', v_refund.id,
        'status', v_refund.status,
        'idempotent', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_refund_restaurant_cancel_secure(VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_refund_restaurant_cancel_secure(VARCHAR, UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. ATOMIC CUSTOMER ORDER CANCELLATION RPC (Phase 52 & 53)
-- Strict fail-closed financial atomicity: if refund creation fails, order cannot cancel
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_customer_order_secure(
    p_order_id VARCHAR(80),
    p_cancellation_reason TEXT DEFAULT 'Cancelled by customer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_order RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_payment RECORD;
    v_refund RECORD;
    v_refund_id UUID := NULL;
    v_refund_key TEXT;
    v_refund_status TEXT;
BEGIN
    -- 1. Authentication check
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to cancel order.';
    END IF;

    -- 2. Reject suspended or inactive customers
    IF NOT public.is_active_profile(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Customer profile is inactive or suspended.';
    END IF;

    -- 3. Check admin role
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor
          AND (role IN ('ADMIN', 'SUPER_ADMIN') OR roles && ARRAY['ADMIN'::public.user_role_enum, 'SUPER_ADMIN'::public.user_role_enum])
    ) INTO v_is_admin;

    -- 4. Lock order row
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    -- 5. Customer authorization check
    IF NOT v_is_admin AND v_order.user_id != v_actor THEN
        RAISE EXCEPTION '403 Forbidden: You can only cancel your own orders.';
    END IF;

    -- 6. Self-service cancellation is strictly allowed only when order is PENDING
    IF v_order.status != 'PENDING' AND NOT v_is_admin THEN
        IF v_order.status = 'CANCELLED' THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'status', 'CANCELLED',
                'order_id', p_order_id,
                'message', 'Order is already cancelled.'
            );
        ELSIF v_order.status IN ('ACCEPTED', 'PREPARING') THEN
            RAISE EXCEPTION '400 Bad Request: Order has already been accepted by the kitchen. Please contact the restaurant or customer support.';
        ELSE
            RAISE EXCEPTION '400 Bad Request: Order is currently % and cannot be cancelled automatically.', v_order.status;
        END IF;
    END IF;

    -- 7. Look for successful payment ONLY (Phase 49: DB payments.status is canonical SUCCESS)
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id
      AND status = 'SUCCESS'
    ORDER BY paid_at DESC NULLS LAST, created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- 8. If successful payment exists, create canonical refund request FAIL-CLOSED
    IF FOUND THEN
        v_refund_key := 'customer_cancel_' || p_order_id || '_' || v_payment.id;

        -- Check existing refund request
        SELECT id, status INTO v_refund
        FROM public.refund_requests
        WHERE idempotency_key = v_refund_key
        FOR UPDATE;

        IF FOUND THEN
            v_refund_id := v_refund.id;
        ELSE
            -- Insert refund request. Any DB constraint/type error will abort transaction!
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
                v_payment.id,
                p_order_id,
                v_order.user_id,
                v_order.restaurant_id,
                v_payment.amount_tzs,
                'CUSTOMER_CANCELLED',
                COALESCE(NULLIF(trim(p_cancellation_reason), ''), 'Customer cancelled pending order'),
                'REQUESTED',
                v_actor,
                v_refund_key,
                '[]'::jsonb
            )
            RETURNING id INTO v_refund_id;

            IF v_refund_id IS NULL THEN
                RAISE EXCEPTION '500 Internal Error: Failed to generate refund request for paid order %. Cancellation aborted.', p_order_id;
            END IF;
        END IF;
    END IF;

    -- 9. Cancel the order atomically in the same transaction
    UPDATE public.orders
    SET status = 'CANCELLED',
        cancelled_at = clock_timestamp(),
        cancellation_reason = COALESCE(p_cancellation_reason, 'Cancelled by customer'),
        updated_at = clock_timestamp()
    WHERE id = p_order_id;

    -- 10. Write append-only operational timeline event
    INSERT INTO public.order_operational_events (
        order_id, restaurant_id, branch_id, event_type,
        actor_user_id, actor_role, reason_code, event_details, created_at
    ) VALUES (
        p_order_id, v_order.restaurant_id, v_order.branch_id,
        'ORDER_CANCELLED', v_actor,
        CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'CUSTOMER' END,
        'CUSTOMER_REQUESTED',
        jsonb_build_object(
            'cancellation_reason', p_cancellation_reason,
            'refund_request_id', v_refund_id,
            'payment_refunded', (v_refund_id IS NOT NULL)
        ),
        clock_timestamp()
    );

    -- 11. Authoritative Audit log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor,
        'CUSTOMER_CANCEL_ORDER',
        'ORDER',
        p_order_id,
        jsonb_build_object(
            'reason', p_cancellation_reason,
            'refund_request_id', v_refund_id,
            'cancelled_by', v_actor,
            'had_paid_payment', (v_payment.id IS NOT NULL)
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'CANCELLED',
        'order_id', p_order_id,
        'refund_request_id', v_refund_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_customer_order_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. OUT_FOR_DELIVERY & ROLE-AWARE STATE MACHINE (Phase 55)
-- Full lifecycle support for Delivery and Takeaway/Dine-In
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_order RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_actor_role VARCHAR(30) := NULL;
    v_refund_id UUID := NULL;
    v_is_delivery BOOLEAN := FALSE;
BEGIN
    -- 1. Authentication check
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION '403 Forbidden: Actor identity must match the authenticated user.';
    END IF;

    -- 2. Lock target order & resolve restaurant owner
    SELECT o.*, r.owner_user_id
    INTO v_order
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    v_is_delivery := (COALESCE(v_order.dining_option, 'Delivery') = 'Delivery');

    -- 3. Check Platform Administrator status
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor
          AND (role IN ('ADMIN', 'SUPER_ADMIN') OR roles && ARRAY['ADMIN'::public.user_role_enum, 'SUPER_ADMIN'::public.user_role_enum])
    ) INTO v_is_admin;

    -- 4. Check Restaurant Membership Role
    SELECT rm.role::TEXT INTO v_actor_role
    FROM public.restaurant_members rm
    WHERE rm.restaurant_id = v_order.restaurant_id
      AND rm.user_id = v_actor
      AND rm.is_active = TRUE;

    IF v_actor = v_order.owner_user_id THEN
        v_actor_role := 'OWNER';
    END IF;

    -- 5. Role-Aware Authorization Enforcement
    IF v_is_admin THEN
        -- Platform admins may perform all operational transitions
        NULL;
    ELSIF v_actor_role = 'OWNER' THEN
        -- Restaurant owners may perform all order transitions
        NULL;
    ELSIF v_actor_role = 'MANAGER' THEN
        -- Managers may perform all transitions
        NULL;
    ELSIF v_actor_role = 'CHEF' THEN
        -- Chefs may ONLY perform kitchen progression:
        -- ACCEPTED -> PREPARING
        -- PREPARING -> READY
        IF NOT (
            (v_order.status = 'ACCEPTED' AND p_next_status = 'PREPARING') OR
            (v_order.status = 'PREPARING' AND p_next_status = 'READY')
        ) THEN
            RAISE EXCEPTION '403 Forbidden: Chef role may only transition orders from ACCEPTED to PREPARING and PREPARING to READY. Cannot transition % to %.',
                v_order.status, p_next_status;
        END IF;
    ELSE
        RAISE EXCEPTION '403 Forbidden: You do not have authority to transition orders for restaurant %.', v_order.restaurant_id;
    END IF;

    -- 6. Terminal State Guards
    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already COMPLETED.', p_order_id;
    END IF;
    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already CANCELLED.', p_order_id;
    END IF;

    -- 7. Legal State Machine Transitions (Fulfillment-Aware)
    IF v_order.status = 'PENDING' AND p_next_status NOT IN ('ACCEPTED', 'CANCELLED', 'REJECTED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PENDING to %.', p_next_status;
    END IF;

    IF v_order.status = 'ACCEPTED' AND p_next_status NOT IN ('PREPARING', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition ACCEPTED to %.', p_next_status;
    END IF;

    IF v_order.status = 'PREPARING' AND p_next_status NOT IN ('READY', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PREPARING to %.', p_next_status;
    END IF;

    IF v_order.status = 'READY' THEN
        IF v_is_delivery THEN
            IF p_next_status NOT IN ('OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED') THEN
                RAISE EXCEPTION '400 Bad Request: Invalid transition READY to % for Delivery order.', p_next_status;
            END IF;
        ELSE
            IF p_next_status NOT IN ('COMPLETED', 'CANCELLED') THEN
                RAISE EXCEPTION '400 Bad Request: Invalid transition READY to % for % order.', p_next_status, v_order.dining_option;
            END IF;
        END IF;
    END IF;

    IF v_order.status = 'OUT_FOR_DELIVERY' AND p_next_status NOT IN ('COMPLETED', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition OUT_FOR_DELIVERY to %.', p_next_status;
    END IF;

    -- 8. PAYMENT GATE: PENDING -> ACCEPTED requires payment status = 'SUCCESS'
    IF v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED' THEN
        PERFORM 1
        FROM public.payments
        WHERE order_id = p_order_id
          AND status = 'SUCCESS'
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '402 Payment Required: Order % cannot be accepted -- no successful payment found.', p_order_id;
        END IF;
    END IF;

    -- 9. CANCELLATION REFUND GATE: if paid, atomically ensure refund request
    IF p_next_status IN ('CANCELLED', 'REJECTED') THEN
        SELECT (public.request_refund_restaurant_cancel_secure(
            p_order_id, v_actor, p_cancellation_reason
        )->>'refund_request_id')::UUID INTO v_refund_id;

        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE order_id = p_order_id
              AND status = 'SUCCESS'
        ) AND v_refund_id IS NULL THEN
            RAISE EXCEPTION '500 Internal Error: Could not record cancellation refund for paid order %.', p_order_id;
        END IF;
    END IF;

    -- 10. Apply Order Status Update
    UPDATE public.orders
    SET status = p_next_status,
        estimated_prep_minutes = COALESCE(p_estimated_prep_minutes, estimated_prep_minutes),
        accepted_at   = CASE WHEN p_next_status = 'ACCEPTED'   THEN clock_timestamp() ELSE accepted_at   END,
        ready_at      = CASE WHEN p_next_status = 'READY'      THEN clock_timestamp() ELSE ready_at      END,
        completed_at  = CASE WHEN p_next_status = 'COMPLETED'  THEN clock_timestamp() ELSE completed_at  END,
        cancelled_at  = CASE WHEN p_next_status IN ('CANCELLED', 'REJECTED') THEN clock_timestamp() ELSE cancelled_at END,
        cancellation_reason = CASE
            WHEN p_next_status IN ('CANCELLED', 'REJECTED') AND p_cancellation_reason IS NOT NULL
            THEN p_cancellation_reason
            ELSE cancellation_reason
        END,
        updated_at = clock_timestamp()
    WHERE id = p_order_id;

    -- 11. Record Operational Timeline Event
    INSERT INTO public.order_operational_events (
        order_id, restaurant_id, branch_id, event_type,
        actor_user_id, actor_role, reason_code, event_details, created_at
    ) VALUES (
        p_order_id, v_order.restaurant_id, v_order.branch_id,
        'ORDER_STATUS_' || p_next_status, v_actor,
        COALESCE(v_actor_role, CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'UNKNOWN' END),
        p_cancellation_reason,
        jsonb_build_object(
            'from_status', v_order.status,
            'to_status', p_next_status,
            'refund_request_id', v_refund_id,
            'dining_option', v_order.dining_option
        ),
        clock_timestamp()
    );

    -- 12. Record Authoritative Audit Log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor, 'ORDER_STATUS_TRANSITION', 'ORDER', p_order_id,
        jsonb_build_object(
            'from_status',       v_order.status,
            'to_status',         p_next_status,
            'actor_role',        COALESCE(v_actor_role, CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'UNKNOWN' END),
            'restaurant_id',     v_order.restaurant_id,
            'payment_verified',  (v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED'),
            'refund_request_id', v_refund_id,
            'dining_option',     v_order.dining_option
        )
    );

    RETURN jsonb_build_object(
        'success',           true,
        'order_id',          p_order_id,
        'from_status',       v_order.status,
        'to_status',         p_next_status,
        'actor_role',        COALESCE(v_actor_role, CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'UNKNOWN' END),
        'transitioned_at',   clock_timestamp(),
        'refund_request_id', v_refund_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) TO authenticated, service_role;
