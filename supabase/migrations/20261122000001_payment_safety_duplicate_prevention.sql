-- ============================================================================
-- MLOHUB: PAYMENT SAFETY & AUTHORITATIVE DUPLICATE DEFENSE MIGRATION
-- ============================================================================
-- Prevents double charges, race conditions, and duplicate balance posting:
-- 1. Adds duplicate_of_payment_id tracking column on public.payments.
-- 2. Creates authoritative payment_review_cases table with AAL2-guarded admin access.
-- 3. Recreates confirm_payment_webhook_rpc with:
--    - Multi-provider support ('selcom', 'sandbox', 'clickpesa').
--    - Safe currency validation (COALESCE handling stuck-recovery payloads without currency).
--    - Strict order/reservation row-level locking (FOR UPDATE) BEFORE duplicate check.
--    - Authoritative duplicate detection (prevents double snapshot/ledger posting).
--    - Automatic payment_review_cases generation on AMOUNT_MISMATCH and DUPLICATE_PAYMENT.
--    - Safe capture of late payments (EXPIRED -> SUCCESS).
-- 4. Overrides get_admin_finance_summary & get_admin_operations_dashboard to
--    strictly exclude duplicate payments from revenue totals.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SCHEMA EXTENSION: duplicate_of_payment_id on public.payments
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS duplicate_of_payment_id VARCHAR(80) REFERENCES public.payments(id);

