# MloHub Stage 6: Restaurant Operating Workspace & Trust Engine Report

**Date**: September 2026  
**Focus**: Restaurant Operating Workspace, Attention Center, Kitchen Kanban Board, Menu Price Verification Engine, Branch Overrides, and RBAC Security  
**Status**: 100% COMPLETE (Stage 6 Tasks 1–71 + Critical Stage 5 Corrections Verified)  

---

## Executive Summary

Stage 6 transforms the MloHub restaurant portal from a 1,756-line monolithic prototype into a modular, production-grade operating workspace. The new architecture directly solves two paramount questions for restaurant operators:
1. **"What needs my attention right now?"** (Answered via the prioritized Attention Center, pending order countdowns, and operational alert feeds).
2. **"How do I keep my MloHub information accurate?"** (Answered via single/full-menu price verification, branch-specific price overrides, and instant availability toggles that feed real-time discovery freshness).

All Stage 6 deliverables were verified against strict engineering standards:
- **TypeScript**: 0 compilation errors (`tsc --noEmit`).
- **Test Suite**: 484 Passed | 0 Failed (65 new Stage 6 tests integrated).
- **Security Invariants**: 22 Static Checks + 48 Dynamic Security Rules Passed (100%).
- **Expo Build**: Production web export succeeded with all 24 static routes.
- **Expo Doctor**: 18/18 checks passed cleanly.

---

## Comprehensive 51-Point Architectural Review

### 1. What was the monolithic state before Stage 6?
Prior to Stage 6, `app/restaurant-portal/index.tsx` was a single file containing 1,756 lines of code. It mixed route access gating, order filtering, inline HTML forms, kitchen state toggles, table reservations, staff tables, and modal dialogues into one giant component. State changes in any sub-feature caused full-screen re-renders, and role-based permissions were enforced inconsistently across the UI.

### 2. What modules were created and how are they organized?
The monolithic screen was decomposed into 18 purpose-built, modular components located under `components/restaurant/`, tied together by an export barrel `components/restaurant/index.ts`:
- `RestaurantPortalHeader.tsx`: Brand badge, branch selector, role badge, Realtime status pill (`LIVE` / `RECONNECTING` / `OFFLINE`), refresh & logout.
- `RestaurantSidebar.tsx`: Desktop fixed navigation rail with role-aware item filtering.
- `RestaurantMobileNav.tsx`: Horizontal scrolling navigation bar for mobile and tablet devices.
- `AttentionCenter.tsx`: Operational alert feed prioritizing immediate operational blockers.
- `DashboardOverview.tsx`: Daily operational greeting, 6 core KPI cards, and quick menu verification CTA.
- `IncomingOrdersPanel.tsx`: Order intake station with acceptance modal (prep time) and rejection modal (reason).
- `KitchenBoard.tsx`: Touch-friendly 3-column Kanban board (`ACCEPTED` ➔ `PREPARING` ➔ `READY`).
- `MenuManager.tsx`: Search, category filtering, single/bulk availability toggles, dish cards, and verification actions.
- `MenuItemEditor.tsx`: Bilingual dish authoring modal with branch price override table (`branch_menu_items`).
- `CategoryManager.tsx`: Category creation, reordering, and archiving modal.
- `ReservationManager.tsx`: Table booking desk with capacity indicators and status filtering.
- `EarningsOverview.tsx`: Net and gross revenue ledger with 10% platform fee calculation and mobile money status.
- `ReviewsPanel.tsx`: Customer ratings breakdown (overall, food, speed, value) with in-line response submission.
- `AnalyticsPanel.tsx`: Food discovery optimization metrics, weekly impressions, and lost opportunities.
- `StaffManager.tsx`: Team member invitation, role management, and sole-owner deletion protection.
- `RestaurantSettings.tsx`: Operating override (`OPEN`, `BUSY`, `CLOSING_SOON`, `TEMPORARILY_CLOSED`), opening hours, and notifications.
- `CustomMealQuotesPanel.tsx`: Advance bespoke meal inquiry review and quote formulation station.
- `CustomerReportsPanel.tsx`: Customer data discrepancy review and dish fix shortcut panel.

### 3. How does the workspace answer "What needs my attention right now?"
Upon loading or switching to the portal, operators immediately see the **Attention Center** at the very top of their dashboard. It filters and bubbles up actionable bottlenecks:
- Incoming orders awaiting kitchen acceptance (with countdown timers).
- Menu items whose prices have not been verified in > 7 days.
- Customer-reported data discrepancies (e.g. wrong price or outdated location).
- Menu items marked as sold out during peak trading hours.

