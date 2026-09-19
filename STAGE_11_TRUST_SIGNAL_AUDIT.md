# STAGE 11: TRUST SIGNAL AUDIT

## 1. Executive Summary
This audit inspects, catalogs, and classifies every data signal across MloHub's database, services, and mobile interface that contributes to customer trust, menu accuracy, operational reliability, and market intelligence.

Prior to Stage 11, trust indicators were either ad-hoc (e.g. basic star ratings, raw `is_verified` flags) or computed in siloed components without a unified decay schedule. Stage 11 establishes a deterministic, multi-dimensional Trust & Data Quality Engine that evaluates 14 discrete trust signals without collapsing them into a single opaque rating.

---

## 2. Catalog of 14 Trust Signals

| # | Signal Name | Source Table / Field | Update Frequency | Signal Weight | Decay Half-Life | Dimensions Influenced |
|---|---|---|---|---|---|---|
| 1 | **Menu Price Verification** | `menu_verifications.created_at`, `branch_menu_items.last_verified_at` | On explicit audit / branch update | High (0.35) | 72 hours (Step decay) | `MENU_FRESHNESS`, `PRICE_CONFIDENCE` |
| 2 | **Dish Availability Toggle** | `branch_menu_items.is_available`, `menu_items.is_available` | Realtime / Daily | High (0.30) | 24 hours | `AVAILABILITY_CONFIDENCE` |
| 3 | **Legal Business Verification** | `restaurants.is_verified`, `verification_requests` (BRELA, TIN, Business License) | Rare (Annual/One-off) | High (0.40) | 365 days | `VERIFICATION_STATUS` |
| 4 | **Order Fulfillment History** | `orders.status` (`COMPLETED` vs `CANCELLED`/`REJECTED`) | Continuous per order | High (0.35) | Bayesian Smoothed ($N \ge 10$) | `FULFILLMENT_RELIABILITY` |
| 5 | **Kitchen Preparation Fidelity** | `orders.preparation_time_minutes`, `order_status_history` | Continuous per order | Medium (0.20) | Rolling 30 days | `FULFILLMENT_RELIABILITY` |
| 6 | **Opening Hours Adherence** | `restaurant_branches.opening_hours`, actual order acceptance timestamps | Weekly / Continuous | Medium (0.25) | 14 days | `HOURS_CONFIDENCE` |
| 7 | **Geocoded Location Precision** | `restaurant_branches.latitude`, `restaurant_branches.longitude`, `is_geocoded` | Rare (On onboarding/move) | Medium (0.20) | Permanent until flagged | `LOCATION_CONFIDENCE` |
| 8 | **Customer Discrepancy Reports** | `data_reports`, `customer_discrepancy_reports` | On customer submission | Critical (-0.40) | Active until resolved | `CUSTOMER_REPORT_HEALTH`, `PRICE_CONFIDENCE` |
| 9 | **Customer Dish Reviews** | `dish_reviews.rating`, `dish_reviews.created_at` | Continuous per customer | Low (0.15) | 90 days exponential | Culinary satisfaction (NOT trust) |
| 10 | **Customer Price Confirmation** | `funnel_events.post_order_feedback` ("Was price accurate?") | Continuous per order | Medium (0.25) | 7 days | `PRICE_CONFIDENCE` |
| 11 | **Menu Photo Audit** | `menu_verifications.evidence_url` (Physical menu photo) | Weekly / Monthly | High (0.30) | 30 days | `MENU_FRESHNESS`, `PRICE_CONFIDENCE` |
| 12 | **Order Cancellation Reasons** | `orders.cancellation_reason` (e.g. "OUT_OF_STOCK", "PRICE_CHANGED") | Continuous per event | Critical (-0.35) | Rolling 14 days | `AVAILABILITY_CONFIDENCE`, `FULFILLMENT_RELIABILITY` |
| 13 | **Search & Zero-Result Density** | `search_analytics_events`, `zero_result_events` | Continuous | Intelligence (N/A) | Rolling 7 days | Market Supply Gap |
| 14 | **Rapid Query Refinements** | `search_analytics_events.is_refinement` | Continuous | Intelligence (N/A) | Rolling 24 hours | Market Demand Friction |

---

## 3. Separation of Concerns: Identity vs. Data Quality

A critical vulnerability identified in early platform designs was treating "Verified Restaurant" as a guarantee of "Accurate Prices":
- **Legal Business Verification (`VERIFICATION_STATUS`)**: Confirms the entity is legally registered with BRELA, has an active TIN, and verified business premises. This is valid for up to 12 months.
- **Menu & Price Freshness (`MENU_FRESHNESS` & `PRICE_CONFIDENCE`)**: Volatile data subject to inflation, food supplier cost changes, and daily stockouts. A BRELA-verified restaurant that has not audited its menu in 60 days has `STALE` menu confidence.

Stage 11 strictly segregates these two dimensions across all data contracts and UI displays.

---

## 4. Anti-Sabotage Safeguards
To prevent malicious competitors or bad actors from destroying a restaurant's trust score:
1. **Report Rate Limiting**: Maximum 1 report per user per item per 24 hours. Maximum 3 discrepancy reports per user per day platform-wide.
2. **Order Verification Bonus**: A report from a customer who actually paid for an order at that restaurant carries $3\times$ higher evidence weight than an unverified walk-in report.
3. **Evidence Status Gate**: A new report enters `UNVERIFIED_REPORT` and triggers an internal `UNDER_REVIEW` flag. It only applies a full confidence penalty if corroborated by 2+ independent reports or confirmed by an administrator.
4. **Instant Trust Recovery**: Once the restaurant submits a menu verification or updates the price to match reality, the discrepancy is marked `RESTAURANT_CORRECTED` or `ADMIN_RESOLVED`, instantly restoring the item to `FRESH` confidence.

---

## 5. Privacy & Location Coarsening Audit
Search and demand analytics must never compromise customer privacy:
1. **Raw GPS Stripping**: Exact coordinates (`latitude`, `longitude`) from customer search devices are dropped immediately at the ingestion layer.
2. **Ward & Neighborhood Centroid Coarsening**: Locations are mapped to Dar es Salaam municipal wards (e.g., *Kariakoo, Masaki, Mikocheni, Sinza, Kinondoni, Posta, Upanga*).
3. **Anonymized Aggregation**: Analytical events contain no user IDs for unauthenticated visitors, and pseudonymous hashes for logged-in users, retained for a maximum of 90 days before rollup aggregation.
