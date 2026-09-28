-- ============================================================================
-- MLOHUB PRODUCTION SECURITY CLOSURE: AAL2 MFA ENFORCEMENT, RATE LIMITING & AUDIT
-- Migration: 20260927000200_security_aal2_ratelimits.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REQUIRE ADMIN AAL2 (DATABASE-LEVEL MFA ENFORCEMENT)
-- ----------------------------------------------------------------------------
-- Enforces that administrative operations require Level 2 Authenticator Assurance (AAL2).
-- Service-role operations (cron, server-side jobs) bypass this check.
CREATE OR REPLACE FUNCTION public.require_admin_aal2()
RETURNS VOID AS $$
DECLARE
    v_aal TEXT;
    v_role TEXT;
BEGIN
    -- Allow service_role to bypass user-level MFA requirement
    v_role := COALESCE(auth.role(), '');
    IF v_role = 'service_role' THEN
        RETURN;
    END IF;

    -- Ensure caller has active admin credentials
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- Check AAL claim in JWT token
    BEGIN
        v_aal := auth.jwt() ->> 'aal';
    EXCEPTION WHEN OTHERS THEN
        v_aal := NULL;
    END;

    -- Fallback check for session setting
    IF v_aal IS NULL THEN
        BEGIN
            v_aal := current_setting('request.jwt.claim.aal', true);
        EXCEPTION WHEN OTHERS THEN
            v_aal := NULL;
        END;
    END IF;

    -- Enforce AAL2
    IF v_aal IS DISTINCT FROM 'aal2' THEN
        RAISE EXCEPTION '403 Forbidden: Administrative actions require Level 2 Authenticator Assurance (MFA AAL2). Please complete TOTP challenge.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.require_admin_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_admin_aal2() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. SECURE HIGH-RISK ADMIN RPCS WITH AAL2 CHECK
-- ----------------------------------------------------------------------------

