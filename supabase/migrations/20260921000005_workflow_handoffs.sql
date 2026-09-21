-- Repair registration approval and request delivery; no sample records are added.
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

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    IF v_app.status = 'APPROVED' THEN
        SELECT details->>'restaurant_id' INTO v_rest_id FROM public.audit_logs
        WHERE action='APPROVE_APPLICATION' AND target_id=p_application_id ORDER BY created_at DESC LIMIT 1;
        IF v_rest_id IS NULL THEN RAISE EXCEPTION 'Approved application needs administrator reconciliation.'; END IF;
        RETURN jsonb_build_object('success',true,'restaurant_id',v_rest_id,'status','APPROVED');
    END IF;
    IF v_app.status NOT IN ('PENDING','UNDER_REVIEW') THEN RAISE EXCEPTION 'Only pending applications can be approved.'; END IF;
    v_applicant := v_app.applicant_user_id;
    IF v_applicant IS NULL THEN RAISE EXCEPTION 'Application has no authenticated owner.'; END IF;

    -- Update application status
    UPDATE public.restaurant_applications
    SET status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    -- Stable application identity prevents same-name businesses sharing ownership.
    v_rest_id := 'rest_' || md5(p_application_id);

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
    );

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
            roles = ARRAY['CUSTOMER','RESTAURANT_OWNER']::public.user_role_enum[],
            account_type = 'RESTAURANT',
            active_workspace = 'RESTAURANT_OWNER',
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
    -- Serialize the per-customer active-request limit across concurrent submissions.
    PERFORM id FROM public.profiles WHERE id=v_user_id FOR UPDATE;
    -- Anti-Spam: Rate limit max active requests
    SELECT COUNT(*) INTO v_active_count
    FROM public.custom_meal_requests
    WHERE user_id = v_user_id
      AND status IN ('PENDING', 'QUOTES_RECEIVED', 'QUOTE_ACCEPTED');

    IF v_active_count >= 3 THEN
        RAISE EXCEPTION '429 Too Many Requests: Maximum 3 active custom meal requests permitted simultaneously.';
    END IF;

    -- Validate timing
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

-- Matching is an internal action of the authenticated create-request RPC.
REVOKE ALL ON FUNCTION public.match_and_invite_restaurants(VARCHAR) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.match_and_invite_restaurants(VARCHAR) TO service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['restaurant_applications','custom_meal_requests','custom_meal_invitations','restaurant_quotes','orders'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
