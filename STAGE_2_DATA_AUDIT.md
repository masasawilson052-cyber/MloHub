# MloHub Stage 2: Data-Layer Dependency Audit

**Date:** September 16, 2026  
**Target:** Supabase PostgreSQL as Single Source of Truth  
**Project Root:** `C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo`

---

## 1. Executive Summary
This document audits every usage of prototype client-side persistence mechanisms in the MloHub codebase:
- `MloHubDB`
- `StorageDriver`
- `memoryStorage`
- `localStorage`
- `AsyncStorage`
- `db.users`, `db.restaurants`, `db.orders`, `db.menuItems`, `db.reservations`, `db.payments`, `db.notifications`, `db.customMealRequests`, `db.restaurantApplications`, `db.restaurantQuotes`
- Hardcoded constants (`RESTAURANTS`, `SPECIALIST_CATEGORIES`)

Each dependency is mapped to its production PostgreSQL replacement and classified according to the migration taxonomy:
- **MIGRATE:** Will be repointed to Supabase repositories and services.
- **REMOVE:** Prototype hack / dead bypass to be deleted.
- **CACHE_ONLY:** Harmless read cache for offline UI responsiveness; Supabase is authoritative.
- **TEST_ONLY:** Preserved exclusively inside automated test runners (`tests/`).
- **KEEP:** Legitimate storage (e.g. Supabase session tokens in `AsyncStorage`).

---

## 2. Granular Dependency Inventory

| File | Component / Function | Entity Used | Op | Production Replacement | Classification | Migration Status |
|---|---|---|---|---|---|---|
| `app/(tabs)/index.tsx` | `HomeScreen` / `filteredRestaurants` | `db.restaurants`, `RESTAURANTS` | Read | `RestaurantRepository.list()` | MIGRATE | In Progress |
| `app/(tabs)/explore.tsx` | `ExploreScreen` / `filteredRestaurants` | `db.restaurants`, `RESTAURANTS` | Read | `RestaurantRepository.list()` | MIGRATE | In Progress |
| `app/restaurant/[id].tsx` | `RestaurantDetailScreen` | `db.restaurants`, `restaurant.menu` | Read | `RestaurantRepository.getById()` + `MenuRepository.listByRestaurant()` | MIGRATE | In Progress |
| `app/(tabs)/custom.tsx` | `CustomMealScreen` / `handleCreateCustomOrder` | `db.customOrders` | Read/Write | `CustomMealRepository.create()` | MIGRATE | In Progress |
| `app/(tabs)/bookings.tsx` | `BookingsScreen` / `activeBookings` | Hardcoded booking list | Read | `ReservationRepository.listByCustomer()` | MIGRATE | In Progress |
| `components/ReservationModal.tsx` | `handleProceedToPayment` | `db.reservations` | Write | `ReservationRepository.create()` | MIGRATE | In Progress |
| `app/(tabs)/profile.tsx` | `ProfileScreen` | `db.user`, `db.favorites` | Read/Write | `profiles` table via `AuthContext` + user preference storage | MIGRATE | In Progress |
| `app/restaurant-portal/index.tsx` | `RestaurantPortalScreen` | `db.restaurants`, `db.orders`, `db.menuItems` | Read/Write | `OrderRepository` + `MenuRepository` | MIGRATE | In Progress |
| `app/admin/index.tsx` | `AdminPortalScreen` | `db.restaurantApplications`, `db.restaurants` | Read/Write | `ApplicationRepository` + `RestaurantRepository` | MIGRATE | In Progress |
| `app/auth/register-restaurant.tsx` | `RegisterRestaurantScreen` | `db.restaurantApplications` | Write | `ApplicationRepository.submit()` | MIGRATE | In Progress |
| `app/onboarding.tsx` | `OnboardingScreen` | `hasCompletedOnboarding` | Read/Write | Harmless device preference storage | CACHE_ONLY | Validated |
| `components/PaymentCheckoutModal.tsx` | `handleConfirmPayment` | `db.payments`, `db.orders` | Write | `PaymentRepository.createRecord()` | MIGRATE | In Progress |
| `context/DbContext.tsx` | `DbProvider` | Full `MloHubDatabaseSchema` | Read/Write | Cloud-backed `DbContext` backed by Repositories | MIGRATE | In Progress |
| `services/OrderPipelineService.ts` | Order state machine | `db.customOrders`, `db.orders` | Read/Write | `OrderRepository` + `CustomMealRepository` | MIGRATE | In Progress |
| `services/AdminOnboardingService.ts` | Vendor onboarding | `db.restaurants`, `db.users`, `db.otpChallenges` | Read/Write | `ApplicationRepository` + `RestaurantRepository` | MIGRATE | In Progress |
| `services/PaymentGatewayService.ts` | Payment transactions | `db.payments` | Read/Write | `PaymentRepository` | MIGRATE | In Progress |
| `services/AdminApiService.ts` | Vendor management | `db.restaurants` | Read/Write | `RestaurantRepository` | MIGRATE | In Progress |
| `db/storage.ts` | `StorageDriver`, `memoryStorage`, `localStorage` | JSON disk store | Read/Write | Deprecated; offline draft cache only | CACHE_ONLY | Deprecate |
| `db/repositories.ts` | `MloHubDB` | Prototype local tables | Read/Write | Deprecated; preserved as test fixtures | TEST_ONLY | Deprecate |
| `db/seed.ts` | `INITIAL_DATABASE_SEED` | Initial memory snapshot | Read | `supabase/seed.sql` | TEST_ONLY | Preserved for test suite |
| `lib/supabase.ts` | Auth token persistence | `AsyncStorage` / `isomorphicStorage` | Read/Write | Supabase session storage | KEEP | Active Stage 1 |
| `tests/auth.test.ts` | Automated auth tests | In-memory test sessions | Read/Write | Test fixtures | TEST_ONLY | Active |
| `tests/runAllSuites.ts` | Automated master suite | In-memory test database | Read/Write | Test fixtures | TEST_ONLY | Active |

