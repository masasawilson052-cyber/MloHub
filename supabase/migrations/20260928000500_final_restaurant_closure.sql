-- Final closure: apply in staging first; requires Supabase Vault + pgcrypto.
BEGIN;
CREATE OR REPLACE FUNCTION public.encrypt_merchant_payout_reference(p_value TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_key TEXT;
BEGIN
 SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name='mlohub_payout_encryption_key';
 IF v_key IS NULL OR length(v_key)<32 THEN RAISE EXCEPTION 'Payout encryption key is not configured in Vault'; END IF;
 RETURN 'pgp:v1:' || encode(extensions.pgp_sym_encrypt(p_value,v_key,'cipher-algo=aes256,compress-algo=0'),'base64');
END; $$;
REVOKE ALL ON FUNCTION public.encrypt_merchant_payout_reference(TEXT) FROM PUBLIC,anon,authenticated;
-- Encrypt legacy records inside the transaction; never mark their ownership verified.
UPDATE public.merchant_payout_destinations SET verification_status='PENDING_VERIFICATION'
WHERE id IN (SELECT destination_id FROM public.merchant_payout_destination_secrets WHERE encrypted_account_reference NOT LIKE 'pgp:v1:%');
UPDATE public.merchant_payout_destination_secrets SET encrypted_account_reference=public.encrypt_merchant_payout_reference(encrypted_account_reference)
WHERE encrypted_account_reference NOT LIKE 'pgp:v1:%';
CREATE OR REPLACE FUNCTION public.create_payout_destination_secure(
    p_restaurant_id VARCHAR(80),
    p_destination_type VARCHAR(50),
    p_provider VARCHAR(50),
    p_masked_identifier VARCHAR(50),
    p_account_name VARCHAR(150),
    p_raw_identifier TEXT,
    p_is_default BOOLEAN DEFAULT FALSE,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_dest_id UUID;
    v_dest_type public.payout_destination_type_enum;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only payout creation'; END IF;
    v_caller_id := p_created_by;
    IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authenticated creator required'; END IF;
    PERFORM 1 FROM public.restaurants WHERE id=p_restaurant_id FOR UPDATE;

    -- 1. Authorization: service_role, platform admin, or restaurant OWNER / permitted MANAGER
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSIF public.is_admin(v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = p_restaurant_id
              AND user_id = v_caller_id
              AND is_active = TRUE
              AND (
                  role = 'OWNER'
                  OR (role = 'MANAGER' AND (
                      'ALL' = ANY(permissions)
                      OR 'FINANCE' = ANY(permissions)
                      OR 'MANAGE_FINANCE' = ANY(permissions)
                  ))
              )
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permissions to manage payout destinations for restaurant "%"', p_restaurant_id;
    END IF;

    -- 2. Input validation
    IF p_raw_identifier IS NULL OR length(trim(p_raw_identifier)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Account identifier cannot be empty';
    END IF;
    IF p_account_name IS NULL OR length(trim(p_account_name)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Account name cannot be empty';
    END IF;
    IF p_masked_identifier IS NULL OR length(trim(p_masked_identifier)) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Masked account identifier cannot be empty';
    END IF;

    v_dest_type := (CASE WHEN p_destination_type='BANK_ACCOUNT' THEN 'BANK' ELSE p_destination_type END)::public.payout_destination_type_enum;

    -- 3. If setting as default, unset existing default destinations for this restaurant
    IF p_is_default THEN
        UPDATE public.merchant_payout_destinations
        SET is_default = FALSE
        WHERE restaurant_id = p_restaurant_id;
    END IF;

    -- 4. Insert public metadata row
    INSERT INTO public.merchant_payout_destinations (
        restaurant_id,
        destination_type,
        provider,
        masked_account_identifier,
        account_name,
        verification_status,
        is_default,
        created_by
    ) VALUES (
        p_restaurant_id,
        v_dest_type,
        p_provider,
        p_masked_identifier,
        p_account_name,
        'PENDING_VERIFICATION'::public.destination_verification_status_enum,
        p_is_default,
        v_caller_id
    )
    RETURNING id INTO v_dest_id;

    -- 5. Insert private secret row inside the SAME transaction
    -- If this fails, the transaction automatically rolls back the public row!
    INSERT INTO public.merchant_payout_destination_secrets (
        destination_id,
        encrypted_account_reference
    ) VALUES (
        v_dest_id,
        public.encrypt_merchant_payout_reference(trim(p_raw_identifier))
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'destination_id', v_dest_id,
        'masked_identifier', p_masked_identifier
    );
END;
$$;
REVOKE ALL ON FUNCTION public.create_payout_destination_secure(VARCHAR,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,BOOLEAN,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout_destination_secure(VARCHAR,VARCHAR,VARCHAR,VARCHAR,VARCHAR,TEXT,BOOLEAN,UUID) TO service_role;
REVOKE ALL ON public.merchant_payout_destination_secrets FROM anon,authenticated;
DROP POLICY IF EXISTS rvd_applicant_insert ON public.restaurant_verification_documents;
CREATE POLICY rvd_applicant_insert ON public.restaurant_verification_documents FOR INSERT TO authenticated
WITH CHECK (owner_user_id=auth.uid() AND verification_status='PENDING' AND reviewed_at IS NULL AND reviewed_by IS NULL
AND (restaurant_id IS NULL OR EXISTS (SELECT 1 FROM public.restaurant_members m WHERE m.restaurant_id=restaurant_verification_documents.restaurant_id AND m.user_id=auth.uid() AND m.is_active AND m.role='OWNER'))
AND (application_id IS NULL OR EXISTS (SELECT 1 FROM public.restaurant_applications a WHERE a.id=application_id AND a.applicant_user_id=auth.uid())));
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

    -- 7. Verified contact check
    SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_rest.owner_id AND u.phone_confirmed_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.restaurant_branches rb WHERE rb.restaurant_id=p_restaurant_id AND rb.is_active AND rb.owner_phone=u.phone)) INTO v_has_verified_contact;

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
    SELECT EXISTS (SELECT 1 FROM public.merchant_payout_destinations d JOIN public.merchant_payout_destination_secrets s ON s.destination_id=d.id WHERE d.restaurant_id=p_restaurant_id AND d.verification_status='VERIFIED' AND s.encrypted_account_reference LIKE 'pgp:v1:%') INTO v_has_payout_destination;

    -- 11. Delivery pricing configuration
    SELECT EXISTS (
        SELECT 1 FROM public.branch_delivery_pricing bdp
        JOIN public.restaurant_branches rb ON rb.id = bdp.branch_id
        WHERE rb.restaurant_id = p_restaurant_id AND bdp.configuration_confirmed = TRUE
    ) INTO v_delivery_configured;

    -- 12. Business verified check
    SELECT count(DISTINCT document_type)=3 INTO v_business_verified FROM public.restaurant_verification_documents
    WHERE restaurant_id=p_restaurant_id AND document_type IN ('BUSINESS_LICENSE','TIN_DOCUMENT','FOOD_OPERATION_DOCUMENT')
    AND verification_status='VERIFIED' AND reviewed_by IS NOT NULL AND public.is_admin(reviewed_by) AND reviewed_at IS NOT NULL AND length(trim(storage_path))>0;

    IF NOT coalesce(v_has_opening_hours,FALSE) THEN v_can_submit:=FALSE; END IF;
    IF NOT coalesce(v_has_storefront_image,FALSE) THEN v_missing:=array_append(v_missing,'Storefront image required'); v_can_submit:=FALSE; END IF;
    IF NOT coalesce(v_has_verified_contact,FALSE) THEN v_missing:=array_append(v_missing,'Verified owner phone matching restaurant contact required'); v_can_submit:=FALSE; END IF;
    IF NOT coalesce(v_has_payout_destination,FALSE) THEN v_missing:=array_append(v_missing,'Verified encrypted payout destination required'); v_can_submit:=FALSE; END IF;
    IF NOT coalesce(v_delivery_configured,FALSE) THEN v_missing:=array_append(v_missing,'Confirmed delivery configuration required'); v_can_submit:=FALSE; END IF;
    IF NOT coalesce(v_business_verified,FALSE) THEN v_missing:=array_append(v_missing,'Reviewed business, tax and food-operation documents required'); v_can_submit:=FALSE; END IF;
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

    -- Hold readiness source tables stable through the publication transaction.
    LOCK TABLE public.restaurant_branches, public.branch_operating_hours, public.menu_items,
      public.branch_delivery_pricing, public.restaurant_verification_documents,
      public.merchant_payout_destinations, public.merchant_payout_destination_secrets IN SHARE MODE;
    PERFORM 1 FROM public.restaurants WHERE id=p_restaurant_id AND launch_status IN ('SETUP_REQUIRED','SETUP_IN_PROGRESS','READY_FOR_REVIEW','CORRECTIONS_REQUIRED') AND verification_status<>'SUSPENDED' AND archived_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant cannot enter launch review from current state'; END IF;
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
CREATE OR REPLACE FUNCTION public.approve_restaurant_launch(
    p_restaurant_id VARCHAR(80),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_rest RECORD;
    v_readiness JSONB;
BEGIN
    PERFORM public.require_admin_aal2();

    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- Hold readiness source tables stable through the publication transaction.
    LOCK TABLE public.restaurant_branches, public.branch_operating_hours, public.menu_items,
      public.branch_delivery_pricing, public.restaurant_verification_documents,
      public.merchant_payout_destinations, public.merchant_payout_destination_secrets IN SHARE MODE;
    SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Restaurant % not found.', p_restaurant_id;
    END IF;

    IF v_rest.launch_status IS DISTINCT FROM 'GO_LIVE_REVIEW' OR v_rest.verification_status='SUSPENDED' OR v_rest.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Restaurant must be in GO_LIVE_REVIEW and not suspended or archived'; END IF;
    v_readiness:=public.get_restaurant_launch_readiness(p_restaurant_id);
    IF (v_readiness->>'can_submit_for_review')::BOOLEAN IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Launch readiness failed: %',v_readiness->'missing_requirements'; END IF;
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
REVOKE ALL ON FUNCTION public.get_restaurant_launch_readiness(VARCHAR) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_restaurant_for_launch_review(VARCHAR) FROM PUBLIC,anon;
-- Restrictive RLS supplements existing owner/admin policies for direct customer reads.
DROP POLICY IF EXISTS restaurant_customer_visibility_closure ON public.restaurants;
CREATE POLICY restaurant_customer_visibility_closure ON public.restaurants AS RESTRICTIVE FOR SELECT TO anon,authenticated
USING (public.is_admin(auth.uid()) OR public.is_restaurant_member(id) OR
 (is_active IS TRUE AND is_published IS TRUE AND is_verified IS TRUE AND verification_status='VERIFIED' AND launch_status='PUBLISHED' AND archived_at IS NULL AND name NOT ILIKE '[DELETED]%'));

-- Shared customer launch gate: search_food_discovery
CREATE OR REPLACE FUNCTION public.search_food_discovery(
    p_query TEXT DEFAULT NULL,
    p_lat NUMERIC DEFAULT NULL,
    p_lng NUMERIC DEFAULT NULL,
    p_neighborhood TEXT DEFAULT NULL,
    p_max_distance_km NUMERIC DEFAULT 10.0,
    p_min_price INTEGER DEFAULT NULL,
    p_max_price INTEGER DEFAULT NULL,
    p_min_rating NUMERIC DEFAULT NULL,
    p_open_now BOOLEAN DEFAULT NULL,
    p_available_only BOOLEAN DEFAULT TRUE,
    p_cuisine_types TEXT[] DEFAULT NULL,
    p_dietary_tags TEXT[] DEFAULT NULL,
    p_sort TEXT DEFAULT 'RECOMMENDED',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_dietary_strict BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    menu_item_id VARCHAR(80),
    dish_name VARCHAR(150),
    dish_name_sw VARCHAR(150),
    description TEXT,
    description_sw TEXT,
    image_url TEXT,
    restaurant_id VARCHAR(80),
    restaurant_name VARCHAR(150),
    restaurant_logo TEXT,
    cuisine_type VARCHAR(100),
    branch_id UUID,
    branch_name VARCHAR(150),
    neighborhood VARCHAR(100),
    address VARCHAR(255),
    price_tzs INTEGER,
    base_price_tzs INTEGER,
    distance_km NUMERIC,
    restaurant_rating NUMERIC,
    review_count INTEGER,
    is_available BOOLEAN,
    stock_status VARCHAR(30),
    is_open_now BOOLEAN,
    opening_hours_summary TEXT,
    last_menu_verified_at TIMESTAMP WITH TIME ZONE,
    last_price_verified_at TIMESTAMP WITH TIME ZONE,
    last_availability_verified_at TIMESTAMP WITH TIME ZONE,
    freshness_hours INTEGER,
    freshness_tier VARCHAR(20),
    freshness_label TEXT,
    relevance_rank NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_clean_query TEXT := NULLIF(trim(p_query), '');
    v_max_dist NUMERIC := COALESCE(p_max_distance_km, 25.0);
    v_limit INTEGER := LEAST(COALESCE(p_limit, 20), 100);
    v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    RETURN QUERY
    WITH reviews_agg AS (
        SELECT 
            r_rev.restaurant_id,
            COALESCE(ra.average_rating, ROUND(AVG(r_rev.rating)::numeric, 1)) AS avg_rating,
            COALESCE(ra.verified_review_count, COUNT(*)::integer) AS rev_count
        FROM public.reviews r_rev
        LEFT JOIN public.restaurant_rating_aggregates ra ON ra.restaurant_id = r_rev.restaurant_id
        WHERE r_rev.visibility_status = 'PUBLISHED'
        GROUP BY r_rev.restaurant_id, ra.average_rating, ra.verified_review_count
    ),
    raw_dishes AS (
        SELECT
            mi.id::varchar(80) AS mi_id,
            mi.name_en::varchar(150) AS mi_dish_name,
            mi.name_sw::varchar(150) AS mi_dish_name_sw,
            mi.description_en::text AS mi_desc,
            mi.description_sw::text AS mi_desc_sw,
            COALESCE(mi.photo_url, '')::text AS mi_image_url,
            r.id::varchar(80) AS r_id,
            r.name::varchar(150) AS r_name,
            COALESCE(r.logo_url, '')::text AS r_logo,
            COALESCE(r.cuisine, '')::varchar(100) AS r_cuisine,
            rb.id::uuid AS rb_id,
            rb.name::varchar(150) AS rb_name,
            COALESCE(rb.ward, r.neighborhood, '')::varchar(100) AS rb_neighborhood,
            COALESCE(rb.address, '')::varchar(255) AS rb_address,
            COALESCE(bmi.price_tzs, mi.price_tzs, 0)::integer AS eff_price,
            COALESCE(mi.price_tzs, 0)::integer AS mi_base_price,
            CASE 
                WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND rb.latitude IS NOT NULL AND rb.longitude IS NOT NULL THEN
                    ROUND((6371.0 * acos(
                        least(1.0, greatest(-1.0,
                            cos(radians(p_lat)) * cos(radians(rb.latitude)) *
                            cos(radians(rb.longitude) - radians(p_lng)) +
                            sin(radians(p_lat)) * sin(radians(rb.latitude))
                        ))
                    ))::numeric, 1)
                ELSE
                    NULL::numeric
            END AS calc_distance,
            COALESCE(ra.avg_rating, r.rating, 0)::numeric AS eff_rating,
            COALESCE(ra.rev_count, r.reviews_count, 0)::integer AS eff_reviews_count,
            COALESCE(bmi.is_available, mi.is_available, FALSE)::boolean AS eff_available,
            COALESCE(bmi.stock_status, 'IN_STOCK')::varchar(30) AS eff_stock_status,
            (rb.is_active = TRUE AND COALESCE(rb.operational_mode, 'OPEN') NOT IN ('PAUSED', 'CLOSED'))::boolean AS eff_open_now,
            ''::text AS eff_hours_summary,
            r.last_menu_verified_at AS r_last_menu_ver,
            COALESCE(bmi.last_price_verified_at, mi.last_price_verified_at) AS eff_last_price_ver,
            COALESCE(bmi.last_availability_verified_at, mi.last_availability_verified_at) AS eff_last_avail_ver,
            GREATEST(
                COALESCE(bmi.last_price_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(bmi.last_availability_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(mi.last_price_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(r.last_menu_verified_at, '1970-01-01'::timestamp with time zone)
            ) AS most_recent_ver,
            -- Text relevance scoring
            CASE
                WHEN v_clean_query IS NULL THEN 80.0
                WHEN lower(mi.name_en) = lower(v_clean_query) OR lower(COALESCE(mi.name_sw, '')) = lower(v_clean_query) THEN 100.0
                WHEN lower(mi.name_en) LIKE lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE lower(v_clean_query) || '%' THEN 95.0
                WHEN lower(mi.name_en) LIKE '%' || lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE '%' || lower(v_clean_query) || '%' THEN 90.0
                WHEN mi.search_tsv @@ plainto_tsquery('simple', v_clean_query) THEN 75.0
                WHEN lower(r.name) LIKE '%' || lower(v_clean_query) || '%' THEN 40.0
                ELSE 20.0
            END AS text_relevance,
            -- Dietary boost scoring (Phase 21)
            CASE
                WHEN p_dietary_tags IS NOT NULL AND cardinality(p_dietary_tags) > 0 AND COALESCE(mi.dietary_tags, '{}') && p_dietary_tags THEN 15.0
                ELSE 0.0
            END AS dietary_boost,
            mi.dietary_tags AS mi_dietary_tags
        FROM public.menu_items mi
        JOIN public.restaurants r ON r.id = mi.restaurant_id
        JOIN public.restaurant_branches rb ON rb.restaurant_id = r.id AND rb.is_active = TRUE
        LEFT JOIN public.branch_menu_items bmi ON bmi.branch_id = rb.id AND bmi.menu_item_id = mi.id
        LEFT JOIN reviews_agg ra ON ra.restaurant_id = r.id
        WHERE mi.is_archived = FALSE
          AND r.is_active = TRUE
          AND r.is_published = TRUE AND r.launch_status = 'PUBLISHED' AND r.is_active IS TRUE AND r.is_verified IS TRUE AND r.verification_status = 'VERIFIED' AND r.archived_at IS NULL AND r.name NOT ILIKE '[DELETED]%'
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.name NOT LIKE '[DELETED]%'
    ),
    filtered AS (
        SELECT 
            *,
            GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - most_recent_ver)) / 3600.0)::integer) AS hours_since_ver
        FROM raw_dishes
        WHERE 
            (p_available_only IS NOT TRUE OR eff_available = TRUE)
            AND (p_min_price IS NULL OR eff_price >= p_min_price)
            AND (p_max_price IS NULL OR eff_price <= p_max_price)
            AND (p_min_rating IS NULL OR eff_rating >= p_min_rating)
            AND (p_open_now IS NOT TRUE OR eff_open_now = TRUE)
            AND (
                p_lat IS NULL OR p_lng IS NULL OR calc_distance IS NULL OR calc_distance <= v_max_dist
            )
            AND (
                p_neighborhood IS NULL OR
                lower(rb_neighborhood) LIKE '%' || lower(p_neighborhood) || '%' OR
                lower(rb_address) LIKE '%' || lower(p_neighborhood) || '%'
            )
            AND (
                v_clean_query IS NULL OR text_relevance >= 30.0
            )
            AND (
                p_cuisine_types IS NULL OR array_length(p_cuisine_types, 1) = 0 OR
                r_cuisine = ANY(p_cuisine_types)
            )
            -- Strict dietary filter (Phase 21)
            AND (
                NOT p_dietary_strict
                OR p_dietary_tags IS NULL
                OR cardinality(p_dietary_tags) = 0
                OR COALESCE(mi_dietary_tags, '{}') && p_dietary_tags
            )
    )
    SELECT
        f.mi_id::varchar(80) AS menu_item_id,
        f.mi_dish_name::varchar(150) AS dish_name,
        f.mi_dish_name_sw::varchar(150) AS dish_name_sw,
        f.mi_desc::text AS description,
        f.mi_desc_sw::text AS description_sw,
        f.mi_image_url::text AS image_url,
        f.r_id::varchar(80) AS restaurant_id,
        f.r_name::varchar(150) AS restaurant_name,
        f.r_logo::text AS restaurant_logo,
        f.r_cuisine::varchar(100) AS cuisine_type,
        f.rb_id::uuid AS branch_id,
        f.rb_name::varchar(150) AS branch_name,
        f.rb_neighborhood::varchar(100) AS neighborhood,
        f.rb_address::varchar(255) AS address,
        f.eff_price::integer AS price_tzs,
        f.mi_base_price::integer AS base_price_tzs,
        f.calc_distance::numeric AS distance_km,
        f.eff_rating::numeric AS restaurant_rating,
        f.eff_reviews_count::integer AS review_count,
        f.eff_available::boolean AS is_available,
        f.eff_stock_status::varchar(30) AS stock_status,
        f.eff_open_now::boolean AS is_open_now,
        f.eff_hours_summary::text AS opening_hours_summary,
        f.r_last_menu_ver::timestamptz AS last_menu_verified_at,
        f.eff_last_price_ver::timestamptz AS last_price_verified_at,
        f.eff_last_avail_ver::timestamptz AS last_availability_verified_at,
        f.hours_since_ver::integer AS freshness_hours,
        CASE
            WHEN f.hours_since_ver <= 24 THEN 'FRESH'::varchar(20)
            WHEN f.hours_since_ver <= 168 THEN 'RECENT'::varchar(20)
            ELSE 'STALE'::varchar(20)
        END AS freshness_tier,
        CASE
            WHEN f.hours_since_ver <= 2 THEN 'Verified just now'
            WHEN f.hours_since_ver <= 24 THEN 'Verified today'
            WHEN f.hours_since_ver <= 48 THEN 'Verified yesterday'
            ELSE 'Verified ' || (f.hours_since_ver / 24)::text || ' days ago'
        END AS freshness_label,
        (f.text_relevance + f.dietary_boost + (f.eff_rating * 4.0))::numeric AS relevance_rank
    FROM filtered f
    ORDER BY
        CASE WHEN p_sort = 'PRICE_ASC' THEN f.eff_price END ASC,
        CASE WHEN p_sort = 'PRICE_DESC' THEN f.eff_price END DESC,
        CASE WHEN p_sort = 'RATING' THEN f.eff_rating END DESC NULLS LAST,
        CASE WHEN p_sort = 'DISTANCE' THEN f.calc_distance END ASC NULLS LAST,
        (f.text_relevance + f.dietary_boost + (f.eff_rating * 4.0)) DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$;

-- Shared customer launch gate: match_and_invite_restaurants
CREATE OR REPLACE FUNCTION public.match_and_invite_restaurants(p_request_id VARCHAR(80))
RETURNS JSONB AS $
DECLARE
    v_req RECORD;
    v_matched RECORD;
    v_invited_count INTEGER := 0;
BEGIN
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    -- Find top qualified restaurants (Max 5)
    FOR v_matched IN (
        SELECT 
            r.id AS restaurant_id,
            s.restaurant_id IS NOT NULL AS has_settings,
            COALESCE(r.rating, 4.0) AS rating,
            jsonb_build_array(
                'CUSTOM_MEALS_ENABLED',
                'VERIFIED_RESTAURANT',
                'FULFILLMENT_MODE_MATCH',
                'NOTICE_WINDOW_SATISFIED'
            ) AS match_reasons
        FROM public.restaurants r
        JOIN public.restaurant_custom_meal_settings s ON s.restaurant_id = r.id
        WHERE r.is_published = TRUE AND r.launch_status = 'PUBLISHED' AND r.is_active IS TRUE AND r.is_verified IS TRUE AND r.verification_status = 'VERIFIED' AND r.archived_at IS NULL AND r.name NOT ILIKE '[DELETED]%'
          AND r.is_active = TRUE
          AND r.verification_status = 'VERIFIED'
          AND s.accepts_custom_meals = TRUE
          AND (s.paused_until IS NULL OR s.paused_until < NOW())
          AND (v_req.fulfillment_mode = ANY(s.supported_fulfillment_modes))
          AND (v_req.servings_count::integer <= s.maximum_servings)
          AND (v_req.desired_at - NOW() >= s.minimum_notice_minutes * INTERVAL '1 minute')
          AND (
              s.service_areas = '{}'
              OR v_req.customer_area IS NULL
              OR v_req.customer_area = ANY(s.service_areas)
          )
          AND (
              s.supported_cuisines = '{}'
              OR v_req.cuisine_type = ANY(s.supported_cuisines)
          )
        ORDER BY r.rating DESC, r.reviews_count DESC
        LIMIT 5
    )
    LOOP
        INSERT INTO public.custom_meal_invitations (
            request_id, restaurant_id, status, match_score, match_reasons, quote_deadline
        ) VALUES (
            p_request_id, v_matched.restaurant_id, 'INVITED', v_matched.rating, v_matched.match_reasons, v_req.quote_deadline
        )
        ON CONFLICT (request_id, restaurant_id) DO NOTHING;

        v_invited_count := v_invited_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'invited_count', v_invited_count
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Shared customer launch gate: is_restaurant_customer_visible
CREATE OR REPLACE FUNCTION public.is_restaurant_customer_visible(p_restaurant_id VARCHAR(80))
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
    SELECT EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = p_restaurant_id
          AND r.is_active = TRUE
          AND r.is_published = TRUE AND r.launch_status = 'PUBLISHED' AND r.is_active IS TRUE AND r.is_verified IS TRUE AND r.verification_status = 'VERIFIED' AND r.archived_at IS NULL AND r.name NOT ILIKE '[DELETED]%'
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.name NOT LIKE '[DELETED]%'
    );
$;

COMMIT;
