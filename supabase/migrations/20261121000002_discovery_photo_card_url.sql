-- ============================================================================
-- Migration: Add photo_card_url to search_food_discovery RPC
-- Enables fast 3G loading of pre-resized 400px card images in customer discovery
-- ============================================================================

DROP FUNCTION IF EXISTS public.search_food_discovery(TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, INTEGER, INTEGER, NUMERIC, BOOLEAN, BOOLEAN, TEXT[], TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN);

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
    photo_card_url TEXT,
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
            mi.photo_card_url::text AS mi_photo_card_url,
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
        f.mi_photo_card_url::text AS photo_card_url,
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
$$;

GRANT EXECUTE ON FUNCTION public.search_food_discovery TO anon, authenticated, service_role;
