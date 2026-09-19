# Stage 10: Authoritative Realtime Architecture Audit

## 1. Executive Summary
This audit inspects every event dispatch and synchronization channel across MloHub. The goal is to transition all critical operational flows from legacy simulated, cross-tab, or local-only event mechanisms (BroadcastChannel, local EventEmitter, in-memory Map listeners) to an authoritative cloud synchronization layer powered by **Supabase PostgreSQL** and **Supabase Realtime** (`postgres_changes`), while maintaining zero-breakage backward compatibility and deterministic sandbox execution for offline and investor demonstrations.

---

## 2. Realtime Flow Classification Matrix

| Feature / Domain Flow | Current Mechanism | Target Architecture | Classification |
| :--- | :--- | :--- | :--- |
| **New Customer Order** | `RealtimeEventEngine.publish` -> in-memory + BroadcastChannel | Supabase Realtime `postgres_changes` on `orders` (INSERT) | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Order Acceptance by Restaurant** | `RealtimeEventEngine.publish` -> in-memory Map | Supabase Realtime `postgres_changes` on `orders` (UPDATE `status = 'ACCEPTED'`) | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Kitchen Kanban Progression** | In-memory DB update + local publish | Supabase Realtime `postgres_changes` on `orders` + `order_status_history` | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Order Payment Confirmation** | Edge Function / Webhook + local publish | Postgres trigger / `payments` update -> `orders` (`payment_status = 'PAID'`) | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Custom Meal Negotiation** | Local publish to `orders:*` | Supabase Realtime on `custom_meal_requests` & `restaurant_quotes` | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Menu Price & Availability Changes**| `menu:updated` local topic | Supabase Realtime on `menu_items` & `branch_menu_items` | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Menu Verification Badge** | Direct DB update | Supabase Realtime on `menu_verifications` | `MANUAL_REFRESH` -> `SUPABASE_REALTIME` |
| **Table Reservations** | Local publish to `reservations:*` | Supabase Realtime on `reservations` | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **In-App Notifications** | Local publish to `notifications:*` | Supabase Realtime on `notifications` with client deduplication | `LOCAL_EVENT_BUS` -> `SUPABASE_REALTIME` |
| **Admin Onboarding & Fraud Reports** | Polling on mount / local events | Supabase Realtime on `restaurant_applications` & `data_reports` | `POLLING` -> `SUPABASE_REALTIME` |
| **Auth Session / Workspace Switch** | `auth:session` BroadcastChannel | Supabase Auth listener + explicit subscription teardown & resync | `BROADCAST_CHANNEL` -> `SUPABASE_REALTIME` |

---

## 3. Legacy Vulnerabilities & Architectural Deficiencies

1. **Browser-Only Cross-Tab Limitations**:
   - `BroadcastChannel` only works within the same browser instance on web. It fails across different physical devices (e.g., Customer on iPhone, Restaurant on Android tablet, Admin on desktop laptop).
2. **Missing Authoritative Postgres State**:
   - Client components were listening to ad-hoc string topics (`orders:restaurant:<id>`, `menu:updated`) with loosely formatted payload objects that did not reflect the true PostgreSQL row columns.
3. **State Machine Inconsistencies**:
   - When payment completed, some flows erroneously set `order.status = 'Confirmed'` or `'Cooking'` rather than canonical `order.status = 'PENDING'` and `order.paymentStatus = 'PAID'`.
   - In PostgreSQL, the canonical enum is:
     `PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED -> CANCELLED / REJECTED`.
4. **No Connection Lifecycle or Reconnect Resync**:
   - If a mobile handset lost cellular connectivity (e.g. going through a tunnel in Dar es Salaam), incoming websocket events were dropped with no post-reconnect query to catch up on missed state.
5. **Session Data Leak Risk**:
   - Subscriptions were not automatically purged when a user logged out or switched workspaces, potentially leaking tenant orders to previous sessions.

---

## 4. Remediation Plan

1. **Canonical Event System (`types/realtime.ts`)**:
   - Define strict TypeScript interfaces for all database table change events, payload structures, connection states, and topic naming rules.
2. **Supabase Publication & Database Triggers (`20260916000007_stage10_realtime_pipeline.sql`)**:
   - Enforce `supabase_realtime` publication for all operational tables.
   - Implement `order_status_history` ledger with automated database triggers to record all status transitions with timestamp, actor, and previous/new status.
3. **Production Realtime Service (`services/RealtimeService.ts`)**:
   - Connection state machine: `DISCONNECTED`, `CONNECTING`, `LIVE`, `RECONNECTING`, `OFFLINE`.
   - Dynamic channel multiplexing and listener registries with clean unsubscription closures.
   - Auth-aware subscription lifecycle: automatic unbind on logout/workspace switch.
   - Authoritative catch-up resync upon reconnection.
4. **Component Realtime Upgrades**:
   - Customer Activity Hub, Restaurant Attention Center, Kitchen Kanban, Explore/Discovery, Cart, Custom Meal Tab, Bookings, and Admin Governance Queues.
