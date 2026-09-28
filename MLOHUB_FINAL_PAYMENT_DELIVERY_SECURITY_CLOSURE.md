# MloHub — Final Payment, Selcom, Delivery & Security Production Closure Report

**Document Date:** September 27, 2026  
**System Phase:** Final Payment / Delivery / Security Correction Pass  
**Target Platform:** Mobile (iOS / Android Expo SDK 57) & Web (Expo Static Router)

---

## 1. Executive Summary & Verification Scorecard

In accordance with strict production-readiness criteria, every subsystem has been subjected to rigorous automated verification, database migration invariant auditing, static typing, and multi-platform compilation.

Statuses are strictly categorized according to the required taxonomy (**PASS**, **PARTIAL**, **BLOCKED**):

| Domain / Subsystem | Status | State / Verification Qualifier |
| :--- | :---: | :--- |
| **PAYMENT UX** | **PASS** | Server-authoritative state machine, polling on `AWAITING_APPROVAL` + `VERIFYING`, wallet selection authority with zero typing auto-switch, single success callback guarantee (`onFlowComplete` separation), and zero client PIN collection. |
| **DELIVERY** | **PASS** | Strict server-side route quoting via Google Routes Directions API (v2:computeRoutes). Production Haversine billing fallback removed. Customer saved addresses authoritative; branch pricing confirmation and mode checks enforced at API and database RPC level. |
| **SECURITY** | **PASS** | Mandatory Admin TOTP MFA gate with fail-closed logout on missing API capability. Database-level `require_admin_aal2()` extended across all 10 high-risk admin RPCs. Atomic PostgreSQL advisory row locking rate limiting (`consume_rate_limit`). Strict OTP purpose binding and conditional phone profile verification. Scoped CORS isolation for internal webhooks/workers. |
| **SELCOM INTEGRATION** | **PARTIAL** | Status: `SELCOM_VALIDATING`. Adapter completely decoupled from ClickPesa; contract interfaces, cryptographic signature verification, replay protection, and manual refund notices verified. Fail-closed production activation gate (`SELCOM_PRODUCTION_ACTIVATION_BLOCKED`) strictly held until live merchant agreement and production credentials are confirmed. |
| **PAYMENT LOGOS** | **PARTIAL** | Status: `MISSING_OFFICIAL_ASSETS`. Clean neutral vector fallback operational across all 4 canonical mobile money operators (Vodacom M-Pesa, Airtel Money, Mixx by Yas, HaloPesa). `assets/payments/*.png` dependency explicitly audited and documented in `PAYMENT_PROVIDER_ASSETS.md` without placeholder spoofing. |

---

## 2. Point-by-Point Correction Audit (21 Technical Points)

### Point 1: Payment Verifying State (`components/PaymentCheckoutModal.tsx`)
- **Status:** `PASS`
- **Resolution:** Updated polling condition to run when `step === 'AWAITING_APPROVAL' || step === 'VERIFYING'`. `checkStatus()` explicitly transitions state from `PROCESSING` to `VERIFYING` upon initiating poll checks. Verified payments transition to `SUCCESS` and trigger `onPaymentVerified(payment)`. Failed/cancelled responses clear timers, transition to `FAILED`, and invoke `classifyPaymentFailure()`.

### Point 2: Single Success Callback Guarantee (`components/PaymentCheckoutModal.tsx`, `components/checkout/OrderReviewModal.tsx`)
- **Status:** `PASS`
- **Resolution:** Replaced dual `onPaymentSuccess` calls with explicit decoupling. `handleSuccessContinue()` invokes `onFlowComplete?.(verifiedPayment)` when the user explicitly clicks Continue on the success screen, with fallback to `onPaymentSuccess` only when legacy compatibility is required. In `components/checkout/OrderReviewModal.tsx`, duplicate modal invocation was eliminated, retaining `onPaymentVerified` for database mutation and `onFlowComplete` for order completion modal dismissal.

### Point 3: Wallet Authority & Zero Auto-Switching (`components/PaymentCheckoutModal.tsx`, `components/checkout/PaymentRetryModal.tsx`)
- **Status:** `PASS`
- **Resolution:** Removed carrier auto-switching listeners on the phone number input field across both payment checkout and payment retry modals. Payer's manual wallet selection is authoritative and immutable to keyboard input.

### Point 4 & Point 18: Official Payment Logos & Asset Dependency (`components/payments/PaymentProviderLogo.tsx`, `PAYMENT_PROVIDER_ASSETS.md`)
- **Status:** `PARTIAL` (`MISSING_OFFICIAL_ASSETS`)
- **Resolution:** Verified file system `assets/payments/` currently contains zero third-party PNG assets. Maintained clean neutral vector fallbacks (Ionicons/MaterialCommunityIcons with operator brand color badges) in `PaymentProviderLogo.tsx`. Authored `PAYMENT_PROVIDER_ASSETS.md` recording `FOUND: (none)` and `MISSING:` (`mpesa.png`, `airtel-money.png`, `mixx-by-yas.png`, `halopesa.png`). Zero fabricated or scraped image assets were introduced.

