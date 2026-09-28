# MloHub Smart Cart — Final Closure Report

**Date**: 2026-09-26  
**Status**: **CLOSED & PRODUCTION-VERIFIED**  
**Scope**: Final Cart Closure Pass (`services/cart/cartCore.ts`, `context/CartContext.tsx`, `context/CartInteractionContext.tsx`, `components/cart/FloatingCartButton.tsx`, `components/cart/CartMotionOverlay.tsx`, `components/cart/CartDrawer.tsx`, `components/menu/MenuItemCustomizationModal.tsx`, `components/discovery/DishCard.tsx`, `components/discovery/DishDetailModal.tsx`, `app/restaurant/[id].tsx`, `app/compare.tsx`, `app/(tabs)/orders.tsx`, `repositories/menus.repository.ts`, `repositories/orders.repository.ts`, `types/domain.ts`, `tests/cartInteraction.test.ts`)

---

## 1. Executive Summary

This Final Cart Closure Pass resolves all remaining production and interaction defects in the MloHub Smart Cart subsystem while preserving the existing Smart Cart architecture (`CartContext`, `CartInteractionProvider`, `CartMotionOverlay`, `CustomerCartHost`, `FloatingCartButton`, `MenuItemCustomizationModal`, Reanimated curved food-to-cart motion, Haptics, Reduced Motion, modifier-aware cart lines, and cross-restaurant/branch replacement protection).

All production cart state transitions, modifier validation/pricing, fail-closed modifier caching, rapid-tap deduplication, reorder reconciliation, and curved trajectory math are now unified in a single canonical runtime module (`services/cart/cartCore.ts`) imported directly by both production code and automated tests.

---

## 2. Defect-by-Defect Closure Matrix

