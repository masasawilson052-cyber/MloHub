-- ============================================================================
-- MIGRATION: 20261123000001_lockdown_direct_order_reservation_writes.sql
-- Description: Closes direct client table write vulnerabilities on orders,
--              reservations, custom meal requests, and restaurant quotes.
--
-- Security Invariants:
-- 1. Orders and reservations can only be created via authoritative SECURITY DEFINER
--    RPCs (create_order_secure and create_reservation_secure).
-- 2. Direct client UPDATE on orders and reservations is completely disabled (no UPDATE
--    policies exist for authenticated or anon roles).
-- 3. Immutability triggers on orders and reservations execute as NON-SECURITY DEFINER
--    functions, checking CURRENT_USER IN ('postgres', 'supabase_admin', 'service_role').
--    (NOTE: The trigger functions must NOT be SECURITY DEFINER; inside a definer function
--    CURRENT_USER would always evaluate to the owner 'postgres', bypassing the guard).
-- 4. Triggers fire on BEFORE INSERT OR UPDATE, blocking INSERT unconditionally for untrusted
--    callers as defense-in-depth even if policies are re-added.
-- 5. Custom meal requests and quotes: protect_custom_meal_requests_direct_write and
--    protect_restaurant_quotes_direct_write are recreated as NON-definer functions.
--    Direct INSERT is blocked; direct UPDATE on custom meal requests only permits
--    cancellation from PENDING/QUOTES_RECEIVED with all other columns immutable
--    (including locked_quote_snapshot).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DROP INSECURE CLIENT INSERT & UPDATE POLICIES ON ORDERS
-- ----------------------------------------------------------------------------
-- Drop legacy direct INSERT policy allowing customers to fabricate unverified orders
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;

-- Drop direct UPDATE policies allowing customers or staff to mutate order state/prices
DROP POLICY IF EXISTS "Orders update policy" ON public.orders;
DROP POLICY IF EXISTS "Restaurant Members and Admins can update orders" ON public.orders;

-- Verify SELECT read policy remains in effect for authorized parties
DROP POLICY IF EXISTS "Orders read policy" ON public.orders;
CREATE POLICY "Orders read policy" ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_ORDERS')
        OR public.is_admin(auth.uid())
    );

-- NOTE: No UPDATE or INSERT policy is granted on public.orders to authenticated or anon.
-- All order placements go through create_order_secure.
-- All transitions go through transition_restaurant_order or cancel_customer_order_secure.

-- ----------------------------------------------------------------------------
-- 2. DROP INSECURE CLIENT INSERT & UPDATE POLICIES ON RESERVATIONS
-- ----------------------------------------------------------------------------
-- Drop legacy direct INSERT policy allowing customers to fabricate confirmed bookings
DROP POLICY IF EXISTS "Customers can insert own reservations" ON public.reservations;

-- Drop direct UPDATE policies allowing customers or staff to mutate booking state
DROP POLICY IF EXISTS "Reservations update policy" ON public.reservations;

-- Verify SELECT read policy remains in effect for authorized parties
DROP POLICY IF EXISTS "Reservations read policy" ON public.reservations
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
        OR public.is_admin(auth.uid())
    );

-- NOTE: No UPDATE or INSERT policy is granted on public.reservations to authenticated or anon.
-- All reservations go through create_reservation_secure.
-- All attendance updates go through transition_reservation_attendance or cancel_reservation_secure.

