# STAGE 5: FULL CUSTOMER UI/UX AUDIT & GAP ANALYSIS
**Project:** MloHub Expo / React Native Upgrade  
**Repository Path:** `C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo`  
**Date:** September 16, 2026  
**Auditor:** MloHub Lead UI/UX Engineering  
**Scope:** All Customer-Facing Screens, Modals, Navigation, and Interaction Flows  

---

## Executive Summary & Audit Methodology

This audit evaluates all customer-facing surfaces in MloHub against a premium, investor-grade standard. The goal is to transition the customer experience from an assembly of prototype features into **one unified, cohesive product** centered on Food-First Discovery.

### Severity Classification:
- **P0 (Critical / Investor Blocker):** Visual incoherence, broken layout, excessive technical/developer clutter exposed to users, missing core feedback states, or confusing navigation.
- **P1 (High Priority / Product Polish):** Inconsistent typography, spacing drift, hardcoded hex colors, weak information hierarchy, lack of skeleton loading, or non-standard button styling.
- **P2 (Medium Priority / Quality of Life):** Minor padding misalignments, secondary icon stroke inconsistencies, or subtle desktop web responsiveness refinements.

---

## 1. Customer Home Screen (`app/(tabs)/index.tsx`)

- **Primary Objective:** Immediately orient the diner, communicate MloHub's value proposition ("What do you want to eat?"), provide 1-tap food search, and highlight trending and nearby dishes.
- **Current Strengths:**
  - Stage 4 introduced the food-first HeroSearchBar and quick filter pills (`≤ 10K TZS`, `≤ 3 km`).
  - Dish cards now show price in TZS, distance, and verification badges.
  - Floating compare bar alerts the user when dishes are queued.
- **Visual & Information Hierarchy Issues (P1):**
  - Search bar is slightly crowded by secondary headers and custom meal promotional cards.
  - Multiple competing carousels ("Popular Dishes Near You", "Recommended For You") lack consistent section headers and spacing.
  - Quick filter pills use ad-hoc inline styles instead of standardized `Chip` tokens.
- **Excessive Content & Clutter (P1):**
  - Promotional banner for Custom Meals is placed directly below search, interrupting the food discovery flow before users even see dishes.
- **Missing States (P1):**
  - Shimmer skeleton loading is present for dishes, but the top greeting and quick filter pills jump abruptly on load.
- **Mobile & Desktop Responsiveness (P2):**
  - On desktop web (> 768px), cards stretch horizontally across the window instead of residing in a centered max-width container (max-w 800px).
- **Investor Relevance:** **CRITICAL (P0)**. First screen an investor encounters. Must look effortless, modern, and trustworthy.
- **Components to Extract:** `HomeHeader`, `QuickFilterBar`, `DishCarouselSection`, `FloatingCompareBar`.

---

## 2. Food Discovery & Search Results (`app/(tabs)/explore.tsx`)

- **Primary Objective:** Provide frictionless browsing and multi-factor filtering of dishes across Dar es Salaam.
- **Current Strengths:**
  - Displays paginated dishes with 6 sorting options (`RECOMMENDED`, `NEAREST`, `CHEAPEST`, etc.).
  - Supports filter combinations (budget, radius, open now, rating floor).
- **Visual & Hierarchy Problems (P1):**
  - Sort pills and filter triggers are separated into disjointed rows, creating vertical clutter above the results.
  - Result count text (`Found X dishes`) lacks visual balance with the sort selector.
- **Missing States (P1):**
  - When a search returns zero results, `NoResultsView` needs more prominent 1-tap suggestion chips (e.g., "Clear budget filter", "Show all Dar es Salaam").
- **Accessibility (P2):**
  - Sort buttons need explicit `accessibilityRole="combobox"` or `accessibilityRole="button"`.
- **Investor Relevance:** **CRITICAL (P0)**. Displays the core Chicken Biryani search results.
- **Components to Extract:** `DiscoverySortHeader`, `FilterBottomSheet`.

---

## 3. Restaurant Profile & Menu Details (`app/restaurant/[id].tsx`)

- **Primary Objective:** Show restaurant identity, menu offerings, operating hours, verified freshness, and allow ordering or table reservation.
- **Current Strengths:**
  - Supports `highlightDishId` so a dish clicked in discovery is marked upon arrival.
  - Includes Google Maps external link and reservation trigger.
