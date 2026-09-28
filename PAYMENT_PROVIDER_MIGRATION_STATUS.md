# MloHub Payment Provider Migration Status

**Document Version:** 1.0  
**Current Phase:** Controlled ClickPesa → Selcom Migration  
**Active Migration State:** `SELCOM_VALIDATING`  
**Rollback Fallback State:** `CLICKPESA_LEGACY` (Gated by `ALLOW_LEGACY_CLICKPESA=true`)  
**Test Suite State:** `SANDBOX_TEST_ONLY`  

---

## 1. Migration States Definition

| State | Status | Description |
| :--- | :--- | :--- |
| `CLICKPESA_LEGACY` | **Gated for Rollback** | Legacy gateway preserved for operational rollback during active migration. Disabled unless `ALLOW_LEGACY_CLICKPESA=true`. |
| `SELCOM_VALIDATING` | **ACTIVE CURRENT STATE** | Selcom adapter built, decoupled from ClickPesa, contract mapped, validated via test fixtures and sandbox simulations. |
| `SELCOM_PRODUCTION` | **BLOCKED (Pending Credentials)** | Full production activation with live Selcom merchant traffic. Requires official credentials and merchant contract confirmation. |
| `SANDBOX_TEST_ONLY` | **Operational** | Deterministic simulation gateway used for automated test suites and isolated demo environments. |

---

## 2. Production Activation Gate

> [!CAUTION]
> ### SELCOM_PRODUCTION_ACTIVATION_BLOCKED
> **Reason**: Official Selcom merchant API contract, vendor ID, API keys, and production webhook secrets are required for the live MloHub merchant account.
>
> In accordance with MloHub security policies, public documentation or guessed endpoint contracts are **not** permitted to dictate financial transactions. Production activation remains strictly **fail-closed** (`SELCOM_CONTRACT_NOT_VERIFIED` / `SELCOM_CONFIGURATION_INCOMPLETE`) until official production credentials and onboarding sign-off are supplied.

---

## 3. Migration Checklist & Sequence

- [x] **Step 1: Rebuild Selcom Gateway Adapter**:
  - Decoupled from `ClickPesaGateway.ts`.
  - Generic Web Crypto primitives in `supabase/functions/_shared/security/crypto.ts` (`hmacSha256Hex`, `timingSafeEqualText`).
  - Strict configuration enforcement via `requireSelcomConfig()`.
  - Structured contract interfaces in `supabase/functions/_shared/payments/selcom/SelcomContract.ts`.
  - Canonical response & webhook mapping in `supabase/functions/_shared/payments/selcom/SelcomMapper.ts`.
- [x] **Step 2: Payment Gateway Factory Cutover**:
  - `PaymentGatewayFactory.getGateway()` updated to prioritize `selcom`.
  - Legacy ClickPesa requires explicit `ALLOW_LEGACY_CLICKPESA=true`.
  - Unauthorized sandbox execution in production blocked.
- [x] **Step 3: Contract & Webhook Test Fixtures**:
  - Unit tests covering push initiation, status query, signature verification, amount/currency matching, replay protection, and error mapping.
- [ ] **Step 4: Live Merchant Credential Provisioning**:
  - Merchant account onboarding with Selcom Tanzania.
  - Receipt of `SELCOM_VENDOR_ID`, `SELCOM_API_KEY`, `SELCOM_API_SECRET`, and official production base URL.
  - Webhook URL registration in Selcom merchant portal.
- [ ] **Step 5: Full ClickPesa Deprecation (Post-Acceptance)**:
  - Once live Selcom processing is certified, remove `ClickPesaGateway.ts`, ClickPesa environment variables, and ClickPesa webhook header handlers.
