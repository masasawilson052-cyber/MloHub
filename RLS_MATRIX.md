# MloHub Database Row Level Security (RLS) Matrix

**Document Version:** 2.0 (Stage 2 PostgreSQL Single Source of Truth)  
**Target Database:** Supabase PostgreSQL 15+  
**Application:** MloHub Mobile & Web (Expo / React Native)

---

## 1. Security Architecture & Threat Model

MloHub enforces server-side database isolation using PostgreSQL Row Level Security (RLS). Every query executed by the mobile/web client runs with the credentials of either an unauthenticated visitor (`anon`) or an authenticated user (`authenticated`).

The database resolves role-based authorization using two helper functions:
1. `public.is_admin(user_id uuid)`: Evaluates whether the user holds `SUPER_ADMIN` or `ADMIN` in `public.profiles.roles`.
2. `public.is_restaurant_member(user_id uuid, target_restaurant_id varchar)`: Evaluates whether an active membership row exists in `public.restaurant_members` with role `OWNER` or `STAFF`.

---

## 2. Table-by-Table Permission Matrix

| Table | Operation | Anonymous (`anon`) | Authenticated Customer | Restaurant Owner / Staff | Admin / Super Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | `SELECT` | ❌ Blocked | ✅ Own profile (`auth.uid() = id`) | ✅ Own profile | ✅ All profiles |
| | `INSERT` | ❌ Blocked | ✅ Own profile on registration (`auth.uid() = id`) | ✅ Own profile | ✅ Any profile |
| | `UPDATE` | ❌ Blocked | ✅ Own profile (`auth.uid() = id`) | ✅ Own profile | ✅ Any profile |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Super Admin |
| **`restaurants`** | `SELECT` | ✅ Verified restaurants (`is_verified = TRUE`) | ✅ Verified restaurants | ✅ Verified + Own unverified | ✅ All restaurants |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Authenticated owners | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant (`is_restaurant_member()`) | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Super Admin |
| **`restaurant_branches`** | `SELECT` | ✅ Active branches of verified restaurants | ✅ Active branches | ✅ Active + Own restaurant branches | ✅ All branches |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant branches | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant branches | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins |
| **`restaurant_members`** | `SELECT` | ❌ Blocked | ❌ Blocked | ✅ Own membership rows (`user_id = auth.uid()`) | ✅ All memberships |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Primary owner adding staff | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Primary owner managing staff | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ✅ Primary owner removing staff | ✅ Admins |
| **`menu_categories`** | `SELECT` | ✅ Active categories | ✅ Active categories | ✅ All categories of own restaurant | ✅ All categories |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant categories | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant categories | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant categories | ✅ Admins |
| **`menu_items`** | `SELECT` | ✅ Active items (`is_available = TRUE`, `is_archived = FALSE`) | ✅ Active items | ✅ All items of own restaurant | ✅ All items |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant items | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Own restaurant items | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ✅ Archive own items (`is_archived = TRUE`) | ✅ Admins |
| **`branch_menu_items`** | `SELECT` | ✅ Available branch items | ✅ Available branch items | ✅ Own branch items | ✅ All branch items |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Own branch items | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Own branch items | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ✅ Own branch items | ✅ Admins |
| **`menu_verifications`** | `SELECT` | ✅ Public audit trail | ✅ Public audit trail | ✅ Public audit trail | ✅ Full audit trail |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins only |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins only |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins only |
| **`orders`** | `SELECT` | ❌ Blocked | ✅ Own orders (`user_id = auth.uid()`) | ✅ Orders assigned to own restaurant | ✅ All orders |
| | `INSERT` | ❌ Blocked | ✅ Customer (`user_id = auth.uid()`) | ❌ Blocked | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ✅ Cancel pending orders (`status = 'CANCELLED'`) | ✅ Kitchen status progression (`ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`) | ✅ All orders |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked (Audit safety) |
| **`order_items`** | `SELECT` | ❌ Blocked | ✅ Line items of own orders | ✅ Line items of own restaurant orders | ✅ All order items |
| | `INSERT` | ❌ Blocked | ✅ Line items of own orders (`order.user_id = auth.uid()`) | ❌ Blocked | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked (Immutable snapshots) | ❌ Blocked (Immutable snapshots) | ❌ Blocked |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **`reservations`** | `SELECT` | ❌ Blocked | ✅ Own reservations (`user_id = auth.uid()`) | ✅ Reservations for own restaurant | ✅ All reservations |
| | `INSERT` | ❌ Blocked | ✅ Customer (`user_id = auth.uid()`) | ❌ Blocked | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ✅ Cancel own reservation | ✅ Update reservation status | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins |
| **`custom_meal_requests`** | `SELECT` | ❌ Blocked | ✅ Own requests (`user_id = auth.uid()`) | ✅ All active requests broadcast to chefs | ✅ All requests |
| | `INSERT` | ❌ Blocked | ✅ Customer (`user_id = auth.uid()`) | ❌ Blocked | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ✅ Select winning quote / cancel | ❌ Blocked | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins |
| **`restaurant_quotes`** | `SELECT` | ❌ Blocked | ✅ Quotes on own requests | ✅ Own quotes offered to customers | ✅ All quotes |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ✅ Chefs bidding on requests | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ✅ Update own quote details | ✅ Admins |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ✅ Withdraw own quote | ✅ Admins |
| **`payments`** | `SELECT` | ❌ Blocked | ✅ Own payments (`user_id = auth.uid()`) | ✅ Payments destined for own restaurant | ✅ All payments |
| | `INSERT` | ❌ Blocked | ✅ Customer checkout (`user_id = auth.uid()`) | ❌ Blocked | ✅ Admins / Webhooks |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Webhooks / Service Role |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **`reviews`** | `SELECT` | ✅ Published reviews | ✅ Published reviews | ✅ Published reviews of own restaurant | ✅ All reviews |
| | `INSERT` | ❌ Blocked | ✅ Customer who completed an order | ❌ Blocked | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ✅ Edit own review within 24 hours | ❌ Blocked | ✅ Moderate reviews |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins |
| **`notifications`** | `SELECT` | ❌ Blocked | ✅ Own notifications (`user_id = auth.uid()`) | ✅ Own notifications (`user_id = auth.uid()`) | ✅ Admins |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ System / Triggers / Admins |
| | `UPDATE` | ❌ Blocked | ✅ Mark own as read (`is_read = TRUE`) | ✅ Mark own as read | ✅ Admins |
| | `DELETE` | ❌ Blocked | ✅ Clear own notifications | ✅ Clear own notifications | ✅ Admins |
| **`restaurant_applications`** | `SELECT` | ❌ Blocked | ✅ Own application (`applicant_user_id = auth.uid()`) | ✅ Own application | ✅ All applications |
| | `INSERT` | ❌ Blocked | ✅ Submit onboarding application | ✅ Submit onboarding application | ✅ Admins |
| | `UPDATE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins (Approve/Reject) |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins |
| **`audit_logs`** | `SELECT` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins only |
| | `INSERT` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Admins / Service Role |
| | `UPDATE` | ❌ Blocked | ❌ Blocked (Immutable security ledger) | ❌ Blocked | ❌ Blocked |
| | `DELETE` | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |

---

## 3. Storage Bucket Policy Matrix

| Bucket Name | Purpose | Public Access | Upload Policy | Manage Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`restaurant-images`** | Restaurant storefront banners, kitchen photos, dining areas | Public Read (`anon` & `authenticated`) | Authenticated Restaurant Owners / Admins | Restaurant Owner & Admin |
| **`menu-images`** | Food item photos, dishes, beverages, freshness checks | Public Read (`anon` & `authenticated`) | Authenticated Restaurant Owners / Admins | Restaurant Owner & Admin |
| **`profile-images`** | Customer & Chef avatars | Public Read (`anon` & `authenticated`) | Authenticated User (own path `/avatars/{userId}/*`) | Owner of avatar (`auth.uid()`) |
| **`verification-documents`** | TIN certificates, BRELA licenses, NIDA IDs | ❌ Private (No public read) | Authenticated Vendor Applicant | Admins & Compliance Officers |

---

## 4. Key Security Invariants Enforced by RLS

1. **Strict Customer Privacy:** Customers can NEVER query orders, reservations, or payment details belonging to other customers.
2. **Tenant Restaurant Isolation:** Restaurant staff/owners can NEVER query incoming orders, revenue, payout phone numbers, or analytics belonging to another restaurant.
3. **Immutable Receipts:** In `order_items`, `item_name_snapshot` and `price_snapshot` cannot be modified after initial insert, preventing retrospective audit falsification if a restaurant changes prices later.
4. **Zero Client Security Bypass:** When `isSupabaseConfigured()` is enabled, all authorization checks take place inside the PostgreSQL kernel using `auth.uid()`, preventing client tampering.
