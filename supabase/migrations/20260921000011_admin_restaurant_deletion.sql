-- =============================================================================
-- MloHub Forward Migration: 20260921000011_admin_restaurant_deletion.sql
-- Authoritative administrative deletion of restaurants and child cleanup
-- =============================================================================

-- 1. Explicit DELETE policy on public.restaurants for administrators
DROP POLICY IF EXISTS "Admins can delete restaurants" ON public.restaurants;
CREATE POLICY "Admins can delete restaurants" ON public.restaurants
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- 2. Atomic security definer RPC for administrative deletion
CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id VARCHAR(80))
RETURNS JSONB AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Check admin privileges
    IF v_actor IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = v_actor AND role IN ('ADMIN', 'SUPER_ADMIN')
        ) INTO v_is_admin;
    END IF;

    IF NOT v_is_admin AND NOT public.is_admin() THEN
        RAISE EXCEPTION '403 Forbidden: Administrator credentials required.';
    END IF;

    -- Clean up non-cascading child references if tables exist
    BEGIN
        DELETE FROM public.tax_withholding_records WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.platform_commission_records WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.merchant_payouts WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.merchant_settlement_batches WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.financial_disputes WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.refund_requests WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.merchant_ledger_balances WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        DELETE FROM public.merchant_payout_destinations WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    BEGIN
        UPDATE public.restaurant_applications SET restaurant_id = NULL WHERE restaurant_id = p_restaurant_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete the restaurant record (cascades to branches, menus, reviews, memberships)
    DELETE FROM public.restaurants WHERE id = p_restaurant_id;

    -- Audit log
    IF v_actor IS NOT NULL THEN
        BEGIN
            INSERT INTO public.audit_logs (admin_user_id, action, target_type, target_id, details)
            VALUES (v_actor, 'DELETE_RESTAURANT', 'RESTAURANT', p_restaurant_id, jsonb_build_object('action', 'deleted'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'restaurant_id', p_restaurant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(VARCHAR) TO authenticated, service_role;