- **Visual & Hierarchy Problems (P0 / P1):**
  - Back button and share button are rendered as plain text strings (`← Back`, `❤️`).
  - Cover photo gradient and emoji circle clash aesthetically on clean screens.
  - Menu list is a long flat list without sticky category tabs (e.g., `Popular`, `Biryani`, `Grills`, `Drinks`).
  - Action buttons ("Book Table", "Order Online") are stacked inconsistently at the bottom.
- **Information Hierarchy (P0):**
  - The originating searched dish must be crowned at the very top of the menu in a "You searched for" highlight card with clear CTA to add to order.
- **Investor Relevance:** **HIGH (P0)**. Step 3 of the investor pitch journey.
- **Components to Extract:** `RestaurantHeroHeader`, `SearchedDishHighlightCard`, `StickyMenuCategoryBar`, `MenuItemRow`.

---

## 4. Dish Comparison Screen (`app/compare.tsx`)

- **Primary Objective:** Enable side-by-side evaluation of 2 to 4 candidate dishes across price, distance, rating, freshness, and preparation time.
- **Current Strengths:**
  - Displays metrics side by side and provides an "Order This Dish" CTA.
- **Visual Problems (P1):**
  - Column headers and metric rows can scroll horizontally off-screen on smaller mobile viewports (375px) without a fixed metric label column.
  - Visual trophy icons ("Best Price 🏆", "Closest 📍") are visually loud and need refined typography.
- **Consistency Problems (P1):**
  - Uses raw inline styling for comparison cells rather than standardized design system tokens.
- **Investor Relevance:** **HIGH (P1)**. Differentiator feature demonstrating why MloHub is superior to Google Maps.

---

## 5. Activity, Orders & Bookings (`app/(tabs)/bookings.tsx`)

- **Primary Objective:** Single customer hub for tracking active food orders, order status timelines, and table reservations.
- **Current Strengths:**
  - Shows confirmed table reservation cards.
- **Visual & Structural Problems (P0):**
  - Currently only lists table reservations, completely ignoring customer Food Orders!
  - No tabs for `[Upcoming, Past, Cancelled]`.
  - Action buttons (`View Details`, `Cancel`, `Call Restaurant`) are missing or hardcoded.
- **Missing States (P1):**
  - Empty state when no bookings exist is an empty white space rather than an inviting `EmptyState` component.
- **Investor Relevance:** **HIGH (P1)**. Shows the post-decision customer journey.
- **Components to Extract:** `ActivitySegmentedControl`, `OrderCardWithTimeline`, `ReservationCard`.

---

## 6. Custom Meal Screen (`app/(tabs)/custom.tsx`)

- **Primary Objective:** Allow individuals, families, and office groups to request bespoke meal quotes from local chefs.
- **Current Strengths:**
  - Form handles target segments (solo, family, office), servings, dietary tags, and spice levels.
  - Integrates quote receipt and simulated acceptance.
- **Visual & Architectural Problems (P0 / P1):**
  - File is **1,137 lines** long, combining form state, WebSocket listeners, quote displays, and inline modal management.
  - Visual layout is overly dense with too many text boxes and sliders on one screen.
  - Terminology can confuse new diners ("Specialist", "Target Segment").
- **Investor Relevance:** **MEDIUM (P1)**. Compelling business model concept, but secondary to core discovery.
- **Components to Extract:** `CustomMealRequestForm`, `CustomMealQuotesList`, `QuoteCard`.

---

## 7. Customer Profile & Settings (`app/(tabs)/profile.tsx`)

- **Primary Objective:** Customer account management, dietary preferences, saved favorites, language toggle, and support.
- **Current Strengths:**
  - Language toggle works smoothly across English and Swahili.
  - Displays user identity and contact info.
- **Critical Problems (P0 - MUST REFACTOR):**
  - File is **1,710 lines long**.
  - Exposes developer/debug controls directly to customers (`isDbModalOpen`, raw database state inspector, database reset button).
  - Displays editable raw `Security PIN` field in customer view.
  - Account switching modal contains legacy user impersonation buttons.
