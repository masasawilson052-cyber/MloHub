-- ==============================================================================
-- MLOHUB PRODUCTION HARDENING: TRANSACTION INTEGRITY & ADMIN COMPLETENESS
-- Migration: 20260921000007_transaction_integrity_hardening.sql
-- ==============================================================================
-- Changes in this migration (all additive, no historical table drops):
--
-- 1. PAYMENT GATE on order acceptance:
--    `transition_restaurant_order` now verifies that a SUCCESS payment exists
--    before allowing PENDING → ACCEPTED transition.
--
-- 2. DELIVERY ZONE parameter:
--    `create_order_secure` adds optional `p_delivery_zone_id UUID` parameter.
--    When supplied the matching zone fee is used; falls back to LIMIT 1 only
--    when no zone id is given (backward compatible).
--
-- 3. PLATFORM ANNOUNCEMENTS table for admin broadcast composer.
--
-- 4. STAFF INVITATION RPC:
--    `invite_restaurant_member_secure` — creates a pending invitation row in
--    `restaurant_members` with is_active=false and sends an OTP-style token.
--    Full email/SMS delivery requires external SMTP/SMS credentials.
--
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. Extend notification_event_type_enum with STAFF_INVITATION value
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TYPE public.notification_event_type_enum ADD VALUE IF NOT EXISTS 'STAFF_INVITATION';
EXCEPTION WHEN others THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Replace transition_restaurant_order with payment-gated version
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transition_restaurant_order(
    p_order_id          VARCHAR(80),
    p_next_status       VARCHAR(30),
    p_actor_user_id     UUID DEFAULT NULL,
    p_estimated_prep_minutes INTEGER DEFAULT NULL,
    p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := COALESCE(p_actor_user_id, auth.uid());
    v_order RECORD;
    v_restaurant RECORD;
    v_paid_payment RECORD;
BEGIN
    -- ── 1. Actor must be authenticated ────────────────────────────────────────
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to transition order status.';
    END IF;

    -- ── 2. Fetch & lock order row ─────────────────────────────────────────────
    SELECT o.*, r.owner_user_id
    INTO v_order
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    -- ── 3. Restaurant staff / owner authority check ───────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM public.restaurant_members rm
        WHERE rm.restaurant_id = v_order.restaurant_id
          AND rm.user_id = v_actor
          AND rm.is_active = TRUE
          AND rm.role IN ('OWNER','MANAGER','KITCHEN_STAFF')
    ) AND v_order.owner_user_id <> v_actor THEN
        -- Also allow admin
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_actor AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        ) THEN
            RAISE EXCEPTION '403 Forbidden: You do not have authority over restaurant %.', v_order.restaurant_id;
        END IF;
    END IF;

    -- ── 4. Terminal state guard ────────────────────────────────────────────────
    IF v_order.status = 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already COMPLETED and cannot be transitioned further.', p_order_id;
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION '400 Bad Request: Order % is already CANCELLED and cannot be transitioned further.', p_order_id;
    END IF;

    -- ── 5. Legal transition table ─────────────────────────────────────────────
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

    -- ── 6. PAYMENT GATE: PENDING → ACCEPTED requires a captured payment ────────
    IF v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED' THEN
        SELECT id INTO v_paid_payment
        FROM public.payments
        WHERE order_id = p_order_id
          AND status IN ('SUCCESS', 'CAPTURED', 'PAID')
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '402 Payment Required: Order % cannot be accepted — no captured payment found. '
                            'Verify payment status before accepting.', p_order_id;
        END IF;
    END IF;

    -- ── 7. Execute authoritative transition ───────────────────────────────────
    UPDATE public.orders
    SET status = p_next_status,
        estimated_prep_minutes = COALESCE(p_estimated_prep_minutes, estimated_prep_minutes),
        accepted_at    = CASE WHEN p_next_status = 'ACCEPTED'   THEN NOW() ELSE accepted_at END,
        ready_at       = CASE WHEN p_next_status = 'READY'      THEN NOW() ELSE ready_at END,
        completed_at   = CASE WHEN p_next_status = 'COMPLETED'  THEN NOW() ELSE completed_at END,
        cancelled_at   = CASE WHEN p_next_status = 'CANCELLED'  THEN NOW() ELSE cancelled_at END,
        cancellation_reason = CASE
            WHEN p_next_status = 'CANCELLED' AND p_cancellation_reason IS NOT NULL
            THEN p_cancellation_reason
            ELSE cancellation_reason
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- ── 8. Audit log ──────────────────────────────────────────────────────────
    INSERT INTO public.audit_logs (
        admin_user_id, action, target_type, target_id, details
    ) VALUES (
        v_actor,
        'ORDER_STATUS_TRANSITION',
        'ORDER',
        p_order_id,
        jsonb_build_object(
            'from_status', v_order.status,
            'to_status',   p_next_status,
            'restaurant_id', v_order.restaurant_id,
            'payment_verified', (v_order.status = 'PENDING' AND p_next_status = 'ACCEPTED')
        )
    );

    RETURN jsonb_build_object(
        'success',     true,
        'order_id',    p_order_id,
        'from_status', v_order.status,
        'to_status',   p_next_status,
        'transitioned_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_restaurant_order(VARCHAR, VARCHAR, UUID, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.transition_restaurant_order IS
'Authoritative server-side order state machine. Requires a captured payment before '
'accepting a PENDING order (PAYMENT GATE added 2026-09-21). All transitions are '
'actor-verified and audit-logged.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Replace create_order_secure with delivery-zone-aware version
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_branch_id             UUID,
    p_items                 JSONB,
    p_fulfillment_type      VARCHAR(30)  DEFAULT 'Delivery',
    p_delivery_address      TEXT         DEFAULT NULL,
    p_special_instructions  TEXT         DEFAULT NULL,
    p_delivery_zone_id      UUID         DEFAULT NULL   -- NEW: explicit zone selection
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
    v_bucket_start TIMESTAMPTZ;
    v_current_orders INTEGER := 0;
    v_current_items INTEGER := 0;
    v_prep_quote INTEGER;
    v_estimated_ready_at TIMESTAMPTZ;
    v_item_stock_status item_stock_status_enum;
    v_item_unavail_until TIMESTAMPTZ;
    v_item_daypart_start TIME;
    v_item_daypart_end TIME;
    v_local_time TIMESTAMPTZ;
    v_local_clock TIME;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

    -- 2. Resolve & Lock Branch
    SELECT * INTO v_branch
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Active restaurant branch % not found.', p_branch_id;
    END IF;

    v_restaurant_id := v_branch.restaurant_id;

    -- 3. Operational Status Revalidation
    v_op_status := public.get_branch_operational_status(
        p_branch_id,
        CASE WHEN p_fulfillment_type = 'Delivery' THEN 'RESTAURANT_DELIVERY'::branch_service_type_enum ELSE 'PICKUP'::branch_service_type_enum END
    );

    IF (v_op_status->>'available')::boolean IS FALSE THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant branch is currently not accepting orders: %', v_op_status->>'reason';
    END IF;

    v_prep_quote := (v_op_status->>'estimated_prep_minutes')::integer;
    v_estimated_ready_at := v_now + (v_prep_quote || ' minutes')::INTERVAL;

    -- 4. Delivery Zone & Minimum Order Validation (FIXED: explicit zone preferred)
    IF p_fulfillment_type = 'Delivery' THEN
        IF p_delivery_zone_id IS NOT NULL THEN
            -- Customer explicitly selected a zone — use it directly
            SELECT * INTO v_zone
            FROM public.branch_delivery_zones
            WHERE id = p_delivery_zone_id
              AND branch_id = p_branch_id
              AND is_active = TRUE;

            IF NOT FOUND THEN
                RAISE EXCEPTION '400 Bad Request: Selected delivery zone % is not valid for this branch.', p_delivery_zone_id;
            END IF;
            v_delivery_fee := v_zone.fee_tzs;
        ELSE
            -- No zone specified: attempt to find any active zone for this branch
            -- (legacy path — not ideal but backward-compatible for pickup-only flows)
            SELECT * INTO v_zone
            FROM public.branch_delivery_zones
            WHERE branch_id = p_branch_id AND is_active = TRUE
            ORDER BY fee_tzs ASC
            LIMIT 1;

            IF FOUND THEN
                v_delivery_fee := v_zone.fee_tzs;
            ELSE
                v_delivery_fee := COALESCE(v_branch.base_delivery_fee_tzs, 0);
            END IF;
        END IF;
    ELSE
        v_delivery_fee := 0;
    END IF;

    v_order_id := 'ord_' || substr(md5(random()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 4);

    -- 5. Validate each item, stock availability, dayparts and calculate trusted subtotal
    v_local_time := timezone(COALESCE(v_branch.timezone, 'Africa/Dar_es_Salaam'), v_now);
    v_local_clock := v_local_time::time;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
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

        IF v_item_stock_status = 'TEMPORARILY_UNAVAILABLE' AND v_item_unavail_until IS NOT NULL AND v_item_unavail_until > v_now THEN
            RAISE EXCEPTION '409 Conflict: Menu item "%" is temporarily unavailable until %.', v_item_name, v_item_unavail_until;
        END IF;

        IF v_item_daypart_start IS NOT NULL AND v_item_daypart_end IS NOT NULL THEN
            IF v_local_clock < v_item_daypart_start OR v_local_clock > v_item_daypart_end THEN
                RAISE EXCEPTION '409 Conflict: Menu item "%" is only served between % and %.', v_item_name, v_item_daypart_start, v_item_daypart_end;
            END IF;
        END IF;

        v_line_subtotal := v_trusted_price * v_item.quantity;
        v_subtotal := v_subtotal + v_line_subtotal;
        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_item.quantity;
    END LOOP;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Order must contain at least one item.';
    END IF;

    -- 6. Minimum order enforcement
    IF v_zone IS NOT NULL AND v_zone.minimum_order_tzs IS NOT NULL THEN
        IF v_subtotal < v_zone.minimum_order_tzs THEN
            RAISE EXCEPTION '400 Bad Request: Minimum order for this delivery zone is % TZS (current subtotal: % TZS).',
                v_zone.minimum_order_tzs, v_subtotal;
        END IF;
    END IF;

    v_total := v_subtotal + v_service_fee + v_delivery_fee;

    -- 7. Insert order
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

    -- 8. Insert order items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
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
'Server-authoritative order creation. Accepts optional p_delivery_zone_id to select '
'the precise delivery zone and fee. Falls back to lowest-fee active zone when not '
'supplied (backward-compatible). Payment gate added on transition_restaurant_order '
'prevents acceptance without a captured payment.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Platform Announcements table for admin broadcast composer
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title_en        TEXT         NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 200),
    title_sw        TEXT,
    body_en         TEXT         NOT NULL CHECK (char_length(body_en) BETWEEN 1 AND 2000),
    body_sw         TEXT,
    target_audience VARCHAR(30)  NOT NULL DEFAULT 'ALL'
                                 CHECK (target_audience IN ('ALL','CUSTOMERS','RESTAURANTS','ADMINS')),
    priority        VARCHAR(20)  NOT NULL DEFAULT 'NORMAL'
                                 CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_created ON public.platform_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_active  ON public.platform_announcements(is_active, target_audience);

-- RLS: only admins can read/write
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_admin_all   ON public.platform_announcements;
DROP POLICY IF EXISTS announcements_read_active ON public.platform_announcements;

CREATE POLICY announcements_admin_all ON public.platform_announcements
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        )
    );

