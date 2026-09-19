-- ============================================================================
-- MLOHUB PACK 4F: ADVANCED RESTAURANT, BRANCH, MENU & MEAL OPERATIONS
-- Migration: 20260918000006_pack4f_restaurant_operations.sql
--
-- 1. Branch Operational State (OPEN, BUSY, PAUSED, CLOSED) & Service-Specific Toggles
-- 2. Structured Operating Hours & Special Schedule Overrides
-- 3. Kitchen Capacity Buckets & Deterministic Quote Times
-- 4. Menu Item Operational Stock & Availability Expirations
-- 5. Restaurant-Managed Delivery Zones & Distance/Fee Authority
-- 6. Order Operational Events (Append-Only Lifecycle Log)
-- 7. Operational Audit Log & Incident History
-- 8. Server-Authoritative RPCs & Revalidation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS & DOMAIN TYPES
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE branch_operational_mode_enum AS ENUM (
        'OPEN',
        'BUSY',
        'PAUSED',
        'CLOSED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE branch_service_type_enum AS ENUM (
        'PICKUP',
        'DINE_IN',
        'RESTAURANT_DELIVERY',
        'RESERVATIONS',
        'CUSTOM_MEALS'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE item_stock_status_enum AS ENUM (
        'IN_STOCK',
        'SOLD_OUT_TEMPORARILY',
        'UNAVAILABLE_UNTIL_MANUAL',
        'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE capacity_control_mode_enum AS ENUM (
        'NONE',
        'ORDER_COUNT',
        'ITEM_COUNT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. BRANCH OPERATIONAL CONTROLS & CAPACITY CONFIGURATION
-- ----------------------------------------------------------------------------

ALTER TABLE public.restaurant_branches
    ADD COLUMN IF NOT EXISTS operational_mode branch_operational_mode_enum NOT NULL DEFAULT 'OPEN',
    ADD COLUMN IF NOT EXISTS pause_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS busy_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (busy_delay_minutes >= 0),
    ADD COLUMN IF NOT EXISTS base_prep_minutes INTEGER NOT NULL DEFAULT 25 CHECK (base_prep_minutes >= 5),
    ADD COLUMN IF NOT EXISTS min_prep_minutes INTEGER NOT NULL DEFAULT 15 CHECK (min_prep_minutes >= 5),
    ADD COLUMN IF NOT EXISTS max_prep_minutes INTEGER NOT NULL DEFAULT 90 CHECK (max_prep_minutes >= min_prep_minutes),
    ADD COLUMN IF NOT EXISTS capacity_control_mode capacity_control_mode_enum NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS max_orders_per_interval INTEGER NULL CHECK (max_orders_per_interval IS NULL OR max_orders_per_interval > 0),
    ADD COLUMN IF NOT EXISTS max_items_per_interval INTEGER NULL CHECK (max_items_per_interval IS NULL OR max_items_per_interval > 0),
    ADD COLUMN IF NOT EXISTS capacity_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (capacity_interval_minutes IN (15, 30, 60)),
    ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS custom_meals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS min_order_amount_tzs INTEGER NOT NULL DEFAULT 0 CHECK (min_order_amount_tzs >= 0),
    ADD COLUMN IF NOT EXISTS base_delivery_fee_tzs INTEGER NOT NULL DEFAULT 2500 CHECK (base_delivery_fee_tzs >= 0),
    ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INTEGER NOT NULL DEFAULT 35 CHECK (estimated_delivery_minutes >= 5),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Dar_es_Salaam';

-- ----------------------------------------------------------------------------
-- 3. STRUCTURED OPERATING HOURS (WEEKLY)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday ... 6=Saturday
    service_type branch_service_type_enum NOT NULL DEFAULT 'PICKUP',
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branch_day_service UNIQUE (branch_id, day_of_week, service_type)
);

CREATE INDEX IF NOT EXISTS idx_branch_operating_hours_branch ON public.branch_operating_hours(branch_id);

-- ----------------------------------------------------------------------------
-- 4. SPECIAL SCHEDULE OVERRIDES (HOLIDAYS, MAINTENANCE, SPECIAL OPENINGS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_schedule_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    service_type branch_service_type_enum NOT NULL DEFAULT 'PICKUP',
    opens_at TIME NULL,
    closes_at TIME NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    reason_code VARCHAR(50) NOT NULL DEFAULT 'SPECIAL_EVENT',
    note_internal TEXT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branch_date_service UNIQUE (branch_id, override_date, service_type)
);

CREATE INDEX IF NOT EXISTS idx_branch_schedule_overrides_branch ON public.branch_schedule_overrides(branch_id, override_date);

-- ----------------------------------------------------------------------------
-- 5. RESTAURANT-MANAGED DELIVERY ZONES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.branch_delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    fee_tzs INTEGER NOT NULL CHECK (fee_tzs >= 0),
    minimum_order_tzs INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_tzs >= 0),
    estimated_delivery_minutes INTEGER NOT NULL DEFAULT 30 CHECK (estimated_delivery_minutes >= 5),
    supported_wards TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branch_delivery_zone_name UNIQUE (branch_id, zone_name)
);

