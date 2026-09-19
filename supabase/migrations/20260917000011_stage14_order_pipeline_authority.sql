-- ============================================================================
-- MLOHUB STAGE 14: ORDER PIPELINE AUTHORITY & SERVER TRANSITIONS
-- Migration Version: 20260917000011
-- Description: Establishes Supabase server RPC for authoritative order status
--              transitions, enforcing authenticated caller RBAC, tenant isolation,
--              canonical state machine progression, and payment independence.
-- ============================================================================

-- 1. Create or replace public.transition_restaurant_order RPC
CREATE OR REPLACE FUNCTION public.transition_restaurant_order(
    p_order_id VARCHAR(80),
    p_next_status order_status_enum,
    p_cancellation_reason TEXT DEFAULT NULL,
    p_estimated_prep_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_result JSONB;
    v_is_authorized BOOLEAN := FALSE;
    v_caller_id UUID := auth.uid();
BEGIN
    -- Require authentication
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to transition order.';
    END IF;

    -- Fetch target order with lock
    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    -- Authorization check:
    -- Caller must be platform admin, restaurant primary owner, or active member with MANAGE_ORDERS
    IF public.is_admin(v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_order.restaurant_id AND owner_id = v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSIF public.has_restaurant_permission(v_caller_id, v_order.restaurant_id, 'MANAGE_ORDERS') THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = v_caller_id
          AND restaurant_id = v_order.restaurant_id
          AND is_active = TRUE
          AND role::text = ANY(ARRAY['OWNER', 'MANAGER', 'CHEF'])
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller % does not have authority to transition orders for restaurant %.', v_caller_id, v_order.restaurant_id;
    END IF;

    -- State Machine Validation
    -- Terminal states cannot transition further
    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already COMPLETED and cannot be transitioned further.', p_order_id;
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already CANCELLED and cannot be transitioned further.', p_order_id;
    END IF;

    -- Legal transitions:
    -- PENDING   -> ACCEPTED, CANCELLED
    -- ACCEPTED  -> PREPARING, CANCELLED
    -- PREPARING -> READY, CANCELLED
    -- READY     -> COMPLETED
    IF v_order.status = 'PENDING' AND p_next_status NOT IN ('ACCEPTED', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from PENDING to %.', p_next_status;
    END IF;

    IF v_order.status = 'ACCEPTED' AND p_next_status NOT IN ('PREPARING', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from ACCEPTED to %.', p_next_status;
    END IF;

    IF v_order.status = 'PREPARING' AND p_next_status NOT IN ('READY', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from PREPARING to %.', p_next_status;
    END IF;

    IF v_order.status = 'READY' AND p_next_status NOT IN ('COMPLETED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from READY to %.', p_next_status;
    END IF;

    -- Execute authoritative transition
    UPDATE public.orders
    SET status = p_next_status,
        estimated_prep_minutes = COALESCE(p_estimated_prep_minutes, estimated_prep_minutes),
        accepted_at = CASE WHEN p_next_status = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
        ready_at = CASE WHEN p_next_status = 'READY' THEN NOW() ELSE ready_at END,
        completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN NOW() ELSE completed_at END,
        cancelled_at = CASE WHEN p_next_status = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
        cancellation_reason = CASE WHEN p_next_status = 'CANCELLED' AND p_cancellation_reason IS NOT NULL THEN p_cancellation_reason ELSE cancellation_reason END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Return refreshed authoritative representation
    SELECT jsonb_build_object(
        'success', TRUE,
        'id', o.id,
        'order_number', o.order_number,
        'restaurant_id', o.restaurant_id,
        'user_id', o.user_id,
        'status', o.status,
        'payment_status', o.payment_status,
        'subtotal_tzs', o.subtotal_tzs,
        'service_fee_tzs', o.service_fee_tzs,
        'delivery_fee_tzs', o.delivery_fee_tzs,
        'total_tzs', o.total_tzs,
        'dining_option', o.dining_option,
        'delivery_address', o.delivery_address,
        'special_instructions', o.special_instructions,
        'estimated_prep_minutes', o.estimated_prep_minutes,
        'accepted_at', o.accepted_at,
        'ready_at', o.ready_at,
        'completed_at', o.completed_at,
        'cancelled_at', o.cancelled_at,
        'cancellation_reason', o.cancellation_reason,
        'created_at', o.created_at,
        'updated_at', o.updated_at
    ) INTO v_result
    FROM public.orders o
    WHERE o.id = p_order_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Grant permissions
GRANT EXECUTE ON FUNCTION public.transition_restaurant_order TO authenticated;

-- 3. Order items INSERT RLS policy
DROP POLICY IF EXISTS "Users can insert their order items" ON public.order_items;
CREATE POLICY "Users can insert their order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.user_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

-- 4. Align check_order_status_transition trigger function with order_status_enum
CREATE OR REPLACE FUNCTION public.check_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Valid state transitions conforming to order_status_enum
    IF OLD.status = 'PENDING' AND NEW.status IN ('ACCEPTED', 'CANCELLED') THEN
        IF NEW.status = 'ACCEPTED' THEN NEW.accepted_at := NOW(); END IF;
        IF NEW.status = 'CANCELLED' THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'ACCEPTED' AND NEW.status IN ('PREPARING', 'CANCELLED') THEN
        IF NEW.status = 'CANCELLED' THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'PREPARING' AND NEW.status IN ('READY', 'CANCELLED') THEN
        IF NEW.status = 'READY' THEN NEW.ready_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'READY' AND NEW.status = 'COMPLETED' THEN
        NEW.completed_at := NOW();
        RETURN NEW;
    ELSIF OLD.status = NEW.status THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from % to %', OLD.status, NEW.status;
    END IF;
END;
$function$;

