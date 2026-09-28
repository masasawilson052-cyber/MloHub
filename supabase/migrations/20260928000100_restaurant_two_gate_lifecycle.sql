-- ============================================================================
-- MLOHUB RESTAURANT PHASE 1: TWO-GATE ONBOARDING & STORE LAUNCH CONTROL
-- Migration: 20260928000100_restaurant_two_gate_lifecycle.sql
-- ============================================================================
-- Establishes:
-- 1. Two-Gate Lifecycle: Gate A (Merchant Approval) & Gate B (Store Go-Live Launch)
-- 2. launch_status column on public.restaurants with rigorous check constraints
-- 3. public.restaurant_verification_documents model for legal compliance
-- 4. Private storage bucket 'merchant-verification' with strict RLS (no public access)
-- 5. Updated approve_restaurant_application() RPC (Merchant Approved -> SETUP_REQUIRED, unpublished)
-- 6. Application changes requested RPC (request_restaurant_application_changes)
-- 7. Store readiness validation RPC (get_restaurant_launch_readiness)
-- 8. Owner submission for go-live review RPC (submit_restaurant_for_launch_review)
-- 9. Admin Go-Live launch approval RPC (approve_restaurant_launch) with AAL2
-- 10. Admin Go-Live corrections RPC (request_restaurant_launch_corrections) with AAL2
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND RESTAURANTS WITH LAUNCH_STATUS
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS launch_status TEXT NOT NULL DEFAULT 'SETUP_REQUIRED';

ALTER TABLE public.restaurants
DROP CONSTRAINT IF EXISTS restaurants_launch_status_check;

ALTER TABLE public.restaurants
ADD CONSTRAINT restaurants_launch_status_check
CHECK (
  launch_status IN (
    'SETUP_REQUIRED',
    'SETUP_IN_PROGRESS',
    'READY_FOR_REVIEW',
    'GO_LIVE_REVIEW',
    'CORRECTIONS_REQUIRED',
    'APPROVED_FOR_LAUNCH',
    'PUBLISHED',
    'SUSPENDED'
  )
);

-- Backfill existing published and verified restaurants
UPDATE public.restaurants
SET launch_status = 'PUBLISHED'
WHERE is_published = TRUE AND is_verified = TRUE;

-- ----------------------------------------------------------------------------
-- 2. EXTEND RESTAURANT APPLICATIONS STATUS
-- ----------------------------------------------------------------------------
ALTER TABLE public.restaurant_applications
DROP CONSTRAINT IF EXISTS restaurant_applications_status_check;

ALTER TABLE public.restaurant_applications
ADD CONSTRAINT restaurant_applications_status_check
CHECK (
  status IN (
    'DRAFT',
    'PENDING',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'REJECTED'
  )
);

