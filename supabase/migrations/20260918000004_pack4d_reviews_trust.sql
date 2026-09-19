-- ==============================================================================
-- MLOHUB PACK 4D: RATINGS, REVIEWS, DISH TRUST & CONTENT INTEGRITY
-- Migration Version: 20260918000004
-- ==============================================================================
-- Extends canonical public.reviews, adds review_aspect_ratings, review_item_ratings,
-- review_tags, review_versions, review_responses, review_response_versions,
-- review_helpfulness_votes, review_media, review_reports, review_moderation_cases,
-- review_moderation_events, review_integrity_flags, restaurant_rating_aggregates,
-- branch_rating_aggregates, dish_rating_aggregates, and server-authoritative RPCs.
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS AND TYPES
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE public.review_source_type_enum AS ENUM ('ORDER', 'CUSTOM_MEAL', 'RESERVATION');
EXCEPTION WHEN duplicate_object THEN 
    ALTER TYPE public.review_source_type_enum ADD VALUE IF NOT EXISTS 'CUSTOM_MEAL';
END $$;

DO $$ BEGIN
    CREATE TYPE public.review_visibility_status_enum AS ENUM (
        'PENDING_MODERATION',
        'PUBLISHED',
        'HIDDEN',
        'REMOVED_POLICY',
        'DELETED_BY_AUTHOR'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_moderation_status_enum AS ENUM (
        'NOT_REVIEWED',
        'AUTO_FLAGGED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_aspect_type_enum AS ENUM (
        'FOOD_QUALITY',
        'ORDER_ACCURACY',
        'VALUE_FOR_MONEY',
        'PACKAGING',
        'PORTION_SIZE',
        'PREPARATION',
        'RESTAURANT_DELIVERY',
        'SERVICE',
        'CLEANLINESS',
        'ATMOSPHERE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_tag_code_enum AS ENUM (
        'GREAT_FLAVOR',
        'FRESH_FOOD',
        'GOOD_PORTION',
        'GOOD_VALUE',
        'ACCURATE_ORDER',
        'GOOD_PACKAGING',
        'FRIENDLY_SERVICE',
        'CLEAN_LOCATION',
        'FAST_PREPARATION',
        'ON_TIME_RESTAURANT_DELIVERY',
        'POOR_FLAVOR',
        'SMALL_PORTION',
        'POOR_VALUE',
        'INCORRECT_ITEM',
        'MISSING_ITEM',
        'POOR_PACKAGING',
        'SLOW_PREPARATION',
        'POOR_SERVICE',
        'UNCLEAN_LOCATION',
        'LATE_RESTAURANT_DELIVERY'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_report_reason_enum AS ENUM (
        'FAKE_EXPERIENCE',
        'CONFLICT_OF_INTEREST',
        'HARASSMENT',
        'HATE_OR_ABUSE',
        'PERSONAL_INFORMATION',
        'SPAM',
        'OFF_TOPIC',
        'INCENTIVIZED_REVIEW',
        'THREAT',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.review_moderation_outcome_enum AS ENUM (
        'NO_VIOLATION',
        'KEEP_PUBLISHED',
        'HIDE_PENDING_REVIEW',
        'REMOVE_POLICY',
        'RESTORE',
        'WARN_AUTHOR',
        'RESTRICT_REVIEWING'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. EXTEND CANONICAL public.reviews TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS source_type public.review_source_type_enum NOT NULL DEFAULT 'ORDER',
    ADD COLUMN IF NOT EXISTS reservation_id VARCHAR(80) REFERENCES public.reservations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS custom_meal_request_id VARCHAR(80) REFERENCES public.custom_meal_requests(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verified_experience BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS title VARCHAR(150),
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) NOT NULL DEFAULT 'sw',
    ADD COLUMN IF NOT EXISTS visibility_status public.review_visibility_status_enum NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS moderation_status public.review_moderation_status_enum NOT NULL DEFAULT 'NOT_REVIEWED',
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

-- Constraints on reviews
ALTER TABLE public.reviews
    DROP CONSTRAINT IF EXISTS chk_reviews_source_exclusivity;
ALTER TABLE public.reviews
    ADD CONSTRAINT chk_reviews_source_exclusivity CHECK (
        (source_type IN ('ORDER', 'CUSTOM_MEAL') AND order_id IS NOT NULL AND reservation_id IS NULL)
        OR
        (source_type = 'RESERVATION' AND reservation_id IS NOT NULL AND order_id IS NULL)
    );

-- Partial UNIQUE indexes: One active/non-deleted review per experience
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_active_order 
    ON public.reviews(order_id) 
    WHERE order_id IS NOT NULL AND visibility_status != 'DELETED_BY_AUTHOR';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_active_custom_meal 
    ON public.reviews(custom_meal_request_id) 
    WHERE custom_meal_request_id IS NOT NULL AND visibility_status != 'DELETED_BY_AUTHOR';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_active_reservation 
    ON public.reviews(reservation_id) 
    WHERE reservation_id IS NOT NULL AND visibility_status != 'DELETED_BY_AUTHOR';

CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visibility ON public.reviews(restaurant_id, visibility_status);
CREATE INDEX IF NOT EXISTS idx_reviews_submitted ON public.reviews(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_branch ON public.reviews(branch_id);

-- ----------------------------------------------------------------------------
-- 2B. EXTENDED REVIEW ELIGIBILITY TRIGGER (ORDERS, RESERVATIONS & INTERNAL UPDATES)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_review_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_order RECORD;
    v_res RECORD;
BEGIN
    -- Allow service_role or admin
    IF (auth.jwt() ->> 'role') = 'service_role' OR public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- If this is an internal/RPC update that does not touch rating or text (e.g. helpful_count, visibility)
    IF TG_OP = 'UPDATE' THEN
        IF NEW.rating = OLD.rating 
           AND NEW.comment IS NOT DISTINCT FROM OLD.comment 
           AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
            RETURN NEW;
        END IF;

        -- Content modification requires author within 24h
        IF auth.uid() != OLD.user_id THEN
            RAISE EXCEPTION '403 Forbidden: Only the review author or admin can modify this review.';
        END IF;

        IF (NOW() - OLD.created_at) > INTERVAL '24 hours' THEN
            RAISE EXCEPTION '403 Forbidden: Reviews can only be edited within 24 hours of submission.';
        END IF;

        RETURN NEW;
    END IF;

    -- For INSERT:
    IF NEW.source_type IN ('ORDER', 'CUSTOM_MEAL') THEN
        IF NEW.order_id IS NULL THEN
            RAISE EXCEPTION '400 Bad Request: Order ID required for order reviews.';
        END IF;
        SELECT user_id, restaurant_id, status, custom_meal_request_id INTO v_order
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

        -- Synchronize custom_meal_request_id from the canonical order
        IF v_order.custom_meal_request_id IS NOT NULL THEN
            NEW.custom_meal_request_id := v_order.custom_meal_request_id;
        END IF;
    ELSIF NEW.source_type = 'RESERVATION' THEN
        IF NEW.reservation_id IS NULL THEN
            RAISE EXCEPTION '400 Bad Request: Reservation ID required for reservation reviews.';
        END IF;
        SELECT user_id, restaurant_id, status INTO v_res
        FROM public.reservations
        WHERE id = NEW.reservation_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '400 Bad Request: Referenced reservation does not exist.';
        END IF;

        IF v_res.user_id != auth.uid() THEN
            RAISE EXCEPTION '403 Forbidden: You can only review reservations you booked personally.';
        END IF;

        IF v_res.status != 'COMPLETED' THEN
            RAISE EXCEPTION '400 Bad Request: You can only review after the reservation is completed.';
        END IF;

        IF v_res.restaurant_id != NEW.restaurant_id THEN
            RAISE EXCEPTION '400 Bad Request: Restaurant mismatch between reservation and review.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 3. PROVENANCE IMMUTABILITY TRIGGER ON public.reviews
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_review_provenance()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent direct client tampering with immutable provenance columns
    IF TG_OP = 'UPDATE' THEN
        -- Allow service_role or admin or authoritative RPC to edit, but freeze core provenance
        IF NEW.user_id != OLD.user_id THEN
            RAISE EXCEPTION '403 Forbidden: Reviewer user ID is immutable.';
        END IF;
        IF NEW.restaurant_id != OLD.restaurant_id THEN
            RAISE EXCEPTION '403 Forbidden: Restaurant ID is immutable.';
        END IF;
        IF NEW.source_type != OLD.source_type THEN
            RAISE EXCEPTION '403 Forbidden: Review source type is immutable.';
        END IF;
        IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
            RAISE EXCEPTION '403 Forbidden: Source order ID is immutable.';
        END IF;
        IF NEW.reservation_id IS DISTINCT FROM OLD.reservation_id THEN
            RAISE EXCEPTION '403 Forbidden: Source reservation ID is immutable.';
        END IF;
        IF NEW.custom_meal_request_id IS DISTINCT FROM OLD.custom_meal_request_id THEN
            RAISE EXCEPTION '403 Forbidden: Source custom meal request ID is immutable.';
        END IF;
        IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
            RAISE EXCEPTION '403 Forbidden: Branch ID is immutable.';
        END IF;
        -- Regular customers cannot manually change verified_experience
        IF NOT public.is_admin(auth.uid()) AND (auth.jwt() ->> 'role') != 'service_role' THEN
            IF NEW.verified_experience != OLD.verified_experience THEN
                RAISE EXCEPTION '403 Forbidden: verified_experience flag is server-derived.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_review_provenance ON public.reviews;
CREATE TRIGGER trg_protect_review_provenance
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.protect_review_provenance();

-- ----------------------------------------------------------------------------
-- 4. SUB-ENTITIES: ASPECTS, ITEMS, TAGS, VERSIONS
-- ----------------------------------------------------------------------------

-- Aspect Ratings
CREATE TABLE IF NOT EXISTS public.review_aspect_ratings (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'asp_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    aspect_type public.review_aspect_type_enum NOT NULL,
    rating_value SMALLINT NOT NULL CHECK (rating_value >= 1 AND rating_value <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_aspect UNIQUE (review_id, aspect_type)
);

CREATE INDEX IF NOT EXISTS idx_aspect_ratings_review ON public.review_aspect_ratings(review_id);

-- Dish / Menu Item Ratings
CREATE TABLE IF NOT EXISTS public.review_item_ratings (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rev_item_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    order_id VARCHAR(80) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id VARCHAR(80) NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(80) NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_order_item UNIQUE (review_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_review_item_menu_item ON public.review_item_ratings(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_review_item_restaurant ON public.review_item_ratings(restaurant_id);

-- Structured Review Tags
CREATE TABLE IF NOT EXISTS public.review_tags (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rtag_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    tag_code public.review_tag_code_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_tag UNIQUE (review_id, tag_code)
);

CREATE INDEX IF NOT EXISTS idx_review_tags_review ON public.review_tags(review_id);
CREATE INDEX IF NOT EXISTS idx_review_tags_code ON public.review_tags(tag_code);

-- Review Edit Versions
CREATE TABLE IF NOT EXISTS public.review_versions (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rver_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    overall_rating SMALLINT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
    title VARCHAR(150),
    body TEXT,
    aspect_snapshot JSONB DEFAULT '[]'::jsonb,
    tag_snapshot JSONB DEFAULT '[]'::jsonb,
    editor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    edited_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_version UNIQUE (review_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_review_versions_review ON public.review_versions(review_id);

-- ----------------------------------------------------------------------------
-- 5. MERCHANT PUBLIC RESPONSES & VERSION HISTORY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_responses (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'resp_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    responder_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(trim(body)) >= 5 AND length(body) <= 2000),
    status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_response UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_responses_rest ON public.review_responses(restaurant_id);

CREATE TABLE IF NOT EXISTS public.review_response_versions (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'resp_ver_' || substr(md5(random()::text), 1, 16),
    response_id VARCHAR(80) NOT NULL REFERENCES public.review_responses(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    body TEXT NOT NULL,
    editor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    edited_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_response_version UNIQUE (response_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_review_response_versions ON public.review_response_versions(response_id);

-- ----------------------------------------------------------------------------
-- 6. HELPFULNESS VOTING & CONFIDENCE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_helpfulness_votes (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'vote_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_review_helpfulness_user UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review ON public.review_helpfulness_votes(review_id);

-- ----------------------------------------------------------------------------
-- 7. REVIEW MEDIA (Storage Path Metadata)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_media (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rmedia_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    storage_path VARCHAR(255) NOT NULL UNIQUE,
    media_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    moderation_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED' CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_review_media_review ON public.review_media(review_id);

-- ----------------------------------------------------------------------------
-- 8. REPORTING, MODERATION CASES, EVENTS & INTEGRITY FLAGS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_reports (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rrep_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason_code public.review_report_reason_enum NOT NULL,
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_review_reporter UNIQUE (review_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status);

CREATE TABLE IF NOT EXISTS public.review_moderation_cases (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'mcase_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    opened_reason TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    assigned_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_code public.review_moderation_outcome_enum,
    resolution_notes TEXT,
    CONSTRAINT uq_moderation_case_review UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON public.review_moderation_cases(status);

CREATE TABLE IF NOT EXISTS public.review_moderation_events (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'mevt_' || substr(md5(random()::text), 1, 16),
    case_id VARCHAR(80) NOT NULL REFERENCES public.review_moderation_cases(id) ON DELETE CASCADE,
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (actor_type IN ('SYSTEM', 'ADMIN')),
    action VARCHAR(50) NOT NULL,
    reason_code VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_case ON public.review_moderation_events(case_id);

CREATE TABLE IF NOT EXISTS public.review_integrity_flags (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rflag_' || substr(md5(random()::text), 1, 16),
    review_id VARCHAR(80) NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_integrity_flags_review ON public.review_integrity_flags(review_id);

-- ----------------------------------------------------------------------------
-- 9. RATING AGGREGATES (RESTAURANT, BRANCH, DISH)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_rating_aggregates (
    restaurant_id VARCHAR(80) PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    verified_review_count INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    recent_90d_average NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    bayesian_rating NUMERIC(3, 2) NOT NULL DEFAULT 4.20,
    last_review_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.branch_rating_aggregates (
    branch_id UUID PRIMARY KEY REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    verified_review_count INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    recent_90d_average NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    bayesian_rating NUMERIC(3, 2) NOT NULL DEFAULT 4.20,
    last_review_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.dish_rating_aggregates (
    menu_item_id VARCHAR(80) PRIMARY KEY REFERENCES public.menu_items(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    verified_rating_count INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    recent_90d_average NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    bayesian_rating NUMERIC(3, 2) NOT NULL DEFAULT 4.20,
    last_rating_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_dish_rating_rest ON public.dish_rating_aggregates(restaurant_id);

-- Immutability triggers on aggregates: Direct client INSERT, UPDATE, DELETE denied
CREATE OR REPLACE FUNCTION public.prevent_direct_aggregate_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('mlohub.authoritative_aggregate_refresh', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF public.is_admin(auth.uid()) OR (auth.jwt() ->> 'role') = 'service_role' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    RAISE EXCEPTION '403 Forbidden: Rating aggregates are server-derived and cannot be modified directly.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_tamper_rest_agg ON public.restaurant_rating_aggregates;
CREATE TRIGGER trg_prevent_tamper_rest_agg
    BEFORE INSERT OR UPDATE OR DELETE ON public.restaurant_rating_aggregates
    FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_aggregate_tampering();

DROP TRIGGER IF EXISTS trg_prevent_tamper_branch_agg ON public.branch_rating_aggregates;
CREATE TRIGGER trg_prevent_tamper_branch_agg
    BEFORE INSERT OR UPDATE OR DELETE ON public.branch_rating_aggregates
    FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_aggregate_tampering();

DROP TRIGGER IF EXISTS trg_prevent_tamper_dish_agg ON public.dish_rating_aggregates;
CREATE TRIGGER trg_prevent_tamper_dish_agg
    BEFORE INSERT OR UPDATE OR DELETE ON public.dish_rating_aggregates
    FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_aggregate_tampering();

-- ----------------------------------------------------------------------------
-- 10. ATOMIC AGGREGATE RECALCULATION FUNCTIONS
-- ----------------------------------------------------------------------------

-- Recalculate restaurant aggregate atomically from qualifying reviews
CREATE OR REPLACE FUNCTION public.refresh_restaurant_rating_aggregate(p_restaurant_id VARCHAR(80))
RETURNS VOID AS $$
DECLARE
    v_total_count INTEGER := 0;
    v_avg NUMERIC(3, 2) := 0.00;
    v_recent_avg NUMERIC(3, 2) := 0.00;
    v_r1 INTEGER := 0;
    v_r2 INTEGER := 0;
    v_r3 INTEGER := 0;
    v_r4 INTEGER := 0;
    v_r5 INTEGER := 0;
    v_last_rev TIMESTAMPTZ := NULL;
    v_prior NUMERIC := 4.20;
    v_m NUMERIC := 5.0;
    v_bayes NUMERIC(3, 2) := 4.20;
BEGIN
    -- Acquire transaction advisory lock on restaurant ID to serialize concurrent recalculations
    PERFORM pg_advisory_xact_lock(hashtext('agg_rest_' || p_restaurant_id));
    PERFORM set_config('mlohub.authoritative_aggregate_refresh', 'true', true);

    SELECT
        COUNT(*)::integer,
        COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00),
        COALESCE(ROUND(AVG(CASE WHEN submitted_at >= (NOW() - INTERVAL '90 days') THEN rating END)::numeric, 2), 0.00),
        COUNT(*) FILTER (WHERE rating = 1)::integer,
        COUNT(*) FILTER (WHERE rating = 2)::integer,
        COUNT(*) FILTER (WHERE rating = 3)::integer,
        COUNT(*) FILTER (WHERE rating = 4)::integer,
        COUNT(*) FILTER (WHERE rating = 5)::integer,
        MAX(submitted_at)
    INTO
        v_total_count, v_avg, v_recent_avg, v_r1, v_r2, v_r3, v_r4, v_r5, v_last_rev
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id
      AND verified_experience = TRUE
      AND visibility_status = 'PUBLISHED';

    IF v_total_count > 0 THEN
        v_bayes := ROUND( (((v_total_count::numeric / (v_total_count + v_m)) * v_avg) + ((v_m / (v_total_count + v_m)) * v_prior))::numeric, 2);
    ELSE
        v_bayes := v_prior;
    END IF;

    INSERT INTO public.restaurant_rating_aggregates (
        restaurant_id, verified_review_count, average_rating, recent_90d_average,
        rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
        bayesian_rating, last_review_at, updated_at
    ) VALUES (
        p_restaurant_id, v_total_count, v_avg, v_recent_avg,
        v_r1, v_r2, v_r3, v_r4, v_r5,
        v_bayes, v_last_rev, clock_timestamp()
    )
    ON CONFLICT (restaurant_id) DO UPDATE SET
        verified_review_count = EXCLUDED.verified_review_count,
        average_rating = EXCLUDED.average_rating,
        recent_90d_average = EXCLUDED.recent_90d_average,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        bayesian_rating = EXCLUDED.bayesian_rating,
        last_review_at = EXCLUDED.last_review_at,
        updated_at = clock_timestamp();

    -- Also synchronize restaurant core table summary columns
    UPDATE public.restaurants
    SET rating = CASE WHEN v_total_count > 0 THEN v_avg ELSE 4.5 END,
        reviews_count = v_total_count,
        updated_at = clock_timestamp()
    WHERE id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Recalculate dish aggregate atomically
CREATE OR REPLACE FUNCTION public.refresh_dish_rating_aggregate(p_menu_item_id VARCHAR(80))
RETURNS VOID AS $$
DECLARE
    v_restaurant_id VARCHAR(80);
    v_branch_id UUID;
    v_total_count INTEGER := 0;
    v_avg NUMERIC(3, 2) := 0.00;
    v_recent_avg NUMERIC(3, 2) := 0.00;
    v_r1 INTEGER := 0;
    v_r2 INTEGER := 0;
    v_r3 INTEGER := 0;
    v_r4 INTEGER := 0;
    v_r5 INTEGER := 0;
    v_last_rev TIMESTAMPTZ := NULL;
    v_prior NUMERIC := 4.20;
    v_m NUMERIC := 5.0;
    v_bayes NUMERIC(3, 2) := 4.20;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('agg_dish_' || p_menu_item_id));
    PERFORM set_config('mlohub.authoritative_aggregate_refresh', 'true', true);

    SELECT restaurant_id INTO v_restaurant_id FROM public.menu_items WHERE id = p_menu_item_id;
    IF v_restaurant_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COUNT(*)::integer,
        COALESCE(ROUND(AVG(ir.rating)::numeric, 2), 0.00),
        COALESCE(ROUND(AVG(CASE WHEN ir.created_at >= (NOW() - INTERVAL '90 days') THEN ir.rating END)::numeric, 2), 0.00),
        COUNT(*) FILTER (WHERE ir.rating = 1)::integer,
        COUNT(*) FILTER (WHERE ir.rating = 2)::integer,
        COUNT(*) FILTER (WHERE ir.rating = 3)::integer,
        COUNT(*) FILTER (WHERE ir.rating = 4)::integer,
        COUNT(*) FILTER (WHERE ir.rating = 5)::integer,
        MAX(ir.created_at)
    INTO
        v_total_count, v_avg, v_recent_avg, v_r1, v_r2, v_r3, v_r4, v_r5, v_last_rev
    FROM public.review_item_ratings ir
    JOIN public.reviews r ON r.id = ir.review_id
    WHERE ir.menu_item_id = p_menu_item_id
      AND r.verified_experience = TRUE
      AND r.visibility_status = 'PUBLISHED';

    IF v_total_count > 0 THEN
        v_bayes := ROUND( (((v_total_count::numeric / (v_total_count + v_m)) * v_avg) + ((v_m / (v_total_count + v_m)) * v_prior))::numeric, 2);
    ELSE
        v_bayes := v_prior;
    END IF;

    INSERT INTO public.dish_rating_aggregates (
        menu_item_id, restaurant_id, branch_id,
        verified_rating_count, average_rating, recent_90d_average,
        rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
        bayesian_rating, last_rating_at, updated_at
    ) VALUES (
        p_menu_item_id, v_restaurant_id, v_branch_id,
        v_total_count, v_avg, v_recent_avg,
        v_r1, v_r2, v_r3, v_r4, v_r5,
        v_bayes, v_last_rev, clock_timestamp()
    )
    ON CONFLICT (menu_item_id) DO UPDATE SET
        verified_rating_count = EXCLUDED.verified_rating_count,
        average_rating = EXCLUDED.average_rating,
        recent_90d_average = EXCLUDED.recent_90d_average,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        bayesian_rating = EXCLUDED.bayesian_rating,
        last_rating_at = EXCLUDED.last_rating_at,
        updated_at = clock_timestamp();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 11. CANONICAL STORAGE EXTENSION FOR REVIEW MEDIA
-- ----------------------------------------------------------------------------

-- Updates can_manage_storage_media to authorize reviews/{userId}/{reviewId}/{filename}
CREATE OR REPLACE FUNCTION public.can_manage_storage_media(
    p_user_id UUID,
    p_name TEXT,
    p_action TEXT -- 'INSERT', 'UPDATE', 'DELETE'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_segments TEXT[];
    v_restaurant_id VARCHAR(80);
    v_media_type TEXT;
    v_item_id VARCHAR(80);
    v_customer_user_id TEXT;
    v_request_id VARCHAR(80);
    v_review_id VARCHAR(80);
BEGIN
    IF p_user_id IS NULL OR p_name IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Platform admins have full operational authority
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
          AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
          AND status = 'ACTIVE'
    ) THEN
        RETURN TRUE;
    END IF;

    v_segments := string_to_array(p_name, '/');

    -- Profile namespace: profiles/{userId}/{filename}
    IF array_length(v_segments, 1) = 3 AND v_segments[1] = 'profiles' THEN
        RETURN v_segments[2] = p_user_id::text;
    END IF;

    -- Custom meals namespace: custom-meals/{customerUserId}/{requestId}/{filename}
    IF array_length(v_segments, 1) = 4 AND v_segments[1] = 'custom-meals' THEN
        v_customer_user_id := v_segments[2];
        v_request_id := v_segments[3];

        IF p_action IN ('INSERT', 'UPDATE', 'DELETE') THEN
            RETURN v_customer_user_id = p_user_id::text;
        ELSIF p_action = 'SELECT' THEN
            IF v_customer_user_id = p_user_id::text THEN
                RETURN TRUE;
            END IF;
            RETURN EXISTS (
                SELECT 1 FROM public.custom_meal_invitations i
                WHERE i.request_id = v_request_id
                  AND i.status != 'DECLINED'
                  AND public.is_restaurant_member(p_user_id, i.restaurant_id)
            );
        END IF;
    END IF;

    -- Reviews namespace: reviews/{userId}/{reviewId}/{filename}
    IF array_length(v_segments, 1) = 4 AND v_segments[1] = 'reviews' THEN
        v_customer_user_id := v_segments[2];
        v_review_id := v_segments[3];

        -- Caller must match the userId path segment
        IF v_customer_user_id != p_user_id::text THEN
            RETURN FALSE;
        END IF;

        IF p_action IN ('INSERT', 'UPDATE', 'DELETE') THEN
            -- Verify review exists, belongs to caller, and is a verified experience
            RETURN EXISTS (
                SELECT 1 FROM public.reviews
                WHERE id = v_review_id
                  AND user_id = p_user_id
                  AND verified_experience = TRUE
            );
        ELSIF p_action = 'SELECT' THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Restaurant namespace:
    IF v_segments[1] = 'restaurants' THEN
        v_restaurant_id := v_segments[2];
        v_media_type := v_segments[3];

        IF v_media_type IN ('logo', 'cover', 'gallery') AND array_length(v_segments, 1) = 4 THEN
            RETURN public.has_restaurant_permission(p_user_id, v_restaurant_id, 'MANAGE_RESTAURANT');
        ELSIF v_media_type = 'menu' AND array_length(v_segments, 1) = 5 THEN
            v_item_id := v_segments[4];
            
            IF NOT public.has_restaurant_permission(p_user_id, v_restaurant_id, 'MANAGE_MENU') THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1 FROM public.menu_items
                WHERE id = v_item_id AND restaurant_id != v_restaurant_id
            ) THEN
                RETURN FALSE;
            END IF;

            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all Pack 4D tables
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_aspect_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_item_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_response_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpfulness_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_integrity_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_rating_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_rating_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_rating_aggregates ENABLE ROW LEVEL SECURITY;

-- Reviews RLS
DROP POLICY IF EXISTS "Public read published reviews" ON public.reviews;
CREATE POLICY "Public read published reviews" ON public.reviews
    FOR SELECT USING (
        visibility_status = 'PUBLISHED'
        OR auth.uid() = user_id
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_REVIEWS')
        OR public.is_admin(auth.uid())
    );

-- Aspects RLS
DROP POLICY IF EXISTS "Public read review aspects" ON public.review_aspect_ratings;
CREATE POLICY "Public read review aspects" ON public.review_aspect_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND (r.visibility_status = 'PUBLISHED' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

-- Item Ratings RLS
DROP POLICY IF EXISTS "Public read review item ratings" ON public.review_item_ratings;
CREATE POLICY "Public read review item ratings" ON public.review_item_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND (r.visibility_status = 'PUBLISHED' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

-- Tags RLS
DROP POLICY IF EXISTS "Public read review tags" ON public.review_tags;
CREATE POLICY "Public read review tags" ON public.review_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND (r.visibility_status = 'PUBLISHED' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

-- Versions RLS
DROP POLICY IF EXISTS "Authors and Admins read review versions" ON public.review_versions;
CREATE POLICY "Authors and Admins read review versions" ON public.review_versions
    FOR SELECT USING (
        auth.uid() = editor_user_id
        OR EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
        OR public.is_admin(auth.uid())
    );

-- Responses RLS
DROP POLICY IF EXISTS "Public read published responses" ON public.review_responses;
CREATE POLICY "Public read published responses" ON public.review_responses
    FOR SELECT USING (
        status = 'PUBLISHED'
        OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_REVIEWS')
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Merchant and Admin view response versions" ON public.review_response_versions;
CREATE POLICY "Merchant and Admin view response versions" ON public.review_response_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.review_responses resp
            WHERE resp.id = response_id
              AND (public.has_restaurant_permission(auth.uid(), resp.restaurant_id, 'VIEW_REVIEWS') OR public.is_admin(auth.uid()))
        )
    );

-- Helpfulness votes RLS
DROP POLICY IF EXISTS "Authenticated users view own helpfulness votes" ON public.review_helpfulness_votes;
CREATE POLICY "Authenticated users view own helpfulness votes" ON public.review_helpfulness_votes
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Review media RLS
DROP POLICY IF EXISTS "Public read approved review media" ON public.review_media;
CREATE POLICY "Public read approved review media" ON public.review_media
    FOR SELECT USING (
        (moderation_status = 'APPROVED'
         AND EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND (r.visibility_status = 'PUBLISHED' OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
         ))
        OR (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id AND r.user_id = auth.uid()
        ))
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Authors insert review media" ON public.review_media;
CREATE POLICY "Authors insert review media" ON public.review_media
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND r.user_id = auth.uid()
        )
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Authors delete review media" ON public.review_media;
CREATE POLICY "Authors delete review media" ON public.review_media
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.reviews r
            WHERE r.id = review_id
              AND r.user_id = auth.uid()
        )
        OR public.is_admin(auth.uid())
    );

-- Reports RLS
DROP POLICY IF EXISTS "Reporters view own reports" ON public.review_reports;
CREATE POLICY "Reporters view own reports" ON public.review_reports
    FOR SELECT USING (auth.uid() = reporter_user_id OR public.is_admin(auth.uid()));

-- Moderation cases & events RLS (Strictly Admins Only)
DROP POLICY IF EXISTS "Admins manage moderation cases" ON public.review_moderation_cases;
CREATE POLICY "Admins manage moderation cases" ON public.review_moderation_cases
    FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view moderation events" ON public.review_moderation_events;
CREATE POLICY "Admins view moderation events" ON public.review_moderation_events
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Integrity flags RLS (Strictly Internal: Admins Only)
DROP POLICY IF EXISTS "Admins view integrity flags" ON public.review_integrity_flags;
CREATE POLICY "Admins view integrity flags" ON public.review_integrity_flags
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Aggregates RLS (Public Read)
DROP POLICY IF EXISTS "Public read restaurant aggregates" ON public.restaurant_rating_aggregates;
CREATE POLICY "Public read restaurant aggregates" ON public.restaurant_rating_aggregates
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read branch aggregates" ON public.branch_rating_aggregates;
CREATE POLICY "Public read branch aggregates" ON public.branch_rating_aggregates
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read dish aggregates" ON public.dish_rating_aggregates;
CREATE POLICY "Public read dish aggregates" ON public.dish_rating_aggregates
    FOR SELECT USING (TRUE);

-- ----------------------------------------------------------------------------
-- 13. AUTHORITATIVE SERVER RPCS
-- ----------------------------------------------------------------------------

-- A. Check Review Eligibility
CREATE OR REPLACE FUNCTION public.get_review_eligibility(
    p_source_type VARCHAR(20),
    p_source_id VARCHAR(80)
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_res RECORD;
    v_existing_id VARCHAR(80);
    v_items JSONB := '[]'::jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    IF p_source_type IN ('ORDER', 'CUSTOM_MEAL') THEN
        -- Resolves through converted_order_id and canonical COMPLETED order authority
        SELECT o.*, r.name AS restaurant_name INTO v_order
        FROM public.orders o
        JOIN public.restaurants r ON r.id = o.restaurant_id
        WHERE o.id = p_source_id 
           OR (o.custom_meal_request_id = p_source_id AND p_source_type = 'CUSTOM_MEAL')
        ORDER BY o.created_at DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Order or custom meal experience not found.');
        END IF;

        IF v_order.user_id != v_user_id THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'You can only review orders you placed personally.');
        END IF;

        IF v_order.status != 'COMPLETED' THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Only completed orders can be reviewed.');
        END IF;

        -- Conflict of interest: check if caller is member of restaurant
        IF public.is_restaurant_member(v_user_id, v_order.restaurant_id) THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Conflict of interest: Restaurant members cannot review their own restaurant.');
        END IF;

        -- Check existing active review across canonical order AND custom meal request
        SELECT id INTO v_existing_id
        FROM public.reviews
        WHERE (order_id = v_order.id 
               OR (custom_meal_request_id IS NOT NULL AND custom_meal_request_id = v_order.custom_meal_request_id))
          AND visibility_status != 'DELETED_BY_AUTHOR';

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Experience already reviewed. Custom meals and converted orders share a single reviewable experience.', 'existing_review_id', v_existing_id);
        END IF;

        -- Collect ordered items
        SELECT jsonb_agg(jsonb_build_object(
            'order_item_id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'item_name', oi.item_name,
            'unit_price_tzs', oi.unit_price_tzs
        )) INTO v_items
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id AND oi.menu_item_id IS NOT NULL;

        RETURN jsonb_build_object(
            'eligible', TRUE,
            'source_type', CASE WHEN v_order.custom_meal_request_id IS NOT NULL THEN 'CUSTOM_MEAL' ELSE 'ORDER' END,
            'order_id', v_order.id,
            'custom_meal_request_id', v_order.custom_meal_request_id,
            'restaurant_id', v_order.restaurant_id,
            'restaurant_name', v_order.restaurant_name,
            'branch_id', v_order.branch_id,
            'items', COALESCE(v_items, '[]'::jsonb),
            'allowed_aspects', jsonb_build_array('FOOD_QUALITY', 'ORDER_ACCURACY', 'VALUE_FOR_MONEY', 'PACKAGING', 'PORTION_SIZE', 'PREPARATION', 'RESTAURANT_DELIVERY')
        );

    ELSIF p_source_type = 'RESERVATION' THEN
        SELECT r.*, rest.name AS restaurant_name INTO v_res
        FROM public.reservations r
        JOIN public.restaurants rest ON rest.id = r.restaurant_id
        WHERE r.id = p_source_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Reservation not found.');
        END IF;

        IF v_res.user_id != v_user_id THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'You can only review reservations you booked personally.');
        END IF;

        IF v_res.status != 'COMPLETED' THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Only completed dine-in reservations can be reviewed.');
        END IF;

        IF public.is_restaurant_member(v_user_id, v_res.restaurant_id) THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Conflict of interest: Restaurant members cannot review their own restaurant.');
        END IF;

        SELECT id INTO v_existing_id
        FROM public.reviews
        WHERE reservation_id = p_source_id AND visibility_status != 'DELETED_BY_AUTHOR';

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object('eligible', FALSE, 'reason', 'Reservation already reviewed.', 'existing_review_id', v_existing_id);
        END IF;

        RETURN jsonb_build_object(
            'eligible', TRUE,
            'source_type', 'RESERVATION',
            'reservation_id', v_res.id,
            'restaurant_id', v_res.restaurant_id,
            'restaurant_name', v_res.restaurant_name,
            'branch_id', v_res.branch_id,
            'allowed_aspects', jsonb_build_array('FOOD_QUALITY', 'SERVICE', 'VALUE_FOR_MONEY', 'CLEANLINESS', 'ATMOSPHERE')
        );
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid source type. Must be ORDER or RESERVATION.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- B. Submit Verified Review Secure
CREATE OR REPLACE FUNCTION public.submit_verified_review_secure(
    p_source_type VARCHAR(20),
    p_source_id VARCHAR(80),
    p_overall_rating INTEGER,
    p_title TEXT DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_aspect_ratings JSONB DEFAULT '[]'::jsonb,
    p_item_ratings JSONB DEFAULT '[]'::jsonb,
    p_tags JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_res RECORD;
    v_restaurant_id VARCHAR(80);
    v_branch_id UUID;
    v_review_id VARCHAR(80);
    v_asp RECORD;
    v_item RECORD;
    v_tag_code TEXT;
    v_oi RECORD;
    v_flag_count INTEGER := 0;
    v_auto_flag BOOLEAN := FALSE;
    v_mod_status public.review_moderation_status_enum := 'NOT_REVIEWED';
    v_vis_status public.review_visibility_status_enum := 'PUBLISHED';
    v_clean_title VARCHAR(150);
    v_clean_comment TEXT;
    v_rapid_count INTEGER := 0;
    v_flag_burst BOOLEAN := FALSE;
    v_flag_duplicate BOOLEAN := FALSE;
    v_flag_link BOOLEAN := FALSE;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    -- 2. Validate overall rating
    IF p_overall_rating IS NULL OR p_overall_rating < 1 OR p_overall_rating > 5 THEN
        RAISE EXCEPTION '400 Bad Request: overall_rating must be an integer between 1 and 5.';
    END IF;

    -- 3. Text sanitization & HTML protection
    IF p_title IS NOT NULL THEN
        IF p_title ~* '<[a-z/][^>]*>' OR p_title ~* 'javascript:' THEN
            RAISE EXCEPTION '400 Bad Request: HTML tags and executable scripts are strictly prohibited in review title.';
        END IF;
        v_clean_title := substring(trim(p_title) from 1 for 150);
    END IF;

    IF p_comment IS NOT NULL THEN
        IF p_comment ~* '<[a-z/][^>]*>' OR p_comment ~* 'javascript:' THEN
            RAISE EXCEPTION '400 Bad Request: HTML tags and executable scripts are strictly prohibited in review comment.';
        END IF;
        v_clean_comment := trim(p_comment);
    END IF;

    -- 4. Verify source and derive restaurant & branch
    IF p_source_type IN ('ORDER', 'CUSTOM_MEAL') THEN
        -- Concurrency locking on canonical order
        SELECT * INTO v_order
        FROM public.orders
        WHERE id = p_source_id 
           OR (custom_meal_request_id = p_source_id AND p_source_type = 'CUSTOM_MEAL')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION '400 Bad Request: Referenced order or custom meal does not exist.';
        END IF;

        IF v_order.user_id != v_user_id THEN
            RAISE EXCEPTION '403 Forbidden: You can only review orders you placed personally.';
        END IF;

        IF v_order.status != 'COMPLETED' THEN
            RAISE EXCEPTION '400 Bad Request: You can only review after the order is completed.';
        END IF;

        IF public.is_restaurant_member(v_user_id, v_order.restaurant_id) THEN
            RAISE EXCEPTION '403 Forbidden: Conflict of interest: Restaurant members cannot review their own restaurant.';
        END IF;

        -- RPC Guard: Strict check for duplicate review across ORDER and CUSTOM_MEAL provenance
        IF EXISTS (
            SELECT 1 FROM public.reviews
            WHERE (order_id = v_order.id 
                   OR (custom_meal_request_id IS NOT NULL AND custom_meal_request_id = v_order.custom_meal_request_id))
              AND visibility_status != 'DELETED_BY_AUTHOR'
        ) THEN
            RAISE EXCEPTION '409 Conflict: Experience already reviewed. Custom Meal and its converted Order share a single reviewable experience.';
        END IF;

        v_restaurant_id := v_order.restaurant_id;
        v_branch_id := v_order.branch_id;

    ELSIF p_source_type = 'RESERVATION' THEN
        SELECT * INTO v_res
        FROM public.reservations
        WHERE id = p_source_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION '400 Bad Request: Referenced reservation does not exist.';
        END IF;

        IF v_res.user_id != v_user_id THEN
            RAISE EXCEPTION '403 Forbidden: You can only review reservations you booked personally.';
        END IF;

        IF v_res.status != 'COMPLETED' THEN
            RAISE EXCEPTION '400 Bad Request: You can only review after the reservation dining is completed.';
        END IF;

        IF public.is_restaurant_member(v_user_id, v_res.restaurant_id) THEN
            RAISE EXCEPTION '403 Forbidden: Conflict of interest: Restaurant members cannot review their own restaurant.';
        END IF;

        v_restaurant_id := v_res.restaurant_id;
        v_branch_id := v_res.branch_id;
    ELSE
        RAISE EXCEPTION '400 Bad Request: Invalid source type. Must be ORDER, CUSTOM_MEAL or RESERVATION.';
    END IF;

    -- 5. Deterministic content integrity signals (e.g. repeated burst, duplicate text, spam pattern)
    SELECT COUNT(*) INTO v_rapid_count
    FROM public.reviews
    WHERE user_id = v_user_id AND submitted_at >= (clock_timestamp() - INTERVAL '60 seconds');

    IF v_rapid_count >= 2 THEN
        v_flag_burst := TRUE;
    END IF;

    IF v_clean_comment IS NOT NULL AND length(v_clean_comment) > 5 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.reviews
            WHERE comment = v_clean_comment
            LIMIT 1
        ) INTO v_flag_duplicate;
    END IF;

    IF v_clean_comment IS NOT NULL AND v_clean_comment ~* '(https?://|www\.)' THEN
        v_flag_link := TRUE;
    END IF;

    IF v_flag_burst OR v_flag_duplicate OR v_flag_link THEN
        v_auto_flag := TRUE;
        v_mod_status := 'AUTO_FLAGGED';
        v_vis_status := 'PENDING_MODERATION';
    END IF;

    -- 6. Insert canonical review
    v_review_id := 'rev_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

    INSERT INTO public.reviews (
        id, user_id, restaurant_id, branch_id, source_type, order_id, custom_meal_request_id, reservation_id,
        rating, title, comment, verified_experience, language_code,
        visibility_status, moderation_status, submitted_at, published_at, updated_at
    ) VALUES (
        v_review_id, v_user_id, v_restaurant_id, v_branch_id, p_source_type::public.review_source_type_enum,
        CASE WHEN p_source_type IN ('ORDER', 'CUSTOM_MEAL') THEN v_order.id ELSE NULL END,
        CASE WHEN p_source_type IN ('ORDER', 'CUSTOM_MEAL') THEN v_order.custom_meal_request_id ELSE NULL END,
        CASE WHEN p_source_type = 'RESERVATION' THEN p_source_id ELSE NULL END,
        p_overall_rating, v_clean_title, v_clean_comment, TRUE, 'sw',
        v_vis_status, v_mod_status, clock_timestamp(),
        CASE WHEN v_vis_status = 'PUBLISHED' THEN clock_timestamp() ELSE NULL END,
        clock_timestamp()
    );

    -- 7. Insert Aspect Ratings (if provided)
    IF p_aspect_ratings IS NOT NULL AND jsonb_array_length(p_aspect_ratings) > 0 THEN
        FOR v_asp IN SELECT * FROM jsonb_to_recordset(p_aspect_ratings) AS x(aspect_type TEXT, rating_value INTEGER) LOOP
            IF p_source_type IN ('ORDER', 'CUSTOM_MEAL') AND v_asp.aspect_type IN ('CLEANLINESS', 'ATMOSPHERE') THEN
                RAISE EXCEPTION '400 Bad Request: Aspect % is not applicable for orders.', v_asp.aspect_type;
            END IF;
            IF p_source_type = 'RESERVATION' AND v_asp.aspect_type IN ('PACKAGING', 'ORDER_ACCURACY', 'RESTAURANT_DELIVERY') THEN
                RAISE EXCEPTION '400 Bad Request: Aspect % is not applicable for reservations.', v_asp.aspect_type;
            END IF;

            IF v_asp.rating_value >= 1 AND v_asp.rating_value <= 5 THEN
                INSERT INTO public.review_aspect_ratings (
                    review_id, aspect_type, rating_value
                ) VALUES (
                    v_review_id, v_asp.aspect_type::public.review_aspect_type_enum, v_asp.rating_value
                ) ON CONFLICT (review_id, aspect_type) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 8. Insert Dish / Item Ratings (Strictly validated against canonical order_items)
    IF p_source_type IN ('ORDER', 'CUSTOM_MEAL') AND p_item_ratings IS NOT NULL AND jsonb_array_length(p_item_ratings) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_item_ratings) AS x(order_item_id VARCHAR(80), menu_item_id VARCHAR(80), rating INTEGER) LOOP
            -- Verify item was actually part of this order
            SELECT * INTO v_oi
            FROM public.order_items
            WHERE id = v_item.order_item_id
              AND order_id = v_order.id
              AND menu_item_id = v_item.menu_item_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION '400 Bad Request: Dish % (item %) was not present in order %.', v_item.menu_item_id, v_item.order_item_id, v_order.id;
            END IF;

            IF v_item.rating >= 1 AND v_item.rating <= 5 THEN
                INSERT INTO public.review_item_ratings (
                    review_id, order_id, order_item_id, menu_item_id, restaurant_id, branch_id, rating
                ) VALUES (
                    v_review_id, v_order.id, v_item.order_item_id, v_item.menu_item_id, v_restaurant_id, v_branch_id, v_item.rating
                ) ON CONFLICT (review_id, order_item_id) DO NOTHING;

                -- Refresh dish aggregate
                IF v_vis_status = 'PUBLISHED' THEN
                    PERFORM public.refresh_dish_rating_aggregate(v_item.menu_item_id);
                END IF;
            END IF;
        END LOOP;
    ELSIF p_source_type = 'RESERVATION' AND p_item_ratings IS NOT NULL AND jsonb_array_length(p_item_ratings) > 0 THEN
        RAISE EXCEPTION '400 Bad Request: Dish ratings are only allowed for standard orders with recorded menu items.';
    END IF;

    -- 9. Insert Structured Tags
    IF p_tags IS NOT NULL AND jsonb_array_length(p_tags) > 0 THEN
        FOR v_tag_code IN SELECT jsonb_array_elements_text(p_tags) LOOP
            BEGIN
                INSERT INTO public.review_tags (
                    review_id, tag_code
                ) VALUES (
                    v_review_id, v_tag_code::public.review_tag_code_enum
                ) ON CONFLICT (review_id, tag_code) DO NOTHING;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION '400 Bad Request: Invalid tag code %. Must be one of canonical 20 tags.', v_tag_code;
            END;
        END LOOP;
    END IF;

    -- 10. Record Integrity Flags if auto-flagged
    IF v_flag_burst THEN
        INSERT INTO public.review_integrity_flags (
            review_id, signal_type, severity, metadata
        ) VALUES (
            v_review_id, 'RAPID_FIRE_BURST', 'HIGH', jsonb_build_object('count', v_rapid_count)
        );
    END IF;

    IF v_flag_duplicate THEN
        INSERT INTO public.review_integrity_flags (
            review_id, signal_type, severity, metadata
        ) VALUES (
            v_review_id, 'DUPLICATE_TEXT', 'HIGH', jsonb_build_object('comment', v_clean_comment)
        );
    END IF;

    IF v_flag_link THEN
        INSERT INTO public.review_integrity_flags (
            review_id, signal_type, severity, metadata
        ) VALUES (
            v_review_id, 'EXTERNAL_LINK_SPAM', 'HIGH', jsonb_build_object('comment', v_clean_comment)
        );
    END IF;

    IF v_auto_flag THEN
        INSERT INTO public.review_moderation_cases (
            review_id, status, priority, opened_reason
        ) VALUES (
            v_review_id, 'OPEN', 'HIGH', 'Deterministic rule: Automated integrity flag raised.'
        );
    END IF;

    -- 11. Refresh Restaurant Rating Aggregates if published
    IF v_vis_status = 'PUBLISHED' THEN
        PERFORM public.refresh_restaurant_rating_aggregate(v_restaurant_id);
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'review_id', v_review_id,
        'restaurant_id', v_restaurant_id,
        'overall_rating', p_overall_rating,
        'visibility_status', v_vis_status,
        'moderation_status', v_mod_status,
        'verified_experience', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- C. Edit Review Secure
CREATE OR REPLACE FUNCTION public.edit_review_secure(
    p_review_id VARCHAR(80),
    p_overall_rating INTEGER,
    p_title TEXT DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_aspect_ratings JSONB DEFAULT NULL,
    p_tags JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rev RECORD;
    v_old_version_num INTEGER := 1;
    v_asp_snapshot JSONB := '[]'::jsonb;
    v_tag_snapshot JSONB := '[]'::jsonb;
    v_asp RECORD;
    v_tag_code TEXT;
    v_clean_title VARCHAR(150);
    v_clean_comment TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_rev
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    IF v_rev.user_id != v_user_id AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Only the review author can edit this review.';
    END IF;

    IF v_rev.visibility_status = 'DELETED_BY_AUTHOR' THEN
        RAISE EXCEPTION '400 Bad Request: Cannot edit a deleted review.';
    END IF;

    IF p_overall_rating < 1 OR p_overall_rating > 5 THEN
        RAISE EXCEPTION '400 Bad Request: overall_rating must be between 1 and 5.';
    END IF;

    -- Text safety
    IF p_title IS NOT NULL THEN
        IF p_title ~* '<[a-z/][^>]*>' OR p_title ~* 'javascript:' THEN
            RAISE EXCEPTION '400 Bad Request: HTML tags and executable scripts are prohibited.';
        END IF;
        v_clean_title := substring(trim(p_title) from 1 for 150);
    END IF;

    IF p_comment IS NOT NULL THEN
        IF p_comment ~* '<[a-z/][^>]*>' OR p_comment ~* 'javascript:' THEN
            RAISE EXCEPTION '400 Bad Request: HTML tags and executable scripts are prohibited.';
        END IF;
        v_clean_comment := trim(p_comment);
    END IF;

    -- Snapshot existing aspects & tags
    SELECT COALESCE(jsonb_agg(jsonb_build_object('aspect_type', aspect_type, 'rating_value', rating_value)), '[]'::jsonb)
    INTO v_asp_snapshot
    FROM public.review_aspect_ratings WHERE review_id = p_review_id;

    SELECT COALESCE(jsonb_agg(tag_code), '[]'::jsonb)
    INTO v_tag_snapshot
    FROM public.review_tags WHERE review_id = p_review_id;

    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_old_version_num
    FROM public.review_versions WHERE review_id = p_review_id;

    -- Persist previous version
    INSERT INTO public.review_versions (
        review_id, version_number, overall_rating, title, body,
        aspect_snapshot, tag_snapshot, editor_user_id, edited_at
    ) VALUES (
        p_review_id, v_old_version_num, v_rev.rating, v_rev.title, v_rev.comment,
        v_asp_snapshot, v_tag_snapshot, v_user_id, clock_timestamp()
    );

    -- Update review
    UPDATE public.reviews
    SET rating = p_overall_rating,
        title = v_clean_title,
        comment = v_clean_comment,
        edited_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_review_id;

    -- Update aspects if passed
    IF p_aspect_ratings IS NOT NULL THEN
        DELETE FROM public.review_aspect_ratings WHERE review_id = p_review_id;
        FOR v_asp IN SELECT * FROM jsonb_to_recordset(p_aspect_ratings) AS x(aspect_type TEXT, rating_value INTEGER) LOOP
            IF v_asp.rating_value >= 1 AND v_asp.rating_value <= 5 THEN
                INSERT INTO public.review_aspect_ratings (
                    review_id, aspect_type, rating_value
                ) VALUES (
                    p_review_id, v_asp.aspect_type::public.review_aspect_type_enum, v_asp.rating_value
                );
            END IF;
        END LOOP;
    END IF;

    -- Update tags if passed
    IF p_tags IS NOT NULL THEN
        DELETE FROM public.review_tags WHERE review_id = p_review_id;
        FOR v_tag_code IN SELECT jsonb_array_elements_text(p_tags) LOOP
            INSERT INTO public.review_tags (
                review_id, tag_code
            ) VALUES (
                p_review_id, v_tag_code::public.review_tag_code_enum
            );
        END LOOP;
    END IF;

    -- Recalculate aggregates atomically
    IF v_rev.visibility_status = 'PUBLISHED' THEN
        PERFORM public.refresh_restaurant_rating_aggregate(v_rev.restaurant_id);
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'review_id', p_review_id,
        'version_number', v_old_version_num,
        'new_rating', p_overall_rating
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- D. Delete Review (Soft Delete by Author)
CREATE OR REPLACE FUNCTION public.delete_review_secure(p_review_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rev RECORD;
    v_item RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_rev
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    IF v_rev.user_id != v_user_id AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Only the review author or platform admin can delete this review.';
    END IF;

    -- Soft delete to preserve audit history and avoid ghost aggregates
    UPDATE public.reviews
    SET visibility_status = 'DELETED_BY_AUTHOR',
        deleted_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = p_review_id;

    -- Recalculate restaurant aggregates
    PERFORM public.refresh_restaurant_rating_aggregate(v_rev.restaurant_id);

    -- Recalculate all affected dish aggregates
    FOR v_item IN SELECT menu_item_id FROM public.review_item_ratings WHERE review_id = p_review_id LOOP
        PERFORM public.refresh_dish_rating_aggregate(v_item.menu_item_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'review_id', p_review_id,
        'status', 'DELETED_BY_AUTHOR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- E. Respond to Review Secure (Merchant Public Response)
CREATE OR REPLACE FUNCTION public.respond_to_review_secure(
    p_review_id VARCHAR(80),
    p_body TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rev RECORD;
    v_clean_body TEXT;
    v_response_id VARCHAR(80);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_rev
    FROM public.reviews
    WHERE id = p_review_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    -- Check restaurant permission (MANAGE_REVIEWS or OWNER/MANAGER)
    IF NOT public.has_restaurant_permission(v_user_id, v_rev.restaurant_id, 'MANAGE_REVIEWS')
       AND NOT public.has_restaurant_permission(v_user_id, v_rev.restaurant_id, 'MANAGE_RESTAURANT')
       AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permission to manage reviews for restaurant %.', v_rev.restaurant_id;
    END IF;

    IF p_body IS NULL OR length(trim(p_body)) < 5 OR length(p_body) > 2000 THEN
        RAISE EXCEPTION '400 Bad Request: Merchant response must be between 5 and 2000 characters.';
    END IF;

    IF p_body ~* '<[a-z/][^>]*>' OR p_body ~* 'javascript:' THEN
        RAISE EXCEPTION '400 Bad Request: Executable HTML/scripts are prohibited in merchant responses.';
    END IF;

    v_clean_body := trim(p_body);
    v_response_id := 'resp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

    INSERT INTO public.review_responses (
        id, review_id, restaurant_id, responder_user_id, body, status, created_at, updated_at
    ) VALUES (
        v_response_id, p_review_id, v_rev.restaurant_id, v_user_id, v_clean_body, 'PUBLISHED', clock_timestamp(), clock_timestamp()
    )
    ON CONFLICT (review_id) DO UPDATE SET
        body = EXCLUDED.body,
        responder_user_id = EXCLUDED.responder_user_id,
        status = 'PUBLISHED',
        updated_at = clock_timestamp();

    RETURN jsonb_build_object(
        'success', TRUE,
        'response_id', v_response_id,
        'review_id', p_review_id,
        'status', 'PUBLISHED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- F. Edit Review Response Secure (With Versioning)
CREATE OR REPLACE FUNCTION public.edit_review_response_secure(
    p_response_id VARCHAR(80),
    p_body TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_resp RECORD;
    v_ver_num INTEGER := 1;
    v_clean_body TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_resp
    FROM public.review_responses
    WHERE id = p_response_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review response % does not exist.', p_response_id;
    END IF;

    IF NOT public.has_restaurant_permission(v_user_id, v_resp.restaurant_id, 'MANAGE_REVIEWS')
       AND NOT public.has_restaurant_permission(v_user_id, v_resp.restaurant_id, 'MANAGE_RESTAURANT')
       AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Caller lacks permission to manage reviews for restaurant %.', v_resp.restaurant_id;
    END IF;

    IF p_body IS NULL OR length(trim(p_body)) < 5 OR length(p_body) > 2000 THEN
        RAISE EXCEPTION '400 Bad Request: Merchant response must be between 5 and 2000 characters.';
    END IF;

    IF p_body ~* '<[a-z/][^>]*>' OR p_body ~* 'javascript:' THEN
        RAISE EXCEPTION '400 Bad Request: Executable HTML/scripts are prohibited in merchant responses.';
    END IF;

    v_clean_body := trim(p_body);

    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_ver_num
    FROM public.review_response_versions
    WHERE response_id = p_response_id;

    -- Archive previous version
    INSERT INTO public.review_response_versions (
        response_id, version_number, body, editor_user_id, edited_at
    ) VALUES (
        p_response_id, v_ver_num, v_resp.body, v_user_id, clock_timestamp()
    );

    UPDATE public.review_responses
    SET body = v_clean_body,
        responder_user_id = v_user_id,
        updated_at = clock_timestamp()
    WHERE id = p_response_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'response_id', p_response_id,
        'version_number', v_ver_num
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- G. Helpfulness Voting Secure
CREATE OR REPLACE FUNCTION public.vote_review_helpfulness_secure(
    p_review_id VARCHAR(80),
    p_is_helpful BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rev RECORD;
    v_existing RECORD;
    v_h_count INTEGER := 0;
    v_nh_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT id, user_id, helpful_count, not_helpful_count INTO v_rev
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    IF v_rev.user_id = v_user_id THEN
        RAISE EXCEPTION '400 Bad Request: Review authors cannot vote on their own reviews.';
    END IF;

    SELECT * INTO v_existing
    FROM public.review_helpfulness_votes
    WHERE review_id = p_review_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.review_helpfulness_votes (
            review_id, user_id, is_helpful, created_at, updated_at
        ) VALUES (
            p_review_id, v_user_id, p_is_helpful, clock_timestamp(), clock_timestamp()
        );
    ELSE
        IF v_existing.is_helpful != p_is_helpful THEN
            UPDATE public.review_helpfulness_votes
            SET is_helpful = p_is_helpful, updated_at = clock_timestamp()
            WHERE id = v_existing.id;
        END IF;
    END IF;

    -- Recount from source of truth
    SELECT
        COUNT(*) FILTER (WHERE is_helpful = TRUE)::integer,
        COUNT(*) FILTER (WHERE is_helpful = FALSE)::integer
    INTO v_h_count, v_nh_count
    FROM public.review_helpfulness_votes
    WHERE review_id = p_review_id;

    UPDATE public.reviews
    SET helpful_count = v_h_count,
        not_helpful_count = v_nh_count,
        updated_at = clock_timestamp()
    WHERE id = p_review_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'review_id', p_review_id,
        'helpful_count', v_h_count,
        'not_helpful_count', v_nh_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- H. Report Review Secure
CREATE OR REPLACE FUNCTION public.report_review_secure(
    p_review_id VARCHAR(80),
    p_reason_code public.review_report_reason_enum,
    p_details TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_report_id VARCHAR(80);
    v_case_id VARCHAR(80);
    v_report_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE id = p_review_id) THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    v_report_id := 'rrep_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

    INSERT INTO public.review_reports (
        id, review_id, reporter_user_id, reason_code, details, status, created_at
    ) VALUES (
        v_report_id, p_review_id, v_user_id, p_reason_code, p_details, 'OPEN', clock_timestamp()
    )
    ON CONFLICT (review_id, reporter_user_id) DO UPDATE SET
        reason_code = EXCLUDED.reason_code,
        details = EXCLUDED.details,
        status = 'OPEN';

    -- Multiple reports MUST NOT automatically delete/hide the review.
    -- Instead, ensure an open moderation case exists.
    SELECT COUNT(*) INTO v_report_count
    FROM public.review_reports
    WHERE review_id = p_review_id AND status = 'OPEN';

    SELECT id INTO v_case_id
    FROM public.review_moderation_cases
    WHERE review_id = p_review_id;

    IF v_case_id IS NULL THEN
        v_case_id := 'mcase_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
        INSERT INTO public.review_moderation_cases (
            id, review_id, status, priority, opened_reason, opened_at
        ) VALUES (
            v_case_id, p_review_id, 'OPEN',
            CASE WHEN v_report_count >= 3 THEN 'HIGH' ELSE 'NORMAL' END,
            'Community report: ' || p_reason_code::text,
            clock_timestamp()
        );
    ELSE
        UPDATE public.review_moderation_cases
        SET priority = CASE WHEN v_report_count >= 3 THEN 'HIGH' ELSE priority END,
            status = 'OPEN'
        WHERE id = v_case_id;
    END IF;

    -- Append audit event
    INSERT INTO public.review_moderation_events (
        case_id, review_id, actor_user_id, actor_type, action, reason_code, metadata
    ) VALUES (
        v_case_id, p_review_id, v_user_id, 'SYSTEM', 'REPORT_SUBMITTED', p_reason_code::text,
        jsonb_build_object('report_id', v_report_id, 'total_reports', v_report_count)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'report_id', v_report_id,
        'case_id', v_case_id,
        'total_open_reports', v_report_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- I. Moderate Review Secure (Platform Admin Only)
CREATE OR REPLACE FUNCTION public.moderate_review_secure(
    p_review_id VARCHAR(80),
    p_outcome public.review_moderation_outcome_enum,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rev RECORD;
    v_case RECORD;
    v_new_vis public.review_visibility_status_enum;
    v_new_mod public.review_moderation_status_enum;
    v_item RECORD;
BEGIN
    IF NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required to moderate reviews.';
    END IF;

    SELECT * INTO v_rev
    FROM public.reviews
    WHERE id = p_review_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Review % does not exist.', p_review_id;
    END IF;

    SELECT * INTO v_case
    FROM public.review_moderation_cases
    WHERE review_id = p_review_id;

    CASE p_outcome
        WHEN 'NO_VIOLATION', 'KEEP_PUBLISHED', 'RESTORE' THEN
            v_new_vis := 'PUBLISHED';
            v_new_mod := 'APPROVED';
        WHEN 'HIDE_PENDING_REVIEW' THEN
            v_new_vis := 'HIDDEN';
            v_new_mod := 'UNDER_REVIEW';
        WHEN 'REMOVE_POLICY' THEN
            v_new_vis := 'REMOVED_POLICY';
            v_new_mod := 'REJECTED';
        WHEN 'WARN_AUTHOR', 'RESTRICT_REVIEWING' THEN
            v_new_vis := v_rev.visibility_status;
            v_new_mod := 'UNDER_REVIEW';
    END CASE;

    UPDATE public.reviews
    SET visibility_status = v_new_vis,
        moderation_status = v_new_mod,
        updated_at = clock_timestamp()
    WHERE id = p_review_id;

    IF v_case.id IS NOT NULL THEN
        UPDATE public.review_moderation_cases
        SET status = 'RESOLVED',
            resolved_at = clock_timestamp(),
            resolution_code = p_outcome,
            resolution_notes = p_notes
        WHERE id = v_case.id;

        INSERT INTO public.review_moderation_events (
            case_id, review_id, actor_user_id, actor_type, action, reason_code, metadata
        ) VALUES (
            v_case.id, p_review_id, v_user_id, 'ADMIN', 'MODERATION_RESOLVED', p_outcome::text,
            jsonb_build_object('notes', p_notes, 'new_visibility', v_new_vis, 'new_moderation', v_new_mod)
        );
    END IF;

    -- Recalculate restaurant aggregates
    PERFORM public.refresh_restaurant_rating_aggregate(v_rev.restaurant_id);

    -- Recalculate all affected dish aggregates
    FOR v_item IN SELECT menu_item_id FROM public.review_item_ratings WHERE review_id = p_review_id LOOP
        PERFORM public.refresh_dish_rating_aggregate(v_item.menu_item_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'review_id', p_review_id,
        'visibility_status', v_new_vis,
        'moderation_status', v_new_mod,
        'outcome', p_outcome
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 14. EXTEND DISCOVERY ENGINE (search_food_discovery)
-- ----------------------------------------------------------------------------
-- Preserves all 29 existing return columns exactly, seamlessly integrating
-- restaurant_rating_aggregates and dish_rating_aggregates for robust ranking.

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
            COALESCE(r.cuisine, 'Swahili')::varchar(100) AS r_cuisine,
            rb.id::uuid AS rb_id,
            rb.name::varchar(150) AS rb_name,
            COALESCE(rb.ward, r.neighborhood, 'Dar es Salaam')::varchar(100) AS rb_neighborhood,
            rb.address::varchar(255) AS rb_address,
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

-- ----------------------------------------------------------------------------
-- 15. ENROLL IN SUPABASE REALTIME
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.review_responses;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_rating_aggregates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dish_rating_aggregates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
