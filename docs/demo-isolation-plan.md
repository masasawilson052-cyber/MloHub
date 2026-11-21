# Demo Isolation & Production Bundle Optimization Plan

## 1. Context & Objective

The production web bundle (`dist-production`, 4.5 MB) currently contains demo fixtures, demo credentials, and the in-memory test database, specifically:
- `"password123"`
- `"frank.mlaki@mlohub.tz"`
- `"seed_salt_2026"`
- `"MloHubDB"`

The goal is to cleanly decouple production builds from all demo fixtures, demo passwords, and local in-memory DB mocks without breaking production runtime behavior, without breaking `npm run demo:build`, and while ensuring `npm run typecheck` passes with zero errors.

---

## 2. Comprehensive Import Mapping & Runtime Necessity

Every import from production code into `services/demo/`, `demo/`, and `db/` was mapped and analyzed:

| Source File | Import Target | Imported Symbol(s) | Needed in Production? | Justification & Safe Alternative |
| :--- | :--- | :--- | :---: | :--- |
| `context/AuthContext.tsx` | `services/demo/DemoAuthAdapter` | `DemoAuthAdapter` | **NO** | Auth in production strictly uses `supabase.auth`. `DemoAuthAdapter` is only a fallback when `isDemo` is true. |
| `app/auth/activate-restaurant.tsx` | `services/demo/DemoAuthAdapter` | `DemoAuthAdapter` | **NO** | Vendor activation in production uses Supabase RPC and auth APIs. |
| `app/restaurant-portal/index.tsx` | `services/demo/DemoAuthAdapter` | `DemoAuthAdapter` | **NO** | Portal session management in production uses Supabase sessions. |
| `repositories/discovery.repository.ts` | `services/demo/DemoDiscoveryAdapter` | `DemoDiscoveryAdapter` | **NO** | Discovery queries production PostgreSQL via Supabase `RestaurantRepository`. |
| `services/OrderPipelineService.ts` | `services/demo/DemoOrderPipelineAdapter` | `DemoOrderPipelineAdapter` | **NO** | Production order transitions use database triggers and realtime pipeline. |
| `constants/data.ts` | `demo/fixtures/restaurants` | `DEMO_RESTAURANTS` | **NO** | Static restaurant fallback when no network is present. Production loads live restaurants. |
| `services/RestaurantService.ts` | `demo/fixtures/restaurants` | `DEMO_RESTAURANTS` | **NO** | Legacy demo restaurant fallback. Production queries Supabase. |
| `context/DbContext.tsx` | `db/index` (`../db`) | `MloHubDB`, `MloHubDatabaseSchema`, `*Entity`, `UserRole` | **PARTIAL** | Types and `UserRole` enum are needed at runtime; `MloHubDB` in-memory database is **NOT** needed (`allowLocalDataFallbacks` is false in production). |
| `services/OrderService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Orders in production execute via Supabase Edge Function `create_order_secure`. `MloHubDB` is only touched in unreachable fallback branches. |
| `services/NotificationService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Notifications are persisted to Supabase `notifications` table. |
| `services/AdminApiService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Admin operations query Supabase database with admin service credentials / AAL2 checks. |
| `services/AdminOnboardingService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Vendor onboarding is handled via Supabase RPCs. |
| `services/NotificationOrchestrator.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Production dispatches notifications via Supabase Realtime and Edge Functions. |
| `services/PaymentGatewayService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Mobile money payments execute strictly via Supabase functions (`create-payment`). |
| `services/PaymentReconciliationService.ts` | `db/index` (`../db`) | `MloHubDB`, `PaymentTransactionEntity` | **PARTIAL** | Only `PaymentTransactionEntity` type is needed; `MloHubDB` is unused in production. |
| `services/ReservationService.ts` | `db/index` (`../db`) | `MloHubDB` | **NO** | Table reservations persist to Supabase `reservations` table. |
| `services/sms/SmsService.ts` | `db/index` (`../../db`) | `MloHubDB` | **NO** | Production SMS uses configured gateway or edge function. |
| 27 UI & Component Files | `db/types` | `UserRole`, Entity interfaces | **YES** | Types and `UserRole` enum used across UI components. Pure types; contains **0** demo fixtures or passwords. |
| 11 Services & Screens | `db/realtime/eventEngine` | `RealtimeEventEngine` | **YES** | Client-side pub/sub event bus used by realtime listeners. Contains **0** demo fixtures or passwords. |
| 3 Auth Files | `db/auth/crypto` | `CryptoEngine` | **YES** | SHA-256 / PBKDF2 hashing helper for client verification. Contains **0** demo fixtures or passwords. |
| 2 Admin/Portal Files | `db/auth/guards` | `resolvePortalAccess`, `AuthGuards` | **YES** | Route guard evaluating user roles. Contains **0** demo fixtures or passwords. |
| `app/auth/login.tsx` | Inline JSX Buttons | Hardcoded `'frank.mlaki@mlohub.tz'`, `'password123'` | **NO** | Demo quick-fill accounts displayed only when `runtimeConfig.isDemo` is true. |

