-- ============================================================================
-- MLOHUB RESTAURANT AUTHORITY & VERIFICATION CLOSURE (PASS 1)
-- Migration: 20260928000600_restaurant_authority_verification_closure.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PHONE NORMALIZATION HELPER (IMMUTABLE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_tz_phone(
  p_phone TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;

  v := regexp_replace(
    p_phone,
    '[^0-9]',
    '',
    'g'
  );

  IF length(v) = 10
     AND left(v,1) = '0'
  THEN
    v :=
      '255' ||
      substr(v,2);
  ELSIF length(v) = 9 THEN
    v :=
      '255' ||
      v;
  END IF;

  IF left(v,3) <> '255'
     OR length(v) <> 12
  THEN
    RETURN NULL;
  END IF;

  RETURN '+' || v;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. BLOCK DIRECT RESTAURANT SELF-PUBLISH / SELF-VERIFY / LIFECYCLE MUTATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_restaurant_authority_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    /*
     * SECURITY DEFINER RPCs execute as their function owner
     * and may legitimately change lifecycle fields.
     *
     * Direct authenticated table updates must not.
     */
    IF current_user NOT IN ('postgres', 'service_role')
       AND NOT public.is_admin(auth.uid()) THEN

        IF NEW.owner_id
              IS DISTINCT FROM OLD.owner_id
        OR NEW.is_verified
              IS DISTINCT FROM OLD.is_verified
        OR NEW.verification_status
              IS DISTINCT FROM OLD.verification_status
        OR NEW.launch_status
              IS DISTINCT FROM OLD.launch_status
        OR NEW.is_published
              IS DISTINCT FROM OLD.is_published
        OR NEW.seller_tier
              IS DISTINCT FROM OLD.seller_tier
        OR NEW.archived_at
              IS DISTINCT FROM OLD.archived_at
        OR NEW.archive_reason
              IS DISTINCT FROM OLD.archive_reason
        THEN
            RAISE EXCEPTION
              '403 Forbidden: restaurant lifecycle fields are server-authoritative';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_restaurant_authority_fields ON public.restaurants;

CREATE TRIGGER trg_protect_restaurant_authority_fields
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.protect_restaurant_authority_fields();

-- ----------------------------------------------------------------------------
-- 3. RESTRICT BRANCH IDENTITY MUTATIONS TO OWNER / MANAGER / ADMIN
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Restaurant owners and staff can manage branches" ON public.restaurant_branches;
DROP POLICY IF EXISTS "Restaurant owners managers and admins manage branches" ON public.restaurant_branches;

CREATE POLICY "Restaurant owners managers and admins manage branches"
ON public.restaurant_branches
FOR ALL
TO authenticated
USING (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.restaurant_members rm
        WHERE
            rm.restaurant_id =
                restaurant_branches.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.is_active = TRUE
            AND rm.role IN ('OWNER', 'MANAGER')
    )
)
WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
        SELECT 1
        FROM public.restaurant_members rm
        WHERE
            rm.restaurant_id =
                restaurant_branches.restaurant_id
            AND rm.user_id = auth.uid()
            AND rm.is_active = TRUE
            AND rm.role IN ('OWNER', 'MANAGER')
    )
);