### Point 5: Remove Production Haversine Billing Fallback (`supabase/functions/_shared/delivery/GoogleRoutesClient.ts`)
- **Status:** `PASS`
- **Resolution:** Enforced `DELIVERY_ROUTE_MODE` and `APP_ENV`. Geodesic/Haversine distance calculation is isolated strictly to simulated non-production environments (`routeMode === 'SIMULATED' && environment !== 'production'`). In production, missing Google Routes API credentials or Google API failures strictly throw `ROUTE_PROVIDER_NOT_CONFIGURED` or `ROUTE_PROVIDER_UNAVAILABLE` (HTTP 503), preventing inaccurate billing.

### Point 6: Enforce Branch Delivery Pricing Check (`supabase/functions/quote-delivery/index.ts`)
- **Status:** `PASS`
- **Resolution:** `quote-delivery` queries `branch_delivery_pricing`. If missing or errored, the Edge Function returns HTTP 503 `DELIVERY_PRICING_NOT_CONFIGURED`.

### Point 7: Reject Unconfirmed Route Pricing / Fixed-Zone Divergence (`supabase/functions/quote-delivery/index.ts`)
- **Status:** `PASS`
- **Resolution:** When `pricing_mode === 'ROUTE_DISTANCE'` and `configuration_confirmed` is `false`, the function aborts with HTTP 503 `DELIVERY_PRICING_NOT_CONFIRMED`. When `pricing_mode === 'FIXED_ZONE'`, the function returns HTTP 409 `FIXED_ZONE_PRICING_ACTIVE`, instructing the client to use zone billing.

### Point 8: Saved Address Coordinates Authority (`supabase/functions/quote-delivery/index.ts`)
- **Status:** `PASS`
- **Resolution:** Function accepts `{ branchId, savedAddressId, destinationLatitude, destinationLongitude, deliveryZoneId }`. When `savedAddressId` is supplied, it queries `public.customer_saved_addresses` ensuring `customer_id = user.id`. If missing or unowned, it returns HTTP 404 `SAVED_ADDRESS_NOT_FOUND`. Saved coordinates supersede any client-sent coordinates. `saved_address_id` and `delivery_zone_id` are persisted to `delivery_quotes`.

### Point 9: Server-Authoritative Route Order Placement (`supabase/migrations/20260927000100_route_delivery_quotes.sql`)
- **Status:** `PASS`
- **Resolution:** `public.create_order_secure` validates branch pricing mode:
  - If `ROUTE_DISTANCE`: requires `p_delivery_quote_id IS NOT NULL`, verifies quote ownership, non-expiration, branch match, and marks `consumed_at = clock_timestamp()` and `consumed_by_order_id = v_order_id`.
  - If `FIXED_ZONE`: requires `p_delivery_zone_id IS NOT NULL` and verifies active zone serving the branch.
  - Table definitions updated with `pricing_mode` on `branch_delivery_pricing` and `saved_address_id`, `delivery_zone_id` on `delivery_quotes`.

### Point 10: Production Preflight Column Fix (`scripts/production-preflight.cjs`)
- **Status:** `PASS`
- **Resolution:** Corrected `branch_delivery_pricing` table column check from non-existent `id,branch_id,base_fee_tzs` to `'branch_id,base_fee_tzs,pricing_mode,configuration_confirmed'`.

### Point 11: Atomic Database Rate Limiting (`supabase/migrations/20260927000300_atomic_rate_limits.sql`, `rateLimit.ts`)
- **Status:** `PASS`
- **Resolution:** Implemented `public.consume_rate_limit()` with `PERFORM pg_advisory_xact_lock(hashtext(p_rate_key))` and row-level locking (`FOR UPDATE`) to eliminate concurrent race conditions. `rateLimit.ts` invokes the RPC, falling closed (`allowed: false`) on errors for sensitive actions.

### Point 12: Rate-Limit `create-payment` Edge Function (`supabase/functions/create-payment/index.ts`)
- **Status:** `PASS`
- **Resolution:** Added dual rate limiting:
  1. User limit: `user:<userId>:create-payment` (max 8 hits / 60 seconds).
  2. Target limit: `target:<targetId>:create-payment` (max 4 hits / 300 seconds).
  Tripping either limit returns HTTP 429 `RATE_LIMIT_EXCEEDED` with `Retry-After` header.

### Point 13: Mandatory OTP Purpose Binding Whitelist (`supabase/functions/verify-otp/index.ts`, `send-otp/index.ts`)
- **Status:** `PASS`
- **Resolution:** Whitelisted `ALLOWED_OTP_PURPOSES = ['CUSTOMER_VERIFICATION', 'CUSTOMER_REGISTRATION', 'PASSWORD_RESET', 'LOGIN', 'VENDOR_ACTIVATION']`. Both `send-otp` and `verify-otp` require and validate this purpose. Mismatched purposes return HTTP 400 `OTP_PURPOSE_MISMATCH` and record a high-severity security audit event.

