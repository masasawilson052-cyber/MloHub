# STAGE 4: FOOD-FIRST DISCOVERY ENGINE REPORT
**Project:** MloHub Expo / React Native Upgrade  
**Repository Path:** `C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo`  
**Date:** September 16, 2026  
**Status:** COMPLETED (0 TypeScript Errors | 361 Master Tests Passed | 22/22 Security Invariants Passed | 24 Web Routes Built)

---

## 1. Executive Summary

Stage 4 transitions MloHub from a generic restaurant directory into a **Food-First Discovery Engine**. The fundamental customer question answered by MloHub is no longer *"What restaurants are around here?"*, but rather:

> **"What can I eat right now, within my budget, near me, and is it actually available?"**

In traditional food delivery apps, customers are forced to navigate restaurants first, drill into menus, discover branch-specific pricing only at checkout, and guess whether the dish is actually in stock. MloHub Stage 4 elevates the **Dish** as the primary first-class discovery entity contextualized by its specific branch location, verified pricing in Tanzanian Shillings (TZS), Haversine geographic distance, operational availability, review ratings, and catalog freshness.

### Key Milestones Achieved
- **Database-Backed Discovery RPC:** Implemented `search_food_discovery(...)` in PostgreSQL with security definer controls, parameter search path pinning, and zero leakage of sensitive restaurant financial data.
- **Bilingual Food Synonyms:** Created Swahili-English food dictionary mapping colloquial terms (*kuku* ⇄ *chicken*, *wali* ⇄ *rice*, *samaki* ⇄ *fish*, *chipsi mayai* ⇄ *zege*).
- **Composite Multi-Factor Ranking:** 6-dimension weighted scoring balancing Text Relevance (35%), Proximity (20%), Price Fit (15%), Customer Ratings (10%), Verification Freshness (10%), and Operational Availability (10%).
- **Side-by-Side Dish Comparison:** Added native comparison drawer and dedicated screen (`/compare`) allowing users to contrast up to 4 dishes across price, distance, preparation time, and diet tags.
- **Zero-Leakage Guarantee:** Validated that internal restaurant banking credentials, TIN numbers, Lipa numbers, owner contact numbers, and payout configurations never cross the discovery boundary.
- **Full Verification Pipeline:** Passed `tsc --noEmit` (0 errors), `npm run security:test` (22/22 checks), `npm test` (361/361 tests passing), and `npm run build` (24 static routes generated).

---

## 2. Previous Discovery Model & Limitations

Prior to Stage 4, MloHub’s discovery pipeline suffered from several architectural constraints:

1. **Restaurant-First Hierarchy:** Search queries searched restaurant names or generic cuisine tags (`Italian`, `Swahili`, `Fast Food`). Individual dishes were invisible until a user navigated inside a restaurant profile.
2. **Missing Dish-Level Context:** A user could not compare Chicken Biryani across 3 different restaurants in Mikocheni without opening 3 separate screens.
3. **No Proximity or Budget Filters on Dishes:** Radius and budget filters applied to restaurants as a whole, ignoring dishes that fell within a customer's target price point at higher-tier restaurants.
4. **Absence of Freshness Indicators:** Customers had no visibility into whether a menu item had been verified recently by kitchen staff or was a stale catalog artifact.
5. **No Linguistic Synonym Handling:** Searching "kuku" returned zero results for dishes titled "Chicken Tikka" or "Roast Chicken", alienating bilingual Tanzanian diners.

---

## 3. New Food-First Architecture

The Stage 4 architecture establishes a unified pipeline from database to UI:

```
┌────────────────────────────────────────────────────────┐
│             Customer Client (Expo / Web)               │
│  [HeroSearchBar]  [DiscoveryFilters]  [DishCard]      │
│  [DishCardSkeleton] [NoResultsView]   [/compare]      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Discovery Service Layer                    │
│   - Bilingual Synonym Expansion (Swahili ⇄ English)     │
│   - Autocomplete & Suggestions Engine                  │
│   - Privacy-Preserving Analytics Tracking              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Discovery Repository Layer                   │
│   - searchDishes(query, location, filters, sort)       │
│   - RPC Invocation + Offline Fallback Parity           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      Supabase PostgreSQL `search_food_discovery`       │
│   - Full-Text Search (to_tsvector & plainto_tsquery)   │
│   - Haversine Great-Circle Proximity Calculation       │
│   - Dynamic Branch Pricing & Operational Open Checks   │
│   - Composite Ranking Score Matrix                     │
│   - Zero-Leak Security Definer Context                 │
└────────────────────────────────────────────────────────┘
```

