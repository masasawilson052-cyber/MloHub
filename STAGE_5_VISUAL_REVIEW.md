# MloHub Stage 5: Visual Design Review & Design System V2 Specification

**Date**: September 2026  
**Focus**: Visual Hierarchy, Component Architecture, Brand Identity, and Responsive Density  
**Status**: COMPLETE

---

## 1. Design System V2 Architecture

MloHub Design System V2 establishes a unified, culinary-focused aesthetic tailored for East African diners and investors. It reconciles prototype inconsistencies into an authoritative design token engine located in `theme/`.

### 1.1 Palette & Semantic Intent

```
┌─────────────────────────────────────────────────────────────┐
│                    MLOHUB PALETTE V2                        │
├───────────────────┬───────────────────┬─────────────────────┤
│ Brand Primary     │ #1D6637 (Forest)  │ Core CTA, Active Nav│
│ Brand Dark        │ #143C26 (Charcoal)│ Headers, Footers    │
│ Warm Background   │ #FBFAF4 (Ivory)   │ Screen Canvas       │
│ Savory Accent     │ #ED8936 (Tangerine│ Highlights, Deals   │
│ Accent Dark       │ #C05621 (Burnt)   │ Pressed Accent State│
│ Primary Muted     │ #EAF4E7 (Mint)    │ Badge Backgrounds   │
│ Text Primary      │ #14281E (Obsidian)│ High-Contrast Body  │
│ Text Secondary    │ #536259 (Slate)   │ Metadata, Subtitles │
│ Surface Elevated  │ #FFFFFF (Pure)    │ Cards, Modals       │
└───────────────────┴───────────────────┴─────────────────────┘
```

### 1.2 Elevation & Shadow Layers
- **None**: Flat elements, border-only cards.
- **Small (`Shadows.sm`)**: Default dish cards, input wrappers (`shadowColor: #183126`, `shadowOpacity: 0.05`, `elevation: 2`).
- **Medium (`Shadows.md`)**: Floating Cart Pill, Action Sheets (`shadowColor: #183126`, `shadowOpacity: 0.08`, `elevation: 4`).
- **Large (`Shadows.lg`)**: Modal Dialogs, Bottom Sheets (`shadowColor: #183126`, `shadowOpacity: 0.12`, `elevation: 8`).

---

## 2. Component Library Specification (`components/ui/`)

| Component | Responsibility | Props & Variants |
| :--- | :--- | :--- |
| `Button` | Standardized CTA with min 48dp touch height | `variant`: `primary`, `secondary`, `outline`, `ghost`, `danger`; `size`: `sm`, `md`, `lg`; `loading`, `icon` |
| `IconButton` | Circular accessible touch button | `name`, `size`, `color`, `backgroundColor`, `onPress` |
| `Card` | Uniform bordered & elevated container | `variant`: `elevated`, `outlined`, `flat`; `padding`: `sm`, `md`, `lg` |
| `Badge` | Status indicator pill | `variant`: `success`, `warning`, `error`, `info`, `neutral`, `savory` |
| `Chip` | Interactive toggle pill for filters & categories | `label`, `selected`, `icon`, `count`, `onPress` |
| `PriceText` | Authoritative currency display | `amount`, `size`: `sm`, `md`, `lg`, `bold` |
| `RatingBadge` | Star score with review count | `rating`, `reviewCount`, `size` |
| `FreshnessBadge` | Trust & verification badge | `tier`: `FRESH`, `RECENT`, `AGING`, `STALE`, `UNKNOWN`; `date` |
| `AvailabilityBadge`| Kitchen inventory status | `isAvailable`, `stockStatus`: `LOW_STOCK`, `SOLD_OUT` |
| `DishImage` | Aspect-ratio container with shimmer loader | `uri`, `aspectRatio`, `placeholderEmoji`, `dishName` |
| `EmptyState` | Consistent zero-data fallback | `title`, `description`, `icon`, `actionLabel`, `onAction` |
| `Skeleton` | Content loading placeholder | `width`, `height`, `borderRadius` |

---

## 3. Before vs. After: Screen Transformation Analysis

### 3.1 Customer Home & Discovery
- **Before**: Disconnected cards, differing border radiuses (8px, 16px, 24px mixed), generic restaurant cards without dish pricing or trust badges, no inline cart flow.
- **After**: Food-First discovery hero, desktop max-width centering (800px), uniform `DishCard` displaying authoritative price, distance, rating, freshness verification badge, and direct `+ Add` cart button.

### 3.2 Restaurant Details (`app/restaurant/[id].tsx`)
- **Before**: Cluttered header with conflicting back buttons, un-highlighted searched dish, messy menu list.
- **After**: Immersive restaurant hero with 48dp circular icon buttons, prominent "YOU SEARCHED FOR THIS DISH" highlight card, sticky category chips, and floating cart indicator.

### 3.3 Customer Activity Hub (`app/(tabs)/bookings.tsx`)
- **Before**: Fragmented screens with partial table bookings and orders, inconsistent statuses.
- **After**: Clean segmented control (`[🍽️ Food Orders, 📅 Table Bookings]`), status pills (`Active`, `Completed`, `Cancelled`), visual order progress timeline (`Received ➔ Accepted ➔ Cooking ➔ Ready ➔ Delivered`).

### 3.4 Customer Profile (`app/(tabs)/profile.tsx`)
- **Before**: 1,710-line monolithic developer screen exposing raw DB state, table inspection buttons, raw security PIN fields, and admin tools to regular diners.
- **After**: Decomposed ~300-line clean, secure customer hub with modular dialogs (`AccountSettingsModal`, `PreferencesModal`, `FavoritesModal`, `LanguageModal`) and 100% zero-leak privacy.

---

## 4. Layout Density & Desktop Responsiveness
- All customer screens enforce `containerMaxWidth: 800` on wide screens (iPad, Web, Desktop), centering content with subtle gutters rather than stretching edge-to-edge.
- Vertical rhythm strictly follows the 4-point spacing scale (`Spacing.xs: 8`, `Spacing.sm: 12`, `Spacing.md: 16`, `Spacing.lg: 20`, `Spacing.xl: 24`, `Spacing.xxl: 32`).
