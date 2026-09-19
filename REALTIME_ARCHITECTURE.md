# MloHub Authoritative Realtime Architecture

## 1. System Overview
MloHub uses **Supabase PostgreSQL** and **Supabase Realtime** (`postgres_changes`) as the authoritative cloud synchronization layer connecting Customer, Restaurant, and Admin applications.

```
       [ PostgreSQL Database (Source of Truth) ]
                         │
           ┌─────────────┴─────────────┐
           │   supabase_realtime pub   │
           │  (REPLICA IDENTITY FULL)  │
           └─────────────┬─────────────┘
                         ▼
             [ Supabase Realtime Engine ]
              (WebSockets / Event Stream)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   [ Customer ]    [ Restaurant ]     [ Admin ]
  - Activity Hub  - Attention Ctr   - App Queue
  - Live Tracker  - Kitchen Board   - Fraud Rep
  - Dynamic Cart  - Menu Controls   - Health Mon
```

---

## 2. Topic & Channel Naming Conventions

| Domain Scope | Channel / Topic Pattern | PostgreSQL Source Table | Primary Event Type |
| :--- | :--- | :--- | :--- |
| **Specific Order** | `orders:<orderId>` | `orders` (WHERE `id = orderId`) | `ORDER_CREATED`, `ORDER_ACCEPTED`, `ORDER_PREPARING`, `ORDER_READY`, `ORDER_COMPLETED` |
| **Customer Orders**| `orders:customer:<customerId>` | `orders` (WHERE `customer_id = customerId`) | Order progress notifications |
| **Restaurant Orders** | `orders:restaurant:<restaurantId>` | `orders` (WHERE `restaurant_id = restaurantId`) | New incoming paid orders |
| **Admin Operations** | `orders:admin` | `orders` | Central order monitoring |
| **Menu Catalog** | `menu:<restaurantId>` | `menu_items`, `branch_menu_items` | `MENU_ITEM_UPDATED`, `MENU_PRICE_UPDATED`, `MENU_AVAILABILITY_UPDATED` |
| **Table Reservations** | `reservations:restaurant:<restaurantId>` | `reservations` | `RESERVATION_CREATED`, `RESERVATION_CONFIRMED` |
| **Custom Meals** | `custom_meals:restaurant:<restaurantId>` | `custom_meal_requests`, `restaurant_quotes` | `CUSTOM_MEAL_CREATED`, `CUSTOM_MEAL_QUOTE_CREATED` |
| **Notifications** | `notifications:<userId>` | `notifications` | `NOTIFICATION_CREATED` |
| **Governance Reports** | `reports:updates` | `data_reports` | `DATA_REPORT_CREATED`, `DATA_REPORT_RESOLVED` |

---

## 3. Canonical State Machine Invariants

1. **Strict Canonical Order Statuses**:
   `PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED -> CANCELLED / REJECTED`
   - UI display labels strictly map from these states:
     - `PENDING` ➔ "Received"
     - `ACCEPTED` ➔ "Accepted"
     - `PREPARING` ➔ "Cooking"
     - `READY` ➔ "Ready"
     - `COMPLETED` ➔ "Completed"
   - Under no circumstances are `CONFIRMED`, `COOKING`, or `DELIVERED` written to the database as order statuses.

2. **Payment Success Boundary**:
   - For customer-prepaid orders, payment confirmation sets `payment.status = 'PAID'` and updates the order's `payment_status` to `'PAID'`.
   - The order's status **remains `PENDING`**. Payment completion makes the order visible and actionable to the restaurant kitchen, but the restaurant operator must explicitly transition the order from `PENDING` to `ACCEPTED`.

3. **Audit Ledger**:
   - Every status transition is automatically tracked by PostgreSQL trigger `trg_order_status_history` into table `order_status_history`, preserving:
     - `order_id`
     - `previous_status`
     - `new_status`
     - `actor_user_id`
     - `actor_role`
     - `metadata`
     - `created_at`

---

## 4. Connection Lifecycle & Offline Reconnection

The client connection is orchestrated by `services/RealtimeService.ts` with state machine:
- `DISCONNECTED`: Initial idle state before initialization.
- `CONNECTING`: Actively establishing websocket handshake with Supabase.
- `LIVE`: Websocket connection active and operational.
- `RECONNECTING`: Re-establishing connection with exponential backoff after network drop.
- `OFFLINE`: Explicit airplane mode or offline state.

### Post-Reconnect Authoritative Database Resynchronization
When `RealtimeService` transitions back to `LIVE`, it automatically invokes all callbacks registered via `RealtimeService.registerResyncCallback(id, callback)`. This triggers:
1. `DbContext.refreshState()`: re-queries active orders and notifications.
2. `RestaurantPortal.refreshState()`: re-queries kitchen queue and menu availability.
3. `AdminPortal.loadPlatformData()`: re-queries pending vendor applications and fraud reports.

---

## 5. Security & Tenant Isolation

- **Row Level Security (RLS)**:
  - Customers can only listen to order channels matching their own `customer_id`.
  - Restaurant staff can only listen to order channels matching their active `restaurant_id`.
  - Admins can observe platform-wide governance channels.
- **Session Purging**:
  - `RealtimeService.bindAuthSession(userId, restaurantId)` cleanly unregisters and disposes of all user-scoped and tenant-scoped channel subscriptions on logout or workspace switch.