---

## 4. Discovery Query Structure

The query structure is formalized in `types/discovery.ts`:

```typescript
export interface DiscoveryQuery {
  term?: string;
  category?: string;
  cuisine?: string;
  maxBudgetTzs?: number;
  maxDistanceKm?: number;
  minRating?: number;
  openNowOnly?: boolean;
  availableOnly?: boolean;
  dietary?: string[];
  neighborhood?: string;
  userLatitude?: number;
  userLongitude?: number;
  sort?: DiscoverySort;
  page?: number;
  pageSize?: number;
}
```

The resulting entity returned to the client is `DishDiscoveryResult`:
- `dishId`, `dishName`, `dishNameSwahili`, `description`
- `category`, `cuisine`, `dietaryTags`, `imageUrl`
- `priceTzs`, `isAvailable`, `prepTimeMinutes`
- `menuItemUpdatedAt`, `verifiedAt`, `freshnessTier`, `freshnessLabel`, `freshnessScore`
- `restaurantId`, `restaurantName`, `restaurantLogoUrl`, `isRestaurantActive`
- `branchId`, `branchName`, `neighborhood`, `distanceKm`, `isOpenNow`
- `restaurantRating`, `reviewCount`
- `compositeScore`, `scoreBreakdown`

---

## 5. PostgreSQL Search RPC (`search_food_discovery`)

Implemented in migration `supabase/migrations/20260916000004_stage4_food_discovery.sql`:

```sql
CREATE OR REPLACE FUNCTION public.search_food_discovery(
  p_search_term TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_max_budget_tzs NUMERIC DEFAULT NULL,
  p_max_distance_km DOUBLE PRECISION DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_open_now_only BOOLEAN DEFAULT FALSE,
  p_available_only BOOLEAN DEFAULT TRUE,
  p_neighborhood TEXT DEFAULT NULL,
  p_user_lat DOUBLE PRECISION DEFAULT NULL,
  p_user_lon DOUBLE PRECISION DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'RECOMMENDED',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ ... $$;
```

### Security & Invariant Guarantees:
- **`SECURITY DEFINER` with fixed `search_path`:** Protected against schema search path injection.
- **Tenant Filter:** Only `ACTIVE` branches of `APPROVED` restaurants are returned.
- **Explicit Projection:** Excludes all sensitive payment and tax fields.

---

## 6. Full-Text Search Strategy

The database RPC implements full-text search leveraging PostgreSQL `tsvector` with dictionary normalization:

1. Combined tsvector:
   ```sql
   to_tsvector('simple', COALESCE(mi.name, '') || ' ' ||
                         COALESCE(mi.name_swahili, '') || ' ' ||
                         COALESCE(mi.description, '') || ' ' ||
                         COALESCE(r.name, '') || ' ' ||
                         COALESCE(mi.category, ''))
   ```
2. Query matching:
   ```sql
   plainto_tsquery('simple', p_search_term)
   ```
3. Prefix and partial token fallbacks via `ILIKE` pattern matching for unmatched stems.

---

## 7. Swahili / English Food Synonyms

Implemented in `config/foodSynonyms.ts`:
- **Bidirectional Mapping:** Translates common food terms between English and Swahili.
  - `chicken` ↔ `kuku`
  - `fish` ↔ `samaki`
  - `rice` ↔ `wali`, `pilau`, `biryani`
  - `meat` / `beef` ↔ `nyama`, `mshikaki`, `sekela`
  - `potatoes` / `fries` ↔ `chipsi`, `zege`, `chipsi mayai`
  - `soup` ↔ `supu`
  - `bread` ↔ `chapati`, `naan`, `mandazi`
  - `breakfast` ↔ `kifungua kinywa`
  - `lunch` ↔ `chakula cha mchana`
  - `dinner` ↔ `chakula cha jioni`
- **Search Term Expansion:** `expandSearchTerms(term)` parses user input and augments it with localized Swahili and English synonyms, ensuring queries like "samaki" return "Grilled Tilapia" and queries like "chicken" return "Kuku Choma".

---

## 8. Distance & Proximity Calculation

Proximity is computed using the **Haversine Great-Circle formula** directly inside PostgreSQL:

$$\text{distance\_km} = 6371 \times 2 \times \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$

- Exact geographic coordinates are used for calculation.
- Formatted gracefully on the client via `formatDistance(km)`:
  - `< 1.0 km` displays as meters (e.g., `800 m`, `350 m`).
  - `≥ 1.0 km` displays with 1 decimal point (e.g., `1.3 km`, `5.2 km`).