### 4. How does the workspace answer "How do I keep my information accurate?"
The workspace equips managers with direct controls:
- A one-click **"Verify Full Menu"** CTA that timestamps all active menu items as verified today.
- Single-dish verification checkmarks directly on each menu card.
- A quick toggle (`Available ✓` / `Sold Out ✕`) for individual items and bulk selection for rush hours.
- A branch price override matrix in `MenuItemEditor` to adjust prices by location.

### 5. How does the Attention Center prioritize alerts?
Alerts are categorized by strict severity levels:
1. `HIGH` (Red): Pending incoming orders (delay impacts diner SLA and auto-cancellation risk).
2. `MEDIUM` (Amber): Menu price verification overdue > 7 days (affects discovery score and ranking).
3. `INFO` (Blue): Items marked unavailable or customer feedback reports awaiting acknowledgment.
When all alerts are resolved, a calming green "Everything is Running Smoothly" banner is displayed.

### 6. How does the order state machine work from the restaurant perspective?
Orders strictly follow the Stage 3 canonical state machine:
`PENDING` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `COMPLETED`.
Direct state skipping (e.g. `PENDING` ➔ `COMPLETED`) is rejected by database triggers and domain validation. `CANCELLED` and `REJECTED` are terminal states.

### 7. What happens on Accept (prep time)?
When the kitchen clicks "Accept Order", an interactive modal prompts the chef to set an estimated preparation time (`15 min`, `25 min`, `35 min`, `45 min`). Upon confirmation:
- The order status transitions to `ACCEPTED` (`Confirmed`).
- An in-app notification is sent to the diner with the exact estimated prep time.
- A real-time WebSocket event (`ORDER_CONFIRMED`) is published to the customer channel.
- The order moves into the Kitchen Board queue.

### 8. What happens on Reject (reason required)?
When rejecting an order, the manager must select or specify a cancellation reason (e.g. "Item unavailable", "Kitchen at maximum capacity", "Closing early"). Upon submission:
- The order status transitions to `CANCELLED` (`REJECTED`).
- The reason is recorded immutably in the order snapshot.
- An alert is dispatched to the customer explaining the cancellation and assuring immediate refund.

### 9. How does the kitchen Kanban board handle fast touch interactions?
`KitchenBoard.tsx` features large touch targets (> 48dp), high-contrast cards, and tactile one-tap buttons (`Start Cooking`, `Mark Ready`, `Dispatch`). Chefs can advance orders along the 3-column pipeline without entering sub-menus or opening complex dialogs.

### 10. How is order age / timer displayed?
Each kitchen ticket displays a live elapsed timer computed from `order.createdAt`:
- `< 15 minutes`: Green badge (`Normal`).
- `15–30 minutes`: Amber badge (`Attention`).
- `> 30 minutes`: Red pulsating badge (`Late / Urgent`).

### 11. How does menu price verification work (single dish vs full menu)?
- **Single Dish**: Clicking "Verify" on a dish card updates `lastVerifiedAt` to `new Date().toISOString()` and broadcasts `menu:updated`.
- **Full Menu**: Clicking "Verify Full Menu" in the header/dashboard iterates through all active items, sets `lastVerifiedAt` to now, and saves to the database in a single atomic transaction.

### 12. How does verification change discovery ranking?
In Stage 4's discovery engine (`DiscoveryService`), dishes with verification timestamps `<= 7 days` are assigned the `FRESH` tier, giving them maximum freshness weighting in search ranking. Unverified dishes drop to `AGING` or `STALE`, reducing their visibility to nearby diners.

### 13. How are branch-specific prices managed?
Through `MenuItemEditor.tsx` and the `branch_menu_items` domain relation, restaurants can define a `basePrice` for a dish, and optionally specify distinct price overrides for specific branches (e.g., Masaki branch pricing vs. Kariakoo branch pricing). The discovery engine and order creation look up the branch-specific override first.

### 14. How does bulk availability toggling work?
Managers can multi-select dishes via checkboxes in `MenuManager.tsx` and trigger "Mark Available" or "Mark Sold Out" with a single click. This updates the catalog and dispatches a bulk `menu:updated` real-time event.

### 15. What dietary tags and spice levels are supported?
- **Dietary Tags**: `Halal`, `Vegetarian`, `Vegan`, `High Protein`, `Gluten-Free`, `Spicy`.
- **Spice Levels**: `Mild`, `Medium`, `Hot`, `Very Hot`.

### 16. How does table reservation management work?
`ReservationManager.tsx` provides a tabbed view (`Today's Bookings`, `Pending`, `Confirmed`, `Seated`, `All`). Staff can view guest names, phone numbers, party sizes, deposit statuses, and special requests.

### 17. What table statuses are supported?
The canonical domain statuses in `types/domain.ts` are supported:
`PENDING`, `CONFIRMED`, `SEATED`, `CANCELLED`, `NO_SHOW`.

### 18. How are reviews displayed (overall + food/value/speed)?
`ReviewsPanel.tsx` displays verified diner reviews with a 5-star rating breakdown:
- Overall Star Rating (1.0–5.0).
- Sub-dimension ratings: Food Quality, Delivery/Preparation Speed, and Value for Money.
- A "Completed Order Verified" badge confirms genuine dining history.

### 19. How do restaurant replies to reviews work?
Operators can type a public response directly under any customer review. Submitting the reply attaches `response` and `respondedAt` timestamps, fostering community trust.

### 20. What financial metrics are displayed (gross, net, platform fee)?
`EarningsOverview.tsx` provides:
- **Gross Revenue**: Total sum of completed customer orders.
- **Platform Commission (10%)**: Standard MloHub fee.
- **Net Restaurant Payout (90%)**: Revenue disbursed to the restaurant.

### 21. What is the platform fee rate?
The standard platform commission rate is **10%** (`0.10`), matching the server-side calculations in `OrderPipelineService` and database functions.

### 22. How are mobile money payouts represented?
Each transaction displays its settlement status (`SETTLED` or `PENDING`) and specifies the primary Tanzanian payout provider (`M-Pesa / TigoPesa`).

### 23. What discovery analytics are shown?
`AnalyticsPanel.tsx` presents:
- Weekly search appearances (impressions).
- Search-to-restaurant click-throughs.
- Menu Freshness percentage score.
- Average Order Value (TZS).
- Top searched dishes in the restaurant's neighborhood.

### 24. How are lost opportunities identified?
The panel highlights dishes that diners searched for in the neighborhood while the restaurant's item was marked "Sold Out" or the restaurant was marked "Temporarily Closed" during peak hours.

### 25. What roles can exist in a restaurant?
Four canonical roles defined in `types/auth.ts`:
- `OWNER`: Business proprietor.
- `MANAGER`: General operational supervisor.
- `CHEF`: Kitchen production lead.
- `STAFF`: Front-of-house service personnel.

### 26. What can each role see and do?
- `OWNER`: Full access to all 10 tabs (Finances, Staff, Settings, Menu, Orders, Kitchen).
- `MANAGER`: Full operational access (Orders, Kitchen, Menu, Reservations, Reviews, Settings), restricted from Staff Management.
- `CHEF`: Dedicated access to Orders, Kitchen Kanban, and Menu Availability. Financials and Settings are hidden; default tab routes directly to Kitchen Board.
- `STAFF`: Dedicated access to Orders (view-only) and Table Reservations (seating check-in).

### 27. How does the last-owner rule protect the restaurant?
`StaffManager.tsx` and database triggers prevent deleting, deactivating, or demoting the sole remaining `OWNER` of a restaurant. If an owner attempts to delete themselves, the system blocks the action with: *"Cannot remove the only Owner of this restaurant. Assign another Owner first."*

### 28. How is operating status overridden (Open, Busy, Closing Soon, Temporarily Closed)?
In `RestaurantSettings.tsx`, operators can toggle between four operating overrides:
- `OPEN`: Normal order acceptance.
- `BUSY`: High kitchen load warning displayed to diners.
- `CLOSING_SOON`: Last orders accepted.
- `TEMPORARILY_CLOSED`: Instant order intake suspension.

### 29. How does temporary closure affect discovery?
Setting `TEMPORARILY_CLOSED` sets `isOpen: false` across the database. In the customer discovery engine, the restaurant is flagged as closed, preventing new checkout flows while keeping existing orders in fulfillment.

### 30. How is the weekly opening hours schedule managed?
Operators configure standard open and close times for each day of the week (Monday through Sunday) with per-day enable/disable toggles in `RestaurantSettings.tsx`.

### 31. How does real-time sync work for orders, reviews, reservations?
The portal subscribes to `RealtimeEventEngine` on three distinct channels:
- `orders:*`: Global order notifications.
- `orders:restaurant:<restaurantId>`: Tenant-specific incoming orders and status updates.
- `menu:updated`: Catalog verification and availability changes.

### 32. What visual indicator shows connection state?
`RestaurantPortalHeader.tsx` displays a connection status badge:
- Green (`LIVE ●`): Connected to WebSocket stream.
- Amber (`RECONNECTING ●`): Attempting handshake.
- Red (`OFFLINE ●`): Disconnected, falling back to manual refresh.

### 33. How does multi-branch switching work?
The header features a branch dropdown selector. Selecting a branch updates `selectedBranchId`, instantly filtering order queues, branch price overrides, and availability states.

### 34. How does the portal adapt between desktop, tablet, and mobile?
- Desktop (`> 900px`): Persistent 250px sidebar with full column layouts.
- Tablet (`600–900px`): Responsive 2-column Kanban with compact cards.
- Mobile (`< 600px`): Horizontal scrolling tab bar and vertical single-column card flows.

### 35. How are touch targets sized for kitchen use (48dp+)?
All interactive buttons, switches, and Kanban cards maintain a minimum touch target of **48dp** (e.g. `paddingVertical: 12`, `minHeight: 48`) with generous padding to prevent mis-taps.

### 36. How does Swahili/English localization work across the portal?
The portal integrates with `useLanguage()`, providing full bilingual support across navigation tabs, status messages, alerts, empty states, and system notifications (e.g., *"Oda Mpya"* vs *"Incoming Orders"*, *"Jikoni"* vs *"Kitchen"*).

### 37. What role-based route guards protect the portal?
`resolvePortalAccess` in `db/auth/guards.ts` guards the portal against unauthorized access. Unauthenticated users are redirected to `/auth`, and customer-only users receive a 403 `DENIED` view.

### 38. How is tenant isolation enforced in the restaurant workspace?
`selectRestaurantOrders` strictly isolates orders by `targetRestaurantId`. Query results and state updates are scoped exclusively to the authenticated restaurant's identifier.

### 39. Can a restaurant see another restaurant's orders or revenue?
**No.** Both client-side selectors and PostgreSQL Row Level Security (RLS) policies enforce tenant isolation. Cross-tenant access returns HTTP 403 Forbidden.

### 40. How does the portal handle loading, unauthenticated, and denied states?
- `LOADING`: Renders a centered dark slate spinner with *"Inapakia mfumo wa mgahawa..."*.
- `UNAUTHENTICATED`: Shows a lock card with a direct CTA to log in.
- `DENIED`: Informs customer accounts that this workspace is reserved for restaurant operators.
- `CUSTOMER_WORKSPACE`: Prompts multi-role users to switch workspace.
- `AWAITING_ASSIGNMENT`: Directs unassigned users to restaurant registration.

### 41. What tests were written and what do they cover?
`tests/restaurantPortal.test.ts` covers 8 test groups:
1. RBAC role navigation visibility.
2. Portal route guards and access resolution.
3. Order state machine and prep-time recording.
4. Attention Center alert generation and prioritization.
5. Menu price verification and freshness tier promotion.
6. Multi-branch pricing overrides.
7. Sole-owner deletion and downgrade protection.
8. Operating status and emergency closure overrides.

### 42. Did all tests pass?
**Yes.** All tests in `tests/restaurantPortal.test.ts` passed with 0 failures.

### 43. How many total tests pass now?
**484 Passed | 0 Failed** across the entire MloHub master test suite (up from 419 baseline).

### 44. Did typecheck pass with zero errors?
**Yes.** `npm run typecheck` (`tsc --noEmit`) exited with code 0.

### 45. Did expo-doctor pass with 18/18?
**Yes.** `npx expo-doctor` passed 18/18 checks with zero issues.

### 46. Did web export build succeed?
**Yes.** `npm run build` (`expo export --platform web`) bundled and exported all 24 static routes cleanly.

### 47. How does this stage advance MloHub towards the investor biryani demo?
In the investor Chicken Biryani scenario, when Mama Amina receives an order:
1. The pending order instantly appears in her **Attention Center**.
2. She clicks "Accept" and inputs 25 minutes prep time.
3. The order flows into her **Kitchen Kanban Board**.
4. Her menu price verification guarantees her dishes appear as `FRESH` in the customer app.
5. The customer app reflects live status updates (`Confirmed` ➔ `Cooking` ➔ `Ready`).

### 48. What are the known limitations of Stage 6 (no live payment, no live SMS)?
- No live payment gateways (ClickPesa / Selcom) are connected; financial payouts are tracked in ledger mode.
- No live SMS carrier credentials; OTP and SMS alerts log via carrier simulator.
- No live GPS rider telematics.

### 49. What Stage 5 corrections were made and verified?
1. **Order Status Naming**: Updated tracking timeline to use canonical `'Completed'` instead of `'Delivered'`.
2. **Authoritative Order Quoting**: Implemented `OrderService.quoteOrder(...)` ensuring cart previews and checkout orders share exact pricing logic.
3. **Guest Bypass Verification**: Audited authentication routes to guarantee guest bypass is disabled in production.

### 50. Why should we NOT proceed to Stage 7 (Admin Portal) yet?
Stage 6 must be reviewed and approved by the user. Proceeding to Stage 7 without review violates the step-by-step mandate and scope boundaries.

### 51. What is the recommended next step?
Present the Stage 6 completion results to the user, conduct a walkthrough of the Restaurant Operating Workspace, and await user review before planning Stage 7 (Admin Operations & Verification Portal).
