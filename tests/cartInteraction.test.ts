/**
 * ============================================================================
 * MLOHUB SMART CART INTERACTION & REAL FOOD IMAGE INTEGRITY TEST SUITE
 * Imports directly from the canonical production module: ../services/cart/cartCore
 * Covers:
 *   A. CartContext Outcome & State Transitions ('ADDED' | 'REPLACED_CART' | 'CANCELLED')
 *   B. Database Modifier Lookup, Caching & Modal Decision Rules
 *   C. Real Food Image Integrity & Zero Fake Image Substitution
 *   D. Cancelled/Failed Add Motion Guard & Curved Trajectory Math
 *   E. DishDetailModal Single-Transaction Quantity & Unified Entry Points
 *   W. Fail-Closed Modifier Lookup Failure & Retry Behavior
 *   X. Rapid-Tap In-Flight Add Deduplication
 *   Y. Customization Confirm vs Cancel Race Protection & Modal Exit Sequencing
 *   Z. Permanent Single Cart Target Anchor in FloatingCartButton
 *   AA. CartDrawer Real Dish Thumbnail & Neutral Fallback
 *   AB. Reorder with Current Menu, Prices, Images & Modifier Reconciliation
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CART_FLIGHT_DURATION_MS,
  CartStateSnapshot,
  buildDefaultModifierSelections,
  buildInFlightAddKey,
  clearModifierLookupCache,
  computeCartFlightFrame,
  computeCustomizationPricing,
  createCartLineSignature,
  createInFlightAddDeduplicator,
  getCachedModifiersForDish,
  mergeCartItemList,
  normalizeCartItemInput,
  prepareReorderItemWithCurrentMenu,
  primeModifierLookupCache,
  processCartAddRequest,
  reconcileHistoricalModifierSelections,
  resolveAddToCartDecision,
  shouldAnimateFoodToCart,
  validateModifierSelections,
} from '../services/cart/cartCore';
import { MenuItem, MenuModifierGroup } from '../types/domain';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

export async function runCartInteractionTestSuite(): Promise<{
  passedCount: number;
  failedCount: number;
}> {
  passed = 0;
  failed = 0;

  console.log('\n================================================================');
  console.log('🛒 SMART CART INTERACTION & FOOD IMAGE INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // A. CartContext Outcome Tests (Production cartCore)
  // ---------------------------------------------------------------------------
  console.log('Test Group A: CartContext Outcome & State Transitions');

  const emptySnapshot: CartStateSnapshot = {
    items: [],
    restaurantId: null,
    restaurantName: null,
    branchId: null,
    branchName: null,
  };

  // A1: Adding an item to an empty cart resolves 'ADDED'
  const step1 = await processCartAddRequest(
    emptySnapshot,
    {
      dishId: 'dish-pilau-1',
      dishName: 'Beef Pilau',
      restaurantId: 'rest-swahili-1',
      restaurantName: 'Swahili Kitchen',
      branchId: 'branch-masaki-1',
      branchName: 'Masaki Branch',
      priceTzs: 12000,
      imageUrl: 'https://cdn.mlohub.co.tz/dishes/pilau-real.jpg',
    },
    async () => true
  );
  assert(
    step1.outcome === 'ADDED' &&
      step1.state.items.length === 1 &&
      step1.state.items[0].quantity === 1 &&
      step1.state.restaurantId === 'rest-swahili-1',
    'A1: Adding an item to an empty cart resolves ADDED and initializes restaurant/branch context'
  );

  // A2: Adding a second item from the same restaurant/branch resolves 'ADDED'
  const step2 = await processCartAddRequest(
    step1.state,
    {
      dishId: 'dish-kuku-2',
      dishName: 'Chips Kuku',
      restaurantId: 'rest-swahili-1',
      restaurantName: 'Swahili Kitchen',
      branchId: 'branch-masaki-1',
      branchName: 'Masaki Branch',
      priceTzs: 15000,
    },
    async () => true
  );
  assert(
    step2.outcome === 'ADDED' && step2.state.items.length === 2,
    'A2: Adding a second item from the same restaurant/branch resolves ADDED'
  );

  // A3: Adding an item with quantity: 3 increases quantity by 3 in one transaction
  const step3 = await processCartAddRequest(
    step2.state,
    {
      dishId: 'dish-pilau-1',
      dishName: 'Beef Pilau',
      restaurantId: 'rest-swahili-1',
      restaurantName: 'Swahili Kitchen',
      branchId: 'branch-masaki-1',
      branchName: 'Masaki Branch',
      priceTzs: 12000,
      quantity: 3,
      imageUrl: 'https://cdn.mlohub.co.tz/dishes/pilau-real.jpg',
    },
    async () => true
  );
  const pilauInStep3 = step3.state.items.find(
    (i) => i.dishId === 'dish-pilau-1'
  );
  assert(
    step3.outcome === 'ADDED' &&
      step3.state.items.length === 2 &&
      pilauInStep3?.quantity === 4,
    'A3: Adding an item with quantity: 3 increases quantity by 3 in a single transaction (1 + 3 = 4)'
  );

  // A4: Adding an item with different modifiers creates a distinct cart line (cartLineId)
  const step4 = await processCartAddRequest(
    step3.state,
    {
      dishId: 'dish-pilau-1',
      dishName: 'Beef Pilau',
      restaurantId: 'rest-swahili-1',
      restaurantName: 'Swahili Kitchen',
      branchId: 'branch-masaki-1',
      branchName: 'Masaki Branch',
      priceTzs: 14000,
      basePriceTzs: 12000,
      quantity: 1,
      selectedModifiers: [
        {
          group_id: 'grp-kachumbari',
          group_name: 'Sides',
          option_id: 'opt-extra-meat',
          option_name: 'Extra Beef',
          price_delta_tzs: 2000,
        },
      ],
    },
    async () => true
  );
  assert(
    step4.outcome === 'ADDED' &&
      step4.state.items.length === 3 &&
      createCartLineSignature('dish-pilau-1') !==
        createCartLineSignature(
          'dish-pilau-1',
          step4.state.items[2].selectedModifiers
        ),
    'A4: Adding an item with different modifiers creates a distinct cart line (createCartLineSignature)'
  );

  // A5: Adding an item from a different restaurant/branch when user cancels replacement resolves 'CANCELLED' and preserves original cart
  const step5Cancel = await processCartAddRequest(
    step4.state,
    {
      dishId: 'dish-mishkaki-9',
      dishName: 'Mishkaki',
      restaurantId: 'rest-other-99',
      restaurantName: 'Zanzibar Grill',
      branchId: 'branch-upanga-99',
      branchName: 'Upanga Branch',
      priceTzs: 9000,
    },
    async () => false
  );
  assert(
    step5Cancel.outcome === 'CANCELLED' &&
      step5Cancel.state.restaurantId === 'rest-swahili-1' &&
      step5Cancel.state.items.length === 3,
    'A5: Cancelling cross-restaurant cart replacement resolves CANCELLED and preserves original cart'
  );

  // A6: Adding an item from a different restaurant/branch when user confirms replacement resolves 'REPLACED_CART' and replaces cart cleanly
  const step6Replace = await processCartAddRequest(
    step4.state,
    {
      dishId: 'dish-mishkaki-9',
      dishName: 'Mishkaki',
      restaurantId: 'rest-other-99',
      restaurantName: 'Zanzibar Grill',
      branchId: 'branch-upanga-99',
      branchName: 'Upanga Branch',
      priceTzs: 9000,
      quantity: 2,
      imageUrl: 'https://cdn.mlohub.co.tz/dishes/mishkaki-real.jpg',
    },
    async () => true
  );
  assert(
    step6Replace.outcome === 'REPLACED_CART' &&
      step6Replace.state.restaurantId === 'rest-other-99' &&
      step6Replace.state.branchId === 'branch-upanga-99' &&
      step6Replace.state.items.length === 1 &&
      step6Replace.state.items[0].dishId === 'dish-mishkaki-9' &&
      step6Replace.state.items[0].quantity === 2,
    'A6: Confirming cross-restaurant cart replacement resolves REPLACED_CART and replaces cart cleanly'
  );

  // ---------------------------------------------------------------------------
  // B. Modifier Lookup & Modal Decision Tests
  // ---------------------------------------------------------------------------
  console.log('\nTest Group B: Modifier Lookup & Modal Decision Rules');

  clearModifierLookupCache();
  let fetchCountPlain = 0;
  const plainGroups = await getCachedModifiersForDish(
    'dish-plain-ugali',
    async () => {
      fetchCountPlain += 1;
      return [];
    }
  );
  const plainGroupsSecondCall = await getCachedModifiersForDish(
    'dish-plain-ugali',
    async () => {
      fetchCountPlain += 1;
      return [];
    }
  );
  const routePlain = resolveAddToCartDecision({}, plainGroups);
  assert(
    plainGroups.length === 0 &&
      plainGroupsSecondCall.length === 0 &&
      fetchCountPlain === 1 &&
      routePlain === 'DIRECT_ADD',
    'B1: Item with 0 modifier groups in database resolves DIRECT_ADD without opening customization modal and caches lookup'
  );

  const sampleModifierGroups: MenuModifierGroup[] = [
    {
      id: 'grp-spice',
      menuItemId: 'dish-biryani-custom',
      name: 'Spice Level',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 1,
      createdAt: '2026-09-26T00:00:00Z',
      options: [
        {
          id: 'opt-mild',
          groupId: 'grp-spice',
          name: 'Mild',
          priceDeltaTzs: 0,
          isAvailable: true,
          sortOrder: 1,
          createdAt: '2026-09-26T00:00:00Z',
        },
        {
          id: 'opt-hot',
          groupId: 'grp-spice',
          name: 'Hot Pilipili',
          priceDeltaTzs: 500,
          isAvailable: true,
          sortOrder: 2,
          createdAt: '2026-09-26T00:00:00Z',
        },
      ],
    },
    {
      id: 'grp-extras',
      menuItemId: 'dish-biryani-custom',
      name: 'Extras',
      isRequired: false,
      minSelections: 0,
      maxSelections: 2,
      sortOrder: 2,
      createdAt: '2026-09-26T00:00:00Z',
      options: [
        {
          id: 'opt-egg',
          groupId: 'grp-extras',
          name: 'Boiled Egg',
          priceDeltaTzs: 1500,
          isAvailable: true,
          sortOrder: 1,
          createdAt: '2026-09-26T00:00:00Z',
        },
        {
          id: 'opt-kachumbari',
          groupId: 'grp-extras',
          name: 'Extra Kachumbari',
          priceDeltaTzs: 1000,
          isAvailable: true,
          sortOrder: 2,
          createdAt: '2026-09-26T00:00:00Z',
        },
      ],
    },
  ];

  primeModifierLookupCache('dish-biryani-custom', sampleModifierGroups);
  const cachedBiryaniGroups = await getCachedModifiersForDish(
    'dish-biryani-custom',
    async () => []
  );
  const routeCustomized = resolveAddToCartDecision({}, cachedBiryaniGroups);
  assert(
    cachedBiryaniGroups.length === 2 &&
      routeCustomized === 'OPEN_CUSTOMIZATION_MODAL',
    'B2: Item with >= 1 modifier groups in database resolves OPEN_CUSTOMIZATION_MODAL'
  );

  // B3: Required modifier group (isRequired = true, minSelections = 1) blocks confirm until satisfied
  const unsatisfiedSelections = {
    'grp-spice': [],
    'grp-extras': ['opt-kachumbari'],
  };
  const satisfiedSelections = {
    'grp-spice': ['opt-hot'],
    'grp-extras': ['opt-egg', 'opt-kachumbari'],
  };
  const overMaxSelections = {
    'grp-spice': ['opt-hot'],
    'grp-extras': ['opt-egg', 'opt-kachumbari', 'opt-extra-3'],
  };
  assert(
    validateModifierSelections(sampleModifierGroups, unsatisfiedSelections) ===
      false &&
      validateModifierSelections(sampleModifierGroups, satisfiedSelections) ===
        true &&
      validateModifierSelections(sampleModifierGroups, overMaxSelections) ===
        false,
    'B3: Required modifier group blocks confirm until satisfied and enforces maxSelections'
  );

  // B4: Default selections & computeCustomizationPricing calculation
  const defaultsMap = buildDefaultModifierSelections(sampleModifierGroups);
  const pricing = computeCustomizationPricing(
    12000,
    sampleModifierGroups,
    satisfiedSelections,
    2
  );
  assert(
    defaultsMap['grp-spice']?.length === 1 &&
      defaultsMap['grp-spice']?.[0] === 'opt-mild' &&
      pricing.modifiersDelta === 3000 &&
      pricing.unitPrice === 15000 &&
      pricing.totalPrice === 30000,
    'B4: Single-select and multi-select rules initialize defaults and computeCustomizationPricing (12000 + 3000 = 15000 unit, x2 = 30000 TZS) accurately'
  );

  // ---------------------------------------------------------------------------
  // C. Real Food Image Integrity Tests
  // ---------------------------------------------------------------------------
  console.log('\nTest Group C: Real Food Image Integrity & Zero Fake Image Substitution');

  // C1: Item with real imageUrl preserves that exact imageUrl into CartItem.imageUrl
  const realPilauItem = normalizeCartItemInput({
    dishId: 'dish-pilau-real',
    dishName: 'Pilau Nyama',
    restaurantId: 'rest-1',
    restaurantName: 'Mama Ntilie',
    priceTzs: 10000,
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/pilau-nyama.jpg',
  });
  assert(
    realPilauItem.imageUrl ===
      'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/pilau-nyama.jpg',
    'C1: Item with real uploaded imageUrl preserves that exact imageUrl into CartItem.imageUrl'
  );

  // C2: Item without imageUrl stores undefined (never a fake fallback URL, never coverImage)
  const missingImageItem = normalizeCartItemInput({
    dishId: 'dish-no-photo',
    dishName: 'Maharage ya Nazi',
    restaurantId: 'rest-1',
    restaurantName: 'Mama Ntilie',
    priceTzs: 5000,
    imageUrl: '   ',
  });
  assert(
    missingImageItem.imageUrl === undefined,
    'C2: Item without uploaded imageUrl stores undefined (never a fake fallback URL)'
  );

  // C3: Restaurant detail menu item add does NOT pass coverImage as dish.imageUrl
  const restaurantScreenPath = path.resolve(
    __dirname,
    '../app/restaurant/[id].tsx'
  );
  const restaurantScreenSource = fs.readFileSync(restaurantScreenPath, 'utf8');
  assert(
    !restaurantScreenSource.includes('imageUrl: coverImage'),
    'C3: app/restaurant/[id].tsx never passes restaurant coverImage as dish imageUrl'
  );

  // C4: Missing-image item skips flying-image animation and still triggers cart pulse feedback
  const validSourceRect = { x: 24, y: 180, width: 120, height: 120 };
  const validTargetRect = { x: 310, y: 710, width: 52, height: 52 };
  const canAnimateWithRealImage = shouldAnimateFoodToCart({
    outcome: 'ADDED',
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/chips-kuku.jpg',
    sourceRect: validSourceRect,
    targetRect: validTargetRect,
    reduceMotionEnabled: false,
  });
  const canAnimateWithoutImage = shouldAnimateFoodToCart({
    outcome: 'ADDED',
    imageUrl: undefined,
    sourceRect: validSourceRect,
    targetRect: validTargetRect,
    reduceMotionEnabled: false,
  });
  const canAnimateWithReduceMotion = shouldAnimateFoodToCart({
    outcome: 'ADDED',
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/chips-kuku.jpg',
    sourceRect: validSourceRect,
    targetRect: validTargetRect,
    reduceMotionEnabled: true,
  });
  assert(
    canAnimateWithRealImage === true &&
      canAnimateWithoutImage === false &&
      canAnimateWithReduceMotion === false,
    'C4: Flying-image animation runs only when real imageUrl + measured rects exist and Reduced Motion is disabled'
  );

  // ---------------------------------------------------------------------------
  // D. Cancelled Add Guard & Curved Trajectory Math Tests
  // ---------------------------------------------------------------------------
  console.log('\nTest Group D: Cancelled Add Guard & Curved Trajectory Math');

  const canAnimateOnCancel = shouldAnimateFoodToCart({
    outcome: 'CANCELLED',
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/pilau.jpg',
    sourceRect: validSourceRect,
    targetRect: validTargetRect,
    reduceMotionEnabled: false,
  });
  const canAnimateOnFailed = shouldAnimateFoodToCart({
    outcome: 'FAILED',
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/pilau.jpg',
    sourceRect: validSourceRect,
    targetRect: validTargetRect,
    reduceMotionEnabled: false,
  });
  assert(
    canAnimateOnCancel === false && canAnimateOnFailed === false,
    'D1: When addToCart resolves CANCELLED or FAILED, no flying-image animation is triggered'
  );

  const frameStart = computeCartFlightFrame(0, validSourceRect, validTargetRect);
  const frameMid = computeCartFlightFrame(0.5, validSourceRect, validTargetRect);
  const frameEnd = computeCartFlightFrame(1, validSourceRect, validTargetRect);
  const linearMidY = (frameStart.translateY + frameEnd.translateY) / 2;
  assert(
    CART_FLIGHT_DURATION_MS >= 450 &&
      CART_FLIGHT_DURATION_MS <= 650 &&
      Math.abs(frameStart.scale - 1.0) < 0.001 &&
      Math.abs(frameEnd.scale - 0.24) < 0.001 &&
      frameMid.translateY < linearMidY &&
      Math.abs(frameMid.rotateDeg) <= 4.001 &&
      frameEnd.opacity === 0,
    'D2: Curved flight trajectory interpolates along parabolic arc (450-650ms, scale 1.0 -> 0.24, rotation <= 4deg, fade to 0)'
  );

  // ---------------------------------------------------------------------------
  // E. DishDetailModal Single-Transaction Quantity & Unified Entry Points
  // ---------------------------------------------------------------------------
  console.log('\nTest Group E: DishDetailModal Quantity & Unified Entry Points');

  const dishDetailModalPath = path.resolve(
    __dirname,
    '../components/discovery/DishDetailModal.tsx'
  );
  const dishDetailModalSource = fs.readFileSync(dishDetailModalPath, 'utf8');
  const hasLoopAddBug =
    /for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<\s*quantity/.test(
      dishDetailModalSource
    );
  const usesRequestAddToCart = dishDetailModalSource.includes('requestAddToCart');

  const mergedWithQty4 = mergeCartItemList([], {
    dishId: 'dish-samaki-4',
    dishName: 'Samaki wa Kupaka',
    restaurantId: 'rest-coastal-1',
    restaurantName: 'Coastal Flavors',
    branchId: 'branch-1',
    priceTzs: 18000,
    quantity: 4,
    imageUrl: 'https://supabase.mlohub.co.tz/storage/v1/object/public/menus/samaki.jpg',
  });

  assert(
    !hasLoopAddBug &&
      usesRequestAddToCart &&
      mergedWithQty4.length === 1 &&
      mergedWithQty4[0].quantity === 4,
    'E1: Confirming quantity = 4 from DishDetailModal performs a single requestAddToCart transaction with quantity: 4'
  );

  const entryPointFiles = [
    '../components/discovery/DishCard.tsx',
    '../components/discovery/DishDetailModal.tsx',
    '../app/restaurant/[id].tsx',
    '../app/compare.tsx',
    '../app/(tabs)/orders.tsx',
  ];
  const allEntryPointsUseCoordinator = entryPointFiles.every((relPath) => {
    const content = fs.readFileSync(path.resolve(__dirname, relPath), 'utf8');
    return (
      content.includes('requestAddToCart') && !content.includes('addToCart({')
    );
  });
  assert(
    allEntryPointsUseCoordinator,
    'E2: All 5 customer add-to-cart entry points route through requestAddToCart with zero direct addToCart({ bypass calls'
  );

  // ---------------------------------------------------------------------------
  // W. Fail-Closed Modifier Lookup Failure & Retry Behavior
  // ---------------------------------------------------------------------------
  console.log('\nTest Group W: Fail-Closed Modifier Lookup Failure & Retry Behavior');

  clearModifierLookupCache();
  let transientAttempts = 0;
  let firstCallThrew = false;
  try {
    await getCachedModifiersForDish('dish-transient-error', async () => {
      transientAttempts += 1;
      throw new Error('MODIFIER_LOOKUP_FAILED: network timeout');
    });
  } catch {
    firstCallThrew = true;
  }

  const retryGroups = await getCachedModifiersForDish(
    'dish-transient-error',
    async () => {
      transientAttempts += 1;
      return sampleModifierGroups;
    }
  );
  const cachedAfterRetry = await getCachedModifiersForDish(
    'dish-transient-error',
    async () => {
      transientAttempts += 1;
      return [];
    }
  );

  const menusRepoSource = fs.readFileSync(
    path.resolve(__dirname, '../repositories/menus.repository.ts'),
    'utf8'
  );
  const interactionContextSource = fs.readFileSync(
    path.resolve(__dirname, '../context/CartInteractionContext.tsx'),
    'utf8'
  );

  assert(
    firstCallThrew === true &&
      transientAttempts === 2 &&
      retryGroups.length === 2 &&
      cachedAfterRetry.length === 2 &&
      menusRepoSource.includes('MODIFIER_LOOKUP_FAILED') &&
      interactionContextSource.includes("return 'FAILED'"),
    'W1: Modifier lookup failure throws fail-closed error, is never cached as [], retries cleanly on next tap, and returns FAILED in coordinator'
  );

  // ---------------------------------------------------------------------------
  // X. Rapid-Tap In-Flight Add Deduplication
  // ---------------------------------------------------------------------------
  console.log('\nTest Group X: Rapid-Tap In-Flight Add Deduplication');

  const deduplicator = createInFlightAddDeduplicator<string>();
  let executionCounter = 0;
  const keyDish1 = buildInFlightAddKey({
    restaurantId: 'rest-1',
    branchId: 'branch-1',
    dishId: 'dish-1',
  });
  const keyDish2 = buildInFlightAddKey({
    restaurantId: 'rest-1',
    branchId: 'branch-1',
    dishId: 'dish-2',
  });

  const taskFactoryDish1 = () =>
    new Promise<string>((resolve) => {
      executionCounter += 1;
      setTimeout(() => resolve(`ok-${executionCounter}`), 25);
    });

  const [resTap1, resTap2, resTap3] = await Promise.all([
    deduplicator.run(keyDish1, taskFactoryDish1),
    deduplicator.run(keyDish1, taskFactoryDish1),
    deduplicator.run(keyDish1, taskFactoryDish1),
  ]);

  let dish2Counter = 0;
  const [concurrentDish1, concurrentDish2] = await Promise.all([
    deduplicator.run(keyDish1, taskFactoryDish1),
    deduplicator.run(keyDish2, async () => {
      dish2Counter += 1;
      return 'dish2-ok';
    }),
  ]);

  assert(
    executionCounter === 2 &&
      resTap1 === 'ok-1' &&
      resTap2 === 'ok-1' &&
      resTap3 === 'ok-1' &&
      concurrentDish1 === 'ok-2' &&
      concurrentDish2 === 'dish2-ok' &&
      dish2Counter === 1 &&
      deduplicator.isPending(keyDish1) === false,
    'X1: Rapid concurrent taps for the same dish share 1 in-flight operation, different dishes proceed concurrently, and subsequent tap after completion runs normally'
  );

  // ---------------------------------------------------------------------------
  // Y. Customization Confirm vs Cancel Race Protection & Modal Exit Sequencing
  // ---------------------------------------------------------------------------
  console.log('\nTest Group Y: Customization Confirm vs Cancel Race & Modal Exit Sequencing');

  const customizationModalSource = fs.readFileSync(
    path.resolve(__dirname, '../components/menu/MenuItemCustomizationModal.tsx'),
    'utf8'
  );
  const handleConfirmBlockMatch = customizationModalSource.match(
    /const handleConfirm = async \(\) => \{[\s\S]*?await onAddToCart\(/
  );
  const handleConfirmCallsOnCloseBeforeAdd = Boolean(
    handleConfirmBlockMatch && handleConfirmBlockMatch[0].includes('onClose()')
  );
  const providerAwaitsModalExitBeforeAdd =
    /customizationHandledRef\.current\s*=\s*true;[\s\S]*?setPendingCustomization\(null\);[\s\S]*?await waitForCustomizerExit\(\);[\s\S]*?await addToCart\(/.test(
      interactionContextSource
    );

  assert(
    !handleConfirmCallsOnCloseBeforeAdd &&
      providerAwaitsModalExitBeforeAdd &&
      customizationModalSource.includes('modifierLoadError') &&
      customizationModalSource.includes('isSubmitting'),
    'Y1: MenuItemCustomizationModal handleConfirm never calls onClose() before onAddToCart, and CartInteractionProvider marks customizationHandledRef + awaits modal exit before flight'
  );

  // ---------------------------------------------------------------------------
  // Z. Permanent Single Cart Target Anchor in FloatingCartButton
  // ---------------------------------------------------------------------------
  console.log('\nTest Group Z: Permanent Single Cart Target Anchor in FloatingCartButton');

  const floatingCartSource = fs.readFileSync(
    path.resolve(__dirname, '../components/cart/FloatingCartButton.tsx'),
    'utf8'
  );
  const cartTargetRefOccurrences =
    floatingCartSource.match(/ref=\{cartTargetRef\}/g) || [];
  const registerEffectHasTotalItemsDep =
    /registerCartTarget\(cartTargetRef\)[\s\S]{0,120}totalItems/.test(
      floatingCartSource
    );

  assert(
    cartTargetRefOccurrences.length === 1 &&
      !registerEffectHasTotalItemsDep &&
      floatingCartSource.includes('cartIconAnchor') &&
      floatingCartSource.includes('summaryPanel'),
    'Z1: FloatingCartButton mounts exactly one permanent right-anchored cartTargetRef across empty and populated states without re-registering on totalItems change'
  );

  // ---------------------------------------------------------------------------
  // AA. CartDrawer Real Dish Thumbnail & Neutral Fallback
  // ---------------------------------------------------------------------------
  console.log('\nTest Group AA: CartDrawer Real Dish Thumbnail & Neutral Fallback');

  const cartDrawerSource = fs.readFileSync(
    path.resolve(__dirname, '../components/cart/CartDrawer.tsx'),
    'utf8'
  );
  assert(
    cartDrawerSource.includes('source={{ uri: item.imageUrl }}') &&
      cartDrawerSource.includes('itemThumbWrap') &&
      cartDrawerSource.includes('itemThumbPlaceholder') &&
      cartDrawerSource.includes('setBrokenImages') &&
      !cartDrawerSource.includes('coverImage'),
    'AA1: CartDrawer renders 56x56 real dish thumbnail for item.imageUrl and falls back to neutral placeholder on missing/broken image'
  );

  // ---------------------------------------------------------------------------
  // AB. Reorder with Current Menu, Prices, Images & Modifier Reconciliation
  // ---------------------------------------------------------------------------
  console.log('\nTest Group AB: Reorder with Current Menu, Prices, Images & Modifiers');

  const mockCurrentItem: MenuItem = {
    id: 'dish-biryani-custom',
    restaurantId: 'rest-1',
    name: 'Special Chicken Biryani',
    nameEn: 'Special Chicken Biryani',
    nameSw: 'Biryani ya Kuku Maalum',
    description: 'Fragrant basmati rice with spiced chicken',
    basePrice: 16500, // updated current price (historical was 13000)
    category: 'Biryani & Rice',
    imageUrl: 'https://cdn.mlohub.co.tz/dishes/biryani-current.jpg',
    isAvailable: true,
    isArchived: false,
    createdAt: '2026-09-26T00:00:00Z',
    updatedAt: '2026-09-26T00:00:00Z',
  };

  // AB1: Unavailable or archived item returns UNAVAILABLE
  const unavailablePrep = await prepareReorderItemWithCurrentMenu({
    menuItemId: 'dish-biryani-custom',
    fetchMenuItem: async () => ({ ...mockCurrentItem, isAvailable: false }),
    fetchModifiers: async () => [],
  });
  assert(
    unavailablePrep.status === 'UNAVAILABLE',
    'AB1: Reordering an unavailable or archived menu item fails closed with UNAVAILABLE'
  );

  // AB2: Plain item reorder uses current basePrice and current imageUrl with DIRECT_ADD
  const plainPrep = await prepareReorderItemWithCurrentMenu({
    menuItemId: 'dish-biryani-custom',
    fetchMenuItem: async () => mockCurrentItem,
    fetchModifiers: async () => [],
  });
  assert(
    plainPrep.status === 'READY' &&
      plainPrep.route === 'DIRECT_ADD' &&
      plainPrep.currentItem.basePrice === 16500 &&
      plainPrep.currentItem.imageUrl ===
        'https://cdn.mlohub.co.tz/dishes/biryani-current.jpg',
    'AB2: Reordering an item with 0 current modifier groups uses current menu price (16500) and current real imageUrl via DIRECT_ADD'
  );

  // AB3: Customized item reorder reconciles historical modifiers against current available options
  const customPrepWithValidHistory = await prepareReorderItemWithCurrentMenu({
    menuItemId: 'dish-biryani-custom',
    historicalModifiers: [
      { group_id: 'grp-spice', option_id: 'opt-hot' },
      { group_id: 'grp-extras', option_id: 'opt-removed-option' },
      { group_id: 'grp-extras', option_id: 'opt-egg' },
    ],
    fetchMenuItem: async () => mockCurrentItem,
    fetchModifiers: async () => sampleModifierGroups,
  });

  const customPrepWithRemovedRequiredChoice =
    await prepareReorderItemWithCurrentMenu({
      menuItemId: 'dish-biryani-custom',
      historicalModifiers: [
        { group_id: 'grp-spice', option_id: 'opt-discontinued-spice' },
      ],
      fetchMenuItem: async () => mockCurrentItem,
      fetchModifiers: async () => sampleModifierGroups,
    });

  const ordersScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../app/(tabs)/orders.tsx'),
    'utf8'
  );

  assert(
    customPrepWithValidHistory.status === 'READY' &&
      customPrepWithValidHistory.route === 'OPEN_CUSTOMIZATION_MODAL' &&
      customPrepWithValidHistory.initialSelectedOptionIds['grp-spice']?.[0] ===
        'opt-hot' &&
      customPrepWithValidHistory.initialSelectedOptionIds['grp-extras']?.length ===
        1 &&
      customPrepWithValidHistory.initialSelectedOptionIds['grp-extras']?.[0] ===
        'opt-egg' &&
      customPrepWithRemovedRequiredChoice.status === 'READY' &&
      customPrepWithRemovedRequiredChoice.initialSelectedOptionIds['grp-spice']
        ?.length === 0 &&
      validateModifierSelections(
        sampleModifierGroups,
        buildDefaultModifierSelections(
          sampleModifierGroups,
          customPrepWithRemovedRequiredChoice.initialSelectedOptionIds
        )
      ) === false &&
      !ordersScreenSource.includes('skipModifierLookup') &&
      ordersScreenSource.includes('prepareReorderItemWithCurrentMenu'),
    'AB3: Reordering a dish with modifiers routes through customization with reconciled historical options, blocks removed required choices until re-selected, and never uses skipModifierLookup'
  );

  console.log(
    `\nSmart Cart Interaction Summary: ${passed} Passed, ${failed} Failed`
  );
  return { passedCount: passed, failedCount: failed };
}
