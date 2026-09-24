-- =============================================================================
-- MloHub Forward Migration: 20260923000005_customer_marketplace_truth_closure.sql
-- Customer Marketplace 100% Truth / UX / Payment / Service Area Closure
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE PHYSICAL RESTAURANT DELETION & CLEAN UP LEGACY ARTIFACTS (Phase A2)
-- ----------------------------------------------------------------------------

-- Drop DELETE policy on public.restaurants
DROP POLICY IF EXISTS "Admins can delete restaurants" ON public.restaurants;

-- Revoke physical deletion RPC from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.admin_delete_restaurant(VARCHAR) FROM PUBLIC, anon, authenticated;

-- Replace admin_delete_restaurant with immutable error guarding financial ledger
CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
BEGIN
    RAISE EXCEPTION 'Physical deletion of restaurants is strictly prohibited to preserve financial ledger, tax, and order history. Use archive_restaurant_secure instead.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(VARCHAR) TO service_role;

-- Archive any legacy [DELETED] flagged restaurants
UPDATE public.restaurants
SET archived_at = COALESCE(archived_at, clock_timestamp()),
    is_active = FALSE,
    is_published = FALSE
WHERE name LIKE '[DELETED]%' OR id LIKE 'deleted_%';

-- ----------------------------------------------------------------------------
-- 2. ORDER PIPELINE: OUT_FOR_DELIVERY & MODIFIER JSONB SUPPORT
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY' BEFORE 'COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update trigger state machine to recognize OUT_FOR_DELIVERY
CREATE OR REPLACE FUNCTION public.check_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Valid state transitions conforming to order_status_enum
    IF OLD.status = 'PENDING' AND NEW.status IN ('ACCEPTED', 'CANCELLED') THEN
        IF NEW.status = 'ACCEPTED' THEN NEW.accepted_at := NOW(); END IF;
        IF NEW.status = 'CANCELLED' THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'ACCEPTED' AND NEW.status IN ('PREPARING', 'CANCELLED') THEN
        IF NEW.status = 'CANCELLED' THEN NEW.cancelled_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'PREPARING' AND NEW.status IN ('READY', 'CANCELLED') THEN
        IF NEW.status = 'READY' THEN NEW.ready_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'READY' AND NEW.status IN ('OUT_FOR_DELIVERY', 'COMPLETED') THEN
        IF NEW.status = 'COMPLETED' THEN NEW.completed_at := NOW(); END IF;
        RETURN NEW;
    ELSIF OLD.status = 'OUT_FOR_DELIVERY' AND NEW.status = 'COMPLETED' THEN
        NEW.completed_at := NOW();
        RETURN NEW;
    ELSIF OLD.status = NEW.status THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid order transition from % to %', OLD.status, NEW.status;
    END IF;
END;
$function$;

-- Add selected_modifiers JSONB column to order_items if not present
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 3. TANZANIA SERVICE CITIES & SERVICE AREAS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    region VARCHAR(100) NOT NULL DEFAULT 'Tanzania',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.service_cities(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    center_latitude NUMERIC(10, 7),
    center_longitude NUMERIC(10, 7),
    radius_km NUMERIC(5, 2) DEFAULT 5.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (city_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_areas_city ON public.service_areas(city_id);

-- RLS: Readable by anon & authenticated, writable by admins
ALTER TABLE public.service_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active service cities" ON public.service_cities;
CREATE POLICY "Public can view active service cities"
    ON public.service_cities FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins manage service cities" ON public.service_cities;
CREATE POLICY "Admins manage service cities"
    ON public.service_cities FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('ADMIN', 'SUPER_ADMIN') OR 'ADMIN' = ANY(roles))));

DROP POLICY IF EXISTS "Public can view active service areas" ON public.service_areas;
CREATE POLICY "Public can view active service areas"
    ON public.service_areas FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins manage service areas" ON public.service_areas;
CREATE POLICY "Admins manage service areas"
    ON public.service_areas FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('ADMIN', 'SUPER_ADMIN') OR 'ADMIN' = ANY(roles))));

-- Seed Canonical Cities & Areas
DO $$
DECLARE
    v_dar_id UUID;
    v_arusha_id UUID;
    v_znz_id UUID;
    v_dodoma_id UUID;