CREATE INDEX IF NOT EXISTS idx_branch_delivery_zones_branch ON public.branch_delivery_zones(branch_id);

-- ----------------------------------------------------------------------------
-- 6. MENU ITEM AVAILABILITY & DAYPARTS EXTENSIONS
-- ----------------------------------------------------------------------------

-- Add operational availability expiration and daypart windows to branch_menu_items
ALTER TABLE public.branch_menu_items
    ADD COLUMN IF NOT EXISTS operational_status item_stock_status_enum NOT NULL DEFAULT 'IN_STOCK',
    ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS unavailable_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS daypart_start TIME NULL,
    ADD COLUMN IF NOT EXISTS daypart_end TIME NULL;

-- ----------------------------------------------------------------------------
-- 7. KITCHEN CAPACITY BUCKET TRACKING (15-MIN INTERVAL SLOTS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kitchen_capacity_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    bucket_window_start TIMESTAMPTZ NOT NULL,
    orders_count INTEGER NOT NULL DEFAULT 0 CHECK (orders_count >= 0),
    items_count INTEGER NOT NULL DEFAULT 0 CHECK (items_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_branch_capacity_bucket UNIQUE (branch_id, bucket_window_start)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_capacity_branch_window 
    ON public.kitchen_capacity_buckets(branch_id, bucket_window_start);

-- ----------------------------------------------------------------------------
-- 8. ORDER OPERATIONAL EVENTS (APPEND-ONLY OPERATIONAL TIMELINE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(80) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- ORDER_RECEIVED, ORDER_VIEWED, ORDER_ACCEPTED, PREP_STARTED, READY, DELAY_ADDED, ITEM_ISSUE, CANCELLED
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NULL,
    reason_code VARCHAR(50) NULL,
    event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_operational_events_order ON public.order_operational_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_operational_events_rest ON public.order_operational_events(restaurant_id);

-- ----------------------------------------------------------------------------
-- 9. OPERATIONAL AUDIT LOG (RESTAURANT & BRANCH MANAGEMENT ACTIONS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_operational_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    action VARCHAR(60) NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NULL,
    reason TEXT NULL,
    before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_restaurant_op_audit_rest ON public.restaurant_operational_audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_op_audit_branch ON public.restaurant_operational_audit_logs(branch_id);

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.branch_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_capacity_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_operational_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_operational_audit_logs ENABLE ROW LEVEL SECURITY;

-- 10.1 Operating hours: Public readable, Staff writable with MANAGE_BRANCH_SETTINGS/MANAGE_OPERATIONS
CREATE POLICY "Public read branch operating hours"
    ON public.branch_operating_hours FOR SELECT
    USING (true);

CREATE POLICY "Staff manage branch operating hours"
    ON public.branch_operating_hours FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_operating_hours.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_operating_hours.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    );

-- 10.2 Schedule overrides: Public readable, Staff writable
CREATE POLICY "Public read branch schedule overrides"
    ON public.branch_schedule_overrides FOR SELECT
    USING (true);

CREATE POLICY "Staff manage branch schedule overrides"
    ON public.branch_schedule_overrides FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_schedule_overrides.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_schedule_overrides.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    );

-- 10.3 Delivery zones: Public readable, Staff writable
CREATE POLICY "Public read branch delivery zones"
    ON public.branch_delivery_zones FOR SELECT
    USING (true);

CREATE POLICY "Staff manage branch delivery zones"
    ON public.branch_delivery_zones FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_delivery_zones.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = branch_delivery_zones.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    );

-- 10.4 Kitchen capacity buckets: Restaurant internal only
CREATE POLICY "Staff view kitchen capacity buckets"
    ON public.kitchen_capacity_buckets FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_branches rb
            JOIN public.restaurant_members rm ON rm.restaurant_id = rb.restaurant_id
            WHERE rb.id = kitchen_capacity_buckets.branch_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
        ) OR public.is_admin(auth.uid())
    );

