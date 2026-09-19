# MloHub Stage 6: Visual Design Review & Operating Workspace Architecture

**Date**: September 2026  
**Focus**: Restaurant Operating Workspace, Attention Center, Kitchen Kanban, Menu Verification Engine, and Role-Based Density  
**Status**: COMPLETE  

---

## 1. Operating Workspace Design System Architecture

Unlike the customer-facing mobile application which utilizes a warm ivory (`#FBFAF4`) lifestyle aesthetic with generous white space and photography, the **MloHub Restaurant Operating Workspace** is designed for **high-velocity kitchen operations and desktop/tablet management**.

### 1.1 Contrast & Environment-Aware Palette

```
┌──────────────────────────────────────────────────────────────────┐
│             RESTAURANT WORKSPACE OPERATING PALETTE               │
├───────────────────┬───────────────────┬──────────────────────────┤
│ Background Canvas │ #0F172A (Slate 900│ High-contrast, anti-glare│
│ Card Surface      │ #1E293B (Slate 800│ Elevated cards & panels  │
│ Sidebar & Rails   │ #0B1120 (Slate 950│ Fixed desktop sidebar    │
│ Border Dividers   │ #334155 (Slate 700│ Sharp column boundaries  │
│ Text Primary      │ #F8FAFC (Slate 50)│ Maximum legibility       │
│ Text Muted        │ #94A3B8 (Slate 400│ Metadata, timestamps     │
│ Brand Green       │ #1D6637 / #22C55E │ Active tabs & live pills │
│ Urgent Alert      │ #EF4444 (Red 500) │ Orders awaiting accept   │
│ Warning / Late    │ #F59E0B (Amber 500│ Delayed orders & verif.  │
│ Information Pill  │ #3B82F6 (Blue 500)│ Active preparation queue │
└───────────────────┴───────────────────┴──────────────────────────┘
```

**Why this density and palette?**
1. **Kitchen Glare & Steam Resistance**: In hot, steamy commercial kitchens, bright white mobile backgrounds cause glare and wash out details. The slate dark mode creates sharp, bold contrast that chefs can read from 2 meters away on a mounted tablet.
2. **Touch-First Target Sizing**: Kitchen action buttons (`Accept Order`, `Start Cooking`, `Mark Ready`) exceed **48dp** touch target heights to support busy kitchen hands and gloved usage.
3. **Color-Coded Aging Timers**: Order age is immediately discernible at a distance:
   - Green (`< 15 min`): Normal queue speed.
   - Amber (`15–30 min`): Attention needed.
   - Red Pulse (`> 30 min`): Urgent / late threshold exceeded.

---

## 2. Responsive Information Architecture

The Restaurant Portal dynamically adapts across Desktop (browser), Tablet (kitchen display), and Mobile (manager on the move).

### 2.1 Desktop & Wide Tablet Layout (`> 900px`)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [MloHub Kitchen] Mama Amina Authentic Biryani  [Branch: Masaki ▼]  (LIVE ●)  [Refresh]│
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│ • Overview   │  🚨 ATTENTION CENTER: 2 Orders awaiting acceptance | 1 Dish unverified │
│ • Orders (2) ├─────────────────────────────────────────────────────────────────────────┤
│ • Kitchen (4)│  GOOD MORNING, MAMA AMINA! 👋                                           │
│ • Menu       │  [TSh 245,000 Today's Sales] [4 Cooking] [2 Reservations] [4.9 ★ Rating]│
│ • Tables     ├─────────────────────────────────────────────────────────────────────────┤
│ • Reviews    │  ACTIVE ORDERS / KITCHEN KANBAN QUEUE                                   │
│ • Earnings   │  ┌───────────────────┬───────────────────┬───────────────────┐          │
│ • Analytics  │  │  ACCEPTED (2)     │  PREPARING (1)    │  READY (1)        │          │
│ • Staff      │  │  #1042 - 12m ago  │  #1041 - 22m ago  │  #1039 - 28m ago  │          │
│ • Settings   │  │  [Start Cooking]  │  [Mark Ready]     │  [Dispatch]       │          │
│              │  └───────────────────┴───────────────────┴───────────────────┘          │
└──────────────┴─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile Layout (`<= 900px`)
- **Header**: Brand title, branch pill, Realtime status dot, and logout button.
- **Horizontal Scrolling Tab Bar**: Sticky, role-filtered navigation chips with numeric badges.
- **Main Viewport**: Vertical full-width cards with large buttons and full modal overlays for kitchen management.

---

## 3. Modular Component Breakdown (`components/restaurant/`)

| Component | Responsibility | Key Interactions & Security Features |
| :--- | :--- | :--- |
| `RestaurantPortalHeader` | Operational control header | Restaurant branding, multi-branch dropdown selector, role badge, Realtime websocket status (`LIVE`, `RECONNECTING`, `OFFLINE`), manual sync & logout. |
| `RestaurantSidebar` | Desktop navigation rail | Role-filtered 10-tab navigation with live badge counts for pending orders, active kitchen dishes, and attention items. |
| `RestaurantMobileNav` | Mobile navigation strip | Horizontal scrolling touch chips for smaller devices with role protection. |
| `AttentionCenter` | Critical action feed | Answers *"What needs my attention right now?"* Alerts for pending orders, overdue price verifications, customer reports, and low stock. |
| `DashboardOverview` | Daily operating cockpit | KPI cards (Gross sales, net payout, cooking orders, table bookings, average rating), fast "Verify Full Menu" CTA. |
| `IncomingOrdersPanel` | Order acceptance station | Accept with prep-time picker modal (`15m`, `25m`, `35m`, `45m`), reject with required cancellation reason modal. |
| `KitchenBoard` | Touch-friendly Kanban | 3-column tactile queue (`ACCEPTED` ➔ `PREPARING` ➔ `READY`). Color-coded order age indicators. |
| `MenuManager` | Price & availability center | Search, category filtering, instant availability toggle (`Available ✓` / `Sold Out ✕`), bulk stock update, single dish and full-menu verification. |
| `MenuItemEditor` | Dish authoring modal | Bilingual names (En/Sw), base pricing, branch-specific price overrides (`branch_menu_items`), spice levels, preparation minutes, dietary tags. |
| `CategoryManager` | Menu organization modal | Add, re-order, and archive menu categories with Swahili translations. |
| `ReservationManager` | Table booking desk | Status tabs (`Today`, `Pending`, `Confirmed`, `Seated`), capacity limit indicator, confirm/reject/seat/no-show actions. |
| `ReviewsPanel` | Reputation manager | Verified order badges, overall and sub-rating breakdown (Food, Speed, Value), in-line restaurant reply submission. |
| `EarningsOverview` | Transparent finance ledger | Net vs. gross earnings breakdown, 10% platform commission calculation, mobile money payout status (`M-Pesa / TigoPesa`). |
| `AnalyticsPanel` | Discovery optimization insights | Weekly search appearances, search-to-restaurant clicks, top searched dishes, and lost opportunity tracking. |
| `StaffManager` | Team permission manager | Invite team members (`OWNER`, `MANAGER`, `CHEF`, `STAFF`), update roles, and **sole-owner deletion protection**. |
| `RestaurantSettings` | Operating parameters | Immediate operating override (`OPEN`, `BUSY`, `CLOSING_SOON`, `TEMPORARILY_CLOSED`), weekly operating hours schedule editor, notification toggles. |
| `CustomMealQuotesPanel` | Bespoke dining quote desk | View diner requests, formulate price and preparation time quotes, submit to customer real-time stream. |
| `CustomerReportsPanel` | Discrepancy resolution | Review diner data discrepancy reports (e.g. wrong price, closed branch), trigger instant dish fix shortcuts. |

---

## 4. Role-Based Access Matrix in Practice

| Feature / Tab | OWNER | MANAGER | CHEF | STAFF |
| :--- | :---: | :---: | :---: | :---: |
| **Financial Overview & Earnings** | ✅ Full Access | ✅ Operational Only | ❌ Hidden | ❌ Hidden |
| **Order Acceptance & Rejection** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ View / Read-Only |
| **Kitchen Kanban Queue** | ✅ Full Access | ✅ Full Access | ✅ Primary Workspace | ❌ Hidden |
| **Menu Editing & Availability** | ✅ Full Access | ✅ Full Access | ✅ Availability Only | ❌ Hidden |
| **Menu Price Verification** | ✅ Full Access | ✅ Full Access | ❌ Hidden | ❌ Hidden |
| **Table Reservations** | ✅ Full Access | ✅ Full Access | ❌ Hidden | ✅ Seat / Check-in |
| **Staff & Ownership Control** | ✅ Full Access | ❌ Hidden | ❌ Hidden | ❌ Hidden |
| **Emergency Operating Status** | ✅ Full Access | ✅ Full Access | ❌ Hidden | ❌ Hidden |

---

## 5. Verification Summary

- **TypeScript Typecheck**: 0 Errors (`tsc --noEmit` clean).
- **Master Test Suite**: 484 Passed | 0 Failed (`npm test`).
- **Security Invariants**: 22 Static Checks + 48 Dynamic Rules Passed (`npm run security:test`).
- **Production Web Export**: 24/24 static routes generated including `/restaurant-portal` (`npm run build`).
- **Expo Doctor**: 18/18 checks passed (`npx expo-doctor`).
