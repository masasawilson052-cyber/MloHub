# MLOHUB — RESTAURANT FINAL CLOSURE PASS 1 OF 2
## DATABASE AUTHORITY + DOCUMENT VERIFICATION + PAYOUT VERIFICATION + FAIL-CLOSED SECURITY

**Date**: 2026-09-29  
**Status**: COMPLETE (Pass 1 of 2)  
**Branch**: `feat/final-appearance-theme-closure`  
**Target Project**: MloHub Expo (`C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo`)

---

## 1. Executive Summary

This report documents the completion of **Pass 1 of 2: Restaurant Final Closure**. This pass resolves the remaining authority, verification, and fail-closed security gaps across the MloHub restaurant domain without redesigning or altering existing functionality.

All existing capabilities—including Two-Gate Onboarding, Private Merchant Documents, Gate B Launch Review, Kitchen Kanban, Modifiers, Finance Workspace, Encrypted Payouts, Strict Customer Visibility, Mobile Navigation, and Map/GPS Branch Selection—have been preserved and reinforced with strict database-level authority and fail-closed runtime behaviors.

---

## 2. Database Authority & Integrity Migration

A single authoritative migration was created:
`supabase/migrations/20260928000600_restaurant_authority_verification_closure.sql`

### 2.1 Direct Self-Publish & Self-Verify Blocked by Database Authority
- **Trigger Function**: `public.protect_restaurant_authority_fields()` attached via `BEFORE UPDATE ON public.restaurants`.
- **Enforcement**: Blocks any non-admin or non-service-role direct mutation of:
  - `owner_id`
  - `is_verified`
  - `verification_status`
  - `launch_status`
  - `is_published`
  - `seller_tier`
  - `archived_at`
  - `archive_reason`
- **Result**: Restaurants cannot self-publish or self-verify via direct table updates; transitions must occur through authoritative server-side RPCs.

### 2.2 Gate B Publication Authority
- **RPC**: `public.approve_restaurant_launch(p_restaurant_id UUID)`
- **Security**: Defined with `SECURITY DEFINER`, sets `search_path = public, pg_temp`, and requires platform administrator authorization with MFA/AAL2 (`require_admin_aal2(auth.uid())`).
- **Atomicity**: Validates all Gate B launch readiness checks, transitions `launch_status` to `'PUBLISHED'`, sets `is_published = TRUE`, and writes an immutable audit log entry.

### 2.3 Branch Identity & Coordinates Role Gating
- **Policy**: `"Restaurant owners managers and admins manage branches"` on `public.restaurant_branches`.
- **Enforcement**: Restricts insert, update, and delete operations on branch records (including GPS coordinates, addresses, and physical identity) strictly to restaurant members with role `'OWNER'` or `'MANAGER'`, or platform administrators.
- **Roles Blocked**: Operational roles such as `'CHEF'` and `'STAFF'` are strictly forbidden from modifying branch GPS location, address, or metadata.

### 2.4 Document Verification Authority & Mandatory Rejection Reason
- **RPC**: `public.review_restaurant_verification_document(p_document_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL)`
- **Security**: Requires platform administrator privilege and AAL2 session verification.
- **Validation**:
  - Restricts `p_decision` strictly to `'VERIFIED'` or `'REJECTED'`.
  - When `p_decision = 'REJECTED'`, `p_reason` is strictly required to be non-empty.
- **Audit**: Writes an immutable audit entry to `public.admin_audit_logs`.

### 2.5 Gate A Document Verification Prerequisite
- **RPC**: `public.approve_restaurant_application(p_application_id VARCHAR)`
- **Integrity**: Enforces that all three required document types (`BUSINESS_LICENSE`, `TIN_DOCUMENT`, and `FOOD_OPERATION_DOCUMENT`) are uploaded and marked `verification_status = 'VERIFIED'` with non-null `reviewed_by` and `reviewed_at`.
- **Protection**: Raw text TIN entries without an accompanying verified TIN document are rejected with an explicit error.

