# MloHub Super Admin Bootstrap & Access Protocol

## 1. Security Guarantee: Zero Hardcoded Credentials
MloHub enforces strict security by design. There are no hardcoded master passwords, hidden bypass tokens, or secret developer backdoors in the frontend bundle or client repositories.

---

## 2. Bootstrapping the Initial Super Admin

In a freshly deployed Supabase environment, the primary platform operator is promoted using direct SQL execution within the secure Supabase Dashboard SQL Editor or via an administrative deployment script executed with the database service-role key:

```sql
-- Step 1: Ensure user account is registered via normal Supabase Auth
-- Step 2: Elevate to SUPER_ADMIN role with platform privileges
UPDATE public.profiles
SET 
    role = 'SUPER_ADMIN',
    roles = ARRAY['CUSTOMER', 'ADMIN', 'SUPER_ADMIN']::public.platform_role[],
    updated_at = NOW()
WHERE email = 'admin@mlohub.co.tz';

-- Step 3: Insert initial audit record
INSERT INTO public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
)
SELECT 
    id,
    'SUPER_ADMIN_BOOTSTRAP',
    'PROFILE',
    id::text,
    jsonb_build_object('bootstrapped_at', NOW(), 'email', email)
FROM public.profiles
WHERE email = 'admin@mlohub.co.tz';
```

---

## 3. Delegation & Sub-Admin Provisioning
Once the initial `SUPER_ADMIN` has authenticated:
1. They access the **Platform Operations Portal** -> **Admin Users** tab.
2. They can invite secondary platform operators with either `ADMIN` or `SUPER_ADMIN` permissions.
3. Every role elevation or demotion triggers an immutable `GRANT_ADMIN` / `REVOKE_ADMIN` audit event.
4. Token checks (`AuthGuards.requireRole`) verify the user's live database roles on every protected RPC or state query. Demoted admins are immediately stripped of access without waiting for token expiration.
