-- ============================================================================
-- MLOHUB PACK 4B: RESERVATIONS, CAPACITY & DEPOSIT MANAGEMENT
-- Migration: 20260918000002_pack4b_reservation_system.sql
-- ============================================================================

-- Section 0: Required Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Section 1: Schema Updates to public.reservations
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS chk_reservations_status;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reference VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS table_id UUID,
  ADD COLUMN IF NOT EXISTS confirmation_mode VARCHAR(20) DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS deposit_policy VARCHAR(20) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS deposit_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restaurant_note TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(60),
  ADD COLUMN IF NOT EXISTS payment_id VARCHAR(80) REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_24h_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2h_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS area_preference VARCHAR(30) DEFAULT 'ANY',
  ADD COLUMN IF NOT EXISTS refund_eligibility VARCHAR(30) DEFAULT 'NONE';

-- Add constraints
ALTER TABLE public.reservations
  ADD CONSTRAINT chk_reservations_status CHECK (
    status IN (
      'PENDING',
      'PENDING_RESTAURANT_APPROVAL',
      'AWAITING_DEPOSIT',
      'CONFIRMED',
      'SEATED',
      'COMPLETED',
      'CANCELLED',
      'REJECTED',
      'NO_SHOW',
      'EXPIRED',
      'PAYMENT_REVIEW_REQUIRED'
    )
  );

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS chk_reservations_area_pref;
ALTER TABLE public.reservations
  ADD CONSTRAINT chk_reservations_area_pref CHECK (
    area_preference IN ('INDOOR', 'OUTDOOR', 'QUIET', 'WINDOW', 'ANY')
  );

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS chk_reservations_refund_eligibility;
ALTER TABLE public.reservations
  ADD CONSTRAINT chk_reservations_refund_eligibility CHECK (
    refund_eligibility IN ('NONE', 'ELIGIBLE', 'NOT_ELIGIBLE', 'MANUAL_REVIEW')
  );

