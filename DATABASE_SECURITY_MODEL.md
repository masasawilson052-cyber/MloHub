# MloHub Database Security Model & Tenant Isolation Architecture

## 1. Executive Summary

This document specifies the **Stage 3 Production-Grade Database Security, Tenant Isolation, and Role-Based Access Control (RBAC)** architecture for MloHub.

In previous prototype iterations, security checks were partially handled at the client level or in in-memory storage. In Stage 3, the database (PostgreSQL via Supabase) is the **enforcing authority** and **single source of truth**. All data boundaries, tenant segregation, financial order pricing, review integrity, and privilege limits are secured through Row Level Security (RLS) policies, PostgreSQL triggers, locked security-definer stored procedures, and database-level check constraints.

---

## 2. Core Trust Boundaries & Zero-Trust Principles

```
┌────────────────────────────────────────────────────────┐
│             Untrusted Client (Expo / Web)              │
│  - Never trusted for prices, subtotals, or fees        │
│  - Never trusted for role or status escalations        │
│  - Never trusted for cross-tenant access               │
└──────────────────────────┬─────────────────────────────┘
                           │ (JWT with claims: sub, aud)
                           ▼
┌────────────────────────────────────────────────────────┐
│          Supabase Gateway & PostgREST / GoTrue         │
│  - Authenticates JWT, extracts auth.uid()              │
│  - Attaches request context to PostgreSQL session      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            PostgreSQL Security Enforcement Layer       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Row Level Security (RLS)                         │  │
│  │ - Tenant isolation by restaurant_id & user_id    │  │
│  │ - Role-based SELECT / INSERT / UPDATE / DELETE   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Database Triggers                                │  │
│  │ - Profile Privilege Protection Trigger           │  │
│  │ - Sole Active Owner Deletion Protection Trigger  │  │
│  │ - Order Item Immutability Trigger                │  │
│  │ - Order Lifecycle State Machine Trigger          │  │
│  │ - Verified Review Prerequisite Trigger           │  │
│  │ - Payment Status Mutation Lock Trigger           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Locked SECURITY DEFINER RPC Functions            │  │
│  │ - SET search_path = public, pg_temp;             │  │
│  │ - Zero-trust create_order_secure                 │  │
│  │ - Privileged Admin Actions (approve/suspend/role)│  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Trust Boundary Rules:
1. **Zero-Trust Pricing**: Clients **cannot** dictate line-item unit prices, order subtotals, platform service fees (1,500 TZS), or delivery fees (2,500 TZS). All price calculations occur server-side inside `create_order_secure` reading directly from verified catalog tables (`branch_menu_items` / `menu_items`).
2. **Snapshot Immutability**: Historical order items and payment records are immutable. Once placed, line prices cannot be mutated, even by restaurant owners.
3. **Privilege Boundary**: `profiles.role`, `profiles.roles`, `profiles.account_type`, and `profiles.status` cannot be altered by normal users.
4. **Tenant Isolation Boundary**: A restaurant member or owner has zero read or write access to private records belonging to other restaurants.

---

## 3. Platform Roles vs. Restaurant Membership Roles

MloHub strictly separates **Platform-Level Roles** from **Restaurant Tenant Roles**.

### 3.1 Canonical Platform Roles
Stored on `public.profiles` (`role`, `roles[]`):

| Role | Scope | Capabilities |
| :--- | :--- | :--- |
| `CUSTOMER` | Public / Platform | Browse verified restaurants, build cart, place orders, book tables, review completed meals. |
| `RESTAURANT` | Platform Vendor | Base account type required to hold restaurant memberships. Can switch into restaurant workspaces. |
| `ADMIN` | Platform Operations | Review applications, manage catalog verifications, view aggregate metrics, support resolution. |
| `SUPER_ADMIN` | Platform Executive | Full governance: platform role promotions, suspension override, emergency locks. |

### 3.2 Canonical Restaurant Membership Roles
Stored on `public.restaurant_members` (`role`, `permissions[]`):

| Role | Hierarchy | Capabilities |
| :--- | :--- | :--- |
| `OWNER` | Level 1 (Full) | Sole or co-owner. Manage banking/payouts, hire/fire staff, manage menu, view financials, configure branch. |
| `MANAGER` | Level 2 | Operational manager. Manage menu, handle order flow, manage reservations, view analytics. Cannot delete owner. |
| `CHEF` | Level 3 | Kitchen lead. View order queue, update kitchen preparation status, toggle menu item availability. |
| `STAFF` | Level 4 | Floor / front desk. View orders and reservations, confirm customer pickup. |

### 3.3 Granular Restaurant Permissions
Members can be granted fine-grained permissions:
- `VIEW_DASHBOARD`, `VIEW_ORDERS`, `MANAGE_ORDERS`
- `VIEW_MENU`, `MANAGE_MENU`, `VERIFY_MENU`
- `VIEW_RESERVATIONS`, `MANAGE_RESERVATIONS`
- `VIEW_REVIEWS`, `MANAGE_STAFF`
- `VIEW_ANALYTICS`, `VIEW_FINANCIALS`, `MANAGE_PAYOUTS`, `MANAGE_SETTINGS`

---

## 4. Helper Authorization Functions

All helper functions run with explicit `SET search_path = public, pg_temp;` to mitigate search-path hijacking.

```sql
-- Check platform admin
public.is_admin(p_user_id UUID) RETURNS BOOLEAN
public.is_super_admin(p_user_id UUID) RETURNS BOOLEAN