-- ----------------------------------------------------------------------------
-- 3. ORDERS IMMUTABILITY & WRITE GUARD TRIGGER
-- ----------------------------------------------------------------------------
-- IMPORTANT: This function must NOT be SECURITY DEFINER.
-- Inside a SECURITY DEFINER function, CURRENT_USER always evaluates to the function owner
-- (e.g. postgres), which would defeat the guard and allow untrusted callers to bypass checks.
CREATE OR REPLACE FUNCTION public.trg_guard_orders_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trusted system roles:
  -- - postgres / supabase_admin: executes internal SECURITY DEFINER functions (create_order_secure, transition_restaurant_order)
  -- - service_role: edge functions executing with service role token
  IF CURRENT_USER IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Untrusted roles (e.g. authenticated customer or restaurant staff connecting directly via PostgREST)
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION '403 Forbidden: Direct insertion into orders is strictly prohibited. Orders must be placed via create_order_secure RPC.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.total_tzs IS DISTINCT FROM OLD.total_tzs OR
        NEW.subtotal_tzs IS DISTINCT FROM OLD.subtotal_tzs OR
        NEW.service_fee_tzs IS DISTINCT FROM OLD.service_fee_tzs OR
        NEW.delivery_fee_tzs IS DISTINCT FROM OLD.delivery_fee_tzs OR
        NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
        NEW.status IS DISTINCT FROM OLD.status OR
        NEW.dining_option IS DISTINCT FROM OLD.dining_option OR
        NEW.branch_id IS DISTINCT FROM OLD.branch_id OR
        NEW.user_id IS DISTINCT FROM OLD.user_id OR
        NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id) THEN
      RAISE EXCEPTION '403 Forbidden: Direct updates to order core fields (pricing, status, fulfillment, ownership) are strictly prohibited.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_immutability ON public.orders;
CREATE TRIGGER trg_guard_orders_immutability
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_orders_immutability();

-- ----------------------------------------------------------------------------
-- 4. RESERVATIONS IMMUTABILITY & WRITE GUARD TRIGGER
-- ----------------------------------------------------------------------------
-- IMPORTANT: This function must NOT be SECURITY DEFINER.
-- Inside a SECURITY DEFINER function, CURRENT_USER always evaluates to the function owner
-- (e.g. postgres), which would defeat the guard and allow untrusted callers to bypass checks.
CREATE OR REPLACE FUNCTION public.trg_guard_reservations_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trusted system roles
  IF CURRENT_USER IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Untrusted roles
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION '403 Forbidden: Direct insertion into reservations is strictly prohibited. Reservations must be booked via create_reservation_secure RPC.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status OR
        NEW.deposit_amount_tzs IS DISTINCT FROM OLD.deposit_amount_tzs OR
        NEW.is_deposit_paid IS DISTINCT FROM OLD.is_deposit_paid OR
        NEW.user_id IS DISTINCT FROM OLD.user_id OR
        NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id) THEN
      RAISE EXCEPTION '403 Forbidden: Direct updates to reservation core fields (status, deposit, ownership) are strictly prohibited.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reservations_immutability ON public.reservations;
CREATE TRIGGER trg_guard_reservations_immutability
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_reservations_immutability();

-- ----------------------------------------------------------------------------
-- 5. CUSTOM MEAL REQUESTS HARDENING (VULNERABILITY CLOSURE)
-- ----------------------------------------------------------------------------
-- Drop direct customer INSERT policy
DROP POLICY IF EXISTS "Customers insert own requests" ON public.custom_meal_requests;

