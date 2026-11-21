/**
 * ============================================================================
 * MLOHUB MENU SCROLL & JUMP MATHEMATICS TEST SUITE
 * ============================================================================
 * Pure mathematical behavior testing of:
 * - jumpTargetY: coordinate computation relative to page ScrollView and sticky header
 * - activeCategoryAt: scroll spy tracking and category boundaries
 * - tabPillScrollX: horizontal tab centering and viewport boundaries
 * ============================================================================
 */

import {
  jumpTargetY,
  activeCategoryAt,
  tabPillScrollX,
} from '../utils/menuScroll';

export async function runMenuScrollTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB MENU SCROLL & TAB JUMP MATHEMATICS SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function record(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const menuContainerY = 500;
  const tabBarHeight = 52;
  const categoryRelativeOffsets: Record<string, number> = {
    'Breakfast & Chai': 0,
    'Pilau & Biryani': 420,
    'Nyama Choma': 860,
    'Seafood': 1300,
  };
  const categories = ['All', 'Breakfast & Chai', 'Pilau & Biryani', 'Nyama Choma', 'Seafood'];

  // --------------------------------------------------------------------------
  // Scenario 1: jumpTargetY calculations
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 1: jumpTargetY calculations ---');

  // Jumping to 'All' should scroll directly to top of menu container minus tab bar height
  const allTarget = jumpTargetY({
    category: 'All',
    menuContainerY,
    categoryRelativeOffsets,
    tabBarHeight,
  });
  record(allTarget === 500 - 52, `jumpTargetY for 'All' lands at menuContainerY - tabBarHeight (${allTarget} === 448)`);

  // Jumping to first category
  const firstTarget = jumpTargetY({
    category: 'Breakfast & Chai',
    menuContainerY,
    categoryRelativeOffsets,
    tabBarHeight,
  });
  record(firstTarget === 500 + 0 - 52, `jumpTargetY for first category lands at 448 (${firstTarget})`);

  // Jumping to Pilau & Biryani
  const biryaniTarget = jumpTargetY({
    category: 'Pilau & Biryani',
    menuContainerY,
    categoryRelativeOffsets,
    tabBarHeight,
  });
  record(
    biryaniTarget === 500 + 420 - 52,
    `jumpTargetY for 'Pilau & Biryani' lands at absoluteY - tabBarHeight (${biryaniTarget} === 868)`
  );

  // Jumping to Nyama Choma
  const chomaTarget = jumpTargetY({
    category: 'Nyama Choma',
    menuContainerY,
    categoryRelativeOffsets,
    tabBarHeight,
  });
  record(
    chomaTarget === 500 + 860 - 52,
    `jumpTargetY for 'Nyama Choma' lands at absoluteY - tabBarHeight (${chomaTarget} === 1308)`
  );

  // Negative offset clamp
  const clampedTarget = jumpTargetY({
    category: 'All',
    menuContainerY: 30,
    categoryRelativeOffsets: {},
    tabBarHeight: 52,
    minScrollY: 0,
  });
  record(clampedTarget === 0, `jumpTargetY clamps negative results to minScrollY (${clampedTarget} === 0)`);

  // --------------------------------------------------------------------------
  // Scenario 2: activeCategoryAt (Scroll Spy) calculations
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: activeCategoryAt (Scroll Spy) calculations ---');

  // Position above the menu container (e.g. at cover photo / decision facts)
  const aboveMenu = activeCategoryAt({
    scrollY: 100,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
  });
  record(aboveMenu === 'All', `Scroll position above menu container returns 'All' (${aboveMenu})`);

  // Position right at the start of the first category
  const atFirstCat = activeCategoryAt({
    scrollY: 450,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
  });
  record(
    atFirstCat === 'Breakfast & Chai',
    `Scroll position at start of first category returns 'Breakfast & Chai' (${atFirstCat})`
  );

  // Position halfway through Pilau & Biryani
  const atBiryani = activeCategoryAt({
    scrollY: 950,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
  });
  record(
    atBiryani === 'Pilau & Biryani',
    `Scroll position at 950px returns 'Pilau & Biryani' (${atBiryani})`
  );

  // Position inside Nyama Choma
  const atChoma = activeCategoryAt({
    scrollY: 1400,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
  });
  record(
    atChoma === 'Nyama Choma',
    `Scroll position at 1400px returns 'Nyama Choma' (${atChoma})`
  );

  // Position deep inside Seafood
  const atSeafood = activeCategoryAt({
    scrollY: 2000,
    menuContainerY,
    categoryRelativeOffsets,
    categories,
    tabBarHeight,
  });
  record(
    atSeafood === 'Seafood',
    `Scroll position at 2000px returns 'Seafood' (${atSeafood})`
  );

  // --------------------------------------------------------------------------
  // Scenario 3: tabPillScrollX horizontal centering
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: tabPillScrollX horizontal scroll calculations ---');

  const tabPillOffsets: Record<string, { x: number; width: number }> = {
    All: { x: 0, width: 60 },
    'Breakfast & Chai': { x: 72, width: 130 },
    'Pilau & Biryani': { x: 214, width: 125 },
    'Nyama Choma': { x: 351, width: 115 },
    Seafood: { x: 478, width: 95 },
  };

  const scrollXAll = tabPillScrollX({
    activeCategory: 'All',
    tabPillOffsets,
    paddingLeft: 32,
  });
  record(scrollXAll === 0, `tabPillScrollX for 'All' returns 0 (${scrollXAll})`);

  const scrollXBiryani = tabPillScrollX({
    activeCategory: 'Pilau & Biryani',
    tabPillOffsets,
    paddingLeft: 32,
  });
  record(
    scrollXBiryani === 214 - 32,
    `tabPillScrollX for 'Pilau & Biryani' scrolls to pill.x - paddingLeft (${scrollXBiryani} === 182)`
  );

  const scrollXUnknown = tabPillScrollX({
    activeCategory: 'Unknown Cat',
    tabPillOffsets,
  });
  record(scrollXUnknown === 0, `tabPillScrollX for unknown category returns 0 (${scrollXUnknown})`);

  console.log('\n================================================================');
  console.log(`✓ ALL MENU SCROLL MATHEMATICS TESTS PASSED: ${passed} checks`);
  console.log('================================================================\n');

  return { passed, failed };
}
