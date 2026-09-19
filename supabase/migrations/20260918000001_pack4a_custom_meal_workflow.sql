-- ============================================================================
-- MLOHUB PACK 4A: ADVANCED CUSTOM MEALS WORKFLOW
-- Migration Version: 20260918000001
-- Description: Establishes complete server-authoritative custom meal marketplace:
--   1. Restaurant Opt-In & Custom Meal Settings
--   2. Expanded Request Model with Timestamps & Allergy/Dietary Separation
--   3. Multi-Factor Matching Engine & Private Invitations (Top 5 target)
--   4. Structured Quotes with Line Items & Versioned Revision History
--   5. Request-Scoped Private Messaging (Competitor Isolated)
--   6. Hard Competitor Isolation & Address Privacy RLS
--   7. Concurrency-Safe Quote Selection RPC (FOR UPDATE Lock)
--   8. Webhook/Server-Side Idempotent Order Conversion to Canonical PENDING Order
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS AND TYPES
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE custom_meal_occasion_enum AS ENUM (
        'PERSONAL',
        'FAMILY',
        'OFFICE',
        'EVENT',
        'PARTY',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE budget_type_enum AS ENUM (
        'FIXED',
        'RANGE',
        'OPEN_TO_QUOTES'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE spice_level_enum AS ENUM (
        'NONE',
        'MILD',
        'MEDIUM',
        'HOT',
        'EXTRA_HOT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE custom_meal_fulfillment_enum AS ENUM (
        'PICKUP',
        'DINE_IN',
        'RESTAURANT_DELIVERY'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invitation_status_enum AS ENUM (
        'INVITED',
        'VIEWED',
        'DECLINED',
        'QUOTED',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE quote_status_enum AS ENUM (
        'SUBMITTED',
        'REVISED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE decline_reason_enum AS ENUM (
        'TOO_BUSY',
        'UNABLE_TO_MEET_TIME',
        'OUTSIDE_SERVICE_AREA',
        'INGREDIENT_UNAVAILABLE',
        'DIETARY_REQUIREMENT_UNSUPPORTED',
        'PRICE_EXPECTATION',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE custom_message_type_enum AS ENUM (
        'TEXT',
        'CLARIFICATION',
        'QUOTE_REVISION_REQUEST',
        'SYSTEM'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. RESTAURANT CUSTOM MEAL SETTINGS (OPT-IN AUTHORITY)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_custom_meal_settings (
    restaurant_id VARCHAR(80) PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    accepts_custom_meals BOOLEAN NOT NULL DEFAULT FALSE,
    minimum_notice_minutes INTEGER NOT NULL DEFAULT 120,
    minimum_order_tzs INTEGER NOT NULL DEFAULT 15000,
    maximum_servings INTEGER NOT NULL DEFAULT 50,
    maximum_active_requests INTEGER NOT NULL DEFAULT 10,
    supported_fulfillment_modes custom_meal_fulfillment_enum[] NOT NULL DEFAULT ARRAY['PICKUP', 'RESTAURANT_DELIVERY']::custom_meal_fulfillment_enum[],
    supported_cuisines TEXT[] NOT NULL DEFAULT '{}',
    dietary_capabilities TEXT[] NOT NULL DEFAULT '{}',
    allergy_handling_capabilities TEXT[] NOT NULL DEFAULT '{}',
    service_radius_km NUMERIC NOT NULL DEFAULT 10.0,
    service_areas TEXT[] NOT NULL DEFAULT '{}',
    paused_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_custom_meal_settings_accepts 
    ON public.restaurant_custom_meal_settings(accepts_custom_meals) 
    WHERE accepts_custom_meals = TRUE;

-- ----------------------------------------------------------------------------
-- 3. EXPAND PUBLIC.CUSTOM_MEAL_REQUESTS SCHEMA
-- ----------------------------------------------------------------------------

-- Alter status column to decouple from order_status_enum
ALTER TABLE public.custom_meal_requests 
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE VARCHAR(40) USING status::text,
    ALTER COLUMN status SET DEFAULT 'PENDING';

-- Add expanded Tanzanian custom meal concepts
ALTER TABLE public.custom_meal_requests
    ADD COLUMN IF NOT EXISTS title VARCHAR(150),
    ADD COLUMN IF NOT EXISTS occasion custom_meal_occasion_enum NOT NULL DEFAULT 'PERSONAL',
    ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(80) NOT NULL DEFAULT 'Swahili',
    ADD COLUMN IF NOT EXISTS budget_type budget_type_enum NOT NULL DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS budget_min_tzs INTEGER NULL,
    ADD COLUMN IF NOT EXISTS budget_max_tzs INTEGER NULL,
    ADD COLUMN IF NOT EXISTS spice_level spice_level_enum NOT NULL DEFAULT 'MILD',
    ADD COLUMN IF NOT EXISTS ingredients_requested TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ingredients_to_avoid TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS desired_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS quote_deadline TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS fulfillment_mode custom_meal_fulfillment_enum NOT NULL DEFAULT 'RESTAURANT_DELIVERY',
    ADD COLUMN IF NOT EXISTS customer_area VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS landmark VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS exact_delivery_address TEXT NULL,
    ADD COLUMN IF NOT EXISTS exact_delivery_phone VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS approx_lat NUMERIC NULL,
    ADD COLUMN IF NOT EXISTS approx_lng NUMERIC NULL,
    ADD COLUMN IF NOT EXISTS reference_images TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS locked_quote_snapshot JSONB NULL,
    ADD COLUMN IF NOT EXISTS converted_order_id VARCHAR(80) NULL;

-- Backfill title from dish_name if null
UPDATE public.custom_meal_requests SET title = dish_name WHERE title IS NULL;

-- Indexes for performance & query filtering
CREATE INDEX IF NOT EXISTS idx_custom_meal_requests_desired_at ON public.custom_meal_requests(desired_at);
CREATE INDEX IF NOT EXISTS idx_custom_meal_requests_deadline ON public.custom_meal_requests(quote_deadline);
CREATE INDEX IF NOT EXISTS idx_custom_meal_requests_customer_area ON public.custom_meal_requests(customer_area);

-- ----------------------------------------------------------------------------
-- 4. PRIVATE RESTAURANT INVITATIONS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_meal_invitations (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'cmi_' || substr(md5(random()::text), 1, 16),
    request_id VARCHAR(80) NOT NULL REFERENCES public.custom_meal_requests(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NULL REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    status invitation_status_enum NOT NULL DEFAULT 'INVITED',
    match_score NUMERIC NULL,
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    viewed_at TIMESTAMPTZ NULL,
    declined_at TIMESTAMPTZ NULL,
    decline_reason decline_reason_enum NULL,
    decline_notes TEXT NULL,
    quote_deadline TIMESTAMPTZ NOT NULL,
    UNIQUE(request_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_meal_invitations_req ON public.custom_meal_invitations(request_id);
CREATE INDEX IF NOT EXISTS idx_custom_meal_invitations_rest ON public.custom_meal_invitations(restaurant_id, status);

-- ----------------------------------------------------------------------------
-- 5. STRUCTURED RESTAURANT QUOTES SCHEMA EVOLUTION
-- ----------------------------------------------------------------------------

-- Alter status column of public.restaurant_quotes
ALTER TABLE public.restaurant_quotes 
    DROP CONSTRAINT IF EXISTS restaurant_quotes_status_check;

ALTER TABLE public.restaurant_quotes
    ADD COLUMN IF NOT EXISTS branch_id UUID NULL REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS subtotal_tzs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_fee_tzs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS other_authorized_fee_tzs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tzs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promised_ready_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS fulfillment_mode custom_meal_fulfillment_enum NOT NULL DEFAULT 'RESTAURANT_DELIVERY',
    ADD COLUMN IF NOT EXISTS restaurant_note TEXT NULL,
    ADD COLUMN IF NOT EXISTS substitution_notes TEXT NULL,
    ADD COLUMN IF NOT EXISTS dietary_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS allergy_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1;

-- Backfill quote totals from quoted_price_tzs if zero
UPDATE public.restaurant_quotes 
SET subtotal_tzs = quoted_price_tzs, total_tzs = quoted_price_tzs 
WHERE subtotal_tzs = 0 AND quoted_price_tzs > 0;

ALTER TABLE public.restaurant_quotes
    ADD CONSTRAINT restaurant_quotes_status_check 
    CHECK (status IN ('SUBMITTED', 'OFFERED', 'REVISED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED'));

-- Unique constraint for quote revisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_quotes_revision 
    ON public.restaurant_quotes(request_id, restaurant_id, revision_number);

-- ----------------------------------------------------------------------------
-- 6. QUOTE LINE ITEMS (ITEMIZED TRANSPARENCY)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_quote_items (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'cqi_' || substr(md5(random()::text), 1, 16),
    quote_id VARCHAR(80) NOT NULL REFERENCES public.restaurant_quotes(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_tzs INTEGER NOT NULL CHECK (unit_price_tzs >= 0),
    line_total_tzs INTEGER NOT NULL CHECK (line_total_tzs >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.restaurant_quote_items(quote_id);

-- ----------------------------------------------------------------------------
-- 7. IMMUTABLE QUOTE REVISIONS AUDIT (VERSION HISTORY)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_quote_versions (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'cqv_' || substr(md5(random()::text), 1, 16),
    quote_id VARCHAR(80) NOT NULL REFERENCES public.restaurant_quotes(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    subtotal_tzs INTEGER NOT NULL,
    delivery_fee_tzs INTEGER NOT NULL,
    total_tzs INTEGER NOT NULL,
    estimated_prep_minutes INTEGER NOT NULL,
    promised_ready_at TIMESTAMPTZ NOT NULL,
    restaurant_note TEXT NULL,
    items_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(quote_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_id ON public.restaurant_quote_versions(quote_id);

-- ----------------------------------------------------------------------------
-- 8. REQUEST-SCOPED PRIVATE MESSAGING
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_meal_messages (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'cmm_' || substr(md5(random()::text), 1, 16),
    request_id VARCHAR(80) NOT NULL REFERENCES public.custom_meal_requests(id) ON DELETE CASCADE,
    quote_id VARCHAR(80) NULL REFERENCES public.restaurant_quotes(id) ON DELETE SET NULL,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('CUSTOMER', 'RESTAURANT', 'SYSTEM')),
    message_type custom_message_type_enum NOT NULL DEFAULT 'TEXT',
    body VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    edited_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_meal_messages_req ON public.custom_meal_messages(request_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_custom_meal_messages_sender ON public.custom_meal_messages(sender_user_id);

-- ----------------------------------------------------------------------------
-- 9. CANONICAL ORDERS SCHEMA LINKING (IDEMPOTENT CONVERSION)
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS custom_meal_request_id VARCHAR(80) NULL,
    ADD COLUMN IF NOT EXISTS custom_meal_snapshot JSONB NULL;

-- Hard DB-level uniqueness ensuring 1 request converts to at most 1 canonical order
DO $$ BEGIN
    ALTER TABLE public.orders 
        ADD CONSTRAINT uq_orders_custom_meal_request_id UNIQUE (custom_meal_request_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 10. AUTHORITATIVE SERVICE FEE HELPER FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_service_fee(p_subtotal_tzs INTEGER DEFAULT 0)
RETURNS INTEGER AS $$
BEGIN
    -- Authoritative server fee rule: fixed 1,500 TZS default standard fee
    RETURN 1500;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 11. SECURITY DEFINER SERVER RPCS
-- ----------------------------------------------------------------------------

-- A. Create Structured Custom Meal Request
CREATE OR REPLACE FUNCTION public.create_structured_custom_meal_request(
    p_title VARCHAR(150),
    p_description TEXT,
    p_occasion custom_meal_occasion_enum,
    p_servings INTEGER,
    p_cuisine_type VARCHAR(80),
    p_budget_type budget_type_enum,
    p_budget_min_tzs INTEGER,
    p_budget_max_tzs INTEGER,
    p_spice_level spice_level_enum,
    p_ingredients_requested TEXT[],
    p_ingredients_to_avoid TEXT[],
    p_dietary_tags TEXT[],
    p_allergens TEXT[],
    p_desired_at TIMESTAMPTZ,
    p_quote_deadline TIMESTAMPTZ,
    p_fulfillment_mode custom_meal_fulfillment_enum,
    p_customer_area VARCHAR(100),
    p_landmark VARCHAR(150),
    p_exact_delivery_address TEXT,
    p_exact_delivery_phone VARCHAR(30),
    p_reference_images TEXT[] DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_request_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_active_count INTEGER;
    v_expires_at TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to create custom meal request.';
    END IF;

    -- Anti-Spam: Rate limit max active requests
    SELECT COUNT(*) INTO v_active_count
    FROM public.custom_meal_requests
    WHERE user_id = v_user_id
      AND status IN ('PENDING', 'QUOTES_RECEIVED', 'QUOTE_ACCEPTED');

    IF v_active_count >= 3 THEN
        RAISE EXCEPTION '429 Too Many Requests: Maximum 3 active custom meal requests permitted simultaneously.';
    END IF;

    -- Validate timing
    IF p_desired_at <= NOW() + INTERVAL '30 minutes' THEN
        RAISE EXCEPTION '400 Bad Request: desired_at must be at least 30 minutes in the future.';
    END IF;

    IF p_quote_deadline >= p_desired_at OR p_quote_deadline <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: quote_deadline must be in the future and before desired_at.';
    END IF;

    IF p_servings < 1 THEN
        RAISE EXCEPTION '400 Bad Request: Servings must be at least 1.';
    END IF;

    IF p_budget_type = 'FIXED' AND (p_budget_min_tzs IS NULL OR p_budget_min_tzs < 5000) THEN
        RAISE EXCEPTION '400 Bad Request: Minimum budget is 5,000 TZS.';
    END IF;

    v_request_id := 'req_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-REQ-' || substr(to_char(NOW(), 'YYMMDDHH24MISS'), 3) || '-' || substr(md5(random()::text), 1, 4);
    v_expires_at := p_desired_at;

    INSERT INTO public.custom_meal_requests (
        id, order_number, user_id, dish_name, title, special_instructions,
        budget_tzs, budget_type, budget_min_tzs, budget_max_tzs, servings_count,
        dining_option, fulfillment_mode, delivery_location, customer_area, landmark,
        exact_delivery_address, exact_delivery_phone, occasion, cuisine_type, spice_level,
        ingredients_requested, ingredients_to_avoid, dietary_tags, allergens,
        desired_at, quote_deadline, expires_at, reference_images, status,
        status_message_en, status_message_sw, updated_at
    ) VALUES (
        v_request_id, v_order_number, v_user_id, p_title, p_title, p_description,
        COALESCE(p_budget_min_tzs, 15000), p_budget_type, p_budget_min_tzs, p_budget_max_tzs,
        p_servings::text, p_fulfillment_mode::text, p_fulfillment_mode,
        COALESCE(p_customer_area, 'Dar es Salaam'), p_customer_area, p_landmark,
        p_exact_delivery_address, p_exact_delivery_phone, p_occasion, p_cuisine_type, p_spice_level,
        COALESCE(p_ingredients_requested, '{}'), COALESCE(p_ingredients_to_avoid, '{}'),
        COALESCE(p_dietary_tags, '{}'), COALESCE(p_allergens, '{}'),
        p_desired_at, p_quote_deadline, v_expires_at, COALESCE(p_reference_images, '{}'),
        'PENDING', 'Request created. Finding qualified kitchens...', 'Ombi limeundwa. Inatafuta wapishi...',
        NOW()
    );

    -- Execute server-side matching engine
    PERFORM public.match_and_invite_restaurants(v_request_id);

    SELECT jsonb_build_object(
        'id', id,
        'order_number', order_number,
        'title', title,
        'cuisine_type', cuisine_type,
        'servings', servings_count,
        'desired_at', desired_at,
        'quote_deadline', quote_deadline,
        'status', status
    ) INTO v_result
    FROM public.custom_meal_requests
    WHERE id = v_request_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- B. Matching Engine & Private Invitations (Top 5 Qualified Target)
CREATE OR REPLACE FUNCTION public.match_and_invite_restaurants(p_request_id VARCHAR(80))
RETURNS JSONB AS $$
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
        WHERE r.is_published = TRUE
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- C. Submit Structured Restaurant Quote with Line Items
CREATE OR REPLACE FUNCTION public.submit_structured_restaurant_quote(
    p_request_id VARCHAR(80),
    p_restaurant_id VARCHAR(80),
    p_branch_id UUID,
    p_items JSONB, -- Array of { name, description, quantity, unit_price_tzs }
    p_delivery_fee_tzs INTEGER,
    p_estimated_prep_minutes INTEGER,
    p_promised_ready_at TIMESTAMPTZ,
    p_fulfillment_mode custom_meal_fulfillment_enum,
    p_restaurant_note TEXT,
    p_substitution_notes TEXT,
    p_dietary_acknowledged BOOLEAN,
    p_allergy_acknowledged BOOLEAN,
    p_valid_until TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_req RECORD;
    v_existing_quote RECORD;
    v_quote_id VARCHAR(80);
    v_revision_number INTEGER := 1;
    v_subtotal INTEGER := 0;
    v_total INTEGER := 0;
    v_item RECORD;
    v_line_total INTEGER;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to submit quote.';
    END IF;

    -- Verify caller belongs to restaurant
    IF public.is_admin(v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND owner_id = v_caller_id) THEN
        v_is_authorized := TRUE;
    ELSIF public.has_restaurant_permission(v_caller_id, p_restaurant_id, 'MANAGE_ORDERS') THEN
        v_is_authorized := TRUE;
    ELSIF EXISTS (
        SELECT 1 FROM public.restaurant_members 
        WHERE user_id = v_caller_id AND restaurant_id = p_restaurant_id AND is_active = TRUE
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION '403 Forbidden: Caller does not have authority to submit quotes for restaurant %.', p_restaurant_id;
    END IF;

    -- Verify request state & deadline
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    IF v_req.status IN ('QUOTE_ACCEPTED', 'ORDER_CREATED', 'COMPLETED', 'CANCELLED') THEN
        RAISE EXCEPTION '400 Bad Request: Request is no longer accepting quotes (status: %).', v_req.status;
    END IF;

    IF v_req.quote_deadline <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: Quote submission deadline has passed.';
    END IF;

    -- Allergy explicit acknowledgement check
    IF array_length(v_req.allergens, 1) > 0 AND p_allergy_acknowledged IS NOT TRUE THEN
        RAISE EXCEPTION '400 Bad Request: Request contains allergen declarations. Allergy acknowledgement is mandatory.';
    END IF;

    -- Calculate line items server-side
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Quote must contain at least one line item.';
    END IF;

    FOR v_item IN SELECT 
        COALESCE(elem->>'name', 'Meal Item')::TEXT AS name,
        (elem->>'description')::TEXT AS description,
        COALESCE((elem->>'quantity')::INTEGER, 1) AS quantity,
        COALESCE((elem->>'unit_price_tzs')::INTEGER, (elem->>'unitPriceTzs')::INTEGER, 0) AS unit_price_tzs
    FROM jsonb_array_elements(p_items) AS elem
    LOOP
        IF v_item.quantity <= 0 OR v_item.unit_price_tzs < 0 THEN
            RAISE EXCEPTION '400 Bad Request: Item quantity and price must be positive.';
        END IF;
        v_line_total := v_item.quantity * v_item.unit_price_tzs;
        v_subtotal := v_subtotal + v_line_total;
    END LOOP;

    v_total := v_subtotal + COALESCE(p_delivery_fee_tzs, 0);

    -- Check if existing quote exists for this restaurant
    SELECT * INTO v_existing_quote
    FROM public.restaurant_quotes
    WHERE request_id = p_request_id AND restaurant_id = p_restaurant_id
    ORDER BY revision_number DESC
    LIMIT 1;

    IF FOUND THEN
        -- Preserve old version in restaurant_quote_versions
        INSERT INTO public.restaurant_quote_versions (
            quote_id, revision_number, subtotal_tzs, delivery_fee_tzs, total_tzs,
            estimated_prep_minutes, promised_ready_at, restaurant_note, items_snapshot
        )
        SELECT 
            v_existing_quote.id, v_existing_quote.revision_number, v_existing_quote.subtotal_tzs,
            v_existing_quote.delivery_fee_tzs, v_existing_quote.total_tzs, v_existing_quote.estimated_prep_minutes,
            COALESCE(v_existing_quote.promised_ready_at, NOW()), v_existing_quote.restaurant_note,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'name', qi.name, 'quantity', qi.quantity, 'unit_price_tzs', qi.unit_price_tzs, 'line_total_tzs', qi.line_total_tzs
                )) FROM public.restaurant_quote_items qi WHERE qi.quote_id = v_existing_quote.id
            ), '[]'::jsonb)
        ON CONFLICT (quote_id, revision_number) DO NOTHING;

        -- Increment revision
        v_quote_id := v_existing_quote.id;
        v_revision_number := v_existing_quote.revision_number + 1;

        UPDATE public.restaurant_quotes SET
            branch_id = p_branch_id,
            submitted_by_user_id = v_caller_id,
            quoted_price_tzs = v_total,
            subtotal_tzs = v_subtotal,
            delivery_fee_tzs = COALESCE(p_delivery_fee_tzs, 0),
            total_tzs = v_total,
            estimated_prep_minutes = p_estimated_prep_minutes,
            promised_ready_at = p_promised_ready_at,
            fulfillment_mode = p_fulfillment_mode,
            chef_notes = p_restaurant_note,
            restaurant_note = p_restaurant_note,
            substitution_notes = p_substitution_notes,
            dietary_acknowledged = p_dietary_acknowledged,
            allergy_acknowledged = p_allergy_acknowledged,
            valid_until = p_valid_until,
            revision_number = v_revision_number,
            status = 'REVISED'
        WHERE id = v_quote_id;

        -- Remove old items and insert updated items
        DELETE FROM public.restaurant_quote_items WHERE quote_id = v_quote_id;
    ELSE
        v_quote_id := 'quote_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
        v_revision_number := 1;

        INSERT INTO public.restaurant_quotes (
            id, request_id, restaurant_id, branch_id, submitted_by_user_id,
            quoted_price_tzs, subtotal_tzs, delivery_fee_tzs, total_tzs,
            estimated_prep_minutes, promised_ready_at, fulfillment_mode,
            chef_notes, restaurant_note, substitution_notes,
            dietary_acknowledged, allergy_acknowledged, valid_until,
            revision_number, status
        ) VALUES (
            v_quote_id, p_request_id, p_restaurant_id, p_branch_id, v_caller_id,
            v_total, v_subtotal, COALESCE(p_delivery_fee_tzs, 0), v_total,
            p_estimated_prep_minutes, p_promised_ready_at, p_fulfillment_mode,
            p_restaurant_note, p_restaurant_note, p_substitution_notes,
            p_dietary_acknowledged, p_allergy_acknowledged, p_valid_until,
            1, 'SUBMITTED'
        );
    END IF;

    -- Insert line items
    FOR v_item IN SELECT 
        COALESCE(elem->>'name', 'Meal Item')::TEXT AS name,
        (elem->>'description')::TEXT AS description,
        COALESCE((elem->>'quantity')::INTEGER, 1) AS quantity,
        COALESCE((elem->>'unit_price_tzs')::INTEGER, (elem->>'unitPriceTzs')::INTEGER, 0) AS unit_price_tzs
    FROM jsonb_array_elements(p_items) AS elem
    LOOP
        INSERT INTO public.restaurant_quote_items (
            quote_id, name, description, quantity, unit_price_tzs, line_total_tzs
        ) VALUES (
            v_quote_id, v_item.name, v_item.description, v_item.quantity, v_item.unit_price_tzs,
            v_item.quantity * v_item.unit_price_tzs
        );
    END LOOP;

    -- Update invitation state
    UPDATE public.custom_meal_invitations
    SET status = 'QUOTED'
    WHERE request_id = p_request_id AND restaurant_id = p_restaurant_id;

    -- Transition request to QUOTES_RECEIVED
    UPDATE public.custom_meal_requests
    SET status = 'QUOTES_RECEIVED',
        status_message_en = 'Quotes received. Compare offers and select your kitchen.',
        status_message_sw = 'Ofa zimepokelewa. Linganisha na uchague mpishi wako.',
        updated_at = NOW()
    WHERE id = p_request_id AND status = 'PENDING';

    RETURN jsonb_build_object(
        'quote_id', v_quote_id,
        'revision_number', v_revision_number,
        'subtotal_tzs', v_subtotal,
        'delivery_fee_tzs', COALESCE(p_delivery_fee_tzs, 0),
        'total_tzs', v_total,
        'status', CASE WHEN v_revision_number > 1 THEN 'REVISED' ELSE 'SUBMITTED' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- D. Concurrency-Safe Quote Selection RPC (FOR UPDATE Lock)
CREATE OR REPLACE FUNCTION public.lock_custom_meal_quote_selection(
    p_request_id VARCHAR(80),
    p_quote_id VARCHAR(80)
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_req RECORD;
    v_quote RECORD;
    v_items JSONB;
    v_service_fee INTEGER;
    v_grand_total INTEGER;
    v_snapshot JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required to select quote.';
    END IF;

    -- 1. Lock request row FOR UPDATE to prevent race condition
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    IF v_req.user_id != v_user_id AND NOT public.is_admin(v_user_id) THEN
        RAISE EXCEPTION '403 Forbidden: Caller does not own this custom meal request.';
    END IF;

    IF v_req.status = 'QUOTE_ACCEPTED' THEN
        RAISE EXCEPTION '409 Conflict: A quote has already been accepted for this request.';
    END IF;

    IF v_req.status IN ('ORDER_CREATED', 'COMPLETED', 'CANCELLED', 'EXPIRED') THEN
        RAISE EXCEPTION '400 Bad Request: Request is not in a selectable state (status: %).', v_req.status;
    END IF;

    -- 2. Lock and validate target quote
    SELECT * INTO v_quote
    FROM public.restaurant_quotes
    WHERE id = p_quote_id AND request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Quote % does not exist for request %.', p_quote_id, p_request_id;
    END IF;

    IF v_quote.status NOT IN ('SUBMITTED', 'REVISED', 'OFFERED') THEN
        RAISE EXCEPTION '400 Bad Request: Quote is not active (status: %).', v_quote.status;
    END IF;

    IF v_quote.valid_until IS NOT NULL AND v_quote.valid_until <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: Selected quote has expired.';
    END IF;

    -- 3. Mark selected quote ACCEPTED
    UPDATE public.restaurant_quotes
    SET status = 'ACCEPTED'
    WHERE id = p_quote_id;

    -- 4. Mark all competing active quotes for this request as SUPERSEDED / REJECTED
    UPDATE public.restaurant_quotes
    SET status = 'SUPERSEDED'
    WHERE request_id = p_request_id AND id != p_quote_id AND status IN ('SUBMITTED', 'REVISED', 'OFFERED');

    -- 5. Calculate platform fee and assemble immutable snapshot
    v_service_fee := public.get_platform_service_fee(v_quote.subtotal_tzs);
    v_grand_total := v_quote.total_tzs + v_service_fee;

    SELECT jsonb_agg(jsonb_build_object(
        'name', qi.name,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price_tzs', qi.unit_price_tzs,
        'line_total_tzs', qi.line_total_tzs
    )) INTO v_items
    FROM public.restaurant_quote_items qi
    WHERE qi.quote_id = p_quote_id;

    v_snapshot := jsonb_build_object(
        'quote_id', p_quote_id,
        'revision_number', v_quote.revision_number,
        'restaurant_id', v_quote.restaurant_id,
        'branch_id', v_quote.branch_id,
        'subtotal_tzs', v_quote.subtotal_tzs,
        'delivery_fee_tzs', v_quote.delivery_fee_tzs,
        'service_fee_tzs', v_service_fee,
        'grand_total_tzs', v_grand_total,
        'estimated_prep_minutes', v_quote.estimated_prep_minutes,
        'promised_ready_at', v_quote.promised_ready_at,
        'fulfillment_mode', v_quote.fulfillment_mode,
        'chef_notes', v_quote.chef_notes,
        'dietary_acknowledged', v_quote.dietary_acknowledged,
        'allergy_acknowledged', v_quote.allergy_acknowledged,
        'line_items', COALESCE(v_items, '[]'::jsonb),
        'locked_at', NOW()
    );

    -- 6. Update request record
    UPDATE public.custom_meal_requests SET
        accepted_quote_id = p_quote_id,
        locked_quote_snapshot = v_snapshot,
        status = 'QUOTE_ACCEPTED',
        status_message_en = 'Quote accepted. Please proceed to payment to finalize order.',
        status_message_sw = 'Ofa imekubaliwa. Tafadhali kamilisha malipo kuthibitisha agizo.',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'quote_id', p_quote_id,
        'restaurant_id', v_quote.restaurant_id,
        'grand_total_tzs', v_grand_total,
        'service_fee_tzs', v_service_fee,
        'status', 'QUOTE_ACCEPTED',
        'snapshot', v_snapshot
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- E. Convert Custom Meal to Canonical Order (Idempotent Webhook / Server Authority)
CREATE OR REPLACE FUNCTION public.convert_custom_meal_to_order(
    p_request_id VARCHAR(80),
    p_payment_id VARCHAR(80)
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_pay RECORD;
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_snap JSONB;
    v_item RECORD;
    v_existing_order RECORD;
BEGIN
    -- 1. Lock request row FOR UPDATE
    SELECT * INTO v_req
    FROM public.custom_meal_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Custom meal request % does not exist.', p_request_id;
    END IF;

    -- Idempotency: If already converted, return existing canonical order cleanly
    IF v_req.converted_order_id IS NOT NULL THEN
        SELECT * INTO v_existing_order FROM public.orders WHERE id = v_req.converted_order_id;
        RETURN jsonb_build_object(
            'order_id', v_existing_order.id,
            'order_number', v_existing_order.order_number,
            'status', v_existing_order.status,
            'payment_status', v_existing_order.payment_status,
            'idempotent', TRUE
        );
    END IF;

    IF v_req.status != 'QUOTE_ACCEPTED' THEN
        RAISE EXCEPTION '400 Bad Request: Custom meal request status must be QUOTE_ACCEPTED (current: %).', v_req.status;
    END IF;

    v_snap := v_req.locked_quote_snapshot;
    IF v_snap IS NULL THEN
        RAISE EXCEPTION '500 Internal Error: Locked quote snapshot is missing on accepted request.';
    END IF;

    -- 2. Verify Payment Invariants
    SELECT * INTO v_pay
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Payment record % does not exist.', p_payment_id;
    END IF;

    -- Invariant 1: Payment Status must be SUCCESS
    IF v_pay.status != 'SUCCESS' THEN
        RAISE EXCEPTION '400 Bad Request: Payment % is not finalized (status: %).', p_payment_id, v_pay.status;
    END IF;

    -- Invariant 2: User ID must match
    IF v_pay.user_id != v_req.user_id THEN
        RAISE EXCEPTION '403 Forbidden: Payment customer does not match custom meal applicant.';
    END IF;

    -- Invariant 3: Restaurant ID must match
    IF v_pay.restaurant_id != (v_snap->>'restaurant_id') THEN
        RAISE EXCEPTION '403 Forbidden: Payment restaurant does not match winning quote restaurant.';
    END IF;

    -- Invariant 4: Amount must match grand_total_tzs exactly
    IF v_pay.amount_tzs != (v_snap->>'grand_total_tzs')::integer THEN
        RAISE EXCEPTION '400 Bad Request: Payment amount (%) does not match locked total (%).', v_pay.amount_tzs, (v_snap->>'grand_total_tzs');
    END IF;

    -- 3. Create Canonical Order in PENDING status
    v_order_id := 'ord_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.orders (
        id, order_number, user_id, restaurant_id, branch_id,
        status, payment_status,
        subtotal_tzs, service_fee_tzs, delivery_fee_tzs, total_tzs,
        dining_option, delivery_address, customer_phone,
        special_instructions, estimated_prep_minutes,
        custom_meal_request_id, custom_meal_snapshot,
        created_at, updated_at
    ) VALUES (
        v_order_id, v_order_number, v_req.user_id, (v_snap->>'restaurant_id'),
        (v_snap->>'branch_id')::uuid,
        'PENDING', -- Canonical Pack 3 starting status (NOT ACCEPTED, NOT CONFIRMED)
        'SUCCESS', -- Governed by payment system
        (v_snap->>'subtotal_tzs')::integer,
        (v_snap->>'service_fee_tzs')::integer,
        (v_snap->>'delivery_fee_tzs')::integer,
        (v_snap->>'grand_total_tzs')::integer,
        CASE WHEN (v_snap->>'fulfillment_mode') = 'PICKUP' THEN 'Pickup' ELSE 'Delivery' END,
        v_req.exact_delivery_address,
        v_req.exact_delivery_phone,
        'Custom Meal: ' || v_req.dish_name || '. Chef Notes: ' || COALESCE(v_snap->>'chef_notes', 'N/A'),
        COALESCE((v_snap->>'estimated_prep_minutes')::integer, 30),
        p_request_id,
        v_snap,
        NOW(), NOW()
    );

    -- 4. Create Order Items from locked snapshot line items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_snap->'line_items') AS x(
        name TEXT, description TEXT, quantity INTEGER, unit_price_tzs INTEGER, line_total_tzs INTEGER
    )
    LOOP
        INSERT INTO public.order_items (
            order_id, item_name, unit_price_tzs, quantity, total_price_tzs, special_notes
        ) VALUES (
            v_order_id, v_item.name, v_item.unit_price_tzs, v_item.quantity,
            v_item.unit_price_tzs * v_item.quantity, v_item.description
        );
    END LOOP;

    -- 5. Update request status to ORDER_CREATED
    UPDATE public.custom_meal_requests SET
        converted_order_id = v_order_id,
        status = 'ORDER_CREATED',
        status_message_en = 'Order placed successfully! Kitchen has received your order.',
        status_message_sw = 'Agizo limewekwa kikamilifu! Jiko limepokea agizo lako.',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 6. Audit Log Entry
    INSERT INTO public.audit_logs (
        admin_user_id, action, target_type, target_id, details
    ) VALUES (
        v_req.user_id, 'CUSTOM_MEAL_ORDER_CONVERTED', 'ORDER', v_order_id,
        jsonb_build_object(
            'custom_meal_request_id', p_request_id,
            'payment_id', p_payment_id,
            'order_number', v_order_number,
            'restaurant_id', (v_snap->>'restaurant_id'),
            'total_tzs', (v_snap->>'grand_total_tzs')
        )
    );

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'status', 'PENDING',
        'payment_status', 'SUCCESS',
        'custom_meal_request_id', p_request_id,
        'idempotent', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES & SECURITY DEFINER HELPERS
-- ----------------------------------------------------------------------------

-- Security definer helper functions break RLS mutual recursion between
-- custom_meal_requests, custom_meal_invitations, and restaurant_quotes.

CREATE OR REPLACE FUNCTION public.is_custom_meal_request_owner(
    p_request_id VARCHAR(80),
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.custom_meal_requests
        WHERE id = p_request_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_invited_restaurant_member(
    p_request_id VARCHAR(80),
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL OR p_request_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.custom_meal_invitations i
        WHERE i.request_id = p_request_id
          AND i.status != 'DECLINED'
          AND public.is_restaurant_member(p_user_id, i.restaurant_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.can_view_restaurant_quote(
    p_quote_id VARCHAR(80),
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    v_restaurant_id VARCHAR(80);
    v_request_id VARCHAR(80);
BEGIN
    IF p_user_id IS NULL OR p_quote_id IS NULL THEN
        RETURN FALSE;
    END IF;
    IF public.is_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;
    SELECT restaurant_id, request_id INTO v_restaurant_id, v_request_id
    FROM public.restaurant_quotes
    WHERE id = p_quote_id;

    IF v_restaurant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_restaurant_member(p_user_id, v_restaurant_id) THEN
        RETURN TRUE;
    END IF;

    RETURN public.is_custom_meal_request_owner(v_request_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- A. restaurant_custom_meal_settings RLS
ALTER TABLE public.restaurant_custom_meal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active published restaurant custom meal settings" ON public.restaurant_custom_meal_settings;
CREATE POLICY "Public can view active published restaurant custom meal settings"
    ON public.restaurant_custom_meal_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = restaurant_id AND r.is_published = TRUE AND r.is_active = TRUE
        )
        OR public.is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Restaurant managers can update their custom meal settings" ON public.restaurant_custom_meal_settings;
CREATE POLICY "Restaurant managers can update their custom meal settings"
    ON public.restaurant_custom_meal_settings FOR ALL
    USING (
        public.is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );

-- B. custom_meal_requests RLS
ALTER TABLE public.custom_meal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view own requests" ON public.custom_meal_requests;
CREATE POLICY "Customers view own requests"
    ON public.custom_meal_requests FOR SELECT
    USING (
        auth.uid() = user_id
        OR public.is_admin(auth.uid())
        OR public.is_invited_restaurant_member(id, auth.uid())
    );

DROP POLICY IF EXISTS "Customers insert own requests" ON public.custom_meal_requests;
CREATE POLICY "Customers insert own requests"
    ON public.custom_meal_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers update own requests" ON public.custom_meal_requests;
CREATE POLICY "Customers update own requests"
    ON public.custom_meal_requests FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- C. custom_meal_invitations RLS
ALTER TABLE public.custom_meal_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurants view own invitations" ON public.custom_meal_invitations;
CREATE POLICY "Restaurants view own invitations"
    ON public.custom_meal_invitations FOR SELECT
    USING (
        public.is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
        OR public.is_custom_meal_request_owner(request_id, auth.uid())
    );

DROP POLICY IF EXISTS "Restaurants update own invitations" ON public.custom_meal_invitations;
CREATE POLICY "Restaurants update own invitations"
    ON public.custom_meal_invitations FOR UPDATE
    USING (
        public.is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );

-- D. restaurant_quotes & line items: HARD COMPETITOR ISOLATION
ALTER TABLE public.restaurant_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_quote_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict competitor quote isolation" ON public.restaurant_quotes;
CREATE POLICY "Strict competitor quote isolation"
    ON public.restaurant_quotes FOR SELECT
    USING (
        public.is_admin(auth.uid())
        OR public.is_restaurant_member(restaurant_id)
        OR public.is_custom_meal_request_owner(request_id, auth.uid())
    );

DROP POLICY IF EXISTS "Restaurants manage own quotes" ON public.restaurant_quotes;
CREATE POLICY "Restaurants manage own quotes"
    ON public.restaurant_quotes FOR ALL
    USING (
        public.is_restaurant_member(restaurant_id)
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Quote items competitor isolation" ON public.restaurant_quote_items;
CREATE POLICY "Quote items competitor isolation"
    ON public.restaurant_quote_items FOR SELECT
    USING (public.can_view_restaurant_quote(quote_id, auth.uid()));

DROP POLICY IF EXISTS "Quote versions competitor isolation" ON public.restaurant_quote_versions;
CREATE POLICY "Quote versions competitor isolation"
    ON public.restaurant_quote_versions FOR SELECT
    USING (public.can_view_restaurant_quote(quote_id, auth.uid()));

-- E. custom_meal_messages: REQUEST-SCOPED CONVERSATION ISOLATION
ALTER TABLE public.custom_meal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Private conversation isolation" ON public.custom_meal_messages;
CREATE POLICY "Private conversation isolation"
    ON public.custom_meal_messages FOR SELECT
    USING (
        public.is_admin(auth.uid())
        OR public.is_restaurant_member(restaurant_id)
        OR public.is_custom_meal_request_owner(request_id, auth.uid())
    );

DROP POLICY IF EXISTS "Authorized users send messages" ON public.custom_meal_messages;
CREATE POLICY "Authorized users send messages"
    ON public.custom_meal_messages FOR INSERT
    WITH CHECK (
        (auth.uid() = sender_user_id AND (
            public.is_admin(auth.uid())
            OR public.is_restaurant_member(restaurant_id)
            OR public.is_custom_meal_request_owner(request_id, auth.uid())
        ))
        OR public.is_admin(auth.uid())
    );

-- F. payments RLS: Allow authenticated users to initiate their own payments
DROP POLICY IF EXISTS "Customers can create own payments" ON public.payments;
CREATE POLICY "Customers can create own payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 13. STORAGE MEDIA AUTHORIZATION ENHANCEMENT FOR CUSTOM MEALS
-- ----------------------------------------------------------------------------

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
BEGIN
    IF p_user_id IS NULL OR p_name IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Platform admins have full operational authority
    IF public.is_admin(p_user_id) THEN
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
            -- Only the customer who owns the request can upload/modify images
            RETURN v_customer_user_id = p_user_id::text;
        ELSIF p_action = 'SELECT' THEN
            -- Owner customer
            IF v_customer_user_id = p_user_id::text THEN
                RETURN TRUE;
            END IF;
            -- Invited restaurants
            RETURN EXISTS (
                SELECT 1 FROM public.custom_meal_invitations i
                WHERE i.request_id = v_request_id
                  AND i.status != 'DECLINED'
                  AND public.is_restaurant_member(p_user_id, i.restaurant_id)
            );
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
-- 14. ENROLL NEW TABLES INTO SUPABASE REALTIME
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_meal_invitations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_quotes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_quote_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_meal_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
