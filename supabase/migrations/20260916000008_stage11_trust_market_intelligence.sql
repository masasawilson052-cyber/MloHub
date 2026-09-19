-- ============================================================================
-- STAGE 11: EXPLAINABLE TRUST & MARKET INTELLIGENCE SYSTEM MIGRATION
-- ============================================================================

-- 1. Dish Trust Scores (Cached multi-dimensional trust ratings)
CREATE TABLE IF NOT EXISTS dish_trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id VARCHAR(80) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    price_confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (price_confidence_score >= 0.00 AND price_confidence_score <= 1.00),
    freshness_tier TEXT NOT NULL DEFAULT 'FRESH' CHECK (freshness_tier IN ('FRESH', 'RECENT', 'AGING', 'STALE', 'UNKNOWN')),
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_by TEXT DEFAULT 'RESTAURANT' CHECK (last_verified_by IN ('RESTAURANT', 'ADMIN', 'COMMUNITY_VERIFIED')),
    is_disputed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_dish_trust UNIQUE (menu_item_id, restaurant_id)
);

-- 2. Customer Discrepancy Reports (Price/availability discrepancy reports)
CREATE TABLE IF NOT EXISTS customer_discrepancy_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    menu_item_id VARCHAR(80) REFERENCES menu_items(id) ON DELETE SET NULL,
    dish_name TEXT NOT NULL,
    reported_price NUMERIC(12, 2) CHECK (reported_price IS NULL OR reported_price >= 0),
    listed_price NUMERIC(12, 2) CHECK (listed_price IS NULL OR listed_price >= 0),
    category TEXT NOT NULL CHECK (category IN (
        'PRICE_DISCREPANCY',
        'OUT_OF_STOCK',
        'CLOSED_DURING_OPEN_HOURS',
        'WRONG_LOCATION',
        'DISH_NOT_ON_MENU',
        'OTHER'
    )),
    description TEXT,
    evidence_url TEXT,
    reported_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    has_paid_order_history BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_state TEXT NOT NULL DEFAULT 'UNVERIFIED_REPORT' CHECK (evidence_state IN (
        'UNVERIFIED_REPORT',
        'UNDER_REVIEW',
        'CONFIRMED',
        'DISMISSED',
        'RESTAURANT_CORRECTED',
        'ADMIN_RESOLVED'
    )),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 3. Search Analytics Events (Coarsened location, NO precise GPS coordinates)
CREATE TABLE IF NOT EXISTS search_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    results_count INT NOT NULL DEFAULT 0,
    is_zero_result BOOLEAN NOT NULL DEFAULT FALSE,
    is_refinement BOOLEAN NOT NULL DEFAULT FALSE,
    previous_query TEXT,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Zero Result Events (Hotspots of unmet demand)
CREATE TABLE IF NOT EXISTS zero_result_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    ward_name TEXT NOT NULL,
    category_hint TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Discovery Funnel Events (Progression telemetry)
CREATE TABLE IF NOT EXISTS discovery_funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage TEXT NOT NULL CHECK (stage IN (
        'SEARCH_EXECUTED',
        'DISH_IMPRESSION',
        'DISH_CLICKED',
        'RESTAURANT_VIEWED',
        'ADD_TO_CART',
        'CHECKOUT_INITIATED',
        'ORDER_COMPLETED'
    )),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    dish_id VARCHAR(80) REFERENCES menu_items(id) ON DELETE SET NULL,
    restaurant_id VARCHAR(80) REFERENCES restaurants(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    ward_name TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dish_trust_restaurant ON dish_trust_scores(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dish_trust_freshness ON dish_trust_scores(freshness_tier);
CREATE INDEX IF NOT EXISTS idx_discrepancy_restaurant ON customer_discrepancy_reports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_evidence_state ON customer_discrepancy_reports(evidence_state);
CREATE INDEX IF NOT EXISTS idx_search_analytics_ward_query ON search_analytics_events(ward_name, normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_zero_result ON search_analytics_events(is_zero_result);
CREATE INDEX IF NOT EXISTS idx_zero_result_ward ON zero_result_events(ward_name);
CREATE INDEX IF NOT EXISTS idx_funnel_stage_created ON discovery_funnel_events(stage, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE dish_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_discrepancy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE zero_result_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_funnel_events ENABLE ROW LEVEL SECURITY;

-- dish_trust_scores: Anyone can view public scores; Restaurant staff can update their own; Admins full access
CREATE POLICY "Public read dish trust scores"
    ON dish_trust_scores FOR SELECT
    USING (true);

CREATE POLICY "Restaurant staff update own dish trust"
    ON dish_trust_scores FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_members
            WHERE restaurant_members.restaurant_id = dish_trust_scores.restaurant_id
            AND restaurant_members.user_id = auth.uid()
            AND restaurant_members.status = 'ACTIVE'
        )
    );

CREATE POLICY "Admin full access dish trust"
    ON dish_trust_scores FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

-- customer_discrepancy_reports: Customers can insert; Restaurant staff can read their own; Admin full access
CREATE POLICY "Authenticated users insert discrepancy reports"
    ON customer_discrepancy_reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users read own discrepancy reports"
    ON customer_discrepancy_reports FOR SELECT
    USING (reported_by_user_id = auth.uid());

CREATE POLICY "Restaurants read own discrepancy reports"
    ON customer_discrepancy_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_members
            WHERE restaurant_members.restaurant_id = customer_discrepancy_reports.restaurant_id
            AND restaurant_members.user_id = auth.uid()
            AND restaurant_members.status = 'ACTIVE'
        )
    );

CREATE POLICY "Admin full access discrepancy reports"
    ON customer_discrepancy_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

-- Search Analytics & Funnel: Anyone (including anon) can insert telemetry; Admin only can read
CREATE POLICY "Public insert search events"
    ON search_analytics_events FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin read search events"
    ON search_analytics_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

CREATE POLICY "Public insert zero result events"
    ON zero_result_events FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin read zero result events"
    ON zero_result_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

CREATE POLICY "Public insert funnel events"
    ON discovery_funnel_events FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin read funnel events"
    ON discovery_funnel_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'SUPER_ADMIN'
        )
    );

-- ============================================================================
-- SUPABASE REALTIME REPLICATION
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE dish_trust_scores;
        ALTER PUBLICATION supabase_realtime ADD TABLE customer_discrepancy_reports;
    END IF;
END $$;