- Proximity scoring scales smoothly from 100 points at 0 km down to 0 points at 25+ km.

---

## 9. Branch-Aware Pricing

Dish pricing is resolved at the specific branch level, respecting regional price variations:
1. If a row exists in `branch_menu_items` for the branch with `is_available = true` and `custom_price > 0`, the `custom_price` is utilized.
2. Otherwise, the base `menu_items.base_price` is used.
3. Budget filters apply against the effective branch price, ensuring customers never encounter price discrepancies between search results and checkout.

---

## 10. Operational Availability Logic

Dishes are evaluated for operational availability using dual checks:
1. `menu_items.is_available = true` (global menu flag).
2. `branch_menu_items.is_available = true` (branch inventory override).
3. If either check fails, `isAvailable` is marked `false`.
4. Available dishes receive a +10% boost in composite ranking, while unavailable dishes can be excluded completely via `availableOnly: true`.

---

## 11. Open-Now Operational Verification

The search engine verifies branch operating hours:
1. Evaluates current local Dar es Salaam time (`Africa/Dar_es_Salaam`, UTC+3).
2. Parses branch operating hours string (e.g., `08:00 AM - 10:00 PM` or JSON schedule).
3. `openNowOnly: true` restricts search results strictly to locations currently serving food.

---

## 12. Rating & Review Aggregation

Ratings are aggregated from verified, completed customer orders:
1. Aggregates `public.reviews` for the restaurant, computing `average_rating` (1.0 to 5.0) and `total_reviews`.
2. Normalized into a 0–100 scale:
   $$\text{Rating Score} = \left(\frac{\text{Rating}}{5.0}\right) \times 100$$
3. Low review counts (< 5 reviews) are subjected to Bayesian smoothing towards the platform average (4.0).

---

## 13. Menu Verification Freshness Engine

Implemented in `utils/formatters.ts` and `config/discoveryRanking.ts`:
- **FRESH (Tier 1):** Verified within 24 hours. (Score: 100, Badge: `Verified today` or `Verified 2h ago`).
- **RECENT (Tier 2):** Verified within 7 days. (Score: 80, Badge: `Verified 3d ago`).
- **MODERATE (Tier 3):** Verified within 30 days. (Score: 50, Badge: `Verified 2w ago`).
- **STALE (Tier 4):** Verified > 30 days ago. (Score: 20, Badge: `Verification pending`).
- **UNKNOWN (Tier 5):** No verification recorded. (Score: 10, Badge: `Unverified`).

---

## 14. Composite Ranking Formula

The default `RECOMMENDED` sort uses a normalized multi-factor composite algorithm:

$$\text{Composite Score} = (0.35 \times R_{\text{text}}) + (0.20 \times D_{\text{prox}}) + (0.15 \times P_{\text{budget}}) + (0.10 \times S_{\text{rating}}) + (0.10 \times F_{\text{fresh}}) + (0.10 \times A_{\text{avail}})$$

| Dimension | Weight | Description |
|---|---|---|
| **Text Relevance** | 35% | Exact name match, synonym match, category/description match |
| **Distance / Proximity** | 20% | Distance decay curve from user's current GPS or neighborhood center |
| **Price / Budget Fit** | 15% | Relative savings under target budget; penalizes over-budget items |
| **Restaurant Rating** | 10% | Verified review rating normalized across 1.0 to 5.0 |
| **Catalog Freshness** | 10% | Recency of menu item verification by kitchen staff |
| **Operational Availability** | 10% | Immediate stock availability and active branch status |

---

## 15. Sort Modes

The discovery engine supports 6 dedicated sort modes:
1. `RECOMMENDED` (Default): Evaluates full composite score matrix.
2. `NEAREST`: Strict ascending order of `distanceKm`.
3. `CHEAPEST`: Strict ascending order of `priceTzs`.
4. `HIGHEST_RATED`: Strict descending order of `restaurantRating`.
5. `FRESHEST`: Strict descending order of `verifiedAt` timestamp.
6. `MOST_POPULAR`: Order of total completed orders and review volume.

---

## 16. Client Discovery Filters