-- 10.5 Order operational events: Customer or Restaurant staff
CREATE POLICY "Users read their order operational events"
    ON public.order_operational_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_operational_events.order_id
              AND o.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.restaurant_members rm
            WHERE rm.restaurant_id = order_operational_events.restaurant_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
        ) OR public.is_admin(auth.uid())
    );

-- 10.6 Audit logs: Restaurant Owner/Manager or Platform Admin
CREATE POLICY "Staff view operational audit logs"
    ON public.restaurant_operational_audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_members rm
            WHERE rm.restaurant_id = restaurant_operational_audit_logs.restaurant_id
              AND rm.user_id = auth.uid()
              AND rm.is_active = true
              AND (rm.role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(rm.permissions))
        ) OR public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 11. CORE STORED PROCEDURES & SERVER-AUTHORITATIVE LOGIC
-- ----------------------------------------------------------------------------

-- 11.1 Check Branch Operational Status Function
CREATE OR REPLACE FUNCTION public.get_branch_operational_status(
    p_branch_id UUID,
    p_service_type branch_service_type_enum DEFAULT 'PICKUP'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_branch RECORD;
    v_rest RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_tz VARCHAR(50);
    v_local_time TIMESTAMPTZ;
    v_local_date DATE;
    v_local_clock TIME;
    v_dow SMALLINT;
    v_override RECORD;
    v_regular_hours RECORD;
    v_is_open BOOLEAN := FALSE;
    v_reason TEXT := 'OK';
    v_effective_prep_min INTEGER;
BEGIN
    -- 1. Fetch branch and restaurant
    SELECT * INTO v_branch FROM public.restaurant_branches WHERE id = p_branch_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('available', false, 'reason', 'BRANCH_NOT_FOUND');
    END IF;

    SELECT * INTO v_rest FROM public.restaurants WHERE id = v_branch.restaurant_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('available', false, 'reason', 'RESTAURANT_NOT_FOUND');
    END IF;

    -- Platform governance check
    IF v_rest.is_active IS FALSE OR v_rest.verification_status = 'SUSPENDED' THEN
        RETURN jsonb_build_object('available', false, 'reason', 'RESTAURANT_SUSPENDED');
    END IF;

    IF v_branch.is_active IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'BRANCH_INACTIVE');
    END IF;

    -- Publication check
    IF v_rest.is_published IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'RESTAURANT_UNPUBLISHED');
    END IF;

    -- Service toggle check
    IF p_service_type = 'PICKUP' AND v_branch.pickup_enabled IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'SERVICE_PICKUP_DISABLED');
    ELSIF p_service_type = 'DINE_IN' AND v_branch.dine_in_enabled IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'SERVICE_DINE_IN_DISABLED');
    ELSIF p_service_type = 'RESTAURANT_DELIVERY' AND v_branch.delivery_enabled IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'SERVICE_DELIVERY_DISABLED');
    ELSIF p_service_type = 'RESERVATIONS' AND v_branch.reservations_enabled IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'SERVICE_RESERVATIONS_DISABLED');
    ELSIF p_service_type = 'CUSTOM_MEALS' AND v_branch.custom_meals_enabled IS FALSE THEN
        RETURN jsonb_build_object('available', false, 'reason', 'SERVICE_CUSTOM_MEALS_DISABLED');
    END IF;

    -- Manual Operational Mode Check
    IF v_branch.operational_mode = 'CLOSED' THEN
        RETURN jsonb_build_object('available', false, 'reason', 'MANUALLY_CLOSED');
    ELSIF v_branch.operational_mode = 'PAUSED' THEN
        -- Check if temporary pause has expired
        IF v_branch.paused_until IS NOT NULL AND v_branch.paused_until <= v_now THEN
            -- Expired: auto resume to OPEN
            UPDATE public.restaurant_branches SET operational_mode = 'OPEN', paused_until = NULL, pause_reason = NULL WHERE id = p_branch_id;
        ELSE
            RETURN jsonb_build_object('available', false, 'reason', 'ORDERS_PAUSED', 'pause_reason', v_branch.pause_reason, 'paused_until', v_branch.paused_until);
        END IF;
    END IF;

    -- Timezone resolution
    v_tz := COALESCE(v_branch.timezone, 'Africa/Dar_es_Salaam');
    v_local_time := timezone(v_tz, v_now);
    v_local_date := v_local_time::date;
    v_local_clock := v_local_time::time;
    v_dow := EXTRACT(DOW FROM v_local_time)::smallint;

    -- Check Special Schedule Override for today
    SELECT * INTO v_override 
    FROM public.branch_schedule_overrides
    WHERE branch_id = p_branch_id 
      AND override_date = v_local_date
      AND (service_type = p_service_type OR service_type = 'PICKUP')
    LIMIT 1;

    IF FOUND THEN
        IF v_override.is_closed THEN
            RETURN jsonb_build_object('available', false, 'reason', 'SPECIAL_CLOSURE', 'reason_code', v_override.reason_code);
        ELSIF v_override.opens_at IS NOT NULL AND v_override.closes_at IS NOT NULL THEN
            IF v_override.opens_at < v_override.closes_at THEN
                v_is_open := (v_local_clock >= v_override.opens_at AND v_local_clock <= v_override.closes_at);
            ELSE
                -- Overnight special hours
                v_is_open := (v_local_clock >= v_override.opens_at OR v_local_clock <= v_override.closes_at);
            END IF;
            IF NOT v_is_open THEN
                RETURN jsonb_build_object('available', false, 'reason', 'OUTSIDE_SPECIAL_HOURS', 'opens_at', v_override.opens_at, 'closes_at', v_override.closes_at);
            END IF;
        END IF;
    ELSE
        -- Check Regular Weekly Operating Hours
        SELECT * INTO v_regular_hours
        FROM public.branch_operating_hours
        WHERE branch_id = p_branch_id 
          AND day_of_week = v_dow
          AND (service_type = p_service_type OR service_type = 'PICKUP')
        LIMIT 1;

        IF FOUND THEN
            IF v_regular_hours.is_closed THEN
                RETURN jsonb_build_object('available', false, 'reason', 'CLOSED_DAY');
            END IF;
            IF v_regular_hours.opens_at < v_regular_hours.closes_at THEN
                v_is_open := (v_local_clock >= v_regular_hours.opens_at AND v_local_clock <= v_regular_hours.closes_at);
            ELSE
                -- Overnight regular schedule (e.g. 18:00 to 02:00)
                v_is_open := (v_local_clock >= v_regular_hours.opens_at OR v_local_clock <= v_regular_hours.closes_at);
            END IF;
            IF NOT v_is_open THEN
                RETURN jsonb_build_object('available', false, 'reason', 'OUTSIDE_OPERATING_HOURS', 'opens_at', v_regular_hours.opens_at, 'closes_at', v_regular_hours.closes_at);
            END IF;
        END IF;
    END IF;

    -- Calculate current prep time quote
    v_effective_prep_min := v_branch.base_prep_minutes;
    IF v_branch.operational_mode = 'BUSY' THEN
        v_effective_prep_min := v_effective_prep_min + v_branch.busy_delay_minutes;
    END IF;

    RETURN jsonb_build_object(
        'available', true,
        'mode', v_branch.operational_mode,
        'estimated_prep_minutes', v_effective_prep_min,
        'busy_delay_minutes', v_branch.busy_delay_minutes,
        'timezone', v_tz
    );
