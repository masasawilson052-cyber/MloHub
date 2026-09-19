# MloHub Database Row Level Security (RLS) Matrix V2

**Document Version:** 2.1 (Stage 3 Production-Grade Hardening)  
**Database:** Supabase PostgreSQL 15+  
**Target Roles Evaluated:**
- `ANON`: Public unauthenticated visitors
- `CUSTOMER`: Authenticated customer
- `OWNER`: Primary or verified restaurant owner
- `MANAGER`: Kitchen operations manager
- `CHEF`: Head / station chef
- `STAFF`: Service staff / waiters
- `ADMIN`: Platform operations administrator
- `SUPER_ADMIN`: Executive platform administrator

---

## 1. Comprehensive Entity & Operation Access Matrix

| Table / Resource | Op | `ANON` | `CUSTOMER` | `OWNER` | `MANAGER` | `CHEF` | `STAFF` | `ADMIN` | `SUPER_ADMIN` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`profiles`** | `SEL` | ❌ | ✅ Own (`id=auth.uid()`) | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Trigger (`auth.users`) | ✅ Trigger | ✅ Trigger | ✅ Trigger | ✅ Trigger | ✅ Any | ✅ Any |
| | `UPD` | ❌ | ✅ Safe fields only* | ✅ Safe fields | ✅ Safe fields | ✅ Safe fields | ✅ Safe fields | ✅ All | ✅ All |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`restaurants`** | `SEL` | ✅ Verified | ✅ Verified | ✅ Own + Verified | ✅ Own + Verified | ✅ Own + Verified | ✅ Own + Verified | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ RPC / Onboarding | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Own (`MANAGE_RESTAURANT`) | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ❌ (Soft delete only) | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`restaurant_branches`**| `SEL` | ✅ Active | ✅ Active | ✅ Own + Active | ✅ Own + Active | ✅ Own + Active | ✅ Own + Active | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Own | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Own | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Own (if > 1 branch) | ❌ | ❌ | ❌ | ✅ | ✅ |
| **`restaurant_members`** | `SEL` | ❌ | ❌ | ✅ Own restaurant team | ✅ Own restaurant team | ✅ Own record | ✅ Own record | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Invite staff | ✅ If `MANAGE_STAFF` granted | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Manage team roles | ✅ If `MANAGE_STAFF` granted | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Remove staff (protected last owner) | ❌ | ❌ | ❌ | ✅ | ✅ |
| **`menu_categories`** | `SEL` | ✅ Active | ✅ Active | ✅ All own categories | ✅ All own categories | ✅ Own | ✅ Own | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Own restaurant | ✅ Own restaurant | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Own restaurant | ✅ Own restaurant | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Own restaurant | ✅ Own restaurant | ❌ | ❌ | ✅ | ✅ |
| **`menu_items`** | `SEL` | ✅ Active & Unarchived | ✅ Active & Unarchived | ✅ All own items | ✅ All own items | ✅ All own items | ✅ All own items | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Own restaurant | ✅ Own restaurant | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Full dish edit & price | ✅ Full dish edit & price | ⚠️ Stock/availability only | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Archive (`is_archived=TRUE`) | ✅ Archive | ❌ | ❌ | ✅ | ✅ |
| **`branch_menu_items`**| `SEL` | ✅ Active | ✅ Active | ✅ Own branch items | ✅ Own branch items | ✅ Own | ✅ Own | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Own branches | ✅ Own branches | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Branch price & stock | ✅ Branch price & stock | ⚠️ Stock/availability only | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Own branches | ✅ Own branches | ❌ | ❌ | ✅ | ✅ |
| **`menu_verifications`**| `SEL` | ✅ Public | ✅ Public | ✅ Public | ✅ Public | ✅ Public | ✅ Public | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Own dishes (`VERIFY_MENU`) | ✅ Own dishes (`VERIFY_MENU`) | ❌ | ❌ | ✅ Any | ✅ Any |
| | `UPD` | ❌ | ❌ | ❌ (Immutable) | ❌ (Immutable) | ❌ | ❌ | ❌ | ❌ |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`data_reports`** | `SEL` | ❌ | ✅ Own reports submitted | ✅ Reports for own restaurant | ✅ Reports for own restaurant | ❌ | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Submit discrepancy | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Resolve/investigate | ✅ All |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`orders`** | `SEL` | ❌ | ✅ Own orders (`user_id=auth.uid()`) | ✅ Own restaurant orders | ✅ Own restaurant orders | ✅ Own restaurant orders | ✅ Own restaurant orders | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Via `create_order_secure` RPC | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ⚠️ Cancel if PENDING | ✅ Status progression (state machine) | ✅ Status progression | ✅ Status progression (cooking/ready) | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ❌ (Forbidden) | ❌ (Forbidden) | ❌ | ❌ | ❌ | ❌ |
| **`order_items`** | `SEL` | ❌ | ✅ Line items of own orders | ✅ Line items of own orders | ✅ Line items of own orders | ✅ Line items of own orders | ✅ Line items of own orders | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Via `create_order_secure` RPC | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ (Immutable snapshots) | ❌ (Immutable snapshots) | ❌ (Immutable snapshots) | ❌ | ❌ | ❌ | ❌ |
| | `DEL` | ❌ | ❌ (Immutable snapshots) | ❌ (Immutable snapshots) | ❌ (Immutable snapshots) | ❌ | ❌ | ❌ | ❌ |
| **`reservations`** | `SEL` | ❌ | ✅ Own reservations | ✅ Own restaurant reservations | ✅ Own restaurant reservations | ✅ View reservations | ✅ View reservations | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Book table | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ⚠️ Cancel own reservation | ✅ Confirm / Seat / Cancel | ✅ Confirm / Seat / Cancel | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`custom_meal_requests`**| `SEL`| ❌ | ✅ Own requests | ✅ Active requests in city | ✅ Active requests in city | ✅ Active requests | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Create custom meal request | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ⚠️ Select quote / cancel | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`restaurant_quotes`**| `SEL` | ❌ | ✅ Quotes received on own request | ✅ Quotes offered by own restaurant | ✅ Quotes offered by own restaurant | ❌ | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ | ✅ Submit bid | ✅ Submit bid | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ | ✅ Edit own quote details | ✅ Edit own quote details | ❌ | ❌ | ✅ | ✅ |
| | `DEL` | ❌ | ❌ | ✅ Withdraw own quote | ✅ Withdraw own quote | ❌ | ❌ | ✅ | ✅ |
| **`payments`** | `SEL` | ❌ | ✅ Own payments | ✅ Payments to own restaurant | ✅ Payments to own restaurant | ❌ | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Create intent / checkout | ❌ | ❌ | ❌ | ❌ | ✅ Webhook | ✅ Webhook |
| | `UPD` | ❌ | ❌ (Status lock) | ❌ (Status lock) | ❌ (Status lock) | ❌ | ❌ | ⚠️ Webhook / Admin refund | ⚠️ |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`reviews`** | `SEL` | ✅ Published | ✅ Published | ✅ Published of own restaurant | ✅ Published of own restaurant | ✅ View | ✅ View | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Verified completed order | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ⚠️ Own review within 24h | ❌ (Cannot tamper ratings) | ❌ | ❌ | ❌ | ✅ Moderate | ✅ Moderate |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Moderate | ✅ Moderate |
| **`notifications`**| `SEL` | ❌ | ✅ Own (`user_id=auth.uid()`) | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ (System / Triggers only) | ❌ | ❌ | ❌ | ❌ | ✅ Broadcast | ✅ Broadcast |
| | `UPD` | ❌ | ✅ Mark own as read | ✅ Mark own as read | ✅ Mark own as read | ✅ Mark own as read | ✅ | ✅ | ✅ |
| | `DEL` | ❌ | ✅ Clear own | ✅ Clear own | ✅ Clear own | ✅ Clear own | ✅ | ✅ | ✅ |
| **`restaurant_applications`**| `SEL`| ❌ | ✅ Own application | ✅ Own application | ❌ | ❌ | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ✅ Submit application | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| | `UPD` | ❌ | ❌ (Status lock) | ❌ | ❌ | ❌ | ❌ | ✅ Approve/Reject RPC | ✅ All |
| | `DEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **`audit_logs`** | `SEL` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ All | ✅ All |
| | `INS` | ❌ | ❌ (Trigger / RPC only) | ❌ | ❌ | ❌ | ❌ | ⚠️ Via RPC | ⚠️ Via RPC |
| | `UPD` | ❌ | ❌ (Permanently immutable) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | `DEL` | ❌ | ❌ (Permanently immutable) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*\*Safe fields on `profiles` include: `full_name`, `phone`, `avatar_url`, `avatar_emoji`, `preferred_language`, `language`, `location`, `delivery_address`, `neighborhood`, `dietary_preferences`. Privilege fields (`role`, `roles`, `account_type`, `status`, `is_phone_verified`, `is_email_verified`) are protected by trigger `trg_protect_profile_privileged_fields`.*

---

## 2. Storage Bucket Isolation Matrix

| Bucket Name | Access | Upload Policy (`INSERT`) | Read Policy (`SELECT`) |
| :--- | :--- | :--- | :--- |
| **`restaurant-images`** | Public Read | `has_restaurant_permission(auth.uid(), foldername[1], 'MANAGE_RESTAURANT') OR is_admin(auth.uid())` | Public |
| **`menu-images`** | Public Read | `has_restaurant_permission(auth.uid(), foldername[1], 'MANAGE_MENU') OR is_admin(auth.uid())` | Public |
| **`profile-images`** | Public Read | `foldername[1] = auth.uid()::text` | Public |
| **`verification-documents`**| **Private** | `foldername[1] = auth.uid()::text` | `foldername[1] = auth.uid()::text OR is_admin(auth.uid())` |
