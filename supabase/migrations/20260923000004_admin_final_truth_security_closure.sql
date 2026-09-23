-- =============================================================================
-- MloHub Forward Migration: 20260923000004_admin_final_truth_security_closure.sql
-- Final Admin 100% Truth / Security / Workflow Closure
-- =============================================================================

-- 1. Helper: Check if profile is active (not suspended or deleted)
CREATE OR REPLACE FUNCTION public.is_active_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id AND status = 'ACTIVE'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_profile(UUID) TO authenticated, anon, service_role;

-- 2. Authoritative create_order_secure with Canonical Schema Contract
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
    v_maintenance BOOLEAN := FALSE;
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

    -- Fallback safety
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

    -- Canonical public.orders insert
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

    -- Canonical public.order_items insert
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
            id,
            order_id,
            menu_item_id,
            item_name,
            item_name_snapshot,
            unit_price_tzs,
            price_snapshot,
            quantity,
            total_price_tzs,
            special_notes
        )
        VALUES (
            'item_ord_' || substr(md5(random()::text), 1, 16),
            v_order_id,
            v_item.menu_item_id,
            v_item_name,
            v_item_name,
            v_trusted_price,
            v_trusted_price,
            v_item.quantity,
            v_trusted_price * v_item.quantity,
            v_item.special_notes
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
        'estimated_prep_minutes', v_prep_quote,
        'estimated_ready_at', v_estimated_ready_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_secure(UUID, JSONB, VARCHAR, TEXT, TEXT, UUID) TO authenticated, service_role;

-- 3. Dynamic Commission Resolution in finalize_payment_capture_rpc
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
  v_policy RECORD;
  v_batch_id UUID;
  v_food_tzs BIGINT := 0;
  v_service_fee_tzs BIGINT := 0;
  v_delivery_fee_tzs BIGINT := 0;
  v_commission_tzs BIGINT := 0;
  v_net_payable_tzs BIGINT := 0;
  v_commission_bps INTEGER := 1000;
  v_policy_id UUID := NULL;
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

    -- Read platform financial settings first (authoritative platform default)
    SELECT default_commission_basis_points
    INTO v_commission_bps
    FROM public.platform_financial_settings
    WHERE id = TRUE;

    v_commission_bps := COALESCE(v_commission_bps, 1000);

    -- Active merchant-specific policy override wins if present
    SELECT * INTO v_policy
    FROM public.merchant_fee_policies
    WHERE restaurant_id = v_order.restaurant_id
      AND effective_from <= clock_timestamp()
      AND (effective_until IS NULL OR effective_until > clock_timestamp())
    ORDER BY effective_from DESC
    LIMIT 1;

    IF FOUND THEN
      v_commission_bps := v_policy.commission_basis_points;
      v_policy_id := v_policy.id;
    END IF;

    -- Half-up canonical integer rounding
    v_commission_tzs := (v_food_tzs * v_commission_bps + 5000) / 10000;
    v_net_payable_tzs := v_food_tzs - v_commission_tzs + v_delivery_fee_tzs;

    IF v_authoritative_total <> p_captured_amount_tzs THEN
      RAISE EXCEPTION 'Authoritative order total % does not match captured amount %',
        v_authoritative_total, p_captured_amount_tzs;
    END IF;

    -- Create Order Financial Snapshot (Immutable)
    INSERT INTO public.order_financial_snapshots (
      order_id, restaurant_id, payment_id, gross_food_sales_tzs,
      customer_service_fee_tzs, restaurant_delivery_fee_tzs, discount_tzs,
      platform_commission_tzs, restaurant_net_payable_tzs, commission_policy_id,
      commission_basis_points_snapshot, currency
    ) VALUES (
      v_order.id, v_order.restaurant_id, v_payment.id, v_food_tzs,
      v_service_fee_tzs, v_delivery_fee_tzs, 0,
      v_commission_tzs, v_net_payable_tzs, v_policy_id,
      v_commission_bps, 'TZS'
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

-- 4. Hardened Refund Approval with SUPER_ADMIN Check and Atomic Audit
CREATE OR REPLACE FUNCTION public.approve_refund_secure(
  p_refund_request_id UUID,
  p_approved_amount_tzs BIGINT,
  p_responsibility public.refund_responsibility_enum
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_req RECORD;
  v_actor_name TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
  END IF;

  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN authorization required for refund approval.';
  END IF;

  IF p_approved_amount_tzs <= 0 THEN
    RAISE EXCEPTION '400 Bad Request: Approved amount must be greater than zero.';
  END IF;

  SELECT * INTO v_req
  FROM public.refund_requests
  WHERE id = p_refund_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Refund request % not found.', p_refund_request_id;
  END IF;

  IF v_req.status <> 'REQUESTED' AND v_req.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION '409 Conflict: Refund request % cannot be approved from status %.', p_refund_request_id, v_req.status;
  END IF;

  IF p_approved_amount_tzs > v_req.requested_amount_tzs THEN
    RAISE EXCEPTION '400 Bad Request: Approved amount (%) cannot exceed requested amount (%).',
      p_approved_amount_tzs, v_req.requested_amount_tzs;
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  UPDATE public.refund_requests
  SET status = 'APPROVED',
      approved_amount_tzs = p_approved_amount_tzs,
      responsibility = p_responsibility,
      reviewed_by = v_actor,
      reviewed_at = clock_timestamp()
  WHERE id = p_refund_request_id;

  -- Atomic audit log insertion (same transaction)
  INSERT INTO public.audit_logs (
    admin_user_id,
    admin_name,
    action,
    target_type,
    target_id,
    details,
    created_at
  ) VALUES (
    v_actor::text,
    COALESCE(v_actor_name, 'Super Admin'),
    'APPROVE_REFUND',
    'REFUND',
    p_refund_request_id::text,
    jsonb_build_object(
      'refund_request_id', p_refund_request_id,
      'payment_id', v_req.payment_id,
      'order_id', v_req.order_id,
      'requested_amount_tzs', v_req.requested_amount_tzs,
      'approved_amount_tzs', p_approved_amount_tzs,
      'responsibility', p_responsibility,
      'reason_code', v_req.reason_code,
      'actor', v_actor
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_request_id', p_refund_request_id,
    'status', 'APPROVED',
    'approved_amount_tzs', p_approved_amount_tzs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_refund_secure(UUID, BIGINT, public.refund_responsibility_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_refund_secure(UUID, BIGINT, public.refund_responsibility_enum) TO authenticated, service_role;

-- 5. Hardened Settlement Calculation with Admin Check and Atomic Audit
CREATE OR REPLACE FUNCTION public.calculate_merchant_settlement(
  p_restaurant_id VARCHAR(80),
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_lock_key BIGINT;
  v_settlement_id UUID;
  v_reference VARCHAR(100);
  v_entry RECORD;
  v_gross_sales BIGINT := 0;
  v_refund_adjustments BIGINT := 0;
  v_net_payable BIGINT := 0;
  v_included_count INTEGER := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
  END IF;

  IF NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required to calculate settlements.';
  END IF;

  IF p_period_start >= p_period_end THEN
    RAISE EXCEPTION '400 Bad Request: Period start (%) must precede period end (%).', p_period_start, p_period_end;
  END IF;

  -- 1. Serialize calculation per restaurant using advisory lock
  v_lock_key := hashtext('settlement_' || p_restaurant_id);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 2. Build unique settlement reference
  v_reference := 'SETTL-' || UPPER(SUBSTRING(p_restaurant_id FROM 1 FOR 8)) || '-' || TO_CHAR(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS') || '-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6);

  -- 3. Create initial draft settlement record
  INSERT INTO public.merchant_settlements (
    restaurant_id, period_start, period_end, reference, status
  ) VALUES (
    p_restaurant_id, p_period_start, p_period_end, v_reference, 'CALCULATED'
  ) RETURNING id INTO v_settlement_id;

  -- 4. Iterate over eligible RESTAURANT_PAYABLE ledger entries
  FOR v_entry IN
    SELECT fle.*
    FROM public.financial_ledger_entries fle
    WHERE fle.restaurant_id = p_restaurant_id
      AND fle.account_type = 'RESTAURANT_PAYABLE'
      AND fle.occurred_at >= p_period_start
      AND fle.occurred_at < p_period_end
      AND NOT EXISTS (
        SELECT 1 FROM public.merchant_settlement_items msi
        WHERE msi.ledger_entry_id = fle.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_disputes fd
        WHERE fd.restaurant_id = p_restaurant_id
          AND (fd.payment_id = fle.payment_id OR (fd.entity_id = fle.entity_id AND fd.entity_type = fle.entity_type))
          AND fd.status IN ('OPEN', 'EVIDENCE_REQUIRED', 'UNDER_REVIEW')
      )
      AND (
        fle.entity_type <> 'ORDER' OR EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = fle.entity_id AND o.status = 'COMPLETED'
        )
      )
    ORDER BY fle.occurred_at ASC
  LOOP
    IF v_entry.direction = 'CREDIT' THEN
      v_gross_sales := v_gross_sales + v_entry.amount_tzs;
      v_net_payable := v_net_payable + v_entry.amount_tzs;
    ELSE
      v_refund_adjustments := v_refund_adjustments + v_entry.amount_tzs;
      v_net_payable := v_net_payable - v_entry.amount_tzs;
    END IF;

    INSERT INTO public.merchant_settlement_items (
      settlement_id, ledger_entry_id, order_id, payment_id,
      entry_type, gross_tzs, fee_tzs, adjustment_tzs, net_tzs
    ) VALUES (
      v_settlement_id, v_entry.id,
      CASE WHEN v_entry.entity_type = 'ORDER' THEN v_entry.entity_id ELSE NULL END,
      v_entry.payment_id, v_entry.entry_type,
      CASE WHEN v_entry.direction = 'CREDIT' THEN v_entry.amount_tzs ELSE 0 END,
      0,
      CASE WHEN v_entry.direction = 'DEBIT' THEN v_entry.amount_tzs ELSE 0 END,
      CASE WHEN v_entry.direction = 'CREDIT' THEN v_entry.amount_tzs ELSE -v_entry.amount_tzs END
    );

    v_included_count := v_included_count + 1;
  END LOOP;

  -- 5. Update settlement totals
  UPDATE public.merchant_settlements
  SET gross_sales_tzs = v_gross_sales,
      refund_adjustments_tzs = v_refund_adjustments,
      net_payable_tzs = v_net_payable
  WHERE id = v_settlement_id;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  -- Atomic audit log insertion
  INSERT INTO public.audit_logs (
    admin_user_id, admin_name, action, target_type, target_id, details, created_at
  ) VALUES (
    v_actor::text,
    COALESCE(v_actor_name, 'Admin'),
    'CALCULATE_SETTLEMENT',
    'SETTLEMENT',
    v_settlement_id::text,
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'reference', v_reference,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'net_payable_tzs', v_net_payable,
      'included_items_count', v_included_count
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'reference', v_reference,
    'included_items_count', v_included_count,
    'net_payable_tzs', v_net_payable
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_merchant_settlement(VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_merchant_settlement(VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- 6. Hardened Settlement Approval with SUPER_ADMIN Check and Atomic Audit
CREATE OR REPLACE FUNCTION public.approve_merchant_settlement(p_settlement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_settlement RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
  END IF;

  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN authorization required to approve settlements.';
  END IF;

  SELECT * INTO v_settlement
  FROM public.merchant_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Settlement % not found.', p_settlement_id;
  END IF;

  IF v_settlement.status <> 'CALCULATED' AND v_settlement.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION '409 Conflict: Settlement % cannot be approved from status %.', p_settlement_id, v_settlement.status;
  END IF;

  UPDATE public.merchant_settlements
  SET status = 'APPROVED',
      approved_at = clock_timestamp(),
      approved_by = v_actor
  WHERE id = p_settlement_id;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  -- Atomic audit log insertion
  INSERT INTO public.audit_logs (
    admin_user_id, admin_name, action, target_type, target_id, details, created_at
  ) VALUES (
    v_actor::text,
    COALESCE(v_actor_name, 'Super Admin'),
    'APPROVE_SETTLEMENT',
    'SETTLEMENT',
    p_settlement_id::text,
    jsonb_build_object(
      'settlement_id', p_settlement_id,
      'restaurant_id', v_settlement.restaurant_id,
      'net_payable_tzs', v_settlement.net_payable_tzs,
      'reference', v_settlement.reference
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object('success', true, 'settlement_id', p_settlement_id, 'status', 'APPROVED');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_merchant_settlement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_merchant_settlement(UUID) TO authenticated, service_role;

-- 7. Fix Outbox Schema Contract in publish_platform_announcement_secure
CREATE OR REPLACE FUNCTION public.publish_platform_announcement_secure(
    p_title_en TEXT,
    p_title_sw TEXT DEFAULT NULL,
    p_body_en TEXT DEFAULT NULL,
    p_body_sw TEXT DEFAULT NULL,
    p_target_audience VARCHAR(30) DEFAULT 'ALL',
    p_priority VARCHAR(20) DEFAULT 'NORMAL',
    p_starts_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_cta_label VARCHAR(100) DEFAULT NULL,
    p_cta_url VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_announcement_id UUID;
    v_actor_name TEXT;
    v_title_en TEXT;
    v_title_sw TEXT;
    v_body_en TEXT;
    v_body_sw TEXT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required to publish announcements.';
    END IF;

    v_title_en := trim(COALESCE(p_title_en, ''));
    v_body_en  := trim(COALESCE(p_body_en, ''));

    IF length(v_title_en) < 3 THEN
        RAISE EXCEPTION '400 Bad Request: Announcement title must be at least 3 characters.';
    END IF;

    IF length(v_body_en) < 5 THEN
        RAISE EXCEPTION '400 Bad Request: Announcement body must be at least 5 characters.';
    END IF;

    -- Fallback Swahili text if blank
    v_title_sw := CASE WHEN length(trim(COALESCE(p_title_sw, ''))) > 0 THEN trim(p_title_sw) ELSE v_title_en END;
    v_body_sw  := CASE WHEN length(trim(COALESCE(p_body_sw, ''))) > 0 THEN trim(p_body_sw) ELSE v_body_en END;

    IF p_target_audience NOT IN ('ALL', 'CUSTOMERS', 'RESTAURANTS', 'ADMINS') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid target audience %.', p_target_audience;
    END IF;

    IF p_priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid priority %.', p_priority;
    END IF;

    IF p_expires_at IS NOT NULL AND p_expires_at <= COALESCE(p_starts_at, clock_timestamp()) THEN
        RAISE EXCEPTION '400 Bad Request: Expiration time must be after the start time.';
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Insert announcement row
    INSERT INTO public.platform_announcements (
        title_en, title_sw, body_en, body_sw,
        target_audience, priority, starts_at, expires_at,
        cta_label, cta_url, sent_at, is_active, created_by
    ) VALUES (
        v_title_en, v_title_sw, v_body_en, v_body_sw,
        p_target_audience, p_priority, COALESCE(p_starts_at, clock_timestamp()), p_expires_at,
        trim(p_cta_label), trim(p_cta_url), clock_timestamp(), TRUE, v_actor
    ) RETURNING id INTO v_announcement_id;

    -- Correctly insert into notification_event_outbox with processing_status
    INSERT INTO public.notification_event_outbox (
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        priority,
        communication_class,
        processing_status,
        idempotency_key
    )
    VALUES (
        'SYSTEM_ANNOUNCEMENT',
        'ANNOUNCEMENT',
        v_announcement_id::text,
        jsonb_build_object(
            'announcement_id', v_announcement_id,
            'target_audience', p_target_audience,
            'priority', p_priority,
            'title_en', v_title_en,
            'title_sw', v_title_sw,
            'body_en', v_body_en,
            'body_sw', v_body_sw,
            'cta_label', p_cta_label,
            'cta_url', p_cta_url
        ),
        p_priority::public.notification_priority_enum,
        'OPERATIONAL'::public.communication_class_enum,
        'PENDING',
        'announcement_publish_' || v_announcement_id::text
    );

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'PUBLISH_PLATFORM_ANNOUNCEMENT',
        'ANNOUNCEMENT',
        v_announcement_id::text,
        jsonb_build_object(
            'title', v_title_en,
            'audience', p_target_audience,
            'priority', p_priority,
            'starts_at', COALESCE(p_starts_at, clock_timestamp()),
            'expires_at', p_expires_at
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'announcement_id', v_announcement_id,
        'target_audience', p_target_audience,
        'priority', p_priority,
        'sent_at', clock_timestamp()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) TO authenticated, service_role;

-- 8. Announcement Recipient Resolution in resolve_event_recipients
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
DECLARE
    v_audience TEXT;
BEGIN
    IF p_aggregate_type = 'ANNOUNCEMENT' THEN
        v_audience := COALESCE(p_payload->>'target_audience', 'ALL');

        IF v_audience = 'CUSTOMERS' THEN
            RETURN QUERY
            SELECT DISTINCT
                p.id,
                'CUSTOMER'::VARCHAR(50),
                COALESCE(p.language, 'sw')::VARCHAR(10)
            FROM public.profiles p
            WHERE p.status = 'ACTIVE'
              AND (p.role = 'CUSTOMER' OR 'CUSTOMER' = ANY(p.roles));

        ELSIF v_audience = 'RESTAURANTS' THEN
            RETURN QUERY
            SELECT DISTINCT
                p.id,
                'RESTAURANT'::VARCHAR(50),
                COALESCE(p.language, 'sw')::VARCHAR(10)
            FROM public.profiles p
            WHERE p.status = 'ACTIVE'
              AND (
                  p.role IN ('RESTAURANT_OWNER', 'RESTAURANT_STAFF')
                  OR 'RESTAURANT_OWNER' = ANY(p.roles)
                  OR 'RESTAURANT_STAFF' = ANY(p.roles)
                  OR EXISTS (
                      SELECT 1 FROM public.restaurant_members rm
                      WHERE rm.user_id = p.id AND rm.is_active = TRUE
                  )
              );

        ELSIF v_audience = 'ADMINS' THEN
            RETURN QUERY
            SELECT DISTINCT
                p.id,
                'ADMIN'::VARCHAR(50),
                COALESCE(p.language, 'sw')::VARCHAR(10)
            FROM public.profiles p
            WHERE p.status = 'ACTIVE'
              AND (
                  p.role IN ('ADMIN', 'SUPER_ADMIN')
                  OR 'ADMIN' = ANY(p.roles)
                  OR 'SUPER_ADMIN' = ANY(p.roles)
              );

        ELSE -- 'ALL'
            RETURN QUERY
            SELECT DISTINCT
                p.id,
                CASE
                    WHEN p.role IN ('ADMIN', 'SUPER_ADMIN') THEN 'ADMIN'
                    WHEN p.role IN ('RESTAURANT_OWNER', 'RESTAURANT_STAFF') THEN 'RESTAURANT'
                    ELSE 'CUSTOMER'
                END::VARCHAR(50),
                COALESCE(p.language, 'sw')::VARCHAR(10)
            FROM public.profiles p
            WHERE p.status = 'ACTIVE';
        END IF;

    ELSIF p_aggregate_type = 'RESTAURANT' AND p_event_type::TEXT = 'STAFF_INVITATION' THEN
        IF p_payload ? 'invited_user_id' AND NULLIF(p_payload->>'invited_user_id', '') IS NOT NULL THEN
            RETURN QUERY
            SELECT (p_payload->>'invited_user_id')::UUID, 'INVITED_USER'::VARCHAR(50), 'sw'::VARCHAR(10);
        END IF;
    ELSIF p_aggregate_type = 'ORDER' THEN
        RETURN QUERY
        SELECT o.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o WHERE o.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        JOIN public.restaurant_members rm ON rm.restaurant_id = o.restaurant_id
        WHERE o.id = p_aggregate_id AND rm.is_active = TRUE
          AND ('ALL' = ANY(rm.permissions) OR 'ORDERS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
    ELSIF p_aggregate_type = 'RESERVATION' THEN
        RETURN QUERY
        SELECT r.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r WHERE r.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r
        JOIN public.restaurant_members rm ON rm.restaurant_id = r.restaurant_id
        WHERE r.id = p_aggregate_id AND rm.is_active = TRUE
          AND ('ALL' = ANY(rm.permissions) OR 'RESERVATIONS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
    ELSIF p_aggregate_type = 'CUSTOM_MEAL' THEN
        RETURN QUERY
        SELECT cmr.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.custom_meal_requests cmr WHERE cmr.id = p_aggregate_id;

        IF p_payload ? 'target_restaurant_id' THEN
            RETURN QUERY
            SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
            FROM public.restaurant_members rm
            WHERE rm.restaurant_id = (p_payload->>'target_restaurant_id') AND rm.is_active = TRUE;
        END IF;
    ELSIF p_aggregate_type IN ('PAYMENT', 'REFUND') THEN
        RETURN QUERY
        SELECT p.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.payments p WHERE p.id = p_aggregate_id;
    ELSIF p_aggregate_type = 'REVIEW' THEN
        RETURN QUERY
        SELECT rev.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev WHERE rev.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_OWNER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev
        JOIN public.restaurant_members rm ON rm.restaurant_id = rev.restaurant_id
        WHERE rev.id = p_aggregate_id AND rm.is_active = TRUE AND rm.role IN ('OWNER', 'MANAGER');
    ELSIF p_aggregate_type IN ('SETTLEMENT', 'PAYOUT') AND p_payload ? 'restaurant_id' THEN
        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_FINANCE'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.restaurant_members rm
        WHERE rm.restaurant_id = (p_payload->>'restaurant_id') AND rm.is_active = TRUE
          AND (rm.role = 'OWNER' OR ('FINANCE' = ANY(rm.permissions) AND rm.role = 'MANAGER'));
    ELSIF p_aggregate_type = 'ACCOUNT' AND p_payload ? 'user_id' THEN
        RETURN QUERY
        SELECT (p_payload->>'user_id')::UUID, 'ACCOUNT_HOLDER'::VARCHAR(50), 'sw'::VARCHAR(10);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_event_recipients(notification_event_type_enum, VARCHAR, VARCHAR, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_event_recipients(notification_event_type_enum, VARCHAR, VARCHAR, JSONB) TO service_role;

-- 9. Real System Templates for SYSTEM_ANNOUNCEMENT
INSERT INTO public.notification_templates (event_type, channel, locale, title_template, body_template, allowlisted_keys)
VALUES
('SYSTEM_ANNOUNCEMENT', 'IN_APP', 'en', '{{title_en}}', '{{body_en}}', ARRAY['title_en', 'title_sw', 'body_en', 'body_sw', 'announcement_id', 'target_audience', 'priority', 'cta_label', 'cta_url']),
('SYSTEM_ANNOUNCEMENT', 'IN_APP', 'sw', '{{title_sw}}', '{{body_sw}}', ARRAY['title_en', 'title_sw', 'body_en', 'body_sw', 'announcement_id', 'target_audience', 'priority', 'cta_label', 'cta_url'])
ON CONFLICT (event_type, channel, locale) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    allowlisted_keys = EXCLUDED.allowlisted_keys,
    is_active = TRUE,
    version = public.notification_templates.version + 1;

-- 10. Truthful Announcement History RPC
CREATE OR REPLACE FUNCTION public.get_admin_announcements_history()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT jsonb_agg(ann_row) INTO v_result
    FROM (
        SELECT
            pa.id,
            pa.title_en,
            pa.title_sw,
            pa.body_en,
            pa.body_sw,
            pa.target_audience,
            pa.priority,
            pa.starts_at,
            pa.expires_at,
            pa.sent_at,
            pa.is_active,
            pa.cta_label,
            pa.cta_url,
            pa.created_at,
            pa.created_by,
            p.full_name AS created_by_name,
            CASE
                WHEN pa.is_active = FALSE THEN 'DISABLED'
                WHEN pa.expires_at IS NOT NULL AND pa.expires_at < clock_timestamp() THEN 'EXPIRED'
                WHEN pa.starts_at > clock_timestamp() THEN 'SCHEDULED'
                ELSE 'LIVE'
            END AS calculated_status,
            COALESCE(r.read_count, 0) AS read_count,
            COALESCE(r.dismissed_count, 0) AS dismissed_count,
            COALESCE(o.outbox_status, 'COMPLETED') AS outbox_status,
            COALESCE(o.retry_count, 0) AS retry_count,
            o.last_error
        FROM public.platform_announcements pa
        LEFT JOIN public.profiles p ON p.id = pa.created_by
        LEFT JOIN (
            SELECT
                announcement_id,
                COUNT(read_at) AS read_count,
                COUNT(dismissed_at) AS dismissed_count
            FROM public.platform_announcement_receipts
            GROUP BY announcement_id
        ) r ON r.announcement_id = pa.id
        LEFT JOIN (
            SELECT
                aggregate_id,
                processing_status AS outbox_status,
                retry_count,
                last_error
            FROM public.notification_event_outbox
            WHERE aggregate_type = 'ANNOUNCEMENT'
        ) o ON o.aggregate_id = pa.id::text
        ORDER BY pa.created_at DESC
        LIMIT 50
    ) ann_row;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_announcements_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_announcements_history() TO authenticated, service_role;

-- 11. Canonical Status Alignment in get_admin_attention_summary
CREATE OR REPLACE FUNCTION public.get_admin_attention_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_pending_apps INTEGER := 0;
    v_open_reports INTEGER := 0;
    v_suspended_rests INTEGER := 0;
    v_unverified_rests INTEGER := 0;
    v_stuck_orders INTEGER := 0;
    v_stuck_payments INTEGER := 0;
    v_pending_refunds INTEGER := 0;
    v_dead_letter_notifs INTEGER := 0;
    v_degraded_workers INTEGER := 0;

    v_critical JSONB := '[]'::jsonb;
    v_warning JSONB := '[]'::jsonb;
    v_info JSONB := '[]'::jsonb;
    v_is_optimal BOOLEAN := TRUE;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- 1. Pending Applications
    BEGIN
        SELECT COUNT(*) INTO v_pending_apps
        FROM public.restaurant_applications
        WHERE status = 'PENDING';
    EXCEPTION WHEN undefined_table THEN v_pending_apps := 0;
    END;

    -- 2. Open Customer Reports
    BEGIN
        SELECT COUNT(*) INTO v_open_reports
        FROM public.data_reports
        WHERE status = 'OPEN';
    EXCEPTION WHEN undefined_table THEN
        BEGIN
            SELECT COUNT(*) INTO v_open_reports
            FROM public.customer_discrepancy_reports
            WHERE status = 'OPEN';
        EXCEPTION WHEN undefined_table THEN v_open_reports := 0;
        END;
    END;

    -- 3. Suspended & Unverified Restaurants
    BEGIN
        SELECT
            COUNT(*) FILTER (WHERE verification_status = 'SUSPENDED' OR archived_at IS NOT NULL),
            COUNT(*) FILTER (WHERE verification_status = 'PENDING_VERIFICATION' AND archived_at IS NULL)
        INTO v_suspended_rests, v_unverified_rests
        FROM public.restaurants;
    EXCEPTION WHEN undefined_table THEN
        v_suspended_rests := 0;
        v_unverified_rests := 0;
    END;

    -- 4. Stuck Orders (PENDING > 15m or PREPARING > 60m)
    BEGIN
        SELECT COUNT(*) INTO v_stuck_orders
        FROM public.orders
        WHERE (status = 'PENDING' AND created_at < clock_timestamp() - INTERVAL '15 minutes')
           OR (status = 'PREPARING' AND updated_at < clock_timestamp() - INTERVAL '60 minutes');
    EXCEPTION WHEN undefined_table THEN v_stuck_orders := 0;
    END;

    -- 5. Stuck Payments (Canonical status = PENDING > 15m)
    BEGIN
        SELECT COUNT(*) INTO v_stuck_payments
        FROM public.payments
        WHERE status = 'PENDING'
          AND created_at < clock_timestamp() - INTERVAL '15 minutes';
    EXCEPTION WHEN undefined_table THEN v_stuck_payments := 0;
    END;

    -- 6. Pending Refund Requests (Canonical statuses: REQUESTED, UNDER_REVIEW, MANUAL_ACTION_REQUIRED)
    BEGIN
        SELECT COUNT(*) INTO v_pending_refunds
        FROM public.refund_requests
        WHERE status IN ('REQUESTED', 'UNDER_REVIEW', 'MANUAL_ACTION_REQUIRED');
    EXCEPTION WHEN undefined_table THEN v_pending_refunds := 0;
    END;

    -- 7. Dead Letter Notifications (Using processing_status)
    BEGIN
        SELECT COUNT(*) INTO v_dead_letter_notifs
        FROM public.notification_event_outbox
        WHERE processing_status = 'DEAD_LETTER'
           OR (processing_status = 'FAILED' AND retry_count >= 5);
    EXCEPTION WHEN undefined_table THEN v_dead_letter_notifs := 0;
    END;

    -- 8. Degraded / Stale Worker Heartbeats
    BEGIN
        SELECT COUNT(*) INTO v_degraded_workers
        FROM public.system_worker_heartbeats
        WHERE status <> 'HEALTHY'
           OR last_heartbeat < clock_timestamp() - INTERVAL '15 minutes';
    EXCEPTION WHEN undefined_table THEN v_degraded_workers := 0;
    END;

    -- Assemble Critical Queue Items
    IF v_dead_letter_notifs > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_notif_dead_letter',
            'severity', 'CRITICAL',
            'title', v_dead_letter_notifs || ' Dead-Letter Notification(s)',
            'description', 'Events exceeded retry ceiling in notification outbox. Requires inspection.',
            'targetTab', 'NOTIFICATIONS',
            'count', v_dead_letter_notifs
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_degraded_workers > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_worker_degraded',
            'severity', 'CRITICAL',
            'title', v_degraded_workers || ' Worker Service(s) Degraded',
            'description', 'One or more background jobs missed scheduled heartbeat (>15m).',
            'targetTab', 'HEALTH',
            'count', v_degraded_workers
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_stuck_payments > 0 THEN
        v_critical := v_critical || jsonb_build_object(
            'id', 'crit_stuck_payments',
            'severity', 'CRITICAL',
            'title', v_stuck_payments || ' Stalled Payment(s)',
            'description', 'Payments pending > 15 minutes without carrier or gateway webhook confirmation.',
            'targetTab', 'PAYMENTS',
            'count', v_stuck_payments
        );
        v_is_optimal := FALSE;
    END IF;

    -- Assemble Warning Queue Items
    IF v_pending_refunds > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_refunds_action',
            'severity', 'WARNING',
            'title', v_pending_refunds || ' Refund Request(s) Pending',
            'description', 'Customer refund requests awaiting authoritative Super Admin review.',
            'targetTab', 'REFUNDS',
            'count', v_pending_refunds
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_pending_apps > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_pending_applications',
            'severity', 'WARNING',
            'title', v_pending_apps || ' Vendor Application(s)',
            'description', 'New restaurant applications awaiting compliance review and onboarding.',
            'targetTab', 'APPLICATIONS',
            'count', v_pending_apps
        );
        v_is_optimal := FALSE;
    END IF;

    IF v_stuck_orders > 0 THEN
        v_warning := v_warning || jsonb_build_object(
            'id', 'warn_stuck_orders',
            'severity', 'WARNING',
            'title', v_stuck_orders || ' Stalled Kitchen Order(s)',
            'description', 'Orders pending acceptance or delayed in kitchen preparation queue.',
            'targetTab', 'ORDERS',
            'count', v_stuck_orders
        );
        v_is_optimal := FALSE;
    END IF;

    -- Assemble Info Queue Items
    IF v_open_reports > 0 THEN
        v_info := v_info || jsonb_build_object(
            'id', 'info_open_reports',
            'severity', 'INFO',
            'title', v_open_reports || ' Open Customer Data Report(s)',
            'description', 'Customer reports on incorrect prices or out-of-stock items requiring follow-up.',
            'targetTab', 'REPORTS',
            'count', v_open_reports
        );
    END IF;

    IF v_suspended_rests > 0 THEN
        v_info := v_info || jsonb_build_object(
            'id', 'info_suspended_rests',
            'severity', 'INFO',
            'title', v_suspended_rests || ' Inactive / Suspended Restaurant(s)',
            'description', 'Delisted or suspended vendor profiles excluded from marketplace discovery.',
            'targetTab', 'RESTAURANTS',
            'count', v_suspended_rests
        );
    END IF;

    IF v_unverified_rests > 0 THEN
        v_info := v_info || jsonb_build_object(
            'id', 'info_unverified_rests',
            'severity', 'INFO',
            'title', v_unverified_rests || ' Restaurant(s) Pending Document Verification',
            'description', 'Vendors operating without verified TIN or business license credentials.',
            'targetTab', 'VERIFICATION',
            'count', v_unverified_rests
        );
    END IF;

    RETURN jsonb_build_object(
        'critical', v_critical,
        'warning', v_warning,
        'info', v_info,
        'is_optimal', v_is_optimal,
        'checked_at', clock_timestamp()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_attention_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_attention_summary() TO authenticated, service_role;

-- 12. Secure Restaurant Governance RPCs with Atomic Audit
CREATE OR REPLACE FUNCTION public.suspend_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT DEFAULT 'Administrative suspension'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rest RECORD;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    UPDATE public.restaurants
    SET is_active = FALSE,
        is_published = FALSE,
        verification_status = 'SUSPENDED',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'SUSPEND_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object('reason', p_reason, 'previous_status', v_rest.verification_status),
        clock_timestamp()
    );

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'status', 'SUSPENDED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reactivate_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT DEFAULT 'Administrative reactivation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rest RECORD;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    UPDATE public.restaurants
    SET is_active = TRUE,
        verification_status = 'VERIFIED',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'REACTIVATE_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object('reason', p_reason),
        clock_timestamp()
    );

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'status', 'VERIFIED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_tin_number TEXT,
    p_business_license_number TEXT,
    p_reason TEXT DEFAULT 'Documents verified'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rest RECORD;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    UPDATE public.restaurants
    SET tin_number = p_tin_number,
        business_license_number = p_business_license_number,
        is_verified = TRUE,
        verification_status = 'VERIFIED',
        seller_tier = 'VERIFIED_SELLER',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'VERIFY_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'tin_number', p_tin_number,
            'business_license_number', p_business_license_number,
            'reason', p_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'verification_status', 'VERIFIED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_restaurant_secure(VARCHAR, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 13. Secure Customer Data Report Resolution with Atomic Audit
CREATE OR REPLACE FUNCTION public.resolve_data_report_secure(
    p_report_id UUID,
    p_status VARCHAR(30),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rep RECORD;
BEGIN
    IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
    END IF;

    IF p_status NOT IN ('INVESTIGATING', 'RESOLVED', 'REJECTED') THEN
        RAISE EXCEPTION '400 Bad Request: Invalid report status %.', p_status;
    END IF;

    SELECT * INTO v_rep FROM public.data_reports WHERE id = p_report_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Data report % not found.', p_report_id;
    END IF;

    UPDATE public.data_reports
    SET status = p_status,
        resolution_notes = p_notes,
        resolved_by = v_actor,
        resolved_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_report_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'RESOLVE_DATA_REPORT',
        'DATA_REPORT',
        p_report_id::text,
        jsonb_build_object(
            'status', p_status,
            'notes', p_notes,
            'restaurant_id', v_rep.restaurant_id
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object('success', TRUE, 'report_id', p_report_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_data_report_secure(UUID, VARCHAR, TEXT) TO authenticated, service_role;

-- 14. Operational Gate: Before Insert Trigger for Vendor Applications
CREATE OR REPLACE FUNCTION public.check_restaurant_applications_enabled()
RETURNS TRIGGER AS $$
DECLARE
    v_enabled BOOLEAN := TRUE;
BEGIN
    SELECT restaurant_applications_enabled INTO v_enabled
    FROM public.platform_operational_settings WHERE id = TRUE;

    IF v_enabled IS FALSE THEN
        RAISE EXCEPTION '403 Forbidden: Vendor applications are currently paused by the platform administrator.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_check_restaurant_applications_enabled ON public.restaurant_applications;
CREATE TRIGGER trg_check_restaurant_applications_enabled
    BEFORE INSERT ON public.restaurant_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_restaurant_applications_enabled();
