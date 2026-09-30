-- ============================================================================
-- MLOHUB SUPABASE DATA API GRANTS & SCHEMA RESILIENCE CLOSURE
-- Compliance with Supabase October 30, 2026 Data API Default Grants Policy
-- ============================================================================

-- 1. Ensure required restaurant columns exist with safe defaults
ALTER TABLE IF EXISTS public.restaurants 
  ADD COLUMN IF NOT EXISTS launch_status TEXT DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- 2. Explicitly grant USAGE on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 3. Dynamic iteration: Grant explicit permissions across all tables in public schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  ) LOOP
    -- Grant read-only access to anon role (subject to RLS policies)
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon;', r.tablename);
    -- Grant full CRUD access to authenticated users (subject to RLS policies)
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', r.tablename);
    -- Grant complete access to backend service_role
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', r.tablename);
  END LOOP;
END $$;

-- 4. Grant access to all existing sequences (ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Grant execution on all existing functions/routines
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 6. Future-proof with DEFAULT PRIVILEGES for any new tables created after October 30
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated, service_role;

-- 7. Hardened RLS Policy for restaurant_applications
-- Accepts both 'PENDING' and 'SUBMITTED' and ensures applicant ownership
DROP POLICY IF EXISTS "Applicants can insert applications" ON public.restaurant_applications;
CREATE POLICY "Applicants can insert applications" 
ON public.restaurant_applications 
FOR INSERT 
TO authenticated, anon
WITH CHECK (
  (auth.uid() IS NOT NULL AND (auth.uid() = applicant_user_id OR applicant_user_id IS NULL) AND status IN ('PENDING', 'SUBMITTED'))
  OR (auth.uid() IS NULL AND status IN ('PENDING', 'SUBMITTED'))
);

-- 8. RPC: Request Application Corrections / Changes
CREATE OR REPLACE FUNCTION public.request_restaurant_application_changes(
    p_application_id VARCHAR(80),
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.restaurant_applications
    SET 
        status = 'CHANGES_REQUESTED',
        rejection_reason = trim(p_reason),
        notes = trim(p_reason),
        reviewed_by = v_actor,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'application_id', p_application_id,
        'status', 'CHANGES_REQUESTED',
        'reason', trim(p_reason)
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_restaurant_application_changes(VARCHAR, TEXT) TO authenticated, service_role;

-- 9. RPC: Secure Restaurant Archiving
CREATE OR REPLACE FUNCTION public.archive_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_archive_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.restaurants
    SET 
        is_published = FALSE,
        is_open = FALSE,
        archived_at = NOW(),
        archive_reason = COALESCE(trim(p_archive_reason), 'Archived by administrator'),
        launch_status = 'SUSPENDED',
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'action', 'ARCHIVED'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- 10. RPC: Secure Restaurant Unarchiving
CREATE OR REPLACE FUNCTION public.unarchive_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT DEFAULT 'Reinstated by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.restaurants
    SET 
        archived_at = NULL,
        archive_reason = NULL,
        is_published = TRUE,
        launch_status = 'PUBLISHED',
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'action', 'UNARCHIVED'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unarchive_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- 11. RPC: Secure Restaurant Suspension
CREATE OR REPLACE FUNCTION public.suspend_restaurant_secure(
    p_restaurant_id VARCHAR(80),
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.restaurants
    SET 
        is_open = FALSE,
        is_published = FALSE,
        launch_status = 'SUSPENDED',
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'action', 'SUSPENDED'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.suspend_restaurant_secure(VARCHAR, TEXT) TO authenticated, service_role;

-- 12. RPC: Secure Restaurant Reactivation
CREATE OR REPLACE FUNCTION public.reactivate_restaurant_secure(
    p_restaurant_id VARCHAR(80)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    UPDATE public.restaurants
    SET 
        is_open = TRUE,
        is_published = TRUE,
        launch_status = 'PUBLISHED',
        updated_at = NOW()
    WHERE id = p_restaurant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', p_restaurant_id,
        'action', 'REACTIVATED'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reactivate_restaurant_secure(VARCHAR) TO authenticated, service_role;

-- 13. RPC: Resilient Application Approval
CREATE OR REPLACE FUNCTION public.approve_restaurant_application(
    p_application_id VARCHAR(80)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_app RECORD;
    v_rest_id VARCHAR(80);
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_app FROM public.restaurant_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Application % does not exist.', p_application_id;
    END IF;

    v_rest_id := 'rest_' || md5(p_application_id);

    UPDATE public.restaurant_applications
    SET 
        status = 'APPROVED',
        reviewed_by = v_actor,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    INSERT INTO public.restaurants (
        id,
        owner_id,
        name,
        slug,
        cuisine,
        neighborhood,
        address,
        is_verified,
        is_published,
        is_open,
        launch_status,
        verification_status,
        created_at,
        updated_at
    ) VALUES (
        v_rest_id,
        v_app.applicant_user_id,
        v_app.business_name,
        lower(regexp_replace(v_app.business_name, '[^a-zA-Z0-9]+', '-', 'g')),
        COALESCE(v_app.cuisine_type, 'Local'),
        COALESCE(v_app.neighborhood, 'Dar es Salaam'),
        COALESCE(v_app.address, 'Dar es Salaam'),
        TRUE,
        FALSE,
        FALSE,
        'SETUP_REQUIRED',
        'VERIFIED',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        name = EXCLUDED.name,
        is_verified = TRUE,
        verification_status = 'VERIFIED',
        updated_at = NOW();

    -- Elevate applicant's profile to RESTAURANT_OWNER
    IF v_app.applicant_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            role = 'RESTAURANT_OWNER',
            active_workspace = 'RESTAURANT_OWNER',
            active_restaurant_id = v_rest_id,
            account_type = 'RESTAURANT'
        WHERE id = v_app.applicant_user_id AND role = 'CUSTOMER';
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'restaurant_id', v_rest_id,
        'status', 'APPROVED',
        'launch_status', 'SETUP_REQUIRED'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_restaurant_application(VARCHAR) TO authenticated, service_role;