### 2.6 Payout Destination Review & Encryption Invariant
- **RPC**: `public.review_payout_destination_secure(p_destination_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL, p_verification_reference TEXT DEFAULT NULL, p_verified_account_name TEXT DEFAULT NULL)`
- **Security**: Requires platform administrator privilege and AAL2 session verification.
- **Invariant**: Payout destination verification is strictly blocked unless `encrypted_account_reference` contains a valid encrypted secret starting with the `'pgp:v1:'` prefix. Rejection strictly requires a reason.

### 2.7 Canonical Tanzanian Phone Number Normalization
- **SQL Function**: `public.normalize_tz_phone(p_phone TEXT) RETURNS TEXT` (Deterministic / Immutable).
- **Format Normalization**: Standardizes international (`+255XXXXXXXXX`), leading zero (`07XXXXXXXX`), and plain 9-digit formats (`7XXXXXXXX`) to canonical E.164 `+255XXXXXXXXX`. Strips whitespace, hyphens, and punctuation. Returns `NULL` for invalid formats.
- **Readiness Check**: `public.get_restaurant_launch_readiness` updated to compare `normalize_tz_phone(rb.owner_phone) = normalize_tz_phone(u.phone)`, eliminating false mismatches due to formatting variations.

---

## 3. Client & Repository Hardening

### 3.1 `repositories/restaurants.repository.ts`
- **Fail-Closed Offline Behavior**: `requestLaunchCorrections` now throws `'Launch correction service unavailable'` when Supabase is offline/unconfigured, rather than faking local success.
- **Removed Fallback**: `unpublishRestaurant` now exclusively invokes `supabase.rpc('unpublish_restaurant', ...)`. The previous direct table update fallback (`.from('restaurants').update(...)`) has been completely removed.

### 3.2 `repositories/applications.repository.ts`
- **Removed Fallback**: `updateStatus` no longer falls back to direct `.from('restaurant_applications').update(...)` for `CHANGES_REQUESTED`.
- **Unsupported Mutations**: Directly rejects generic status updates with `throw new Error('Unsupported direct application status transition: ' + status)`.

### 3.3 `services/MerchantVerificationService.ts`
- **Added Client Helper**: `reviewVerificationDocument(documentId, decision, reason)` which securely delegates to `supabase.rpc('review_restaurant_verification_document', ...)`.

### 3.4 `repositories/payouts.repository.ts`
- **Added Client Helper**: `reviewDestination(destinationId, decision, options)` which securely delegates to `supabase.rpc('review_payout_destination_secure', ...)`.

### 3.5 `tests/restaurantOnboardingTwoGate.test.ts`
- **Updated Test**: Legacy Group 5 offline readiness assertions updated to expect fail-closed rejection (`'Supabase is unavailable'`) when offline, rather than asserting synthetic readiness percentages.

---

## 4. Test Verification & Results

All 4 required verification commands were executed and passed completely:

| Suite / Check | Command | Result | Details |
|---|---|---|---|
| **Pass 1 Test Suite** | `npx tsx tests/restaurantAuthorityVerificationClosure.test.ts` | **PASS** | 39 Passed, 0 Failed (15 test areas covered) |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | Clean exit (Code 0, zero compilation errors) |
| **Security Smoke Test** | `npm run security:test` | **PASS** | 34 Static Invariants + 48 Dynamic Rules Passed (Code 0) |
| **Master Test Suite** | `npm test` | **PASS** | **2,435 Passed, 0 Failed** across all test suites |

---

## 5. Modified & Created Files Summary

### Created Files
- `supabase/migrations/20260928000600_restaurant_authority_verification_closure.sql`
- `tests/restaurantAuthorityVerificationClosure.test.ts`
- `RESTAURANT_FINAL_CLOSURE_PASS_1.md`

### Modified Files
- `repositories/restaurants.repository.ts`
- `repositories/applications.repository.ts`
- `services/MerchantVerificationService.ts`
- `repositories/payouts.repository.ts`
- `tests/restaurantOnboardingTwoGate.test.ts`
- `tests/runAllSuites.ts`

---

## 6. Pass 1 Completion

Pass 1 is complete, verified, and ready for commit.
**Pass 2 must not be started until explicitly requested.**
