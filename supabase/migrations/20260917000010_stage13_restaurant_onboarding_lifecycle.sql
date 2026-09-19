-- ============================================================================
-- MLOHUB STAGE 13 MIGRATION: RESTAURANT ONBOARDING LIFECYCLE & DISCOVERY
-- ============================================================================
-- 1. Schema alignment for restaurant_applications:
--    - applicant_user_id (UUID REFERENCES profiles)
--    - reviewed_at (TIMESTAMPTZ)
--    - rejection_reason (TEXT)
-- 2. RLS policies on restaurant_applications for applicants & admins
-- 3. Schema alignment for restaurants:
--    - is_active (BOOLEAN DEFAULT TRUE)
--    - is_published (BOOLEAN DEFAULT FALSE)
-- 4. Server-side RPC approve_restaurant_application:
--    - sets is_published = FALSE, is_open = FALSE (owner must setup first)
--    - creates restaurant_members record with role OWNER
-- 5. Server-side RPC publish_restaurant:
--    - enforces caller is OWNER/MANAGER or admin
--    - requires at least 1 active branch
--    - requires at least 1 available menu item with price > 0
--    - activates is_published = TRUE, is_open = TRUE
-- 6. Server-side RPC unpublish_restaurant
-- 7. Updated RLS on public.restaurants to gate discovery on is_published = TRUE
-- ============================================================================

-- 1. Align restaurant_applications columns
ALTER TABLE public.restaurant_applications
    ADD COLUMN IF NOT EXISTS applicant_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_applicant
    ON public.restaurant_applications(applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_status
    ON public.restaurant_applications(status);

-- 2. RLS Policies on restaurant_applications
ALTER TABLE public.restaurant_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicants can insert applications" ON public.restaurant_applications;
CREATE POLICY "Applicants can insert applications"
    ON public.restaurant_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = applicant_user_id
        OR applicant_user_id IS NULL
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Applicants can view their own applications and Admins view all" ON public.restaurant_applications;
CREATE POLICY "Applicants can view their own applications and Admins view all"
    ON public.restaurant_applications
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = applicant_user_id
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update applications" ON public.restaurant_applications;
CREATE POLICY "Admins can update applications"
    ON public.restaurant_applications
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete applications" ON public.restaurant_applications;
CREATE POLICY "Admins can delete applications"
    ON public.restaurant_applications
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- 3. Align restaurants columns
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_restaurants_published_active
    ON public.restaurants(is_published, is_active, verification_status);

-- Ensure existing seeded restaurants are marked active & published if verified
UPDATE public.restaurants
SET is_active = TRUE,
    is_published = TRUE
WHERE verification_status = 'VERIFIED' AND is_open = TRUE;

-- 4. Update approve_restaurant_application RPC
CREATE OR REPLACE FUNCTION public.approve_restaurant_application(p_application_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_app RECORD;
    v_rest_id VARCHAR(80);
    v_applicant UUID;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    v_applicant := v_app.applicant_user_id;

    -- Update application status
    UPDATE public.restaurant_applications
    SET status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Canonical restaurant slug & ID
    v_rest_id := lower(regexp_replace(v_app.business_name, '[^a-zA-Z0-9]+', '-', 'g'));
    IF length(v_rest_id) = 0 THEN
        v_rest_id := 'rest-' || substr(md5(random()::text), 1, 12);
    END IF;

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
        FALSE, -- Must complete setup before publication
        FALSE, -- Closed until published
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        is_verified = TRUE,
        verification_status = 'VERIFIED',
        is_active = TRUE,
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

-- 5. Publish restaurant RPC (Validates prerequisites)
CREATE OR REPLACE FUNCTION public.publish_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_is_member BOOLEAN;
    v_has_branch BOOLEAN;
    v_has_menu_item BOOLEAN;
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
        RAISE EXCEPTION '403 Forbidden: Only restaurant owners or administrators can publish this restaurant.';
    END IF;

    -- Check prerequisite 1: At least one active branch
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_branches
        WHERE restaurant_id = p_restaurant_id
          AND is_active = TRUE
    ) INTO v_has_branch;

    IF NOT v_has_branch THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant must have at least one active branch before publication.';
    END IF;

    -- Check prerequisite 2: At least one available menu item with price > 0
    SELECT EXISTS (
        SELECT 1 FROM public.menu_items
        WHERE restaurant_id = p_restaurant_id
          AND is_archived = FALSE
          AND is_available = TRUE
          AND price_tzs > 0
    ) INTO v_has_menu_item;

    IF NOT v_has_menu_item THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant must have at least one available menu item with a valid price before publication.';
    END IF;

    -- All prerequisites met: activate publication
    UPDATE public.restaurants
    SET is_published = TRUE,
        is_open = TRUE,
        is_active = TRUE,
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'is_published', TRUE,
        'is_open', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Unpublish restaurant RPC
CREATE OR REPLACE FUNCTION public.unpublish_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_is_member BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE restaurant_id = p_restaurant_id
          AND user_id = auth.uid()
          AND is_active = TRUE
          AND role IN ('OWNER', 'MANAGER')
    ) INTO v_is_member;

    IF NOT v_is_member AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION '403 Forbidden: Only restaurant owners or administrators can unpublish this restaurant.';
    END IF;

    UPDATE public.restaurants
    SET is_published = FALSE,
        is_open = FALSE,
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'is_published', FALSE,
        'is_open', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Update RLS policy on public.restaurants
