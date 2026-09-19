-- ============================================================================
-- MLOHUB PACK 2 MINIMAL VERIFICATION SEED
-- Purpose: verify migrations, FK integrity, auth/profile bootstrap, and RLS
-- Rich/demo fixtures are kept separately in seed.full_legacy.pack2bak
-- ============================================================================

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES
(
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'pack2.customer@mlohub.local',
    '',
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Pack2 Customer","phone":"+255700000001","account_type":"CUSTOMER"}'::jsonb,
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'pack2.owner@mlohub.local',
    '',
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Pack2 Owner","phone":"+255700000002","account_type":"RESTAURANT_OWNER"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;