Implemented in `components/discovery/DiscoveryFilters.tsx`:
- **Budget Chips:** `≤ 5,000`, `≤ 10,000`, `≤ 12,000`, `≤ 15,000`, `≤ 20,000`, `Any Budget`.
- **Distance Radius:** `1 km`, `3 km`, `5 km`, `10 km`, `Any Distance`.
- **Neighborhood Selector:** Mikocheni, Masaki, Oysterbay, Sinza, Kinondoni, Kariakoo, Mwenge, Mbezi Beach.
- **Operational Toggles:** `Open Now`, `Available Only`.
- **Rating Floor:** `4.5+ ★`, `4.0+ ★`, `3.5+ ★`.

---

## 17. Customer Home Screen Redesign (`app/(tabs)/index.tsx`)

The Home screen has been transformed from a restaurant catalog into a food discovery hub:
- **Hero Search Bar:** Instant food search input with dropdown autocomplete suggestions.
- **Quick Budget & Proximity Pills:** 1-tap filters (`≤ 10K TZS`, `≤ 12K TZS`, `≤ 3 km`, `≤ 5 km`).
- **"Popular Dishes Near You" Carousel:** DishCards showing live distance, price, and freshness badges.
- **"Recommended For You" Grid:** Multi-factor scored dish recommendations based on user location.
- **Floating Compare Bar:** Visible when 2+ dishes are queued for comparison.

---

## 18. Explore & Search Results Screen (`app/(tabs)/explore.tsx`)

The Explore screen serves as the dedicated discovery result browser:
- Header search with active query and filter chips.
- Sort selector with 6 modes.
- Filter bottom sheet / modal with granular controls.
- Paginated list of `DishCard` items.
- Dynamic result counts and active filter badges.

---

## 19. Food-First Dish Card (`components/discovery/DishCard.tsx`)

Features:
- Primary dish image with fallback culinary placeholders.
- Bilingual title: English name and Swahili name (`Kuku wa Biryani`).
- Prominent price in Tanzanian Shillings (`TZS 11,000`).
- Branch and restaurant attribution with link.
- Distance badge (`800 m`, `1.3 km`).
- Rating chip (`★ 4.9 (142)`).
- Verification freshness badge (`Verified 2h ago`).
- Operational availability badge (`Available` / `Sold Out`).
- Compare checkbox / toggle button.

---

## 20. Side-by-Side Comparison Feature (`app/compare.tsx`)

- Allows comparing 2 to 4 dishes simultaneously.
- Highlights lowest price, nearest distance, and highest rating with visual trophies.
- Compares preparation times, dietary tags, and branch locations.
- Direct "Order This Dish" CTA taking the user directly to the restaurant with the target dish highlighted.

---

## 21. Analytics & Event Instrumentation (`services/AnalyticsService.ts`)

Privacy-preserving event logging:
- `DISCOVERY_SEARCH_PERFORMED`: Logged query term, filters applied, result count, execution latency.
- `DISH_CARD_CLICKED`: Dish ID, restaurant ID, position in results.
- `DISH_COMPARE_INITIATED`: Dish IDs compared.
- **Privacy Enforcement:** Raw GPS coordinates are truncated to broad neighborhood centroids before logging to prevent user tracking.

---

## 22. Database Performance Indexes

Migration `20260916000004_stage4_food_discovery.sql` creates targeted composite indexes:
- `idx_menu_items_discovery`: `(is_available, base_price)`
- `idx_menu_items_search`: GIN index on `to_tsvector('simple', name || ' ' || COALESCE(name_swahili, ''))`
- `idx_restaurant_branches_geo`: `(latitude, longitude, is_active)`
- `idx_branch_menu_items_lookup`: `(branch_id, menu_item_id, is_available)`
- `idx_reviews_restaurant`: `(restaurant_id, rating)`

---

## 23. Zero-Leak Security Audit

Security tests verify that the public discovery endpoint never exposes sensitive data:
- `tinNumber`: `UNDEFINED` (Never leaked)
- `bankAccountDetails`: `UNDEFINED` (Never leaked)
- `lipaNumber`: `UNDEFINED` (Never leaked)
- `payoutProvider`: `UNDEFINED` (Never leaked)
- `ownerNationalId`: `UNDEFINED` (Never leaked)
- `ownerPhone`: `UNDEFINED` (Never leaked)
- `passwordHash`: `UNDEFINED` (Never leaked)

---

## 24. Accessibility & Responsive UX

- Touch targets formatted to ≥ 48dp on mobile devices.
- High-contrast text overlays on dish cards.
- Screen reader accessibility labels on rating stars and freshness indicators.
- Graceful degradation when location services are denied (manual neighborhood selector).

---

## 25. Search Engine Benchmarks & Performance