END;
$$;

-- 11.2 Set Branch Operational Mode Secure RPC
CREATE OR REPLACE FUNCTION public.set_branch_operational_mode_secure(
    p_branch_id UUID,
    p_mode branch_operational_mode_enum,
    p_pause_duration_minutes INTEGER DEFAULT NULL,
    p_pause_reason TEXT DEFAULT NULL,
    p_busy_delay_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_branch RECORD;
    v_old_mode branch_operational_mode_enum;
    v_pause_until TIMESTAMPTZ := NULL;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_branch FROM public.restaurant_branches WHERE id = p_branch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Branch % does not exist.', p_branch_id;
    END IF;

    -- RBAC permission check: OWNER, MANAGER or MANAGE_OPERATIONS
    IF NOT (
        public.is_admin(v_caller_id) OR
        EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = v_branch.restaurant_id
              AND user_id = v_caller_id
              AND is_active = true
              AND (role IN ('OWNER', 'MANAGER') OR 'MANAGE_OPERATIONS' = ANY(permissions))
        )
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Caller % lacks MANAGE_OPERATIONS authority for this branch.', v_caller_id;
    END IF;

    v_old_mode := v_branch.operational_mode;

    IF p_mode = 'PAUSED' AND p_pause_duration_minutes IS NOT NULL AND p_pause_duration_minutes > 0 THEN
        v_pause_until := v_now + (p_pause_duration_minutes || ' minutes')::INTERVAL;
    END IF;

    -- Update branch operational state
    UPDATE public.restaurant_branches
    SET operational_mode = p_mode,
        paused_until = v_pause_until,
        pause_reason = CASE WHEN p_mode = 'PAUSED' THEN COALESCE(p_pause_reason, 'Temporary kitchen pause') ELSE NULL END,
        busy_delay_minutes = CASE WHEN p_mode = 'BUSY' AND p_busy_delay_minutes IS NOT NULL THEN p_busy_delay_minutes ELSE busy_delay_minutes END,
        updated_at = v_now
    WHERE id = p_branch_id;

    -- Audit log
    INSERT INTO public.restaurant_operational_audit_logs (
        restaurant_id, branch_id, action, actor_user_id, reason,
        before_state, after_state
    ) VALUES (
        v_branch.restaurant_id,
        p_branch_id,
        'SET_OPERATIONAL_MODE',
        v_caller_id,
        p_pause_reason,
        jsonb_build_object('operational_mode', v_old_mode),
        jsonb_build_object('operational_mode', p_mode, 'paused_until', v_pause_until)
    );

    RETURN jsonb_build_object(
        'success', true,
        'branch_id', p_branch_id,
        'operational_mode', p_mode,
        'paused_until', v_pause_until
    );
END;
$$;

-- 11.3 Set Item Operational Stock Status Secure RPC
CREATE OR REPLACE FUNCTION public.set_item_operational_availability_secure(
    p_branch_id UUID,
    p_menu_item_id VARCHAR(80),
    p_status item_stock_status_enum,
    p_unavailable_until TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_branch RECORD;
    v_item RECORD;
    v_is_avail BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required.';
    END IF;

    SELECT * INTO v_branch FROM public.restaurant_branches WHERE id = p_branch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Branch % does not exist.', p_branch_id;
    END IF;

    SELECT * INTO v_item FROM public.menu_items WHERE id = p_menu_item_id AND restaurant_id = v_branch.restaurant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Item % does not exist in branch restaurant.', p_menu_item_id;
    END IF;

    -- Permission check: OWNER, MANAGER, CHEF or MANAGE_MENU
    IF NOT (
        public.is_admin(v_caller_id) OR
        EXISTS (
            SELECT 1 FROM public.restaurant_members
            WHERE restaurant_id = v_branch.restaurant_id
              AND user_id = v_caller_id
              AND is_active = true
              AND (role IN ('OWNER', 'MANAGER', 'CHEF') OR 'MANAGE_MENU' = ANY(permissions))
        )
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Caller % lacks MANAGE_MENU authority for this branch.', v_caller_id;
    END IF;

    v_is_avail := (p_status = 'IN_STOCK');

    -- Upsert branch_menu_items
    INSERT INTO public.branch_menu_items (
        branch_id, menu_item_id, price_tzs, is_available, stock_status,
        operational_status, unavailable_until, unavailable_reason,
        last_availability_verified_at, updated_at
    ) VALUES (
        p_branch_id, p_menu_item_id, v_item.price_tzs, v_is_avail,
        CASE WHEN v_is_avail THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK' END,
        p_status, p_unavailable_until, p_reason,
        timezone('utc'::text, now()), timezone('utc'::text, now())
    ) ON CONFLICT (branch_id, menu_item_id) DO UPDATE SET
        is_available = v_is_avail,
        stock_status = CASE WHEN v_is_avail THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK' END,
        operational_status = p_status,
        unavailable_until = p_unavailable_until,
        unavailable_reason = p_reason,
        last_availability_verified_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'branch_id', p_branch_id,
        'menu_item_id', p_menu_item_id,
        'operational_status', p_status,
        'is_available', v_is_avail
    );
END;
$$;

-- 11.4 Bulk Set Items Availability Secure RPC
CREATE OR REPLACE FUNCTION public.bulk_set_items_availability_secure(
    p_branch_id UUID,
    p_menu_item_ids TEXT[],
    p_status item_stock_status_enum,
    p_unavailable_until TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item_id TEXT;
    v_count INTEGER := 0;
BEGIN
    FOREACH v_item_id IN ARRAY p_menu_item_ids
    LOOP
        PERFORM public.set_item_operational_availability_secure(
            p_branch_id, v_item_id, p_status, p_unavailable_until, p_reason
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. COMPREHENSIVE AUTHORITATIVE ORDER CREATION REVALIDATION (PACK 4F)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_branch_id UUID,
    p_items JSONB,
    p_fulfillment_type VARCHAR(30) DEFAULT 'Delivery',
    p_delivery_address TEXT DEFAULT NULL,
    p_special_instructions TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_restaurant_id VARCHAR(80);
    v_branch RECORD;
    v_order_id VARCHAR(80);
    v_order_number VARCHAR(50);
    v_subtotal INTEGER := 0;
    v_service_fee INTEGER := 1500;
    v_delivery_fee INTEGER := 0;
    v_total INTEGER := 0;
    v_item RECORD;
    v_trusted_price INTEGER;
    v_item_name TEXT;
    v_is_available BOOLEAN;
    v_is_archived BOOLEAN;
    v_line_subtotal INTEGER;
    v_items_count INTEGER := 0;
    v_total_units INTEGER := 0;
    v_op_status JSONB;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_zone RECORD;
    v_bucket_start TIMESTAMPTZ;
    v_current_orders INTEGER := 0;
    v_current_items INTEGER := 0;
    v_prep_quote INTEGER;
    v_estimated_ready_at TIMESTAMPTZ;
    v_item_stock_status item_stock_status_enum;
    v_item_unavail_until TIMESTAMPTZ;
    v_item_daypart_start TIME;
    v_item_daypart_end TIME;
    v_local_time TIMESTAMPTZ;
    v_local_clock TIME;
BEGIN
    -- 1. Authentication check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Valid authentication required to place an order.';
    END IF;

    -- 2. Resolve & Lock Branch
    SELECT * INTO v_branch
    FROM public.restaurant_branches
    WHERE id = p_branch_id AND is_active = TRUE
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Active restaurant branch % not found.', p_branch_id;
    END IF;

    v_restaurant_id := v_branch.restaurant_id;

    -- 3. Operational Status Revalidation
    v_op_status := public.get_branch_operational_status(
        p_branch_id, 
        CASE WHEN p_fulfillment_type = 'Delivery' THEN 'RESTAURANT_DELIVERY'::branch_service_type_enum ELSE 'PICKUP'::branch_service_type_enum END
    );

    IF (v_op_status->>'available')::boolean IS FALSE THEN
        RAISE EXCEPTION '400 Bad Request: Restaurant branch is currently not accepting orders: %', v_op_status->>'reason';
    END IF;

    v_prep_quote := (v_op_status->>'estimated_prep_minutes')::integer;
    v_estimated_ready_at := v_now + (v_prep_quote || ' minutes')::INTERVAL;

    -- 4. Delivery Zone & Minimum Order Validation
    IF p_fulfillment_type = 'Delivery' THEN
        -- Check if branch delivery zones are defined
        SELECT * INTO v_zone
        FROM public.branch_delivery_zones
        WHERE branch_id = p_branch_id AND is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            v_delivery_fee := v_zone.fee_tzs;
        ELSE
            v_delivery_fee := v_branch.base_delivery_fee_tzs;
        END IF;
    ELSE
        v_delivery_fee := 0;
    END IF;

    v_order_id := 'ord_' || substr(md5(random()::text), 1, 16);
    v_order_number := 'MLO-' || to_char(NOW(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 4);

    -- 5. Validate each item, stock availability, dayparts and calculate trusted subtotal
    v_local_time := timezone(COALESCE(v_branch.timezone, 'Africa/Dar_es_Salaam'), v_now);
    v_local_clock := v_local_time::time;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION '400 Bad Request: Quantity must be at least 1.';
        END IF;

        -- Check branch-specific price & operational availability first
        SELECT 
            COALESCE(bmi.price_tzs, mi.price_tzs),
            mi.name_en,
            COALESCE(bmi.is_available, mi.is_available),
            mi.is_archived,
            bmi.operational_status,
            bmi.unavailable_until,
            bmi.daypart_start,
            bmi.daypart_end
        INTO v_trusted_price, v_item_name, v_is_available, v_is_archived,
             v_item_stock_status, v_item_unavail_until, v_item_daypart_start, v_item_daypart_end
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id AND mi.restaurant_id = v_restaurant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '404 Not Found: Dish % not found at this restaurant.', v_item.menu_item_id;
        END IF;

        IF v_is_archived THEN
            RAISE EXCEPTION '400 Bad Request: Dish % is no longer on the menu.', v_item_name;
        END IF;

        -- Check temporary sold-out expiry
        IF v_item_stock_status = 'SOLD_OUT_TEMPORARILY' AND v_item_unavail_until IS NOT NULL THEN
            IF v_item_unavail_until > v_now THEN
                RAISE EXCEPTION '400 Bad Request: Dish % is temporarily sold out until %.', v_item_name, v_item_unavail_until;
            END IF;
        ELSIF NOT v_is_available OR v_item_stock_status IN ('SOLD_OUT_TEMPORARILY', 'UNAVAILABLE_UNTIL_MANUAL') THEN
            RAISE EXCEPTION '400 Bad Request: Dish % is currently sold out.', v_item_name;
        END IF;

        -- Daypart schedule check (e.g. breakfast menu 06:30-11:00)
        IF v_item_daypart_start IS NOT NULL AND v_item_daypart_end IS NOT NULL THEN
            IF v_item_daypart_start < v_item_daypart_end THEN
                IF v_local_clock < v_item_daypart_start OR v_local_clock > v_item_daypart_end THEN
                    RAISE EXCEPTION '400 Bad Request: Dish % is only available between % and %.', v_item_name, v_item_daypart_start, v_item_daypart_end;
                END IF;
            ELSE
                IF v_local_clock < v_item_daypart_start AND v_local_clock > v_item_daypart_end THEN
                    RAISE EXCEPTION '400 Bad Request: Dish % is only available between % and %.', v_item_name, v_item_daypart_start, v_item_daypart_end;
                END IF;
            END IF;
        END IF;

        v_line_subtotal := v_trusted_price * v_item.quantity;
        v_subtotal := v_subtotal + v_line_subtotal;
        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_item.quantity;
    END LOOP;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION '400 Bad Request: Order must contain at least 1 item.';
    END IF;

    -- Minimum order check
    IF p_fulfillment_type = 'Delivery' AND v_branch.min_order_amount_tzs > 0 AND v_subtotal < v_branch.min_order_amount_tzs THEN
        RAISE EXCEPTION '400 Bad Request: Minimum order for delivery is % TZS.', v_branch.min_order_amount_tzs;
    END IF;

    -- 6. Kitchen Capacity Bucket Check & Lock
    IF v_branch.capacity_control_mode != 'NONE' THEN
        -- Calculate current bucket window (15 minute bucket floor)
        v_bucket_start := date_trunc('hour', v_now) + (floor(extract(minute from v_now) / v_branch.capacity_interval_minutes) * v_branch.capacity_interval_minutes || ' minutes')::interval;

        -- Lock bucket for update
        INSERT INTO public.kitchen_capacity_buckets (branch_id, bucket_window_start, orders_count, items_count)
        VALUES (p_branch_id, v_bucket_start, 0, 0)
        ON CONFLICT (branch_id, bucket_window_start) DO NOTHING;

        SELECT orders_count, items_count INTO v_current_orders, v_current_items
        FROM public.kitchen_capacity_buckets
        WHERE branch_id = p_branch_id AND bucket_window_start = v_bucket_start
        FOR UPDATE;

        IF v_branch.capacity_control_mode = 'ORDER_COUNT' AND v_branch.max_orders_per_interval IS NOT NULL THEN
            IF v_current_orders >= v_branch.max_orders_per_interval THEN
                RAISE EXCEPTION '429 Too Many Requests: Kitchen is currently at maximum capacity for this time slot.';
            END IF;
        ELSIF v_branch.capacity_control_mode = 'ITEM_COUNT' AND v_branch.max_items_per_interval IS NOT NULL THEN
            IF (v_current_items + v_total_units) > v_branch.max_items_per_interval THEN
                RAISE EXCEPTION '429 Too Many Requests: Kitchen is currently at maximum item capacity for this time slot.';
            END IF;
        END IF;

        -- Increment capacity bucket
        UPDATE public.kitchen_capacity_buckets
        SET orders_count = orders_count + 1,
            items_count = items_count + v_total_units,
            updated_at = v_now
        WHERE branch_id = p_branch_id AND bucket_window_start = v_bucket_start;
    END IF;

    v_total := v_subtotal + v_service_fee + v_delivery_fee;

    -- 7. Insert Order Header with Operational Snapshots
    INSERT INTO public.orders (
        id,
        order_number,
        user_id,
        restaurant_id,
        branch_id,
        status,
        payment_status,
        subtotal_tzs,
        service_fee_tzs,
        delivery_fee_tzs,
        total_tzs,
        dining_option,
        delivery_address,
        special_instructions,
        estimated_prep_minutes,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        v_user_id,
        v_restaurant_id,
        p_branch_id,
        'PENDING',
        'PENDING',
        v_subtotal,
        v_service_fee,
        v_delivery_fee,
        v_total,
        p_fulfillment_type,
        p_delivery_address,
        p_special_instructions,
        v_prep_quote,
        v_now,
        v_now
    );

    -- 8. Insert Immutable Order Line Items Snapshots
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (menu_item_id VARCHAR(80), quantity INTEGER, special_notes TEXT)
    LOOP
        SELECT 
            COALESCE(bmi.price_tzs, mi.price_tzs),
            mi.name_en
        INTO v_trusted_price, v_item_name
        FROM public.menu_items mi
        LEFT JOIN public.branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id;

        INSERT INTO public.order_items (
            id,
            order_id,
            menu_item_id,
            item_name,
            item_name_snapshot,
            unit_price_tzs,
            price_snapshot,
            quantity,
            total_price_tzs,
            special_notes
        ) VALUES (
            'item_ord_' || substr(md5(random()::text), 1, 16),
            v_order_id,
            v_item.menu_item_id,
            v_item_name,
            v_item_name,
            v_trusted_price,
            v_trusted_price,
            v_item.quantity,
            v_trusted_price * v_item.quantity,
            v_item.special_notes
        );
    END LOOP;

    -- 9. Record Initial Order Operational Event
    INSERT INTO public.order_operational_events (
        order_id, restaurant_id, branch_id, event_type, actor_user_id, actor_role, event_details
    ) VALUES (
        v_order_id, v_restaurant_id, p_branch_id, 'ORDER_RECEIVED', v_user_id, 'CUSTOMER',
        jsonb_build_object('total_tzs', v_total, 'prep_quote_minutes', v_prep_quote)
    );

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'restaurant_id', v_restaurant_id,
        'branch_id', p_branch_id,
        'subtotal_tzs', v_subtotal,
        'service_fee_tzs', v_service_fee,
        'delivery_fee_tzs', v_delivery_fee,
        'total_tzs', v_total,
        'status', 'PENDING',
        'estimated_prep_minutes', v_prep_quote,
        'estimated_ready_at', v_estimated_ready_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 13. RECORD ORDER OPERATIONAL EVENT RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_order_operational_event_secure(
    p_order_id VARCHAR(80),
    p_event_type VARCHAR(50),
    p_reason_code VARCHAR(50) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_order RECORD;
    v_role VARCHAR(50) := 'STAFF';
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401 Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '404 Not Found: Order % not found.', p_order_id;
    END IF;

    -- Caller check
    IF public.is_admin(v_caller_id) THEN
        v_role := 'ADMIN';
    ELSIF v_order.user_id = v_caller_id THEN
        v_role := 'CUSTOMER';
    ELSE
        SELECT role INTO v_role FROM public.restaurant_members
        WHERE restaurant_id = v_order.restaurant_id AND user_id = v_caller_id AND is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION '403 Forbidden: Caller lacks authority over order %.', p_order_id;
        END IF;
    END IF;

    INSERT INTO public.order_operational_events (
        order_id, restaurant_id, branch_id, event_type,
        actor_user_id, actor_role, reason_code, event_details
    ) VALUES (
        p_order_id, v_order.restaurant_id, v_order.branch_id, p_event_type,
        v_caller_id, v_role, p_reason_code, p_details
    );

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'event_type', p_event_type);
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. SAFEGUARD CASCADE CORRECTION FOR RESTAURANT TEARDOWN
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_restaurant_membership()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_count INTEGER;
    v_target_rest_id VARCHAR(80);
BEGIN
    v_target_rest_id := COALESCE(OLD.restaurant_id, NEW.restaurant_id);

    -- If parent restaurant has been deleted or is being deleted, permit cascade cleanup
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_target_rest_id) THEN
        RETURN OLD;
    END IF;

    -- Platform admin or internal service role can perform administrative cleanup
    IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 1. Prevent deleting or demoting the last active OWNER of an existing restaurant
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (NEW.is_active = FALSE OR NEW.status != 'ACTIVE' OR NEW.role != 'OWNER') AND OLD.role = 'OWNER') THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.restaurant_members
        WHERE restaurant_id = v_target_rest_id
        AND role = 'OWNER'
        AND is_active = TRUE
        AND status = 'ACTIVE'
        AND id != OLD.id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION '403 Forbidden: Cannot remove, deactivate, or demote the sole remaining active OWNER of restaurant %', v_target_rest_id;
        END IF;
    END IF;

    -- 2. Non-admins cannot insert or update membership unless they have MANAGE_STAFF permission
    IF TG_OP = 'INSERT' THEN
        IF NOT public.has_restaurant_permission(auth.uid(), NEW.restaurant_id, 'MANAGE_STAFF') THEN
            RAISE EXCEPTION '403 Forbidden: You do not have permission to add staff to this restaurant.';
        END IF;
        IF NEW.user_id = auth.uid() AND NEW.role = 'OWNER' THEN
            RAISE EXCEPTION '403 Forbidden: You cannot assign yourself as OWNER.';
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

