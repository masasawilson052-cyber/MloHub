-- ============================================================================
-- STAGE 10: SUPABASE REALTIME PIPELINE & ORDER STATUS AUDIT LEDGER
-- ============================================================================

-- ============================================================================
-- 1. ORDER STATUS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(80) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
    ON public.order_status_history(order_id, created_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 2. RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Customers can view their own order status history"
ON public.order_status_history;

CREATE POLICY "Customers can view their own order status history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = order_status_history.order_id
          AND o.user_id = auth.uid()
    )
);


DROP POLICY IF EXISTS "Restaurant staff can view status history for their orders"
ON public.order_status_history;

CREATE POLICY "Restaurant staff can view status history for their orders"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.restaurant_members m
          ON m.restaurant_id = o.restaurant_id
        WHERE o.id = order_status_history.order_id
          AND m.user_id = auth.uid()
          AND m.is_active = TRUE
    )
);


DROP POLICY IF EXISTS "Admins can view all order status history"
ON public.order_status_history;

CREATE POLICY "Admins can view all order status history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
              p.role IN (
                  'ADMIN'::user_role_enum,
                  'SUPER_ADMIN'::user_role_enum
              )
              OR 'ADMIN'::user_role_enum = ANY(p.roles)
              OR 'SUPER_ADMIN'::user_role_enum = ANY(p.roles)
          )
    )
);


-- ============================================================================
-- 3. AUTOMATIC ORDER STATUS AUDIT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_role TEXT := NULL;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        SELECT p.role::TEXT
        INTO v_actor_role
        FROM public.profiles p
        WHERE p.id = auth.uid();
    END IF;

    IF TG_OP = 'INSERT' THEN

        INSERT INTO public.order_status_history (
            order_id,
            previous_status,
            new_status,
            actor_user_id,
            actor_role,
            metadata
        )
        VALUES (
            NEW.id,
            NULL,
            NEW.status::TEXT,
            auth.uid(),
            v_actor_role,
            jsonb_build_object(
                'trigger', 'ORDER_CREATED',
                'payment_status', NEW.payment_status
            )
        );

    ELSIF TG_OP = 'UPDATE'
       AND (
           OLD.status IS DISTINCT FROM NEW.status
           OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
       )
    THEN

        INSERT INTO public.order_status_history (
            order_id,
            previous_status,
            new_status,
            actor_user_id,
            actor_role,
            metadata
        )
        VALUES (
            NEW.id,
            OLD.status::TEXT,
            NEW.status::TEXT,
            auth.uid(),
            v_actor_role,
            jsonb_build_object(
                'trigger', 'STATUS_UPDATED',
                'old_payment_status', OLD.payment_status,
                'new_payment_status', NEW.payment_status
            )
        );

    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_order_status_history
ON public.orders;

CREATE TRIGGER trg_order_status_history
AFTER INSERT OR UPDATE
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_status_transition();


-- ============================================================================
-- 4. REPLICA IDENTITY FULL
-- ============================================================================

DO $$
DECLARE
    t TEXT;
    target_tables TEXT[] := ARRAY[
        'orders',
        'order_items',
        'menu_items',
        'branch_menu_items',
        'restaurants',
        'reservations',
        'custom_meal_requests',
        'restaurant_quotes',
        'order_status_history'
    ];
BEGIN
    FOREACH t IN ARRAY target_tables LOOP

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = t
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I REPLICA IDENTITY FULL',
                t
            );
        END IF;

    END LOOP;
END
$$;


-- ============================================================================
-- 5. SUPABASE REALTIME PUBLICATION
-- ============================================================================

DO $$
DECLARE
    t TEXT;

    target_tables TEXT[] := ARRAY[
        'orders',
        'order_items',
        'order_status_history',
        'payments',
        'payment_events',
        'notifications',
        'menu_items',
        'branch_menu_items',
        'menu_verifications',
        'reservations',
        'custom_meal_requests',
        'restaurant_quotes',
        'restaurants',
        'restaurant_branches',
        'data_reports'
    ];

BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY target_tables LOOP

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = t
        )
        AND NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        )
        THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                t
            );
        END IF;

    END LOOP;

END
$$;
