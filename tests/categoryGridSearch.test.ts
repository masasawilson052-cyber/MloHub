/**
 * ============================================================================
 * MLOHUB CATEGORY GRID & MULTI-CHANNEL SEARCH BEHAVIOUR TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Category schema integrity (8 categories, bilingual labels, icons, keywords)
 * 2. Multi-channel search behaviour (parallel cuisine + keyword dispatches)
 * 3. De-duplication by dish id, best-score retention, and active sort behaviour
 * 4. Empty cuisineTypes handling for Healthy & Light
 */

import { FOOD_CATEGORIES, getCategoryById } from '../config/foodCategories';
import { searchByCategory, sortDishes } from '../services/categorySearch';
import { DiscoveryService } from '../services/DiscoveryService';
import { DishDiscoveryResult, DiscoveryQuery } from '../types/discovery';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

function createMockDish(
  menuItemId: string,
  dishName: string,
  priceTzs: number,
  rating: number,
  score: number
): DishDiscoveryResult {
  return {
    menuItemId,
    dishName,
    restaurantId: 'rest_test_1',
    restaurantName: 'Test Kitchen',
    branchId: 'branch_test_1',
    branchName: 'Main Branch',
    neighborhood: 'Mikocheni',
    priceTzs,
    basePriceTzs: priceTzs,
    currency: 'TZS',
    distanceKm: 1.2,
    restaurantRating: rating,
    reviewCount: 42,
    isAvailable: true,
    isOpenNow: true,
    stockStatus: 'IN_STOCK',
    openingHoursSummary: '08:00 - 22:00',
    freshnessTier: 'FRESH',
    freshnessScore: 95,
    scores: {
      overallScore: score,
      relevanceScore: score,
      distanceScore: 90,
      priceScore: 85,
      ratingScore: 92,
      freshnessScore: 95,
      availabilityScore: 100,
    },
  };
}

