-- ============================================================================
-- MLOHUB RESTAURANT PHASE 3: MERCHANT FINANCE, PAYOUTS, REFUNDS & ANALYTICS
-- Migration: 20260928000300_restaurant_finance_payouts_and_analytics.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NOTIFICATION EVENT TYPE: RESTAURANT_PAYMENT_CAPTURED
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'RESTAURANT_PAYMENT_CAPTURED'
          AND enumtypid = 'public.notification_event_type_enum'::regtype
    ) THEN
        ALTER TYPE public.notification_event_type_enum ADD VALUE 'RESTAURANT_PAYMENT_CAPTURED';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION TEMPLATES: RESTAURANT_PAYMENT_CAPTURED
-- ----------------------------------------------------------------------------
INSERT INTO public.notification_templates (
    event_type,
    channel,
    language,
    subject_template,
    body_template,
    cta_type,
    cta_target_template,
    is_active
) VALUES
(
    'RESTAURANT_PAYMENT_CAPTURED',
    'IN_APP',
    'en',
    'Payment confirmed for order #{{order_number}}',
    'Customer paid TSh {{customer_paid}} • Restaurant earning TSh {{restaurant_earning}} • Platform fee TSh {{platform_fee}}',
    'DEEP_LINK',
    'mlohub://restaurant-portal?tab=earnings',
    TRUE
),
(
    'RESTAURANT_PAYMENT_CAPTURED',
    'IN_APP',
    'sw',
    'Malipo yamethibitishwa kwa oda #{{order_number}}',
    'Mteja amelipa TSh {{customer_paid}} • Mapato ya mgahawa TSh {{restaurant_earning}} • Makato ya jukwaa TSh {{platform_fee}}',
    'DEEP_LINK',
    'mlohub://restaurant-portal?tab=earnings',
    TRUE
),
(
    'RESTAURANT_PAYMENT_CAPTURED',
    'PUSH',
    'en',
    'Payment confirmed for order #{{order_number}}',
    'Customer paid TSh {{customer_paid}} • Restaurant earning TSh {{restaurant_earning}} • Platform fee TSh {{platform_fee}}',
    'DEEP_LINK',
    'mlohub://restaurant-portal?tab=earnings',
    TRUE
),
(
    'RESTAURANT_PAYMENT_CAPTURED',
    'PUSH',
    'sw',
    'Malipo yamethibitishwa kwa oda #{{order_number}}',
    'Mteja amelipa TSh {{customer_paid}} • Mapato ya mgahawa TSh {{restaurant_earning}} • Makato ya jukwaa TSh {{platform_fee}}',
    'DEEP_LINK',
    'mlohub://restaurant-portal?tab=earnings',
    TRUE
)
ON CONFLICT (event_type, channel, language) DO UPDATE SET
    subject_template = EXCLUDED.subject_template,
    body_template = EXCLUDED.body_template,
    is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 3. ROUTE RESTAURANT_PAYMENT_CAPTURED TO RESTAURANT FINANCE MEMBERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_event_recipients(
    p_event_type VARCHAR(50),
    p_aggregate_type VARCHAR(50),
    p_aggregate_id VARCHAR(80),
    p_payload JSONB
)
RETURNS TABLE (
    recipient_user_id UUID,
    recipient_role VARCHAR(50),
    preferred_language VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Special routing for RESTAURANT_NEW_PAID_ORDER
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

    -- Special routing for RESTAURANT_PAYMENT_CAPTURED (Financial members only)
    IF p_event_type = 'RESTAURANT_PAYMENT_CAPTURED' THEN
        RETURN QUERY
        SELECT DISTINCT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        JOIN public.restaurant_members rm ON rm.restaurant_id = o.restaurant_id
        WHERE o.id = p_aggregate_id
          AND rm.is_active = TRUE
          AND (
              rm.role = 'OWNER'
              OR (rm.role = 'MANAGER' AND (
                  'ALL' = ANY(rm.permissions)
                  OR 'FINANCE' = ANY(rm.permissions)
                  OR 'MANAGE_FINANCE' = ANY(rm.permissions)
                  OR 'VIEW_FINANCE' = ANY(rm.permissions)
              ))
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
            WHERE rm.restaurant_id = (p_payload->>'target_restaurant_id')::VARCHAR(80)
              AND rm.is_active = true
              AND ('ALL' = ANY(rm.permissions) OR 'CUSTOM_MEALS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
        END IF;

    ELSIF p_aggregate_type = 'SETTLEMENT' THEN
        -- Restaurant financial contacts: OWNER or MANAGER with FINANCE permission
        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.merchant_settlements ms
        JOIN public.restaurant_members rm ON rm.restaurant_id = ms.restaurant_id
        WHERE ms.id = p_aggregate_id::UUID
          AND rm.is_active = true
          AND (rm.role = 'OWNER' OR 'ALL' = ANY(rm.permissions) OR 'FINANCE' = ANY(rm.permissions));

    ELSIF p_aggregate_type = 'PAYMENT' THEN
        -- Customer who made the payment
        RETURN QUERY
        SELECT p.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.payments p
        WHERE p.id = p_aggregate_id;

    ELSIF p_aggregate_type = 'USER' THEN
        -- Individual user notification (Auth/Security)
        RETURN QUERY
        SELECT p_aggregate_id::UUID, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. AUTHORITATIVE FINANCIAL SUMMARY RPC: get_restaurant_financial_summary
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_restaurant_financial_summary(
    p_restaurant_id VARCHAR(80),
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
    v_from TIMESTAMPTZ;
    v_to TIMESTAMPTZ;
    v_gross_food BIGINT := 0;
    v_platform_comm BIGINT := 0;
    v_service_fee BIGINT := 0;
    v_delivery_share BIGINT := 0;
    v_restaurant_payable BIGINT := 0;
    v_refund_deductions BIGINT := 0;
    v_adjustments BIGINT := 0;
    v_settled_amount BIGINT := 0;
    v_pending_amount BIGINT := 0;
    v_paid_out_amount BIGINT := 0;
BEGIN
    -- 1. Authorization: service_role, platform admin, or restaurant member with finance permission
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSIF public.is_admin(auth.uid()) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = p_restaurant_id
              AND user_id = auth.uid()
              AND is_active = TRUE
              AND (
                  role = 'OWNER'
                  OR (role = 'MANAGER' AND (
                      'ALL' = ANY(permissions)
                      OR 'FINANCE' = ANY(permissions)
                      OR 'MANAGE_FINANCE' = ANY(permissions)
                      OR 'VIEW_FINANCE' = ANY(permissions)
                  ))
              )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks finance permissions for restaurant "%"', p_restaurant_id;
    END IF;

    -- Defaults: from epoch (1970) to far future (2100) if unbounded
    v_from := COALESCE(p_from, '1970-01-01 00:00:00+00'::TIMESTAMPTZ);
    v_to := COALESCE(p_to, '2100-01-01 00:00:00+00'::TIMESTAMPTZ);

    -- 2. Aggregate from immutable order_financial_snapshots
    SELECT
        COALESCE(SUM(ofs.gross_food_sales_tzs), 0),
        COALESCE(SUM(ofs.platform_commission_tzs), 0),
        COALESCE(SUM(ofs.customer_service_fee_tzs), 0),
        COALESCE(SUM(ofs.restaurant_delivery_fee_tzs), 0),
        COALESCE(SUM(ofs.restaurant_net_payable_tzs), 0)
    INTO
        v_gross_food,
        v_platform_comm,
        v_service_fee,
        v_delivery_share,
        v_restaurant_payable
    FROM public.order_financial_snapshots ofs
    WHERE ofs.restaurant_id = p_restaurant_id
      AND ofs.created_at >= v_from
      AND ofs.created_at <= v_to;

    -- 3. Aggregate completed refunds from refund_requests
    SELECT COALESCE(SUM(COALESCE(rr.approved_amount_tzs, rr.requested_amount_tzs)), 0)
    INTO v_refund_deductions
    FROM public.refund_requests rr
    WHERE rr.restaurant_id = p_restaurant_id
      AND rr.status IN ('COMPLETED', 'APPROVED')
      AND rr.created_at >= v_from
      AND rr.created_at <= v_to;

    -- 4. Aggregate financial adjustments
    SELECT COALESCE(SUM(fa.amount_tzs), 0)
    INTO v_adjustments
    FROM public.financial_adjustments fa
    WHERE fa.restaurant_id = p_restaurant_id
      AND fa.created_at >= v_from
      AND fa.created_at <= v_to;

    -- 5. Aggregate settlements
    SELECT
        COALESCE(SUM(ms.net_payable_tzs) FILTER (WHERE ms.status = 'PAID'), 0),
        COALESCE(SUM(ms.net_payable_tzs) FILTER (WHERE ms.status IN ('DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'PAYOUT_PENDING')), 0)
    INTO
        v_settled_amount,
        v_pending_amount
    FROM public.merchant_settlements ms
    WHERE ms.restaurant_id = p_restaurant_id
      AND ms.created_at >= v_from
      AND ms.created_at <= v_to;

    -- 6. Aggregate payouts completed
    SELECT COALESCE(SUM(mp.amount_tzs) FILTER (WHERE mp.status = 'COMPLETED'), 0)
    INTO v_paid_out_amount
    FROM public.merchant_payouts mp
    WHERE mp.restaurant_id = p_restaurant_id
      AND mp.requested_at >= v_from
      AND mp.requested_at <= v_to;

    RETURN jsonb_build_object(
        'restaurant_id', p_restaurant_id,
        'from', v_from,
        'to', v_to,
        'gross_food_sales', v_gross_food,
        'platform_commission', v_platform_comm,
        'service_fee_platform_revenue', v_service_fee,
        'refund_deductions', v_refund_deductions,
        'adjustments', v_adjustments,
        'delivery_restaurant_share', v_delivery_share,
        'restaurant_payable', GREATEST(0, v_restaurant_payable - v_refund_deductions - v_adjustments),
        'settled_amount', v_settled_amount,
        'pending_amount', v_pending_amount,
        'paid_out_amount', v_paid_out_amount
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC SERVER-SIDE PAYOUT DESTINATION RPC: create_payout_destination_secure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payout_destination_secure(
    p_restaurant_id VARCHAR(80),
    p_destination_type VARCHAR(50),
    p_provider VARCHAR(50),
    p_masked_identifier VARCHAR(50),
    p_account_name VARCHAR(150),
    p_raw_identifier TEXT,
    p_is_default BOOLEAN DEFAULT FALSE,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_dest_id UUID;
    v_dest_type public.payout_destination_type_enum;
BEGIN
    v_caller_id := COALESCE(p_created_by, auth.uid());

    -- 1. Authorization: service_role, platform admin, or restaurant OWNER / permitted MANAGER
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSIF public.is_admin(v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = p_restaurant_id
              AND user_id = v_caller_id
              AND is_active = TRUE
              AND (
                  role = 'OWNER'
                  OR (role = 'MANAGER' AND (
                      'ALL' = ANY(permissions)
                      OR 'FINANCE' = ANY(permissions)
                      OR 'MANAGE_FINANCE' = ANY(permissions)
                  ))
              )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permissions to manage payout destinations for restaurant "%"', p_restaurant_id;
    END IF;

    -- 2. Input validation
    IF p_raw_identifier IS NULL OR length(trim(p_raw_identifier)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Account identifier cannot be empty';
    END IF;
    IF p_account_name IS NULL OR length(trim(p_account_name)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Account name cannot be empty';
    END IF;
    IF p_masked_identifier IS NULL OR length(trim(p_masked_identifier)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Masked account identifier cannot be empty';
    END IF;

    v_dest_type := p_destination_type::public.payout_destination_type_enum;

    -- 3. If setting as default, unset existing default destinations for this restaurant
    IF p_is_default THEN
        UPDATE public.merchant_payout_destinations
        SET is_default = FALSE
        WHERE restaurant_id = p_restaurant_id;
    END IF;

    -- 4. Insert public metadata row
    INSERT INTO public.merchant_payout_destinations (
        restaurant_id,
        destination_type,
        provider,
        masked_account_identifier,
        account_name,
        verification_status,
        is_default,
        created_by
    ) VALUES (
        p_restaurant_id,
        v_dest_type,
        p_provider,
        p_masked_identifier,
        p_account_name,
        'VERIFIED'::public.destination_verification_status_enum,
        p_is_default,
        v_caller_id
    )
    RETURNING id INTO v_dest_id;

    -- 5. Insert private secret row inside the SAME transaction
    -- If this fails, the transaction automatically rolls back the public row!
    INSERT INTO public.merchant_payout_destination_secrets (
        destination_id,
        encrypted_account_reference
    ) VALUES (
        v_dest_id,
        p_raw_identifier
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'destination_id', v_dest_id,
        'masked_identifier', p_masked_identifier
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. SET DEFAULT & DISABLE PAYOUT DESTINATION RPCS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_default_payout_destination_secure(
    p_restaurant_id VARCHAR(80),
    p_destination_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF auth.role() = 'service_role' OR public.is_admin(auth.uid()) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = p_restaurant_id
              AND user_id = auth.uid()
              AND is_active = TRUE
              AND (
                  role = 'OWNER'
                  OR (role = 'MANAGER' AND (
                      'ALL' = ANY(permissions)
                      OR 'FINANCE' = ANY(permissions)
                      OR 'MANAGE_FINANCE' = ANY(permissions)
                  ))
              )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permissions for restaurant "%"', p_restaurant_id;
    END IF;

    UPDATE public.merchant_payout_destinations
    SET is_default = (id = p_destination_id)
    WHERE restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_payout_destination_secure(
    p_restaurant_id VARCHAR(80),
    p_destination_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF auth.role() = 'service_role' OR public.is_admin(auth.uid()) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = p_restaurant_id
              AND user_id = auth.uid()
              AND is_active = TRUE
              AND (
                  role = 'OWNER'
                  OR (role = 'MANAGER' AND (
                      'ALL' = ANY(permissions)
                      OR 'FINANCE' = ANY(permissions)
                      OR 'MANAGE_FINANCE' = ANY(permissions)
                  ))
              )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permissions for restaurant "%"', p_restaurant_id;
    END IF;

    UPDATE public.merchant_payout_destinations
    SET verification_status = 'REJECTED'::public.destination_verification_status_enum,
        is_default = FALSE
    WHERE restaurant_id = p_restaurant_id
      AND id = p_destination_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. REINFORCE RLS POLICIES FOR FINANCE ISOLATION
-- ----------------------------------------------------------------------------
-- Ensure merchant_payout_destinations can only be read by OWNER or permitted finance MANAGER
DROP POLICY IF EXISTS p_select_merchant_payout_destinations ON public.merchant_payout_destinations;
CREATE POLICY p_select_merchant_payout_destinations
  ON public.merchant_payout_destinations FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_payout_destinations.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.is_active = TRUE
        AND (
            rm.role = 'OWNER'
            OR (rm.role = 'MANAGER' AND (
                'ALL' = ANY(rm.permissions)
                OR 'FINANCE' = ANY(rm.permissions)
                OR 'VIEW_FINANCE' = ANY(rm.permissions)
            ))
        )
    )
  );

-- Direct client inserts into merchant_payout_destinations are forbidden (must go through secure RPC / Edge Function)
DROP POLICY IF EXISTS p_insert_merchant_payout_destinations ON public.merchant_payout_destinations;

-- Confirm merchant_payout_destination_secrets has zero client access
DROP POLICY IF EXISTS p_all_merchant_payout_destination_secrets ON public.merchant_payout_destination_secrets;
ALTER TABLE public.merchant_payout_destination_secrets ENABLE ROW LEVEL SECURITY;

-- Settlements read policy: strictly OWNER and permitted finance MANAGER
DROP POLICY IF EXISTS p_select_merchant_settlements ON public.merchant_settlements;
CREATE POLICY p_select_merchant_settlements
  ON public.merchant_settlements FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_settlements.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.is_active = TRUE
        AND (
            rm.role = 'OWNER'
            OR (rm.role = 'MANAGER' AND (
                'ALL' = ANY(rm.permissions)
                OR 'FINANCE' = ANY(rm.permissions)
                OR 'VIEW_FINANCE' = ANY(rm.permissions)
            ))
        )
    )
  );

-- Payouts read policy: strictly OWNER and permitted finance MANAGER
DROP POLICY IF EXISTS p_select_merchant_payouts ON public.merchant_payouts;
CREATE POLICY p_select_merchant_payouts
  ON public.merchant_payouts FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_payouts.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.is_active = TRUE
        AND (
            rm.role = 'OWNER'
            OR (rm.role = 'MANAGER' AND (
                'ALL' = ANY(rm.permissions)
                OR 'FINANCE' = ANY(rm.permissions)
                OR 'VIEW_FINANCE' = ANY(rm.permissions)
            ))
        )
    )
  );