-- ----------------------------------------------------------------------------
-- 4. REAL ADMIN DOCUMENT REVIEW RPC (AAL2 REQUIRED)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_restaurant_verification_document(
    p_document_id UUID,
    p_decision TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_doc RECORD;
    v_status TEXT;
BEGIN
    PERFORM public.require_admin_aal2();

    IF p_decision NOT IN ('VERIFIED', 'REJECTED') THEN
        RAISE EXCEPTION 'Decision must be VERIFIED or REJECTED';
    END IF;

    SELECT *
    INTO v_doc
    FROM public.restaurant_verification_documents
    WHERE id = p_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification document not found';
    END IF;

    IF p_decision = 'REJECTED'
       AND (
         p_reason IS NULL
         OR length(trim(p_reason)) < 3
       ) THEN
        RAISE EXCEPTION 'Rejection reason is required';
    END IF;

    UPDATE public.restaurant_verification_documents
    SET
        verification_status = p_decision,
        rejection_reason =
            CASE
              WHEN p_decision = 'REJECTED'
                THEN trim(p_reason)
              ELSE NULL
            END,
        reviewed_at = clock_timestamp(),
        reviewed_by = auth.uid()
    WHERE id = p_document_id;

    INSERT INTO public.audit_logs (
        admin_user_id,
        action,
        target_type,
        target_id,
        details
    )
    VALUES (
        auth.uid(),
        'REVIEW_RESTAURANT_DOCUMENT',
        'RESTAURANT_VERIFICATION_DOCUMENT',
        p_document_id::TEXT,
        jsonb_build_object(
            'decision', p_decision,
            'document_type', v_doc.document_type,
            'application_id', v_doc.application_id,
            'restaurant_id', v_doc.restaurant_id,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'document_id', p_document_id,
        'verification_status', p_decision
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_restaurant_verification_document(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_restaurant_verification_document(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. GATE A: APPROVE APPLICATION REQUIRES 3 VERIFIED DOCUMENTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_restaurant_application(p_application_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_app RECORD;
    v_rest_id VARCHAR(80);
    v_applicant UUID;
BEGIN
    -- Mandatory AAL2 verification for administrative actions
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
        RETURN jsonb_build_object(
            'success', TRUE,
            'restaurant_id', v_rest_id,
            'merchant_approved', TRUE,
            'launch_status', 'SETUP_REQUIRED',
            'is_published', FALSE
        );
    END IF;

    IF v_app.status NOT IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED') THEN
        RAISE EXCEPTION 'Only pending or submitted applications can be approved.';
    END IF;

    v_applicant := v_app.applicant_user_id;
    IF v_applicant IS NULL THEN
        RAISE EXCEPTION 'Application has no authenticated owner.';
    END IF;

    -- Gate A Requirement: 3 required verification documents must be reviewed and verified
    IF (
        SELECT count(DISTINCT document_type)
        FROM public.restaurant_verification_documents
        WHERE application_id = p_application_id
          AND document_type IN ('BUSINESS_LICENSE', 'TIN_DOCUMENT', 'FOOD_OPERATION_DOCUMENT')
          AND verification_status = 'VERIFIED'
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
    ) <> 3
    THEN
        RAISE EXCEPTION 'Required business verification documents must be verified before merchant approval';
    END IF;

    -- Update application status to APPROVED
    UPDATE public.restaurant_applications
    SET status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Stable restaurant identifier
    v_rest_id := 'rest_' || md5(p_application_id);

    -- Gate A Semantics: Merchant approved, store stays in private setup
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
        launch_status,
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
        FALSE,                       -- Not verified yet (requires Gate B launch approval)
        'PENDING_VERIFICATION',      -- Two-Gate requirement
        'SETUP_REQUIRED',            -- Two-Gate requirement
        TRUE,
        FALSE,                       -- Must NEVER be published at Gate A
        FALSE,                       -- Closed until approved for launch
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        is_verified = FALSE,
        verification_status = 'PENDING_VERIFICATION',
        launch_status = 'SETUP_REQUIRED',
        is_active = TRUE,
        is_published = FALSE,
        is_open = FALSE,
        updated_at = NOW();

    -- Assign applicant as primary OWNER member
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

    -- Update user profile active restaurant & role
    UPDATE public.profiles
    SET role = 'RESTAURANT_OWNER',
        roles = ARRAY['CUSTOMER','RESTAURANT_OWNER']::public.user_role_enum[],
        account_type = 'RESTAURANT',
        active_workspace = 'RESTAURANT_OWNER',
        active_restaurant_id = v_rest_id,
        updated_at = NOW()
    WHERE id = v_applicant AND role = 'CUSTOMER';

    -- Link uploaded verification documents to the new restaurant record
    UPDATE public.restaurant_verification_documents
    SET restaurant_id = v_rest_id
    WHERE application_id = p_application_id;

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
            'business_name', v_app.business_name,
            'launch_status', 'SETUP_REQUIRED'
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', v_rest_id,
        'merchant_approved', TRUE,
        'launch_status', 'SETUP_REQUIRED',
        'is_published', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_restaurant_application(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_restaurant_application(VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. AUTHORITATIVE PAYOUT DESTINATION REVIEW RPC (AAL2 REQUIRED)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_payout_destination_secure(
    p_destination_id UUID,
    p_decision TEXT,
    p_verification_reference TEXT DEFAULT NULL,
    p_verified_account_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dest RECORD;
    v_secret_ok BOOLEAN := FALSE;
BEGIN
    PERFORM public.require_admin_aal2();

    IF p_decision NOT IN (
        'VERIFIED',
        'REJECTED'
    ) THEN
        RAISE EXCEPTION 'Invalid payout verification decision';
    END IF;

    SELECT *
    INTO v_dest
    FROM public.merchant_payout_destinations
    WHERE id = p_destination_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payout destination not found';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.merchant_payout_destination_secrets
        WHERE destination_id = p_destination_id
          AND encrypted_account_reference LIKE 'pgp:v1:%'
    )
    INTO v_secret_ok;

    IF NOT v_secret_ok THEN
        RAISE EXCEPTION 'Encrypted payout secret is missing';
    END IF;

    IF p_decision = 'VERIFIED' THEN
        IF p_verification_reference IS NULL
           OR length(trim(p_verification_reference)) < 3
        THEN
            RAISE EXCEPTION 'Verification reference required';
        END IF;

        IF p_verified_account_name IS NULL
           OR length(trim(p_verified_account_name)) < 2
        THEN
            RAISE EXCEPTION 'Verified account name required';
        END IF;
    ELSE
        IF p_reason IS NULL
           OR length(trim(p_reason)) < 3
        THEN
            RAISE EXCEPTION 'Rejection reason required';
        END IF;
    END IF;

    UPDATE public.merchant_payout_destinations
    SET
      verification_status = p_decision::public.destination_verification_status_enum,
      account_name =
        CASE
          WHEN p_decision = 'VERIFIED'
          THEN trim(p_verified_account_name)
          ELSE account_name
        END,
      verified_at =
        CASE
          WHEN p_decision = 'VERIFIED'
          THEN clock_timestamp()
          ELSE NULL
        END,
      verified_by =
        CASE
          WHEN p_decision = 'VERIFIED'
          THEN auth.uid()
          ELSE NULL
        END,
      is_default =
        CASE
          WHEN p_decision = 'REJECTED'
          THEN FALSE
          ELSE is_default
        END
    WHERE id = p_destination_id;

    INSERT INTO public.audit_logs (
      admin_user_id,
      action,
      target_type,
      target_id,
      details
    )
    VALUES (
      auth.uid(),
      'REVIEW_PAYOUT_DESTINATION',
      'PAYOUT_DESTINATION',
      p_destination_id::TEXT,
      jsonb_build_object(
        'decision', p_decision,
        'restaurant_id', v_dest.restaurant_id,
        'provider', v_dest.provider,
        'verification_reference', p_verification_reference,
        'reason', p_reason
      )
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'destination_id', p_destination_id,
      'verification_status', p_decision
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_payout_destination_secure(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payout_destination_secure(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. UPDATE get_restaurant_launch_readiness WITH NORMALIZED PHONE COMPARISON
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_restaurant_launch_readiness(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_rest RECORD;
    v_has_active_branch BOOLEAN := FALSE;
    v_branch_has_coords BOOLEAN := FALSE;
    v_has_opening_hours BOOLEAN := FALSE;
    v_has_logo BOOLEAN := FALSE;
    v_has_cover_image BOOLEAN := FALSE;
    v_has_storefront_image BOOLEAN := FALSE;
    v_has_verified_contact BOOLEAN := FALSE;
    v_has_menu BOOLEAN := FALSE;
    v_menu_item_count INTEGER := 0;
    v_menu_items_with_images INTEGER := 0;
    v_has_payout_destination BOOLEAN := FALSE;
    v_delivery_configured BOOLEAN := FALSE;
    v_business_verified BOOLEAN := FALSE;
    v_readiness_score NUMERIC := 0;
    v_missing TEXT[] := ARRAY[]::TEXT[];
    v_can_submit BOOLEAN := TRUE;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin(auth.uid()) AND NOT public.is_restaurant_member(p_restaurant_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    -- 1. Active branch check
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_branches
        WHERE restaurant_id = p_restaurant_id AND is_active = TRUE
    ) INTO v_has_active_branch;
    IF NOT v_has_active_branch THEN
        v_missing := array_append(v_missing, 'At least one active branch is required');
        v_can_submit := FALSE;
    END IF;

    -- 2. Branch coordinates check
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_branches
        WHERE restaurant_id = p_restaurant_id AND is_active = TRUE
          AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND length(trim(address)) > 0
    ) INTO v_branch_has_coords;
    IF NOT v_branch_has_coords THEN
        v_missing := array_append(v_missing, 'Branch must have valid map coordinates');
        v_can_submit := FALSE;
    END IF;

    -- 3. Opening hours check
    SELECT EXISTS (
        SELECT 1 FROM public.branch_operating_hours boh
        JOIN public.restaurant_branches rb ON rb.id = boh.branch_id
        WHERE rb.restaurant_id = p_restaurant_id AND rb.is_active = TRUE
    ) INTO v_has_opening_hours;
    IF NOT v_has_opening_hours THEN
        v_missing := array_append(v_missing, 'Branch operating hours must be configured');
    END IF;

    -- 4. Logo check
    v_has_logo := (v_rest.logo_url IS NOT NULL AND length(trim(v_rest.logo_url)) > 0);
    IF NOT v_has_logo THEN
        v_missing := array_append(v_missing, 'Restaurant logo is recommended');
    END IF;

    -- 5. Cover image check
    v_has_cover_image := (v_rest.cover_image_url IS NOT NULL AND length(trim(v_rest.cover_image_url)) > 0);

    -- 6. Storefront image check
    v_has_storefront_image := (
        v_has_cover_image OR
        (v_rest.food_spot_photos IS NOT NULL AND array_length(v_rest.food_spot_photos, 1) > 0)
    );

    -- 7. Verified contact check with normalized Tanzanian phone comparison
    SELECT EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = v_rest.owner_id
          AND u.phone_confirmed_at IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM public.restaurant_branches rb
              WHERE rb.restaurant_id = p_restaurant_id
                AND rb.is_active = TRUE
                AND public.normalize_tz_phone(rb.owner_phone) = public.normalize_tz_phone(u.phone)
          )
    ) INTO v_has_verified_contact;

    -- 8. Menu item count and pricing
    SELECT COUNT(*) INTO v_menu_item_count
    FROM public.menu_items
    WHERE restaurant_id = p_restaurant_id
      AND is_archived = FALSE
      AND is_available = TRUE
      AND price_tzs > 0;

    v_has_menu := (v_menu_item_count > 0);
    IF NOT v_has_menu THEN
        v_missing := array_append(v_missing, 'At least one priced, active menu item is required');
        v_can_submit := FALSE;
    END IF;

    -- 9. Menu items with photos
    SELECT COUNT(*) INTO v_menu_items_with_images
    FROM public.menu_items
    WHERE restaurant_id = p_restaurant_id
      AND is_archived = FALSE
      AND (image_url IS NOT NULL AND length(trim(image_url)) > 0);

    -- 10. Payout destination check
    SELECT EXISTS (
        SELECT 1 FROM public.merchant_payout_destinations d
        JOIN public.merchant_payout_destination_secrets s ON s.destination_id = d.id
        WHERE d.restaurant_id = p_restaurant_id
          AND d.verification_status = 'VERIFIED'
          AND s.encrypted_account_reference LIKE 'pgp:v1:%'
    ) INTO v_has_payout_destination;

    -- 11. Delivery pricing configuration
    SELECT EXISTS (
        SELECT 1 FROM public.branch_delivery_pricing bdp
        JOIN public.restaurant_branches rb ON rb.id = bdp.branch_id
        WHERE rb.restaurant_id = p_restaurant_id AND bdp.configuration_confirmed = TRUE
    ) INTO v_delivery_configured;

    -- 12. Business verified check
    SELECT count(DISTINCT document_type) = 3 INTO v_business_verified
    FROM public.restaurant_verification_documents
    WHERE restaurant_id = p_restaurant_id
      AND document_type IN ('BUSINESS_LICENSE', 'TIN_DOCUMENT', 'FOOD_OPERATION_DOCUMENT')
      AND verification_status = 'VERIFIED'
      AND reviewed_by IS NOT NULL
      AND public.is_admin(reviewed_by)
      AND reviewed_at IS NOT NULL
      AND length(trim(storage_path)) > 0;

    IF NOT coalesce(v_has_opening_hours, FALSE) THEN v_can_submit := FALSE; END IF;
    IF NOT coalesce(v_has_storefront_image, FALSE) THEN v_missing := array_append(v_missing, 'Storefront image required'); v_can_submit := FALSE; END IF;
    IF NOT coalesce(v_has_verified_contact, FALSE) THEN v_missing := array_append(v_missing, 'Verified owner phone matching restaurant contact required'); v_can_submit := FALSE; END IF;
    IF NOT coalesce(v_has_payout_destination, FALSE) THEN v_missing := array_append(v_missing, 'Verified encrypted payout destination required'); v_can_submit := FALSE; END IF;
    IF NOT coalesce(v_delivery_configured, FALSE) THEN v_missing := array_append(v_missing, 'Confirmed delivery configuration required'); v_can_submit := FALSE; END IF;
    IF NOT coalesce(v_business_verified, FALSE) THEN v_missing := array_append(v_missing, 'Reviewed business, tax and food-operation documents required'); v_can_submit := FALSE; END IF;

    -- Calculate readiness percentage (weighted total)
    IF v_has_active_branch THEN v_readiness_score := v_readiness_score + 15; END IF;
    IF v_branch_has_coords THEN v_readiness_score := v_readiness_score + 15; END IF;
    IF v_has_menu THEN v_readiness_score := v_readiness_score + 25; END IF;
    IF v_has_opening_hours THEN v_readiness_score := v_readiness_score + 10; END IF;
    IF v_has_logo THEN v_readiness_score := v_readiness_score + 10; END IF;
    IF v_has_cover_image THEN v_readiness_score := v_readiness_score + 10; END IF;
    IF v_has_payout_destination THEN v_readiness_score := v_readiness_score + 10; END IF;
    IF v_business_verified THEN v_readiness_score := v_readiness_score + 5; END IF;

    RETURN jsonb_build_object(
        'restaurant_id', p_restaurant_id,
        'business_verified', v_business_verified,
        'has_active_branch', v_has_active_branch,
        'branch_has_coordinates', v_branch_has_coords,
        'has_opening_hours', v_has_opening_hours,
        'has_logo', v_has_logo,
        'has_cover_image', v_has_cover_image,
        'has_storefront_image', v_has_storefront_image,
        'has_verified_contact', v_has_verified_contact,
        'has_menu', v_has_menu,
        'menu_item_count', v_menu_item_count,
        'menu_items_with_images', v_menu_items_with_images,
        'has_payout_destination', v_has_payout_destination,
        'delivery_configured', v_delivery_configured,
        'readiness_percent', LEAST(100, ROUND(v_readiness_score)),
        'missing_requirements', v_missing,
        'can_submit_for_review', v_can_submit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_restaurant_launch_readiness(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_launch_readiness(VARCHAR) TO authenticated, service_role;

COMMIT;
