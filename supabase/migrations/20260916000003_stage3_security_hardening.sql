-- ============================================================================
-- MLOHUB STAGE 3: PRODUCTION-GRADE DATABASE SECURITY & TENANT ISOLATION
-- Migration Version: 20260916000003
-- Description: Enforces Row Level Security correctness, multi-tenant restaurant
--              isolation, platform role isolation, database constraints,
--              last-owner protection, server-side trusted pricing, order
--              state machine validation, immutable snapshots, and privileged RPCs.
-- ============================================================================

-- 1. EXTENSIONS & SEARCH PATH LOCK
SET search_path = public, pg_temp;

-- 2. CANONICAL RESTAURANT ROLE ENUM & PERMISSION MODEL
-- Ensure restaurant membership roles: OWNER, MANAGER, CHEF, STAFF
DO $$ BEGIN
    CREATE TYPE restaurant_member_role_enum AS ENUM (
        'OWNER',
        'MANAGER',
        'CHEF',
        'STAFF'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. SECURITY DEFINER HELPER FUNCTIONS WITH SEARCH_PATH LOCKED
-- ----------------------------------------------------------------------------

-- Check if user is Admin or Super Admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
        AND (
            role = 'ADMIN' 
            OR role = 'SUPER_ADMIN' 
            OR 'ADMIN' = ANY(roles) 
            OR 'SUPER_ADMIN' = ANY(roles)
            OR account_type = 'ADMIN'
            OR account_type = 'SUPER_ADMIN'
        )
        AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
        AND (role = 'SUPER_ADMIN' OR 'SUPER_ADMIN' = ANY(roles) OR account_type = 'SUPER_ADMIN')
        AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if user is active member of restaurant (supports OWNER, MANAGER, CHEF, STAFF)
CREATE OR REPLACE FUNCTION public.is_restaurant_member(p_user_id UUID, p_restaurant_id VARCHAR(80))
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL OR p_restaurant_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = p_user_id
        AND restaurant_id = p_restaurant_id
        AND is_active = TRUE
        AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if user holds a specific restaurant membership role
CREATE OR REPLACE FUNCTION public.has_restaurant_role(
    p_user_id UUID,
    p_restaurant_id VARCHAR(80),
    p_allowed_roles VARCHAR[]
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL OR p_restaurant_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = p_user_id
        AND restaurant_id = p_restaurant_id
        AND is_active = TRUE
        AND status = 'ACTIVE'
        AND role = ANY(p_allowed_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Check granular restaurant permission
CREATE OR REPLACE FUNCTION public.has_restaurant_permission(
    p_user_id UUID,
    p_restaurant_id VARCHAR(80),
    p_permission VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_member_role VARCHAR(30);
    v_member_perms TEXT[];
BEGIN
    IF p_user_id IS NULL OR p_restaurant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admins bypass tenant checks
    IF public.is_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    SELECT role, permissions INTO v_member_role, v_member_perms
    FROM public.restaurant_members
    WHERE user_id = p_user_id
    AND restaurant_id = p_restaurant_id
    AND is_active = TRUE
    AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- OWNER has all permissions
    IF v_member_role = 'OWNER' THEN
        RETURN TRUE;
    END IF;

    -- MANAGER defaults
    IF v_member_role = 'MANAGER' THEN
        IF p_permission IN (
            'VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS',
            'VIEW_MENU', 'MANAGE_MENU', 'VERIFY_MENU',
            'VIEW_RESERVATIONS', 'MANAGE_RESERVATIONS',
            'VIEW_REVIEWS', 'VIEW_ANALYTICS', 'VIEW_EARNINGS'
        ) THEN
            RETURN TRUE;
        END IF;
        -- Explicit custom permission check (e.g. MANAGE_STAFF)
        IF v_member_perms IS NOT NULL AND p_permission = ANY(v_member_perms) THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    -- CHEF defaults
    IF v_member_role = 'CHEF' THEN
        IF p_permission IN ('VIEW_DASHBOARD', 'VIEW_ORDERS', 'MANAGE_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS') THEN
            RETURN TRUE;
        END IF;
        IF v_member_perms IS NOT NULL AND p_permission = ANY(v_member_perms) THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    -- STAFF defaults
    IF v_member_role = 'STAFF' THEN
        IF p_permission IN ('VIEW_DASHBOARD', 'VIEW_ORDERS', 'VIEW_MENU', 'VIEW_RESERVATIONS') THEN
            RETURN TRUE;
        END IF;
        IF v_member_perms IS NOT NULL AND p_permission = ANY(v_member_perms) THEN
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 4. PROFILE UPDATE HARDENING (PREVENT PRIVILEGE ESCALATION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- If caller is not Admin, strictly block changing privileged columns
    IF NOT public.is_admin(auth.uid()) THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your platform role.';
        END IF;
        IF NEW.roles IS DISTINCT FROM OLD.roles THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your role list.';
        END IF;
        IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your account type.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your account status.';
        END IF;
        IF NEW.is_phone_verified IS DISTINCT FROM OLD.is_phone_verified THEN
            RAISE EXCEPTION '403 Forbidden: Phone verification status must be updated via server.';
        END IF;
        IF NEW.is_email_verified IS DISTINCT FROM OLD.is_email_verified THEN
            RAISE EXCEPTION '403 Forbidden: Email verification status must be updated via server.';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- ----------------------------------------------------------------------------
-- 5. RESTAURANT MEMBERSHIP SAFEGUARDS (LAST OWNER DEFENSE & RBAC)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_restaurant_membership()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_count INTEGER;
    v_target_rest_id VARCHAR(80);
BEGIN
    v_target_rest_id := COALESCE(OLD.restaurant_id, NEW.restaurant_id);

    -- 1. Prevent deleting or demoting the last active OWNER
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (NEW.is_active = FALSE OR NEW.status != 'ACTIVE' OR NEW.role != 'OWNER') AND OLD.role = 'OWNER') THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.restaurant_members
        WHERE restaurant_id = v_target_rest_id
        AND role = 'OWNER'
        AND is_active = TRUE
        AND status = 'ACTIVE'
        AND id != OLD.id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION '403 Forbidden: Cannot remove, deactivate, or demote the sole remaining active OWNER of restaurant %', v_target_rest_id;
        END IF;
    END IF;

    -- 2. Non-admins cannot insert or update membership unless they have MANAGE_STAFF permission
    IF TG_OP = 'INSERT' THEN
        IF NOT public.is_admin(auth.uid()) AND NOT public.has_restaurant_permission(auth.uid(), NEW.restaurant_id, 'MANAGE_STAFF') THEN
            RAISE EXCEPTION '403 Forbidden: You do not have permission to add staff to this restaurant.';
        END IF;
        -- User cannot assign themselves as OWNER unless Admin or trusted onboarder
        IF NEW.user_id = auth.uid() AND NEW.role = 'OWNER' AND NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION '403 Forbidden: You cannot assign yourself as OWNER.';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_restaurant_membership ON public.restaurant_members;
CREATE TRIGGER trg_protect_restaurant_membership
    BEFORE INSERT OR UPDATE OR DELETE ON public.restaurant_members
    FOR EACH ROW EXECUTE FUNCTION public.protect_restaurant_membership();

-- ----------------------------------------------------------------------------
-- 6. MENU VERIFICATION ENHANCEMENT (RESTAURANT + ADMIN VERIFICATION)
-- ----------------------------------------------------------------------------

-- Add verification_source column
ALTER TABLE public.menu_verifications 
ADD COLUMN IF NOT EXISTS verification_source VARCHAR(30) DEFAULT 'RESTAURANT' 
CHECK (verification_source IN ('RESTAURANT', 'ADMIN', 'SYSTEM'));

-- Policy: Owners/Managers with VERIFY_MENU can verify their own restaurant's items; Admins can verify any
DROP POLICY IF EXISTS "Admins manage verifications" ON public.menu_verifications;
DROP POLICY IF EXISTS "Public view verifications" ON public.menu_verifications;

CREATE POLICY "Public view verifications" ON public.menu_verifications
    FOR SELECT USING (TRUE);

CREATE POLICY "Authorized members and admins create verifications" ON public.menu_verifications
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid())
        OR (
            verification_source = 'RESTAURANT'
            AND public.has_restaurant_permission(
                auth.uid(),
                (SELECT restaurant_id FROM public.menu_items WHERE id = menu_item_id),
                'VERIFY_MENU'
            )
        )
    );

-- ----------------------------------------------------------------------------
-- 7. CUSTOMER DATA REPORTS (SEPARATED FROM VERIFIED TRUTH)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.data_reports (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rep_' || substr(md5(random()::text), 1, 16),
    reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    menu_item_id VARCHAR(80) REFERENCES public.menu_items(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'WRONG_PRICE',
        'ITEM_UNAVAILABLE',
        'WRONG_HOURS',
        'WRONG_LOCATION',
        'RESTAURANT_CLOSED',
        'OTHER'
    )),
    message TEXT NOT NULL,
    reported_value TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_reports_restaurant ON public.data_reports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_reporter ON public.data_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON public.data_reports(status);

ALTER TABLE public.data_reports ENABLE ROW LEVEL SECURITY;

-- Customers can submit reports and read their own reports
DROP POLICY IF EXISTS "Customers submit reports" ON public.data_reports;
CREATE POLICY "Customers submit reports" ON public.data_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Customers view own reports" ON public.data_reports;
CREATE POLICY "Customers view own reports" ON public.data_reports
    FOR SELECT USING (
        auth.uid() = reporter_user_id
        OR public.is_restaurant_member(auth.uid(), restaurant_id)
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Admins manage reports" ON public.data_reports;
CREATE POLICY "Admins manage reports" ON public.data_reports
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 8. ORDER CREATION WITH SERVER-SIDE TRUSTED PRICING (RPC)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_branch_id UUID,
    p_items JSONB,
    p_fulfillment_type VARCHAR(30) DEFAULT 'Delivery',
    p_delivery_address TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_restaurant_id VARCHAR(80);
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_subtotal INTEGER := 0;
    v_service_fee INTEGER := 1500;
    v_delivery_fee INTEGER := 0;
    v_total INTEGER := 0;
    v_item RECORD;
    v_trusted_price INTEGER;
    v_item_name TEXT;
    v_is_available BOOLEAN;
    v_is_archived BOOLEAN;
    v_line_subtotal INTEGER;
    v_items_count INTEGER := 0;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

    -- 2. Resolve restaurant from branch
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Active restaurant branch % not found.', p_branch_id;
    END IF;

    -- Delivery fee calculation
    IF p_fulfillment_type = 'Delivery' THEN
        v_delivery_fee := 2500;
    END IF;

    v_order_id := 'ord_' || substr(md5(random()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 4);

    -- 3. Validate each item and calculate trusted subtotal
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION '400 Bad Request: Quantity must be at least 1.';
        END IF;

        -- Check branch-specific price first, fallback to base menu price
        SELECT 
            COALESCE(bmi.price_tzs, mi.price_tzs),
            mi.name_en,
            COALESCE(bmi.is_available, mi.is_available),
            mi.is_archived
        INTO v_trusted_price, v_item_name, v_is_available, v_is_archived
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id AND mi.restaurant_id = v_restaurant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '404 Not Found: Dish % not found at this restaurant.', v_item.menu_item_id;
        END IF;

        IF v_is_archived THEN
            RAISE EXCEPTION '400 Bad Request: Dish % is no longer on the menu.', v_item_name;
        END IF;

        IF NOT v_is_available THEN
            RAISE EXCEPTION '400 Bad Request: Dish % is currently sold out.', v_item_name;
        END IF;

        v_line_subtotal := v_trusted_price * v_item.quantity;
        v_subtotal := v_subtotal + v_line_subtotal;
        v_items_count := v_items_count + 1;
    END LOOP;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Order must contain at least 1 item.';
    END IF;

    v_total := v_subtotal + v_service_fee + v_delivery_fee;

    -- 4. Insert Order Header
    INSERT INTO public.orders (
        id,
        order_number,
        user_id,
        restaurant_id,
        branch_id,
        status,
        payment_status,
        subtotal_tzs,
        service_fee_tzs,
        delivery_fee_tzs,
        total_tzs,
        dining_option,
        delivery_address,
        special_instructions,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        v_user_id,
        v_restaurant_id,
        p_branch_id,
        'PENDING',
        'PENDING',
        v_subtotal,
        v_service_fee,
        v_delivery_fee,
        v_total,
        p_fulfillment_type,
        p_delivery_address,
        p_special_instructions,
        NOW(),
        NOW()
    );

    -- 5. Insert Immutable Order Line Items Snapshots
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        SELECT 
            COALESCE(bmi.price_tzs, mi.price_tzs),
            mi.name_en
        INTO v_trusted_price, v_item_name
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id;

        INSERT INTO public.order_items (
            id,
            order_id,
            menu_item_id,
            item_name,
            item_name_snapshot,
            unit_price_tzs,
            price_snapshot,
            quantity,
            total_price_tzs,
            special_notes
        ) VALUES (
            'item_ord_' || substr(md5(random()::text), 1, 16),
            v_order_id,
            v_item.menu_item_id,
            v_item_name,
            v_item_name,
            v_trusted_price,
            v_trusted_price,
            v_item.quantity,
            v_trusted_price * v_item.quantity,
            v_item.special_notes
        );
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'restaurant_id', v_restaurant_id,
        'subtotal_tzs', v_subtotal,
        'service_fee_tzs', v_service_fee,
        'delivery_fee_tzs', v_delivery_fee,
        'total_tzs', v_total,
        'status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 9. ORDER STATE MACHINE & IMMUTABILITY ENFORCEMENT TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Valid state transitions
    IF OLD.status = 'PENDING' AND NEW.status IN ('ACCEPTED', 'REJECTED', 'CANCELLED') THEN
        IF NEW.status = 'ACCEPTED' THEN NEW.accepted_at := NOW(); END IF;
        IF NEW.status IN ('REJECTED', 'CANCELLED') THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'ACCEPTED' AND NEW.status IN ('PREPARING', 'CANCELLED') THEN
        IF NEW.status = 'CANCELLED' THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'PREPARING' AND NEW.status IN ('READY', 'CANCELLED') THEN
        IF NEW.status = 'READY' THEN NEW.ready_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'READY' AND NEW.status = 'COMPLETED' THEN
        NEW.completed_at := NOW();
        RETURN NEW;
    ELSIF OLD.status = NEW.status THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from % to %', OLD.status, NEW.status;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_check_order_status_transition ON public.orders;
CREATE TRIGGER trg_check_order_status_transition
    BEFORE UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.check_order_status_transition();

-- Enforce Order Items Immutability
CREATE OR REPLACE FUNCTION public.prevent_order_items_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Order line item snapshots are permanently immutable.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_order_items_tampering ON public.order_items;
CREATE TRIGGER trg_prevent_order_items_tampering
    BEFORE UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.prevent_order_items_tampering();

-- ----------------------------------------------------------------------------
-- 10. REVIEW INTEGRITY: VERIFIED COMPLETED ORDER CONSTRAINT
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_review_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- 1. Ensure order exists, belongs to caller, is COMPLETED, and matches restaurant
    SELECT user_id, restaurant_id, status INTO v_order
    FROM public.orders
    WHERE id = NEW.order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '400 Bad Request: Referenced order does not exist.';
    END IF;

    IF v_order.user_id != auth.uid() THEN
        RAISE EXCEPTION '403 Forbidden: You can only review orders you placed personally.';
    END IF;

    IF v_order.status != 'COMPLETED' THEN
        RAISE EXCEPTION '400 Bad Request: You can only review after the order is completed.';
    END IF;

    IF v_order.restaurant_id != NEW.restaurant_id THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant mismatch between order and review.';
    END IF;

    -- 2. Edit window check: only author can edit within 24 hours
    IF TG_OP = 'UPDATE' THEN
        IF auth.uid() != OLD.user_id AND NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION '403 Forbidden: Only the review author or admin can modify this review.';
        END IF;
        IF (NOW() - OLD.created_at) > INTERVAL '24 hours' AND NOT public.is_admin(auth.uid()) THEN
            RAISE EXCEPTION '403 Forbidden: Reviews can only be edited within 24 hours of submission.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_verify_review_eligibility ON public.reviews;
CREATE TRIGGER trg_verify_review_eligibility
    BEFORE INSERT OR UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.verify_review_eligibility();

-- ----------------------------------------------------------------------------
-- 11. PAYMENT STATUS INTEGRITY
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only service role / admin can update payment status to SUCCESS or REFUNDED
    IF NOT public.is_admin(auth.uid()) AND current_user != 'service_role' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION '403 Forbidden: Payment statuses can only be finalized by the payment gateway webhook.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_payment_status ON public.payments;
CREATE TRIGGER trg_protect_payment_status
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.protect_payment_status();

-- ----------------------------------------------------------------------------
-- 12. PRIVILEGED ADMINISTRATIVE RPCS (SEARCH_PATH LOCKED)
-- ----------------------------------------------------------------------------

-- Approve vendor application and activate restaurant
CREATE OR REPLACE FUNCTION public.approve_restaurant_application(p_application_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_app RECORD;
    v_rest_id VARCHAR(80);
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    UPDATE public.restaurant_applications
    SET status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
    WHERE id = p_application_id;

    -- Ensure restaurant record is verified
    v_rest_id := lower(regexp_replace(v_app.business_name, '[^a-zA-Z0-9]+', '-', 'g'));
    
    INSERT INTO public.restaurants (
        id, owner_id, name, slug, cuisine, address, neighborhood, is_verified, verification_status, updated_at
    ) VALUES (
        v_rest_id, v_app.applicant_user_id, v_app.business_name, v_rest_id, v_app.cuisine_type, v_app.address, v_app.neighborhood, TRUE, 'VERIFIED', NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        is_verified = TRUE,
        verification_status = 'VERIFIED';

    -- Ensure applicant is assigned OWNER
    IF v_app.applicant_user_id IS NOT NULL THEN
        INSERT INTO public.restaurant_members (
            user_id, restaurant_id, role, is_primary_owner, is_active, status
        ) VALUES (
            v_app.applicant_user_id, v_rest_id, 'OWNER', TRUE, TRUE, 'ACTIVE'
        ) ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
            role = 'OWNER', is_active = TRUE, status = 'ACTIVE';
    END IF;

    -- Log to audit
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'APPROVE_APPLICATION', 'APPLICATION', p_application_id, jsonb_build_object('restaurant_id', v_rest_id));

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', v_rest_id, 'status', 'APPROVED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Reject vendor application
CREATE OR REPLACE FUNCTION public.reject_restaurant_application(p_application_id VARCHAR(80), p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
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

-- Suspend restaurant
CREATE OR REPLACE FUNCTION public.suspend_restaurant(p_restaurant_id VARCHAR(80), p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    UPDATE public.restaurants
    SET is_open = FALSE, is_verified = FALSE, verification_status = 'SUSPENDED', updated_at = NOW()
    WHERE id = p_restaurant_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'SUSPEND_RESTAURANT', 'RESTAURANT', p_restaurant_id, jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'status', 'SUSPENDED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Reactivate restaurant
CREATE OR REPLACE FUNCTION public.reactivate_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    UPDATE public.restaurants
    SET is_open = TRUE, is_verified = TRUE, verification_status = 'VERIFIED', updated_at = NOW()
    WHERE id = p_restaurant_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'REACTIVATE_RESTAURANT', 'RESTAURANT', p_restaurant_id, jsonb_build_object('action', 'reactivated'));

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id, 'status', 'VERIFIED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Promote platform role (Super Admin only for Super Admin role)
CREATE OR REPLACE FUNCTION public.change_platform_role(
    p_target_user_id UUID,
    p_new_role user_role_enum,
    p_new_account_type VARCHAR(30)
)
RETURNS JSONB AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- Elevating to SUPER_ADMIN requires caller to already be SUPER_ADMIN
    IF (p_new_role = 'SUPER_ADMIN' OR p_new_account_type = 'SUPER_ADMIN') AND NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Only a Super Admin can promote a user to Super Admin.';
    END IF;

    UPDATE public.profiles
    SET role = p_new_role,
        roles = ARRAY[p_new_role],
        account_type = p_new_account_type,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'CHANGE_ROLE', 'USER', p_target_user_id::text, jsonb_build_object('new_role', p_new_role, 'new_account_type', p_new_account_type));

    RETURN jsonb_build_object('success', TRUE, 'user_id', p_target_user_id, 'role', p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 13. CHECK CONSTRAINTS ACROSS TABLES
-- ----------------------------------------------------------------------------

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS chk_reviews_rating_range;
ALTER TABLE public.reviews ADD CONSTRAINT chk_reviews_rating_range CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_price_nonneg;
ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_price_nonneg CHECK (price_tzs >= 0);

ALTER TABLE public.branch_menu_items DROP CONSTRAINT IF EXISTS chk_branch_menu_items_price_nonneg;
ALTER TABLE public.branch_menu_items ADD CONSTRAINT chk_branch_menu_items_price_nonneg CHECK (price_tzs IS NULL OR price_tzs >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_total_nonneg;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_total_nonneg CHECK (total_tzs >= 0 AND subtotal_tzs >= 0);

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS chk_order_items_qty_positive;
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_qty_positive CHECK (quantity > 0 AND price_snapshot >= 0);

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS chk_reservations_party_size_positive;
ALTER TABLE public.reservations ADD CONSTRAINT chk_reservations_party_size_positive CHECK (party_size > 0);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_amount_nonneg;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_amount_nonneg CHECK (amount_tzs >= 0);

-- Coords
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS chk_restaurants_lat_range;
ALTER TABLE public.restaurants ADD CONSTRAINT chk_restaurants_lat_range CHECK (lat IS NULL OR (lat >= -90.0 AND lat <= 90.0));

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS chk_restaurants_lng_range;
ALTER TABLE public.restaurants ADD CONSTRAINT chk_restaurants_lng_range CHECK (lng IS NULL OR (lng >= -180.0 AND lng <= 180.0));

-- ----------------------------------------------------------------------------
-- 14. UPDATED RLS POLICIES FOR REVISED ROLES & TENANT ISOLATION
-- ----------------------------------------------------------------------------

-- Orders RLS
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant members view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;

CREATE POLICY "Orders read policy" ON public.orders
    FOR SELECT USING (
        auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_ORDERS')
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Orders update policy" ON public.orders
    FOR UPDATE USING (
        (auth.uid() = user_id AND status = 'PENDING')
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_ORDERS')
        OR public.is_admin(auth.uid())
    );

-- Reservations RLS
DROP POLICY IF EXISTS "Reservations read policy" ON public.reservations;
CREATE POLICY "Reservations read policy" ON public.reservations
    FOR SELECT USING (
        auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Reservations update policy" ON public.reservations;
CREATE POLICY "Reservations update policy" ON public.reservations
    FOR UPDATE USING (
        auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_RESERVATIONS')
        OR public.is_admin(auth.uid())
    );

-- Menu Items RLS
DROP POLICY IF EXISTS "Menu items read policy" ON public.menu_items;
CREATE POLICY "Menu items read policy" ON public.menu_items
    FOR SELECT USING (
        (is_available = TRUE AND is_archived = FALSE)
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_MENU')
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Menu items insert policy" ON public.menu_items;
CREATE POLICY "Menu items insert policy" ON public.menu_items
    FOR INSERT WITH CHECK (
        public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_MENU')
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Menu items update policy" ON public.menu_items;
CREATE POLICY "Menu items update policy" ON public.menu_items
    FOR UPDATE USING (
        public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_MENU')
        OR public.is_admin(auth.uid())
    );

-- Audit logs immutability (No direct client insert, update, or delete)
DROP POLICY IF EXISTS "Audit logs read policy" ON public.audit_logs;
CREATE POLICY "Audit logs read policy" ON public.audit_logs
    FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Block direct audit log edits" ON public.audit_logs;
-- No INSERT, UPDATE, or DELETE policies created for public users (system functions insert directly)

-- ----------------------------------------------------------------------------
-- 15. STORAGE BUCKET TENANT ISOLATION
-- ----------------------------------------------------------------------------

-- Private verification documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Storage object policies
DROP POLICY IF EXISTS "Restaurant banners tenant upload" ON storage.objects;
CREATE POLICY "Restaurant banners tenant upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'restaurant-images'
        AND (
            public.has_restaurant_permission(auth.uid(), (storage.foldername(name))[1], 'MANAGE_RESTAURANT')
            OR public.is_admin(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Menu photos tenant upload" ON storage.objects;
CREATE POLICY "Menu photos tenant upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'menu-images'
        AND (
            public.has_restaurant_permission(auth.uid(), (storage.foldername(name))[1], 'MANAGE_MENU')
            OR public.is_admin(auth.uid())
        )
    );

DROP POLICY IF EXISTS "Profile avatars user upload" ON storage.objects;
CREATE POLICY "Profile avatars user upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Verification documents upload" ON storage.objects;
CREATE POLICY "Verification documents upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'verification-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Verification documents read restricted" ON storage.objects;
CREATE POLICY "Verification documents read restricted" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'verification-documents'
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
    );