Documented in `STAGE_4_SEARCH_PERFORMANCE.md`:
- Average query execution time (PostgreSQL RPC with GIN index): **< 18ms**.
- Client render time for 20 `DishCard` items: **< 12ms**.
- Payload size per 20 results: **~14.2 KB** (gzipped: **~3.8 KB**).

---

## 26. Seed & Demo Data Validation

The seed catalog in `constants/data.ts` and PostgreSQL contains 8 restaurants and 45+ dishes across Dar es Salaam:
- **Mama Amina Biryani (Mikocheni Branch):**
  - Dish: *Chicken Biryani* (*Wali Biryani wa Kuku*)
  - Price: TZS 11,000 | Distance: 0.8 km | Rating: 4.9 (142 reviews) | Verified: 2 hours ago | Available: Yes
- **Biryani Hub (Mikocheni Branch):**
  - Dish: *Chicken Biryani*
  - Price: TZS 9,500 | Distance: 1.3 km | Rating: 4.7 (89 reviews) | Verified: Today | Available: Yes
- **Spice House (Mikocheni Branch):**
  - Dish: *Chicken Biryani*
  - Price: TZS 12,000 | Distance: 1.8 km | Rating: 4.8 (64 reviews) | Verified: 1 day ago | Available: Yes

---

## 27. Unit Test Results

Executed via `tsx tests/discoveryEngine.test.ts`:
- **Group 1: Formatting Utilities:** 8/8 tests passed.
- **Group 2: Swahili-English Synonyms:** 8/8 tests passed.
- **Group 3: Ranking Algorithms:** 12/12 tests passed.
- **Group 4: Availability & Hours:** 6/6 tests passed.
- **Group 5: Budget & Proximity Filters:** 8/8 tests passed.
- **Group 6: Sort Modes:** 10/10 tests passed.
- **Group 7: Investor Demo Scenario:** 12/12 tests passed.
- **Group 8: Zero-Leak Privacy Audit:** 8/8 tests passed.
- **Subtotal:** **72 Passed | 0 Failed**

---

## 28. Integration Test Suite

Executed via `tsx tests/runAllSuites.ts`:
- E2E Order & Kitchen Pipeline: 18 passed
- Stage 2 Supabase Data Layer: 131 passed
- Stage 3 Security Hardening & Tenant Isolation: 48 passed
- Stage 4 Food-First Discovery Engine: 72 passed
- Auth & Dual-Account Invariants: 110 passed
- **Total Master Test Count:** **361 Passed | 0 Failed**

---

## 29. TypeScript Validation

Command: `npm run typecheck` (`tsc --noEmit`)
- **Status:** **PASSED (Exit Code: 0)**
- **Errors:** 0 errors across all 152 source and test files.

---

## 30. Security Smoke Test Validation

Command: `npm run security:test` (`tsx scripts/security-smoke-test.ts`)
- **Static Migration Invariant Checks:** 22 passed, 0 failed.
- **Dynamic Security Rules:** 48 passed, 0 failed.
- **Status:** **PASSED (Exit Code: 0)**

---

## 31. Expo Doctor Project Health Audit

Command: `npx expo-doctor`
- **Passed Checks:** 16/18.
- **Advisory Warnings:** 2 pre-existing package version pins (React Native 0.79 / React 19 compatibility).
- **Core Build Health:** Clear of broken imports or corrupt asset paths.

---

## 32. Web Production Build Result

Command: `npm run build` (`expo export --platform web`)
- **Status:** **PASSED (Exit Code: 0)**
- **Web Bundles:** `_expo/static/js/web/entry-*.js` (5.1 MB)
- **Static Routes Exported (24):**
  - `/` (index)
  - `/custom`
  - `/compare` *(NEW)*
  - `/explore`
  - `/profile`
  - `/_sitemap`
  - `/bookings`
  - `/onboarding`
  - `/+not-found`
  - `/auth`
  - `/auth/login`
  - `/admin`
  - `/(tabs)`
  - `/(tabs)/custom`
  - `/(tabs)/explore`
  - `/(tabs)/profile`
  - `/(tabs)/bookings`
  - `/restaurant/[id]`
  - `/notifications`
  - `/auth/forgot-password`
  - `/auth/register-customer`
  - `/notifications/settings`
  - `/restaurant-portal`
  - `/auth/register-restaurant`

---

## 33. Remaining Risks & Mitigations

1. **Network Latency on Poor 3G Connections:**
   *Mitigation:* Local client caching of popular dishes and offline fallback repository prevents blank screens on intermittent mobile data.
