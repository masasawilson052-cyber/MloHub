-- ============================================================================
-- MLOHUB SUPABASE AUTH & PROFILES AUTOMATION MIGRATION
-- Migration Version: 20260916000001
-- Description: Sets up production profile synchronization from auth.users,
--              automated trigger for new user signups, server-side role lock,
--              restaurant membership RBAC, and Row-Level Security (RLS) policies.
-- ============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure role enums exist
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM (
        'CUSTOMER',
        'RESTAURANT_OWNER',
        'RESTAURANT_STAFF',
        'ADMIN',
        'SUPER_ADMIN'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE restaurant_member_role_enum AS ENUM (
        'OWNER',
        'MANAGER',
        'CHEF',
        'STAFF'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Enhance / Ensure public.profiles structure
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    role user_role_enum NOT NULL DEFAULT 'CUSTOMER',
    roles user_role_enum[] NOT NULL DEFAULT ARRAY['CUSTOMER'::user_role_enum],
    account_type VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER' CHECK (account_type IN ('CUSTOMER', 'RESTAURANT', 'ADMIN', 'SUPER_ADMIN')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    preferred_language VARCHAR(10) DEFAULT 'sw' CHECK (preferred_language IN ('en', 'sw')),
    language VARCHAR(10) DEFAULT 'sw',
    avatar_url VARCHAR(255),
    avatar_emoji VARCHAR(10) DEFAULT 'ðŸ‘¤',
    location VARCHAR(150) DEFAULT 'Mikocheni, Dar es Salaam',
    delivery_address VARCHAR(255),
    neighborhood VARCHAR(100) DEFAULT 'Mikocheni',
    company_or_group VARCHAR(150),
    dietary_preferences TEXT[] DEFAULT '{}',
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was previously created with earlier migration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type VARCHAR(30) DEFAULT 'CUSTOMER';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'sw';

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);

-- 4. Ensure public.restaurant_members structure
CREATE TABLE IF NOT EXISTS public.restaurant_members (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'mem_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'STAFF' CHECK (role IN ('OWNER', 'MANAGER', 'CHEF', 'STAFF')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'REVOKED', 'SUSPENDED')),
    permissions TEXT[] DEFAULT ARRAY['view_orders', 'update_kitchen_status'],
    is_primary_owner BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_members_user ON public.restaurant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_members_restaurant ON public.restaurant_members(restaurant_id);

-- 5. Automatic Profile Creation Function on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
    v_requested_type TEXT;
    v_account_type TEXT;
    v_role user_role_enum;
BEGIN
    -- Extract metadata safely
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    v_phone := COALESCE(new.raw_user_meta_data->>'phone', '');
    v_requested_type := UPPER(COALESCE(new.raw_user_meta_data->>'account_type', 'CUSTOMER'));

    -- Security Guard: Disallow self-registering as ADMIN or SUPER_ADMIN from client metadata
    IF v_requested_type IN ('ADMIN', 'SUPER_ADMIN') THEN
        v_account_type := 'CUSTOMER';
        v_role := 'CUSTOMER'::user_role_enum;
    ELSIF v_requested_type = 'RESTAURANT' OR v_requested_type = 'RESTAURANT_OWNER' THEN
        v_account_type := 'RESTAURANT';
        v_role := 'RESTAURANT_OWNER'::user_role_enum;
    ELSE
        v_account_type := 'CUSTOMER';
        v_role := 'CUSTOMER'::user_role_enum;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Helper Functions for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (role = 'ADMIN' OR role = 'SUPER_ADMIN' OR account_type = 'ADMIN' OR account_type = 'SUPER_ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Row Level Security (RLS) Policies on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.profiles;
CREATE POLICY "Users can update own safe profile fields" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        -- User cannot escalate their own role, account_type, or status unless admin
        (auth.uid() = id AND 
         role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) AND
         account_type = (SELECT p.account_type FROM public.profiles p WHERE p.id = auth.uid()) AND
         status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))
        OR public.is_admin()
    );

-- 8. Row Level Security (RLS) Policies on Restaurant Members
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own restaurant memberships" ON public.restaurant_members;
CREATE POLICY "Members can view their own restaurant memberships" ON public.restaurant_members
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage restaurant members" ON public.restaurant_members;
CREATE POLICY "Admins manage restaurant members" ON public.restaurant_members
    FOR ALL USING (public.is_admin());

-- ==========================================================
-- PACK2_CANONICAL_MEMBER_STATUS
-- Canonical runtime membership state.
-- ==========================================================

ALTER TABLE public.restaurant_members
    ADD COLUMN IF NOT EXISTS status VARCHAR(20);

UPDATE public.restaurant_members
SET status =
    CASE
        WHEN is_active = TRUE THEN 'ACTIVE'
        ELSE 'INACTIVE'
    END
WHERE status IS NULL
   OR status NOT IN ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED');

ALTER TABLE public.restaurant_members
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE public.restaurant_members
    ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurant_members_status_check_pack2'
    ) THEN
        ALTER TABLE public.restaurant_members
            ADD CONSTRAINT restaurant_members_status_check_pack2
            CHECK (
                status IN (
                    'ACTIVE',
                    'INACTIVE',
                    'INVITED',
                    'SUSPENDED'
                )
            );
    END IF;
END
$$;