| # | Defect / Requirement | Root Cause | Production Fix Implemented | Verification |
|---|---|---|---|---|
| **1** | **Cart Target Position Shift (`0 -> 1` items)** | `FloatingCartButton.tsx` previously rendered two separate JSX branches with two separate `ref={cartTargetRef}` nodes (right-aligned empty orb vs left-side count badge inside full-width pill) and re-registered `cartTargetRef` on `totalItems` changes. | Refactored `components/cart/FloatingCartButton.tsx` so there is **one permanent right-anchored `52x52` `cartIconAnchor`** (`ref={cartTargetRef}`) mounted in the exact same bottom-right position across both `totalItems === 0` and `totalItems > 0`. When `totalItems > 0`, `summaryPanel` (`View Meal Order` + `PriceText` subtotal) expands **leftward** from the permanent `cartIconAnchor` while `cartCountBadge` renders on the anchor. Removed `totalItems` from the `registerCartTarget` effect dependency array. | Unit test `Z1` + static scan confirming `ref={cartTargetRef}` count = `1`. |
| **2** | **Customization Confirm vs Cancel Race & Modal Obscuring Flight** | `MenuItemCustomizationModal.tsx` called `onClose()` inside `handleConfirm()` before `await onAddToCart(...)`, which could trigger `handleCustomizationClose()` (`CANCELLED`) before `handleCustomizationAddToCart` ran, and the modal slide-out overlapped the start of the 540ms flight. | Removed `onClose()` from `handleConfirm()` in `MenuItemCustomizationModal.tsx`. In `CartInteractionContext.tsx`, `handleCustomizationAddToCart` sets `customizationHandledRef.current = true`, clears `pendingCustomization`, and awaits `waitForCustomizerExit()` (`InteractionManager.runAfterInteractions` + double `requestAnimationFrame` / 90ms fallback) before calling `addToCart` and launching the 540ms flight. | Unit test `Y1`. |
| **3** | **Modifier Lookup Silent Fail-Open (`return []`)** | `MenuRepository.getModifiersForItem` returned `[]` on Supabase query errors, and `getCachedModifiersForDish` caught errors and cached `[]`, allowing dishes with required modifiers to be added uncustomized during transient network failures. | `MenuRepository.getModifiersForItem` now throws `new Error(\`MODIFIER_LOOKUP_FAILED: \${error.message}\`)` on `groupsError` or `optionsError`. `getCachedModifiersForDish` in `services/cart/cartCore.ts` is fail-closed (never catches/converts errors to `[]` and never caches failed lookups). `CartInteractionProvider.requestAddToCart` catches lookup failures, alerts `'Unable to load meal options'`, skips add/flight/pulse/haptic, and returns `'FAILED'`. `MenuItemCustomizationModal` shows inline retry/cancel UI on fallback load error and disables confirm. | Unit test `W1`. |
| **4** | **Rapid-Tap Duplicate Adds / Modals / Flights** | Rapid taps on `+ Add` could start concurrent modifier lookups, open duplicate modals, or trigger duplicate cart writes while an async lookup was in flight. | Added `createInFlightAddDeduplicator` / `addRequestsInFlightRef` keyed by `${restaurantId}:${branchId ?? ''}:${dishId}` in `CartInteractionContext.tsx`, plus `pendingDishIds` and `isDishAddPending(dishId)`. Added pending/disabled states across `DishCard.tsx`, `DishDetailModal.tsx`, `app/restaurant/[id].tsx`, `app/compare.tsx`, and `isSubmitting` lock in `MenuItemCustomizationModal.tsx`. | Unit test `X1`. |
| **5** | **Duplicated Logic Between Production & Test Engine** | `services/CartInteractionEngine.ts` duplicated pure cart functions from `CartContext.tsx`, `CartInteractionContext.tsx`, `MenuItemCustomizationModal.tsx`, and `CartMotionOverlay.tsx`. | Created `services/cart/cartCore.ts` as the single source of truth imported by `CartContext.tsx`, `CartInteractionContext.tsx`, `MenuItemCustomizationModal.tsx`, `CartMotionOverlay.tsx`, `app/(tabs)/orders.tsx`, and `tests/cartInteraction.test.ts`. Deleted `services/CartInteractionEngine.ts`. | Static scan #4 confirming 1 declaration per function in `services/cart/cartCore.ts`. |
| **6** | **Reorder Bypass (`skipModifierLookup: true`) & Stale Prices** | `app/(tabs)/orders.tsx` passed `skipModifierLookup: true` and historical `priceSnapshot` without checking current item availability, current price, current image, or current modifiers. | Removed `skipModifierLookup` from the codebase. Mapped `selectedModifiers` on `OrderItem` in `orders.repository.ts`. Implemented `prepareReorderItemWithCurrentMenu` and `reconcileHistoricalModifierSelections` in `services/cart/cartCore.ts` and wired `handleReorder` in `app/(tabs)/orders.tsx` to verify current item availability, current `basePrice`, current `imageUrl`, and current modifiers (with historical option prefill and required-choice enforcement). | Unit tests `AB1`, `AB2`, `AB3` + static scan #2 (`0` `skipModifierLookup` in app code). |
| **7** | **CartDrawer Missing Real Dish Thumbnail** | `CartDrawer.tsx` rendered text-only rows without showing the dish's real uploaded photo (`item.imageUrl`). | Added a `56x56` rounded thumbnail (`itemThumbWrap`) in `CartDrawer.tsx` rendering `item.imageUrl` when present and unbroken (`brokenImages` state via `onError`), with a clean theme-aware neutral `restaurant-outline` fallback (`itemThumbPlaceholder`). | Unit test `AA1`. |

---

## 3. Files Created, Modified, and Removed

### Created
- `services/cart/cartCore.ts` — Canonical pure runtime module for cart line signatures, normalization, merging, cross-restaurant/branch replacement, modifier validation, default/reorder selection building, customization pricing, fail-closed modifier lookup caching, in-flight tap deduplication, reorder preparation, and curved flight trajectory math.
- `CART_FINAL_CLOSURE_REPORT.md` — This final closure report.

