-- Compatibility and private server-only financial entry points.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT public.is_admin(auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.has_restaurant_role(p_user_id UUID,p_restaurant_id VARCHAR(80),p_allowed_roles VARCHAR[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT p_user_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.restaurant_members WHERE user_id=p_user_id AND restaurant_id=p_restaurant_id AND is_active AND status='ACTIVE' AND role::text=ANY(p_allowed_roles::text[])); $$;
REVOKE ALL ON FUNCTION public.process_payment_webhook_secure(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook_secure(TEXT,TEXT,TEXT,INTEGER,TEXT,JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.close_and_verify_posting_batch(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_and_verify_posting_batch(UUID) TO service_role;

-- SECURITY DEFINER current_user is the function owner, not the JWT role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- If caller is not Admin, strictly block changing privileged columns
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin(auth.uid()) THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your platform role.';
        END IF;
        IF NEW.roles IS DISTINCT FROM OLD.roles THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your role list.';
        END IF;
        IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your account type.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION '403 Forbidden: You cannot modify your account status.';
        END IF;
        IF NEW.is_phone_verified IS DISTINCT FROM OLD.is_phone_verified THEN
            RAISE EXCEPTION '403 Forbidden: Phone verification status must be updated via server.';
        END IF;
        IF NEW.is_email_verified IS DISTINCT FROM OLD.is_email_verified THEN
            RAISE EXCEPTION '403 Forbidden: Email verification status must be updated via server.';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
CREATE OR REPLACE FUNCTION public.protect_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only service role / admin can update payment status to SUCCESS or REFUNDED
    IF NOT public.is_admin(auth.uid()) AND COALESCE(auth.role(), '') <> 'service_role' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION '403 Forbidden: Payment statuses can only be finalized by the payment gateway webhook.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
