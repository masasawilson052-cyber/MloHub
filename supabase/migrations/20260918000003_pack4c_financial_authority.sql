-- ==============================================================================
-- MLOHUB PACK 4C: CANONICAL FINANCIAL AUTHORITY LAYER
-- Financial Subledger, Posting Batches, Refunds, Disputes, Settlements,
-- Payouts, and Provider Reconciliation
-- ==============================================================================

-- 1. Enums and Types
DO $$ BEGIN
  CREATE TYPE public.financial_entry_type_enum AS ENUM (
    'PAYMENT_COLLECTION',
    'PLATFORM_COMMISSION',
    'RESTAURANT_PAYABLE_CREDIT',
    'RESERVATION_DEPOSIT_HELD',
    'RESERVATION_DEPOSIT_REVENUE',
    'REFUND_REVERSAL',
    'DISPUTE_HOLD',
    'DISPUTE_RELEASE',
    'SETTLEMENT_PAYOUT',
    'FINANCIAL_ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_account_type_enum AS ENUM (
    'CUSTOMER_PAYMENT_CLEARING',
    'RESTAURANT_PAYABLE',
    'PLATFORM_REVENUE',
    'RESERVATION_DEPOSIT_HOLDING',
    'REFUND_PAYABLE',
    'PROVIDER_RECEIVABLE',
    'PAYOUT_CLEARING',
    'DISPUTE_RESERVE',
    'ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_direction_enum AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_status_enum AS ENUM (
    'REQUESTED',
    'UNDER_REVIEW',
    'APPROVED',
    'PROVIDER_PROCESSING',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'REJECTED',
    'FAILED',
    'CANCELLED',
    'MANUAL_ACTION_REQUIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_responsibility_enum AS ENUM (
    'PLATFORM',
    'RESTAURANT',
    'CUSTOMER',
    'PROVIDER',
    'SHARED',
    'UNDETERMINED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_dispute_type_enum AS ENUM (
    'CUSTOMER_REFUND_DISPUTE',
    'MERCHANT_ADJUSTMENT_DISPUTE',
    'PAYOUT_DISPUTE',
    'PAYMENT_MISMATCH',
    'DUPLICATE_CHARGE',
    'RESERVATION_DEPOSIT_DISPUTE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_dispute_status_enum AS ENUM (
    'OPEN',
    'EVIDENCE_REQUIRED',
    'UNDER_REVIEW',
    'RESOLVED_CUSTOMER',
    'RESOLVED_RESTAURANT',
    'RESOLVED_PLATFORM',
    'PARTIAL_RESOLUTION',
    'REJECTED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.merchant_settlement_status_enum AS ENUM (
    'DRAFT',
    'CALCULATED',
    'UNDER_REVIEW',
    'APPROVED',
    'PAYOUT_PENDING',
    'PAID',
    'FAILED',
    'ON_HOLD',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.merchant_payout_status_enum AS ENUM (
    'QUEUED',
    'PENDING',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'REVERSED',
    'ON_HOLD',
    'MANUAL_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payout_destination_type_enum AS ENUM ('MOBILE_MONEY', 'BANK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.destination_verification_status_enum AS ENUM (
    'UNVERIFIED',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reconciliation_result_enum AS ENUM (
    'MATCHED',
    'STATUS_MISMATCH',
    'AMOUNT_MISMATCH',
    'MISSING_INTERNAL',
    'MISSING_PROVIDER',
    'DUPLICATE',
    'REVIEW_REQUIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Modify public.payments table for refund tracking
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_amount_tzs BIGINT NOT NULL DEFAULT 0;

-- 3. Create Posting Batches table
CREATE TABLE IF NOT EXISTS public.financial_posting_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type VARCHAR(50) NOT NULL,
  total_amount_tzs BIGINT NOT NULL CHECK (total_amount_tzs >= 0),
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  idempotency_key VARCHAR(150) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_posting_batches_type ON public.financial_posting_batches(batch_type);
CREATE INDEX IF NOT EXISTS idx_posting_batches_idem ON public.financial_posting_batches(idempotency_key);

-- 4. Create Canonical Append-Only Financial Ledger Entries table
CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.financial_posting_batches(id),
  entry_type public.financial_entry_type_enum NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  restaurant_id VARCHAR(80) NULL REFERENCES public.restaurants(id),
  customer_user_id UUID NULL REFERENCES public.profiles(id),
  payment_id VARCHAR(80) NULL REFERENCES public.payments(id),
  refund_id UUID NULL,
  dispute_id UUID NULL,
  settlement_id UUID NULL,
  payout_id UUID NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  amount_tzs BIGINT NOT NULL CHECK (amount_tzs >= 0),
  direction public.financial_direction_enum NOT NULL,
  account_type public.financial_account_type_enum NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(150),
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by_type VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  idempotency_key VARCHAR(150) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fin_ledger_batch ON public.financial_ledger_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_fin_ledger_restaurant ON public.financial_ledger_entries(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_fin_ledger_account ON public.financial_ledger_entries(account_type);
CREATE INDEX IF NOT EXISTS idx_fin_ledger_entry_type ON public.financial_ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_fin_ledger_payment ON public.financial_ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_fin_ledger_occurred ON public.financial_ledger_entries(occurred_at);

-- 5. Immutability trigger on financial_ledger_entries
CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger_entries is an immutable append-only ledger. UPDATE and DELETE are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_financial_ledger_mutation ON public.financial_ledger_entries;
CREATE TRIGGER trg_prevent_financial_ledger_mutation
  BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

-- 6. Merchant Fee Policies table
CREATE TABLE IF NOT EXISTS public.merchant_fee_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NULL REFERENCES public.restaurants(id),
  commission_basis_points INTEGER NOT NULL CHECK (commission_basis_points >= 0 AND commission_basis_points <= 10000),
  commission_fixed_tzs BIGINT NOT NULL DEFAULT 0 CHECK (commission_fixed_tzs >= 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  effective_until TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_merchant_fee_policy_restaurant ON public.merchant_fee_policies(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_fee_policy_dates ON public.merchant_fee_policies(effective_from, effective_until);

-- Function to validate non-overlapping policies
CREATE OR REPLACE FUNCTION public.validate_fee_policy_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_overlap_count INTEGER;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    -- Check global default policies
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.merchant_fee_policies
    WHERE restaurant_id IS NULL
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (effective_until IS NULL AND (NEW.effective_until IS NULL OR NEW.effective_until > effective_from)) OR
        (NEW.effective_until IS NULL AND effective_until > NEW.effective_from) OR
        (effective_until IS NOT NULL AND NEW.effective_until IS NOT NULL AND
         tstzrange(effective_from, effective_until, '[)') && tstzrange(NEW.effective_from, NEW.effective_until, '[)'))
      );
  ELSE
    -- Check restaurant specific policies
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.merchant_fee_policies
    WHERE restaurant_id = NEW.restaurant_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (effective_until IS NULL AND (NEW.effective_until IS NULL OR NEW.effective_until > effective_from)) OR
        (NEW.effective_until IS NULL AND effective_until > NEW.effective_from) OR
        (effective_until IS NOT NULL AND NEW.effective_until IS NOT NULL AND
         tstzrange(effective_from, effective_until, '[)') && tstzrange(NEW.effective_from, NEW.effective_until, '[)'))
      );
  END IF;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'Overlapping fee policy exists for scope (restaurant_id: %). Simultaneous active periods prohibited.', NEW.restaurant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fee_policy_overlap ON public.merchant_fee_policies;
CREATE TRIGGER trg_validate_fee_policy_overlap
  BEFORE INSERT OR UPDATE ON public.merchant_fee_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_fee_policy_overlap();

-- Seed Default Platform Commission Policy (10% = 1000 basis points)
INSERT INTO public.merchant_fee_policies (
  id, restaurant_id, commission_basis_points, commission_fixed_tzs, effective_from
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid, NULL, 1000, 0, '2026-01-01 00:00:00+00'::timestamptz
) ON CONFLICT DO NOTHING;

-- 7. Order Financial Snapshots table
CREATE TABLE IF NOT EXISTS public.order_financial_snapshots (
  order_id VARCHAR(80) PRIMARY KEY REFERENCES public.orders(id),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id),
  payment_id VARCHAR(80) REFERENCES public.payments(id),
  gross_food_sales_tzs BIGINT NOT NULL CHECK (gross_food_sales_tzs >= 0),
  customer_service_fee_tzs BIGINT NOT NULL DEFAULT 0 CHECK (customer_service_fee_tzs >= 0),
  restaurant_delivery_fee_tzs BIGINT NOT NULL DEFAULT 0 CHECK (restaurant_delivery_fee_tzs >= 0),
  discount_tzs BIGINT NOT NULL DEFAULT 0 CHECK (discount_tzs >= 0),
  platform_commission_tzs BIGINT NOT NULL CHECK (platform_commission_tzs >= 0),
  provider_fee_tzs BIGINT NULL CHECK (provider_fee_tzs >= 0),
  restaurant_net_payable_tzs BIGINT NOT NULL CHECK (restaurant_net_payable_tzs >= 0),
  commission_policy_id UUID REFERENCES public.merchant_fee_policies(id),
  commission_basis_points_snapshot INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_order_fin_snap_restaurant ON public.order_financial_snapshots(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_fin_snap_payment ON public.order_financial_snapshots(payment_id);

-- Immutability trigger on snapshots
CREATE OR REPLACE FUNCTION public.prevent_order_financial_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'order_financial_snapshots is an immutable record. UPDATE and DELETE are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_order_financial_snapshot_mutation ON public.order_financial_snapshots;
CREATE TRIGGER trg_prevent_order_financial_snapshot_mutation
  BEFORE UPDATE OR DELETE ON public.order_financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_order_financial_snapshot_mutation();

-- 8. Refund Requests table
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(80) NOT NULL REFERENCES public.payments(id),
  order_id VARCHAR(80) NULL REFERENCES public.orders(id),
  reservation_id VARCHAR(80) NULL REFERENCES public.reservations(id),
  custom_meal_request_id VARCHAR(80) NULL,
  customer_user_id UUID NOT NULL REFERENCES public.profiles(id),
  restaurant_id VARCHAR(80) NULL REFERENCES public.restaurants(id),
  requested_amount_tzs BIGINT NOT NULL CHECK (requested_amount_tzs > 0),
  approved_amount_tzs BIGINT NULL CHECK (approved_amount_tzs >= 0),
  reason_code VARCHAR(50) NOT NULL,
  reason_detail TEXT,
  responsibility public.refund_responsibility_enum NOT NULL DEFAULT 'UNDETERMINED',
  status public.refund_status_enum NOT NULL DEFAULT 'REQUESTED',
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reviewed_by UUID NULL REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NULL,
  provider_refund_reference TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  idempotency_key VARCHAR(150) UNIQUE NOT NULL,
  affected_items JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_refund_req_payment ON public.refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_req_customer ON public.refund_requests(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_refund_req_restaurant ON public.refund_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_refund_req_status ON public.refund_requests(status);

-- 9. Financial Disputes table
CREATE TABLE IF NOT EXISTS public.financial_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_type public.financial_dispute_type_enum NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(80) NOT NULL,
  customer_user_id UUID NULL REFERENCES public.profiles(id),
  restaurant_id VARCHAR(80) NULL REFERENCES public.restaurants(id),
  refund_request_id UUID NULL REFERENCES public.refund_requests(id),
  payment_id VARCHAR(80) NULL REFERENCES public.payments(id),
  settlement_id UUID NULL,
  disputed_amount_tzs BIGINT NOT NULL CHECK (disputed_amount_tzs > 0),
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  reason_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status public.financial_dispute_status_enum NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  evidence_deadline_at TIMESTAMPTZ NULL,
  assigned_admin UUID NULL REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ NULL,
  resolution TEXT NULL,
  financial_adjustment_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_fin_disputes_restaurant ON public.financial_disputes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_fin_disputes_customer ON public.financial_disputes(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_disputes_status ON public.financial_disputes(status);

-- 10. Financial Dispute Evidence table
CREATE TABLE IF NOT EXISTS public.financial_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.financial_disputes(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON public.financial_dispute_evidence(dispute_id);

-- 11. Merchant Settlements table
CREATE TABLE IF NOT EXISTS public.merchant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  gross_sales_tzs BIGINT NOT NULL DEFAULT 0,
  platform_fees_tzs BIGINT NOT NULL DEFAULT 0,
  refund_adjustments_tzs BIGINT NOT NULL DEFAULT 0,
  dispute_adjustments_tzs BIGINT NOT NULL DEFAULT 0,
  other_adjustments_tzs BIGINT NOT NULL DEFAULT 0,
  net_payable_tzs BIGINT NOT NULL DEFAULT 0,
  status public.merchant_settlement_status_enum NOT NULL DEFAULT 'CALCULATED',
  reference VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES auth.users(id),
  payout_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_settlements_restaurant ON public.merchant_settlements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON public.merchant_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON public.merchant_settlements(period_start, period_end);

-- Trigger to prevent mutation of PAID settlement
CREATE OR REPLACE FUNCTION public.prevent_paid_settlement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PAID' THEN
      RAISE EXCEPTION 'Settlement % is already PAID and cannot be modified or deleted.', OLD.id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'PAID' AND NEW.status <> 'ON_HOLD' THEN
      RAISE EXCEPTION 'Settlement % is already PAID and cannot be modified or deleted.', OLD.id;
    END IF;
    -- Invariant: Even if transitioning to ON_HOLD, financial amounts and references are permanently immutable!
    IF OLD.status = 'PAID' AND (
      OLD.net_payable_tzs <> NEW.net_payable_tzs OR
      OLD.gross_sales_tzs <> NEW.gross_sales_tzs OR
      OLD.reference <> NEW.reference
    ) THEN
      RAISE EXCEPTION 'Settlement % amounts and references are permanently immutable.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_settlement_mutation ON public.merchant_settlements;
CREATE TRIGGER trg_prevent_paid_settlement_mutation
  BEFORE UPDATE OR DELETE ON public.merchant_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_paid_settlement_mutation();

-- 12. Merchant Settlement Items table (Unique ledger entry inclusion)
CREATE TABLE IF NOT EXISTS public.merchant_settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.merchant_settlements(id) ON DELETE CASCADE,
  ledger_entry_id UUID NOT NULL UNIQUE REFERENCES public.financial_ledger_entries(id),
  order_id VARCHAR(80) NULL,
  payment_id VARCHAR(80) NULL,
  entry_type public.financial_entry_type_enum NOT NULL,
  gross_tzs BIGINT NOT NULL DEFAULT 0,
  fee_tzs BIGINT NOT NULL DEFAULT 0,
  adjustment_tzs BIGINT NOT NULL DEFAULT 0,
  net_tzs BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON public.merchant_settlement_items(settlement_id);

-- 13. Merchant Payout Destinations (Public Masked Info)
CREATE TABLE IF NOT EXISTS public.merchant_payout_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id),
  destination_type public.payout_destination_type_enum NOT NULL,
  provider VARCHAR(50) NOT NULL,
  masked_account_identifier VARCHAR(50) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  verification_status public.destination_verification_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  verified_at TIMESTAMPTZ NULL,
  verified_by UUID NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payout_dest_restaurant ON public.merchant_payout_destinations(restaurant_id);

-- 14. Merchant Payout Destination Secrets (Private Server Only)
CREATE TABLE IF NOT EXISTS public.merchant_payout_destination_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL UNIQUE REFERENCES public.merchant_payout_destinations(id) ON DELETE CASCADE,
  encrypted_account_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  rotated_at TIMESTAMPTZ NULL
);

-- 15. Merchant Payouts table
CREATE TABLE IF NOT EXISTS public.merchant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.merchant_settlements(id),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id),
  destination_id UUID NOT NULL REFERENCES public.merchant_payout_destinations(id),
  destination_type_snapshot public.payout_destination_type_enum NOT NULL,
  provider_snapshot VARCHAR(50) NOT NULL,
  masked_identifier_snapshot VARCHAR(50) NOT NULL,
  account_name_snapshot VARCHAR(150) NOT NULL,
  amount_tzs BIGINT NOT NULL CHECK (amount_tzs > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  provider VARCHAR(50) NOT NULL DEFAULT 'CLICKPESA',
  provider_reference VARCHAR(150) NULL,
  provider_payout_id VARCHAR(150) NULL,
  status public.merchant_payout_status_enum NOT NULL DEFAULT 'QUEUED',
  idempotency_key VARCHAR(150) UNIQUE NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  processing_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  failure_code VARCHAR(50) NULL,
  failure_reason TEXT NULL,
  raw_provider_status TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_payouts_restaurant ON public.merchant_payouts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_settlement ON public.merchant_payouts(settlement_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.merchant_payouts(status);

-- 16. Financial Adjustments table
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id),
  order_id VARCHAR(80) NULL,
  payment_id VARCHAR(80) NULL,
  dispute_id UUID NULL REFERENCES public.financial_disputes(id),
  amount_tzs BIGINT NOT NULL CHECK (amount_tzs > 0),
  direction public.financial_direction_enum NOT NULL,
  reason VARCHAR(100) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID NULL REFERENCES auth.users(id),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  batch_id UUID NULL REFERENCES public.financial_posting_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_fin_adjustments_restaurant ON public.financial_adjustments(restaurant_id);

-- 17. Reconciliation Runs & Items
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  summary JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  payment_id VARCHAR(80) NULL,
  payout_id UUID NULL,
  provider_reference VARCHAR(150) NOT NULL,
  internal_amount_tzs BIGINT NULL,
  provider_amount_tzs BIGINT NULL,
  internal_status VARCHAR(50) NULL,
  raw_provider_status VARCHAR(50) NULL,
  result public.reconciliation_result_enum NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_recon_items_run ON public.reconciliation_items(run_id);
CREATE INDEX IF NOT EXISTS idx_recon_items_result ON public.reconciliation_items(result);

-- ==============================================================================
-- 18. POSTING BATCH VERIFICATION HELPER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.close_and_verify_posting_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sum_debits BIGINT := 0;
  v_sum_credits BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(amount_tzs), 0) INTO v_sum_debits
  FROM public.financial_ledger_entries
  WHERE batch_id = p_batch_id AND direction = 'DEBIT';

  SELECT COALESCE(SUM(amount_tzs), 0) INTO v_sum_credits
  FROM public.financial_ledger_entries
  WHERE batch_id = p_batch_id AND direction = 'CREDIT';

  IF v_sum_debits <> v_sum_credits THEN
    RAISE EXCEPTION 'Posting batch % is not balanced! Debits: % TZS, Credits: % TZS',
      p_batch_id, v_sum_debits, v_sum_credits;
  END IF;

  UPDATE public.financial_posting_batches
  SET is_balanced = TRUE,
      total_amount_tzs = v_sum_debits
  WHERE id = p_batch_id;
END;
$$;

-- ==============================================================================
-- 19. SERVER-AUTHORITATIVE RPC: POST PAYMENT CAPTURE FINANCIAL EVENT
-- ==============================================================================
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
  v_quote RECORD;
  v_policy RECORD;
  v_batch_id UUID;
  v_food_tzs BIGINT := 0;
  v_service_fee_tzs BIGINT := 0;
  v_delivery_fee_tzs BIGINT := 0;
  v_commission_tzs BIGINT := 0;
  v_net_payable_tzs BIGINT := 0;
  v_commission_bps INTEGER := 1000; -- 10% default
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

    -- Resolve Fee Policy (Restaurant-specific wins, then global default)
    SELECT * INTO v_policy
    FROM public.merchant_fee_policies
    WHERE (restaurant_id = v_order.restaurant_id OR restaurant_id IS NULL)
      AND effective_from <= clock_timestamp()
      AND (effective_until IS NULL OR effective_until > clock_timestamp())
    ORDER BY (restaurant_id IS NOT NULL) DESC, effective_from DESC
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

-- ==============================================================================
-- 20. SERVER-AUTHORITATIVE RPC: RELEASE RESERVATION DEPOSIT FINANCIALLY
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.release_reservation_deposit_financially(
  p_reservation_id VARCHAR(80),
  p_outcome_type VARCHAR(50) -- 'COMPLETED' | 'NO_SHOW_FORFEIT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res RECORD;
  v_payment RECORD;
  v_batch_id UUID;
  v_idempotency_key TEXT;
  v_deposit_amount BIGINT;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id;
  END IF;

  IF NOT v_res.is_deposit_paid OR v_res.payment_id IS NULL THEN
    RAISE EXCEPTION 'Reservation % has no completed deposit payment', p_reservation_id;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = v_res.payment_id;
  v_deposit_amount := v_payment.amount_tzs;
  v_idempotency_key := 'reservation:' || v_res.id || ':deposit-release';

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM public.financial_posting_batches WHERE idempotency_key = v_idempotency_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Deposit already released (idempotent)');
  END IF;

  -- Create Balanced Posting Batch
  INSERT INTO public.financial_posting_batches (
    batch_type, total_amount_tzs, is_balanced, idempotency_key
  ) VALUES (
    'RESERVATION_DEPOSIT_RELEASE', v_deposit_amount, FALSE, v_idempotency_key
  ) RETURNING id INTO v_batch_id;

  -- DEBIT  RESERVATION_DEPOSIT_HOLDING : deposit
  -- CREDIT RESTAURANT_PAYABLE          : deposit
  INSERT INTO public.financial_ledger_entries (
    batch_id, entry_type, entity_type, entity_id, restaurant_id, customer_user_id,
    payment_id, amount_tzs, direction, account_type, reference_type, reference_id,
    description, idempotency_key
  ) VALUES (
    v_batch_id, 'RESERVATION_DEPOSIT_REVENUE', 'RESERVATION', v_res.id, v_res.restaurant_id, v_res.user_id,
    v_payment.id, v_deposit_amount, 'DEBIT', 'RESERVATION_DEPOSIT_HOLDING', 'RESERVATION_OUTCOME', p_outcome_type,
    'Release reservation deposit holding to restaurant', v_idempotency_key || '_debit_holding'
  ), (
    v_batch_id, 'RESERVATION_DEPOSIT_REVENUE', 'RESERVATION', v_res.id, v_res.restaurant_id, v_res.user_id,
    v_payment.id, v_deposit_amount, 'CREDIT', 'RESTAURANT_PAYABLE', 'RESERVATION_OUTCOME', p_outcome_type,
    'Merchant payable credit for earned reservation deposit', v_idempotency_key || '_credit_payable'
  );

  PERFORM public.close_and_verify_posting_batch(v_batch_id);

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_res.id,
    'released_amount_tzs', v_deposit_amount,
    'batch_id', v_batch_id
  );
END;
$$;

-- ==============================================================================
-- 21. SERVER-AUTHORITATIVE RPC: CALCULATE MERCHANT SETTLEMENT
-- ==============================================================================
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
  v_lock_key BIGINT;
  v_settlement_id UUID;
  v_reference VARCHAR(100);
  v_entry RECORD;
  v_gross_sales BIGINT := 0;
  v_refund_adjustments BIGINT := 0;
  v_other_adjustments BIGINT := 0;
  v_net_payable BIGINT := 0;
  v_included_count INTEGER := 0;
BEGIN
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

  -- 4. Iterate over eligible RESTAURANT_PAYABLE ledger entries:
  -- Must be:
  -- - For this restaurant
  -- - RESTAURANT_PAYABLE account
  -- - Occurred in [period_start, period_end)
  -- - NOT already present in merchant_settlement_items
  -- - NOT locked by an open dispute
  -- - For orders: order MUST be COMPLETED
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
    -- Net signed amount: CREDIT = positive, DEBIT = negative
    IF v_entry.direction = 'CREDIT' THEN
      v_gross_sales := v_gross_sales + v_entry.amount_tzs;
      v_net_payable := v_net_payable + v_entry.amount_tzs;
    ELSE
      v_refund_adjustments := v_refund_adjustments + v_entry.amount_tzs;
      v_net_payable := v_net_payable - v_entry.amount_tzs;
    END IF;

    -- Insert item linking ledger entry uniquely
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

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'reference', v_reference,
    'included_items_count', v_included_count,
    'net_payable_tzs', v_net_payable
  );
END;
$$;

-- ==============================================================================
-- 22. SERVER-AUTHORITATIVE RPC: APPROVE SETTLEMENT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.approve_merchant_settlement(p_settlement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement RECORD;
BEGIN
  SELECT * INTO v_settlement
  FROM public.merchant_settlements
  WHERE id = p_settlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement % not found', p_settlement_id;
  END IF;

  IF v_settlement.status <> 'CALCULATED' AND v_settlement.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'Settlement % cannot be approved from status %', p_settlement_id, v_settlement.status;
  END IF;

  UPDATE public.merchant_settlements
  SET status = 'APPROVED',
      approved_at = clock_timestamp(),
      approved_by = auth.uid()
  WHERE id = p_settlement_id;

  RETURN jsonb_build_object('success', true, 'settlement_id', p_settlement_id, 'status', 'APPROVED');
END;
$$;

-- ==============================================================================
-- 23. SERVER-AUTHORITATIVE RPC: EXECUTE MERCHANT PAYOUT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.execute_merchant_payout_rpc(
  p_settlement_id UUID,
  p_destination_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement RECORD;
  v_dest RECORD;
  v_payout_id UUID;
  v_existing RECORD;
BEGIN
  -- 1. Check idempotency
  SELECT * INTO v_existing FROM public.merchant_payouts WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'payout_id', v_existing.id,
      'status', v_existing.status,
      'message', 'Payout already initiated (idempotent)'
    );
  END IF;

  -- 2. Verify settlement state
  SELECT * INTO v_settlement FROM public.merchant_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement % not found', p_settlement_id;
  END IF;

  IF v_settlement.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Settlement % is not in APPROVED status (current: %)', p_settlement_id, v_settlement.status;
  END IF;

  IF v_settlement.net_payable_tzs <= 0 THEN
    RAISE EXCEPTION 'Settlement net payable % is not positive. Cannot disburse payout.', v_settlement.net_payable_tzs;
  END IF;

  -- 3. Verify destination
  SELECT * INTO v_dest FROM public.merchant_payout_destinations WHERE id = p_destination_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout destination % not found', p_destination_id;
  END IF;

  IF v_dest.restaurant_id <> v_settlement.restaurant_id THEN
    RAISE EXCEPTION 'Payout destination does not belong to the settlement restaurant.';
  END IF;

  IF v_dest.verification_status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'Payout destination % is not VERIFIED (current: %)', p_destination_id, v_dest.verification_status;
  END IF;

  -- 4. Create Payout Record with destination display snapshot
  INSERT INTO public.merchant_payouts (
    settlement_id, restaurant_id, destination_id,
    destination_type_snapshot, provider_snapshot, masked_identifier_snapshot,
    account_name_snapshot, amount_tzs, currency, provider,
    status, idempotency_key
  ) VALUES (
    v_settlement.id, v_settlement.restaurant_id, v_dest.id,
    v_dest.destination_type, v_dest.provider, v_dest.masked_account_identifier,
    v_dest.account_name, v_settlement.net_payable_tzs, 'TZS', v_dest.provider,
    'QUEUED', p_idempotency_key
  ) RETURNING id INTO v_payout_id;

  -- Transition settlement to PAYOUT_PENDING
  UPDATE public.merchant_settlements
  SET status = 'PAYOUT_PENDING', payout_id = v_payout_id
  WHERE id = v_settlement.id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'status', 'QUEUED',
    'amount_tzs', v_settlement.net_payable_tzs
  );
END;
$$;

-- ==============================================================================
-- 24. SERVER-AUTHORITATIVE RPC: FINALIZE MERCHANT PAYOUT (Service Role Only)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.finalize_merchant_payout_rpc(
  p_payout_id UUID,
  p_provider_reference TEXT,
  p_status public.merchant_payout_status_enum,
  p_raw_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payout RECORD;
  v_batch_id UUID;
  v_idem TEXT;
BEGIN
  SELECT * INTO v_payout FROM public.merchant_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout % not found', p_payout_id;
  END IF;

  IF v_payout.status = 'SUCCESS' AND p_status = 'SUCCESS' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payout already SUCCESS (idempotent)');
  END IF;

  v_idem := 'payout:' || v_payout.id || ':' || p_status;

  IF p_status = 'SUCCESS' THEN
    -- Post Balanced Payout Batch:
    -- DEBIT  RESTAURANT_PAYABLE   : amount
    -- CREDIT PROVIDER_RECEIVABLE  : amount
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'MERCHANT_PAYOUT', v_payout.amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.financial_ledger_entries (
      batch_id, entry_type, entity_type, entity_id, restaurant_id,
      payout_id, settlement_id, amount_tzs, direction, account_type,
      reference_type, reference_id, description, idempotency_key
    ) VALUES (
      v_batch_id, 'SETTLEMENT_PAYOUT', 'SETTLEMENT', v_payout.settlement_id::text, v_payout.restaurant_id,
      v_payout.id, v_payout.settlement_id, v_payout.amount_tzs, 'DEBIT', 'RESTAURANT_PAYABLE',
      'PROVIDER_PAYOUT', p_provider_reference, 'External merchant payout disbursed successfully', v_idem || '_debit_rest'
    ), (
      v_batch_id, 'SETTLEMENT_PAYOUT', 'SETTLEMENT', v_payout.settlement_id::text, v_payout.restaurant_id,
      v_payout.id, v_payout.settlement_id, v_payout.amount_tzs, 'CREDIT', 'PROVIDER_RECEIVABLE',
      'PROVIDER_PAYOUT', p_provider_reference, 'Provider disbursement of merchant funds', v_idem || '_credit_prov'
    );

    PERFORM public.close_and_verify_posting_batch(v_batch_id);

    -- Update payout and settlement
    UPDATE public.merchant_payouts
    SET status = 'SUCCESS',
        provider_reference = p_provider_reference,
        completed_at = clock_timestamp(),
        raw_provider_status = p_raw_status
    WHERE id = v_payout.id;

    UPDATE public.merchant_settlements
    SET status = 'PAID'
    WHERE id = v_payout.settlement_id;

  ELSIF p_status = 'FAILED' THEN
    UPDATE public.merchant_payouts
    SET status = 'FAILED',
        failed_at = clock_timestamp(),
        failure_reason = p_failure_reason,
        raw_provider_status = p_raw_status
    WHERE id = v_payout.id;

    UPDATE public.merchant_settlements
    SET status = 'FAILED'
    WHERE id = v_payout.settlement_id;

  ELSIF p_status = 'REVERSED' THEN
    -- Reverse earlier payout:
    -- DEBIT  PROVIDER_RECEIVABLE  : amount
    -- CREDIT RESTAURANT_PAYABLE   : amount
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'PAYOUT_REVERSAL', v_payout.amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.financial_ledger_entries (
      batch_id, entry_type, entity_type, entity_id, restaurant_id,
      payout_id, settlement_id, amount_tzs, direction, account_type,
      reference_type, reference_id, description, idempotency_key
    ) VALUES (
      v_batch_id, 'SETTLEMENT_PAYOUT', 'SETTLEMENT', v_payout.settlement_id::text, v_payout.restaurant_id,
      v_payout.id, v_payout.settlement_id, v_payout.amount_tzs, 'DEBIT', 'PROVIDER_RECEIVABLE',
      'PAYOUT_REVERSAL', p_provider_reference, 'Reversal of merchant payout by provider', v_idem || '_debit_prov'
    ), (
      v_batch_id, 'SETTLEMENT_PAYOUT', 'SETTLEMENT', v_payout.settlement_id::text, v_payout.restaurant_id,
      v_payout.id, v_payout.settlement_id, v_payout.amount_tzs, 'CREDIT', 'RESTAURANT_PAYABLE',
      'PAYOUT_REVERSAL', p_provider_reference, 'Restoration of merchant payable after payout reversal', v_idem || '_credit_rest'
    );

    PERFORM public.close_and_verify_posting_batch(v_batch_id);

    UPDATE public.merchant_payouts
    SET status = 'REVERSED',
        raw_provider_status = p_raw_status
    WHERE id = v_payout.id;

    UPDATE public.merchant_settlements
    SET status = 'ON_HOLD'
    WHERE id = v_payout.settlement_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'payout_id', p_payout_id, 'status', p_status);
END;
$$;

-- ==============================================================================
-- 25. SERVER-AUTHORITATIVE RPC: REQUEST REFUND SECURE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.request_refund_secure(
  p_payment_id VARCHAR(80),
  p_requested_amount_tzs BIGINT,
  p_reason_code VARCHAR(50),
  p_reason_detail TEXT,
  p_idempotency_key TEXT,
  p_affected_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_prior_refunded BIGINT;
  v_refund_id UUID;
  v_existing RECORD;
BEGIN
  -- 1. Check idempotency
  SELECT * INTO v_existing FROM public.refund_requests WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'refund_request_id', v_existing.id,
      'status', v_existing.status,
      'message', 'Refund request already exists (idempotent)'
    );
  END IF;

  -- 2. Validate Payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  IF v_payment.status <> 'SUCCESS' THEN
    RAISE EXCEPTION 'Cannot request refund for non-successful payment (current status: %)', v_payment.status;
  END IF;

  -- 3. Check cumulative refund limits
  SELECT COALESCE(SUM(approved_amount_tzs), 0) INTO v_prior_refunded
  FROM public.refund_requests
  WHERE payment_id = p_payment_id
    AND status IN ('APPROVED', 'PROVIDER_PROCESSING', 'REFUNDED', 'PARTIALLY_REFUNDED');

  IF (v_prior_refunded + p_requested_amount_tzs) > v_payment.amount_tzs THEN
    RAISE EXCEPTION 'Total requested refunds (% TZS) exceed captured payment amount (% TZS)',
      (v_prior_refunded + p_requested_amount_tzs), v_payment.amount_tzs;
  END IF;

  -- 4. Insert refund request
  INSERT INTO public.refund_requests (
    payment_id, order_id, reservation_id, customer_user_id, restaurant_id,
    requested_amount_tzs, reason_code, reason_detail, status,
    requested_by, idempotency_key, affected_items
  ) VALUES (
    v_payment.id, v_payment.order_id, v_payment.reservation_id, v_payment.user_id, v_payment.restaurant_id,
    p_requested_amount_tzs, p_reason_code, p_reason_detail, 'REQUESTED',
    auth.uid(), p_idempotency_key, p_affected_items
  ) RETURNING id INTO v_refund_id;

  RETURN jsonb_build_object(
    'success', true,
    'refund_request_id', v_refund_id,
    'status', 'REQUESTED',
    'amount_tzs', p_requested_amount_tzs
  );
END;
$$;

-- ==============================================================================
-- 26. SERVER-AUTHORITATIVE RPC: APPROVE REFUND SECURE
-- ==============================================================================
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
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.refund_requests WHERE id = p_refund_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund request % not found', p_refund_request_id;
  END IF;

  IF v_req.status <> 'REQUESTED' AND v_req.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'Refund request % cannot be approved from status %', p_refund_request_id, v_req.status;
  END IF;

  UPDATE public.refund_requests
  SET status = 'APPROVED',
      approved_amount_tzs = p_approved_amount_tzs,
      responsibility = p_responsibility,
      reviewed_by = auth.uid(),
      reviewed_at = clock_timestamp()
  WHERE id = p_refund_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'refund_request_id', p_refund_request_id,
    'status', 'APPROVED',
    'approved_amount_tzs', p_approved_amount_tzs
  );
END;
$$;

-- ==============================================================================
-- 27. SERVER-AUTHORITATIVE RPC: FINALIZE REFUND PROVIDER RESULT (Service Role Only)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.finalize_refund_provider_result(
  p_refund_request_id UUID,
  p_provider_refund_ref TEXT,
  p_status public.refund_status_enum,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_payment RECORD;
  v_batch_id UUID;
  v_idem TEXT;
  v_new_total_refunded BIGINT;
BEGIN
  SELECT * INTO v_req FROM public.refund_requests WHERE id = p_refund_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund request % not found', p_refund_request_id;
  END IF;

  IF v_req.status IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Refund already completed (idempotent)');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = v_req.payment_id FOR UPDATE;
  v_idem := 'refund:' || v_req.id || ':' || p_status;

  IF p_status IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN
    -- Post Balanced Refund Reversal Batch:
    -- If RESTAURANT responsible: DEBIT RESTAURANT_PAYABLE, CREDIT PROVIDER_RECEIVABLE
    -- If PLATFORM responsible:   DEBIT PLATFORM_REVENUE,   CREDIT PROVIDER_RECEIVABLE
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'REFUND_DISBURSEMENT', v_req.approved_amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    IF v_req.responsibility = 'PLATFORM' THEN
      INSERT INTO public.financial_ledger_entries (
        batch_id, entry_type, entity_type, entity_id, restaurant_id, customer_user_id,
        payment_id, refund_id, amount_tzs, direction, account_type,
        reference_type, reference_id, description, idempotency_key
      ) VALUES (
        v_batch_id, 'REFUND_REVERSAL', 'REFUND', v_req.id::text, v_req.restaurant_id, v_req.customer_user_id,
        v_payment.id, v_req.id, v_req.approved_amount_tzs, 'DEBIT', 'PLATFORM_REVENUE',
        'PROVIDER_REFUND', p_provider_refund_ref, 'Platform-funded refund reversal', v_idem || '_debit_plat'
      ), (
        v_batch_id, 'REFUND_REVERSAL', 'REFUND', v_req.id::text, v_req.restaurant_id, v_req.customer_user_id,
        v_payment.id, v_req.id, v_req.approved_amount_tzs, 'CREDIT', 'PROVIDER_RECEIVABLE',
        'PROVIDER_REFUND', p_provider_refund_ref, 'Provider refund disbursement to customer', v_idem || '_credit_prov'
      );
    ELSE
      -- Default: Restaurant responsibility
      INSERT INTO public.financial_ledger_entries (
        batch_id, entry_type, entity_type, entity_id, restaurant_id, customer_user_id,
        payment_id, refund_id, amount_tzs, direction, account_type,
        reference_type, reference_id, description, idempotency_key
      ) VALUES (
        v_batch_id, 'REFUND_REVERSAL', 'REFUND', v_req.id::text, v_req.restaurant_id, v_req.customer_user_id,
        v_payment.id, v_req.id, v_req.approved_amount_tzs, 'DEBIT', 'RESTAURANT_PAYABLE',
        'PROVIDER_REFUND', p_provider_refund_ref, 'Merchant-funded refund reversal', v_idem || '_debit_rest'
      ), (
        v_batch_id, 'REFUND_REVERSAL', 'REFUND', v_req.id::text, v_req.restaurant_id, v_req.customer_user_id,
        v_payment.id, v_req.id, v_req.approved_amount_tzs, 'CREDIT', 'PROVIDER_RECEIVABLE',
        'PROVIDER_REFUND', p_provider_refund_ref, 'Provider refund disbursement to customer', v_idem || '_credit_prov'
      );
    END IF;

    PERFORM public.close_and_verify_posting_batch(v_batch_id);

    -- Update payment refunded amount
    v_new_total_refunded := v_payment.refunded_amount_tzs + v_req.approved_amount_tzs;
    UPDATE public.payments
    SET refunded_amount_tzs = v_new_total_refunded,
        status = CASE WHEN v_new_total_refunded >= v_payment.amount_tzs THEN 'REFUNDED'::public.payment_status_enum ELSE status END,
        refunded_at = clock_timestamp()
    WHERE id = v_payment.id;

    UPDATE public.refund_requests
    SET status = p_status,
        provider_refund_reference = p_provider_refund_ref,
        completed_at = clock_timestamp()
    WHERE id = v_req.id;

  ELSE
    UPDATE public.refund_requests
    SET status = p_status,
        failure_reason = p_failure_reason
    WHERE id = v_req.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'refund_request_id', p_refund_request_id, 'status', p_status);
END;
$$;

-- ==============================================================================
-- 28. SERVER-AUTHORITATIVE RPC: OPEN FINANCIAL DISPUTE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.open_financial_dispute_secure(
  p_dispute_type public.financial_dispute_type_enum,
  p_entity_type VARCHAR(50),
  p_entity_id VARCHAR(80),
  p_restaurant_id VARCHAR(80),
  p_disputed_amount_tzs BIGINT,
  p_reason_code VARCHAR(50),
  p_description TEXT,
  p_refund_request_id UUID DEFAULT NULL,
  p_payment_id VARCHAR(80) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dispute_id UUID;
  v_batch_id UUID;
  v_idem TEXT;
BEGIN
  v_idem := 'dispute:hold:' || gen_random_uuid();

  -- Insert dispute record
  INSERT INTO public.financial_disputes (
    dispute_type, entity_type, entity_id, restaurant_id, customer_user_id,
    refund_request_id, payment_id, disputed_amount_tzs, opened_by,
    reason_code, description, status
  ) VALUES (
    p_dispute_type, p_entity_type, p_entity_id, p_restaurant_id, auth.uid(),
    p_refund_request_id, p_payment_id, p_disputed_amount_tzs, auth.uid(),
    p_reason_code, p_description, 'OPEN'
  ) RETURNING id INTO v_dispute_id;

  -- Post Balanced Dispute Hold Batch:
  -- DEBIT  RESTAURANT_PAYABLE : disputed_amount
  -- CREDIT DISPUTE_RESERVE    : disputed_amount
  IF p_restaurant_id IS NOT NULL THEN
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'DISPUTE_HOLD', p_disputed_amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.financial_ledger_entries (
      batch_id, entry_type, entity_type, entity_id, restaurant_id, dispute_id,
      amount_tzs, direction, account_type, reference_type, reference_id,
      description, idempotency_key
    ) VALUES (
      v_batch_id, 'DISPUTE_HOLD', 'DISPUTE', v_dispute_id::text, p_restaurant_id, v_dispute_id,
      p_disputed_amount_tzs, 'DEBIT', 'RESTAURANT_PAYABLE', 'DISPUTE_OPEN', v_dispute_id::text,
      'Dispute hold placed on merchant payable', v_idem || '_debit_rest'
    ), (
      v_batch_id, 'DISPUTE_HOLD', 'DISPUTE', v_dispute_id::text, p_restaurant_id, v_dispute_id,
      p_disputed_amount_tzs, 'CREDIT', 'DISPUTE_RESERVE', 'DISPUTE_OPEN', v_dispute_id::text,
      'Dispute reserve held pending resolution', v_idem || '_credit_reserve'
    );

    PERFORM public.close_and_verify_posting_batch(v_batch_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'dispute_id', v_dispute_id, 'status', 'OPEN');
END;
$$;

-- ==============================================================================
-- 29. SERVER-AUTHORITATIVE RPC: RESOLVE FINANCIAL DISPUTE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.resolve_financial_dispute_secure(
  p_dispute_id UUID,
  p_status public.financial_dispute_status_enum,
  p_resolution TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dispute RECORD;
  v_batch_id UUID;
  v_idem TEXT;
BEGIN
  SELECT * INTO v_dispute FROM public.financial_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute % not found', p_dispute_id;
  END IF;

  v_idem := 'dispute:resolve:' || v_dispute.id || ':' || p_status;

  IF p_status = 'RESOLVED_RESTAURANT' THEN
    -- Release hold back to restaurant:
    -- DEBIT  DISPUTE_RESERVE    : amount
    -- CREDIT RESTAURANT_PAYABLE : amount
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'DISPUTE_RELEASE', v_dispute.disputed_amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.financial_ledger_entries (
      batch_id, entry_type, entity_type, entity_id, restaurant_id, dispute_id,
      amount_tzs, direction, account_type, reference_type, reference_id,
      description, idempotency_key
    ) VALUES (
      v_batch_id, 'DISPUTE_RELEASE', 'DISPUTE', v_dispute.id::text, v_dispute.restaurant_id, v_dispute.id,
      v_dispute.disputed_amount_tzs, 'DEBIT', 'DISPUTE_RESERVE', 'DISPUTE_RESOLVE', v_dispute.id::text,
      'Release dispute reserve back to restaurant', v_idem || '_debit_reserve'
    ), (
      v_batch_id, 'DISPUTE_RELEASE', 'DISPUTE', v_dispute.id::text, v_dispute.restaurant_id, v_dispute.id,
      v_dispute.disputed_amount_tzs, 'CREDIT', 'RESTAURANT_PAYABLE', 'DISPUTE_RESOLVE', v_dispute.id::text,
      'Merchant payable restoration from resolved dispute', v_idem || '_credit_rest'
    );

    PERFORM public.close_and_verify_posting_batch(v_batch_id);

  ELSIF p_status = 'RESOLVED_CUSTOMER' THEN
    -- Dispute won by customer: reserve moves to provider receivable for refund
    -- DEBIT  DISPUTE_RESERVE     : amount
    -- CREDIT PROVIDER_RECEIVABLE : amount
    INSERT INTO public.financial_posting_batches (
      batch_type, total_amount_tzs, is_balanced, idempotency_key
    ) VALUES (
      'DISPUTE_REFUND', v_dispute.disputed_amount_tzs, FALSE, v_idem
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.financial_ledger_entries (
      batch_id, entry_type, entity_type, entity_id, restaurant_id, dispute_id,
      amount_tzs, direction, account_type, reference_type, reference_id,
      description, idempotency_key
    ) VALUES (
      v_batch_id, 'DISPUTE_RELEASE', 'DISPUTE', v_dispute.id::text, v_dispute.restaurant_id, v_dispute.id,
      v_dispute.disputed_amount_tzs, 'DEBIT', 'DISPUTE_RESERVE', 'DISPUTE_RESOLVE', v_dispute.id::text,
      'Dispute reserve consumed for customer refund', v_idem || '_debit_reserve'
    ), (
      v_batch_id, 'DISPUTE_RELEASE', 'DISPUTE', v_dispute.id::text, v_dispute.restaurant_id, v_dispute.id,
      v_dispute.disputed_amount_tzs, 'CREDIT', 'PROVIDER_RECEIVABLE', 'DISPUTE_RESOLVE', v_dispute.id::text,
      'Dispute refund disbursement', v_idem || '_credit_prov'
    );

    PERFORM public.close_and_verify_posting_batch(v_batch_id);
  END IF;

  UPDATE public.financial_disputes
  SET status = p_status,
      resolution = p_resolution,
      resolved_at = clock_timestamp(),
      assigned_admin = auth.uid()
  WHERE id = v_dispute.id;

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

-- ==============================================================================
-- 30. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all Pack 4C tables
ALTER TABLE public.financial_posting_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_fee_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payout_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payout_destination_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;

-- 30.1 financial_posting_batches: Admin only read
CREATE POLICY "Admins can view posting batches"
  ON public.financial_posting_batches FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.2 financial_ledger_entries: Restaurant member can read own, Admin full read
CREATE POLICY "Restaurant staff can view own ledger entries"
  ON public.financial_ledger_entries FOR SELECT TO authenticated
  USING (
    restaurant_id IS NOT NULL AND (
      is_restaurant_member(restaurant_id) OR
      public.is_admin(auth.uid())
    )
  );

-- 30.3 merchant_fee_policies: Authenticated can read active, Admin manage
CREATE POLICY "Anyone can view fee policies"
  ON public.merchant_fee_policies FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage fee policies"
  ON public.merchant_fee_policies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.4 order_financial_snapshots: Customer owns order, Restaurant member owns order, Admin
CREATE POLICY "Participants can view order financial snapshots"
  ON public.order_financial_snapshots FOR SELECT TO authenticated
  USING (
    is_restaurant_member(restaurant_id) OR
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_financial_snapshots.order_id AND o.user_id = auth.uid())
  );

-- 30.5 refund_requests: Customer owns, Restaurant owns, Admin manage
CREATE POLICY "Customer can view own refund requests"
  ON public.refund_requests FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY "Restaurant staff can view restaurant refund requests"
  ON public.refund_requests FOR SELECT TO authenticated
  USING (restaurant_id IS NOT NULL AND is_restaurant_member(restaurant_id));

CREATE POLICY "Admins can manage refund requests"
  ON public.refund_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.6 financial_disputes: Customer owns, Restaurant owns, Admin manage
CREATE POLICY "Customer can view own disputes"
  ON public.financial_disputes FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY "Restaurant staff can view restaurant disputes"
  ON public.financial_disputes FOR SELECT TO authenticated
  USING (restaurant_id IS NOT NULL AND is_restaurant_member(restaurant_id));

CREATE POLICY "Admins can manage disputes"
  ON public.financial_disputes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.7 financial_dispute_evidence: Participants and Admin
CREATE POLICY "Dispute participants can view evidence"
  ON public.financial_dispute_evidence FOR SELECT TO authenticated
  USING (
    uploader_id = auth.uid() OR
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.financial_disputes fd
      WHERE fd.id = financial_dispute_evidence.dispute_id
        AND (fd.customer_user_id = auth.uid() OR is_restaurant_member(fd.restaurant_id))
    )
  );

CREATE POLICY "Dispute participants can insert evidence"
  ON public.financial_dispute_evidence FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.financial_disputes fd
      WHERE fd.id = financial_dispute_evidence.dispute_id
        AND (fd.customer_user_id = auth.uid() OR is_restaurant_member(fd.restaurant_id) OR public.is_admin(auth.uid()))
    )
  );

-- 30.8 merchant_settlements: Restaurant members own, Admin manage
CREATE POLICY "Restaurant staff can view settlements"
  ON public.merchant_settlements FOR SELECT TO authenticated
  USING (is_restaurant_member(restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage settlements"
  ON public.merchant_settlements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.9 merchant_settlement_items: Restaurant staff and Admin
CREATE POLICY "Restaurant staff can view settlement items"
  ON public.merchant_settlement_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_settlements ms
      WHERE ms.id = merchant_settlement_items.settlement_id
        AND (is_restaurant_member(ms.restaurant_id) OR public.is_admin(auth.uid()))
    )
  );

-- 30.10 merchant_payout_destinations: Restaurant OWNER only, Admin manage
CREATE POLICY "Restaurant owners can view payout destinations"
  ON public.merchant_payout_destinations FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_payout_destinations.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'OWNER'
        AND rm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Restaurant owners can create payout destinations"
  ON public.merchant_payout_destinations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_payout_destinations.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'OWNER'
        AND rm.status = 'ACTIVE'
    )
  );

-- 30.11 merchant_payout_destination_secrets: ZERO client access! (No policies for anon or authenticated)
-- Only service_role can access.

-- 30.12 merchant_payouts: Restaurant staff read, Admin manage
CREATE POLICY "Restaurant owners can view payouts"
  ON public.merchant_payouts FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.restaurant_id = merchant_payouts.restaurant_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'OWNER'
        AND rm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Admins can manage payouts"
  ON public.merchant_payouts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.13 financial_adjustments: Restaurant staff read, Admin manage
CREATE POLICY "Restaurant staff can view adjustments"
  ON public.financial_adjustments FOR SELECT TO authenticated
  USING (is_restaurant_member(restaurant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage adjustments"
  ON public.financial_adjustments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- 30.14 reconciliation_runs & items: Admin only
CREATE POLICY "Admins can view reconciliation runs"
  ON public.reconciliation_runs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view reconciliation items"
  ON public.reconciliation_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ==============================================================================
-- 31. RESTRICT PROVIDER-FINALIZATION RPCS TO SERVICE ROLE ONLY
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.finalize_payment_capture_rpc(VARCHAR, TEXT, TEXT, BIGINT, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_payment_capture_rpc(VARCHAR, TEXT, TEXT, BIGINT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_merchant_payout_rpc(UUID, TEXT, public.merchant_payout_status_enum, TEXT, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_merchant_payout_rpc(UUID, TEXT, public.merchant_payout_status_enum, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_refund_provider_result(UUID, TEXT, public.refund_status_enum, TEXT) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_refund_provider_result(UUID, TEXT, public.refund_status_enum, TEXT) TO service_role;

-- ==============================================================================
-- 32. INTEGRATE WEBHOOK & CUSTOM MEAL RPCS WITH FINANCIAL CAPTURE
-- ==============================================================================

-- 32.1 Update public.confirm_payment_webhook_rpc
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
  -- 1. Locate payment by merchant reference or provider reference
  SELECT * INTO v_payment FROM public.payments
  WHERE merchant_reference = p_merchant_reference
     OR provider_transaction_id = p_gateway_reference
     OR idempotency_key = p_merchant_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PAYMENT_NOT_FOUND',
      'message', 'No transaction found for merchant reference: ' || p_merchant_reference
    );
  END IF;

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
  IF p_collected_amount < v_payment.amount_tzs THEN
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

-- 32.2 Update public.process_payment_webhook_secure
CREATE OR REPLACE FUNCTION public.process_payment_webhook_secure(
  p_provider_reference TEXT,
  p_gateway_reference TEXT,
  p_merchant_reference TEXT,
  p_amount_tzs INTEGER,
  p_status TEXT,
  p_raw_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_payment RECORD;
  v_res RECORD;
  v_settings RECORD;
  v_hold RECORD;
  v_service_date DATE;
  v_lock_key BIGINT;
  v_hold_expired BOOLEAN;
BEGIN
  -- 1. Locate payment record
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_reference = p_provider_reference
     OR provider_transaction_id = p_gateway_reference
     OR idempotency_key = p_merchant_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Payment record not found for reference %', p_provider_reference;
  END IF;

  -- 2. Idempotency check: already paid and captured?
  IF v_payment.status = 'SUCCESS' AND EXISTS (
    SELECT 1 FROM public.financial_posting_batches WHERE idempotency_key = 'payment:' || v_payment.id || ':capture'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed and finalized (idempotent)',
      'payment_id', v_payment.id,
      'status', 'SUCCESS'
    );
  END IF;

  -- 3. Verify amount
  IF v_payment.amount_tzs <> p_amount_tzs THEN
    RAISE EXCEPTION '400 Bad Request: Webhook amount % does not match recorded payment amount %',
      p_amount_tzs, v_payment.amount_tzs;
  END IF;

  -- 4. Mark payment success
  UPDATE public.payments
  SET status = 'SUCCESS',
      paid_at = clock_timestamp(),
      webhook_verified = TRUE,
      provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
      provider_reference = COALESCE(p_provider_reference, provider_reference),
      gateway_response = p_raw_payload,
      updated_at = clock_timestamp()
  WHERE id = v_payment.id;

  -- 5. Handle Standard Order fulfillment
  IF v_payment.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET payment_status = 'SUCCESS',
        updated_at = clock_timestamp()
    WHERE id = v_payment.order_id;
  END IF;

  -- 6. Handle Reservation Deposit fulfillment
  IF v_payment.reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.reservations WHERE id = v_payment.reservation_id FOR UPDATE;

    IF FOUND THEN
      v_service_date := (v_res.scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
      v_lock_key := public.get_branch_date_lock_key(v_res.branch_id, v_service_date);
      PERFORM pg_advisory_xact_lock(v_lock_key);

      -- Check hold validity
      SELECT * INTO v_hold
      FROM public.reservation_holds
      WHERE reservation_id = v_res.id AND is_active = TRUE
      LIMIT 1;

      v_hold_expired := (v_hold.id IS NULL OR v_hold.expires_at < clock_timestamp());

      IF v_hold_expired OR v_res.status <> 'AWAITING_DEPOSIT' THEN
        -- Money was received late after hold expired. Never overbook.
        UPDATE public.reservations
        SET status = 'PAYMENT_REVIEW_REQUIRED',
            is_deposit_paid = TRUE,
            payment_id = v_payment.id,
            deposit_amount_tzs = v_payment.amount_tzs,
            refund_eligibility = 'MANUAL_REVIEW',
            updated_at = clock_timestamp()
        WHERE id = v_res.id;

      ELSE
        -- Valid hold exists: confirm reservation and allocate table
        UPDATE public.reservations
        SET status = 'CONFIRMED',
            is_deposit_paid = TRUE,
            payment_id = v_payment.id,
            deposit_amount_tzs = v_payment.amount_tzs,
            updated_at = clock_timestamp()
        WHERE id = v_res.id;

        UPDATE public.reservation_holds
        SET is_active = FALSE
        WHERE id = v_hold.id;

        IF v_res.table_id IS NOT NULL THEN
          INSERT INTO public.reservation_table_allocations (
            reservation_id, table_id, branch_id, slot_interval, is_active
          ) VALUES (
            v_res.id, v_res.table_id, v_res.branch_id,
            tstzrange(v_res.scheduled_at, v_res.slot_end_at, '[)'),
            TRUE
          ) ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 7. Post Canonical Financial Snapshot & Balanced Double-Entry Subledger Batch
  PERFORM public.finalize_payment_capture_rpc(
    v_payment.id,
    p_provider_reference,
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
$func$ LANGUAGE plpgsql;

-- 32.3 Update public.convert_custom_meal_to_order
CREATE OR REPLACE FUNCTION public.convert_custom_meal_to_order(
    p_request_id VARCHAR(80),
    p_payment_id VARCHAR(80)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
    v_req RECORD;
    v_pay RECORD;
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_snap JSONB;
    v_item RECORD;
    v_existing_order RECORD;
BEGIN
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    IF v_req.converted_order_id IS NOT NULL THEN
        SELECT * INTO v_existing_order FROM public.orders WHERE id = v_req.converted_order_id;
        RETURN jsonb_build_object(
            'order_id', v_existing_order.id,
            'order_number', v_existing_order.order_number,
            'status', v_existing_order.status,
            'payment_status', v_existing_order.payment_status,
            'idempotent', TRUE
        );
    END IF;

    IF v_req.status != 'QUOTE_ACCEPTED' THEN
        RAISE EXCEPTION '400 Bad Request: Custom meal request status must be QUOTE_ACCEPTED (current: %).', v_req.status;
    END IF;

    v_snap := v_req.locked_quote_snapshot;
    IF v_snap IS NULL THEN
        RAISE EXCEPTION '500 Internal Error: Locked quote snapshot is missing on accepted request.';
    END IF;

    SELECT * INTO v_pay
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Payment record % does not exist.', p_payment_id;
    END IF;

    IF v_pay.status != 'SUCCESS' THEN
        RAISE EXCEPTION '400 Bad Request: Payment % is not finalized (status: %).', p_payment_id, v_pay.status;
    END IF;

    IF v_pay.user_id != v_req.user_id THEN
        RAISE EXCEPTION '403 Forbidden: Payment customer does not match custom meal applicant.';
    END IF;

    IF v_pay.restaurant_id != (v_snap->>'restaurant_id') THEN
        RAISE EXCEPTION '403 Forbidden: Payment restaurant does not match winning quote restaurant.';
    END IF;

    IF v_pay.amount_tzs != (v_snap->>'grand_total_tzs')::integer THEN
        RAISE EXCEPTION '400 Bad Request: Payment amount (%) does not match locked total (%).', v_pay.amount_tzs, (v_snap->>'grand_total_tzs');
    END IF;

    v_order_id := 'ord_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.orders (
        id, order_number, user_id, restaurant_id, branch_id,
        status, payment_status,
        subtotal_tzs, service_fee_tzs, delivery_fee_tzs, total_tzs,
        dining_option, delivery_address, customer_phone,
        special_instructions, estimated_prep_minutes,
        custom_meal_request_id, custom_meal_snapshot,
        created_at, updated_at
    ) VALUES (
        v_order_id, v_order_number, v_req.user_id, (v_snap->>'restaurant_id'),
        (v_snap->>'branch_id')::uuid,
        'PENDING',
        'SUCCESS',
        (v_snap->>'subtotal_tzs')::integer,
        (v_snap->>'service_fee_tzs')::integer,
        (v_snap->>'delivery_fee_tzs')::integer,
        (v_snap->>'grand_total_tzs')::integer,
        CASE WHEN (v_snap->>'fulfillment_mode') = 'PICKUP' THEN 'Pickup' ELSE 'Delivery' END,
        v_req.exact_delivery_address,
        v_req.exact_delivery_phone,
        'Custom Meal: ' || v_req.dish_name || '. Chef Notes: ' || COALESCE(v_snap->>'chef_notes', 'N/A'),
        COALESCE((v_snap->>'estimated_prep_minutes')::integer, 30),
        p_request_id,
        v_snap,
        NOW(), NOW()
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_snap->'line_items') AS x(
        name TEXT, description TEXT, quantity INTEGER, unit_price_tzs INTEGER, line_total_tzs INTEGER
    )
    LOOP
        INSERT INTO public.order_items (
            order_id, item_name, unit_price_tzs, quantity, total_price_tzs, special_notes
        ) VALUES (
            v_order_id, v_item.name, v_item.unit_price_tzs, v_item.quantity,
            v_item.unit_price_tzs * v_item.quantity, v_item.description
        );
    END LOOP;

    UPDATE public.custom_meal_requests SET
        converted_order_id = v_order_id,
        status = 'ORDER_CREATED',
        status_message_en = 'Order placed successfully! Kitchen has received your order.',
        status_message_sw = 'Agizo limewekwa kikamilifu! Jiko limepokea agizo lako.',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Link Payment to Canonical Order
    UPDATE public.payments
    SET order_id = v_order_id
    WHERE id = p_payment_id;

    -- Post Canonical Financial Snapshot & Balanced Double-Entry Subledger Batch
    PERFORM public.finalize_payment_capture_rpc(
        p_payment_id,
        v_pay.provider_reference,
        v_pay.provider_transaction_id,
        v_pay.amount_tzs,
        'payment:' || p_payment_id || ':capture'
    );

    INSERT INTO public.audit_logs (
        admin_user_id, action, target_type, target_id, details
    ) VALUES (
        v_req.user_id, 'CUSTOM_MEAL_ORDER_CONVERTED', 'ORDER', v_order_id,
        jsonb_build_object(
            'custom_meal_request_id', p_request_id,
            'payment_id', p_payment_id,
            'order_number', v_order_number,
            'restaurant_id', (v_snap->>'restaurant_id'),
            'total_tzs', (v_snap->>'grand_total_tzs')
        )
    );

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'status', 'PENDING',
        'payment_status', 'SUCCESS',
        'custom_meal_request_id', p_request_id,
        'idempotent', FALSE
    );
END;
$func$;


