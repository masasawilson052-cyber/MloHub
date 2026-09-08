-- ============================================================================
-- MLOHUB POSTGRESQL & SUPABASE CORE SCHEMA MIGRATION
-- Version: 20260908000001
-- Description: 16 core entities with strict Row Level Security (RLS),
--              indexes, constraints, foreign keys, and realtime publications.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
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
    CREATE TYPE workspace_type_enum AS ENUM (
        'CUSTOMER',
        'RESTAURANT_OWNER',
        'MLOHUB_ADMIN'
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

DO $$ BEGIN
    CREATE TYPE seller_tier_enum AS ENUM (
        'BASIC_SELLER',
        'VERIFIED_SELLER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM (
        'PENDING_VERIFICATION',
        'VERIFIED',
        'REJECTED',
        'SUSPENDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'PENDING',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'PENDING',
        'SUCCESS',
        'FAILED',
        'CANCELLED',
        'REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM (
        'M_PESA',
        'AIRTEL_MONEY',
        'MIXX_BY_YAS',
        'HALOPESA',
        'CARD',
        'CASH'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_category_enum AS ENUM (
        'ORDER',
        'PAYMENT',
        'SYSTEM',
        'RESTAURANT',
        'QUOTE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- ENTITY 1: PROFILES (Integrated with auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'CUSTOMER',
    roles user_role_enum[] NOT NULL DEFAULT ARRAY['CUSTOMER'::user_role_enum],
    active_workspace workspace_type_enum NOT NULL DEFAULT 'CUSTOMER',
    active_restaurant_id VARCHAR(80),
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'sw')),
    avatar_emoji VARCHAR(10) DEFAULT '👤',
    avatar_url VARCHAR(255),
    location VARCHAR(150) DEFAULT 'Mikocheni, Dar es Salaam',
    delivery_address VARCHAR(255),
    neighborhood VARCHAR(100) DEFAULT 'Mikocheni',
    company_or_group VARCHAR(150),
    dietary_preferences TEXT[] DEFAULT '{}',
    favorite_cuisine_types TEXT[] DEFAULT '{}',
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ----------------------------------------------------------------------------
-- ENTITY 2: RESTAURANTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
    id VARCHAR(80) PRIMARY KEY,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    cuisine VARCHAR(100) NOT NULL,
    description TEXT,
    seller_tier seller_tier_enum NOT NULL DEFAULT 'BASIC_SELLER',
    rating NUMERIC(2,1) DEFAULT 4.8 CHECK (rating >= 1.0 AND rating <= 5.0),
    reviews_count INTEGER DEFAULT 0,
    min_price_tzs INTEGER NOT NULL DEFAULT 3000,
    max_price_tzs INTEGER NOT NULL DEFAULT 25000,
    address VARCHAR(255) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL DEFAULT 'Mikocheni',
    region_city VARCHAR(100) DEFAULT 'Dar es Salaam',
    distance_km NUMERIC(4,1) NOT NULL DEFAULT 1.0,
    estimated_prep_time_minutes INTEGER DEFAULT 25,
    is_open BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    verification_status verification_status_enum DEFAULT 'VERIFIED',
    tin_number VARCHAR(50),
    business_license_number VARCHAR(100),
    payout_phone_number VARCHAR(30),
    payout_provider VARCHAR(50) DEFAULT 'M-Pesa',
    opening_hours VARCHAR(50) DEFAULT '07:00 AM',
    closing_hours VARCHAR(50) DEFAULT '10:00 PM',
    logo_url VARCHAR(255),
    cover_image_url VARCHAR(255),
    food_spot_photos TEXT[] DEFAULT '{}',
    specialty VARCHAR(200),
    specialist_badge VARCHAR(100),
    specialist_category VARCHAR(100),
    emoji VARCHAR(10) DEFAULT '🍲',
    tags TEXT[] DEFAULT '{}',
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    supports_order_ahead BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_verification ON public.restaurants(verification_status, is_open);

-- ----------------------------------------------------------------------------
-- ENTITY 3: RESTAURANT MEMBERS (Multi-Tenant RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_members (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'mem_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    role restaurant_member_role_enum NOT NULL DEFAULT 'OWNER',
    permissions TEXT[] DEFAULT ARRAY['ALL'],
    is_primary_owner BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_members_user ON public.restaurant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_members_restaurant ON public.restaurant_members(restaurant_id);

-- ----------------------------------------------------------------------------
-- ENTITY 4: RESTAURANT APPLICATIONS (Public "Apply to Join" Intake)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_applications (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'app_' || substr(md5(random()::text), 1, 16),
    business_name VARCHAR(150) NOT NULL,
    owner_name VARCHAR(120) NOT NULL,
    owner_phone VARCHAR(30) NOT NULL,
    owner_email VARCHAR(255),
    cuisine_type VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    has_tin_or_license BOOLEAN DEFAULT FALSE,
    tin_number VARCHAR(50),
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_status ON public.restaurant_applications(status);

-- ----------------------------------------------------------------------------
-- ENTITY 5: MENU CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'cat_' || substr(md5(random()::text), 1, 16),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name_en VARCHAR(100) NOT NULL,
    name_sw VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_rest ON public.menu_categories(restaurant_id);

-- ----------------------------------------------------------------------------
-- ENTITY 6: MENU ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'item_' || substr(md5(random()::text), 1, 16),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id VARCHAR(80) REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    name_en VARCHAR(150) NOT NULL,
    name_sw VARCHAR(150) NOT NULL,
    description_en TEXT,
    description_sw TEXT,
    price_tzs INTEGER NOT NULL,
    photo_url VARCHAR(255),
    stock_quantity INTEGER DEFAULT 50,
    is_available BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    estimated_prep_time_minutes INTEGER DEFAULT 20,
    dietary_tags TEXT[] DEFAULT '{}',
    spice_level VARCHAR(20) DEFAULT 'Mild',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_items_rest ON public.menu_items(restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- ----------------------------------------------------------------------------
-- ENTITY 7: CUSTOM MEAL REQUESTS (Advance Bespoke Food Demand)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_meal_requests (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'req_' || substr(md5(random()::text), 1, 16),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dish_name VARCHAR(150) NOT NULL,
    special_instructions TEXT,
    budget_tzs INTEGER NOT NULL,
    servings_count VARCHAR(50) NOT NULL,
    dining_option VARCHAR(50) NOT NULL,
    delivery_location VARCHAR(200),
    preferred_time VARCHAR(50),
    status order_status_enum NOT NULL DEFAULT 'PENDING',
    status_message_en VARCHAR(255),
    status_message_sw VARCHAR(255),
    accepted_quote_id VARCHAR(80),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_meal_requests_user ON public.custom_meal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_meal_requests_status ON public.custom_meal_requests(status);

-- ----------------------------------------------------------------------------
-- ENTITY 8: RESTAURANT QUOTES (Specialist Bids on Custom Demand)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_quotes (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'quote_' || substr(md5(random()::text), 1, 16),
    request_id VARCHAR(80) NOT NULL REFERENCES public.custom_meal_requests(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    quoted_price_tzs INTEGER NOT NULL,
    estimated_prep_minutes INTEGER NOT NULL,
    chef_notes TEXT,
    status VARCHAR(30) DEFAULT 'OFFERED' CHECK (status IN ('OFFERED', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_quotes_req ON public.restaurant_quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_quotes_rest ON public.restaurant_quotes(restaurant_id);

-- ----------------------------------------------------------------------------
-- ENTITY 9: ORDERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'ord_' || substr(md5(random()::text), 1, 16),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    status order_status_enum NOT NULL DEFAULT 'PENDING',
    payment_status payment_status_enum NOT NULL DEFAULT 'PENDING',
    subtotal_tzs INTEGER NOT NULL,
    service_fee_tzs INTEGER NOT NULL DEFAULT 1500,
    total_tzs INTEGER NOT NULL,
    delivery_fee_tzs INTEGER DEFAULT 0,
    dining_option VARCHAR(50) NOT NULL DEFAULT 'Delivery',
    delivery_address VARCHAR(255),
    special_instructions TEXT,
    estimated_prep_minutes INTEGER DEFAULT 30,
    accepted_at TIMESTAMP WITH TIME ZONE,
    ready_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ----------------------------------------------------------------------------
-- ENTITY 10: ORDER ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'item_ord_' || substr(md5(random()::text), 1, 16),
    order_id VARCHAR(80) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id VARCHAR(80) REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    unit_price_tzs INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_tzs INTEGER NOT NULL,
    special_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- ----------------------------------------------------------------------------
-- ENTITY 11: RESERVATIONS (Table Bookings & 50% Deposits)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'res_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    party_size INTEGER NOT NULL CHECK (party_size > 0),
    reservation_date DATE NOT NULL,
    reservation_time VARCHAR(20) NOT NULL,
    status VARCHAR(30) DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW')),
    deposit_amount_tzs INTEGER DEFAULT 0,
    is_deposit_paid BOOLEAN DEFAULT FALSE,
    special_requests TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_user ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_rest ON public.reservations(restaurant_id);

-- ----------------------------------------------------------------------------
-- ENTITY 12: PAYMENTS (Tanzanian Mobile Money Transactions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'pay_' || substr(md5(random()::text), 1, 16),
    order_id VARCHAR(80) REFERENCES public.orders(id) ON DELETE SET NULL,
    reservation_id VARCHAR(80) REFERENCES public.reservations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) REFERENCES public.restaurants(id) ON DELETE SET NULL,
    amount_tzs INTEGER NOT NULL,
    platform_commission_tzs INTEGER NOT NULL DEFAULT 0,
    net_restaurant_payout_tzs INTEGER NOT NULL,
    payment_method payment_method_enum NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    status payment_status_enum NOT NULL DEFAULT 'PENDING',
    provider VARCHAR(50) DEFAULT 'CLICKPESA',
    provider_reference VARCHAR(150) UNIQUE,
    provider_transaction_id VARCHAR(150),
    ussd_code VARCHAR(30),
    idempotency_key VARCHAR(150) UNIQUE,
    webhook_verified BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON public.payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON public.payments(idempotency_key);

-- ----------------------------------------------------------------------------
-- ENTITY 13: NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'notif_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    category notification_category_enum NOT NULL DEFAULT 'ORDER',
    title_en VARCHAR(150) NOT NULL,
    title_sw VARCHAR(150) NOT NULL,
    message_en TEXT NOT NULL,
    message_sw TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    order_id VARCHAR(80) REFERENCES public.orders(id) ON DELETE SET NULL,
    restaurant_id VARCHAR(80) REFERENCES public.restaurants(id) ON DELETE SET NULL,
    action_type VARCHAR(50),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- ENTITY 14: REVIEWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'rev_' || substr(md5(random()::text), 1, 16),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id VARCHAR(80) REFERENCES public.orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_rest ON public.reviews(restaurant_id);

-- ----------------------------------------------------------------------------
-- ENTITY 15: OTP CHALLENGES (Salted Hashes with Attempt Rate-Limiting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_challenges (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'otp_' || substr(md5(random()::text), 1, 16),
    phone VARCHAR(30) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'VENDOR_ACTIVATION', -- VENDOR_ACTIVATION, PASSWORD_RESET, LOGIN
    attempts_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone ON public.otp_challenges(phone, is_verified);

-- ----------------------------------------------------------------------------
-- ENTITY 16: AUDIT LOGS (Immutable Security Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(80) PRIMARY KEY DEFAULT 'audit_' || substr(md5(random()::text), 1, 16),
    admin_user_id VARCHAR(80) NOT NULL,
    admin_name VARCHAR(150),
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(150) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_type, target_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_meal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (role = 'ADMIN' OR role = 'SUPER_ADMIN' OR 'ADMIN' = ANY(roles) OR 'SUPER_ADMIN' = ANY(roles))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_restaurant_member(rest_id VARCHAR(80))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id = rest_id
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- 2. Restaurants Policies
CREATE POLICY "Public can view approved and open restaurants" ON public.restaurants
    FOR SELECT USING (is_verified = TRUE AND verification_status = 'VERIFIED' OR public.is_restaurant_member(id) OR public.is_admin());

CREATE POLICY "Admins can insert restaurants" ON public.restaurants
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Owners and Admins can update restaurant" ON public.restaurants
    FOR UPDATE USING (public.is_restaurant_member(id) OR public.is_admin());

-- 3. Menu Items Policies
CREATE POLICY "Public can view available menu items" ON public.menu_items
    FOR SELECT USING (is_archived = FALSE OR public.is_restaurant_member(restaurant_id) OR public.is_admin());

CREATE POLICY "Restaurant Owners and Admins manage menu" ON public.menu_items
    FOR ALL USING (public.is_restaurant_member(restaurant_id) OR public.is_admin());

-- 4. Orders & Order Items Policies
CREATE POLICY "Users and Restaurant Members can view orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR public.is_restaurant_member(restaurant_id) OR public.is_admin());

CREATE POLICY "Users can create orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Restaurant Members and Admins can update orders" ON public.orders
    FOR UPDATE USING (public.is_restaurant_member(restaurant_id) OR public.is_admin());

CREATE POLICY "Users and Restaurant Members can view order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.user_id = auth.uid() OR public.is_restaurant_member(orders.restaurant_id) OR public.is_admin())
        )
    );

-- 5. Payments Policies
CREATE POLICY "Users and Owners can view their payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id OR public.is_restaurant_member(restaurant_id) OR public.is_admin());

-- 6. Notifications Policies
CREATE POLICY "Users can view and manage their notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id);

-- 7. Audit Logs Policies
CREATE POLICY "Only Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_admin());

-- ============================================================================
-- SUPABASE REALTIME PUBLICATION
-- ============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_meal_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
