-- Apply only after all preceding migrations on the canonical schema.
-- Authenticated clients cannot call the financial confirmation procedure.
BEGIN;
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  -- 1. Locate payment by merchant reference or provider reference
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

  IF upper(v_payment.provider) <> upper(p_provider) OR p_provider <> 'clickpesa' OR (v_payment.provider_reference IS NOT NULL AND v_payment.provider_reference <> p_gateway_reference) THEN
    RAISE EXCEPTION 'Payment provider/reference mismatch';
  END IF;
  IF p_raw_payload #>> '{data,collectedCurrency}' IS DISTINCT FROM 'TZS' THEN RAISE EXCEPTION 'Payment currency mismatch'; END IF;
  IF v_payment.status = 'REFUNDED' THEN RAISE EXCEPTION 'Refunded payment cannot be captured again'; END IF;
  -- 2. Check Idempotency: Already paid and captured?
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

  -- 3. Verify Authoritative Amount Match
  IF p_collected_amount IS NULL OR p_collected_amount <> v_payment.amount_tzs THEN
    UPDATE public.payments
    SET status = 'FAILED',
        failed_at = clock_timestamp(),
        failure_reason = 'Amount mismatch: expected ' || v_payment.amount_tzs || ' TZS, received ' || p_collected_amount || ' TZS'
    WHERE id = v_payment.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'AMOUNT_MISMATCH',
      'message', 'Collected amount does not match expected authoritative amount'
    );
  END IF;

  -- 4. Mark Payment as SUCCESS
  UPDATE public.payments
  SET status = 'SUCCESS',
      provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
      confirmed_at = clock_timestamp(),
      paid_at = clock_timestamp(),
      webhook_verified = TRUE,
      gateway_response = p_raw_payload
  WHERE id = v_payment.id;

  -- 5. Append to Payment Events
  INSERT INTO public.payment_events (
    payment_id, event_id, event_type, provider, status, amount_tzs,
    merchant_reference, provider_reference, raw_payload, actor_type
  ) VALUES (
    v_payment.id, p_event_id, 'PAYMENT_CONFIRMED', p_provider, 'SUCCESS', p_collected_amount,
    p_merchant_reference, p_gateway_reference, p_raw_payload, 'GATEWAY_WEBHOOK'
  );

  -- 6. Lock and confirm order if linked
  IF v_payment.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET payment_status = 'SUCCESS',
        updated_at = clock_timestamp()
    WHERE id = v_payment.order_id;
  END IF;

  -- 7. Confirm reservation if linked
  IF v_payment.reservation_id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'CONFIRMED',
        is_deposit_paid = true,
        deposit_amount_tzs = v_payment.amount_tzs,
        updated_at = clock_timestamp()
    WHERE id = v_payment.reservation_id;
  END IF;

  -- 8. Post Canonical Financial Snapshot & Balanced Double-Entry Subledger Batch
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
REVOKE ALL ON FUNCTION public.confirm_payment_webhook_rpc(TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_webhook_rpc(TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB) TO service_role;
DROP POLICY IF EXISTS "Applicants can insert applications" ON public.restaurant_applications;
CREATE POLICY "Applicants can insert applications" ON public.restaurant_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = applicant_user_id AND status = 'PENDING');
COMMIT;