-- Check restaurant tenant membership
public.is_restaurant_member(p_user_id UUID, p_restaurant_id UUID) RETURNS BOOLEAN

-- Check canonical restaurant role
public.has_restaurant_role(p_user_id UUID, p_restaurant_id UUID, p_allowed_roles TEXT[]) RETURNS BOOLEAN

-- Check restaurant permission
public.has_restaurant_permission(p_user_id UUID, p_restaurant_id UUID, p_permission TEXT) RETURNS BOOLEAN
```

---

## 5. Security Triggers & Protection Mechanisms

### 5.1 Profile Privilege Protection (`trg_protect_profile_privileged_fields`)
- Trigger: `BEFORE UPDATE ON public.profiles`
- Invariant: A user updating their own profile (`auth.uid() = id`) cannot modify `role`, `roles`, `account_type`, `status`, `is_identity_verified`, or `is_phone_verified`.
- Only callers passing `public.is_admin(auth.uid())` may modify these fields.

### 5.2 Sole Active Owner Protection (`trg_protect_restaurant_membership`)
- Trigger: `BEFORE DELETE OR UPDATE ON public.restaurant_members`
- Invariant: If a member being deleted, demoted, or deactivated is the **last active `OWNER`** of a restaurant, the operation is blocked:
  `Cannot delete or deactivate the last active OWNER of a restaurant.`

### 5.3 Order Lifecycle State Machine (`trg_check_order_status_transition`)
- Trigger: `BEFORE UPDATE OF status ON public.orders`
- Permitted transitions:
  - `PENDING` ➔ `ACCEPTED` | `CONFIRMED` | `CANCELLED` | `REJECTED`
  - `ACCEPTED` ➔ `PREPARING` | `CANCELLED`
  - `CONFIRMED` ➔ `PREPARING` | `CANCELLED`
  - `PREPARING` ➔ `READY` | `CANCELLED`
  - `READY` ➔ `OUT_FOR_DELIVERY` | `COMPLETED` | `CANCELLED`
  - `OUT_FOR_DELIVERY` ➔ `COMPLETED` | `CANCELLED`
  - Terminal statuses: `COMPLETED`, `CANCELLED`, `REJECTED` cannot transition to any status.

### 5.4 Order Line-Item Snapshot Immutability (`trg_prevent_order_items_tampering`)
- Trigger: `BEFORE UPDATE OR DELETE ON public.order_items`
- Invariant: Order items cannot be deleted, and unit prices / subtotals cannot be changed once an order has progressed beyond `PENDING`.

### 5.5 Verified Review Ownership (`trg_verify_review_eligibility`)
- Trigger: `BEFORE INSERT OR UPDATE ON public.reviews`
- Invariant:
  1. Rating must be an integer between 1 and 5.
  2. The reviewer (`customer_id`) must have a corresponding order with `status = 'COMPLETED'` at the specified restaurant.
  3. Reviews can only be updated within 24 hours of creation.

### 5.6 Payment Status Lock (`trg_protect_payment_status`)
- Trigger: `BEFORE UPDATE ON public.payments`
- Invariant: Non-admin users cannot alter payment statuses (`COMPLETED`, `FAILED`, `REFUNDED`).

---

## 6. Server-Side Zero-Trust Order Pricing Engine

Function: `public.create_order_secure(p_branch_id, p_dining_option, p_delivery_address, p_notes, p_items)`

### Execution Flow:
1. Resolves `auth.uid()` from session.
2. Looks up `restaurant_id` from the specified `branch_id`.
3. Validates restaurant is `is_active = TRUE` and `verification_status != 'SUSPENDED'`.
4. Iterates over submitted items:
   - Queries `branch_menu_items` and `menu_items` for the current verified item price.
   - Verifies item availability (`is_available = TRUE`).
   - Multiplies unit price by quantity to calculate item line total.
   - Accumulates trusted `subtotal_tzs`.
5. Computes fixed platform fees:
   - `service_fee_tzs = 1500` (1,500 TZS fixed platform fee)
   - `delivery_fee_tzs = 2500` (if `dining_option = 'Delivery'`)
   - `total_tzs = subtotal_tzs + service_fee_tzs + delivery_fee_tzs`
6. Inserts immutable records into `orders` and `order_items` within a single atomic PostgreSQL transaction.
7. Logs audit trail in `audit_logs`.
8. Returns created order record.

---

## 7. Privileged Operations & Administration RPCs

All privileged functions require admin role verification and execute with locked `search_path`:

| Function | Minimum Role | Effect |
| :--- | :--- | :--- |
| `approve_restaurant_application(p_application_id, p_reviewer_notes)` | `ADMIN` | Approves application, activates restaurant, creates primary `OWNER` membership. |
| `reject_restaurant_application(p_application_id, p_rejection_reason)` | `ADMIN` | Rejects application with feedback to vendor. |
| `suspend_restaurant(p_restaurant_id, p_reason)` | `ADMIN` | Deactivates restaurant and all active branches, sets status to `SUSPENDED`. |
| `reactivate_restaurant(p_restaurant_id)` | `ADMIN` | Restores active status for compliant vendor. |
| `change_platform_role(p_target_user_id, p_new_role, p_roles)` | `SUPER_ADMIN` | Modifies user platform privileges with audit logging. |

---

## 8. Storage Bucket Tenant Isolation

Storage buckets use folder-path matching in RLS:

| Bucket | Path Pattern | Read Policy | Write Policy |
| :--- | :--- | :--- | :--- |
| `restaurant-images` | `{restaurantId}/*` | Public | Members with `MANAGE_SETTINGS` or `ADMIN` |
| `menu-images` | `{restaurantId}/*` | Public | Members with `MANAGE_MENU` or `ADMIN` |
| `profile-images` | `{auth.uid()}/*` | Public | Owner of folder (`auth.uid() = folder`) |
| `verification-documents` | `{restaurantId}/*` | Restaurant Members & `ADMIN` | Restaurant Members & `ADMIN` |

---

## 9. Soft-Delete and Financial Data Preservation

To maintain compliance and financial auditability:
- **Restaurants & Branches**: Never hard-deleted if historical orders exist. Marked `is_active = FALSE`.
- **Orders & Payments**: No `ON DELETE CASCADE` from parent restaurant to orders or payments. Financial records remain preserved for statutory accounting.
- **Audit Logs**: Append-only table. Deletions and updates are strictly prevented.
