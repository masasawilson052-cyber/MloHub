# MloHub Stage 5: Bundle & Performance Audit

**Date**: September 2026  
**Build Tooling**: Expo SDK 54 / Metro Bundler / Static Web Export  
**Status**: PASSED (0 Errors, 0 Warnings, 18/18 Doctor Checks Passed)

---

## 1. Static Web Export Metrics

- **Total Static Routes Generated**: 24 routes
- **Master JS Bundle**: `entry-fb872e989c75e0384f600935b90d5da9.js` (2.39 MB unminified development export)
- **Module Count**: 907 modules bundled in 13,076 ms

### Route Size Breakdown

| Route Path | Route File | Static HTML Size | Render Status |
| :--- | :--- | :---: | :---: |
| `/` | `app/(tabs)/index.tsx` | 46.0 kB | Static SSG |
| `/(tabs)` | `app/(tabs)/_layout.tsx` | 71.5 kB | Static SSG |
| `/(tabs)/bookings` | `app/(tabs)/bookings.tsx` | 54.1 kB | Static SSG |
| `/(tabs)/custom` | `app/(tabs)/custom.tsx` | 52.3 kB | Static SSG |
| `/(tabs)/explore` | `app/(tabs)/explore.tsx` | 53.2 kB | Static SSG |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | 55.0 kB | Static SSG |
| `/restaurant/[id]` | `app/restaurant/[id].tsx` | 55.9 kB | Dynamic Param SSG |
| `/compare` | `app/compare.tsx` | 41.9 kB | Static SSG |
| `/onboarding` | `app/onboarding.tsx` | 42.9 kB | Static SSG |
| `/auth` | `app/auth/index.tsx` | 46.4 kB | Static SSG |
| `/auth/login` | `app/auth/login.tsx` | 44.7 kB | Static SSG |
| `/auth/register-customer` | `app/auth/register-customer.tsx` | 47.2 kB | Static SSG |
| `/auth/register-restaurant` | `app/auth/register-restaurant.tsx` | 49.5 kB | Static SSG |
| `/auth/forgot-password` | `app/auth/forgot-password.tsx` | 42.6 kB | Static SSG |
| `/admin` | `app/admin/index.tsx` | 42.9 kB | Static SSG |
| `/restaurant-portal` | `app/restaurant-portal/index.tsx` | 41.1 kB | Static SSG |
| `/notifications` | `app/notifications/index.tsx` | 63.6 kB | Static SSG |
| `/notifications/settings` | `app/notifications/settings.tsx` | 52.7 kB | Static SSG |
| `/_sitemap` | Auto-generated sitemap | 39.9 kB | Static SSG |
| `+not-found` | 404 Fallback | 39.9 kB | Static SSG |

---

## 2. Dependency Health & Expo Doctor Audit

`npx expo-doctor` passed **18/18 checks** with 0 warnings:
1. `npm packages compatibility with Expo SDK 54`: All aligned (`@expo/vector-icons@15.0.3`, `expo-image-picker@17.0.11`, `react-native@0.81.5`, `react-native-safe-area-context@5.6.0`, `react-native-screens@4.16.0`, `react-native-web@0.21.0`).
2. `Duplicates in package.json`: None detected.
3. `Native module configuration`: Valid.
4. `TypeScript configuration`: `tsconfig.json` extends `expo/tsconfig.base`.
5. `Environment variables`: `.env` securely loaded with fallback defaults.

---

## 3. Performance & Memory Optimizations

### 3.1 Memory Footprint Reductions
- **Monolith Deconstruction**: Replaced 1,710-line monolithic `profile.tsx` with focused ~300-line screen and on-demand modals (`AccountSettingsModal`, `PreferencesModal`, `FavoritesModal`), slashing component mount time and JS heap pressure.
- **Custom Meals Streamlining**: Shrunk `app/(tabs)/custom.tsx` from 1,137 lines down to 2 distinct steps (Request ➔ Quotes), removing dead mock state loops.

### 3.2 List Virtualization & Image Optimization
- All dish search results and category items utilize clean `FlatList` or `ScrollView` with pagination support (`limit: 20`, `offset: 0`).
- Images employ `DishImage` with shimmer placeholders, error fallbacks to cultural food emojis, and zero layout shift (`aspectRatio: 16/9` or fixed heights).

### 3.3 State Machine & Cart Efficiency
- `CartContext` maintains minimal state: `items[]`, `branchId`, `branchName`, and computed fee properties (`subtotal`, `deliveryFee: 2500`, `serviceFee: 1500`, `total`).
- Pure memoization (`useMemo`, `useCallback`) prevents re-rendering un-impacted dish cards upon cart updates.