- **Required Redesign (P0):**
  - Break into clean, dedicated sections:
    - Profile Header (Avatar, Name, Email, Member Badge)
    - Account Settings
    - Preferences (Dietary tags, notifications)
    - Saved Favorites
    - Language (Swahili / English)
    - Help, Privacy & Support
    - Logout
- **Investor Relevance:** **CRITICAL (P0)**. Exposing dev debuggers in profile immediately undermines product credibility.

---

## 8. Customer Onboarding (`app/onboarding.tsx`)

- **Primary Objective:** Rapidly explain MloHub's 3 core benefits to a first-time user in under 15 seconds.
- **Current Strengths:**
  - 3-slide pager with language toggle.
- **Visual & Information Problems (P1):**
  - Slides use legacy art and text that focus on generic restaurant discovery.
  - Lacks the Food-First narrative:
    1. *Find exactly what you want to eat* (dish-level search).
    2. *Compare prices, distance and verified ratings*.
    3. *See recently verified menus and live availability*.
- **Investor Relevance:** **HIGH (P1)**. Sets the product frame before entering the app.

---

## 9. Customer Authentication (`app/auth/login.tsx`, `register-customer.tsx`)

- **Primary Objective:** Fast, secure login and registration with Supabase Auth.
- **Current Strengths:**
  - Robust Supabase Auth and password hash upgrade.
  - Role-aware redirect to customer workspace.
- **Visual Problems (P1):**
  - Screen is visually heavy with marketing cards and explanatory copy crowding the login inputs.
  - Needs a minimalist, clean layout: Logo, "Karibu tena / Welcome back", Email, Password, Forgot Password, Sign In, Register link, and a discrete "Restaurant Partner? Login here" button.
- **Investor Relevance:** **MEDIUM (P1)**. Must look slick and uncluttered.

---

## 10. Checkout, Cart & Order Confirmation Flow

- **Primary Objective:** Review items, calculate authoritative fees, choose payment method, and view order confirmation.
- **Current Strengths:**
  - Stage 3 fixed fees and snapshot immutability are rock solid.
- **Visual & Hierarchy Problems (P0):**
  - Currently no persistent Cart drawer or floating cart button on customer screens.
  - `PaymentCheckoutModal` is 968 lines and mixes payment options with reservation deposit logic.
  - Confirmation states lack an investor-ready receipt summary (`Order received ✓ Mama Amina Biryani #MH-1048`).
- **Investor Relevance:** **HIGH (P0)**. Completes the discovery-to-decision loop.

---

## Audit Action Plan & Prioritized Backlog

| Task Area | Issue | Priority | Target Fix |
|---|---|---|---|
| **Design System** | Scattered hex codes, inconsistent font sizes and radii | **P0** | Create `theme/` tokens and `components/ui/` library |
| **Profile Screen** | 1,710-line monolithic file with exposed DB tools and raw PIN | **P0** | Decompose profile, purge dev tools from customer UI |
| **Restaurant Page** | Primitive text buttons, no sticky categories, weak dish highlight | **P0** | Implement sticky menu, polished hero, prominent dish highlight |
| **Bookings & Orders** | No order tracking on bookings screen | **P0** | Convert to unified Activity hub (`[Orders, Bookings]`) |
| **Cart & Checkout** | Missing clear cart surface and order tracking timeline | **P0** | Add `CartContext`, `CartDrawer`, `OrderTrackingTimeline` |
| **Home Screen** | Custom meal promo displaces food discovery; cluttered layout | **P1** | Reorder hierarchy: Hero Search ➔ Quick Pills ➔ Food Dishes |
| **Onboarding** | Outdated slides missing the food-first story | **P1** | Update 3-slide story to food search, compare, verified menus |
| **Comparison** | Horizontal scrolling issues on small screens; loud trophies | **P1** | Refactor table to fixed column with responsive metric rows |
| **Custom Meals** | 1,137-line complex screen with overwhelming inputs | **P1** | Streamline into 3 clear steps |
| **Auth Screens** | Crowded with product marketing | **P1** | Clean, minimalist, modern inputs |
| **Desktop Web** | Cards stretch to 100% width on widescreen | **P2** | Add centered max-width container (800px) |

---
**Audit Complete. Proceeding to Phase 2: Design System V2 and Component Library.**
