-- =============================================================================
-- MloHub Forward Migration: 20260921000010_order_role_and_notification_retry_closure.sql
-- Production gap closure: Role-aware order state transitions & Notification outbox retry
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLE-AWARE ORDER STATE TRANSITIONS
-- ----------------------------------------------------------------------------
-- Canonical PostgreSQL member roles are: 'OWNER', 'MANAGER', 'CHEF', 'STAFF'.
-- There is no additional kitchen sub-role; historical variants were removed.
--
-- Authorization Rules:
-- - ADMIN / SUPER_ADMIN: authorized for all operational transitions.
-- - OWNER: authorized for all restaurant order transitions.
-- - MANAGER: authorized for all operational transitions according to legal state machine.
-- - CHEF: kitchen-only transitions:
--     ACCEPTED -> PREPARING
--     PREPARING -> READY
--   CHEF must NOT accept orders, cancel/refund orders, or complete orders.
-- - STAFF: no authoritative status transitions.
--
-- Invariants enforced:
-- - Unpaid prepaid order cannot be ACCEPTED (402 Payment Required).
-- - Paid cancellation creates exactly one canonical refund request (idempotent).
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
    v_actor UUID := auth.uid();
    v_order RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_actor_role VARCHAR(30) := NULL;
    v_refund_id UUID := NULL;
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

    -- 3. Check Platform Administrator status
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor
          AND (role IN ('ADMIN', 'SUPER_ADMIN') OR roles && ARRAY['ADMIN', 'SUPER_ADMIN'])
    ) INTO v_is_admin;

    -- 4. Check Restaurant Membership Role
    SELECT rm.role INTO v_actor_role
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
        -- Managers may accept, cancel, prepare, ready, and complete orders
        NULL;
    ELSIF v_actor_role = 'CHEF' THEN
        -- Chefs may ONLY perform kitchen progression:
        -- ACCEPTED -> PREPARING
        -- PREPARING -> READY
        -- Chefs must NOT accept, cancel/refund, or complete orders
        IF NOT (
            (v_order.status = 'ACCEPTED' AND p_next_status = 'PREPARING') OR
            (v_order.status = 'PREPARING' AND p_next_status = 'READY')
        ) THEN
            RAISE EXCEPTION '403 Forbidden: Chef role may only transition orders from ACCEPTED to PREPARING and PREPARING to READY. Cannot transition % to %.',
                v_order.status, p_next_status;
        END IF;
    ELSE
        -- STAFF or no active membership: strictly unauthorized
        RAISE EXCEPTION '403 Forbidden: You do not have authority to transition orders for restaurant %.', v_order.restaurant_id;
    END IF;

    -- 6. Terminal State Guards
    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already COMPLETED.', p_order_id;
    END IF;
    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already CANCELLED.', p_order_id;
    END IF;

    -- 7. Legal State Machine Transitions
    IF v_order.status = 'PENDING' AND p_next_status NOT IN ('ACCEPTED', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PENDING to %.', p_next_status;
    END IF;
    IF v_order.status = 'ACCEPTED' AND p_next_status NOT IN ('PREPARING', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition ACCEPTED to %.', p_next_status;
    END IF;
    IF v_order.status = 'PREPARING' AND p_next_status NOT IN ('READY', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition PREPARING to %.', p_next_status;
    END IF;
    IF v_order.status = 'READY' AND p_next_status NOT IN ('COMPLETED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid transition READY to %.', p_next_status;
    END IF;

    -- 8. PAYMENT GATE: PENDING -> ACCEPTED requires captured payment
    IF v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED' THEN
        PERFORM 1
        FROM public.payments
        WHERE order_id = p_order_id
          AND status IN ('SUCCESS', 'CAPTURED', 'PAID')
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '402 Payment Required: Order % cannot be accepted -- no captured payment found.', p_order_id;
        END IF;
    END IF;

    -- 9. CANCELLATION REFUND GATE: if paid, atomically ensure refund request
    IF p_next_status = 'CANCELLED' THEN
        SELECT (public.request_refund_restaurant_cancel_secure(
            p_order_id, v_actor, p_cancellation_reason
        )->>'refund_request_id')::UUID INTO v_refund_id;

        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE order_id = p_order_id
              AND status IN ('SUCCESS', 'CAPTURED', 'PAID')
        ) AND v_refund_id IS NULL THEN
            RAISE EXCEPTION '500 Internal Error: Could not record cancellation refund for paid order %.', p_order_id;
        END IF;
    END IF;

    -- 10. Apply Order Status Update
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

    -- 11. Record Authoritative Audit Log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor, 'ORDER_STATUS_TRANSITION', 'ORDER', p_order_id,
        jsonb_build_object(
            'from_status',       v_order.status,
            'to_status',         p_next_status,
            'actor_role',        COALESCE(v_actor_role, CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'UNKNOWN' END),
            'restaurant_id',     v_order.restaurant_id,
            'payment_verified',  (v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED'),
            'refund_request_id', v_refund_id
        )
    );

    RETURN jsonb_build_object(
        'success',           true,
        'order_id',          p_order_id,
        'from_status',       v_order.status,
        'to_status',         p_next_status,
        'actor_role',        COALESCE(v_actor_role, CASE WHEN v_is_admin THEN 'ADMIN' ELSE 'UNKNOWN' END),
        'transitioned_at',   NOW(),
        'refund_request_id', v_refund_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.transition_restaurant_order IS
'Role-aware order state machine (migration 00010). '
'Enforces: ADMIN/OWNER/MANAGER full lifecycle authority; '
'CHEF kitchen-only transitions (ACCEPTED->PREPARING, PREPARING->READY); '
'STAFF unauthorized; PAYMENT GATE on ACCEPTED; CANCELLATION REFUND GATE on CANCELLED.';


-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION OUTBOX RETRY FIX
-- ----------------------------------------------------------------------------
-- Claim includes 'FAILED' events whose next_retry_at has arrived and whose
-- retry_count is below max_retries, preventing transient failures from being stranded.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_outbox_events_secure(
    p_worker_id VARCHAR(80),
    p_batch_size INTEGER DEFAULT 10,
    p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.notification_event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_lease TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH candidate_events AS (
        SELECT id
        FROM public.notification_event_outbox
        WHERE processing_status IN ('PENDING', 'PROCESSING', 'FAILED')
          AND (lease_until IS NULL OR lease_until < v_now)
          AND (next_retry_at IS NULL OR next_retry_at <= v_now)
          AND retry_count < max_retries
        ORDER BY priority DESC, created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_event_outbox o
    SET processing_status = 'PROCESSING',
        worker_id = p_worker_id,
        claimed_at = v_now,
        lease_until = v_lease
    FROM candidate_events c
    WHERE o.id = c.id
    RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events_secure(VARCHAR, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events_secure(VARCHAR, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_outbox_events_secure IS
'Claims outbox events for background workers including retryable FAILED events '
'whose next_retry_at has been reached (migration 00010). Service-role only.';
