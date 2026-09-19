# MloHub Customer UI/UX QA Checklist & Verification Matrix

**Date**: September 2026  
**Target Milestone**: Stage 5 — Customer-Side Premium UI/UX & Design System V2  
**Platform**: Expo SDK 54 / React Native (Web, iOS, Android)  
**Status**: COMPLETE (All 61 Tasks Verified)

---

## 1. Executive Summary

This checklist outlines the visual, functional, accessibility, and interaction standards implemented for the MloHub customer experience. Every screen, component, and user flow has been reviewed to ensure consistency, clarity, and investor-ready polish.

---

## 2. Screen-by-Screen QA Matrix

| Screen / Flow | Responsive Layout | Touch Targets (>=48dp) | Empty / Loading States | Semantic Colors | Offline / Demo Resilience | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Home (Discovery)** `app/(tabs)/index.tsx` | PASS (max-w 800) | PASS (48dp min) | Skeletons + EmptyState | Design System V2 | Fallback data active | **VERIFIED** |
| **Search & Filter** `components/discovery/` | PASS | PASS | Contextual zero results | Badge / Chip tokens | Bilingual synonyms | **VERIFIED** |
| **Dish Card** `DishCard.tsx` | PASS | PASS | Shimmer + Emoji | FreshnessBadge | In-cart count & Add CTA | **VERIFIED** |
| **Restaurant Details** `app/restaurant/[id].tsx` | PASS (max-w 800) | PASS (48dp icon buttons) | Sticky category tabs | Searched dish highlight | Verified badge & map | **VERIFIED** |
| **Comparison** `app/compare.tsx` | PASS (Horizontal scroll) | PASS | Best-in-class highlights | Pill & contrast tokens | Dynamic metrics matrix | **VERIFIED** |
| **Cart Drawer** `components/cart/CartDrawer.tsx` | PASS (Bottom / Side sheet)| PASS | Qty increment / decrement | Fee breakdown | Fixed delivery & service | **VERIFIED** |
| **Order Review** `components/checkout/OrderReviewModal.tsx` | PASS | PASS | Processing loader | Stage 3 immutable snapshot | Mobile money selector | **VERIFIED** |
| **Activity Hub** `app/(tabs)/bookings.tsx` | PASS | PASS | EmptyState + CTAs | Segmented control | Timeline state machine | **VERIFIED** |
| **Custom Meals** `app/(tabs)/custom.tsx` | PASS | PASS | Step 1 & Step 2 | Savory accent badges | Multi-quote comparison | **VERIFIED** |
| **Customer Profile** `app/(tabs)/profile.tsx` | PASS | PASS | Zero-leak inspection | Decomposed modals | Settings / Preferences | **VERIFIED** |
| **Onboarding** `app/onboarding.tsx` | PASS | PASS | 3-slide value story | Warm background | Direct discovery jump | **VERIFIED** |
| **Auth Login** `app/auth/login.tsx` | PASS | PASS | Supabase Auth login | Clean input focus | Guest bypass & Register | **VERIFIED** |

---

## 3. Design System Token Compliance

### 3.1 Color Palette
- **Primary Brand Green** (`#1D6637`): Standardized across headers, primary CTAs, active tab icons, verified checkmarks.
- **Primary Dark Charcoal Green** (`#143C26`): Applied to elevated cards, footer bars, and deep surface accents.
- **Warm Culinary Background** (`#FBFAF4`): Neutral, eye-friendly base replacing harsh pure white screens.
- **Savory Accent Orange** (`#ED8936`): Highlight color for discounts, best price tags, and custom meal chef badges.
- **Soft Muted Green** (`#EAF4E7`): Subdued background for badges, freshness indicators, and chips.
- **Surface Elevation** (`#FFFFFF`): Standard card surfaces with subtle border `#DCE4DD`.

### 3.2 Typography Hierarchy
- **Display** (32px / 38px line height / 700 weight): Hero discover headers.
- **H1** (24px / 30px line height / 700 weight): Screen section titles and restaurant hero titles.
- **H2** (20px / 26px line height / 600 weight): Card titles, modal headers.
- **H3** (16px / 22px line height / 600 weight): Subsection titles, item names.
- **Body / BodyMedium** (14px / 20px line height / 400 & 500 weight): Descriptions, notes.
- **Caption / Label** (12px / 16px line height / 600 weight): Category pills, metadata, distance, timestamps.
- **Price Hierarchy**: `PriceLarge` (20px bold), `PriceMedium` (16px bold), `PriceSmall` (14px bold) utilizing `formatTzs()`.

### 3.3 Touch Targets & Accessibility
- **Minimum 48dp Touch Targets**: Every button, chip, segmented tab, icon button, and counter hit-box satisfies WCAG 2.1 AA touch target guidelines (`hitSlop` where visual footprint is compact).
- **Text Contrast**: Text on light backgrounds satisfies >= 4.5:1 contrast ratio (`#14281E` on `#FBFAF4` achieves 14.8:1).
- **Font Scaling**: Standard system font stacks with proportional line heights.

---

## 4. End-to-End User Flow Verification

### 4.1 Flow 1: Food-First Discovery to Order Review
1. **Search**: Customer enters "Chicken Biryani" with Mikocheni neighborhood selected.
2. **Filtering**: Results filter instantly to candidate dishes within <= 12,000 TZS budget.
3. **Card Interaction**: Customer views freshness verification badge ("Verified 2h ago"), rating (4.9 ★), and distance (800m).
4. **Cart Addition**: Customer taps `+ Add` button directly on dish card. Floating cart pill emerges with total count and subtotal.
5. **Cart Drawer**: Customer opens cart drawer, adjusts quantity to 2, notes 2,500 TZS delivery fee and 1,500 TZS service fee.
6. **Checkout**: Customer taps "Proceed to Checkout", fills delivery address, selects M-Pesa, and submits order. Order snapshot is immutably created.

### 4.2 Flow 2: Side-by-Side Comparison
1. Customer taps "Compare" on Mama Amina Biryani, Biryani Hub, and Spice House.
2. Direct navigation to `/compare` presents a 3-column comparative matrix.
3. Best-in-class badges highlight:
   - **Best Price**: Biryani Hub (9,500 TZS)
   - **Nearest**: Spice House (300m)
   - **Top Rated**: Mama Amina (4.9 ★)
4. Customer taps `+ Add to Order` directly on the preferred option.

### 4.3 Flow 3: Activity Hub Tracking
1. Customer switches to Activity Hub (`app/(tabs)/bookings.tsx`).
2. Segmented switch effortlessly toggles between Food Orders and Table Bookings.
3. Order timeline visually tracks: `Received` ➔ `Accepted` ➔ `Cooking` ➔ `Ready` ➔ `Delivered`.

---

## 5. Security & Zero-Leak Audit
- Customer Profile (`app/(tabs)/profile.tsx`) has no exposure of internal database tables, developer debuggers, raw PINs, or restaurant financial identifiers.
- All pricing in cart and order review is protected by Stage 3 server-side validation and snapshot immutability.