-- ----------------------------------------------------------------------------
-- 3. CREATE MERCHANT VERIFICATION DOCUMENT MODEL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id VARCHAR(80) REFERENCES public.restaurant_applications(id) ON DELETE CASCADE,
  restaurant_id VARCHAR(80) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  CONSTRAINT chk_rvd_doc_type CHECK (
    document_type IN (
      'BUSINESS_LICENSE',
      'TIN_DOCUMENT',
      'OWNER_IDENTITY',
      'FOOD_OPERATION_DOCUMENT',
      'STOREFRONT_PROOF',
      'OTHER'
    )
  ),
  CONSTRAINT chk_rvd_verif_status CHECK (
    verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_rvd_owner ON public.restaurant_verification_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rvd_app ON public.restaurant_verification_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_rvd_rest ON public.restaurant_verification_documents(restaurant_id);

ALTER TABLE public.restaurant_verification_documents ENABLE ROW LEVEL SECURITY;

-- Applicant: SELECT own documents or platform admin
DROP POLICY IF EXISTS rvd_applicant_select ON public.restaurant_verification_documents;
CREATE POLICY rvd_applicant_select ON public.restaurant_verification_documents
FOR SELECT TO authenticated
USING (owner_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Applicant: INSERT own documents before final verification
DROP POLICY IF EXISTS rvd_applicant_insert ON public.restaurant_verification_documents;
CREATE POLICY rvd_applicant_insert ON public.restaurant_verification_documents
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- Admin: UPDATE all
DROP POLICY IF EXISTS rvd_admin_update ON public.restaurant_verification_documents;
CREATE POLICY rvd_admin_update ON public.restaurant_verification_documents
FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Admin: DELETE
DROP POLICY IF EXISTS rvd_admin_delete ON public.restaurant_verification_documents;
CREATE POLICY rvd_admin_delete ON public.restaurant_verification_documents
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. PRIVATE STORAGE BUCKET: merchant-verification (NO PUBLIC ACCESS)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-verification',
  'merchant-verification',
  FALSE,
  10485760, -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Storage object policies for merchant-verification
DROP POLICY IF EXISTS "Merchant verification documents are uploadable by owner" ON storage.objects;
CREATE POLICY "Merchant verification documents are uploadable by owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'merchant-verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Merchant verification documents are readable by owner or admin" ON storage.objects;
CREATE POLICY "Merchant verification documents are readable by owner or admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'merchant-verification' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    public.is_admin(auth.uid())
  )
);

