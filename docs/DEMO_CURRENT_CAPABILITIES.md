# MloHub Official Capabilities Matrix & Architecture Truth

**Current Demonstration Build**: Production Supabase Backend Ready  
**Date**: September 2026  
**Audience**: Stakeholders, Presenters, Reviewers, Engineering Team  

---

## 1. Executive Overview

This document defines the exact capabilities, boundary conditions, and authoritative behaviors implemented in the MloHub demonstration application. Every feature documented below has been verified through automated test suites (1585 tests passing) and code-level architectural invariant audits.

---

## 2. Capability Matrix Across Portals

| Capability / Flow | Portal / Subsystem | Status | Authoritative Implementation | Boundary / Guard |
| :--- | :--- | :--- | :--- | :--- |
| **Dish Discovery & Search** | Customer | **LIVE** | Real-time restaurant & menu querying with neighborhood and dietary filtering. | Only published restaurants with active branches & priced dishes appear. |
| **Standard Menu Ordering** | Customer | **LIVE** | `OrderService.submitStandardMenuOrder()` invokes `create_order_secure` RPC. | Requires valid `branchId`. Single-branch & single-restaurant cart enforced. Zero client price overrides. |
| **Mobile Money Checkout** | Customer / Checkout | **LIVE** | Mobile Money (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa) via `PaymentCheckoutModal`. | CARD & COD purged. Authoritative amounts locked to database rows. |
| **Customer Orders Progress** | Customer | **LIVE** | Canonical statuses: `PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`. | No fabricated courier GPS pins or synthetic riders. Attributed to restaurant fulfillment. |
| **Table Reservations & Holds** | Customer & Partner | **LIVE** | `ReservationRepository.create()` with table hold reservation engine. | Exact deposit amount collected; zero client-side double discounts. |
| **Custom Meals (Bespoke)** | Customer & Partner | **LIVE** | Wizard inquiry -> private restaurant quote -> customer payment -> canonical order conversion. | Quote conversion calls `convert_custom_meal_to_order` RPC. Fulfillment mode preserved. |
| **Customer Saved Favorites** | Customer | **DEFERRED** | Local preference caching removed; returns empty array in real mode pending cloud sync. | Prevents synthetic persistence. |
| **Notification Preferences** | Customer | **LIVE** | Persisted to `notification_preferences` table via `NotificationPreferencesRepository`. | Reverts state on failure; `clearAll` uses `Promise.allSettled`. |
| **Restaurant Onboarding** | Admin & Partner | **LIVE** | Vendor application submission -> Admin approval -> Portal activation. | Approving an application sets status to APPROVED; restaurant remains unpublished until branch & priced items are added. |
| **Kitchen Operations & Queue** | Restaurant Partner | **LIVE** | Real-time Kanban board: `IncomingOrdersPanel` tracks orders by payment status. | Unpaid pending orders are badged "Awaiting Payment" and accept button is disabled until payment is verified. |
| **Branch Operational Modes** | Restaurant Partner | **LIVE** | Immediate operating override (`OPEN`, `BUSY`, `PAUSED`, `CLOSED`) and daily hours schedule. | Wires directly to `BranchOperationsRepository.setBranchOperationalMode` for the selected branch. |
| **Restaurant Discovery Analytics** | Restaurant Partner | **LIVE** | Measured revenue, completed order AOV, menu freshness score, and stock availability alerts. | Unmeasured search appearances and multiplier formulas completely purged. |
| **Review Responses** | Restaurant Partner | **LIVE** | Merchant response to diners calls `ReviewResponsesRepository.respond` RPC. | Persists securely to database; reloads active workspace. |
| **Staff Team Management** | Restaurant Partner | **PILOT READ-ONLY** | Role inspection (`OWNER`, `MANAGER`, `STAFF`) with Last-Owner protection. | Staff invitation creation disabled in pilot build to avoid client-side privilege escalation. |
| **Payments Supervision** | Admin Console | **LIVE** | Read-only surveillance of transactions, references, and amounts via `PaymentsMonitor`. | Displays `Captured Volume` and live gateway probe status; 10% commission calculation formula purged. |
| **System Health Probes** | Admin Console | **LIVE** | Live HTTP probe to database endpoint, RLS status audit, adapter configuration check. | Fail-closed: unverified services marked `CONFIGURED (UNVERIFIED)`. |
| **Platform Settings & Policies**| Admin Console | **LIVE** | Centralized fee structures from `config/platformFees.ts`. | Pilot zones explicitly labeled `PLANNING REFERENCE (NOT LIVE COVERAGE)`. |

---

## 3. Financial & Fee Invariants

- **Platform Commission Rate**: 10% (`FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE = 0.10`).
- **Customer Service Fee**: 1,500 TZS fixed (`FINANCIAL_CONFIG.SERVICE_FEE_TZS = 1500`).
- **Standard Delivery Fee**: 2,500 TZS intra-zone (`FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS = 2500`).
- **Zero Client Overwrite**: All totals, fees, and order line items are calculated server-side inside PostgreSQL transactions.

---

## 4. Security & Isolation Boundaries

1. **Zero Elevated Keys in Client**:
   - `SUPABASE_SERVICE_ROLE_KEY` and `supabaseAdmin` are completely banned and absent from all client bundles and repository code.
2. **Fail-Closed Workspace Switching**:
   - If switching workspaces fails (e.g. invalid membership or network error), navigation is terminated and an error screen is displayed.
3. **Registration Purity**:
   - Customer and restaurant registration forms initialize with empty strings and un-ticked agreement terms; zero pre-filled fake data.
4. **Decoupled Architecture**:
   - Customer and Restaurant Partner portals do not share mutable memory contexts. The Restaurant Portal operates strictly against PostgreSQL repositories and RLS policies.
