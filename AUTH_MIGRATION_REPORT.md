# MloHub Authentication Migration Report (Stage 1)

## 1. Overview
This report documents the architectural audit of MloHub's prototype client-side authentication system, detailing legacy authentication components, their responsibilities, deprecation plans, backward-compatibility bridges, and dependent screens.

---

## 2. Legacy Authentication Inventory

| File Path | Current Purpose | Action / Disposition | Reason |
| :--- | :--- | :--- | :--- |
| `db/auth/crypto.ts` | Custom HMAC-SHA256 password hashing (`mlohub_v1$` & `mlohub_v2$`), client JWT generation (`signToken`), client token verification (`verifyToken`), salt generation, OTP hashing, password strength evaluation. | **Deprecate Auth Methods; Retain Utility Functions**. Remove client password hashing/verification & client JWT generation from auth flow. Retain non-sensitive UI utility `checkPasswordStrength`. | Authentication and JWT signing must be owned exclusively by Supabase Auth / PostgreSQL backend. |
| `db/auth/service.ts` | Local user registration, custom password verification, local session array manipulation in `MloHubDB.sessions`, user-ID fallback switching, custom bootstrap. | **Deprecate & Bridge to Supabase Auth**. Auth operations (`signIn`, `signUp`, `signOut`, `resetPassword`, `getSession`) routed through Supabase Auth. Local session manipulation removed. | Supabase Auth provides secure server-issued JWTs, refresh tokens, and session persistence. |
| `db/auth/guards.ts` | Client-side RBAC evaluation (`requireAuth`, `requireRole`, `requireRestaurantMembership`, `requireRestaurantOwner`, `resolvePortalAccess`, `selectRestaurantOrders`). | **Refactor & Retain Guards**. Integrate with Supabase session and `restaurant_members` database records; keep `resolvePortalAccess` and `selectRestaurantOrders` for client UI gating. | Application routing requires clean client-side access gates, backed by Supabase RLS policies on the database. |
| `context/AuthContext.tsx` | React context providing authentication state (`user`, `session`, `isAuthLoading`), workspace switching, login, registration, and logout. | **Refactor into Central Source of Truth**. Hook into `supabase.auth.onAuthStateChange()`, restore session via `@react-native-async-storage/async-storage`, load profile from `public.profiles`, and provide backward-compatible aliases for existing screens. | Maintains seamless frontend compatibility while switching the underlying engine to Supabase Auth. |
| `services/supabase.ts` | Prototype Supabase client configured with in-memory / browser `UniversalStorageAdapter`. | **Replace with `lib/supabase.ts`**. Reconfigure with `@react-native-async-storage/async-storage` and React Native `AppState` listener for auto-refresh. Re-export for compatibility. | Standard React Native Supabase configuration for persistent sessions across app restarts. |

---

## 3. Code Scheduled for Removal vs. Temporary Compatibility

### Code to be Removed / Deprecated from Auth Flow
1. **Client Password Hashing & Verification**: `CryptoEngine.hashPassword`, `CryptoEngine.verifyPassword`, and legacy upgrade logic. Passwords are sent directly to Supabase Auth over TLS for standard Bcrypt/Argon2 hashing in `auth.users`.
2. **Client-Generated JWTs**: `CryptoEngine.signToken` and client-signed token payloads.
3. **Local Database Password Storage**: Removing `passwordHash` and readable `securityPin` from `MloHubDB.users`.
4. **Local Session Array Manipulation**: Deprecating `db.sessions` in `MloHubDB` in favor of Supabase Auth storage.
5. **Hardcoded Credentials & Bypasses**: Bypasses (e.g. `'1234'`, `'password123'`, `'usr-admin'`) removed completely.

### Code Retained for Compatibility
1. **`checkPasswordStrength`**: Client-side UX password strength indicator used in registration screens.
2. **Backward-Compatible Method Aliases in `AuthContext`**:
   - `login(dto)` -> delegates to `signIn({ email, password })`
   - `registerCustomer(dto)` -> delegates to `signUpCustomer(dto)`
   - `logout()` -> delegates to `signOut()`
   - `isAuthLoading` -> aliased to `loading`
   - `switchWorkspace(target, restId)` -> updates local active workspace state and refreshes session
3. **Safe Data Selectors**: `selectRestaurantOrders` and `resolvePortalAccess` retained for robust UI filtering.

---

## 4. Dependent Screens & Components Audit

| Screen / Component | Current Auth Consumption | Migration Strategy |
| :--- | :--- | :--- |
| `app/_layout.tsx` | Consumes `isAuthLoading`, `isAuthenticated`, `activeWorkspace`. Redirects between `/auth`, `/onboarding`, `/restaurant-portal`, and `/(tabs)`. | Retain navigation logic; bind directly to Supabase `isAuthenticated` and `loading`. Prevent route flashing during session hydration. |
| `app/auth/index.tsx` | Gateway page selecting between Customer and Restaurant registration/login. | No changes to UI design; preserves navigation to `/auth/register-customer`, `/auth/register-restaurant`, and `/auth/login`. |
| `app/auth/login.tsx` | Segmented login (Customer / Restaurant). Calls `login({ emailOrPhone, password })`. | Connect to `signIn({ email, password })`. Map Supabase error responses to friendly bilingual messages. Route based on verified profile & memberships. |
| `app/auth/register-customer.tsx` | Customer signup form. Calls `registerCustomer(dto)`. | Connect to `signUpCustomer({ email, password, fullName, phone, location })`. Validates fields and handles Supabase auth errors cleanly. |
| `app/auth/register-restaurant.tsx` | Vendor intake form creating `restaurantApplications`. | Preserves application submission. Does not allow arbitrary self-registration as restaurant owner. |
| `app/auth/forgot-password.tsx` | Password reset UI (previously simulated). | Connect to `supabase.auth.resetPasswordForEmail(email)`. Show safe generic confirmation message. |
| `app/restaurant-portal/index.tsx` | Portal gate checking owner/staff memberships. | Authenticates via Supabase session; checks `restaurant_members` database records for active role and permissions. |
| `app/admin/index.tsx` | Back-office admin portal and admin login gate. | Authenticates via Supabase Auth; requires verified `ADMIN` or `SUPER_ADMIN` in database profile. |
| `app/(tabs)/profile.tsx` | Profile screen, account switcher, workspace switcher, and logout. | Reads profile from Supabase Auth / `profiles` table. Updates profile safe fields via Supabase API. Calls `signOut()`. |
| `components/PaymentCheckoutModal.tsx` | Reads `user` for customer info. | Seamlessly reads unified `user` / `profile` from `useAuth()`. |