BEGIN
    INSERT INTO public.service_cities (name, region, is_active)
    VALUES ('Dar es Salaam', 'Coast', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_dar_id;

    INSERT INTO public.service_cities (name, region, is_active)
    VALUES ('Arusha', 'Northern', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_arusha_id;

    INSERT INTO public.service_cities (name, region, is_active)
    VALUES ('Zanzibar', 'Islands', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_znz_id;

    INSERT INTO public.service_cities (name, region, is_active)
    VALUES ('Dodoma', 'Central', TRUE)
    ON CONFLICT (name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_dodoma_id;

    -- Dar es Salaam Areas
    INSERT INTO public.service_areas (city_id, name, center_latitude, center_longitude, radius_km) VALUES
        (v_dar_id, 'Masaki', -6.7450, 39.2780, 4.0),
        (v_dar_id, 'Oysterbay', -6.7680, 39.2740, 3.5),
        (v_dar_id, 'Mikocheni', -6.7720, 39.2540, 4.5),
        (v_dar_id, 'Posta / CBD', -6.8160, 39.2890, 4.0),
        (v_dar_id, 'Upanga', -6.8040, 39.2750, 3.0),
        (v_dar_id, 'Sinza', -6.7840, 39.2220, 4.0),
        (v_dar_id, 'Kinondoni', -6.7900, 39.2570, 3.5),
        (v_dar_id, 'Mbezi Beach', -6.7120, 39.2240, 6.0),
        (v_dar_id, 'Kariakoo', -6.8220, 39.2770, 3.0),
        (v_dar_id, 'Mwenge', -6.7710, 39.2180, 4.0),
        (v_dar_id, 'Tegeta', -6.6780, 39.2050, 6.0),
        (v_dar_id, 'Msasani', -6.7600, 39.2680, 3.5)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Arusha Areas
    INSERT INTO public.service_areas (city_id, name, center_latitude, center_longitude, radius_km) VALUES
        (v_arusha_id, 'Arusha CBD', -3.3730, 36.6940, 4.0),
        (v_arusha_id, 'Njiro', -3.4080, 36.7110, 5.0),
        (v_arusha_id, 'Sakina', -3.3550, 36.6780, 4.5)
    ON CONFLICT (city_id, name) DO NOTHING;

    -- Zanzibar Areas
    INSERT INTO public.service_areas (city_id, name, center_latitude, center_longitude, radius_km) VALUES
        (v_znz_id, 'Stone Town', -6.1630, 39.1890, 3.0),
        (v_znz_id, 'Paje', -6.2660, 39.5340, 5.0),
        (v_znz_id, 'Nungwi', -5.7270, 39.2980, 5.0)
    ON CONFLICT (city_id, name) DO NOTHING;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CUSTOMER SAVED ADDRESSES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL DEFAULT 'Home',
    street_address TEXT NOT NULL,
    delivery_instructions TEXT,
    city VARCHAR(100) NOT NULL DEFAULT 'Dar es Salaam',
    area_name VARCHAR(120),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_cust_addresses_user ON public.customer_saved_addresses(customer_id);

ALTER TABLE public.customer_saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage their saved addresses" ON public.customer_saved_addresses;
CREATE POLICY "Customers manage their saved addresses"
    ON public.customer_saved_addresses FOR ALL
    TO authenticated
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- Trigger: Ensure single default address per customer
CREATE OR REPLACE FUNCTION public.handle_customer_default_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE public.customer_saved_addresses
        SET is_default = FALSE
        WHERE customer_id = NEW.customer_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_default_address ON public.customer_saved_addresses;
CREATE TRIGGER trg_customer_default_address
    BEFORE INSERT OR UPDATE OF is_default ON public.customer_saved_addresses
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION public.handle_customer_default_address();

-- ----------------------------------------------------------------------------
-- 5. CUSTOMER FAVORITE RESTAURANTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_favorite_restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (customer_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_cust_favorites_user ON public.customer_favorite_restaurants(customer_id);

ALTER TABLE public.customer_favorite_restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage their favorites" ON public.customer_favorite_restaurants;
CREATE POLICY "Customers manage their favorites"
    ON public.customer_favorite_restaurants FOR ALL
    TO authenticated
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. CUSTOMER DIETARY PREFERENCES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_dietary_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preferences TEXT[] NOT NULL DEFAULT '{}',
    allergies TEXT[] NOT NULL DEFAULT '{}',
    spice_level VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.customer_dietary_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage dietary preferences" ON public.customer_dietary_preferences;
CREATE POLICY "Customers manage dietary preferences"
    ON public.customer_dietary_preferences FOR ALL
    TO authenticated
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. MENU MODIFIERS SCHEMA
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.menu_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id VARCHAR(80) NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_selections INTEGER NOT NULL DEFAULT 0,
    max_selections INTEGER NOT NULL DEFAULT 1,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_mod_groups_item ON public.menu_modifier_groups(menu_item_id);

CREATE TABLE IF NOT EXISTS public.menu_modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_delta_tzs BIGINT NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_mod_options_group ON public.menu_modifier_options(group_id);

ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view modifier groups" ON public.menu_modifier_groups;
CREATE POLICY "Public can view modifier groups"
    ON public.menu_modifier_groups FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Public can view modifier options" ON public.menu_modifier_options;
CREATE POLICY "Public can view modifier options"
    ON public.menu_modifier_options FOR SELECT
    USING (TRUE);

-- ----------------------------------------------------------------------------
-- 8. CANONICAL RESTAURANT CUSTOMER VISIBILITY FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_restaurant_customer_visible(p_restaurant_id VARCHAR(80))
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = p_restaurant_id
          AND r.is_active = TRUE
          AND r.is_published = TRUE
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.name NOT LIKE '[DELETED]%'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_restaurant_customer_visible(VARCHAR) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. AUTHORITATIVE CUSTOMER ORDER CANCELLATION RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_customer_order_secure(
    p_order_id VARCHAR(80),
    p_cancellation_reason TEXT DEFAULT 'Cancelled by customer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_order RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_refund_id UUID := NULL;
    v_refund_result JSONB := NULL;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to cancel order.';
    END IF;

    -- Check if admin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_actor AND (role IN ('ADMIN', 'SUPER_ADMIN') OR 'ADMIN' = ANY(roles))
    ) INTO v_is_admin;

    -- Lock target order
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % does not exist.', p_order_id;
    END IF;

    -- Ownership verification
    IF v_order.user_id != v_actor AND NOT v_is_admin THEN
        RAISE EXCEPTION '403 Forbidden: Caller is not the creator of order %.', p_order_id;
    END IF;

    -- State guard: customer may only self-cancel while PENDING
    IF v_order.status != 'PENDING' THEN
        IF v_order.status = 'CANCELLED' THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'status', 'CANCELLED',
                'order_id', p_order_id,
                'message', 'Order is already cancelled.'
            );
        ELSE
            RAISE EXCEPTION '400 Bad Request: Order is currently % and can no longer be cancelled automatically. Please contact support.', v_order.status;
        END IF;
    END IF;

    -- Refund handling: if payment was captured, issue cancellation refund
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE order_id = p_order_id AND status IN ('SUCCESS', 'CAPTURED', 'PAID')
    ) THEN
        BEGIN
            v_refund_result := public.request_refund_restaurant_cancel_secure(
                p_order_id, v_actor, COALESCE(p_cancellation_reason, 'Customer cancelled pending order')
            );
            v_refund_id := (v_refund_result->>'refund_request_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- Log but proceed with order status update
            v_refund_id := NULL;
        END IF;
    END IF;

    -- Cancel the order
    UPDATE public.orders
    SET status = 'CANCELLED',
        cancelled_at = clock_timestamp(),
        cancellation_reason = COALESCE(p_cancellation_reason, 'Cancelled by customer'),
        updated_at = clock_timestamp()
    WHERE id = p_order_id;

    -- Audit log
    INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (
        v_actor,
        'CUSTOMER_CANCEL_ORDER',
        'ORDER',
        p_order_id,
        jsonb_build_object(
            'reason', p_cancellation_reason,
            'refund_request_id', v_refund_id,
            'cancelled_by', v_actor
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'CANCELLED',
        'order_id', p_order_id,
        'refund_request_id', v_refund_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_customer_order_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. MULTI-ENTITY MARKETPLACE SEARCH RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_marketplace(
    p_query TEXT DEFAULT NULL,
    p_lat NUMERIC DEFAULT NULL,
    p_lng NUMERIC DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_query TEXT := NULLIF(trim(p_query), '');
    v_limit INTEGER := LEAST(COALESCE(p_limit, 20), 50);
    v_restaurants JSONB;
    v_dishes JSONB;
    v_cuisines JSONB;
BEGIN
    -- 1. Matching Restaurants
    SELECT COALESCE(jsonb_agg(r_data), '[]'::jsonb)
    INTO v_restaurants
    FROM (
        SELECT
            r.id,
            r.name,
            r.cuisine,
            r.rating,
            r.reviews_count,
            r.logo_url,
            r.banner_url,
            r.address,
            r.neighborhood,
            CASE
                WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND rb.latitude IS NOT NULL AND rb.longitude IS NOT NULL THEN
                    ROUND((6371.0 * acos(
                        least(1.0, greatest(-1.0,
                            cos(radians(p_lat)) * cos(radians(rb.latitude)) *
                            cos(radians(rb.longitude) - radians(p_lng)) +
                            sin(radians(p_lat)) * sin(radians(rb.latitude))
                        ))
                    ))::numeric, 1)
                ELSE NULL
            END AS distance_km,
            (COALESCE(rb.is_active, TRUE) AND COALESCE(rb.operational_mode, 'OPEN') NOT IN ('PAUSED', 'CLOSED')) AS is_open
        FROM public.restaurants r
        LEFT JOIN LATERAL (
            SELECT b.latitude, b.longitude, b.is_active, b.operational_mode
            FROM public.restaurant_branches b
            WHERE b.restaurant_id = r.id AND b.is_active = TRUE
            LIMIT 1
        ) rb ON TRUE
        WHERE r.is_active = TRUE
          AND r.is_published = TRUE
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.name NOT LIKE '[DELETED]%'
          AND (
              v_clean_query IS NULL
              OR r.name ILIKE '%' || v_clean_query || '%'
              OR r.cuisine ILIKE '%' || v_clean_query || '%'
              OR r.neighborhood ILIKE '%' || v_clean_query || '%'
          )
        ORDER BY
            CASE WHEN v_clean_query IS NOT NULL AND r.name ILIKE v_clean_query || '%' THEN 1 ELSE 2 END,
            r.rating DESC NULLS LAST,
            r.reviews_count DESC NULLS LAST
        LIMIT v_limit
    ) r_data;

    -- 2. Matching Dishes
    SELECT COALESCE(jsonb_agg(d_data), '[]'::jsonb)
    INTO v_dishes
    FROM (
        SELECT
            mi.id,
            mi.name_en AS name,
            mi.name_sw,
            mi.price_tzs,
            mi.photo_url,
            mi.is_available,
            r.id AS restaurant_id,
            r.name AS restaurant_name,
            r.cuisine AS restaurant_cuisine
        FROM public.menu_items mi
        JOIN public.restaurants r ON r.id = mi.restaurant_id
        WHERE mi.is_archived = FALSE
          AND mi.is_available = TRUE
          AND r.is_active = TRUE
          AND r.is_published = TRUE
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.name NOT LIKE '[DELETED]%'
          AND (
              v_clean_query IS NULL
              OR mi.name_en ILIKE '%' || v_clean_query || '%'
              OR COALESCE(mi.name_sw, '') ILIKE '%' || v_clean_query || '%'
              OR COALESCE(mi.description_en, '') ILIKE '%' || v_clean_query || '%'
          )
        ORDER BY
            CASE WHEN v_clean_query IS NOT NULL AND mi.name_en ILIKE v_clean_query || '%' THEN 1 ELSE 2 END,
            mi.price_tzs ASC
        LIMIT v_limit
    ) d_data;

    -- 3. Matching Cuisines
    SELECT COALESCE(jsonb_agg(c_data.cuisine), '[]'::jsonb)
    INTO v_cuisines
    FROM (
        SELECT DISTINCT r.cuisine
        FROM public.restaurants r
        WHERE r.is_active = TRUE
          AND r.is_published = TRUE
          AND r.is_verified = TRUE
          AND r.verification_status = 'VERIFIED'
          AND r.archived_at IS NULL
          AND r.cuisine IS NOT NULL
          AND trim(r.cuisine) != ''
          AND (
              v_clean_query IS NULL
              OR r.cuisine ILIKE '%' || v_clean_query || '%'
          )
        LIMIT 10
    ) c_data;

    RETURN jsonb_build_object(
        'restaurants', v_restaurants,
        'dishes', v_dishes,
        'cuisines', v_cuisines,
        'query', v_clean_query
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace(TEXT, NUMERIC, NUMERIC, INTEGER) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. HARDEN search_food_discovery WITH EXPLICIT ARCHIVED_AT CHECK
-- ----------------------------------------------------------------------------

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
            CASE
                WHEN v_clean_query IS NULL THEN 80.0
                WHEN lower(mi.name_en) = lower(v_clean_query) OR lower(COALESCE(mi.name_sw, '')) = lower(v_clean_query) THEN 100.0
                WHEN lower(mi.name_en) LIKE lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE lower(v_clean_query) || '%' THEN 95.0
                WHEN lower(mi.name_en) LIKE '%' || lower(v_clean_query) || '%' OR lower(COALESCE(mi.name_sw, '')) LIKE '%' || lower(v_clean_query) || '%' THEN 90.0
                WHEN mi.search_tsv @@ plainto_tsquery('simple', v_clean_query) THEN 75.0
                WHEN lower(r.name) LIKE '%' || lower(v_clean_query) || '%' THEN 40.0
                ELSE 20.0
            END AS text_relevance
        FROM public.menu_items mi
        JOIN public.restaurants r ON r.id = mi.restaurant_id
        JOIN public.restaurant_branches rb ON rb.restaurant_id = r.id AND rb.is_active = TRUE
        LEFT JOIN public.branch_menu_items bmi ON bmi.branch_id = rb.id AND bmi.menu_item_id = mi.id
        LEFT JOIN reviews_agg ra ON ra.restaurant_id = r.id
        WHERE mi.is_archived = FALSE
          AND r.is_active = TRUE
          AND r.is_published = TRUE
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
        (CASE
            WHEN f.hours_since_ver <= 24 THEN 'FRESH'
            WHEN f.hours_since_ver <= 72 THEN 'RECENT'
            WHEN f.hours_since_ver <= 168 THEN 'AGING'
            WHEN f.hours_since_ver > 168 AND f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'STALE'
            ELSE 'UNKNOWN'
        END)::varchar(20) AS freshness_tier,
        (CASE
            WHEN f.hours_since_ver <= 1 THEN 'Verified just now'
            WHEN f.hours_since_ver <= 24 THEN 'Verified ' || f.hours_since_ver || 'h ago'
            WHEN f.hours_since_ver <= 48 THEN 'Verified yesterday'
            WHEN f.hours_since_ver <= 168 THEN 'Updated ' || (f.hours_since_ver / 24) || ' days ago'
            WHEN f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'Price may be outdated'
            ELSE 'Not recently verified'
        END)::text AS freshness_label,
        ROUND((
            f.text_relevance * 0.35 +
            (CASE WHEN f.calc_distance IS NOT NULL THEN GREATEST(10.0, 100.0 - (f.calc_distance / 5.0) * 45.0) ELSE 50.0 END) * 0.20 +
            (CASE WHEN p_max_price IS NOT NULL AND p_max_price > 0 AND f.eff_price <= p_max_price THEN 80.0 + ((p_max_price - f.eff_price)::numeric / p_max_price) * 20.0 ELSE 80.0 END) * 0.15 +
            (CASE WHEN f.eff_rating > 0 THEN (f.eff_rating / 5.0 * 100.0) ELSE 50.0 END) * 0.10 +
            (CASE WHEN f.hours_since_ver <= 24 THEN 100.0 WHEN f.hours_since_ver <= 72 THEN 80.0 ELSE 40.0 END) * 0.10 +
            (CASE WHEN f.eff_available THEN 100.0 ELSE 0.0 END) * 0.10
        )::numeric, 1)::numeric AS relevance_rank
    FROM filtered f
    ORDER BY
        CASE WHEN p_sort = 'NEAREST' THEN f.calc_distance END ASC NULLS LAST,
        CASE WHEN p_sort = 'CHEAPEST' THEN f.eff_price END ASC,
        CASE WHEN p_sort = 'HIGHEST_RATED' THEN f.eff_rating END DESC,
        CASE WHEN p_sort = 'FRESHEST' THEN f.hours_since_ver END ASC,
        CASE WHEN p_sort = 'MOST_POPULAR' THEN f.eff_reviews_count END DESC,
        relevance_rank DESC,
        f.calc_distance ASC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_food_discovery TO anon, authenticated, service_role;
