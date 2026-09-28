-- ============================================================================
-- MLOHUB PRODUCTION SECURITY CLOSURE: ATOMIC DATABASE RATE LIMITING
-- Migration: 20260927000300_atomic_rate_limits.sql
-- ============================================================================

-- Function: public.consume_rate_limit
-- Atomically checks and records a rate limit hit using transactional advisory locking
-- to eliminate race conditions under concurrent requests.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_rate_key TEXT,
    p_action VARCHAR(50),
    p_max_hits INTEGER,
    p_window_seconds INTEGER,
    p_ip_address TEXT DEFAULT NULL,
    p_identifier TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_row public.api_rate_limits%ROWTYPE;
    v_new_window_end TIMESTAMPTZ;
    v_remaining INTEGER;
    v_retry_after INTEGER := 0;
BEGIN
    -- Transactional advisory lock scoped to the rate key hash to serialize concurrent callers on the same key
    PERFORM pg_advisory_xact_lock(hashtext(p_rate_key));

    -- Find the most recent window for this rate key
    SELECT * INTO v_row
    FROM public.api_rate_limits
    WHERE rate_key = p_rate_key
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- If an active window exists and has not yet expired
    IF FOUND AND v_row.window_end > v_now THEN
        IF v_row.hits >= p_max_hits THEN
            v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_row.window_end - v_now))::INTEGER);
            RETURN jsonb_build_object(
                'allowed', FALSE,
                'remaining', 0,
                'current_hits', v_row.hits,
                'max_hits', p_max_hits,
                'reset_at', v_row.window_end,
                'retry_after_seconds', v_retry_after
            );
        ELSE
            UPDATE public.api_rate_limits
            SET hits = hits + 1,
                ip_address = COALESCE(p_ip_address, ip_address),
                identifier = COALESCE(p_identifier, identifier)
            WHERE id = v_row.id;

            v_remaining := GREATEST(0, p_max_hits - (v_row.hits + 1));
            RETURN jsonb_build_object(
                'allowed', TRUE,
                'remaining', v_remaining,
                'current_hits', v_row.hits + 1,
                'max_hits', p_max_hits,
                'reset_at', v_row.window_end,
                'retry_after_seconds', 0
            );
        END IF;
    ELSE
        -- Window expired or no record yet: create or reset window
        v_new_window_end := v_now + (p_window_seconds || ' seconds')::INTERVAL;

        IF FOUND THEN
            -- Reset the existing row for this key to prevent unbounded table growth
            UPDATE public.api_rate_limits
            SET hits = 1,
                action = p_action,
                ip_address = p_ip_address,
                identifier = p_identifier,
                window_start = v_now,
                window_end = v_new_window_end,
                created_at = v_now
            WHERE id = v_row.id;
        ELSE
            INSERT INTO public.api_rate_limits (
                rate_key,
                action,
                ip_address,
                identifier,
                hits,
                window_start,
                window_end,
                created_at
            ) VALUES (
                p_rate_key,
                p_action,
                p_ip_address,
                p_identifier,
                1,
                v_now,
                v_new_window_end,
                v_now
            );
        END IF;

        v_remaining := GREATEST(0, p_max_hits - 1);
        RETURN jsonb_build_object(
            'allowed', TRUE,
            'remaining', v_remaining,
            'current_hits', 1,
            'max_hits', p_max_hits,
            'reset_at', v_new_window_end,
            'retry_after_seconds', 0
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, VARCHAR, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, VARCHAR, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
