-- ============================================================================
-- MLOHUB STAGE 12 / PACK 3G: PRODUCTION MEDIA PIPELINE & STORAGE RLS POLICIES
-- Managed Bucket: mlohub-media
-- Enforces: Tenant isolation, size limits (10MB), MIME restrictions, strict paths
-- ============================================================================

-- 0. Ensure handle_new_user search_path includes public for trigger execution from auth schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name VARCHAR(120);
    v_phone VARCHAR(30);
    v_requested_type TEXT;
    v_account_type VARCHAR(30);
    v_role public.user_role_enum;
BEGIN
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_phone := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'phone'), ''), '+255' || substr(md5(random()::text), 1, 9));
    v_requested_type := UPPER(COALESCE(new.raw_user_meta_data->>'account_type', 'CUSTOMER'));

    IF v_requested_type IN ('ADMIN', 'SUPER_ADMIN') THEN
        v_account_type := 'CUSTOMER';
        v_role := 'CUSTOMER'::public.user_role_enum;
    ELSIF v_requested_type = 'RESTAURANT' OR v_requested_type = 'RESTAURANT_OWNER' THEN
        v_account_type := 'RESTAURANT';
        v_role := 'RESTAURANT_OWNER'::public.user_role_enum;
    ELSE
        v_account_type := 'CUSTOMER';
        v_role := 'CUSTOMER'::public.user_role_enum;
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        role,
        roles,
        account_type,
        status,
        preferred_language,
        language
    ) VALUES (
        new.id,
        v_full_name,
        new.email,
        v_phone,
        v_role,
        ARRAY[v_role],
        v_account_type,
        'ACTIVE',
        'sw',
        'sw'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = CASE WHEN public.profiles.phone IS NULL OR public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 1. Create or configure mlohub-media bucket with 10MB limit and image MIME restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mlohub-media',
    'mlohub-media',
    TRUE,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Ensure is_admin safely supports service_role execution in addition to profiles
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        RETURN TRUE;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_user_id
        AND (
            role = 'ADMIN' 
            OR role = 'SUPER_ADMIN' 
            OR 'ADMIN' = ANY(roles) 
            OR 'SUPER_ADMIN' = ANY(roles)
            OR account_type = 'ADMIN'
            OR account_type = 'SUPER_ADMIN'
        )
        AND status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper to safely check if user is a platform admin (compatible with both is_admin and is_platform_admin)
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Centralized storage authorization helper for mlohub-media
-- Canonical restaurant ID type: VARCHAR(80) (NO UUID casting)
-- Profile user ID type: UUID
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
    -- User ID in profiles path MUST match the authenticated user UUID
    IF array_length(v_segments, 1) = 3 AND v_segments[1] = 'profiles' THEN
        RETURN v_segments[2] = p_user_id::text;
    END IF;

    -- Restaurant namespace:
    -- Allowed mediaType constrained to: logo, cover, gallery, menu
    -- Branding & Gallery: restaurants/{restaurantId}/{mediaType}/{filename} (length = 4)
    -- Menu items:         restaurants/{restaurantId}/menu/{menuItemId}/{filename} (length = 5)
    IF v_segments[1] = 'restaurants' THEN
        v_restaurant_id := v_segments[2];
        v_media_type := v_segments[3];

        IF v_media_type IN ('logo', 'cover', 'gallery') AND array_length(v_segments, 1) = 4 THEN
            RETURN public.has_restaurant_permission(p_user_id, v_restaurant_id, 'MANAGE_RESTAURANT');
        ELSIF v_media_type = 'menu' AND array_length(v_segments, 1) = 5 THEN
            v_item_id := v_segments[4];
            
            -- Caller must have MANAGE_MENU permission for this restaurant
            IF NOT public.has_restaurant_permission(p_user_id, v_restaurant_id, 'MANAGE_MENU') THEN
                RETURN FALSE;
            END IF;

            -- Prevent cross-tenant hijack: menuItemId cannot belong to a different restaurant
            IF EXISTS (
                SELECT 1 FROM public.menu_items
                WHERE id = v_item_id AND restaurant_id != v_restaurant_id
            ) THEN
                RETURN FALSE;
            END IF;

            RETURN TRUE;
        END IF;
    END IF;

    -- Any other path or shape is strictly unauthorized
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Public Read Policy for mlohub-media
DROP POLICY IF EXISTS "Public read mlohub-media" ON storage.objects;
CREATE POLICY "Public read mlohub-media" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'mlohub-media'
    );

-- 3. Tenant Restaurant & User Profile Insert Policy
DROP POLICY IF EXISTS "Tenant restaurant and user media upload" ON storage.objects;
CREATE POLICY "Tenant restaurant and user media upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'mlohub-media'
        AND public.can_manage_storage_media(auth.uid(), name, 'INSERT')
    );

-- 4. Tenant Restaurant & User Profile Update Policy
DROP POLICY IF EXISTS "Tenant restaurant and user media update" ON storage.objects;
CREATE POLICY "Tenant restaurant and user media update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'mlohub-media'
        AND public.can_manage_storage_media(auth.uid(), name, 'UPDATE')
    );

-- 5. Tenant Restaurant & User Profile Delete Policy
DROP POLICY IF EXISTS "Tenant restaurant and user media delete" ON storage.objects;
CREATE POLICY "Tenant restaurant and user media delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'mlohub-media'
        AND public.can_manage_storage_media(auth.uid(), name, 'DELETE')
    );