### Point 14: Conditional Profile Phone Verification (`supabase/functions/verify-otp/index.ts`)
- **Status:** `PASS`
- **Resolution:** Removed unconditional `profiles.is_phone_verified = true` updates. Only purposes in `PHONE_VERIFY_PURPOSES` (`CUSTOMER_VERIFICATION`, `CUSTOMER_REGISTRATION`) update profile verification status, preventing password reset or login codes from improperly validating unverified numbers.

### Point 15: Admin MFA Fail-Closed Gate (`components/admin/security/AdminMfaGate.tsx`)
- **Status:** `PASS`
- **Resolution:** Replaced fail-open fallback with strict fail-closed enforcement:
  `if (!supabase.auth?.mfa) { console.error('Admin MFA API unavailable'); await logout(); return; }`.

### Point 16: Extend AAL2 to All High-Risk Admin RPCs (`supabase/migrations/20260927000400_admin_aal2_complete_hardening.sql`)
- **Status:** `PASS`
- **Resolution:** Authored migration wrapping all 10 high-risk administrative and financial mutation functions with `PERFORM public.require_admin_aal2();`:
  1. `approve_restaurant_application`
  2. `reject_restaurant_application`
  3. `verify_restaurant_secure`
  4. `reactivate_restaurant_secure`
  5. `archive_restaurant_secure`
  6. `resolve_financial_dispute_secure`
  7. `update_platform_financial_settings_secure`
  8. `update_platform_operational_settings_secure`
  9. `execute_merchant_payout_rpc`
  10. `publish_platform_announcement_secure`

### Point 17: Scoped CORS Headers & Internal Worker Isolation
- **Status:** `PASS`
- **Resolution:**
  - Client-facing endpoints (`admin-system-health`, `request-refund`, `quote-delivery`, `create-payment`, `get-payment-status`, `send-otp`, `verify-otp`) use `corsHeadersFor(req)` with strict origin matching.
  - Internal worker/webhook endpoints (`payment-webhook`, `reconcile-payments`, `process-notification-outbox`) have completely removed browser wildcard CORS headers (`Access-Control-Allow-Origin: *`).

### Point 19: Selcom Live Status Verification Gate (`SelcomContract.ts`, `PAYMENT_PROVIDER_MIGRATION_STATUS.md`)
- **Status:** `PARTIAL` (`SELCOM_VALIDATING`)
- **Resolution:** Selcom integration verified under status `SELCOM_VALIDATING`. Live collection throws `SelcomContractNotVerifiedError` (`SELCOM_PRODUCTION_ACTIVATION_BLOCKED`) until live credentials and contract are provisioned.

### Point 20: Comprehensive Verification Suites & Multi-Platform Production Exports
- **Status:** `PASS`
- **Resolution:** All test suites passed without a single failure (see Section 3).

### Point 21: Final Production Closure Report
- **Status:** `PASS`
- **Resolution:** Compiled this official closure report.

---

## 3. Verification & Build Evidence

### A. TypeScript Typecheck
```
> mlohub-mobile@1.0.0 typecheck
> tsc --noEmit
Exit Code: 0 (0 errors)
```

### B. Master Automated Test Suite
```
> mlohub-mobile@1.0.0 test
> tsx tests/runAllSuites.ts

================================================================
🏁 MASTER TEST SUITE RESULTS: 2107 Passed | 0 Failed
================================================================
Exit Code: 0
```
- Includes 70 tests in `tests/paymentDeliveryClosure.test.ts`
- Includes 76 tests in `tests/paymentSecurityClosure.test.ts`

### C. Security Smoke & Static Migration Invariants Audit
```
> mlohub-mobile@1.0.0 security:test
> tsx --require ./lib/e2eBootstrap.js scripts/security-smoke-test.ts

================================================================
🏁 SECURITY SMOKE TEST SUMMARY:
   Passed Invariant Checks: 34
   Failed Invariant Checks: 0
   Live Database Status:    CONNECTED
   Security Rules Passed:   48
================================================================
Exit Code: 0
```

### D. Production Preflight Schema Audit
```
> mlohub-mobile@1.0.0 production:check
> node scripts/production-preflight.cjs

Core Schema Ready: true
Existing Tables: 200 OK
Pending Migrations (20260927000100 / 000200 / 000300 / 000400): Correctly identified for remote Supabase push
Exit Code: 0
```

### E. Multi-Platform Bundle Exports
1. **Web Static Export (`dist-final-closure-web`):**
   - 33 static routes rendered
   - Client bundle: 4.3 MB
   - Exit Code: 0
2. **Android Native Export (`dist-final-closure-android`):**
   - Hermes bytecode bundle: 6.8 MB
   - 50 static assets bundled
   - Exit Code: 0

---

## 4. Invariant Commitments Verification

- **Smart Cart Architecture:** `CartContext`, `CartInteractionProvider`, `CartMotionOverlay`, cart motion math, and restaurant menu modifiers remain **100% untouched and preserved**.
- **User Interface Philosophy:** Low checkout friction (fast mobile-money flow, clear fee breakdown, server-authoritative calculations, explicit verifying state, zero visual clutter).
- **Security Posture:** Zero client PIN collection or submission, zero client exposure of Google Maps/Routes API keys, mandatory AAL2 MFA for admin mutations, and atomic transactional advisory locks for rate limiting.
