# MloHub Restaurant Portal — Phase 3 Implementation Report
**Merchant Finance, Payouts, Settlements, Refunds, Disputes & Operational Intelligence**
*Date: September 28, 2026*
*Status: Completed & Formally Verified*

---

## Executive Summary

Phase 3 of the MloHub Restaurant Portal closes the merchant financial lifecycle and analytical intelligence plane without touching or regressing Phase 1 (Merchant Identity & Two-Gate Launch Control) or Phase 2 (Daily Operations, Incoming Orders, Kitchen Board & Menu Modifiers).

Key accomplishments of Phase 3:
1. **Payout Destination Security Closure**: Eliminated the client-side write attempt to `merchant_payout_destination_secrets`. All payout destination creation is now executed exclusively server-side via the Edge Function [`supabase/functions/create-payout-destination/index.ts`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/supabase/functions/create-payout-destination/index.ts) and the atomic PostgreSQL RPC `create_payout_destination_secure`, which writes both `merchant_payout_destinations` and `merchant_payout_destination_secrets` within a single transaction and masks identifiers server-side (`MOBILE_MONEY`: `6 + '***' + 3`, `BANK_ACCOUNT`: `3 + '****' + 4`).
2. **Authoritative Financial Summary RPC**: Implemented `get_restaurant_financial_summary(p_restaurant_id, p_from, p_to)` in [`supabase/migrations/20260928000300_restaurant_finance_payouts_and_analytics.sql`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/supabase/migrations/20260928000300_restaurant_finance_payouts_and_analytics.sql) aggregating directly from `order_financial_snapshots`, `refund_requests`, `financial_adjustments`, `merchant_settlements`, and `merchant_payouts`.
3. **Payment Captured Event (`RESTAURANT_PAYMENT_CAPTURED`)**: Registered the informational notification event type, bilingual (`en` / `sw`) templates, and recipient routing strictly to restaurant `OWNER` and finance-permitted `MANAGER` members.
4. **Merchant Finance Workspace (`EarningsOverview.tsx`)**: Refactored [`components/restaurant/EarningsOverview.tsx`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/components/restaurant/EarningsOverview.tsx) into a 5-section workspace (`Overview`, `Transactions`, `Settlements`, `Payouts & Destinations`, `Refunds & Disputes`) with top status cards (`AVAILABLE TO SETTLE`, `PENDING`, `NEXT PAYOUT`), authoritative breakdown table, date filter presets (`Today`, `7 days`, `30 days`, `Custom`), safe CSV statement export, and destination management (`Add Destination`, `Set Default`, `Replace` with high-risk confirmation modal, `Disable`).
5. **Refunds & Disputes Panel (`RefundsDisputesPanel.tsx`)**: Created [`components/restaurant/RefundsDisputesPanel.tsx`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/components/restaurant/RefundsDisputesPanel.tsx) displaying refund claims, dispute deadlines, net payable impact, and evidence submission via `DisputesRepository.addEvidence` while strictly prohibiting merchant self-approval of refunds.
6. **Restaurant Analytics & Telemetry (`AnalyticsPanel.tsx` & `AnalyticsService.ts`)**: Extended [`components/restaurant/AnalyticsPanel.tsx`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/components/restaurant/AnalyticsPanel.tsx) and [`services/AnalyticsService.ts`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/services/AnalyticsService.ts) across 5 domains (`Operational`, `Commercial`, `Discovery & Conversion`, `Menu Performance`, and `Branch Performance`) with date window filters and strict zero-data handling (`"Not enough data"` when underlying records are absent).

---

## 1. Payout Destination Security & Atomic Server Architecture

### 1.1 Vulnerability Remediated
Previously, `PayoutsRepository.addPayoutDestination` inserted a row into `merchant_payout_destinations` from the client and then attempted a direct client insert into `merchant_payout_destination_secrets`. Because `merchant_payout_destination_secrets` is locked down to service-role only, client inserts either failed or risked partial state and credential exposure.

### 1.2 Server-Only Solution
- **Edge Function**: [`supabase/functions/create-payout-destination/index.ts`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/supabase/functions/create-payout-destination/index.ts)
  - Authenticates the caller's JWT token.
  - Verifies the caller is an active `OWNER` or finance-permitted `MANAGER` (`ALL`, `FINANCE`, `MANAGE_FINANCE`) of `restaurantId`.
  - Computes the masked account identifier server-side (`maskIdentifier`).
  - Calls `adminClient.rpc('create_payout_destination_secure', ...)` using the service role key.
  - Never logs or echoes raw `accountIdentifier`.
- **Atomic Database RPC**: `public.create_payout_destination_secure`
  - Unsets previous default destination if `p_is_default` is true.
  - Inserts metadata into `public.merchant_payout_destinations`.
  - Inserts raw/encrypted credential into `public.merchant_payout_destination_secrets` within the same transaction. Any failure rolls back both tables atomically.
- **Client Repository**: [`repositories/payouts.repository.ts`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/repositories/payouts.repository.ts)
  - Invokes `supabase.functions.invoke('create-payout-destination', ...)` and never touches `merchant_payout_destination_secrets`.
  - Provides `setDefaultDestination`, `disableDestination`, and `getFinancialSummary`.

