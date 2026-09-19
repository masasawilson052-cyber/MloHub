# MloHub Stage 6: Restaurant Operating Portal Audit & Modernization Matrix

**Date**: September 2026  
**Audited File**: `app/restaurant-portal/index.tsx` (1,756 lines)  
**Milestone**: STAGE 6 — Restaurant Operating Workspace & Trust Engine  
**Status**: AUDITED (Classified into P0, P1, P2 priorities)

---

## 1. Executive Summary

The existing Restaurant Portal was built incrementally during early prototyping. While it implemented valuable business concepts (incoming orders, kitchen state transitions, and delivery PIN confirmations), it suffers from severe architectural challenges:
1. **Monolithic Complexity**: A single 1,756-line file containing the entire dashboard, orders list, kitchen transitions, menu modal, rider dispatch modal, PIN verification modal, and settings.
2. **Missing Operational Hub**: No dedicated "Needs Attention" center answering *"What needs my attention right now?"* and *"How do I keep my MloHub information accurate?"*.
3. **Missing Critical Features**:
   - No branch-specific pricing manager (`branch_menu_items`).
   - No one-tap menu freshness verification workflow.
   - No kitchen Kanban board with elapsed cooking timers.
   - No customer data report resolution center (e.g., reported wrong prices).
   - No canonical RBAC enforcement for `CHEF` and `STAFF` roles.
   - No weekly opening hours schedule editor.
   - No table reservation workspace.
4. **Design Inconsistencies**: Uses legacy styling rather than Design System V2 semantic tokens, with cramped mobile tables and un-centered desktop layouts.

---

## 2. Comprehensive Section-by-Section Audit Matrix

| Operational Area | Current State & Data Source | Deficiencies & Vulnerabilities | Desktop / Mobile Issues | Missing UX States | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1. Overview Dashboard** | Basic counter cards (`allRestaurantOrders` filter). | Only shows raw counts; no operational alert center; no verification reminders; no direct action links. | Stretches full-width on desktop; dense cards on mobile. | Missing skeletons; no contextual empty state. | **P0** |
| **2. Attention Center** | Non-existent. | Operators cannot see overdue menu verifications, unavailable items, or customer wrong-price reports. | N/A | N/A | **P0** |
| **3. Incoming Orders** | Mixed custom orders filter (`Pending Confirmation`). | Uses legacy string statuses rather than Stage 3 canonical enums (`PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`). | Card buttons wrap awkwardly on narrow mobile screens. | Missing order rejection modal with required reason. | **P0** |
| **4. Kitchen Board** | Basic tab with status advance buttons. | No Kanban columns (`Accepted`, `Cooking`, `Ready`); no elapsed cooking timers; no warning thresholds (normal/late). | Hard to tap from a kitchen counter distance. | Missing empty queue indicator; no real-time status pill. | **P0** |
| **5. Menu Manager** | Single modal for adding item (`newItemName`, `newItemPrice`). | No category reordering/archiving; no branch-specific price overrides; no bulk availability actions; no image upload progress. | Long vertical modal with no desktop split preview. | Missing category empty state; no image upload retry state. | **P0** |
| **6. Menu Verification** | Minimal price verification button in DB layer. | No one-tap "Verify Menu" flow; no stale menu price badges; no audit trail of who verified. | No responsive verification matrix. | Missing verification success dialog with next-verification date. | **P0** |
| **7. Reservations** | Not present in restaurant portal (only customer modal existed). | Restaurant owners/staff cannot view, confirm, reject, or mark table reservations completed/no-show. | N/A | Missing reservation list, slot capacity indicator, and empty state. | **P1** |
| **8. Customer Reports** | Non-existent in portal (schema exists in Stage 3). | Restaurant cannot view customer reports regarding wrong prices, incorrect hours, or closed branch. | N/A | Missing report acknowledgement and correction workflow. | **P1** |
| **9. Reviews & Responses** | Basic read-only rating display. | Restaurant cannot post an official response to customer reviews; no dimensional rating breakdown (food, service, value). | Narrow table layout. | Missing review response form and empty reviews state. | **P1** |
| **10. Earnings & Payments** | Client-side 10% estimation on gross revenue. | Not backed by database payment records; payment statuses are not partitioned; settlement states missing. | Full-width table overflows mobile screen. | Missing platform fee breakdown and payout history skeleton. | **P1** |
| **11. Analytics & Insights** | Non-existent in portal. | No discovery analytics (*"You appeared in 842 food searches this week"*); no lost opportunity tracking (*"Chicken Biryani unavailable 18 times"*). | N/A | Missing discovery analytics charts and date-range filters. | **P2** |
| **12. Staff Management** | Hidden behind generic admin tools. | No UI for inviting staff, changing roles (`OWNER`, `MANAGER`, `CHEF`, `STAFF`), or enforcing last-owner protection. | Non-responsive table. | Missing staff invite dialog and confirmation modals. | **P1** |
| **13. Restaurant Settings** | Basic switches and text inputs. | No weekly opening hours schedule editor (Mon–Sun); no temporary operational override (`Open`, `Busy`, `Closed`); no notification preferences. | Cluttered single-column scroll view. | Missing hours validation and timezone indicator. | **P1** |
| **14. Custom Meal Quotes** | Embedded rider dispatch modal. | No dedicated quotes panel where restaurants can view open customer custom meal requests, submit price/prep time, or withdraw quotes. | Tiny input fields. | Missing quote formulation stepper and status badges. | **P1** |

---

## 3. Prioritized Refactoring Plan

### Priority P0 (Immediate Core Operations & Reliability)
1. **Deconstruct Monolith**: Break `app/restaurant-portal/index.tsx` into modular components in `components/restaurant/`.
2. **Implement Attention Center**: Operational alert feed for urgent actions (orders waiting, overdue verifications, low stock).
3. **Build Kitchen Kanban Board**: Touch-friendly 3-column board (`Accepted`, `Cooking`, `Ready`) with elapsed age timers and kitchen counter contrast.
4. **Implement Menu Verification & Branch Pricing**: One-tap "Verify Menu" flow, branch price overrides (`branch_menu_items`), and rapid availability toggles.
5. **Real-time Order Subscriptions**: Supabase Realtime channel for instant order reception with visual connection status (`Live`, `Reconnecting`, `Offline`).

### Priority P1 (Management & Trust Workspaces)
1. **Reservation Workspace**: Status tabs (`Pending`, `Confirmed`, `Today`, `Completed`, `Cancelled`) with capacity guards.
2. **Customer Reports Center**: View and acknowledge customer reports (e.g. wrong price).
3. **Reviews & Responses**: View ratings and formulate restaurant replies.
4. **Earnings Overview**: Database-backed financial summary with platform commissions.
5. **Staff Management**: Role-based access control (`OWNER`, `MANAGER`, `CHEF`, `STAFF`) with last-owner protection.
6. **Restaurant Settings**: Weekly opening hours editor, operational open/closed override, notification settings.
7. **Custom Meal Quotes**: Dedicated panel to formulate and submit quotes for custom requests.

### Priority P2 (Advanced Analytics & Polish)
1. **Discovery Analytics**: Search impression counts, top dish views, and lost opportunity tracking.
2. **Audit History Trail**: Human-readable activity feed of menu changes and status updates.
3. **Desktop & Mobile Responsive Polish**: Sidebar on wide screens, slide/bottom navigation on mobile.
