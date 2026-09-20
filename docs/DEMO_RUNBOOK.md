# MloHub Official Demonstration Runbook & Presentation Guide
**Target Date**: Live Presentation Day
**Platform**: Expo / React Native (Customer, Restaurant Partner Portal, Admin Governance Console)
**Backend Authority**: PostgreSQL 16 + Supabase RLS + Server RPCs

---

## 1. Executive Summary & Demonstration Principles

MloHub is an end-to-end multi-tenant food discovery, ordering, table booking, custom meal, and kitchen operations platform specifically built for the Tanzanian culinary ecosystem (Dar es Salaam pilot).

### Core Truth Principles for Presenters:
1. **Zero Fabricated Claims**: Every visible button, navigation link, and status badge maps to a real backend operation or is marked as `Deferred` / `Pilot Read-Only`.
2. **Authoritative Financials**: Commission rates (10%), Service Fee (1,500 TZS), and Delivery Fee (2,500 TZS) originate directly from `config/platformFees.ts` and PostgreSQL database schemas.
3. **No Fake Delivery Tracking**: The platform does not invent simulated courier GPS pins or driver identities. Delivery is attributed directly to merchant-managed logistics.
4. **Client Privilege Boundary**: Zero `service_role` keys or elevated admin clients exist in frontend runtime code. All operations abide by strict Row-Level Security (RLS).

---

## 2. Personas & Test Credentials

| Persona | Role | Primary Route | Recommended Test Scenario |
| :--- | :--- | :--- | :--- |
| **Amina Hamisi** | Customer / Diner | `/(tabs)` | Discovery, food ordering, custom meal submission, table booking |
| **Chef Baraka** | Restaurant Owner / Kitchen Manager | `/restaurant-portal` | Kitchen Board progression, branch status overrides, menu management, review responses |
| **System Admin** | Platform Governance Operator | `/admin` | Application approvals, payment supervision, user inspection, system audit logs |

---

## 3. Step-by-Step Demonstration Scripts

### Flow 1: Customer Discovery & Live Order Placement
1. **Launch App**:
   - Opens directly into Discovery (`Explore` tab).
   - Demonstrates local branding (MloHub logo, Swahili/English language toggle `EN`/`SW`).
2. **Filter & Search**:
   - Filter by Neighborhood (e.g., Mikocheni, Upanga, Masaki) or dietary tags.
   - Tap into a verified restaurant (e.g., *Swahili Bistro*).
3. **Menu & Cart Checkout**:
   - View categorized dishes, prices in TZS, freshness badges.
   - Add dishes to cart. Note the persistent cart bottom pill.
   - Proceed to Checkout: Displays exact breakdown (Subtotal + Service Fee 1,500 TZS + Delivery Charge 2,500 TZS).
4. **Payment & Receipt**:
   - Select Mobile Money carrier (M-Pesa, Tigo Pesa, Airtel Money).
   - Authorize checkout.
   - Transition to `Orders` tab -> Displays active kitchen status progression (`PENDING` -> `ACCEPTED` -> `PREPARING` -> `READY`).
   - Open Digital Receipt modal: Displays immutable payment reference and amount.

---

### Flow 2: Custom Meals (Direct Merchant Quoting)
1. **Submit Request**:
   - Navigate to `Custom` bottom tab.
   - Fill out custom meal wizard: occasion, dietary requirements, servings, target budget.
   - Submit request.
2. **Merchant Quote Review (Partner Portal)**:
   - Switch to `/restaurant-portal` -> `Custom Meals` tab.
   - The chef reviews customer request and inputs custom quote with prep time and price in TZS.
   - Notice: The quoted dish title is derived truthfully from the customer's request.
3. **Customer Acceptance**:
   - Customer receives in-app quote notification, reviews structured quote, and accepts or declines.

---

### Flow 3: Table Reservations & Real-Time Capacity
1. **Book Table**:
   - Select restaurant -> `Book Table` action.
   - Choose party size, date, and seating time.
2. **Reservation Status**:
   - Navigate to `Bookings` bottom tab.
   - Notice: The screen is strictly segmented into `Upcoming`, `Past`, and `Cancelled` (no duplicate top-level tabs).
   - Real-time hold expiration protects kitchen capacity.

---

### Flow 4: Restaurant Kitchen Operations (Pack 4F)
1. **Access Portal**:
   - Navigate to `/restaurant-portal` (or switch workspace to `RESTAURANT_OWNER`).
2. **Live Operating Mode**:
   - Settings tab -> Select Live Kitchen Operating Status: `OPEN`, `BUSY (Rush)`, `PAUSED`, or `CLOSED`.
   - Modifying this status executes `BranchOperationsRepository.setBranchOperationalMode` server-side.
3. **Kitchen Board**:
   - Move tickets through canonical states: `New Orders` -> `In Preparation` -> `Ready for Pickup / Dispatch`.
4. **Public Review Responses**:
   - `Reviews` tab -> Merchant writes response to diner review.
   - Submits via `ReviewResponsesRepository.respond` RPC.

---

### Flow 5: Platform Governance (Admin Console)
1. **Access Console**:
   - Route to `/admin` with `ADMIN` or `SUPER_ADMIN` privileges.
2. **Vendor Onboarding & Approval**:
   - `Applications` tab -> Review pending restaurant applications.
   - Approve application -> Modal announces `Restaurant Application Approved` and clarifies that the restaurant remains unpublished until branch and catalog setup is completed.
3. **Payments Monitor**:
   - `Payments` tab -> Displays `Captured Volume` and verified transaction counts.
   - Gateway status reflects runtime-truth badge.
4. **Audit Trail**:
   - `Audit Logs` tab -> Real-time inspection of governance actions with actor IDs and timestamps.

---

## 4. Troubleshooting & Verification Commands

Before presenting, run the automated verification suite from the terminal:

```powershell
# 1. Verify TypeScript types and compilation
npm.cmd run typecheck

# 2. Run master end-to-end invariant suite (1,585 tests)
npm.cmd test

# 3. Run demonstration readiness closure audit
npm.cmd run demo:audit
```

---

## 5. Demonstration Q&A Cheat Sheet

- **Q: How does MloHub handle delivery drivers?**  
  *A: In the current Dar es Salaam pilot build, delivery fulfillment is merchant-managed. MloHub communicates order status directly from the restaurant kitchen without inventing simulated GPS driver pins.*

- **Q: Are client apps able to tamper with prices or commissions?**  
  *A: No. All commission splits, service charges, and totals are computed and verified server-side in PostgreSQL RPCs and locked to `config/platformFees.ts`.*

- **Q: What happens if the network drops during demo?**  
  *A: In demo mode (`EXPO_PUBLIC_APP_ENV=demo`), explicit offline fallback fixtures ensure smooth presentation without application crashes.*