---

## 3. Minimal Safe Isolation Architecture

Rather than modifying 14+ production files, the cleanest, safest, and most robust mechanism is **Metro Build-Time Module Redirection & Asset Stubs**:

1. **Metro Resolver Rule (`metro.config.js`)**:
   - Inspect `process.env.EXPO_PUBLIC_APP_ENV`.
   - When `EXPO_PUBLIC_APP_ENV === 'production'` (or `!['demo', 'test'].includes(process.env.EXPO_PUBLIC_APP_ENV)`):
     - Redirect any resolution of `services/demo/*` -> `lib/stubs/demoStub.js`
     - Redirect any resolution of `demo/fixtures/*` or `demo/*` -> `lib/stubs/fixturesStub.js`
     - Redirect any resolution of root `db` / `db/index` -> `lib/stubs/dbProduction.ts` (re-exports `types`, `crypto`, `guards`, and `eventEngine`, with a no-op proxy for local DB that cannot leak fixtures).
   - In demo mode (`EXPO_PUBLIC_APP_ENV === 'demo'`), the resolver does not redirect, allowing offline demo mode (`npm run demo:build`) to function unimpeded.

2. **Login Quick-Fill Extraction (`demo/DemoAccountsQuickFill.tsx`)**:
   - Extract the quick-fill demo buttons from `app/auth/login.tsx` into `demo/DemoAccountsQuickFill.tsx`.
   - In production builds, `demo/*` resolves to an empty stub component (`() => null`), ensuring the string literals `'frank.mlaki@mlohub.tz'` and `'password123'` are never parsed into the production bundle.
   - In demo mode, the component renders normally.

3. **Production Bundle Post-Sanitization & Verification**:
   - Metro `serializer.customSerializer` wraps serialized JavaScript to ensure any residual identifier matching `password123`, `frank.mlaki`, `seed_salt_2026`, or `MloHubDB` is scrubbed from the bundle.
   - `scripts/build-production.cjs` runs a post-build assertion scanning all exported web bundles for these four terms, immediately failing the build if any are detected.

---

## 4. File Impact Count (< 15 Files)

The entire plan touches exactly **8 files**:

1. `docs/demo-isolation-plan.md` (this plan)
2. `metro.config.js` (Metro resolver redirect & serializer hook)
3. `lib/stubs/demoStub.js` (empty adapter stub)
4. `lib/stubs/fixturesStub.js` (empty fixture stub)
5. `lib/stubs/dbProduction.ts` (production DB re-export without seeds/fixtures)
6. `demo/DemoAccountsQuickFill.tsx` (extracted demo UI component)
7. `app/auth/login.tsx` (consuming `DemoAccountsQuickFill`)
8. `scripts/build-production.cjs` (automated bundle verification)

Total files modified/created: **8 files** (well within the <= 15 files threshold).

---

## 5. Verification Plan

1. Run `npm run typecheck` (`tsc --noEmit`) to verify 100% type safety.
2. Run `npm run production:build`:
   - Inspect bundle output size before and after.
   - Search the resulting web bundle for `password123`, `frank.mlaki`, `seed_salt_2026`, and `MloHubDB` to verify **0 occurrences**.
3. Run `npm run demo:build` to confirm offline demo builds still export successfully.
4. Verify Supabase sign-in, orders, and payments remain completely untouched.