---

## 2. Authoritative Financial Summary & Ledger Integrity

### 2.1 `get_restaurant_financial_summary(p_restaurant_id, p_from, p_to)`
Defined in [`supabase/migrations/20260928000300_restaurant_finance_payouts_and_analytics.sql`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/supabase/migrations/20260928000300_restaurant_finance_payouts_and_analytics.sql):
- Verifies caller is `service_role`, platform admin, or active restaurant `OWNER` / finance `MANAGER` (explicitly rejecting `CHEF`, `STAFF`, and other restaurants).
- Computes:
  - `gross_food_sales` from `order_financial_snapshots.gross_food_sales_tzs`
  - `platform_commission` from `order_financial_snapshots.platform_commission_tzs`
  - `service_fee_platform_revenue` from `order_financial_snapshots.customer_service_fee_tzs`
  - `delivery_restaurant_share` from `order_financial_snapshots.restaurant_delivery_fee_tzs`
  - `refund_deductions` from approved/completed `refund_requests`
  - `adjustments` from `financial_adjustments`
  - `restaurant_payable` as `GREATEST(0, v_restaurant_payable - v_refund_deductions - v_adjustments)`
  - `settled_amount` and `pending_amount` from `merchant_settlements`
  - `paid_out_amount` from `merchant_payouts`

---

## 3. Merchant Finance Workspace & Refunds/Disputes UI

### 3.1 `EarningsOverview.tsx`
- **Header Status Cards**:
  - `AVAILABLE TO SETTLE`: Authoritative pending payable amount.
  - `PENDING`: Settlements in review/processing.
  - `NEXT PAYOUT`: Active default payout destination or prompt to configure one.
- **5 Sub-Navigation Sections**:
  1. `Overview`: Full financial breakdown table + date filter (`Today`, `7 days`, `30 days`, `Custom`) + CSV Statement export (`Date,Order Reference,Gross (TZS),Platform Commission (TZS),Refund (TZS),Adjustment (TZS),Net Payable (TZS),Settlement Status,Payout Status`).
  2. `Transactions`: Per-order ledger breakdown with settlement status badges.
  3. `Settlements`: Settlement periods, gross, fees, adjustments, net payable, and status (`PAID`, `APPROVED`, `PROCESSING`, `FAILED`).
  4. `Payouts & Destinations`: Masked destination cards, `Add Destination` modal (`M-Pesa`, `Tigo Pesa`, `Airtel Money`, `Halopesa`, `CRDB`, `NMB`, `NBC`, `KCB`, `Stanbic`), `Set Default`, `Replace` (with high-risk confirmation modal), and `Disable`.
  5. `Refunds & Disputes`: Embedded [`RefundsDisputesPanel.tsx`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/components/restaurant/RefundsDisputesPanel.tsx) for viewing refund deductions, dispute deadlines, and submitting dispute evidence (`DisputesRepository.addEvidence`).

---

## 4. Restaurant Analytics & Zero-Data Truth Discipline

### 4.1 `AnalyticsPanel.tsx` & `AnalyticsService.ts`
- **5 Telemetry Sections**:
  1. **Operational**: Total Orders, Acceptance Rate, Cancellation Rate, Average Prep Time, Average Acceptance Time, Late Order Rate, Sold-Out Item Rate, Menu Freshness Score.
  2. **Commercial**: Gross Food Sales, Net Sales, Average Order Value, Fulfillment Channel Mix (`Delivery` vs `Pickup` vs `Dine-in`).
  3. **Discovery & Conversion**: Search Impressions, Restaurant Views, Conversion Rate (`Views → Orders`), Lost Opportunities.
  4. **Menu Performance**: Top 5 Selling Dishes, Low-Converting Dishes, Unavailable-Item Demand (`86 / Sold-Out`).
  5. **Branch Performance**: Per-branch order volume, sales, prep speed, and cancellation rate.
- **Strict Zero-Data Handling**:
  - Whenever an underlying dataset has 0 rows in the selected date window, `AnalyticsService.computeRestaurantAnalytics` returns `null` for derived metrics and `AnalyticsService.formatMetric` renders `"Not enough data"` (`AnalyticsService.ZERO_DATA_LABEL`). Zero synthetic or fabricated numbers are ever displayed.

---

## 5. Verification & Test Suite Results

- **Phase 3 Test Suite ([`tests/restaurantFinancePhase3.test.ts`](file:///C:/Users/hp/Downloads/MloHub_Expo%202/MloHub_Expo/tests/restaurantFinancePhase3.test.ts))**: 46 / 46 assertions passed across all 10 required security, financial, RBAC, and zero-data analytics scenarios.
- **TypeScript Typecheck (`npx tsc --noEmit`)**: 0 errors.
- **Master Test Suite (`npm test`)**: 100% pass rate.
- **Security Suite (`npm run security:test`)**: 100% pass rate.
- **Production Preflight (`npm run production:check`)**: 100% pass rate.