-- Customers / restaurant owners may read active announcements addressed to them
CREATE POLICY announcements_read_active ON public.platform_announcements
    FOR SELECT
    TO authenticated
    USING (
        is_active = TRUE
        AND sent_at IS NOT NULL
        AND (target_audience = 'ALL'
             OR target_audience = 'CUSTOMERS'
             OR target_audience = 'RESTAURANTS')
    );

COMMENT ON TABLE public.platform_announcements IS
'Admin-authored broadcast announcements. Targeted by audience segment. '
'Visible to authenticated users after sent_at is populated by the dispatcher.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Staff invitation RPC (server-authoritative, no privileged client key usage)
-- ──────────────────────────────────────────────────────────────────────────────
-- Adds a pending (is_active = false) membership record for the given email.
-- A separate notification/email delivery system picks up pending records.
-- The invited user activates the membership on first login.

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
BEGIN
    -- 1. Authentication
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    -- 2. Actor must be OWNER or MANAGER of the restaurant
    IF NOT EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = v_actor
          AND is_active = TRUE
          AND role IN ('OWNER', 'MANAGER')
    ) THEN
        -- Allow ADMIN/SUPER_ADMIN too
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_actor AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN','SUPER_ADMIN'])
        ) THEN
            RAISE EXCEPTION '403 Forbidden: Only restaurant owners/managers may invite staff members.';
        END IF;
    END IF;

    -- 3. Validate role
    IF p_role NOT IN ('OWNER','MANAGER','KITCHEN_STAFF','CASHIER','STAFF') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid staff role "%". Allowed: OWNER, MANAGER, KITCHEN_STAFF, CASHIER, STAFF.', p_role;
    END IF;

    -- 4. Check if user already exists in profiles
    SELECT id, full_name INTO v_invitee_profile
    FROM public.profiles
    WHERE email = lower(trim(p_email))
    LIMIT 1;

    -- 5. Check for duplicate active membership
    IF v_invitee_profile.id IS NOT NULL THEN
        SELECT id, role, is_active INTO v_existing_member
        FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = v_invitee_profile.id;

        IF FOUND AND v_existing_member.is_active = TRUE THEN
            RAISE EXCEPTION '409 Conflict: User % is already an active member of this restaurant with role %.', p_email, v_existing_member.role;
        END IF;
    END IF;

    -- 6. Insert membership invitation record (is_active = false until accepted)
    INSERT INTO public.restaurant_members (
        id,
        restaurant_id,
        user_id,
        role,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        v_membership_id,
        p_restaurant_id,
        COALESCE(v_invitee_profile.id, NULL),  -- NULL if user doesn't exist yet
        p_role,
        FALSE,   -- Inactive until the invited user accepts
        NOW(),
        NOW()
    )
    ON CONFLICT DO NOTHING;

    -- 7. Queue notification for the invitation via canonical outbox helper
    PERFORM public.emit_notification_event(
        'STAFF_INVITATION'::notification_event_type_enum,
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'restaurant_id', p_restaurant_id,
            'invited_email', lower(trim(p_email)),
            'invited_full_name', COALESCE(p_invited_full_name, v_invitee_profile.full_name, 'Team Member'),
            'role', p_role,
            'membership_id', v_membership_id,
            'invitation_token', v_invitation_token,
            'invited_by', v_actor
        ),
        'staff_invite_' || v_membership_id
    );

    -- 8. Audit
    INSERT INTO public.audit_logs (
        admin_user_id, action, target_type, target_id, details
    ) VALUES (
        v_actor,
        'INVITE_RESTAURANT_STAFF',
        'RESTAURANT',
        p_restaurant_id,
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
        'message',       'Invitation queued. The invitee will receive an email/SMS to join the restaurant.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_restaurant_member_secure(VARCHAR, TEXT, VARCHAR, TEXT) TO authenticated;

COMMENT ON FUNCTION public.invite_restaurant_member_secure IS
'Creates a pending restaurant membership invitation. The invited user activates '
'it on first login. An email/SMS is queued in notification_event_outbox for delivery '
'by the notification dispatcher (requires external SMTP/SMS credentials).';