-- A. change_platform_role
CREATE OR REPLACE FUNCTION public.change_platform_role(
    p_target_user_id UUID,
    p_new_role user_role_enum,
    p_new_account_type VARCHAR(30)
)
RETURNS JSONB AS $$
BEGIN
    -- Enforce MFA AAL2 on role escalation
    PERFORM public.require_admin_aal2();

    -- Elevating to SUPER_ADMIN requires caller to already be SUPER_ADMIN
    IF (p_new_role = 'SUPER_ADMIN' OR p_new_account_type = 'SUPER_ADMIN') AND NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Only a Super Admin can promote a user to Super Admin.';
    END IF;

    UPDATE public.profiles
    SET role = p_new_role,
        roles = ARRAY[p_new_role],
        account_type = p_new_account_type,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'CHANGE_ROLE', 'USER', p_target_user_id::text, jsonb_build_object('new_role', p_new_role, 'new_account_type', p_new_account_type));

    RETURN jsonb_build_object('success', TRUE, 'user_id', p_target_user_id, 'role', p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.change_platform_role(UUID, user_role_enum, VARCHAR) TO authenticated, service_role;


-- B. suspend_restaurant
CREATE OR REPLACE FUNCTION public.suspend_restaurant(p_restaurant_id VARCHAR(80), p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.require_admin_aal2();

    UPDATE public.restaurants
    SET is_open = FALSE, is_verified = FALSE, verification_status = 'SUSPENDED', updated_at = NOW()
    WHERE id = p_restaurant_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'SUSPEND_RESTAURANT', 'RESTAURANT', p_restaurant_id, jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'status', 'SUSPENDED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.suspend_restaurant(VARCHAR, TEXT) TO authenticated, service_role;


-- C. suspend_restaurant_secure
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
    PERFORM public.require_admin_aal2();

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


-- D. admin_delete_restaurant
CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
BEGIN
    PERFORM public.require_admin_aal2();
    RAISE EXCEPTION 'Physical deletion of restaurants is strictly prohibited to preserve financial ledger, tax, and order history. Use archive_restaurant_secure instead.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(VARCHAR) TO authenticated, service_role;


-- E. suspend_user_profile_secure
CREATE OR REPLACE FUNCTION public.suspend_user_profile_secure(
    p_user_id UUID,
    p_should_suspend BOOLEAN,
    p_reason TEXT DEFAULT 'Terms of service review'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_target_role TEXT;
    v_new_status TEXT;
BEGIN
    PERFORM public.require_admin_aal2();

    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: User profile % not found.', p_user_id;
    END IF;

    IF v_target_role IN ('ADMIN', 'SUPER_ADMIN') AND NOT public.is_super_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Only SUPER_ADMIN can suspend platform administrators.';
    END IF;

    v_new_status := CASE WHEN p_should_suspend THEN 'SUSPENDED' ELSE 'ACTIVE' END;

    UPDATE public.profiles
    SET
        status = v_new_status,
        updated_at = clock_timestamp()
    WHERE id = p_user_id;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        CASE WHEN p_should_suspend THEN 'SUSPEND_USER' ELSE 'UNSUSPEND_USER' END,
        'USER',
        p_user_id::text,
        jsonb_build_object(
            'target_user_id', p_user_id,
            'target_role', v_target_role,
            'reason', p_reason,
            'new_status', v_new_status
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', p_user_id,
        'status', v_new_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_user_profile_secure(UUID, BOOLEAN, TEXT) TO authenticated, service_role;


-- F. approve_refund_secure
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
  PERFORM public.require_admin_aal2();

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

GRANT EXECUTE ON FUNCTION public.approve_refund_secure(UUID, BIGINT, public.refund_responsibility_enum) TO authenticated, service_role;


-- G. calculate_merchant_settlement
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
  PERFORM public.require_admin_aal2();

  IF p_period_start >= p_period_end THEN
    RAISE EXCEPTION '400 Bad Request: Period start (%) must precede period end (%).', p_period_start, p_period_end;
  END IF;

  v_lock_key := hashtext('settlement_' || p_restaurant_id);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_reference := 'SETTL-' || UPPER(SUBSTRING(p_restaurant_id FROM 1 FOR 8)) || '-' || TO_CHAR(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS') || '-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6);

  INSERT INTO public.merchant_settlements (
    restaurant_id, period_start, period_end, reference, status
  ) VALUES (
    p_restaurant_id, p_period_start, p_period_end, v_reference, 'CALCULATED'
  ) RETURNING id INTO v_settlement_id;

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

  UPDATE public.merchant_settlements
  SET gross_sales_tzs = v_gross_sales,
      refund_adjustments_tzs = v_refund_adjustments,
      net_payable_tzs = v_net_payable
  WHERE id = v_settlement_id;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

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

GRANT EXECUTE ON FUNCTION public.calculate_merchant_settlement(VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;


-- H. approve_merchant_settlement
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
  PERFORM public.require_admin_aal2();

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
      'net_payable_tzs', v_settlement.net_payable_tzs
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', p_settlement_id,
    'status', 'APPROVED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_merchant_settlement(UUID) TO authenticated, service_role;


-- I. request_refund_admin_secure
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
    PERFORM public.require_admin_aal2();

    IF p_admin_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Admin user ID required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_user_id
          AND (role IN ('ADMIN','SUPER_ADMIN') OR roles && ARRAY['ADMIN'::public.user_role_enum, 'SUPER_ADMIN'::public.user_role_enum])
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
        'requested_amount_tzs', p_requested_amount_tzs
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_refund_admin_secure(VARCHAR, BIGINT, VARCHAR, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. API RATE LIMITING TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_key TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT,
    identifier TEXT,
    hits INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    window_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_window ON public.api_rate_limits(rate_key, window_end);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_action_ip ON public.api_rate_limits(action, ip_address);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_created_at ON public.api_rate_limits(created_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Service role full access to api_rate_limits" ON public.api_rate_limits;
    CREATE POLICY "Service role full access to api_rate_limits" ON public.api_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ----------------------------------------------------------------------------
-- 4. SECURITY AUDIT EVENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    actor_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_created ON public.security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_actor ON public.security_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Service role full access to security_events" ON public.security_events;
    CREATE POLICY "Service role full access to security_events" ON public.security_events FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Admins can view security_events" ON public.security_events;
    CREATE POLICY "Admins can view security_events" ON public.security_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ----------------------------------------------------------------------------
-- 5. PAYMENT WEBHOOK REPLAY PROTECTION UNIQUE CONSTRAINT
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event ON public.payment_events(provider, event_id);