CREATE INDEX IF NOT EXISTS idx_payments_duplicate_of_payment_id
ON public.payments(duplicate_of_payment_id)
WHERE duplicate_of_payment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.payment_review_cases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_review_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(80) REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id VARCHAR(80) REFERENCES public.orders(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  amount_tzs NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REFUNDED', 'RESOLVED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Partial unique index: Only one OPEN case per (payment_id, reason)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_review_cases_open_reason
ON public.payment_review_cases(payment_id, reason)
WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_payment_review_cases_payment_id
ON public.payment_review_cases(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_review_cases_order_id
ON public.payment_review_cases(order_id);

-- Enable Row-Level Security
ALTER TABLE public.payment_review_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view and manage payment review cases" ON public.payment_review_cases;
CREATE POLICY "Admins can view and manage payment review cases"
ON public.payment_review_cases
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. ADMIN RPC: get_payment_review_cases_admin (Guarded by require_admin_aal2)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_review_cases_admin(
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cases JSONB;
  v_total INT;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.payment_review_cases prc
  WHERE (p_status IS NULL OR prc.status = p_status);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', prc.id,
      'payment_id', prc.payment_id,
      'order_id', prc.order_id,
      'reason', prc.reason,
      'amount_tzs', prc.amount_tzs,
      'status', prc.status,
      'created_at', prc.created_at,
      'payment', jsonb_build_object(
        'merchant_reference', p.merchant_reference,
        'provider', p.provider,
        'provider_reference', p.provider_reference,
        'status', p.status
      )
    ) ORDER BY prc.created_at DESC
  ), '[]'::jsonb)
  INTO v_cases
  FROM (
    SELECT * FROM public.payment_review_cases
    WHERE (p_status IS NULL OR status = p_status)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) prc
  LEFT JOIN public.payments p ON p.id = prc.payment_id;

  RETURN jsonb_build_object(
    'cases', v_cases,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_payment_review_cases_admin(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_review_cases_admin(TEXT, INT, INT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RECREATE RPC: public.confirm_payment_webhook_rpc
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_payment_webhook_rpc(
  p_merchant_reference TEXT,
  p_gateway_reference TEXT,
  p_provider TEXT,
  p_collected_amount NUMERIC(12, 2),
  p_event_id TEXT,
  p_raw_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_payment RECORD;
  v_existing_success_payment RECORD;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  -- 1. Locate payment by merchant reference and lock row FOR UPDATE
  SELECT * INTO v_payment FROM public.payments
  WHERE merchant_reference = p_merchant_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PAYMENT_NOT_FOUND',
      'message', 'No transaction found for merchant reference: ' || p_merchant_reference
    );
  END IF;

  -- Provider check: Selcom, Sandbox, and ClickPesa supported; match provider
  IF upper(v_payment.provider) <> upper(p_provider)
     OR lower(p_provider) NOT IN ('clickpesa', 'selcom', 'sandbox')
     OR (v_payment.provider_reference IS NOT NULL AND v_payment.provider_reference <> p_gateway_reference) THEN
    RAISE EXCEPTION 'Payment provider/reference mismatch';
  END IF;

  -- Currency check: COALESCE handles missing currency in stuck recovery calls, rejects non-TZS (e.g. USD)
  IF COALESCE(
    p_raw_payload #>> '{data,collectedCurrency}',
    p_raw_payload ->> 'currency',
    p_raw_payload #>> '{data,currency}',
    'TZS'
  ) <> 'TZS' THEN
    RAISE EXCEPTION 'Payment currency mismatch';
  END IF;

  -- Refunded check
  IF v_payment.status = 'REFUNDED' THEN
    RAISE EXCEPTION 'Refunded payment cannot be captured again';
  END IF;

  -- 2. Race condition guard: Lock linked order or reservation FOR UPDATE BEFORE duplicate check
  IF v_payment.order_id IS NOT NULL THEN
    PERFORM 1 FROM public.orders WHERE id = v_payment.order_id FOR UPDATE;
  END IF;

  IF v_payment.reservation_id IS NOT NULL THEN
    PERFORM 1 FROM public.reservations WHERE id = v_payment.reservation_id FOR UPDATE;
  END IF;

  -- 3. Idempotency Check: Already captured or recorded as duplicate?
  IF v_payment.status = 'SUCCESS' AND EXISTS (
    SELECT 1 FROM public.financial_posting_batches WHERE idempotency_key = 'payment:' || v_payment.id || ':capture'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payment_id', v_payment.id,
      'message', 'Payment already confirmed and processed'
    );
  END IF;

  IF v_payment.status = 'SUCCESS' AND v_payment.duplicate_of_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'duplicate', true,
      'payment_id', v_payment.id,
      'duplicate_of_payment_id', v_payment.duplicate_of_payment_id,
      'message', 'Payment already recorded as duplicate'
    );
  END IF;

  -- 4. Duplicate Check: Has another payment for this order/reservation already succeeded?
  v_existing_success_payment := NULL;
  IF v_payment.order_id IS NOT NULL THEN
    SELECT * INTO v_existing_success_payment
    FROM public.payments
    WHERE order_id = v_payment.order_id
      AND status = 'SUCCESS'
      AND id <> v_payment.id
      AND duplicate_of_payment_id IS NULL
    LIMIT 1;
  ELSIF v_payment.reservation_id IS NOT NULL THEN
    SELECT * INTO v_existing_success_payment
    FROM public.payments
    WHERE reservation_id = v_payment.reservation_id
      AND status = 'SUCCESS'
      AND id <> v_payment.id
      AND duplicate_of_payment_id IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_success_payment IS NOT NULL THEN
    -- Gateway really collected funds, but order was already paid by earlier transaction!
    -- Record duplicate pointer, create review case, do NOT credit order/subledger.
    UPDATE public.payments
    SET status = 'SUCCESS',
        duplicate_of_payment_id = v_existing_success_payment.id,
        provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
        confirmed_at = clock_timestamp(),
        paid_at = clock_timestamp(),
        webhook_verified = TRUE,
        gateway_response = p_raw_payload
    WHERE id = v_payment.id;

    INSERT INTO public.payment_events (
      payment_id, event_id, event_type, provider, status, amount_tzs,
      merchant_reference, provider_reference, raw_payload, actor_type
    ) VALUES (
      v_payment.id, p_event_id, 'PAYMENT_CONFIRMED_DUPLICATE', p_provider, 'SUCCESS', p_collected_amount,
      p_merchant_reference, p_gateway_reference, p_raw_payload, 'GATEWAY_WEBHOOK'
    );

    INSERT INTO public.payment_review_cases (
      payment_id, order_id, reason, amount_tzs, status
    ) VALUES (
      v_payment.id, v_payment.order_id, 'DUPLICATE_PAYMENT_FOR_ORDER', p_collected_amount, 'OPEN'
    )
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'payment_id', v_payment.id,
      'original_payment_id', v_existing_success_payment.id,
      'message', 'DUPLICATE_PAYMENT'
    );
  END IF;

  -- 5. Verify Authoritative Amount Match
  IF p_collected_amount IS NULL OR p_collected_amount <> v_payment.amount_tzs THEN
    UPDATE public.payments
    SET status = 'FAILED',
        failed_at = clock_timestamp(),
        failure_reason = 'Amount mismatch: expected ' || v_payment.amount_tzs || ' TZS, received ' || COALESCE(p_collected_amount::text, 'NULL') || ' TZS'
    WHERE id = v_payment.id;

    INSERT INTO public.payment_review_cases (
      payment_id, order_id, reason, amount_tzs, status
    ) VALUES (
      v_payment.id, v_payment.order_id, 'AMOUNT_MISMATCH', COALESCE(p_collected_amount, v_payment.amount_tzs), 'OPEN'
    )
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', 'Collected amount does not match expected authoritative amount'
    );
  END IF;

  -- 6. Authoritative Capture (accepts EXPIRED as late approval)
  UPDATE public.payments
  SET status = 'SUCCESS',
      provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
      confirmed_at = clock_timestamp(),
      paid_at = clock_timestamp(),
      webhook_verified = TRUE,
      gateway_response = p_raw_payload
  WHERE id = v_payment.id;

  INSERT INTO public.payment_events (
    payment_id, event_id, event_type, provider, status, amount_tzs,
    merchant_reference, provider_reference, raw_payload, actor_type
  ) VALUES (
    v_payment.id, p_event_id, 'PAYMENT_CONFIRMED', p_provider, 'SUCCESS', p_collected_amount,
    p_merchant_reference, p_gateway_reference, p_raw_payload, 'GATEWAY_WEBHOOK'
  );

  -- 7. Lock and confirm order if linked
  IF v_payment.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET payment_status = 'SUCCESS',
        updated_at = clock_timestamp()
    WHERE id = v_payment.order_id;
  END IF;

  -- 8. Confirm reservation if linked
  IF v_payment.reservation_id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'CONFIRMED',
        is_deposit_paid = true,
        deposit_amount_tzs = v_payment.amount_tzs,
        updated_at = clock_timestamp()
    WHERE id = v_payment.reservation_id;
  END IF;

  -- 9. Post Canonical Financial Snapshot & Balanced Double-Entry Subledger Batch
  PERFORM public.finalize_payment_capture_rpc(
    v_payment.id,
    p_merchant_reference,
    p_gateway_reference,
    v_payment.amount_tzs,
    'payment:' || v_payment.id || ':capture'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'reservation_id', v_payment.reservation_id,
    'amount', v_payment.amount_tzs,
    'status', 'SUCCESS'
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.confirm_payment_webhook_rpc(TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_webhook_rpc(TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. OVERRIDE: public.get_admin_finance_summary (Excludes Duplicate Payments)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_finance_summary(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to   TIMESTAMPTZ DEFAULT NULL
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
        duplicate_of_payment_id IS NULL
        AND (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'captured_volume_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.payments
      WHERE
        status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
        AND duplicate_of_payment_id IS NULL
        AND (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'refunded_volume_tzs',
    COALESCE((
      SELECT SUM(
        COALESCE(approved_amount_tzs, requested_amount_tzs)
      )
      FROM public.refund_requests
      WHERE
        status::text IN ('REFUNDED', 'COMPLETED')
        AND (p_from IS NULL OR requested_at >= p_from)
        AND (p_to IS NULL OR requested_at <= p_to)
    ), 0),

    'pending_payments',
    (
      SELECT COUNT(*)
      FROM public.payments
      WHERE status::text = 'PENDING'
        AND duplicate_of_payment_id IS NULL
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
        AND (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'platform_commission_tzs',
    COALESCE((
      SELECT SUM(platform_fees_tzs)
      FROM public.merchant_settlements
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
    ), 0),

    'merchant_net_payable_tzs',
    COALESCE((
      SELECT SUM(net_payable_tzs)
      FROM public.merchant_settlements
      WHERE
        (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
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

-- ----------------------------------------------------------------------------
-- 6. OVERRIDE: public.get_admin_operations_dashboard (Excludes Duplicate Payments)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_operations_dashboard()
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
    'total_restaurants',
    (SELECT COUNT(*) FROM public.restaurants),

    'active_restaurants',
    (SELECT COUNT(*) FROM public.restaurants WHERE verification_status = 'VERIFIED' AND is_active = TRUE),

    'pending_verification_restaurants',
    (SELECT COUNT(*) FROM public.restaurants WHERE verification_status = 'UNDER_REVIEW'),

    'suspended_restaurants',
    (SELECT COUNT(*) FROM public.restaurants WHERE is_suspended = TRUE OR verification_status::text = 'SUSPENDED'),

    'pending_applications',
    (SELECT COUNT(*) FROM public.restaurant_applications WHERE status = 'PENDING'),

    'open_reports',
    (SELECT COUNT(*) FROM public.data_reports WHERE status = 'OPEN'),

    'total_orders',
    (SELECT COUNT(*) FROM public.orders),

    'completed_orders',
    (SELECT COUNT(*) FROM public.orders WHERE status = 'COMPLETED'),

    'captured_volume_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.payments
      WHERE status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
        AND duplicate_of_payment_id IS NULL
    ), 0),

    'platform_revenue_tzs',
    COALESCE((
      SELECT SUM(platform_commission_tzs)
      FROM public.payments
      WHERE status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
        AND duplicate_of_payment_id IS NULL
    ), 0),

    'pending_refunds',
    (SELECT COUNT(*) FROM public.refund_requests WHERE status::text = 'REQUESTED'),

    'pending_settlements',
    (SELECT COUNT(*) FROM public.merchant_settlements WHERE status::text IN ('CALCULATED', 'UNDER_REVIEW')),

    'stale_payments',
    (SELECT COUNT(*) FROM public.payments WHERE status::text = 'PENDING' AND duplicate_of_payment_id IS NULL AND created_at < clock_timestamp() - interval '15 minutes'),

    'failed_outbox',
    (SELECT COUNT(*) FROM public.notification_event_outbox WHERE processing_status IN ('FAILED', 'DEAD_LETTER'))
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_operations_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operations_dashboard() TO authenticated, service_role;

COMMIT;