export async function runCategoryGridSearchTestSuite(): Promise<{ passed: number; failed: number }> {
  passed = 0;
  failed = 0;
  console.log('\n================================================================');
  console.log('🧪 CATEGORY GRID & MULTI-CHANNEL DISCOVERY BEHAVIOUR SUITE');
  console.log('================================================================\n');

  // --- Group 1: Category Configuration Invariants ---
  console.log('--- Group 1: Category Configuration Invariants ---');
  assert(FOOD_CATEGORIES.length === 8, '8 craving categories configured');

  const requiredIds = [
    'breakfast-chai',
    'pilau-biryani',
    'chipsi-street-food',
    'nyama-choma-grill',
    'seafood-samaki',
    'mama-ntilie',
    'juice-snacks',
    'healthy-light',
  ];

  for (const id of requiredIds) {
    const cat = getCategoryById(id);
    assert(cat !== undefined, `Category "${id}" exists`);
    if (cat) {
      assert(cat.labelEn.length > 0 && cat.labelSw.length > 0, `Category "${id}" has both English and Swahili labels`);
      assert(cat.icon.length > 0, `Category "${id}" has an icon identifier`);
      assert(Array.isArray(cat.searchKeywords) && cat.searchKeywords.length === 3, `Category "${id}" defines exactly 3 top keywords`);
    }
  }

  const healthyCat = getCategoryById('healthy-light');
  assert(
    healthyCat !== undefined && Array.isArray(healthyCat.cuisineTypes) && healthyCat.cuisineTypes.length === 0,
    'Healthy & Light has empty cuisineTypes array (keywords only per spec)'
  );

  const pilauCat = getCategoryById('pilau-biryani');
  assert(
    pilauCat !== undefined && pilauCat.cuisineTypes.includes('Coastal & Biryani'),
    'Pilau & Biryani maps to database cuisine "Coastal & Biryani"'
  );

  // --- Group 2: Parallel Search Behaviour & Parameter Forwarding ---
  console.log('\n--- Group 2: Multi-Channel Parallel Search Behaviour ---');

  const recordedCalls: DiscoveryQuery[] = [];
  const originalSearchDishes = DiscoveryService.searchDishes;

  // Intercept DiscoveryService.searchDishes to observe dispatched queries
  DiscoveryService.searchDishes = async (query: DiscoveryQuery) => {
    recordedCalls.push({ ...query });

    // Return synthetic results depending on query parameters
    if (query.cuisineTypes?.includes('Coastal & Biryani')) {
      return {
        results: [
          createMockDish('dish_biryani_1', 'Zanzibar Goat Biryani', 14000, 4.8, 88),
          createMockDish('dish_shared_1', 'Special Spiced Pilau', 12000, 4.6, 75),
        ],
        totalCount: 2,
        query,
      };
    }
    if (query.query === 'Biryani') {
      return {
        results: [
          createMockDish('dish_biryani_1', 'Zanzibar Goat Biryani', 14000, 4.8, 92), // Higher score
          createMockDish('dish_chicken_biryani', 'Chicken Biryani', 13000, 4.7, 86),
        ],
        totalCount: 2,
        query,
      };
    }
    if (query.query === 'Pilau') {
      return {
        results: [
          createMockDish('dish_shared_1', 'Special Spiced Pilau', 12000, 4.6, 89), // Higher score
        ],
        totalCount: 1,
        query,
      };
    }
    if (query.query === 'Wali') {
      return {
        results: [
          createMockDish('dish_wali_maharage', 'Wali Maharage ya Nazi', 6000, 4.5, 70),
        ],
        totalCount: 1,
        query,
      };
    }
    if (query.query === 'Salad') {
      return {
        results: [createMockDish('dish_salad_1', 'Tropical Fruit Salad', 7000, 4.9, 90)],
        totalCount: 1,
        query,
      };
    }
    if (query.query === 'Supu') {
      return {
        results: [createMockDish('dish_supu_1', 'Supu ya Kienyeji', 8000, 4.7, 85)],
        totalCount: 1,
        query,
      };
    }
    if (query.query === 'Matunda') {
      return {
        results: [createMockDish('dish_matunda_1', 'Fresh Fruit Platter', 5000, 4.8, 80)],
        totalCount: 1,
        query,
      };
    }

    return { results: [], totalCount: 0, query };
  };

  try {
    // 2.1 Test Pilau & Biryani Category Search
    recordedCalls.length = 0;
    const baseFilters = {
      maxDistanceKm: 7,
      maxPriceTzs: 20000,
      openNow: true,
      neighborhood: 'Mikocheni',
      availableOnly: true,
    };

    const pilauResponse = await searchByCategory(pilauCat!, baseFilters, 'RECOMMENDED');

    assert(recordedCalls.length === 4, 'Category with cuisineTypes executes 4 parallel calls (1 cuisine + 3 keywords)');

    // Verify parameter forwarding to all parallel search calls
    const allForwardedFilters = recordedCalls.every(
      (c) => c.maxDistanceKm === 7 && c.maxPriceTzs === 20000 && c.openNow === true && c.neighborhood === 'Mikocheni'
    );
    assert(allForwardedFilters, 'Every parallel search call forwards distance, budget, openNow, and area filters');

    const cuisineCall = recordedCalls.find((c) => c.cuisineTypes?.includes('Coastal & Biryani'));
    assert(cuisineCall !== undefined, 'One search call specifically filtered by p_cuisine_types = ["Coastal & Biryani"]');

    const keywordCalls = recordedCalls.filter((c) => c.query && !c.cuisineTypes).map((c) => c.query);
    assert(
      keywordCalls.includes('Biryani') && keywordCalls.includes('Pilau') && keywordCalls.includes('Wali'),
      'Search calls made individually for each of top 3 keywords ("Biryani", "Pilau", "Wali")'
    );

    // --- Group 3: Merging, De-duplication and Scoring ---
    console.log('\n--- Group 3: Merging, De-duplication & Scoring ---');

    // Total unique dishes expected: dish_biryani_1, dish_shared_1, dish_chicken_biryani, dish_wali_maharage (4 items)
    assert(pilauResponse.results.length === 4, 'Merged results de-duplicate duplicate dishes across search channels');

    const biryaniDish = pilauResponse.results.find((d) => d.menuItemId === 'dish_biryani_1');
    assert(biryaniDish?.scores.overallScore === 92, 'De-duplication retains the highest score (92 over 88)');

    const sharedDish = pilauResponse.results.find((d) => d.menuItemId === 'dish_shared_1');
    assert(sharedDish?.scores.overallScore === 89, 'De-duplication retains the highest score (89 over 75)');

    // Test active sort behavior: CHEAPEST
    const cheapestSorted = await searchByCategory(pilauCat!, baseFilters, 'CHEAPEST');
    assert(cheapestSorted.results[0].priceTzs === 6000, 'CHEAPEST sort orders lowest price first (TZS 6,000)');
    assert(cheapestSorted.results[cheapestSorted.results.length - 1].priceTzs === 14000, 'CHEAPEST sort orders highest price last (TZS 14,000)');

    // --- Group 4: Healthy & Light Keyword-Only Search ---
    console.log('\n--- Group 4: Healthy & Light (Keywords Only) ---');

    recordedCalls.length = 0;
    const healthyResponse = await searchByCategory(healthyCat!, baseFilters, 'RECOMMENDED');

    assert(recordedCalls.length === 3, 'Healthy & Light executes exactly 3 keyword calls (zero cuisine calls)');
    const healthyCuisineCalls = recordedCalls.filter((c) => c.cuisineTypes && c.cuisineTypes.length > 0);
    assert(healthyCuisineCalls.length === 0, 'Zero cuisine calls made for Healthy & Light');

    const healthyKeywords = recordedCalls.map((c) => c.query);
    assert(
      healthyKeywords.includes('Salad') && healthyKeywords.includes('Supu') && healthyKeywords.includes('Matunda'),
      'Healthy & Light queries top keywords ["Salad", "Supu", "Matunda"]'
    );
    assert(healthyResponse.results.length === 3, 'Healthy & Light returns merged results from all 3 keyword channels');
  } finally {
    // Restore original function
    DiscoveryService.searchDishes = originalSearchDishes;
  }

  console.log('\n================================================================');
  console.log(`🏁 CATEGORY GRID SEARCH TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runCategoryGridSearchTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
