-- MloHub forward migration: invitation notification routing and templates.
-- This intentionally lives after the historical notification migration so an
-- already-applied 00005 is not edited in place.

CREATE OR REPLACE FUNCTION public.resolve_event_recipients(
    p_event_type notification_event_type_enum,
    p_aggregate_type VARCHAR(50),
    p_aggregate_id VARCHAR(80),
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    recipient_user_id UUID,
    role_context VARCHAR(50),
    preferred_locale VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_aggregate_type = 'RESTAURANT' AND p_event_type::TEXT = 'STAFF_INVITATION' THEN
        IF p_payload ? 'invited_user_id' AND NULLIF(p_payload->>'invited_user_id', '') IS NOT NULL THEN
            RETURN QUERY
            SELECT (p_payload->>'invited_user_id')::UUID, 'INVITED_USER'::VARCHAR(50), 'sw'::VARCHAR(10);
        END IF;
    ELSIF p_aggregate_type = 'ORDER' THEN
        RETURN QUERY
        SELECT o.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o WHERE o.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.orders o
        JOIN public.restaurant_members rm ON rm.restaurant_id = o.restaurant_id
        WHERE o.id = p_aggregate_id AND rm.is_active = TRUE
          AND ('ALL' = ANY(rm.permissions) OR 'ORDERS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
    ELSIF p_aggregate_type = 'RESERVATION' THEN
        RETURN QUERY
        SELECT r.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r WHERE r.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reservations r
        JOIN public.restaurant_members rm ON rm.restaurant_id = r.restaurant_id
        WHERE r.id = p_aggregate_id AND rm.is_active = TRUE
          AND ('ALL' = ANY(rm.permissions) OR 'RESERVATIONS' = ANY(rm.permissions) OR rm.role IN ('OWNER', 'MANAGER'));
    ELSIF p_aggregate_type = 'CUSTOM_MEAL' THEN
        RETURN QUERY
        SELECT cmr.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.custom_meal_requests cmr WHERE cmr.id = p_aggregate_id;

        IF p_payload ? 'target_restaurant_id' THEN
            RETURN QUERY
            SELECT rm.user_id, 'RESTAURANT_STAFF'::VARCHAR(50), 'sw'::VARCHAR(10)
            FROM public.restaurant_members rm
            WHERE rm.restaurant_id = (p_payload->>'target_restaurant_id') AND rm.is_active = TRUE;
        END IF;
    ELSIF p_aggregate_type IN ('PAYMENT', 'REFUND') THEN
        RETURN QUERY
        SELECT p.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.payments p WHERE p.id = p_aggregate_id;
    ELSIF p_aggregate_type = 'REVIEW' THEN
        RETURN QUERY
        SELECT rev.user_id, 'CUSTOMER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev WHERE rev.id = p_aggregate_id;

        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_OWNER'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.reviews rev
        JOIN public.restaurant_members rm ON rm.restaurant_id = rev.restaurant_id
        WHERE rev.id = p_aggregate_id AND rm.is_active = TRUE AND rm.role IN ('OWNER', 'MANAGER');
    ELSIF p_aggregate_type IN ('SETTLEMENT', 'PAYOUT') AND p_payload ? 'restaurant_id' THEN
        RETURN QUERY
        SELECT rm.user_id, 'RESTAURANT_FINANCE'::VARCHAR(50), 'sw'::VARCHAR(10)
        FROM public.restaurant_members rm
        WHERE rm.restaurant_id = (p_payload->>'restaurant_id') AND rm.is_active = TRUE
          AND (rm.role = 'OWNER' OR ('FINANCE' = ANY(rm.permissions) AND rm.role = 'MANAGER'));
    ELSIF p_aggregate_type = 'ACCOUNT' AND p_payload ? 'user_id' THEN
        RETURN QUERY
        SELECT (p_payload->>'user_id')::UUID, 'ACCOUNT_HOLDER'::VARCHAR(50), 'sw'::VARCHAR(10);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_event_recipients(notification_event_type_enum, VARCHAR, VARCHAR, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_event_recipients(notification_event_type_enum, VARCHAR, VARCHAR, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.claim_outbox_events_secure(VARCHAR, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events_secure(VARCHAR, INTEGER, INTEGER) TO service_role;

INSERT INTO public.notification_templates (event_type, channel, locale, title_template, body_template, allowlisted_keys)
VALUES
('STAFF_INVITATION', 'IN_APP', 'sw', 'Mwaliko wa Timu ya Mgahawa', 'Umealikwa kujiunga na timu ya {{restaurant_name}} kama {{role}}.', ARRAY['restaurant_name', 'role']),
('STAFF_INVITATION', 'IN_APP', 'en', 'Restaurant Team Invitation', 'You have been invited to join {{restaurant_name}} as {{role}}.', ARRAY['restaurant_name', 'role']),
('STAFF_INVITATION', 'SMS', 'en', 'MloHub invitation', 'Join {{restaurant_name}} as {{role}} using the secure invitation link.', ARRAY['restaurant_name', 'role'])
ON CONFLICT (event_type, channel, locale) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    allowlisted_keys = EXCLUDED.allowlisted_keys,
    is_active = TRUE,
    version = public.notification_templates.version + 1;