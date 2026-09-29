-- ============================================================================
-- MLOHUB RESTAURANT FINAL RUNTIME CLOSURE (PASS 2)
-- Migration: 20260928000700_restaurant_final_runtime_closure.sql
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_payout_processing_secret(
  p_payout_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payout RECORD;
  v_secret TEXT;
  v_key TEXT;
  v_identifier TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server-only payout secret access';
  END IF;

  SELECT
    mp.*,
    mpd.provider,
    mpd.destination_type,
    mpd.account_name,
    mpds.encrypted_account_reference
  INTO
    v_payout
  FROM
    public.merchant_payouts mp
  JOIN
    public.merchant_payout_destinations mpd
      ON mpd.id = mp.destination_id
  JOIN
    public.merchant_payout_destination_secrets mpds
      ON mpds.destination_id = mp.destination_id
  WHERE
    mp.id = p_payout_id
  FOR UPDATE OF mp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found';
  END IF;

  IF v_payout.status NOT IN ('QUEUED', 'PROCESSING') THEN
    RAISE EXCEPTION 'Payout is not processable';
  END IF;

  IF v_payout.encrypted_account_reference NOT LIKE 'pgp:v1:%' THEN
    RAISE EXCEPTION 'Payout secret is not encrypted';
  END IF;

  SELECT
    decrypted_secret
  INTO
    v_key
  FROM
    vault.decrypted_secrets
  WHERE
    name = 'mlohub_payout_encryption_key';

  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'Payout encryption key unavailable';
  END IF;

  v_identifier := extensions.pgp_sym_decrypt(
    decode(
      substr(
        v_payout.encrypted_account_reference,
        length('pgp:v1:') + 1
      ),
      'base64'
    ),
    v_key
  );

  RETURN jsonb_build_object(
    'payout_id', v_payout.id,
    'restaurant_id', v_payout.restaurant_id,
    'settlement_id', v_payout.settlement_id,
    'amount_tzs', v_payout.amount_tzs,
    'destination_type', v_payout.destination_type,
    'provider', v_payout.provider,
    'account_name', v_payout.account_name,
    'account_identifier', v_identifier,
    'idempotency_key', v_payout.idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_payout_processing_secret(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payout_processing_secret(UUID) TO service_role;

COMMIT;