-- IMPORTANT: protect_custom_meal_requests_direct_write must NOT be SECURITY DEFINER.
-- It checks CURRENT_USER so that calls inside create_structured_custom_meal_request
-- (which runs as postgres) succeed, while direct client REST calls are restricted.
CREATE OR REPLACE FUNCTION public.protect_custom_meal_requests_direct_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trusted roles (internal RPCs running as postgres/supabase_admin or service_role)
  IF CURRENT_USER IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Block direct INSERT by untrusted callers (must use create_structured_custom_meal_request RPC)
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION '403 Forbidden: Custom meal requests must be created via create_structured_custom_meal_request RPC.';
  END IF;

  -- On direct UPDATE by untrusted callers:
  -- Customers may ONLY transition status to CANCELLED from PENDING or QUOTES_RECEIVED.
  -- Every other column (especially locked_quote_snapshot and pricing) must remain strictly identical.
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status IN ('PENDING', 'QUOTES_RECEIVED') AND NEW.status = 'CANCELLED') THEN
      IF (NEW.id IS DISTINCT FROM OLD.id OR
          NEW.user_id IS DISTINCT FROM OLD.user_id OR
          NEW.order_number IS DISTINCT FROM OLD.order_number OR
          NEW.title IS DISTINCT FROM OLD.title OR
          NEW.dish_name IS DISTINCT FROM OLD.dish_name OR
          NEW.budget_tzs IS DISTINCT FROM OLD.budget_tzs OR
          NEW.servings_count IS DISTINCT FROM OLD.servings_count OR
          NEW.dining_option IS DISTINCT FROM OLD.dining_option OR
          NEW.delivery_location IS DISTINCT FROM OLD.delivery_location OR
          NEW.preferred_time IS DISTINCT FROM OLD.preferred_time OR
          NEW.accepted_quote_id IS DISTINCT FROM OLD.accepted_quote_id OR
          NEW.locked_quote_snapshot IS DISTINCT FROM OLD.locked_quote_snapshot OR
          NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
        RAISE EXCEPTION '403 Forbidden: Only status cancellation can be modified directly on custom meal requests; other columns are immutable.';
      END IF;
    ELSE
      RAISE EXCEPTION '403 Forbidden: Direct updates to custom meal requests are prohibited. Customers may only transition status to CANCELLED from PENDING or QUOTES_RECEIVED.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_custom_meal_requests_direct_write ON public.custom_meal_requests;
CREATE TRIGGER trg_protect_custom_meal_requests_direct_write
BEFORE INSERT OR UPDATE ON public.custom_meal_requests
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_meal_requests_direct_write();

-- ----------------------------------------------------------------------------
-- 6. RESTAURANT QUOTES HARDENING (TERMS & LOCK PROTECTION)
-- ----------------------------------------------------------------------------
-- IMPORTANT: protect_restaurant_quotes_direct_write must NOT be SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.protect_restaurant_quotes_direct_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trusted roles
  IF CURRENT_USER IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Untrusted roles:
  -- 1. Block direct transition to ACCEPTED via PostgREST (must use accept_custom_meal_quote RPC)
  IF TG_OP = 'UPDATE' AND NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
    RAISE EXCEPTION '403 Forbidden: Quotes can only be accepted through the accept_custom_meal_quote RPC.';
  END IF;

  -- 2. Once quote is selected, accepted, or locked, block direct changes to pricing, time, and terms
  IF TG_OP = 'UPDATE' AND (OLD.status IN ('SELECTED', 'ACCEPTED', 'ORDER_CREATED') OR OLD.is_locked = TRUE) THEN
    IF (NEW.quoted_price_tzs IS DISTINCT FROM OLD.quoted_price_tzs OR
        NEW.subtotal_tzs IS DISTINCT FROM OLD.subtotal_tzs OR
        NEW.delivery_fee_tzs IS DISTINCT FROM OLD.delivery_fee_tzs OR
        NEW.other_authorized_fee_tzs IS DISTINCT FROM OLD.other_authorized_fee_tzs OR
        NEW.total_tzs IS DISTINCT FROM OLD.total_tzs OR
        NEW.estimated_prep_minutes IS DISTINCT FROM OLD.estimated_prep_minutes OR
        NEW.promised_ready_at IS DISTINCT FROM OLD.promised_ready_at OR
        NEW.fulfillment_mode IS DISTINCT FROM OLD.fulfillment_mode OR
        NEW.is_locked IS DISTINCT FROM OLD.is_locked OR
        NEW.request_id IS DISTINCT FROM OLD.request_id OR
        NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id) THEN
      RAISE EXCEPTION '403 Forbidden: Pricing and terms on locked or selected quotes are immutable.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_restaurant_quotes_direct_write ON public.restaurant_quotes;
CREATE TRIGGER trg_protect_restaurant_quotes_direct_write
BEFORE INSERT OR UPDATE ON public.restaurant_quotes
FOR EACH ROW EXECUTE FUNCTION public.protect_restaurant_quotes_direct_write();

COMMIT;

NOTIFY pgrst, 'reload schema';