-- ----------------------------------------------------------------------------
-- 5. GATE A: APPROVE RESTAURANT APPLICATION (MERCHANT APPROVAL ONLY)
-- Initial approval grants merchant membership but NEVER publishes store.
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
    WHERE application_id = p_application_id AND (restaurant_id IS NULL OR restaurant_id = '');

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
-- 6. REQUEST RESTAURANT APPLICATION CHANGES RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_restaurant_application_changes(
    p_application_id VARCHAR(80),
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_app RECORD;
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Correction reason is required.';
    END IF;

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    UPDATE public.restaurant_applications
    SET status = 'CHANGES_REQUESTED',
        rejection_reason = trim(p_reason),
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(),
        'REQUEST_APPLICATION_CHANGES',
        'APPLICATION',
        p_application_id,
        jsonb_build_object(
            'reason', trim(p_reason),
            'applicant_user_id', v_app.applicant_user_id,
            'business_name', v_app.business_name
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'application_id', p_application_id,
        'status', 'CHANGES_REQUESTED',
        'reason', trim(p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.request_restaurant_application_changes(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_restaurant_application_changes(VARCHAR, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. STORE SETUP READINESS RPC
-- Evaluates restaurant readiness for launch review.
-- Readiness percent alone does NOT authorize publication.
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
          AND latitude IS NOT NULL AND longitude IS NOT NULL
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

    -- 7. Verified contact check
    v_has_verified_contact := (
        v_rest.phone IS NOT NULL AND length(trim(v_rest.phone)) > 6
    );

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
    v_has_payout_destination := (
        v_rest.payout_phone_number IS NOT NULL AND length(trim(v_rest.payout_phone_number)) > 6
    );

    -- 11. Delivery pricing configuration
    SELECT EXISTS (
        SELECT 1 FROM public.branch_delivery_pricing bdp
        JOIN public.restaurant_branches rb ON rb.id = bdp.branch_id
        WHERE rb.restaurant_id = p_restaurant_id AND bdp.configuration_confirmed = TRUE
    ) INTO v_delivery_configured;

    -- 12. Business verified check
    v_business_verified := (
        v_rest.is_verified = TRUE OR
        (v_rest.tin_number IS NOT NULL AND length(trim(v_rest.tin_number)) > 0)
    );

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

GRANT EXECUTE ON FUNCTION public.get_restaurant_launch_readiness(VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. SUBMIT RESTAURANT FOR LAUNCH REVIEW (GATE B SUBMISSION)
-- Owner / Manager only. Validates mandatory readiness and transitions to GO_LIVE_REVIEW.
-- Does NOT publish or open the restaurant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_restaurant_for_launch_review(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_is_member BOOLEAN;
    v_readiness JSONB;
BEGIN
    -- Check permissions: caller must be member (OWNER or MANAGER) or platform admin
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = auth.uid()
          AND is_active = TRUE
          AND role IN ('OWNER', 'MANAGER')
    ) INTO v_is_member;

    IF NOT v_is_member AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Only restaurant owners or managers can submit for launch review.';
    END IF;

    -- Validate readiness
    v_readiness := public.get_restaurant_launch_readiness(p_restaurant_id);
    IF NOT (v_readiness->>'can_submit_for_review')::BOOLEAN THEN
        RAISE EXCEPTION '400 Bad Request: Mandatory launch prerequisites not met: %', v_readiness->>'missing_requirements';
    END IF;

    -- Transition to GO_LIVE_REVIEW
    UPDATE public.restaurants
    SET launch_status = 'GO_LIVE_REVIEW',
        is_published = FALSE,
        is_open = FALSE,
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    -- Audit log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(),
        'SUBMIT_LAUNCH_REVIEW',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'readiness_percent', v_readiness->'readiness_percent',
            'submitted_by', auth.uid()
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'status', 'GO_LIVE_REVIEW',
        'message', 'Store submitted for administrator go-live launch review'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.submit_restaurant_for_launch_review(VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. REPLACE LEGACY publish_restaurant
-- Ensure self-publishing is strictly routed to launch review, NEVER direct public exposure.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
BEGIN
    -- Delegate to submit_restaurant_for_launch_review so owner cannot self-publish
    RETURN public.submit_restaurant_for_launch_review(p_restaurant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.publish_restaurant(VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. ADMIN GO-LIVE APPROVAL (GATE B: STORE LAUNCH APPROVAL)
-- Admin / AAL2 required.
-- Sets is_verified = TRUE, verification_status = 'VERIFIED',
-- launch_status = 'PUBLISHED', is_published = TRUE, is_active = TRUE.
-- IMPORTANT: is_open = FALSE (Operating hours and overrides determine open status).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_restaurant_launch(
    p_restaurant_id VARCHAR(80),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_rest RECORD;
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    -- Gate B Approval: Sets publication and verified status
    UPDATE public.restaurants
    SET is_verified = TRUE,
        verification_status = 'VERIFIED',
        launch_status = 'PUBLISHED',
        is_published = TRUE,
        is_active = TRUE,
        is_open = FALSE,   -- NEVER force open; opening hours determine daily operational state
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    -- Audit log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(),
        'APPROVE_RESTAURANT_LAUNCH',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'notes', p_notes,
            'approved_by', auth.uid(),
            'launch_status', 'PUBLISHED'
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'launch_status', 'PUBLISHED',
        'is_published', TRUE,
        'is_open', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_restaurant_launch(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_restaurant_launch(VARCHAR, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. ADMIN LAUNCH CORRECTIONS RPC
-- Admin / AAL2 required.
-- Sets launch_status = 'CORRECTIONS_REQUIRED', is_published = FALSE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_restaurant_launch_corrections(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_rest RECORD;
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Correction reason is required.';
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    UPDATE public.restaurants
    SET launch_status = 'CORRECTIONS_REQUIRED',
        is_published = FALSE,
        is_open = FALSE,
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(),
        'REQUEST_RESTAURANT_LAUNCH_CORRECTIONS',
        'RESTAURANT',
        p_restaurant_id,
        jsonb_build_object(
            'reason', trim(p_reason),
            'admin_id', auth.uid()
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'launch_status', 'CORRECTIONS_REQUIRED',
        'reason', trim(p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.request_restaurant_launch_corrections(VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_restaurant_launch_corrections(VARCHAR, TEXT) TO authenticated, service_role;