-- Database trigger to keep legacy reservation_date & reservation_time synchronized
CREATE OR REPLACE FUNCTION public.sync_reservation_legacy_datetime()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_at IS NOT NULL THEN
    NEW.reservation_date := (NEW.scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
    NEW.reservation_time := to_char(NEW.scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam', 'HH12:MI AM');
  ELSIF NEW.reservation_date IS NOT NULL AND NEW.reservation_time IS NOT NULL THEN
    BEGIN
      NEW.scheduled_at := (NEW.reservation_date || ' ' || NEW.reservation_time)::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam';
    EXCEPTION WHEN OTHERS THEN
      -- Fallback if format is irregular
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_reservation_legacy_datetime ON public.reservations;
CREATE TRIGGER trg_sync_reservation_legacy_datetime
  BEFORE INSERT OR UPDATE OF scheduled_at, reservation_date, reservation_time
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reservation_legacy_datetime();

-- Section 2: public.reservation_settings (Branch-specific)
CREATE TABLE IF NOT EXISTS public.reservation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  reservations_enabled BOOLEAN DEFAULT TRUE,
  capacity_mode VARCHAR(20) DEFAULT 'CAPACITY_ONLY' CHECK (capacity_mode IN ('CAPACITY_ONLY', 'TABLE_BASED')),
  confirmation_mode VARCHAR(20) DEFAULT 'AUTO' CHECK (confirmation_mode IN ('AUTO', 'MANUAL')),
  slot_duration_minutes INTEGER DEFAULT 30 CHECK (slot_duration_minutes > 0),
  minimum_advance_minutes INTEGER DEFAULT 60 CHECK (minimum_advance_minutes >= 0),
  maximum_advance_days INTEGER DEFAULT 30 CHECK (maximum_advance_days > 0),
  minimum_party_size INTEGER DEFAULT 1 CHECK (minimum_party_size > 0),
  maximum_party_size INTEGER DEFAULT 20 CHECK (maximum_party_size >= minimum_party_size),
  default_slot_capacity INTEGER DEFAULT 20 CHECK (default_slot_capacity > 0),
  grace_period_minutes INTEGER DEFAULT 20 CHECK (grace_period_minutes >= 0),
  turn_time_minutes INTEGER DEFAULT 90 CHECK (turn_time_minutes > 0),
  deposit_policy VARCHAR(20) DEFAULT 'NONE' CHECK (deposit_policy IN ('NONE', 'FIXED', 'PERCENTAGE')),
  deposit_fixed_tzs INTEGER DEFAULT 0 CHECK (deposit_fixed_tzs >= 0),
  deposit_percentage NUMERIC(5,2) DEFAULT 0 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100),
  deposit_due_minutes INTEGER DEFAULT 30 CHECK (deposit_due_minutes > 0),
  allow_same_day BOOLEAN DEFAULT TRUE,
  accepts_walk_ins BOOLEAN DEFAULT TRUE,
  auto_expire_pending_minutes INTEGER DEFAULT 30 CHECK (auto_expire_pending_minutes > 0),
  free_cancellation_before_minutes INTEGER DEFAULT 120 CHECK (free_cancellation_before_minutes >= 0),
  late_cancellation_behavior VARCHAR(30) DEFAULT 'MANUAL_REVIEW' CHECK (late_cancellation_behavior IN ('MANUAL_REVIEW', 'REFUND_ELIGIBLE', 'REFUND_NOT_ELIGIBLE')),
  no_show_behavior VARCHAR(30) DEFAULT 'RECORD_ONLY',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_reservation_settings_branch UNIQUE (branch_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_settings_rest ON public.reservation_settings(restaurant_id);

-- Section 3: public.restaurant_tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  label VARCHAR(30) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  area VARCHAR(30) DEFAULT 'INDOOR' CHECK (area IN ('INDOOR', 'OUTDOOR', 'QUIET', 'WINDOW')),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_restaurant_table_branch_label UNIQUE (branch_id, label)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_branch ON public.restaurant_tables(branch_id);

-- Section 4: public.reservation_table_allocations (PostgreSQL Exclusion Constraint with GiST)
CREATE TABLE IF NOT EXISTS public.reservation_table_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id VARCHAR(80) NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  slot_interval TSTZRANGE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  EXCLUDE USING gist (
    table_id WITH =,
    slot_interval WITH &&
  ) WHERE (is_active = TRUE)
);

CREATE INDEX IF NOT EXISTS idx_table_allocations_branch ON public.reservation_table_allocations(branch_id);
CREATE INDEX IF NOT EXISTS idx_table_allocations_res ON public.reservation_table_allocations(reservation_id);

-- Section 5: public.reservation_holds (Temporary Capacity & Table Holds)
CREATE TABLE IF NOT EXISTS public.reservation_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id VARCHAR(80) NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservation_holds_active_branch
  ON public.reservation_holds (branch_id, slot_start, slot_end)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reservation_holds_res ON public.reservation_holds(reservation_id);

-- Section 6: public.reservation_blackouts
CREATE TABLE IF NOT EXISTS public.reservation_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR(80) NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT chk_blackout_ordering CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_reservation_blackouts_branch
  ON public.reservation_blackouts (branch_id, starts_at, ends_at);

-- Section 7: Helper Functions & Security Definer Procedures

-- 7.1 Advisory Lock Key Generator (Branch + Date deterministic 64-bit key)
CREATE OR REPLACE FUNCTION public.get_branch_date_lock_key(p_branch_id UUID, p_date DATE)
RETURNS BIGINT AS $$
  SELECT ('x' || substr(md5(p_branch_id::text || ':' || p_date::text), 1, 16))::bit(64)::bigint;
$$ LANGUAGE sql IMMUTABLE;

-- 7.2 Reservation Reference Generator (MLH-RSV-XXXXXX with retry)
CREATE OR REPLACE FUNCTION public.generate_reservation_reference()
RETURNS VARCHAR(20) AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT := '';
  v_i INT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_code := 'MLH-RSV-';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.reservations WHERE reference = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    IF v_attempts > 20 THEN
      RETURN 'MLH-RSV-' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 6));
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 7.3 Branch Opening Hours Parser & Checker
CREATE OR REPLACE FUNCTION public.is_branch_open_at(
  p_branch_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_hours JSONB;
  v_dow INT;
  v_time_str TEXT;
  v_range_str TEXT;
  v_open_time TEXT;
  v_close_time TEXT;
BEGIN
  SELECT opening_hours INTO v_hours FROM public.restaurant_branches WHERE id = p_branch_id;
  IF v_hours IS NULL THEN
    RETURN TRUE;
  END IF;

  v_dow := EXTRACT(DOW FROM (p_timestamp AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;
  v_time_str := to_char(p_timestamp AT TIME ZONE 'Africa/Dar_es_Salaam', 'HH24:MI');

  IF v_dow BETWEEN 1 AND 5 THEN
    v_range_str := v_hours->>'mon_fri';
  ELSE
    v_range_str := v_hours->>'sat_sun';
  END IF;

  IF v_range_str IS NULL OR v_range_str = '' OR v_range_str = 'closed' THEN
    RETURN FALSE;
  END IF;

  -- Expected format: "07:00-21:00"
  v_open_time := split_part(v_range_str, '-', 1);
  v_close_time := split_part(v_range_str, '-', 2);

  IF v_open_time = '' OR v_close_time = '' THEN
    RETURN TRUE;
  END IF;

  RETURN (v_time_str >= v_open_time AND v_time_str <= v_close_time);
END;
$$ LANGUAGE plpgsql STABLE;

-- Section 8: Core RPC - public.get_reservation_availability
CREATE OR REPLACE FUNCTION public.get_reservation_availability(
  p_restaurant_id VARCHAR(80),
  p_branch_id UUID,
  p_date DATE,
  p_party_size INTEGER
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  available_capacity INTEGER,
  is_available BOOLEAN,
  deposit_required BOOLEAN,
  deposit_amount_tzs INTEGER,
  confirmation_mode VARCHAR(20),
  availability_status VARCHAR(30)
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings public.reservation_settings%ROWTYPE;
  v_hours JSONB;
  v_dow INT;
  v_range_str TEXT;
  v_open_time TEXT;
  v_close_time TEXT;
  v_open_hour INT;
  v_open_min INT;
  v_close_hour INT;
  v_close_min INT;
  v_cur_slot_start TIMESTAMPTZ;
  v_cur_slot_end TIMESTAMPTZ;
  v_end_boundary TIMESTAMPTZ;
  v_step_interval INTERVAL;
  v_turn_interval INTERVAL;
  v_booked_capacity INT;
  v_remaining_capacity INT;
  v_slot_available BOOLEAN;
  v_status VARCHAR(30);
  v_dep_required BOOLEAN;
  v_dep_amount INT;
  v_has_blackout BOOLEAN;
  v_table_found BOOLEAN;
  v_earliest_allowed TIMESTAMPTZ;
  v_latest_allowed TIMESTAMPTZ;
BEGIN
  -- 1. Verify branch & restaurant consistency
  SELECT * INTO v_settings
  FROM public.reservation_settings
  WHERE branch_id = p_branch_id AND restaurant_id = p_restaurant_id;

  IF NOT FOUND OR NOT v_settings.reservations_enabled THEN
    RETURN;
  END IF;

  -- 2. Validate booking horizon and party size bounds
  v_earliest_allowed := clock_timestamp() + (v_settings.minimum_advance_minutes || ' minutes')::interval;
  v_latest_allowed := (CURRENT_DATE + v_settings.maximum_advance_days)::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam';

  IF p_date < CURRENT_DATE OR (p_date::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam') > v_latest_allowed THEN
    RETURN;
  END IF;

  IF p_party_size < v_settings.minimum_party_size OR p_party_size > v_settings.maximum_party_size THEN
    RETURN;
  END IF;

  -- 3. Determine branch open and close hours for requested day
  SELECT opening_hours INTO v_hours FROM public.restaurant_branches WHERE id = p_branch_id;
  v_dow := EXTRACT(DOW FROM (p_date::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam'))::integer;

  IF v_dow BETWEEN 1 AND 5 THEN
    v_range_str := COALESCE(v_hours->>'mon_fri', '07:00-21:00');
  ELSE
    v_range_str := COALESCE(v_hours->>'sat_sun', '08:00-22:00');
  END IF;

  IF v_range_str = 'closed' OR v_range_str IS NULL THEN
    RETURN;
  END IF;

  v_open_time := split_part(v_range_str, '-', 1);
  v_close_time := split_part(v_range_str, '-', 2);

  v_open_hour := split_part(v_open_time, ':', 1)::integer;
  v_open_min := split_part(v_open_time, ':', 2)::integer;
  v_close_hour := split_part(v_close_time, ':', 1)::integer;
  v_close_min := split_part(v_close_time, ':', 2)::integer;

  v_cur_slot_start := (p_date || ' ' || to_char(v_open_hour, 'FM00') || ':' || to_char(v_open_min, 'FM00') || ':00')::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam';
  v_end_boundary := (p_date || ' ' || to_char(v_close_hour, 'FM00') || ':' || to_char(v_close_min, 'FM00') || ':00')::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam';

  v_step_interval := (v_settings.slot_duration_minutes || ' minutes')::interval;
  v_turn_interval := (v_settings.turn_time_minutes || ' minutes')::interval;

  -- Derive deposit requirement
  IF v_settings.deposit_policy = 'FIXED' AND v_settings.deposit_fixed_tzs > 0 THEN
    v_dep_required := TRUE;
    v_dep_amount := v_settings.deposit_fixed_tzs;
  ELSE
    v_dep_required := FALSE;
    v_dep_amount := 0;
  END IF;

  -- 4. Iterate slots
  WHILE v_cur_slot_start < v_end_boundary LOOP
    v_cur_slot_end := v_cur_slot_start + v_turn_interval;

    -- Check advance notice limit
    IF v_cur_slot_start < v_earliest_allowed THEN
      v_cur_slot_start := v_cur_slot_start + v_step_interval;
      CONTINUE;
    END IF;

    -- Check blackout
    SELECT EXISTS (
      SELECT 1 FROM public.reservation_blackouts b
      WHERE (b.branch_id = p_branch_id OR (b.branch_id IS NULL AND b.restaurant_id = p_restaurant_id))
        AND b.starts_at < v_cur_slot_end
        AND b.ends_at > v_cur_slot_start
    ) INTO v_has_blackout;

    IF v_has_blackout THEN
      slot_start := v_cur_slot_start;
      slot_end := v_cur_slot_end;
      available_capacity := 0;
      is_available := FALSE;
      deposit_required := v_dep_required;
      deposit_amount_tzs := v_dep_amount;
      confirmation_mode := v_settings.confirmation_mode;
      availability_status := 'BLACKOUT';
      RETURN NEXT;
      v_cur_slot_start := v_cur_slot_start + v_step_interval;
      CONTINUE;
    END IF;

    IF v_settings.capacity_mode = 'CAPACITY_ONLY' THEN
      -- Authoritative single-counted capacity model
      SELECT COALESCE(SUM(party_size), 0) INTO v_booked_capacity
      FROM (
        -- Confirmed & Seated reservations consume capacity
        SELECT r.party_size
        FROM public.reservations r
        WHERE r.branch_id = p_branch_id
          AND r.status IN ('CONFIRMED', 'SEATED')
          AND r.scheduled_at < v_cur_slot_end
          AND r.slot_end_at > v_cur_slot_start
        UNION ALL
        -- Active unexpired holds consume capacity (single-counted for awaiting deposit)
        SELECT h.party_size
        FROM public.reservation_holds h
        WHERE h.branch_id = p_branch_id
          AND h.is_active = TRUE
          AND h.expires_at > clock_timestamp()
          AND h.slot_start < v_cur_slot_end
          AND h.slot_end > v_cur_slot_start
      ) sub;

      v_remaining_capacity := GREATEST(0, v_settings.default_slot_capacity - v_booked_capacity);
      v_slot_available := (v_remaining_capacity >= p_party_size);
      v_status := CASE WHEN v_slot_available THEN 'AVAILABLE' ELSE 'CAPACITY_FULL' END;

    ELSE
      -- TABLE_BASED capacity mode
      -- Look for at least one suitable active table not allocated or held
      SELECT EXISTS (
        SELECT 1 FROM public.restaurant_tables t
        WHERE t.branch_id = p_branch_id
          AND t.is_active = TRUE
          AND t.capacity >= p_party_size
          AND NOT EXISTS (
            SELECT 1 FROM public.reservation_table_allocations a
            WHERE a.table_id = t.id
              AND a.is_active = TRUE
              AND a.slot_interval && tstzrange(v_cur_slot_start, v_cur_slot_end, '[)')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.reservation_holds h
            WHERE h.table_id = t.id
              AND h.is_active = TRUE
              AND h.expires_at > clock_timestamp()
              AND h.slot_start < v_cur_slot_end
              AND h.slot_end > v_cur_slot_start
          )
      ) INTO v_table_found;

      v_remaining_capacity := CASE WHEN v_table_found THEN p_party_size ELSE 0 END;
      v_slot_available := v_table_found;
      v_status := CASE WHEN v_table_found THEN 'AVAILABLE' ELSE 'TABLE_UNAVAILABLE' END;
    END IF;

    slot_start := v_cur_slot_start;
    slot_end := v_cur_slot_end;
    available_capacity := v_remaining_capacity;
    is_available := v_slot_available;
    deposit_required := v_dep_required;
    deposit_amount_tzs := v_dep_amount;
    confirmation_mode := v_settings.confirmation_mode;
    availability_status := v_status;
    RETURN NEXT;

    v_cur_slot_start := v_cur_slot_start + v_step_interval;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Section 9: Core RPC - public.create_reservation_secure
CREATE OR REPLACE FUNCTION public.create_reservation_secure(
  p_restaurant_id VARCHAR(80),
  p_branch_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_party_size INTEGER,
  p_area_preference VARCHAR(30) DEFAULT 'ANY',
  p_special_requests TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_service_date DATE;
  v_lock_key BIGINT;
  v_settings public.reservation_settings%ROWTYPE;
  v_turn_interval INTERVAL;
  v_slot_end TIMESTAMPTZ;
  v_booked_capacity INT;
  v_remaining_capacity INT;
  v_reference VARCHAR(20);
  v_initial_status VARCHAR(30);
  v_deposit_amount INT := 0;
  v_deposit_due TIMESTAMPTZ := NULL;
  v_no_show_time TIMESTAMPTZ;
  v_table_id UUID := NULL;
  v_reservation_id VARCHAR(80);
  v_hold_id UUID := NULL;
  v_new_res RECORD;
BEGIN
  -- 1. Authenticate caller
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Must be logged in to create a reservation.';
  END IF;

  -- 2. Verify restaurant eligibility
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = p_restaurant_id AND is_open = TRUE AND is_verified = TRUE
  ) THEN
    RAISE EXCEPTION '400 Bad Request: Restaurant is currently unavailable for bookings.';
  END IF;

  -- 3. Verify branch belongs to restaurant
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_branches
    WHERE id = p_branch_id AND restaurant_id = p_restaurant_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION '400 Bad Request: Invalid or inactive branch specified.';
  END IF;

  -- 4. Load reservation settings
  SELECT * INTO v_settings
  FROM public.reservation_settings
  WHERE branch_id = p_branch_id AND restaurant_id = p_restaurant_id;

  IF NOT FOUND OR NOT v_settings.reservations_enabled THEN
    RAISE EXCEPTION '400 Bad Request: Reservations are disabled for this branch.';
  END IF;

  -- 5. Validate party size & advance horizon
  IF p_party_size < v_settings.minimum_party_size THEN
    RAISE EXCEPTION '400 Bad Request: Party size is below minimum (% persons).', v_settings.minimum_party_size;
  END IF;
  IF p_party_size > v_settings.maximum_party_size THEN
    RAISE EXCEPTION '400 Bad Request: Party size exceeds maximum (% persons).', v_settings.maximum_party_size;
  END IF;

  IF p_scheduled_at < (clock_timestamp() + (v_settings.minimum_advance_minutes || ' minutes')::interval) THEN
    RAISE EXCEPTION '400 Bad Request: Reservation time must be at least % minutes in advance.', v_settings.minimum_advance_minutes;
  END IF;

  v_service_date := (p_scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  IF (p_scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam') > ((CURRENT_DATE + v_settings.maximum_advance_days)::timestamp AT TIME ZONE 'Africa/Dar_es_Salaam') THEN
    RAISE EXCEPTION '400 Bad Request: Booking is beyond maximum advance window (% days).', v_settings.maximum_advance_days;
  END IF;

  -- 6. Check opening hours
  IF NOT public.is_branch_open_at(p_branch_id, p_scheduled_at) THEN
    RAISE EXCEPTION '400 Bad Request: Requested reservation time is outside operating hours.';
  END IF;

  v_turn_interval := (v_settings.turn_time_minutes || ' minutes')::interval;
  v_slot_end := p_scheduled_at + v_turn_interval;

  -- 7. Check blackouts
  IF EXISTS (
    SELECT 1 FROM public.reservation_blackouts b
    WHERE (b.branch_id = p_branch_id OR (b.branch_id IS NULL AND b.restaurant_id = p_restaurant_id))
      AND b.starts_at < v_slot_end
      AND b.ends_at > p_scheduled_at
  ) THEN
    RAISE EXCEPTION '400 Bad Request: Branch is closed during the requested time window (blackout).';
  END IF;

  -- 8. ACQUIRE DETERMINISTIC ADVISORY TRANSACTION LOCK (Branch + Service Date)
  -- Guarantees atomic recalculation and prevents race conditions across overlapping booking intervals
  v_lock_key := public.get_branch_date_lock_key(p_branch_id, v_service_date);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 9. Inside Lock: Recalculate overlapping capacity
  IF v_settings.capacity_mode = 'CAPACITY_ONLY' THEN
    SELECT COALESCE(SUM(party_size), 0) INTO v_booked_capacity
    FROM (
      SELECT r.party_size
      FROM public.reservations r
      WHERE r.branch_id = p_branch_id
        AND r.status IN ('CONFIRMED', 'SEATED')
        AND r.scheduled_at < v_slot_end
        AND r.slot_end_at > p_scheduled_at
      UNION ALL
      SELECT h.party_size
      FROM public.reservation_holds h
      WHERE h.branch_id = p_branch_id
        AND h.is_active = TRUE
        AND h.expires_at > clock_timestamp()
        AND h.slot_start < v_slot_end
        AND h.slot_end > p_scheduled_at
    ) sub;

    v_remaining_capacity := v_settings.default_slot_capacity - v_booked_capacity;
    IF v_remaining_capacity < p_party_size THEN
      RAISE EXCEPTION '409 Conflict: Insufficient capacity available for this party size. Only % seats remain.', GREATEST(0, v_remaining_capacity);
    END IF;

  ELSE
    -- TABLE_BASED capacity mode: pick and lock smallest suitable table
    SELECT t.id INTO v_table_id
    FROM public.restaurant_tables t
    WHERE t.branch_id = p_branch_id
      AND t.is_active = TRUE
      AND t.capacity >= p_party_size
      AND (p_area_preference = 'ANY' OR t.area = p_area_preference)
      AND NOT EXISTS (
        SELECT 1 FROM public.reservation_table_allocations a
        WHERE a.table_id = t.id
          AND a.is_active = TRUE
          AND a.slot_interval && tstzrange(p_scheduled_at, v_slot_end, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.reservation_holds h
        WHERE h.table_id = t.id
          AND h.is_active = TRUE
          AND h.expires_at > clock_timestamp()
          AND h.slot_start < v_slot_end
          AND h.slot_end > p_scheduled_at
      )
    ORDER BY t.capacity ASC
    LIMIT 1;

    -- Fallback to ANY area if preferred area table was not found
    IF v_table_id IS NULL AND p_area_preference <> 'ANY' THEN
      SELECT t.id INTO v_table_id
      FROM public.restaurant_tables t
      WHERE t.branch_id = p_branch_id
        AND t.is_active = TRUE
        AND t.capacity >= p_party_size
        AND NOT EXISTS (
          SELECT 1 FROM public.reservation_table_allocations a
          WHERE a.table_id = t.id
            AND a.is_active = TRUE
            AND a.slot_interval && tstzrange(p_scheduled_at, v_slot_end, '[)')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.reservation_holds h
          WHERE h.table_id = t.id
            AND h.is_active = TRUE
            AND h.expires_at > clock_timestamp()
            AND h.slot_start < v_slot_end
            AND h.slot_end > p_scheduled_at
        )
      ORDER BY t.capacity ASC
      LIMIT 1;
    END IF;

    IF v_table_id IS NULL THEN
      RAISE EXCEPTION '409 Conflict: No suitable table available for this party size in the requested window.';
    END IF;
  END IF;

  -- 10. Determine initial status and deposit requirements
  IF v_settings.deposit_policy = 'PERCENTAGE' THEN
    RAISE EXCEPTION '400 Bad Request: PERCENTAGE deposit policy is unsupported without an authoritative order base.';
  ELSIF v_settings.deposit_policy = 'FIXED' AND v_settings.deposit_fixed_tzs > 0 THEN
    v_deposit_amount := v_settings.deposit_fixed_tzs;
    v_deposit_due := clock_timestamp() + (v_settings.deposit_due_minutes || ' minutes')::interval;
  END IF;

  IF v_settings.confirmation_mode = 'MANUAL' THEN
    v_initial_status := 'PENDING_RESTAURANT_APPROVAL';
  ELSIF v_deposit_amount > 0 THEN
    v_initial_status := 'AWAITING_DEPOSIT';
  ELSE
    v_initial_status := 'CONFIRMED';
  END IF;

  v_reference := public.generate_reservation_reference();
  v_reservation_id := 'res_' || substr(md5(clock_timestamp()::text || random()::text), 1, 16);
  v_no_show_time := p_scheduled_at + (v_settings.grace_period_minutes || ' minutes')::interval;

  -- 11. Create Reservation Record
  INSERT INTO public.reservations (
    id,
    user_id,
    restaurant_id,
    branch_id,
    party_size,
    scheduled_at,
    slot_end_at,
    reference,
    table_id,
    confirmation_mode,
    deposit_policy,
    deposit_amount_tzs,
    deposit_due_at,
    no_show_eligible_at,
    status,
    special_requests,
    area_preference,
    is_deposit_paid
  ) VALUES (
    v_reservation_id,
    v_caller,
    p_restaurant_id,
    p_branch_id,
    p_party_size,
    p_scheduled_at,
    v_slot_end,
    v_reference,
    v_table_id,
    v_settings.confirmation_mode,
    v_settings.deposit_policy,
    v_deposit_amount,
    v_deposit_due,
    v_no_show_time,
    v_initial_status,
    p_special_requests,
    p_area_preference,
    FALSE
  ) RETURNING * INTO v_new_res;

  -- 12. Create temporary hold or table allocation
  IF v_initial_status = 'AWAITING_DEPOSIT' THEN
    INSERT INTO public.reservation_holds (
      reservation_id,
      restaurant_id,
      branch_id,
      party_size,
      slot_start,
      slot_end,
      table_id,
      expires_at,
      is_active
    ) VALUES (
      v_reservation_id,
      p_restaurant_id,
      p_branch_id,
      p_party_size,
      p_scheduled_at,
      v_slot_end,
      v_table_id,
      v_deposit_due,
      TRUE
    ) RETURNING id INTO v_hold_id;

  ELSIF v_initial_status = 'CONFIRMED' AND v_table_id IS NOT NULL THEN
    INSERT INTO public.reservation_table_allocations (
      reservation_id,
      table_id,
      branch_id,
      slot_interval,
      is_active
    ) VALUES (
      v_reservation_id,
      v_table_id,
      p_branch_id,
      tstzrange(p_scheduled_at, v_slot_end, '[)'),
      TRUE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'reference', v_reference,
    'status', v_initial_status,
    'deposit_required', (v_deposit_amount > 0),
    'deposit_amount_tzs', v_deposit_amount,
    'deposit_due_at', v_deposit_due,
    'scheduled_at', p_scheduled_at,
    'party_size', p_party_size,
    'branch_id', p_branch_id,
    'table_id', v_table_id
  );
END;
$$ LANGUAGE plpgsql;

-- Section 10: Restaurant Decision RPC - public.restaurant_decide_reservation
CREATE OR REPLACE FUNCTION public.restaurant_decide_reservation(
  p_reservation_id VARCHAR(80),
  p_decision VARCHAR(20),
  p_rejection_reason VARCHAR(60) DEFAULT NULL,
  p_table_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_res public.reservations%ROWTYPE;
  v_settings public.reservation_settings%ROWTYPE;
  v_lock_key BIGINT;
  v_service_date DATE;
  v_booked_capacity INT;
  v_remaining_capacity INT;
  v_next_status VARCHAR(30);
  v_deposit_amount INT := 0;
  v_deposit_due TIMESTAMPTZ := NULL;
  v_table_to_use UUID := p_table_id;
BEGIN
  -- 1. Validate caller identity
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Caller not authenticated.';
  END IF;

  -- 2. Load reservation
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Reservation does not exist.';
  END IF;

  -- 3. Validate operator permissions
  IF NOT public.has_restaurant_permission(v_caller, v_res.restaurant_id, 'MANAGE_RESERVATIONS')
     AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION '403 Forbidden: Operator lacks permission to manage reservations for this restaurant.';
  END IF;

  -- 4. Check valid initial state
  IF v_res.status <> 'PENDING_RESTAURANT_APPROVAL' THEN
    RAISE EXCEPTION '400 Bad Request: Reservation is in status "%" and cannot be decided.', v_res.status;
  END IF;

  -- 5. REJECT path
  IF upper(p_decision) = 'REJECT' THEN
    UPDATE public.reservations
    SET status = 'REJECTED',
        rejection_reason = COALESCE(p_rejection_reason, 'RESTAURANT_UNABLE_TO_ACCOMMODATE'),
        updated_at = clock_timestamp()
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED', 'reservation_id', p_reservation_id);
  END IF;

  IF upper(p_decision) <> 'ACCEPT' THEN
    RAISE EXCEPTION '400 Bad Request: Invalid decision. Must be ACCEPT or REJECT.';
  END IF;

  -- 6. ACCEPT path: Lock capacity and recheck availability
  v_service_date := (v_res.scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  v_lock_key := public.get_branch_date_lock_key(v_res.branch_id, v_service_date);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT * INTO v_settings FROM public.reservation_settings WHERE branch_id = v_res.branch_id;

  IF v_settings.capacity_mode = 'CAPACITY_ONLY' THEN
    SELECT COALESCE(SUM(party_size), 0) INTO v_booked_capacity
    FROM (
      SELECT r.party_size
      FROM public.reservations r
      WHERE r.branch_id = v_res.branch_id
        AND r.status IN ('CONFIRMED', 'SEATED')
        AND r.scheduled_at < v_res.slot_end_at
        AND r.slot_end_at > v_res.scheduled_at
      UNION ALL
      SELECT h.party_size
      FROM public.reservation_holds h
      WHERE h.branch_id = v_res.branch_id
        AND h.is_active = TRUE
        AND h.expires_at > clock_timestamp()
        AND h.slot_start < v_res.slot_end_at
        AND h.slot_end > v_res.scheduled_at
    ) sub;

    v_remaining_capacity := v_settings.default_slot_capacity - v_booked_capacity;
    IF v_remaining_capacity < v_res.party_size THEN
      RAISE EXCEPTION '409 Conflict: CAPACITY_NO_LONGER_AVAILABLE. Only % seats remain.', GREATEST(0, v_remaining_capacity);
    END IF;

  ELSE
    -- Table mode: verify or pick table
    IF v_table_to_use IS NULL THEN
      SELECT t.id INTO v_table_to_use
      FROM public.restaurant_tables t
      WHERE t.branch_id = v_res.branch_id
        AND t.is_active = TRUE
        AND t.capacity >= v_res.party_size
        AND NOT EXISTS (
          SELECT 1 FROM public.reservation_table_allocations a
          WHERE a.table_id = t.id
            AND a.is_active = TRUE
            AND a.slot_interval && tstzrange(v_res.scheduled_at, v_res.slot_end_at, '[)')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.reservation_holds h
          WHERE h.table_id = t.id
            AND h.is_active = TRUE
            AND h.expires_at > clock_timestamp()
            AND h.slot_start < v_res.slot_end_at
            AND h.slot_end > v_res.scheduled_at
        )
      ORDER BY t.capacity ASC
      LIMIT 1;
    END IF;

    IF v_table_to_use IS NULL THEN
      RAISE EXCEPTION '409 Conflict: TABLE_NO_LONGER_AVAILABLE.';
    END IF;
  END IF;

  -- Determine next status based on deposit policy
  IF v_res.deposit_amount_tzs > 0 AND NOT v_res.is_deposit_paid THEN
    v_next_status := 'AWAITING_DEPOSIT';
    v_deposit_due := clock_timestamp() + (v_settings.deposit_due_minutes || ' minutes')::interval;

    INSERT INTO public.reservation_holds (
      reservation_id,
      restaurant_id,
      branch_id,
      party_size,
      slot_start,
      slot_end,
      table_id,
      expires_at,
      is_active
    ) VALUES (
      p_reservation_id,
      v_res.restaurant_id,
      v_res.branch_id,
      v_res.party_size,
      v_res.scheduled_at,
      v_res.slot_end_at,
      v_table_to_use,
      v_deposit_due,
      TRUE
    );

  ELSE
    v_next_status := 'CONFIRMED';
    IF v_table_to_use IS NOT NULL THEN
      INSERT INTO public.reservation_table_allocations (
        reservation_id,
        table_id,
        branch_id,
        slot_interval,
        is_active
      ) VALUES (
        p_reservation_id,
        v_table_to_use,
        v_res.branch_id,
        tstzrange(v_res.scheduled_at, v_res.slot_end_at, '[)'),
        TRUE
      );
    END IF;
  END IF;

  UPDATE public.reservations
  SET status = v_next_status,
      table_id = v_table_to_use,
      deposit_due_at = v_deposit_due,
      updated_at = clock_timestamp()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_next_status,
    'reservation_id', p_reservation_id,
    'table_id', v_table_to_use,
    'deposit_due_at', v_deposit_due
  );
END;
$$ LANGUAGE plpgsql;

-- Section 11: Attendance & Lifecycle Transition RPC - public.transition_reservation_attendance
CREATE OR REPLACE FUNCTION public.transition_reservation_attendance(
  p_reservation_id VARCHAR(80),
  p_next_status VARCHAR(30)
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_res public.reservations%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Caller not authenticated.';
  END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Reservation does not exist.';
  END IF;

  IF NOT public.has_restaurant_permission(v_caller, v_res.restaurant_id, 'MANAGE_RESERVATIONS')
     AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION '403 Forbidden: Operator lacks permission to manage reservations for this restaurant.';
  END IF;

  IF p_next_status = 'SEATED' THEN
    IF v_res.status <> 'CONFIRMED' THEN
      RAISE EXCEPTION '400 Bad Request: Only CONFIRMED reservations can be marked SEATED (current status: %).', v_res.status;
    END IF;

  ELSIF p_next_status = 'COMPLETED' THEN
    IF v_res.status <> 'SEATED' THEN
      RAISE EXCEPTION '400 Bad Request: Only SEATED reservations can be marked COMPLETED (current status: %).', v_res.status;
    END IF;
    -- Deactivate table allocation upon completion
    UPDATE public.reservation_table_allocations
    SET is_active = FALSE
    WHERE reservation_id = p_reservation_id;

  ELSIF p_next_status = 'NO_SHOW' THEN
    IF v_res.status <> 'CONFIRMED' THEN
      RAISE EXCEPTION '400 Bad Request: Only CONFIRMED reservations can be marked NO_SHOW (current status: %).', v_res.status;
    END IF;
    -- Check grace period using PostgreSQL NOW()
    IF clock_timestamp() < v_res.no_show_eligible_at THEN
      RAISE EXCEPTION '400 Bad Request: Cannot mark NO_SHOW before grace period expires at %.', v_res.no_show_eligible_at;
    END IF;
    -- Deactivate table allocation
    UPDATE public.reservation_table_allocations
    SET is_active = FALSE
    WHERE reservation_id = p_reservation_id;

  ELSE
    RAISE EXCEPTION '400 Bad Request: Invalid attendance transition to "%".', p_next_status;
  END IF;

  UPDATE public.reservations
  SET status = p_next_status,
      updated_at = clock_timestamp()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object('success', true, 'status', p_next_status, 'reservation_id', p_reservation_id);
END;
$$ LANGUAGE plpgsql;

-- Section 12: Cancellation RPC - public.cancel_reservation_secure
CREATE OR REPLACE FUNCTION public.cancel_reservation_secure(
  p_reservation_id VARCHAR(80),
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_res public.reservations%ROWTYPE;
  v_is_customer BOOLEAN;
  v_is_operator BOOLEAN;
  v_refund_eligibility VARCHAR(30) := 'NONE';
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION '401 Unauthorized: Must be authenticated to cancel a reservation.';
  END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Reservation does not exist.';
  END IF;

  v_is_customer := (v_res.user_id = v_caller);
  v_is_operator := (public.has_restaurant_permission(v_caller, v_res.restaurant_id, 'MANAGE_RESERVATIONS') OR public.is_admin(v_caller));

  IF NOT v_is_customer AND NOT v_is_operator THEN
    RAISE EXCEPTION '403 Forbidden: Caller is neither reservation owner nor authorized restaurant operator.';
  END IF;

  IF v_res.status IN ('COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED') THEN
    RAISE EXCEPTION '400 Bad Request: Reservation is already in terminal state "%".', v_res.status;
  END IF;

  -- Classify refund eligibility without fabricating refund completion
  IF v_res.is_deposit_paid AND v_res.deposit_amount_tzs > 0 THEN
    v_refund_eligibility := 'MANUAL_REVIEW';
  END IF;

  -- Deactivate holds and table allocations
  UPDATE public.reservation_holds
  SET is_active = FALSE
  WHERE reservation_id = p_reservation_id;

  UPDATE public.reservation_table_allocations
  SET is_active = FALSE
  WHERE reservation_id = p_reservation_id;

  UPDATE public.reservations
  SET status = 'CANCELLED',
      cancelled_at = clock_timestamp(),
      cancelled_by = v_caller,
      cancellation_reason = COALESCE(p_cancellation_reason, 'Cancelled by user/operator'),
      refund_eligibility = v_refund_eligibility,
      updated_at = clock_timestamp()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'CANCELLED',
    'reservation_id', p_reservation_id,
    'refund_eligibility', v_refund_eligibility
  );
END;
$$ LANGUAGE plpgsql;

-- Section 13: Extend public.process_payment_webhook_secure
-- Preserves standard orders and custom meals while enforcing capacity locks and hold validation for reservations
CREATE OR REPLACE FUNCTION public.process_payment_webhook_secure(
  p_provider_reference TEXT,
  p_gateway_reference TEXT,
  p_merchant_reference TEXT,
  p_amount_tzs INTEGER,
  p_status TEXT,
  p_raw_payload JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_res RECORD;
  v_settings RECORD;
  v_hold RECORD;
  v_service_date DATE;
  v_lock_key BIGINT;
  v_hold_expired BOOLEAN;
BEGIN
  -- 1. Locate payment record
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider_reference = p_provider_reference
     OR idempotency_key = p_merchant_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '404 Not Found: Payment record not found for reference %', p_provider_reference;
  END IF;

  -- 2. Idempotency check
  IF v_payment.status = 'SUCCESS' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment already processed and finalized (idempotent)',
      'payment_id', v_payment.id,
      'status', 'SUCCESS'
    );
  END IF;

  -- 3. Verify amount
  IF v_payment.amount_tzs <> p_amount_tzs THEN
    RAISE EXCEPTION '400 Bad Request: Webhook amount % does not match recorded payment amount %',
      p_amount_tzs, v_payment.amount_tzs;
  END IF;

  -- 4. Mark payment success
  UPDATE public.payments
  SET status = 'SUCCESS',
      paid_at = clock_timestamp(),
      webhook_verified = TRUE,
      provider_transaction_id = COALESCE(p_gateway_reference, provider_transaction_id),
      gateway_response = p_raw_payload,
      updated_at = clock_timestamp()
  WHERE id = v_payment.id;

  -- 5. Handle Standard Order fulfillment
  IF v_payment.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET payment_status = 'SUCCESS',
        updated_at = clock_timestamp()
    WHERE id = v_payment.order_id;
  END IF;

  -- 6. Handle Reservation Deposit fulfillment
  IF v_payment.reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.reservations WHERE id = v_payment.reservation_id FOR UPDATE;

    IF FOUND THEN
      v_service_date := (v_res.scheduled_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
      v_lock_key := public.get_branch_date_lock_key(v_res.branch_id, v_service_date);
      PERFORM pg_advisory_xact_lock(v_lock_key);

      -- Check hold validity
      SELECT * INTO v_hold
      FROM public.reservation_holds
      WHERE reservation_id = v_res.id AND is_active = TRUE
      LIMIT 1;

      v_hold_expired := (v_hold.id IS NULL OR v_hold.expires_at < clock_timestamp());

      IF v_hold_expired OR v_res.status <> 'AWAITING_DEPOSIT' THEN
        -- Money was received late after hold expired. Never overbook.
        UPDATE public.reservations
        SET status = 'PAYMENT_REVIEW_REQUIRED',
            is_deposit_paid = TRUE,
            payment_id = v_payment.id,
            deposit_amount_tzs = v_payment.amount_tzs,
            refund_eligibility = 'MANUAL_REVIEW',
            updated_at = clock_timestamp()
        WHERE id = v_res.id;

      ELSE
        -- Valid hold exists: confirm reservation and allocate table
        UPDATE public.reservations
        SET status = 'CONFIRMED',
            is_deposit_paid = TRUE,
            payment_id = v_payment.id,
            deposit_amount_tzs = v_payment.amount_tzs,
            updated_at = clock_timestamp()
        WHERE id = v_res.id;

        -- Deactivate hold
        UPDATE public.reservation_holds
        SET is_active = FALSE
        WHERE id = v_hold.id;

        -- If table based, allocate table
        IF v_res.table_id IS NOT NULL THEN
          INSERT INTO public.reservation_table_allocations (
            reservation_id,
            table_id,
            branch_id,
            slot_interval,
            is_active
          ) VALUES (
            v_res.id,
            v_res.table_id,
            v_res.branch_id,
            tstzrange(v_res.scheduled_at, v_res.slot_end_at, '[)'),
            TRUE
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'reservation_id', v_payment.reservation_id,
    'amount', v_payment.amount_tzs,
    'status', 'SUCCESS'
  );
END;
$$ LANGUAGE plpgsql;

-- Section 14: Row Level Security (RLS)
ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_table_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_blackouts ENABLE ROW LEVEL SECURITY;

-- 14.1 reservation_settings RLS
DROP POLICY IF EXISTS "Settings viewable by authorized members and admins" ON public.reservation_settings;
CREATE POLICY "Settings viewable by authorized members and admins" ON public.reservation_settings
  FOR SELECT USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Settings manageable by managers and owners" ON public.reservation_settings;
CREATE POLICY "Settings manageable by managers and owners" ON public.reservation_settings
  FOR ALL USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

-- 14.2 restaurant_tables RLS
DROP POLICY IF EXISTS "Tables viewable by restaurant members" ON public.restaurant_tables;
CREATE POLICY "Tables viewable by restaurant members" ON public.restaurant_tables
  FOR SELECT USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tables manageable by managers and owners" ON public.restaurant_tables;
CREATE POLICY "Tables manageable by managers and owners" ON public.restaurant_tables
  FOR ALL USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

-- 14.3 reservation_table_allocations RLS (Internal operational)
DROP POLICY IF EXISTS "Allocations viewable by restaurant members" ON public.reservation_table_allocations;
CREATE POLICY "Allocations viewable by restaurant members" ON public.reservation_table_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_branches b
      WHERE b.id = branch_id
        AND (public.has_restaurant_permission(auth.uid(), b.restaurant_id, 'VIEW_RESERVATIONS')
             OR public.is_admin(auth.uid()))
    )
  );

-- 14.4 reservation_holds RLS (Server-internal operational)
DROP POLICY IF EXISTS "Holds viewable by reservation owner or restaurant" ON public.reservation_holds;
CREATE POLICY "Holds viewable by reservation owner or restaurant" ON public.reservation_holds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.user_id = auth.uid()
    )
    OR public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

-- 14.5 reservation_blackouts RLS (Internal operational)
DROP POLICY IF EXISTS "Blackouts viewable by restaurant members" ON public.reservation_blackouts;
CREATE POLICY "Blackouts viewable by restaurant members" ON public.reservation_blackouts
  FOR SELECT USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'VIEW_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Blackouts manageable by managers and owners" ON public.reservation_blackouts;
CREATE POLICY "Blackouts manageable by managers and owners" ON public.reservation_blackouts
  FOR ALL USING (
    public.has_restaurant_permission(auth.uid(), restaurant_id, 'MANAGE_RESERVATIONS')
    OR public.is_admin(auth.uid())
  );

-- 14.6 public.reservations INSERT policy fix
-- Allow authenticated customers to create reservations through secure RPC or self-owned records
DROP POLICY IF EXISTS "Customers can insert own reservations" ON public.reservations;
CREATE POLICY "Customers can insert own reservations" ON public.reservations
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );
