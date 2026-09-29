-- ==============================================================================
-- MLOHUB MIGRATION: 20260929000100_admin_financial_governance_closure.sql
-- Description: Administrator Final Closure Pass 1 - Financial Governance & Authority
-- 1. verify_restaurant_secure override (fail-closed, requires 3 reviewed documents)
-- 2. reactivate_restaurant_secure override (does not auto-verify without 3 docs, never auto-publishes)
-- 3. get_admin_finance_summary (authoritative platform-wide financial aggregates)
-- 4. set_merchant_settlement_hold_secure (AAL2 + SUPER_ADMIN settlement hold/release)
-- 5. retry_merchant_payout_secure (AAL2 + SUPER_ADMIN safe failed-payout retry)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DISABLE SERVER-SIDE LEGACY MANUAL VERIFICATION BYPASS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_restaurant_secure(
  p_restaurant_id VARCHAR(80),
  p_tin_number TEXT,
  p_business_license_number TEXT,
  p_reason TEXT DEFAULT 'Legacy compatibility check'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verified_count INTEGER := 0;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  SELECT COUNT(DISTINCT document_type)
  INTO v_verified_count
  FROM public.restaurant_verification_documents
  WHERE
    restaurant_id = p_restaurant_id
    AND document_type IN (
      'BUSINESS_LICENSE',
      'TIN_DOCUMENT',
      'FOOD_OPERATION_DOCUMENT'
    )
    AND verification_status = 'VERIFIED'
    AND reviewed_by IS NOT NULL
    AND reviewed_at IS NOT NULL;

  IF v_verified_count <> 3 THEN
    RAISE EXCEPTION 'Restaurant cannot be verified through legacy credentials. Required verification documents must be reviewed first.';
  END IF;

  UPDATE public.restaurants
  SET
    is_verified = TRUE,
    verification_status = 'VERIFIED',
    seller_tier = 'VERIFIED_SELLER',
    updated_at = clock_timestamp()
  WHERE id = p_restaurant_id;

  INSERT INTO public.audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  )
  VALUES (
    auth.uid()::text,
    'VERIFY_RESTAURANT_FROM_REVIEWED_DOCUMENTS',
    'RESTAURANT',
    p_restaurant_id,
    jsonb_build_object(
      'reason', p_reason,
      'required_documents_verified', TRUE
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'restaurant_id', p_restaurant_id,
    'verification_status', 'VERIFIED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_restaurant_secure(VARCHAR, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_restaurant_secure(VARCHAR, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. FIX REACTIVATION SO IT DOES NOT AUTOMATICALLY VERIFY OR PUBLISH
-- ------------------------------------------------------------------------------
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
  v_verified_count INTEGER := 0;
BEGIN
  PERFORM public.require_admin_aal2();

  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
  END IF;

  SELECT COUNT(DISTINCT document_type)
  INTO v_verified_count
  FROM public.restaurant_verification_documents
  WHERE
    restaurant_id = p_restaurant_id
    AND document_type IN (
      'BUSINESS_LICENSE',
      'TIN_DOCUMENT',
      'FOOD_OPERATION_DOCUMENT'
    )
    AND verification_status = 'VERIFIED'
    AND reviewed_by IS NOT NULL
    AND reviewed_at IS NOT NULL;

  UPDATE public.restaurants
  SET
    is_active = TRUE,
    is_verified = (v_verified_count = 3),
    verification_status =
      CASE
        WHEN v_verified_count = 3 THEN 'VERIFIED'
        ELSE 'PENDING_VERIFICATION'
      END,
    seller_tier =
      CASE
        WHEN v_verified_count = 3 THEN 'VERIFIED_SELLER'
        ELSE 'BASIC_SELLER'
      END,
    updated_at = clock_timestamp()
  WHERE id = p_restaurant_id;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

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
    COALESCE(v_actor_name, 'Admin'),
    'REACTIVATE_RESTAURANT',
    'RESTAURANT',
    p_restaurant_id,
    jsonb_build_object(
      'reason', p_reason,
      'documents_verified_count', v_verified_count,
      'is_verified', (v_verified_count = 3)
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'restaurant_id', p_restaurant_id,
    'is_verified', (v_verified_count = 3),
    'verification_status', CASE WHEN v_verified_count = 3 THEN 'VERIFIED' ELSE 'PENDING_VERIFICATION' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_restaurant_secure(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. SERVER-WIDE AUTHORITATIVE FINANCIAL SUMMARY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_finance_summary(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  SELECT jsonb_build_object(
    'attempted_volume_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.payments
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND
        (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'captured_volume_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.payments
      WHERE
        status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
        AND
        (p_from IS NULL OR created_at >= p_from)
        AND
        (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'refunded_volume_tzs',
    COALESCE((
      SELECT SUM(
        COALESCE(approved_amount_tzs, requested_amount_tzs)
      )
      FROM public.refund_requests
      WHERE
        status::text IN ('REFUNDED', 'COMPLETED')
        AND
        (p_from IS NULL OR requested_at >= p_from)
        AND
        (p_to IS NULL OR requested_at <= p_to)
    ), 0),

    'pending_payments',
    (
      SELECT COUNT(*)
      FROM public.payments
      WHERE status::text = 'PENDING'
    ),

    'failed_payments',
    (
      SELECT COUNT(*)
      FROM public.payments
      WHERE status::text IN ('FAILED', 'CANCELLED')
    ),

    'pending_refunds',
    (
      SELECT COUNT(*)
      FROM public.refund_requests
      WHERE status::text = 'REQUESTED'
    ),

    'open_disputes',
    (
      SELECT COUNT(*)
      FROM public.financial_disputes
      WHERE status::text IN ('OPEN', 'EVIDENCE_REQUIRED', 'UNDER_REVIEW')
    ),

    'calculated_settlements',
    (
      SELECT COUNT(*)
      FROM public.merchant_settlements
      WHERE status::text IN ('CALCULATED', 'UNDER_REVIEW')
    ),

    'approved_settlements',
    (
      SELECT COUNT(*)
      FROM public.merchant_settlements
      WHERE status::text = 'APPROVED'
    ),

    'queued_payouts',
    (
      SELECT COUNT(*)
      FROM public.merchant_payouts
      WHERE status::text IN ('QUEUED', 'PROCESSING')
    ),

    'failed_payouts',
    (
      SELECT COUNT(*)
      FROM public.merchant_payouts
      WHERE status::text IN ('FAILED', 'MANUAL_REVIEW', 'REVERSED')
    ),

    'settlement_gross_tzs',
    COALESCE((
      SELECT SUM(gross_sales_tzs)
      FROM public.merchant_settlements
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND
        (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'platform_commission_tzs',
    COALESCE((
      SELECT SUM(platform_fees_tzs)
      FROM public.merchant_settlements
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND
        (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'merchant_net_payable_tzs',
    COALESCE((
      SELECT SUM(net_payable_tzs)
      FROM public.merchant_settlements
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND
        (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'paid_out_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.merchant_payouts
      WHERE status::text IN ('SUCCESS', 'COMPLETED', 'PAID')
    ), 0)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_finance_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. SETTLEMENT HOLD / RELEASE AUTHORITY (AAL2 + SUPER_ADMIN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_merchant_settlement_hold_secure(
  p_settlement_id UUID,
  p_hold BOOLEAN,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement RECORD;
  v_next_status public.merchant_settlement_status_enum;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN required.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A clear reason is required.';
  END IF;

  SELECT *
  INTO v_settlement
  FROM public.merchant_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found.';
  END IF;

  IF p_hold THEN
    IF v_settlement.status NOT IN ('CALCULATED', 'UNDER_REVIEW', 'APPROVED') THEN
      RAISE EXCEPTION 'Settlement cannot be placed on hold from status %', v_settlement.status;
    END IF;
    v_next_status := 'ON_HOLD';
  ELSE
    IF v_settlement.status <> 'ON_HOLD' THEN
      RAISE EXCEPTION 'Only ON_HOLD settlements can be released.';
    END IF;
    -- Force new review/approval after release.
    v_next_status := 'UNDER_REVIEW';
  END IF;

  UPDATE public.merchant_settlements
  SET
    status = v_next_status,
    approved_at =
      CASE
        WHEN p_hold THEN approved_at
        ELSE NULL
      END,
    approved_by =
      CASE
        WHEN p_hold THEN approved_by
        ELSE NULL
      END
  WHERE id = p_settlement_id;

  INSERT INTO public.audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  )
  VALUES (
    auth.uid()::text,
    CASE
      WHEN p_hold THEN 'HOLD_SETTLEMENT'
      ELSE 'RELEASE_SETTLEMENT_HOLD'
    END,
    'SETTLEMENT',
    p_settlement_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'previous_status', v_settlement.status,
      'new_status', v_next_status
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'settlement_id', p_settlement_id,
    'status', v_next_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_merchant_settlement_hold_secure(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_merchant_settlement_hold_secure(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. SAFE FAILED-PAYOUT RETRY (AAL2 + SUPER_ADMIN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_merchant_payout_secure(
  p_payout_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payout RECORD;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN required.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Retry reason is required.';
  END IF;

  SELECT *
  INTO v_payout
  FROM public.merchant_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found.';
  END IF;

  IF v_payout.status::text NOT IN ('FAILED', 'MANUAL_REVIEW') THEN
    RAISE EXCEPTION 'Payout cannot be retried from status %', v_payout.status;
  END IF;

  IF v_payout.provider_reference IS NOT NULL
     AND v_payout.provider_reference NOT IN ('UNCONFIGURED', 'FAILED')
  THEN
    RAISE EXCEPTION 'Payout has a provider reference and must be reconciled before retry.';
  END IF;

  UPDATE public.merchant_payouts
  SET
    status = 'QUEUED',
    processing_at = NULL,
    completed_at = NULL,
    failed_at = NULL,
    failure_code = NULL,
    failure_reason = NULL,
    raw_provider_status = NULL,
    provider_reference =
      CASE
        WHEN provider_reference IN ('UNCONFIGURED', 'FAILED') THEN NULL
        ELSE provider_reference
      END
  WHERE id = p_payout_id;

  INSERT INTO public.audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  )
  VALUES (
    auth.uid()::text,
    'RETRY_MERCHANT_PAYOUT',
    'PAYOUT',
    p_payout_id::text,
    jsonb_build_object(
      'reason', trim(p_reason)
    ),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'payout_id', p_payout_id,
    'status', 'QUEUED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_merchant_payout_secure(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_merchant_payout_secure(UUID, TEXT) TO authenticated, service_role;