DROP POLICY IF EXISTS "Public can view approved and open restaurants" ON public.restaurants;
CREATE POLICY "Public can view approved and open restaurants"
    ON public.restaurants
    FOR SELECT
    USING (
        (is_verified = TRUE AND verification_status = 'VERIFIED' AND is_published = TRUE AND is_active = TRUE)
        OR public.is_restaurant_member(id)
        OR public.is_admin(auth.uid())
    );

-- 8. Re-align search_food_discovery with explicit return types and published filter
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
    p_offset INTEGER DEFAULT 0
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
AS $$
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
            ROUND(AVG(r_rev.rating)::numeric, 1) AS avg_rating,
            COUNT(*)::integer AS rev_count
        FROM public.reviews r_rev
        GROUP BY r_rev.restaurant_id
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
            COALESCE(r.cuisine, 'Swahili')::varchar(100) AS r_cuisine,
            rb.id AS rb_id,
            rb.name::varchar(150) AS rb_name,
            COALESCE(rb.ward, r.neighborhood, 'Dar es Salaam')::varchar(100) AS rb_neighborhood,
            COALESCE(rb.address, r.address)::varchar(255) AS rb_address,
            COALESCE(bmi.price_tzs, mi.price_tzs)::integer AS eff_price,
            mi.price_tzs::integer AS mi_base_price,
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
                    1.5::numeric
            END AS calc_distance,
            COALESCE(ra.avg_rating, r.rating, 4.5)::numeric AS eff_rating,
            COALESCE(ra.rev_count, r.reviews_count, 12)::integer AS eff_reviews_count,
            COALESCE(bmi.is_available, mi.is_available, TRUE)::boolean AS eff_available,
            COALESCE(bmi.stock_status, 'IN_STOCK')::varchar(30) AS eff_stock_status,
            (COALESCE(rb.is_active, TRUE) AND r.is_open)::boolean AS eff_open_now,
            '08:00 AM - 10:00 PM'::text AS eff_hours_summary,
            r.last_menu_verified_at AS r_last_menu_ver,
            COALESCE(bmi.last_price_verified_at, mi.last_price_verified_at) AS eff_last_price_ver,
            COALESCE(bmi.last_availability_verified_at, mi.last_availability_verified_at) AS eff_last_avail_ver,
            GREATEST(
                COALESCE(bmi.last_price_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(bmi.last_availability_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(mi.last_price_verified_at, '1970-01-01'::timestamp with time zone),
                COALESCE(r.last_menu_verified_at, '1970-01-01'::timestamp with time zone)
            ) AS most_recent_ver,
            CASE
                WHEN v_clean_query IS NULL THEN 80.0
                WHEN lower(mi.name_en) = lower(v_clean_query) OR lower(COALESCE(mi.name_sw, '')) = lower(v_clean_query) THEN 100.0
                WHEN lower(mi.name_en) LIKE lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE lower(v_clean_query) || '%' THEN 95.0
                WHEN lower(mi.name_en) LIKE '%' || lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE '%' || lower(v_clean_query) || '%' THEN 90.0
                WHEN mi.search_tsv @@ plainto_tsquery('simple', v_clean_query) THEN 75.0
                WHEN lower(r.name) LIKE '%' || lower(v_clean_query) || '%' THEN 40.0
                ELSE 20.0
            END::numeric AS text_relevance
        FROM public.menu_items mi
        JOIN public.restaurants r ON r.id = mi.restaurant_id
        LEFT JOIN public.restaurant_branches rb ON rb.restaurant_id = r.id AND rb.is_active = TRUE
        LEFT JOIN public.branch_menu_items bmi ON bmi.branch_id = rb.id AND bmi.menu_item_id = mi.id
        LEFT JOIN reviews_agg ra ON ra.restaurant_id = r.id
        WHERE mi.is_archived = FALSE
          AND r.is_active = TRUE
          AND r.is_published = TRUE
          AND r.verification_status != 'SUSPENDED'
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
                p_lat IS NULL OR p_lng IS NULL OR calc_distance <= v_max_dist
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
        f.r_last_menu_ver::timestamp with time zone AS last_menu_verified_at,
        f.eff_last_price_ver::timestamp with time zone AS last_price_verified_at,
        f.eff_last_avail_ver::timestamp with time zone AS last_availability_verified_at,
        f.hours_since_ver::integer AS freshness_hours,
        (CASE
            WHEN f.hours_since_ver <= 24 THEN 'FRESH'::varchar(20)
            WHEN f.hours_since_ver <= 72 THEN 'RECENT'::varchar(20)
            WHEN f.hours_since_ver <= 168 THEN 'AGING'::varchar(20)
            WHEN f.hours_since_ver > 168 AND f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'STALE'::varchar(20)
            ELSE 'UNKNOWN'::varchar(20)
        END)::varchar(20) AS freshness_tier,
        (CASE
            WHEN f.hours_since_ver <= 1 THEN 'Verified just now'::text
            WHEN f.hours_since_ver <= 24 THEN ('Verified ' || f.hours_since_ver || 'h ago')::text
            WHEN f.hours_since_ver <= 48 THEN 'Verified yesterday'::text
            WHEN f.hours_since_ver <= 168 THEN ('Updated ' || (f.hours_since_ver / 24) || ' days ago')::text
            WHEN f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'Price may be outdated'::text
            ELSE 'Not recently verified'::text
        END)::text AS freshness_label,
        ROUND((
            f.text_relevance * 0.35 +
            GREATEST(10.0, 100.0 - (f.calc_distance / 5.0) * 45.0) * 0.20 +
            (CASE WHEN p_max_price IS NOT NULL AND p_max_price > 0 AND f.eff_price <= p_max_price THEN 80.0 + ((p_max_price - f.eff_price)::numeric / p_max_price) * 20.0 ELSE 80.0 END) * 0.15 +
            (f.eff_rating / 5.0 * 100.0) * 0.10 +
            (CASE WHEN f.hours_since_ver <= 24 THEN 100.0 WHEN f.hours_since_ver <= 72 THEN 80.0 ELSE 40.0 END) * 0.10 +
            (CASE WHEN f.eff_available THEN 100.0 ELSE 0.0 END) * 0.10
        )::numeric, 1)::numeric AS relevance_rank
    FROM filtered f
    ORDER BY
        CASE WHEN p_sort = 'NEAREST' THEN f.calc_distance END ASC,
        CASE WHEN p_sort = 'CHEAPEST' THEN f.eff_price END ASC,
        CASE WHEN p_sort = 'HIGHEST_RATED' THEN f.eff_rating END DESC,
        CASE WHEN p_sort = 'FRESHEST' THEN f.hours_since_ver END ASC,
        CASE WHEN p_sort = 'MOST_POPULAR' THEN f.eff_reviews_count END DESC,
        relevance_rank DESC,
        f.calc_distance ASC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_food_discovery TO anon, authenticated;

-- ============================================================================
-- 8. MENU CATEGORIES RLS POLICIES
-- ============================================================================
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active menu categories" ON public.menu_categories;
CREATE POLICY "Public can view active menu categories"
    ON public.menu_categories FOR SELECT
    USING (
        is_active = TRUE
        OR is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Restaurant members can manage menu categories" ON public.menu_categories;
CREATE POLICY "Restaurant members can manage menu categories"
    ON public.menu_categories FOR ALL
    USING (
        is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );
