# STAGE 4: DISCOVERY ARCHITECTURE AUDIT REPORT
**MloHub Food-First Discovery Evaluation**

---

## 1. Executive Summary

This audit examines the discovery architecture of MloHub as of the completion of Stage 3 and evaluates what changes are necessary to fulfill MloHub's non-negotiable product principle: **MloHub is Food-First**.

The current application discovery flow is predominantly **restaurant-first**:
- When customers search on the Home (`app/(tabs)/index.tsx`) or Explore (`app/(tabs)/explore.tsx`) screens, results are returned as a list of **restaurants** (`RestaurantCard`).
- To find specific food items, users are forced to click into an individual restaurant (`app/restaurant/[id].tsx`), browse its menu categories, and locate dishes manually.
- Filtering by price applies to restaurant-level aggregates (e.g. `minPrice` or `budgetTier`), rather than the actual price of the specific dish the user wants to order.
- Distance is evaluated from the restaurant's central coordinates rather than specific operating branches.
- Verification freshness indicators are not prominently tied to individual dishes or prices.

Stage 4 refactors this entire paradigm so that the primary discovery entity is the **DISH**, contextualized by its branch, price, distance, availability, and verification freshness.

---

## 2. Existing Discovery Architecture & Screen Flow

```
Current Flow (Restaurant-First):
[Home / Explore Search: "Biryani"]
       ↓
[Filtered Restaurant Cards]
  • Mama Amina Biryani (Rating: 4.9, Mikocheni)
  • Kibo Mchemsho (Rating: 4.8, Sinza)
       ↓
[Click Restaurant Card]
       ↓
[Restaurant Details Page]
       ↓
[Manual Scroll through Categories to find "Chicken Biryani"]
```

```
Target Flow (Food-First Discovery):
[Home / Explore Search: "Chicken Biryani", Budget <= 12,000, Mikocheni]
       ↓
[Ranked Dish Results Cards]
  1. Chicken Biryani — Mama Amina Biryani (Mikocheni B, 0.8 km, TZS 11,000, ★ 4.9, Available, Verified 2h ago)
  2. Biryani Hub Special — Biryani Hub (Mikocheni A, 1.3 km, TZS 9,500, ★ 4.7, Available, Verified today)
  3. Royal Chicken Biryani — Spice House (Mikocheni B, 1.8 km, TZS 12,000, ★ 4.8, Available, Verified 1d ago)
       ↓
[Direct Action: Compare, View Dish in Menu, or Order Ahead]
```

---

## 3. Detailed Component & Capability Audit

### 3.1 `app/(tabs)/index.tsx` (Customer Home)
- **Current State**:
  - `filteredRestaurants` filters an array of `Restaurant` objects based on `r.name`, `r.cuisine`, `r.neighborhood`, or `r.tags`.
  - Dispatches to `RestaurantCard` rendering restaurant images, overall cuisine tags, and star ratings.
  - Search bar placeholder is generic ("Search food, dish or cuisine..."), but typing a dish name only filters for restaurants that have that dish tag, without showing the dish itself, its image, or its price.
- **Defects / Gaps**:
  - Dish items are completely invisible on the home screen.
  - Quick filters ("Within 3 km", "Budget", "Rating 4.0+") apply to restaurants, not dishes.
  - No display of verification freshness (e.g. "Price verified 2h ago").

### 3.2 `app/(tabs)/explore.tsx` (Explore / Search Results)
- **Current State**:
  - Displays category chips (`biryani`, `mchemsho`, `nyama_choma`, `traditional`, `vegetarian`).
  - Contains a toggle between `list` and `map` view (`GoogleMapView`).
  - Still binds entirely to `RestaurantCard` rendering `Restaurant` records.
- **Defects / Gaps**:
  - Does not support dish-level result ranking.
  - Sorting (`rating`, `distance`, `price`) sorts restaurants by their base `minPrice`, not by the actual price of the queried dish.
  - No pagination or infinite scroll mechanism for large catalogs.

### 3.3 `app/restaurant/[id].tsx` (Restaurant Details)
- **Current State**:
  - Shows restaurant cover, rating, address, opening status, and grouped categories of dishes (`menu`).
- **Defects / Gaps**:
  - Does not know which dish brought the customer here. If the user tapped on "Chicken Biryani" from search, the page does not highlight, scroll to, or badge that dish.

### 3.4 Service & Repository Layers
- **`RestaurantService` & `RestaurantRepository`**:
  - Implements `list(...)` and `getById(...)`.
  - Supports SQL filtering on `cuisine`, `neighborhood`, and search text against `restaurants` table.
- **`MenuRepository` & `MenuService`**:
  - `MenuRepository.searchItems(...)` exists but only performs a simple `ilike` query on `menu_items` without branch resolution, distance calculation, or reviews aggregation.
  - Lacks ranking formulas and does not compute composite scores (Relevance + Distance + Price + Rating + Freshness).

### 3.5 Database Search & Full-Text Capabilities
- In Stage 2, `menu_items.search_tsv` and a GIN index `idx_menu_items_search_tsv` were added with weights for `name_en`, `name_sw`, `description_en`, `description_sw`, and `dietary_tags`.
- However, there is no unified **server-side discovery RPC** that links `menu_items` with `branch_menu_items` (branch price overrides), `restaurant_branches` (GPS distance), and `reviews` (live aggregated rating).
- Without a server-side RPC, the client would have to execute multiple roundtrips (N+1 queries) to resolve branches, prices, and ratings.

### 3.6 Location & Distance Handling
- Hardcoded coordinates exist on mock fixtures (`-6.7645, 39.2450`).
- No server-side SQL Haversine calculation exists to filter `distance <= max_distance_km`.
- No seamless fallback mechanism when GPS permission is denied (e.g. falling back to neighborhood filter like "Mikocheni" or "Sinza").

### 3.7 Pricing & Availability Logic
- The schema supports `branch_menu_items.price_tzs` and `branch_menu_items.is_available`, but client code still falls back to `menu_items.price_tzs` without checking active branch overrides.
- Stock statuses (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) are not surfaced in the UI.

### 3.8 Verification Freshness
- `menu_verifications` table tracks audits with timestamps, but neither Home nor Explore displays customer-facing freshness labels (e.g. `✓ Verified 2h ago` or `⚠ May be outdated`).

### 3.9 Comparison Feature
- A "Compare" button exists in service options, but it simply sorts restaurants by lowest price. There is no actual side-by-side dish comparison screen (`app/compare.tsx`).

### 3.10 Investor Demo Scenario Deficiencies
- The target scenario ("Chicken Biryani in Mikocheni under TZS 12,000 within 5 km") cannot be demonstrated today because:
  1. Search returns restaurants, not dish cards.
  2. Budget filtering evaluates the restaurant's minimum price rather than the biryani price.
  3. Freshness stamps are missing from cards.
  4. Distance calculations are static.

---

## 4. Remediation Plan Summary

| Gap | Stage 4 Solution |
| :--- | :--- |
| **Restaurant-Centric Results** | Build `DishCard` and make `DishDiscoveryResult` the primary entity. |
| **N+1 Client Roundtrips** | Create atomic PostgreSQL RPC `search_food_discovery(...)`. |
| **Bilingual Language Barrier** | Implement `config/foodSynonyms.ts` with Swahili-English food expansion. |
| **Static Distance** | Implement Haversine formula in SQL with neighborhood fallback. |
| **Branch Price Overrides** | Resolve effective price via `COALESCE(bmi.price_tzs, mi.price_tzs)`. |
| **Missing Freshness Stamps** | Implement `calculateFreshnessScore()` with `FRESH`, `RECENT`, `AGING`, `STALE` labels. |
| **Multi-Factor Ranking** | Deploy `config/discoveryRanking.ts` with configurable weights (Relevance, Distance, Price, Rating, Freshness). |
| **No Comparison Screen** | Implement `app/compare.tsx` for 2–4 dishes. |
| **Missing Dish Context** | Add `highlightDishId` handling in `app/restaurant/[id].tsx`. |
| **Investor Demo Gap** | Expand demo seed data with 5–10 restaurants and 40–60 dishes across Dar es Salaam. |
