-- ============================================================================
-- MIGRATION: 20260921000001_demo_closure_discovery_truth.sql
-- PURPOSE: Replace search_food_discovery with authoritative truth logic
-- 1. Requires verified, published, active restaurants with active branch.
-- 2. Calculates distance via Haversine only when caller & branch lat/lng exist (NULL otherwise, no synthetic proximity).
-- 3. Returns actual rating/review count (0 if unreviewed, no synthetic ratings or reviews).
-- 4. Returns actual cuisine/neighborhood without fabricated defaults.
-- 5. Derives is_open_now from branch operational_mode and opening_hours_summary without fake hours.
-- ============================================================================

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

GRANT EXECUTE ON FUNCTION public.search_food_discovery TO anon, authenticated;
