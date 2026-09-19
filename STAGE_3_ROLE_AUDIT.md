# STAGE 3: ROLE AND PERMISSION AUDIT (STAGE_3_ROLE_AUDIT.md)

**Document Version:** 1.0  
**Application:** MloHub Mobile & Web (Expo / React Native)  
**Date:** September 16, 2026  

---

## 1. Executive Summary

This audit documents every role, account type, and workspace identifier currently present across the MloHub codebase (`types/auth.ts`, `types/domain.ts`, `db/types.ts`, `context/AuthContext.tsx`, `db/auth/guards.ts`, `db/auth/service.ts`, Supabase SQL migrations, and UI portals).

### Canonical Model Defined for Stage 3:
1. **Canonical Platform Roles (`PlatformRole`):**
   - `CUSTOMER`: End consumer discovering restaurants, ordering food, reserving dining tables, and bidding for custom meals.
   - `RESTAURANT`: Food vendor entity representing kitchen businesses, informal food spots, and restaurants.
   - `ADMIN`: Platform operational administrator moderating menus, resolving customer reports, and verifying vendors.
   - `SUPER_ADMIN`: Executive platform administrator with complete system access, role grants, and destructive control.

2. **Canonical Restaurant Membership Roles (`RestaurantRole`):**
   - `OWNER`: Primary or co-owner with full business, staff management, and financial control.
   - `MANAGER`: Operational manager handling orders, menus, verification, reservations, reviews, and analytics.
   - `CHEF`: Kitchen lead handling incoming orders, preparation status, menu views, and reservations.
   - `STAFF`: Front-of-house / service team viewing orders, menus, and reservations.

---

## 2. Inconsistent Role Values Identified

| File / Component | Role Value(s) Found | Classification | Issue & Resolution |
| :--- | :--- | :--- | :--- |
| `db/types.ts` | `UserRole.RESTAURANT_OWNER`, `UserRole.RESTAURANT_STAFF` | **Legacy Composite** | Conflates platform role (`RESTAURANT`) with tenant membership role (`OWNER` / `STAFF`). Retained as backward-compatibility aliases while introducing canonical `PlatformRole` and `RestaurantRole`. |
| `db/types.ts` | `WorkspaceType.RESTAURANT_OWNER` | **Legacy Workspace** | Workspace named `RESTAURANT_OWNER` instead of generic `RESTAURANT`. Maintained for client route compatibility. |
| `types/auth.ts` | `AccountType` vs `UserRole` | **Dual Identity** | `UserProfile` had both `accountType: AccountType` ('RESTAURANT') and `role: UserRole` ('RESTAURANT_OWNER'). Unified under canonical types. |
| `supabase/migrations/20260908000001` | `user_role_enum` | **Database Enum** | Enum defined with `'RESTAURANT_OWNER'` and `'RESTAURANT_STAFF'`. Migration 3 maps these cleanly to `RESTAURANT` platform role while using `restaurant_members.role` for tenant RBAC. |
| `supabase/migrations/20260916000001` | `handle_new_user()` | **Registration Trigger** | Handled `RESTAURANT` and `RESTAURANT_OWNER` metadata. Hardened to enforce `CUSTOMER` and `RESTAURANT` only (preventing `ADMIN` self-assignment). |
| `db/auth/guards.ts` | Hardcoded `OWNER` / `STAFF` | **Incomplete Membership** | Guards previously checked only `OWNER` or `STAFF`, omitting `MANAGER` and `CHEF`. Updated to support all 4 canonical roles. |
| `app/restaurant-portal/` | `OWNER`, `CHEF`, `WAITER` | **UI Role Mismatch** | UI contained references to `WAITER` and `CHEF`. Aligned with canonical `STAFF` and `CHEF`. |

---

## 3. Canonical Permission Matrix for Restaurant Roles

| Permission Identifier | Description | `OWNER` | `MANAGER` | `CHEF` | `STAFF` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `VIEW_DASHBOARD` | View kitchen portal home & metrics summary | ✅ | ✅ | ✅ | ✅ |
| `VIEW_ORDERS` | View incoming and historical customer orders | ✅ | ✅ | ✅ | ✅ |
| `MANAGE_ORDERS` | Accept, update cooking status, dispatch riders | ✅ | ✅ | ✅ | ❌ |
| `VIEW_MENU` | View active and archived menu items & categories | ✅ | ✅ | ✅ | ✅ |
| `MANAGE_MENU` | Add, edit dishes, adjust base prices, toggle availability | ✅ | ✅ | ❌ (availability only) | ❌ |
| `VERIFY_MENU` | Perform official restaurant price/freshness verification | ✅ | ✅ | ❌ | ❌ |
| `VIEW_RESERVATIONS` | View customer dining reservations & party sizes | ✅ | ✅ | ✅ | ✅ |
| `MANAGE_RESERVATIONS`| Confirm, seat, or cancel dining reservations | ✅ | ✅ | ❌ | ❌ |
| `VIEW_REVIEWS` | Read customer reviews and ratings | ✅ | ✅ | ❌ | ❌ |
| `VIEW_ANALYTICS` | View sales trends, popular dishes, neighborhood stats | ✅ | ✅ | ❌ | ❌ |
| `VIEW_EARNINGS` | View payout phone numbers, net balances, commissions | ✅ | ✅ | ❌ | ❌ |
| `MANAGE_STAFF` | Invite, assign roles to, or remove kitchen team members | ✅ | ❌* | ❌ | ❌ |
| `MANAGE_RESTAURANT` | Edit business profile, Lipa numbers, branches, hours | ✅ | ❌ | ❌ | ❌ |

*\*Note: Managers may only manage staff if the primary Owner explicitly grants the `MANAGE_STAFF` permission in their membership record.*

---

## 4. Enforcement Architecture

1. **Database-Level Helper Functions (PostgreSQL):**
   - `public.is_restaurant_member(user_id uuid, target_restaurant_id varchar)`: Evaluates whether user holds ANY active membership (`OWNER`, `MANAGER`, `CHEF`, `STAFF`) with `is_active = TRUE`.
   - `public.has_restaurant_role(user_id uuid, target_restaurant_id varchar, allowed_roles varchar[])`: Checks whether user holds one of the specified membership roles.
   - `public.has_restaurant_permission(user_id uuid, target_restaurant_id varchar, permission varchar)`: Checks whether user has the explicit permission, falling back to role-based defaults.
2. **Server-Side Security Definer Security:**
   - All helper functions set `search_path = public, pg_temp;` to prevent search path hijacking.
   - Zero reliance on client-supplied permission arrays. All permissions are verified in PostgreSQL.
