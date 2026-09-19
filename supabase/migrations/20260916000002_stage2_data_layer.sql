-- ============================================================================
-- MLOHUB STAGE 2: DATA LAYER ENHANCEMENTS & SINGLE SOURCE OF TRUTH
-- Version: 20260916000002
-- Description: Multi-branch model, branch menu pricing, freshness verifications,
--              full-text search, storage buckets, audit logs, and comprehensive RLS.
-- ============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENTITY: RESTAURANT BRANCHES (Multi-Branch Architecture)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL DEFAULT 'Dar es Salaam',
    district VARCHAR(100),
    ward VARCHAR(100),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    phone VARCHAR(30) NOT NULL,
    opening_hours JSONB DEFAULT '{"mon_fri": "07:00-21:00", "sat_sun": "08:00-22:00"}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_rest ON public.restaurant_branches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_active ON public.restaurant_branches(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_coords ON public.restaurant_branches(latitude, longitude);

-- ----------------------------------------------------------------------------
-- ENTITY: BRANCH MENU ITEMS (Branch-Specific Availability & Pricing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(80) NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    price_tzs INTEGER NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    stock_status VARCHAR(30) DEFAULT 'IN_STOCK' CHECK (stock_status IN ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK')),
    last_price_verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    last_availability_verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(branch_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_menu_items_branch ON public.branch_menu_items(branch_id, is_available);
CREATE INDEX IF NOT EXISTS idx_branch_menu_items_item ON public.branch_menu_items(menu_item_id);

-- ----------------------------------------------------------------------------
-- ENTITY: MENU VERIFICATIONS (Freshness, Price Audit & Trust Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    menu_item_id VARCHAR(80) REFERENCES public.menu_items(id) ON DELETE SET NULL,
    verification_type VARCHAR(30) NOT NULL CHECK (verification_type IN ('MENU', 'PRICE', 'AVAILABILITY', 'HOURS')),
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verification_source VARCHAR(30) NOT NULL DEFAULT 'RESTAURANT' CHECK (verification_source IN ('RESTAURANT', 'ADMIN', 'CUSTOMER_REPORT', 'SYSTEM')),
    previous_value JSONB,
    verified_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_verifications_rest ON public.menu_verifications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_verifications_item ON public.menu_verifications(menu_item_id);

-- ----------------------------------------------------------------------------
-- TABLE REFINEMENTS (Immutable Snapshots, Branch FKs & Computed Freshness)
-- ----------------------------------------------------------------------------

-- Add branch_id to orders & reservations
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL;

-- Add immutable snapshots to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS item_name_snapshot VARCHAR(150);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_snapshot INTEGER;

-- Backfill order_items snapshots from item_name & unit_price_tzs if null
UPDATE public.order_items SET item_name_snapshot = item_name WHERE item_name_snapshot IS NULL;
UPDATE public.order_items SET price_snapshot = unit_price_tzs WHERE price_snapshot IS NULL;

-- Freshness timestamps on restaurants & menu_items
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS last_menu_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS last_price_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS last_availability_verified_at TIMESTAMP WITH TIME ZONE;

-- ----------------------------------------------------------------------------
-- FULL-TEXT SEARCH FOUNDATION (Swahili & English Dish Discovery)
-- ----------------------------------------------------------------------------
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR;

CREATE OR REPLACE FUNCTION public.menu_items_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('simple', COALESCE(NEW.name_en, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.name_sw, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description_en, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description_sw, '')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(COALESCE(NEW.dietary_tags, '{}'), ' ')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menu_items_search_vector ON public.menu_items;
CREATE TRIGGER trg_menu_items_search_vector
BEFORE INSERT OR UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.menu_items_search_vector_update();

-- Backfill existing menu items search_tsv
UPDATE public.menu_items SET updated_at = now() WHERE search_tsv IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_search_tsv ON public.menu_items USING GIN(search_tsv);

-- ----------------------------------------------------------------------------
-- SUPABASE STORAGE BUCKETS
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('restaurant-images', 'restaurant-images', true),
    ('menu-images', 'menu-images', true),
    ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage RLS: Public Read Access
CREATE POLICY "Public Read restaurant-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

CREATE POLICY "Public Read menu-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Public Read profile-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- Storage RLS: Authenticated Insert Access
CREATE POLICY "Authenticated Upload restaurant-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'restaurant-images');

CREATE POLICY "Authenticated Upload menu-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "User Upload profile-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- ----------------------------------------------------------------------------

ALTER TABLE public.restaurant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_verifications ENABLE ROW LEVEL SECURITY;

-- 1. Restaurant Branches Policies
CREATE POLICY "Branches are viewable by everyone"
ON public.restaurant_branches FOR SELECT
USING (is_active = TRUE OR public.is_admin() OR EXISTS (
    SELECT 1 FROM public.restaurant_members m
    WHERE m.restaurant_id = public.restaurant_branches.restaurant_id
      AND m.user_id = auth.uid()
      AND m.is_active = TRUE
));

CREATE POLICY "Restaurant owners and staff can manage branches"
ON public.restaurant_branches FOR ALL
TO authenticated
USING (
    public.is_admin() OR EXISTS (
        SELECT 1 FROM public.restaurant_members m
        WHERE m.restaurant_id = public.restaurant_branches.restaurant_id
          AND m.user_id = auth.uid()
          AND m.is_active = TRUE
    )
);

-- 2. Branch Menu Items Policies
CREATE POLICY "Branch menu items viewable by everyone"
ON public.branch_menu_items FOR SELECT
USING (TRUE);

CREATE POLICY "Restaurant members can manage branch menu items"
ON public.branch_menu_items FOR ALL
TO authenticated
USING (
    public.is_admin() OR EXISTS (
        SELECT 1 FROM public.restaurant_branches b
        JOIN public.restaurant_members m ON m.restaurant_id = b.restaurant_id
        WHERE b.id = public.branch_menu_items.branch_id
          AND m.user_id = auth.uid()
          AND m.is_active = TRUE
    )
);

-- 3. Menu Verifications Policies
CREATE POLICY "Menu verifications viewable by authenticated users"
ON public.menu_verifications FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Authorized verifiers can insert verifications"
ON public.menu_verifications FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR EXISTS (
        SELECT 1 FROM public.restaurant_members m
        WHERE m.restaurant_id = public.menu_verifications.restaurant_id
          AND m.user_id = auth.uid()
          AND m.is_active = TRUE
    )
);

-- ----------------------------------------------------------------------------
-- REALTIME PUBLICATION CONFIGURATION
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_quotes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
