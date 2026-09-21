-- ==============================================================================
-- MLOHUB PACK 4A SECURITY HARDENING: CUSTOM MEAL DELIVERY PRIVACY & WRITE GUARDS
-- ==============================================================================
-- 1. Segregates sensitive customer delivery address and phone into a protected
--    table (custom_meal_delivery_details) with strict Row-Level Security.
-- 2. Prevents invited / competing restaurants from reading customer address
--    before their quote is officially ACCEPTED.
-- 3. Guards direct PostgREST INSERT/UPDATE on custom_meal_requests and quotes,
--    forcing client transactions through authoritative database RPCs.
-- ==============================================================================

-- 1. Create protected relation for private delivery details
CREATE TABLE IF NOT EXISTS public.custom_meal_delivery_details (
    request_id VARCHAR(80) PRIMARY KEY REFERENCES public.custom_meal_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exact_delivery_address TEXT,
    exact_delivery_phone VARCHAR(30),
    landmark VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_custom_meal_delivery_user ON public.custom_meal_delivery_details(user_id);

-- 2. Transactionally migrate existing delivery values from custom_meal_requests
INSERT INTO public.custom_meal_delivery_details (
    request_id,
    user_id,
    exact_delivery_address,
    exact_delivery_phone,
    landmark,
    created_at,
    updated_at
)
SELECT
    id,
    user_id,
    exact_delivery_address,
    exact_delivery_phone,
    landmark,
    created_at,
    NOW()
FROM public.custom_meal_requests
WHERE exact_delivery_address IS NOT NULL OR exact_delivery_phone IS NOT NULL
ON CONFLICT (request_id) DO UPDATE SET
    exact_delivery_address = EXCLUDED.exact_delivery_address,
    exact_delivery_phone = EXCLUDED.exact_delivery_phone,
    landmark = EXCLUDED.landmark,
    updated_at = NOW();

-- 3. Redact private contact columns from the shared custom_meal_requests table
UPDATE public.custom_meal_requests
SET exact_delivery_address = NULL,
    exact_delivery_phone = NULL;

-- 4. Enable Row Level Security on custom_meal_delivery_details
ALTER TABLE public.custom_meal_delivery_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer owner reads own delivery details" ON public.custom_meal_delivery_details;
CREATE POLICY "Customer owner reads own delivery details"
    ON public.custom_meal_delivery_details
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin reads all delivery details" ON public.custom_meal_delivery_details;
CREATE POLICY "Admin reads all delivery details"
    ON public.custom_meal_delivery_details
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Accepted restaurant reads customer delivery details" ON public.custom_meal_delivery_details;
CREATE POLICY "Accepted restaurant reads customer delivery details"
    ON public.custom_meal_delivery_details
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_quotes rq
            JOIN public.restaurant_members rm ON rm.restaurant_id = rq.restaurant_id
            WHERE rq.request_id = custom_meal_delivery_details.request_id
              AND rq.status = 'ACCEPTED'
              AND rm.user_id = auth.uid()
              AND rm.is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "Customer updates own delivery details" ON public.custom_meal_delivery_details;
CREATE POLICY "Customer updates own delivery details"
    ON public.custom_meal_delivery_details
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 5. Authoritative RPC to retrieve delivery details for accepted fulfillment
CREATE OR REPLACE FUNCTION public.get_custom_meal_delivery_details(p_request_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_details RECORD;
    v_is_owner BOOLEAN;
    v_is_admin BOOLEAN;
    v_is_accepted_restaurant BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    v_is_admin := public.is_admin(auth.uid());
    
    SELECT EXISTS (
        SELECT 1 FROM public.custom_meal_requests
        WHERE id = p_request_id AND user_id = auth.uid()
    ) INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_quotes rq
        JOIN public.restaurant_members rm ON rm.restaurant_id = rq.restaurant_id
        WHERE rq.request_id = p_request_id
          AND rq.status = 'ACCEPTED'
          AND rm.user_id = auth.uid()
          AND rm.is_active = TRUE
    ) INTO v_is_accepted_restaurant;

    IF NOT (v_is_owner OR v_is_admin OR v_is_accepted_restaurant) THEN
        RAISE EXCEPTION '403 Forbidden: Delivery details are restricted to the request owner, platform administrators, or the accepted kitchen.';
    END IF;

    SELECT * INTO v_details
    FROM public.custom_meal_delivery_details
    WHERE request_id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'request_id', p_request_id,
            'exact_delivery_address', NULL,
            'exact_delivery_phone', NULL,
            'landmark', NULL
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_details.request_id,
        'exact_delivery_address', v_details.exact_delivery_address,
        'exact_delivery_phone', v_details.exact_delivery_phone,
        'landmark', v_details.landmark,
        'updated_at', v_details.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Update create_structured_custom_meal_request to store private details in the secure relation
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

    IF nullif(btrim(p_title),'') IS NULL OR nullif(btrim(p_customer_area),'') IS NULL THEN
        RAISE EXCEPTION 'Food name and service area are required.';
    END IF;

    -- Serialize active-request check
    PERFORM id FROM public.profiles WHERE id = v_user_id FOR UPDATE;

    SELECT COUNT(*) INTO v_active_count
    FROM public.custom_meal_requests
    WHERE user_id = v_user_id
      AND status IN ('PENDING', 'QUOTES_RECEIVED', 'QUOTE_ACCEPTED');

    IF v_active_count >= 3 THEN
        RAISE EXCEPTION '429 Too Many Requests: Maximum 3 active custom meal requests permitted simultaneously.';
    END IF;

    IF p_desired_at IS NULL OR p_desired_at <= NOW() + INTERVAL '30 minutes' THEN
        RAISE EXCEPTION '400 Bad Request: desired_at must be at least 30 minutes in the future.';
    END IF;

    IF p_quote_deadline IS NULL OR p_quote_deadline >= p_desired_at OR p_quote_deadline <= NOW() THEN
        RAISE EXCEPTION '400 Bad Request: quote_deadline must be in the future and before desired_at.';
    END IF;

    IF p_servings IS NULL OR p_servings < 1 THEN
        RAISE EXCEPTION '400 Bad Request: Servings must be at least 1.';
    END IF;

    IF p_budget_type = 'FIXED' AND (p_budget_min_tzs IS NULL OR p_budget_min_tzs < 5000) THEN
        RAISE EXCEPTION '400 Bad Request: Minimum budget is 5,000 TZS.';
    END IF;

    v_request_id := 'req_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_order_number := 'MLO-REQ-' || substr(to_char(NOW(), 'YYMMDDHH24MISS'), 3) || '-' || substr(md5(random()::text), 1, 4);
    v_expires_at := p_desired_at;

    -- Insert request row with redacted contact columns (visible to invitees)
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
        NULL, NULL, -- Redacted from shared table
        p_occasion, p_cuisine_type, p_spice_level,
        COALESCE(p_ingredients_requested, '{}'), COALESCE(p_ingredients_to_avoid, '{}'),
        COALESCE(p_dietary_tags, '{}'), COALESCE(p_allergens, '{}'),
        p_desired_at, p_quote_deadline, v_expires_at, COALESCE(p_reference_images, '{}'),
        'PENDING', 'Request created. Finding qualified kitchens...', 'Ombi limeundwa. Inatafuta wapishi...',
        NOW()
    );

    -- Insert private contact details into protected relation
    IF (p_exact_delivery_address IS NOT NULL AND btrim(p_exact_delivery_address) <> '') OR
       (p_exact_delivery_phone IS NOT NULL AND btrim(p_exact_delivery_phone) <> '') THEN
        INSERT INTO public.custom_meal_delivery_details (
            request_id,
            user_id,
            exact_delivery_address,
            exact_delivery_phone,
            landmark,
            created_at,
            updated_at
        ) VALUES (
            v_request_id,
            v_user_id,
            nullif(btrim(p_exact_delivery_address), ''),
            nullif(btrim(p_exact_delivery_phone), ''),
            nullif(btrim(p_landmark), ''),
            NOW(),
            NOW()
        );
    END IF;

    -- Execute server-side matching engine
    v_result := public.match_and_invite_restaurants(v_request_id);
    UPDATE public.custom_meal_requests SET
      status_message_en=CASE WHEN (v_result->>'invited_count')::int=0 THEN 'Saved. No eligible restaurant is available for these requirements yet.' ELSE 'Sent to eligible restaurants. Waiting for quotes.' END,
      status_message_sw=CASE WHEN (v_result->>'invited_count')::int=0 THEN 'Ombi limehifadhiwa. Hakuna mgahawa unaokidhi mahitaji kwa sasa.' ELSE 'Imetumwa kwa migahawa inayofaa. Subiri bei zao.' END
    WHERE id=v_request_id;

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

