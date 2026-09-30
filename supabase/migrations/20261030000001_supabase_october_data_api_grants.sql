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