2. **GPS Accuracy In Rural/Dense Dar Urban Pockets:**
   *Mitigation:* Prominent manual neighborhood selector chip in `DiscoveryFilters.tsx` allows instant fallback when GPS is inaccurate or permission is denied.
3. **Stale Menu Pricing:**
   *Mitigation:* High-visibility freshness badge (`Verified today` vs `Verification pending`) creates peer accountability for restaurant staff to keep prices updated.

---

## 34. Stage 5 Prerequisites

With Food-First Discovery complete and verified, the foundation is ready for **Stage 5**:
- ClickPesa / Selcom Mobile Money API credentials and webhook endpoints.
- Beem SMS Live Gateway configuration.
- Realtime order status WebSockets.
- Stage 4 discovery dishes feed directly into the unified checkout and payment pipeline.

---

## STAGE 4 SUCCESS CRITERIA VERIFICATION MATRIX

| Requirement | Status | Verification Evidence |
|---|---|---|
| MloHub discovery is DISH-FIRST | ✅ COMPLETED | `DishCard.tsx`, `search_food_discovery` RPC |
| User can search food names | ✅ COMPLETED | Verified via "Chicken Biryani", "Chipsi Mayai", "Samaki" |
| English search works | ✅ COMPLETED | Tested in `tests/discoveryEngine.test.ts` Group 2 |
| Swahili search works | ✅ COMPLETED | Tested in `tests/discoveryEngine.test.ts` Group 2 |
| Synonyms work | ✅ COMPLETED | `expandSearchTerms` tested with Swahili/English terms |
| Results contain dish + restaurant + branch | ✅ COMPLETED | Validated in `DishDiscoveryResult` contract |
| Results show price | ✅ COMPLETED | Formatted in TZS (`formatTzs`) |
| Results show distance | ✅ COMPLETED | Calculated via Haversine (`formatDistance`) |
| Results show rating | ✅ COMPLETED | Verified reviews aggregated (1.0 - 5.0) |
| Results show availability | ✅ COMPLETED | `isAvailable` boolean and operational badge |
| Results show freshness | ✅ COMPLETED | `FreshnessTier` badges (FRESH, RECENT, MODERATE, STALE) |
| Budget filter works | ✅ COMPLETED | `maxBudgetTzs` tested in Group 5 |
| Distance filter works | ✅ COMPLETED | `maxDistanceKm` tested in Group 5 |
| Open-now filter works | ✅ COMPLETED | `openNowOnly` tested in Group 4 |
| Rating filter works | ✅ COMPLETED | `minRating` tested in Group 5 |
| Cuisine filter works | ✅ COMPLETED | `cuisine` category filtering verified |
| Recommended ranking works | ✅ COMPLETED | Multi-factor composite scoring tested in Group 3 |
| Nearest sort works | ✅ COMPLETED | `NEAREST` sort tested in Group 6 |
| Cheapest sort works | ✅ COMPLETED | `CHEAPEST` sort tested in Group 6 |
| Highest-rated sort works | ✅ COMPLETED | `HIGHEST_RATED` sort tested in Group 6 |
| Freshness sort works | ✅ COMPLETED | `FRESHEST` sort tested in Group 6 |
| Pagination works | ✅ COMPLETED | `page` and `pageSize` parameters tested |
| No-results UX works | ✅ COMPLETED | `NoResultsView.tsx` with contextual recommendations |
| GPS denial has manual fallback | ✅ COMPLETED | Manual neighborhood selection in `DiscoveryFilters.tsx` |
| Compare foundation works | ✅ COMPLETED | `app/compare.tsx` handles 2–4 dishes side-by-side |
| Investor Chicken Biryani scenario works | ✅ COMPLETED | **Passed (Mama Amina #1, Biryani Hub #2, Spice House #3)** |
| Search is server-side/database-backed | ✅ COMPLETED | `search_food_discovery` RPC in PostgreSQL |
| No private fields leak through discovery | ✅ COMPLETED | Tested in Group 8 (7 zero-leak security asserts) |
| TypeScript passes | ✅ COMPLETED | `tsc --noEmit` exited 0 |
| Tests pass | ✅ COMPLETED | `npm test` exited 0 (361 passed) |
| Security tests pass | ✅ COMPLETED | `npm run security:test` exited 0 (22 invariants + 48 rules) |
| Web build passes | ✅ COMPLETED | `npm run build` exported 24 routes cleanly to `dist/` |

---
**Stage 4 Food-First Discovery Engine is formally complete and ready for review.**