### Modified
- `context/CartContext.tsx` — Replaced local copies of `createCartLineSignature`, `normalizeCartItemInput`, `mergeCartItemList`, and `processCartAddRequest` with imports/re-exports from `services/cart/cartCore.ts`.
- `context/CartInteractionContext.tsx` — Imported shared logic from `services/cart/cartCore.ts`, removed `skipModifierLookup`, added fail-closed `'FAILED'` outcome on modifier lookup error, added `waitForCustomizerExit()` before cart flight after modal confirm, and added rapid-tap deduplication + `isDishAddPending`.
- `hooks/useCartInteraction.ts` — Exported `CartInteractionOutcome`.
- `components/cart/FloatingCartButton.tsx` — Consolidated into a single permanent right-anchored `52x52` `cartIconAnchor` (`ref={cartTargetRef}`) with leftward-expanding `summaryPanel` when `totalItems > 0`.
- `components/cart/CartMotionOverlay.tsx` — Imported and re-exported `MeasuredRect`, `CartFlightFrame`, `CART_FLIGHT_DURATION_MS`, and `computeCartFlightFrame` from `services/cart/cartCore.ts`.
- `components/cart/CartDrawer.tsx` — Added `56x56` real dish thumbnail (`item.imageUrl`) with `brokenImages` error tracking and neutral `restaurant-outline` placeholder fallback.
- `components/menu/MenuItemCustomizationModal.tsx` — Imported shared validation/pricing/default helpers from `services/cart/cartCore.ts`, added `initialSelectedOptionIds` prop, added fail-closed `modifierLoadError` state with `Retry`/`Cancel` UI, added `isSubmitting` lock, and removed `onClose()` from `handleConfirm()`.
- `components/discovery/DishCard.tsx` — Added `isDishAddPending` button disable and pending state indicator.
- `components/discovery/DishDetailModal.tsx` — Added `isDishAddPending` button disable/pending state and updated `handleAddToCart` to close the modal only on `'ADDED'` or `'REPLACED_CART'`.
- `app/restaurant/[id].tsx` — Added `isDishAddPending` protection and pending feedback on highlighted and menu item Add buttons.
- `app/compare.tsx` — Added `isDishAddPending` protection and pending feedback on comparison Add buttons.
- `app/(tabs)/orders.tsx` — Replaced `skipModifierLookup` reorder loop with `prepareReorderItemWithCurrentMenu` verification of current menu availability, current price, current image, and reconciled modifiers.
- `repositories/menus.repository.ts` — Updated `getModifiersForItem` to throw `MODIFIER_LOOKUP_FAILED` on Supabase `groupsError` or `optionsError` instead of returning `[]`.
- `repositories/orders.repository.ts` — Mapped `selectedModifiers` from `row.selected_modifiers` in `mapRowToOrderItem`.
- `types/domain.ts` — Added `OrderItemModifierSelectionSnapshot` and `selectedModifiers?: OrderItemModifierSelectionSnapshot[]` to `OrderItem`.
- `tests/cartInteraction.test.ts` — Updated to import directly from `../services/cart/cartCore` and added test groups `W`, `X`, `Y`, `Z`, `AA`, and `AB`.

### Removed
- `services/CartInteractionEngine.ts` — Removed duplicate test-only cart engine in favor of `services/cart/cartCore.ts`.

---

## 4. Static Verification Results (Section AG)

1. **Direct `addToCart(` call scan**:
   - Only called inside `context/CartInteractionContext.tsx` (lines 356 and 408) and defined in `context/CartContext.tsx`. All 5 customer add surfaces (`DishCard.tsx`, `DishDetailModal.tsx`, `app/restaurant/[id].tsx`, `app/compare.tsx`, `app/(tabs)/orders.tsx`) route exclusively through `requestAddToCart`.
2. **`skipModifierLookup` scan**:
   - `0` occurrences in production code (`app/`, `components/`, `context/`, `hooks/`, `repositories/`, `services/`).
3. **`imageUrl: coverImage` scan**:
   - `0` occurrences in production code.
4. **Single-definition scan for core cart functions**:
   - `createCartLineSignature`: defined only in `services/cart/cartCore.ts:78`
   - `normalizeCartItemInput`: defined only in `services/cart/cartCore.ts:105`
   - `mergeCartItemList`: defined only in `services/cart/cartCore.ts:137`
   - `processCartAddRequest`: defined only in `services/cart/cartCore.ts:172`
   - `validateModifierSelections`: defined only in `services/cart/cartCore.ts:243`
   - `computeCartFlightFrame`: defined only in `services/cart/cartCore.ts:697`

---

## 5. Automated Test & Build Verification Results

| Verification Gate | Command | Result |
|---|---|---|
| **TypeScript Check** | `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) |
| **Smart Cart Test Suite** | `npm test` (`tests/cartInteraction.test.ts`) | **PASS** (**26 Passed, 0 Failed**) |
| **Full Master Test Suite** | `npm test` (`tests/runAllSuites.ts`) | **PASS** (**1,961 Passed, 0 Failed**) |
| **Production Preflight** | `npm run production:check` | **PASS** (`ready: true`, 15/15 Supabase tables 200 OK) |
| **Expo Web Export** | `npx expo export --platform web --output-dir dist-cart-final-verify` | **PASS** (31 static routes + 4.2 MB web bundle exported) |
| **Expo Android Export** | `npx expo export --platform android --output-dir dist-cart-final-android-verify` | **PASS** (Android Hermes bytecode bundle exported) |

---

## 6. Final Sign-Off

The MloHub Smart Cart phase is **COMPLETE and CLOSED**.