-- 7. Direct-write mutation protections on custom_meal_requests
CREATE OR REPLACE FUNCTION public.protect_custom_meal_requests_direct_write()
RETURNS TRIGGER AS $$
BEGIN
    -- Permit service role and platform administrators
    IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Block direct INSERT by ordinary authenticated users (must use create_structured_custom_meal_request)
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION '403 Forbidden: Custom meal requests must be created via create_structured_custom_meal_request RPC.';
    END IF;

    -- On direct UPDATE, protect immutable business fields
    IF TG_OP = 'UPDATE' THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION '403 Forbidden: Changing request ownership is prohibited.';
        END IF;
        IF NEW.order_number IS DISTINCT FROM OLD.order_number THEN
            RAISE EXCEPTION '403 Forbidden: Order numbers are immutable.';
        END IF;
        -- Ordinary customers may only withdraw/cancel their own request (status -> CANCELLED)
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT (OLD.user_id = auth.uid() AND NEW.status = 'CANCELLED' AND OLD.status IN ('PENDING', 'QUOTES_RECEIVED')) THEN
                RAISE EXCEPTION '403 Forbidden: Status transitions must occur through authoritative quoting or order RPCs.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_custom_meal_requests_direct_write ON public.custom_meal_requests;
CREATE TRIGGER trg_protect_custom_meal_requests_direct_write
    BEFORE INSERT OR UPDATE ON public.custom_meal_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_custom_meal_requests_direct_write();

-- 8. Direct-write mutation protections on restaurant_quotes
CREATE OR REPLACE FUNCTION public.protect_restaurant_quotes_direct_write()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Block direct transition to ACCEPTED via PostgREST (must use accept_custom_meal_quote RPC)
    IF TG_OP = 'UPDATE' AND NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
        RAISE EXCEPTION '403 Forbidden: Quotes can only be accepted through the accept_custom_meal_quote RPC.';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_restaurant_quotes_direct_write ON public.restaurant_quotes;
CREATE TRIGGER trg_protect_restaurant_quotes_direct_write
    BEFORE INSERT OR UPDATE ON public.restaurant_quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_restaurant_quotes_direct_write();

-- 9. Table privileges & Realtime publication
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_meal_delivery_details TO authenticated;
GRANT ALL ON public.custom_meal_delivery_details TO service_role;
GRANT EXECUTE ON FUNCTION public.get_custom_meal_delivery_details(VARCHAR) TO authenticated, service_role;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'custom_meal_delivery_details'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_meal_delivery_details;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
