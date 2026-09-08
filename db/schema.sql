-- ============================================================================
-- MLOHUB DATABASE SCHEMA (PostgreSQL / Supabase / CockroachDB)
-- Description: Core relational schema for MloHub dual-account authentication,
--              food discovery, table reservations, custom meal bidding,
--              reviews, payments, and notifications.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. USERS & AUTHENTICATION TABLE
-- ----------------------------------------------------------------------------
CREATE TYPE user_role_enum AS ENUM ('CUSTOMER', 'RESTAURANT_OWNER', 'RESTAURANT_STAFF', 'ADMIN');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'CUSTOMER',
    active_role user_role_enum,
    active_restaurant_id VARCHAR(80),
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'sw')),
    avatar_emoji VARCHAR(10) DEFAULT '👤',
    security_pin VARCHAR(10) DEFAULT '1234',
    company_or_group VARCHAR(150),
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. CUSTOMER PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    delivery_address VARCHAR(255),
    neighborhood VARCHAR(100) DEFAULT 'Mikocheni',
    dietary_preferences TEXT[] DEFAULT '{}',
    favorite_cuisine_types TEXT[] DEFAULT '{}',
    order_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_user_id ON customer_profiles(user_id);

-- ----------------------------------------------------------------------------
-- 3. RESTAURANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TYPE restaurant_verification_enum AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

CREATE TABLE IF NOT EXISTS restaurants (
    id VARCHAR(80) PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    cuisine VARCHAR(100) NOT NULL,
    description TEXT,
    rating NUMERIC(2,1) DEFAULT 4.5 CHECK (rating >= 1.0 AND rating <= 5.0),
    reviews_count INTEGER DEFAULT 0,
    min_price_tzs INTEGER NOT NULL,
    max_price_tzs INTEGER NOT NULL,
    budget_tier VARCHAR(20) DEFAULT 'mid' CHECK (budget_tier IN ('budget', 'mid', 'premium')),
    address VARCHAR(255) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    region_city VARCHAR(100) DEFAULT 'Dar es Salaam',
    distance_km NUMERIC(4,1) NOT NULL DEFAULT 1.0,
    estimated_time VARCHAR(50) DEFAULT '20-30m',
    is_open BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT TRUE,
    verification_status restaurant_verification_enum DEFAULT 'VERIFIED',
    business_reg_number VARCHAR(100),
    verification_doc_url VARCHAR(255),
    opening_hours VARCHAR(50) DEFAULT '08:00 AM',
    closing_hours VARCHAR(50) DEFAULT '10:00 PM',
    logo_url VARCHAR(255),
    cover_image_url VARCHAR(255),
    specialty VARCHAR(200),
    specialist_badge VARCHAR(100),
    specialist_category VARCHAR(100),
    emoji VARCHAR(10),
    tags TEXT[] DEFAULT '{}',
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    supports_order_ahead BOOLEAN DEFAULT TRUE,
    max_group_capacity INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_neighborhood ON restaurants(neighborhood);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);

-- ----------------------------------------------------------------------------
-- 4. RESTAURANT MEMBERSHIPS TABLE
-- ----------------------------------------------------------------------------
CREATE TYPE restaurant_member_role_enum AS ENUM ('OWNER', 'MANAGER', 'CHEF', 'STAFF');

CREATE TABLE IF NOT EXISTS restaurant_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role restaurant_member_role_enum NOT NULL DEFAULT 'OWNER',
    permissions TEXT[] DEFAULT '{"MANAGE_MENU", "MANAGE_ORDERS", "MANAGE_RESERVATIONS", "VIEW_FINANCES"}',
    is_primary_owner BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON restaurant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_restaurant_id ON restaurant_memberships(restaurant_id);

-- ----------------------------------------------------------------------------
-- 5. REFRESH SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    device_info VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token ON refresh_sessions(token);

-- ----------------------------------------------------------------------------
-- 6. MENU ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(80) PRIMARY KEY,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price_tzs INTEGER NOT NULL,
    category VARCHAR(80) DEFAULT 'Main Course',
    is_popular BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);

-- ----------------------------------------------------------------------------
-- 7. RESERVATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(80) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    restaurant_name VARCHAR(150) NOT NULL,
    guests_count VARCHAR(50) NOT NULL,
    reservation_date VARCHAR(50) NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    address VARCHAR(255) NOT NULL,
    special_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. CUSTOM MEAL REQUESTS TABLE (VISION X ENGINE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_meal_requests (
    id VARCHAR(80) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    dish_name VARCHAR(200) NOT NULL,
    restaurant_name VARCHAR(150) NOT NULL,
    target_restaurant_id VARCHAR(80) REFERENCES restaurants(id),
    special_instructions TEXT NOT NULL,
    budget_tzs INTEGER NOT NULL,
    servings_count VARCHAR(20) DEFAULT '2',
    dining_option VARCHAR(30) DEFAULT 'Delivery' CHECK (dining_option IN ('Delivery', 'Dine-In', 'Takeaway')),
    status VARCHAR(50) DEFAULT 'Pending Confirmation' CHECK (status IN ('Pending Confirmation', 'Confirmed', 'Cooking', 'Ready', 'Completed', 'Cancelled')),
    status_message_en TEXT,
    status_message_sw TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 9. PAYMENT TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(80) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(80),
    reservation_id VARCHAR(80),
    restaurant_name VARCHAR(150) NOT NULL,
    amount_tzs INTEGER NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'M-Pesa',
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 10. REVIEWS & NOTIFICATIONS TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(80) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(120) NOT NULL,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(80) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(80) NOT NULL,
    category VARCHAR(40) DEFAULT 'order',
    title_en VARCHAR(200) NOT NULL,
    title_sw VARCHAR(200) NOT NULL,
    message_en TEXT NOT NULL,
    message_sw TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    restaurant_name VARCHAR(150),
    restaurant_id VARCHAR(80),
    price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
