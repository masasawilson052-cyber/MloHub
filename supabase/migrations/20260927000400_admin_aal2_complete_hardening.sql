-- ============================================================================
-- MLOHUB PRODUCTION SECURITY CLOSURE: EXTEND AAL2 TO ALL HIGH-RISK ADMIN RPCS
-- Migration: 20260927000400_admin_aal2_complete_hardening.sql
-- ============================================================================
-- Enforces mandatory Level 2 Authenticator Assurance (PERFORM public.require_admin_aal2();)
-- across all 10 high-risk platform administrative and financial mutation functions.

-- 1. approve_restaurant_application
CREATE OR REPLACE FUNCTION public.approve_restaurant_application(p_application_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_app RECORD;
    v_rest_id VARCHAR(80);
    v_applicant UUID;
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    IF v_app.status = 'APPROVED' THEN
        SELECT details->>'restaurant_id' INTO v_rest_id FROM public.audit_logs
        WHERE action='APPROVE_APPLICATION' AND target_id=p_application_id ORDER BY created_at DESC LIMIT 1;
        IF v_rest_id IS NULL THEN RAISE EXCEPTION 'Approved application needs administrator reconciliation.'; END IF;
        RETURN jsonb_build_object('success',true,'restaurant_id',v_rest_id,'status','APPROVED');
    END IF;
    IF v_app.status NOT IN ('PENDING','UNDER_REVIEW') THEN RAISE EXCEPTION 'Only pending applications can be approved.'; END IF;
    v_applicant := v_app.applicant_user_id;
    IF v_applicant IS NULL THEN RAISE EXCEPTION 'Application has no authenticated owner.'; END IF;

    -- Update application status
    UPDATE public.restaurant_applications
    SET status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Stable application identity prevents same-name businesses sharing ownership.
    v_rest_id := 'rest_' || md5(p_application_id);

    -- Insert restaurant (Unpublished & closed initially until owner sets up menu/branch)
    INSERT INTO public.restaurants (
        id,
        owner_id,
        name,
        slug,
        cuisine,
        address,
        neighborhood,
        is_verified,
        verification_status,
        is_active,
        is_published,
        is_open,
        created_at,
        updated_at
    ) VALUES (
        v_rest_id,
        v_applicant,
        v_app.business_name,
        v_rest_id,
        COALESCE(v_app.cuisine_type, 'Swahili'),
        COALESCE(v_app.address, 'Dar es Salaam'),
        COALESCE(v_app.neighborhood, 'Mikocheni'),
        TRUE,
        'VERIFIED',
        TRUE,
        FALSE,
        FALSE,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        is_active = TRUE,
        verification_status = 'VERIFIED',
        updated_at = NOW();

    -- Assign applicant as primary OWNER member
    IF v_applicant IS NOT NULL THEN
        INSERT INTO public.restaurant_members (
            user_id,
            restaurant_id,
            role,
            is_primary_owner,
            is_active,
            permissions,
            created_at,
            updated_at
        ) VALUES (
            v_applicant,
            v_rest_id,
            'OWNER',
            TRUE,
            TRUE,
            ARRAY['ALL'],
            NOW(),
            NOW()
        ) ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
            role = 'OWNER',
            is_primary_owner = TRUE,
            is_active = TRUE,
            updated_at = NOW();

        -- Update user profile active restaurant & role if customer
        UPDATE public.profiles
        SET role = 'RESTAURANT_OWNER',
            roles = ARRAY['CUSTOMER','RESTAURANT_OWNER']::public.user_role_enum[],
            account_type = 'RESTAURANT',
            active_workspace = 'RESTAURANT_OWNER',
            active_restaurant_id = v_rest_id,
            updated_at = NOW()
        WHERE id = v_applicant AND role = 'CUSTOMER';
    END IF;

    -- Audit log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(),
        'APPROVE_APPLICATION',
        'APPLICATION',
        p_application_id,
        jsonb_build_object(
            'restaurant_id', v_rest_id,
            'applicant_user_id', v_applicant,
            'business_name', v_app.business_name
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', v_rest_id,
        'status', 'APPROVED',
        'is_published', FALSE,
        'is_open', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_restaurant_application(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_restaurant_application(VARCHAR) TO authenticated, service_role;


-- 2. reject_restaurant_application
CREATE OR REPLACE FUNCTION public.reject_restaurant_application(p_application_id VARCHAR(80), p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    UPDATE public.restaurant_applications
    SET status = 'REJECTED', rejection_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_application_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'REJECT_APPLICATION', 'APPLICATION', p_application_id, jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'status', 'REJECTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.reject_restaurant_application(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_restaurant_application(VARCHAR, TEXT) TO authenticated, service_role;


-- 3. verify_restaurant_secure
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
    PERFORM public.require_admin_aal2();

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

REVOKE ALL ON FUNCTION public.verify_restaurant_secure(VARCHAR, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_restaurant_secure(VARCHAR, TEXT, TEXT, TEXT) TO authenticated, service_role;


-- 4. reactivate_restaurant_secure
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
    PERFORM public.require_admin_aal2();

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

REVOKE ALL ON FUNCTION public.reactivate_restaurant_secure(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;


-- 5. archive_restaurant_secure
CREATE OR REPLACE FUNCTION public.archive_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_archive_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_actor_name TEXT;
    v_rest_name TEXT;
BEGIN
    PERFORM public.require_admin_aal2();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required to archive restaurants.';
    END IF;

    IF length(trim(COALESCE(p_archive_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: An archive reason of at least 4 characters is required.';
    END IF;

    SELECT name INTO v_rest_name FROM public.restaurants WHERE id = p_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % does not exist.', p_restaurant_id;
    END IF;

    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    -- Update restaurant to archived status, closed and delisted
    UPDATE public.restaurants
    SET
        archived_at = clock_timestamp(),
        archived_by = v_actor,
        archive_reason = trim(p_archive_reason),
        is_open = FALSE,
        is_published = FALSE,
        verification_status = 'SUSPENDED',
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;

    -- Deactivate associated branches
    UPDATE public.restaurant_branches
    SET is_active = FALSE, updated_at = clock_timestamp()
    WHERE restaurant_id = p_restaurant_id;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'ARCHIVE_RESTAURANT',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'restaurant_name', v_rest_name,
            'reason', p_archive_reason,
            'archived_at', clock_timestamp()
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'archived_at', clock_timestamp()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_restaurant_secure(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;


-- 6. resolve_financial_dispute_secure
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
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
  END IF;

  SELECT * INTO v_dispute FROM public.financial_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute % not found', p_dispute_id;
  END IF;

  v_idem := 'dispute:resolve:' || v_dispute.id || ':' || p_status;

  IF p_status = 'RESOLVED_RESTAURANT' THEN
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

  INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'RESOLVE_FINANCIAL_DISPUTE',
    'DISPUTE',
    p_dispute_id::text,
    jsonb_build_object('status', p_status, 'resolution', p_resolution)
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_financial_dispute_secure(UUID, public.financial_dispute_status_enum, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_financial_dispute_secure(UUID, public.financial_dispute_status_enum, TEXT) TO authenticated, service_role;


-- 7. update_platform_financial_settings_secure
CREATE OR REPLACE FUNCTION public.update_platform_financial_settings_secure(
    p_service_fee_tzs INTEGER,
    p_minimum_order_tzs INTEGER,
    p_default_commission_bps INTEGER,
    p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old RECORD;
    v_new RECORD;
BEGIN
    PERFORM public.require_admin_aal2();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    -- Strict authorization: SUPER_ADMIN platform role required for financial policy mutations
    IF NOT public.is_super_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: SUPER_ADMIN role required to modify platform financial settings.';
    END IF;

    IF length(trim(COALESCE(p_change_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: A descriptive change reason (minimum 4 characters) is required.';
    END IF;

    IF p_service_fee_tzs < 0 OR p_minimum_order_tzs < 0 OR p_default_commission_bps < 0 OR p_default_commission_bps > 10000 THEN
        RAISE EXCEPTION '400 Bad Request: Financial parameters out of valid operational range.';
    END IF;

    -- Lock singleton row
    SELECT * INTO v_old
    FROM public.platform_financial_settings
    WHERE id = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '500 Internal Error: Platform financial settings singleton row not found.';
    END IF;

    -- Record in history
    INSERT INTO public.platform_financial_settings_history (
        previous_service_fee_tzs, new_service_fee_tzs,
        previous_minimum_order_tzs, new_minimum_order_tzs,
        previous_commission_bps, new_commission_bps,
        changed_by, change_reason, changed_at
    ) VALUES (
        v_old.customer_service_fee_tzs, p_service_fee_tzs,
        v_old.minimum_order_value_tzs, p_minimum_order_tzs,
        v_old.default_commission_basis_points, p_default_commission_bps,
        v_actor, p_change_reason, clock_timestamp()
    );

    -- Update singleton settings
    UPDATE public.platform_financial_settings
    SET
        customer_service_fee_tzs = p_service_fee_tzs,
        minimum_order_value_tzs = p_minimum_order_tzs,
        default_commission_basis_points = p_default_commission_bps,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        change_reason = p_change_reason
    WHERE id = TRUE
    RETURNING * INTO v_new;

    -- Atomic audit log insertion (same transaction)
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor), 'Super Admin'),
        'UPDATE_PLATFORM_FINANCIAL_SETTINGS',
        'PLATFORM_SETTINGS',
        'FINANCIAL',
        jsonb_build_object(
            'previous_service_fee_tzs', v_old.customer_service_fee_tzs,
            'new_service_fee_tzs', p_service_fee_tzs,
            'previous_minimum_order_tzs', v_old.minimum_order_value_tzs,
            'new_minimum_order_tzs', p_minimum_order_tzs,
            'previous_commission_bps', v_old.default_commission_basis_points,
            'new_commission_bps', p_default_commission_bps,
            'change_reason', p_change_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'currency', v_new.currency,
        'customer_service_fee_tzs', v_new.customer_service_fee_tzs,
        'minimum_order_value_tzs', v_new.minimum_order_value_tzs,
        'default_commission_basis_points', v_new.default_commission_basis_points,
        'updated_at', v_new.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_financial_settings_secure(INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_financial_settings_secure(INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;


-- 8. update_platform_operational_settings_secure
CREATE OR REPLACE FUNCTION public.update_platform_operational_settings_secure(
    p_fresh_days INTEGER,
    p_recent_days INTEGER,
    p_stale_days INTEGER,
    p_support_phone TEXT,
    p_support_email TEXT,
    p_support_hours TEXT,
    p_maintenance_mode BOOLEAN,
    p_restaurant_applications_enabled BOOLEAN,
    p_customer_registration_enabled BOOLEAN,
    p_change_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_old RECORD;
    v_new RECORD;
BEGIN
    PERFORM public.require_admin_aal2();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    IF NOT public.is_admin(v_actor) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    IF length(trim(COALESCE(p_change_reason, ''))) < 4 THEN
        RAISE EXCEPTION '400 Bad Request: A descriptive change reason (minimum 4 characters) is required.';
    END IF;

    IF p_fresh_days <= 0 OR p_recent_days <= p_fresh_days OR p_stale_days <= p_recent_days THEN
        RAISE EXCEPTION '400 Bad Request: Freshness thresholds must satisfy: 0 < fresh < recent < stale.';
    END IF;

    SELECT * INTO v_old
    FROM public.platform_operational_settings
    WHERE id = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '500 Internal Error: Platform operational settings singleton row not found.';
    END IF;

    UPDATE public.platform_operational_settings
    SET
        fresh_days = p_fresh_days,
        recent_days = p_recent_days,
        stale_days = p_stale_days,
        support_phone = trim(p_support_phone),
        support_email = trim(p_support_email),
        support_hours = trim(p_support_hours),
        maintenance_mode = p_maintenance_mode,
        restaurant_applications_enabled = p_restaurant_applications_enabled,
        customer_registration_enabled = p_customer_registration_enabled,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        change_reason = p_change_reason
    WHERE id = TRUE
    RETURNING * INTO v_new;

    -- Atomic audit log insertion
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor), 'Admin'),
        'UPDATE_PLATFORM_OPERATIONAL_SETTINGS',
        'PLATFORM_SETTINGS',
        'OPERATIONAL',
        jsonb_build_object(
            'fresh_days', p_fresh_days,
            'recent_days', p_recent_days,
            'stale_days', p_stale_days,
            'maintenance_mode', p_maintenance_mode,
            'restaurant_applications_enabled', p_restaurant_applications_enabled,
            'customer_registration_enabled', p_customer_registration_enabled,
            'change_reason', p_change_reason
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'fresh_days', v_new.fresh_days,
        'recent_days', v_new.recent_days,
        'stale_days', v_new.stale_days,
        'support_phone', v_new.support_phone,
        'support_email', v_new.support_email,
        'support_hours', v_new.support_hours,
        'maintenance_mode', v_new.maintenance_mode,
        'restaurant_applications_enabled', v_new.restaurant_applications_enabled,
        'customer_registration_enabled', v_new.customer_registration_enabled,
        'updated_at', v_new.updated_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_operational_settings_secure(INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_operational_settings_secure(INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;


-- 9. execute_merchant_payout_rpc
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
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
  END IF;

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

  INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'EXECUTE_MERCHANT_PAYOUT',
    'SETTLEMENT',
    p_settlement_id::text,
    jsonb_build_object('payout_id', v_payout_id, 'amount_tzs', v_settlement.net_payable_tzs)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'status', 'QUEUED',
    'amount_tzs', v_settlement.net_payable_tzs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_merchant_payout_rpc(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_merchant_payout_rpc(UUID, UUID, TEXT) TO authenticated, service_role;


-- 10. publish_platform_announcement_secure
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
    PERFORM public.require_admin_aal2();

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
            'title_en', v_title_en,
            'title_sw', v_title_sw,
            'target_audience', p_target_audience,
            'priority', p_priority
        ),
        CASE WHEN p_priority IN ('HIGH', 'URGENT') THEN 'HIGH' ELSE 'MEDIUM' END,
        'MARKETING',
        'PENDING',
        'outbox:announcement:' || v_announcement_id::text
    );

    -- Audit log
    INSERT INTO public.audit_logs (
        admin_user_id, admin_name, action, target_type, target_id, details, created_at
    ) VALUES (
        v_actor::text,
        COALESCE(v_actor_name, 'Admin'),
        'PUBLISH_ANNOUNCEMENT',
        'ANNOUNCEMENT',
        v_announcement_id::text,
        jsonb_build_object(
            'title_en', v_title_en,
            'target_audience', p_target_audience,
            'priority', p_priority
        ),
        clock_timestamp()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'announcement_id', v_announcement_id,
        'title_en', v_title_en,
        'target_audience', p_target_audience
    );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_platform_announcement_secure(TEXT, TEXT, TEXT, TEXT, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, VARCHAR, VARCHAR) TO authenticated, service_role;
