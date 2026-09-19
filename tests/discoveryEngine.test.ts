import { DiscoveryRepository } from '../repositories/discovery.repository';
import { DiscoveryService } from '../services/DiscoveryService';
import { expandSearchTerms, getSwahiliEquivalent, getEnglishEquivalent } from '../config/foodSynonyms';
import {
  calculateRelevanceScore,
  calculateDistanceScore,
  calculatePriceScore,
  calculateRatingScore,
  calculateFreshnessFromTier,
  calculateAvailabilityScore,
  computeCompositeScore,
} from '../config/discoveryRanking';
import { formatTzs, formatDistance, calculateFreshnessScore, isOpenNow } from '../utils/formatters';

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

export async function runDiscoveryEngineTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  passed = 0;
  failed = 0;
  console.log('\n================================================================');
  console.log('🧪 STAGE 4: FOOD-FIRST DISCOVERY ENGINE TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // GROUP 1: Formatting Utilities
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Formatting Utilities (TZS, Distance, Freshness)');
  assert(formatTzs(11000) === 'TZS 11,000', 'formatTzs(11000) outputs "TZS 11,000"');
  assert(formatTzs(9500) === 'TZS 9,500', 'formatTzs(9500) outputs "TZS 9,500"');
  assert(formatTzs(0) === 'TZS 0', 'formatTzs(0) outputs "TZS 0"');

  assert(formatDistance(0.35) === '350 m', 'formatDistance(0.35) outputs "350 m"');
  assert(formatDistance(0.8) === '800 m', 'formatDistance(0.8) outputs "800 m"');
  assert(formatDistance(1.3) === '1.3 km', 'formatDistance(1.3) outputs "1.3 km"');
  assert(formatDistance(5.2) === '5.2 km', 'formatDistance(5.2) outputs "5.2 km"');

  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const freshRes = calculateFreshnessScore(twoHoursAgo);
  assert(freshRes.tier === 'FRESH', 'Verification 2 hours ago is classified as FRESH tier');
  assert(freshRes.score >= 95, 'FRESH tier has score >= 95');
  assert(freshRes.label === 'Verified 2h ago', 'FRESH tier label is "Verified 2h ago"');

  const staleRes = calculateFreshnessScore(new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString());
  assert(staleRes.tier === 'STALE', 'Verification 10 days ago is classified as STALE');
  assert(staleRes.score <= 30, 'STALE tier has score <= 30');

  const unknownRes = calculateFreshnessScore(null);
  assert(unknownRes.tier === 'UNKNOWN', 'Null timestamp is classified as UNKNOWN');

  assert(isOpenNow('08:00 AM - 10:00 PM') !== 'UNKNOWN', 'Simple hours string parsed');

  // ---------------------------------------------------------------------------
  // GROUP 2: Bilingual Swahili-English Synonym Dictionary
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Bilingual Swahili-English Synonym Dictionary');
  assert(getSwahiliEquivalent('chicken') === 'kuku', 'getSwahiliEquivalent("chicken") returns "kuku"');
  assert(getEnglishEquivalent('samaki') === 'fish', 'getEnglishEquivalent("samaki") returns "fish"');
  assert(getSwahiliEquivalent('fries') === 'chipsi', 'getSwahiliEquivalent("fries") returns "chipsi"');
  assert(getEnglishEquivalent('wali') === 'rice', 'getEnglishEquivalent("wali") returns "rice"');

  const expandedBiryani = expandSearchTerms('chicken biryani');
  assert(expandedBiryani.includes('kuku'), 'Search "chicken biryani" expands to include Swahili "kuku"');
  assert(expandedBiryani.includes('biriani'), 'Search "chicken biryani" expands to include Swahili "biriani"');

  const expandedSamaki = expandSearchTerms('samaki wa kukaanga');
  assert(expandedSamaki.includes('fish'), 'Search "samaki" expands to include English "fish"');

  // ---------------------------------------------------------------------------
  // GROUP 3: Multi-Factor Discovery Ranking Calculations
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: Multi-Factor Discovery Ranking Calculations');

  // 1. Relevance: Exact dish name strictly outranks restaurant name
  const exactDishRelevance = calculateRelevanceScore({
    query: 'Chicken Biryani',
    dishName: 'Chicken Biryani',
    restaurantName: 'Mama Amina Biryani House',
  });
  const restaurantOnlyRelevance = calculateRelevanceScore({
    query: 'Chicken Biryani',
    dishName: 'Ugali Nyama',
    restaurantName: 'Chicken Biryani Restaurant',
  });
  assert(exactDishRelevance === 100, 'Exact dish name match scores 100');
  assert(restaurantOnlyRelevance < 50, 'Restaurant name-only match scores < 50');
  assert(exactDishRelevance > restaurantOnlyRelevance, 'Dish match strictly outranks restaurant-only match');

  // 2. Distance Score
  const distClose = calculateDistanceScore(0.5, 5);
  const distFar = calculateDistanceScore(4.5, 5);
  assert(distClose > distFar, 'Closer dish (0.5 km) receives higher distance score than far dish (4.5 km)');

  // 3. Price Fit Score
  const budgetPriceFit = calculatePriceScore({ priceTzs: 9500, budgetTzs: 12000 });
  const overBudgetFit = calculatePriceScore({ priceTzs: 16000, budgetTzs: 12000 });
  assert(budgetPriceFit >= 80, 'Price within budget scores >= 80');
  assert(overBudgetFit < 40, 'Price exceeding budget receives penalty (< 40)');

  // 4. Composite Score
  const composite = computeCompositeScore({
    relevanceScore: 100,
    distanceScore: 90,
    priceScore: 85,
    ratingScore: 95,
    freshnessScore: 100,
    availabilityScore: 95,
  });
  assert(composite.overallScore > 90, 'High-performing dish achieves overall MloHub Score > 90');

  // ---------------------------------------------------------------------------
  // GROUP 4: Food-First Dish Discovery Queries & Filtering
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: Food-First Dish Discovery Filtering');

  // 1. Exact dish search
  const biryaniResults = await DiscoveryRepository.searchDishes({
    query: 'Chicken Biryani',
    neighborhood: 'Mikocheni',
  });
  assert(biryaniResults.length > 0, 'Dishes returned for "Chicken Biryani" query');
  assert(
    biryaniResults.every((d) => d.dishName.toLowerCase().includes('biryani')),
    'Returned dishes are Biryani items'
  );

  // 2. Budget filter (<= 10,000 TZS)
  const budgetResults = await DiscoveryRepository.searchDishes({
    query: 'Biryani',
    maxPriceTzs: 10000,
  });
  assert(budgetResults.length > 0, 'Found biryani within 10,000 TZS budget');
  assert(
    budgetResults.every((d) => d.priceTzs <= 10000),
    'All returned items respect maxPriceTzs <= 10,000'
  );

  // 3. Distance filter (<= 1.0 km from Mikocheni center)
  const nearbyResults = await DiscoveryRepository.searchDishes({
    latitude: -6.7645,
    longitude: 39.2450,
    maxDistanceKm: 1.0,
  });
  assert(nearbyResults.length > 0, 'Found nearby dishes');
  assert(
    nearbyResults.every((d) => d.distanceKm <= 1.0),
    'All returned items respect maxDistanceKm <= 1.0'
  );

  // 4. Availability filter
  const availResults = await DiscoveryRepository.searchDishes({
    availableOnly: true,
  });
  assert(
    availResults.every((d) => d.isAvailable === true),
    'availableOnly=true returns only in-stock dishes'
  );

  // ---------------------------------------------------------------------------
  // GROUP 5: Sorting Modes
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Discovery Sorting Modes');

  // Nearest sort
  const nearest = await DiscoveryRepository.searchDishes({
    latitude: -6.7645,
    longitude: 39.2450,
    sortBy: 'NEAREST',
    limit: 5,
  });
  assert(nearest.length >= 2, 'Loaded items for NEAREST sort');
  for (let i = 0; i < nearest.length - 1; i++) {
    assert(nearest[i].distanceKm <= nearest[i + 1].distanceKm, `Distance ${nearest[i].distanceKm} <= ${nearest[i + 1].distanceKm}`);
  }

  // Cheapest sort
  const cheapest = await DiscoveryRepository.searchDishes({
    sortBy: 'CHEAPEST',
    limit: 5,
  });
  assert(cheapest.length >= 2, 'Loaded items for CHEAPEST sort');
  for (let i = 0; i < cheapest.length - 1; i++) {
    assert(cheapest[i].priceTzs <= cheapest[i + 1].priceTzs, `Price ${cheapest[i].priceTzs} <= ${cheapest[i + 1].priceTzs}`);
  }

  // Highest rated sort
  const topRated = await DiscoveryRepository.searchDishes({
    sortBy: 'HIGHEST_RATED',
    limit: 5,
  });
  assert(topRated.length >= 2, 'Loaded items for HIGHEST_RATED sort');
  for (let i = 0; i < topRated.length - 1; i++) {
    assert(topRated[i].restaurantRating >= topRated[i + 1].restaurantRating, `Rating ${topRated[i].restaurantRating} >= ${topRated[i + 1].restaurantRating}`);
  }

  // ---------------------------------------------------------------------------
  // GROUP 6: Autocomplete & Suggestions
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Search Autocomplete & Suggestions');
  const suggestionsBiryani = DiscoveryService.getAutocompleteSuggestions('bir');
  assert(suggestionsBiryani.length > 0, 'Autocomplete suggestions returned for "bir"');
  assert(
    suggestionsBiryani.some((s) => s.text.toLowerCase().includes('biryani')),
    'Suggestions contain "Chicken Biryani"'
  );

  const suggestionsChips = DiscoveryService.getAutocompleteSuggestions('chip');
  assert(
    suggestionsChips.some((s) => s.text.toLowerCase().includes('chipsi')),
    'Suggestions contain "Chipsi Kuku"'
  );

  // ---------------------------------------------------------------------------
  // GROUP 7: Deterministic Investor Demo Scenario
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: Deterministic Investor Demo Scenario Verification');
  console.log('  Scenario: "Chicken Biryani" in "Mikocheni" with Budget <= 12,000 TZS');

  const demoSearch = await DiscoveryService.searchDishes({
    query: 'Chicken Biryani',
    neighborhood: 'Mikocheni',
    maxPriceTzs: 12000,
    maxDistanceKm: 5,
    sortBy: 'RECOMMENDED',
  });

  assert(demoSearch.results.length >= 3, `Demo scenario returned ${demoSearch.results.length} dishes (>= 3 expected)`);

  const mamaAminaResult = demoSearch.results.find((d) => d.restaurantId === 'mama-amina-biryani');
  assert(mamaAminaResult !== undefined, 'Mama Amina Biryani House appears in results');
  if (mamaAminaResult) {
    assert(mamaAminaResult.priceTzs === 11000, `Mama Amina Biryani price is TZS 11,000 (got ${mamaAminaResult.priceTzs})`);
    assert(mamaAminaResult.distanceKm <= 1.0, `Mama Amina distance is <= 1.0 km (got ${mamaAminaResult.distanceKm})`);
    assert(mamaAminaResult.restaurantRating >= 4.8, `Mama Amina rating is >= 4.8 (got ${mamaAminaResult.restaurantRating})`);
    assert(mamaAminaResult.isAvailable === true, 'Mama Amina Biryani is marked Available');
    assert(mamaAminaResult.freshnessTier === 'FRESH', 'Mama Amina Biryani has FRESH verification tier');
  }

  const biryaniHubResult = demoSearch.results.find((d) => d.restaurantId === 'biryani-hub-mikocheni');
  assert(biryaniHubResult !== undefined, 'Biryani Hub Mikocheni appears in results');
  if (biryaniHubResult) {
    assert(biryaniHubResult.priceTzs === 9500, `Biryani Hub price is TZS 9,500 (got ${biryaniHubResult.priceTzs})`);
    assert(biryaniHubResult.distanceKm <= 1.5, `Biryani Hub distance is <= 1.5 km (got ${biryaniHubResult.distanceKm})`);
  }

  const spiceHouseResult = demoSearch.results.find((d) => d.restaurantId === 'spice-house-mikocheni');
  assert(spiceHouseResult !== undefined, 'Spice House Restaurant appears in results');
  if (spiceHouseResult) {
    assert(spiceHouseResult.priceTzs === 12000, `Spice House price is TZS 12,000 (got ${spiceHouseResult.priceTzs})`);
  }

  // ---------------------------------------------------------------------------
  // GROUP 8: Discovery Zero-Leak Security Audit
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 8: Zero-Leak Discovery Privacy & Security Audit');
  const sampleResult = demoSearch.results[0];

  assert((sampleResult as any).tinNumber === undefined, 'Discovery result does not leak tinNumber');
  assert((sampleResult as any).bankAccountDetails === undefined, 'Discovery result does not leak bankAccountDetails');
  assert((sampleResult as any).lipaNumber === undefined, 'Discovery result does not leak raw lipaNumber');
  assert((sampleResult as any).payoutProvider === undefined, 'Discovery result does not leak payoutProvider');
  assert((sampleResult as any).ownerNationalId === undefined, 'Discovery result does not leak ownerNationalId');
  assert((sampleResult as any).ownerPhone === undefined, 'Discovery result does not leak ownerPhone');
  assert((sampleResult as any).passwordHash === undefined, 'Discovery result does not leak passwordHash');

  console.log('\n======================================================');
  console.log(`🏁 DISCOVERY ENGINE TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passedCount: passed, failedCount: failed };
}

if (require.main === module) {
  runDiscoveryEngineTestSuite().then((res) => {
    if (res.failedCount > 0) {
      process.exit(1);
    }
  });
}