---

## 3. Storage Boundary Rules

### Authoritative Cloud Storage (PostgreSQL Only):
- `profiles` (Customer, Vendor, Admin identities)
- `restaurants` & `restaurant_branches`
- `restaurant_members` (Multi-tenant permissions)
- `restaurant_applications` (Vendor vetting pipeline)
- `menu_categories` & `menu_items` & `branch_menu_items`
- `menu_verifications` (Audit trail for price & freshness)
- `orders` & `order_items` (Immutable price & item name snapshots)
- `reservations` (Table bookings & deposit status)
- `custom_meal_requests` & `restaurant_quotes`
- `reviews` & ratings
- `notifications` (Permanent notification inbox)
- `payments` (Transaction records & status)
- `audit_logs` (Administrative changes)

### Device-Only Storage (AsyncStorage / Preferences):
- Supabase Auth session tokens & refresh tokens
- User language preference (`sw` / `en`)
- Local onboarding completion flag (`hasCompletedOnboarding`)
- Transient offline query cache (always invalidated by cloud fetch)
- Temporary custom meal drafting state

---

## 4. Anti-Corruption & Deprecation Plan
1. **No Silent Mock Data:** In production (`EXPO_PUBLIC_USE_MOCK_DATA=false`), if Supabase connectivity is missing or misconfigured, the application throws an explicit configuration error rather than silently serving mock data.
2. **Backward-Compatible UI:** Screens continue to consume high-level hooks (`useMloHubDB()` or repository hooks), while internal data fetching is switched to Supabase repositories.
3. **Test Fixture Segregation:** `db/repositories.ts` and `db/seed.ts` are decorated with `@deprecated` tags and retained solely to satisfy test runner execution without modifying legacy test expectations.
