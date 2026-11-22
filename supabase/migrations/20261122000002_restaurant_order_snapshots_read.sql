-- Migration: 20261122000002_restaurant_order_snapshots_read.sql
-- Description: Authoritative read RPC for restaurant order financial snapshots under strict RLS

CREATE OR REPLACE FUNCTION public.get_restaurant_order_snapshots(p_restaurant_id VARCHAR(80))
RETURNS TABLE (
  order_id VARCHAR(80),
  restaurant_id VARCHAR(80),
  payment_id VARCHAR(80),
  gross_food_sales_tzs BIGINT,
  customer_service_fee_tzs BIGINT,
  restaurant_delivery_fee_tzs BIGINT,
  discount_tzs BIGINT,
  platform_commission_tzs BIGINT,
  provider_fee_tzs BIGINT,
  restaurant_net_payable_tzs BIGINT,
  commission_policy_id UUID,
  commission_basis_points_snapshot INTEGER,
  currency VARCHAR(3),
  commission_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify restaurant member or admin
  IF NOT (public.is_restaurant_member(p_restaurant_id) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: not a member of restaurant %', p_restaurant_id;
  END IF;

  RETURN QUERY
  SELECT
    s.order_id,
    s.restaurant_id,
    s.payment_id,
    s.gross_food_sales_tzs,
    s.customer_service_fee_tzs,
    s.restaurant_delivery_fee_tzs,
    s.discount_tzs,
    s.platform_commission_tzs,
    s.provider_fee_tzs,
    s.restaurant_net_payable_tzs,
    s.commission_policy_id,
    s.commission_basis_points_snapshot,
    s.currency,
    s.commission_reason,
    s.created_at
  FROM public.order_financial_snapshots s
  WHERE s.restaurant_id = p_restaurant_id
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_order_snapshots(VARCHAR) TO authenticated;
