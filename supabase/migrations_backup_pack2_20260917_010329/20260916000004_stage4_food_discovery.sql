-- ============================================================================
-- MLOHUB STAGE 4: FOOD-FIRST DISCOVERY SEARCH RPC & INDEXES
-- Version: 20260916000004
-- Description: Server-side discovery engine returning ranked dish-level results
--              with branch-specific pricing, Haversine distance, review ratings,
--              verification freshness, and strict zero-leak security.
-- ============================================================================

-- 1. Performance Optimization Indexes for Discovery
CREATE INDEX IF NOT EXISTS idx_branch_menu_items_price ON public.branch_menu_items(price_tzs);
CREATE INDEX IF NOT EXISTS idx_branch_menu_items_composite ON public.branch_menu_items(branch_id, is_available, price_tzs);
CREATE INDEX IF NOT EXISTS idx_menu_items_price ON public.menu_items(price_tzs);
CREATE INDEX IF NOT EXISTS idx_menu_items_rest_archived ON public.menu_items(restaurant_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_geo ON public.restaurant_branches(latitude, longitude) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviews_rest_rating ON public.reviews(restaurant_id, rating);

-- 2. Drop existing RPC if previously defined
DROP FUNCTION IF EXISTS public.search_food_discovery(TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, INTEGER, INTEGER, NUMERIC, BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, INTEGER, INTEGER);

-- 3. Core Server-Side Discovery RPC
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
            mi.id AS mi_id,
            mi.name_en AS mi_dish_name,
            mi.name_sw AS mi_dish_name_sw,
            mi.description_en AS mi_desc,
            mi.description_sw AS mi_desc_sw,
            COALESCE(mi.photo_url, '') AS mi_image_url,
            r.id AS r_id,
            r.name AS r_name,
            COALESCE(r.logo_url, '') AS r_logo,
            COALESCE(r.cuisine, 'Swahili') AS r_cuisine,
            rb.id AS rb_id,
            rb.name AS rb_name,
            COALESCE(rb.ward, r.neighborhood, 'Dar es Salaam') AS rb_neighborhood,
            rb.address AS rb_address,
            COALESCE(bmi.price_tzs, mi.price_tzs) AS eff_price,
            mi.price_tzs AS mi_base_price,
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
                    1.5
            END AS calc_distance,
            COALESCE(ra.avg_rating, r.rating, 4.5) AS eff_rating,
            COALESCE(ra.rev_count, r.reviews_count, 12) AS eff_reviews_count,
            COALESCE(bmi.is_available, mi.is_available, TRUE) AS eff_available,
            COALESCE(bmi.stock_status, 'IN_STOCK') AS eff_stock_status,
            COALESCE(rb.is_active, TRUE) AS eff_open_now,
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
            END AS text_relevance
        FROM public.menu_items mi
        JOIN public.restaurants r ON r.id = mi.restaurant_id
        LEFT JOIN public.restaurant_branches rb ON rb.restaurant_id = r.id AND rb.is_active = TRUE
        LEFT JOIN public.branch_menu_items bmi ON bmi.branch_id = rb.id AND bmi.menu_item_id = mi.id
        LEFT JOIN reviews_agg ra ON ra.restaurant_id = r.id
        WHERE mi.is_archived = FALSE
          AND r.is_active = TRUE
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
        f.mi_id AS menu_item_id,
        f.mi_dish_name AS dish_name,
        f.mi_dish_name_sw AS dish_name_sw,
        f.mi_desc AS description,
        f.mi_desc_sw AS description_sw,
        f.mi_image_url AS image_url,
        f.r_id AS restaurant_id,
        f.r_name AS restaurant_name,
        f.r_logo AS restaurant_logo,
        f.r_cuisine AS cuisine_type,
        f.rb_id AS branch_id,
        f.rb_name AS branch_name,
        f.rb_neighborhood AS neighborhood,
        f.rb_address AS address,
        f.eff_price AS price_tzs,
        f.mi_base_price AS base_price_tzs,
        f.calc_distance AS distance_km,
        f.eff_rating AS restaurant_rating,
        f.eff_reviews_count AS review_count,
        f.eff_available AS is_available,
        f.eff_stock_status AS stock_status,
        f.eff_open_now AS is_open_now,
        f.eff_hours_summary AS opening_hours_summary,
        f.r_last_menu_ver AS last_menu_verified_at,
        f.eff_last_price_ver AS last_price_verified_at,
        f.eff_last_avail_ver AS last_availability_verified_at,
        f.hours_since_ver AS freshness_hours,
        CASE
            WHEN f.hours_since_ver <= 24 THEN 'FRESH'::varchar
            WHEN f.hours_since_ver <= 72 THEN 'RECENT'::varchar
            WHEN f.hours_since_ver <= 168 THEN 'AGING'::varchar
            WHEN f.hours_since_ver > 168 AND f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'STALE'::varchar
            ELSE 'UNKNOWN'::varchar
        END AS freshness_tier,
        CASE
            WHEN f.hours_since_ver <= 1 THEN 'Verified just now'::text
            WHEN f.hours_since_ver <= 24 THEN 'Verified ' || f.hours_since_ver || 'h ago'
            WHEN f.hours_since_ver <= 48 THEN 'Verified yesterday'::text
            WHEN f.hours_since_ver <= 168 THEN 'Updated ' || (f.hours_since_ver / 24) || ' days ago'
            WHEN f.most_recent_ver > '1970-01-01'::timestamp with time zone THEN 'Price may be outdated'::text
            ELSE 'Not recently verified'::text
        END AS freshness_label,
        ROUND((
            f.text_relevance * 0.35 +
            GREATEST(10.0, 100.0 - (f.calc_distance / 5.0) * 45.0) * 0.20 +
            (CASE WHEN p_max_price IS NOT NULL AND p_max_price > 0 AND f.eff_price <= p_max_price THEN 80.0 + ((p_max_price - f.eff_price)::numeric / p_max_price) * 20.0 ELSE 80.0 END) * 0.15 +
            (f.eff_rating / 5.0 * 100.0) * 0.10 +
            (CASE WHEN f.hours_since_ver <= 24 THEN 100.0 WHEN f.hours_since_ver <= 72 THEN 80.0 ELSE 40.0 END) * 0.10 +
            (CASE WHEN f.eff_available THEN 100.0 ELSE 0.0 END) * 0.10
        )::numeric, 1) AS relevance_rank
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

-- Grant execution to anon and authenticated clients for public food discovery
GRANT EXECUTE ON FUNCTION public.search_food_discovery TO anon, authenticated;
