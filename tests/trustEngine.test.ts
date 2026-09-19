/**
 * ============================================================================
 * STAGE 11: TRUST ENGINE & MARKET INTELLIGENCE TEST SUITE
 * ============================================================================
 * Validates deterministic multi-dimensional trust calculations, Bayesian smoothing,
 * decay schedules, anti-sabotage rate limits, supply gap formulas, and privacy coarsening.
 */

import { TrustService } from '../services/TrustService';
import { SupplyGapService } from '../services/SupplyGapService';
import { coarsenLocation, normalizeSearchQuery } from '../utils/geoPrivacy';
import { TRUST_RULES } from '../config/trustRules';

let passed = 0;
let failed = 0;

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
  passed++;
}

export async function runTrustEngineTests(): Promise<{ passed: number; failed: number }> {
  passed = 0;
  failed = 0;

  console.log('\n======================================================');
  console.log('🧪 RUNNING STAGE 11: TRUST ENGINE & MARKET INTELLIGENCE');
  console.log('======================================================\n');

  TrustService.resetState();
  SupplyGapService.resetState();

  // --------------------------------------------------------------------------
  // Group 1: Freshness Step Decay Schedule
  // --------------------------------------------------------------------------
  console.log('Test Group 1: Freshness Step Decay Schedule');

  const now = Date.now();
  const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString();
  assert(
    TrustService.evaluateFreshness(twoHoursAgo) === 'FRESH',
    'Freshness evaluates to FRESH within 24 hours'
  );

  const twoDaysAgo = new Date(now - 48 * 3600 * 1000).toISOString();
  assert(
    TrustService.evaluateFreshness(twoDaysAgo) === 'RECENT',
    'Freshness evaluates to RECENT between 24h and 72h'
  );

  const fiveDaysAgo = new Date(now - 5 * 24 * 3600 * 1000).toISOString();
  assert(
    TrustService.evaluateFreshness(fiveDaysAgo) === 'AGING',
    'Freshness evaluates to AGING between 3 and 7 days'
  );

  const twelveDaysAgo = new Date(now - 12 * 24 * 3600 * 1000).toISOString();
  assert(
    TrustService.evaluateFreshness(twelveDaysAgo) === 'STALE',
    'Freshness evaluates to STALE beyond 7 days'
  );

  assert(
    TrustService.evaluateFreshness(null) === 'UNKNOWN',
    'Freshness evaluates to UNKNOWN when lastVerifiedAt is null'
  );

  assert(
    TrustService.evaluateFreshness(undefined) === 'UNKNOWN',
    'Freshness evaluates to UNKNOWN when lastVerifiedAt is undefined'
  );

  // --------------------------------------------------------------------------
  // Group 2: Multi-Dimensional Dish Trust Assessment
  // --------------------------------------------------------------------------
  console.log('\nTest Group 2: Multi-Dimensional Dish Trust Assessment');

  const freshDish = TrustService.computeDishTrust({
    dishId: 'dish_101',
    dishName: 'Chicken Biryani',
    restaurantId: 'rest_01',
    lastVerifiedAt: new Date().toISOString(),
    isAvailable: true,
  });

  assert(freshDish.priceTier === 'HIGH', 'Fresh dish receives HIGH priceTier');
  assert(freshDish.freshnessCategory === 'FRESH', 'Fresh dish receives FRESH category');
  assert(freshDish.badgeLabel === 'Verified Today', 'Fresh dish badge reads "Verified Today"');
  assert(freshDish.badgeTone === 'positive', 'Fresh dish badge tone is positive');
  assert(!freshDish.isReportedDiscrepancy, 'Fresh dish is not marked as reported discrepancy');

  const staleDish = TrustService.computeDishTrust({
    dishId: 'dish_102',
    dishName: 'Chipsi Mayai',
    restaurantId: 'rest_01',
    lastVerifiedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    isAvailable: true,
  });

  assert(staleDish.freshnessCategory === 'STALE', 'Stale dish receives STALE category');
  assert(staleDish.priceTier === 'LOW', 'Stale dish receives LOW price tier');
  assert(staleDish.badgeLabel === 'Needs Verification', 'Stale dish badge reads "Needs Verification"');
  assert(staleDish.badgeTone === 'warning', 'Stale dish badge tone is warning');

  // --------------------------------------------------------------------------
  // Group 3: Bayesian Fulfillment Reliability (Small Sample Defense)
  // --------------------------------------------------------------------------
  console.log('\nTest Group 3: Bayesian Fulfillment Reliability (Small Sample Defense)');

  const lowSampleResult = TrustService.calculateFulfillmentReliability(2, 2);
  assert(lowSampleResult.isLowSample === true, 'New partner with 2/2 orders is flagged as isLowSample');
  assert(lowSampleResult.rate === 0.875, 'Bayesian smoothed rate for 2/2 orders is 0.875 (not 1.00)');
  assert(lowSampleResult.tier === 'UNKNOWN', 'Fulfillment tier for low sample is UNKNOWN');
  assert(
    Boolean(lowSampleResult.sampleWarning?.includes('New partner')),
    'Low sample result includes explanatory warning'
  );

  const highSampleResult = TrustService.calculateFulfillmentReliability(500, 490);
  assert(highSampleResult.isLowSample === false, 'Partner with 500 orders is not flagged as low sample');
  assert(highSampleResult.rate === 0.977, 'Reliability rate for 490/500 orders is 0.977');
  assert(highSampleResult.tier === 'HIGH', 'High-volume reliable partner receives HIGH tier');

  // --------------------------------------------------------------------------
  // Group 4: Separation of Legal Verification vs Menu Freshness
  // --------------------------------------------------------------------------
  console.log('\nTest Group 4: Separation of Legal Verification vs Menu Freshness');

  const restaurantAssessment = TrustService.computeRestaurantTrust({
    restaurantId: 'rest_brela_verified',
    restaurantName: 'Zanzibar Spice Grill',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    totalOrders: 100,
    completedOrders: 98,
    menuLastVerifiedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  });

  assert(
    restaurantAssessment.legalVerificationStatus === 'VERIFIED',
    'Legal identity remains VERIFIED despite stale menu'
  );
  assert(
    restaurantAssessment.isBrelaVerified === true,
    'BRELA verification flag is true'
  );
  assert(
    restaurantAssessment.fulfillmentReliabilityTier === 'HIGH',
    'Operational fulfillment remains HIGH based on 98/100 orders'
  );
  assert(
    restaurantAssessment.explanations.menuFreshness.includes('not been audited recently'),
    'Menu freshness explanation accurately reflects stale status without compromising legal status'
  );

  // --------------------------------------------------------------------------
  // Group 5: Discrepancy Reporting & Anti-Sabotage Safeguards
  // --------------------------------------------------------------------------
  console.log('\nTest Group 5: Discrepancy Reporting & Anti-Sabotage Safeguards');

  const sub1 = TrustService.submitDiscrepancyReport({
    restaurantId: 'rest_01',
    dishName: 'Pilau Ya Nyama',
    listedPrice: 12000,
    reportedPrice: 15000,
    category: 'PRICE_DISCREPANCY',
    userId: 'user_honest_diner',
  });
  assert(sub1.success === true, 'Legitimate discrepancy report submitted successfully');
  assert(sub1.report?.dishName === 'Pilau Ya Nyama', 'Report contains correct dish name');
  assert(sub1.report?.evidenceState === 'UNVERIFIED_REPORT', 'Initial evidence state is UNVERIFIED_REPORT');

  // Rate limit cooldown (duplicate report from same user on same dish)
  const subDuplicate = TrustService.submitDiscrepancyReport({
    restaurantId: 'rest_01',
    dishName: 'Pilau Ya Nyama',
    category: 'PRICE_DISCREPANCY',
    userId: 'user_honest_diner',
  });
  assert(subDuplicate.success === false, 'Duplicate report on same item is blocked by 24h cooldown');
  assert(
    Boolean(subDuplicate.error?.includes('24 hours')),
    'Cooldown error specifies 24-hour window'
  );

  // Daily report limit (3 per day)
  const spammer = 'user_spammer_daily';
  assert(TrustService.submitDiscrepancyReport({ restaurantId: 'r1', dishName: 'D1', category: 'OTHER', userId: spammer }).success, 'Daily report 1 accepted');
  assert(TrustService.submitDiscrepancyReport({ restaurantId: 'r2', dishName: 'D2', category: 'OTHER', userId: spammer }).success, 'Daily report 2 accepted');
  assert(TrustService.submitDiscrepancyReport({ restaurantId: 'r3', dishName: 'D3', category: 'OTHER', userId: spammer }).success, 'Daily report 3 accepted');
  const subLimitExceeded = TrustService.submitDiscrepancyReport({ restaurantId: 'r4', dishName: 'D4', category: 'OTHER', userId: spammer });
  assert(subLimitExceeded.success === false, 'Daily report 4 rejected by daily limit');
  assert(
    Boolean(subLimitExceeded.error?.includes('maximum daily limit')),
    'Error cites maximum daily limit (3/day)'
  );

  // Escalation for paid customer history
  const paidReport = TrustService.submitDiscrepancyReport({
    restaurantId: 'rest_02',
    dishName: 'Kuku Choma',
    category: 'PRICE_DISCREPANCY',
    userId: 'user_paid_customer',
    hasPaidOrderHistory: true,
  });
  assert(paidReport.success === true, 'Report from paid customer accepted');
  assert(paidReport.report?.evidenceState === 'UNDER_REVIEW', 'Paid customer report automatically escalated to UNDER_REVIEW');

  // Instant recovery
  const disputeSubmit = TrustService.submitDiscrepancyReport({
    restaurantId: 'rest_recovery_test',
    dishName: 'Mshikaki Beef',
    category: 'PRICE_DISCREPANCY',
    userId: 'user_dispute_rec',
  });
  const repId = disputeSubmit.report!.id;

  // Confirm discrepancy
  TrustService.resolveDiscrepancyReport({ reportId: repId, action: 'CONFIRM' });
  const dishDisputed = TrustService.computeDishTrust({
    dishId: 'dish_mshikaki_rec',
    dishName: 'Mshikaki Beef',
    restaurantId: 'rest_recovery_test',
    lastVerifiedAt: new Date().toISOString(),
  });
  assert(dishDisputed.badgeLabel === 'Disputed Price', 'Confirmed discrepancy sets badge to "Disputed Price"');
  assert(dishDisputed.badgeTone === 'critical', 'Disputed price tone is critical');

  // Restaurant correction
  TrustService.resolveDiscrepancyReport({ reportId: repId, action: 'RESTAURANT_CORRECT' });
  const dishRecovered = TrustService.computeDishTrust({
    dishId: 'dish_mshikaki_rec',
    dishName: 'Mshikaki Beef',
    restaurantId: 'rest_recovery_test',
    lastVerifiedAt: new Date().toISOString(),
  });
  assert(dishRecovered.badgeLabel === 'Verified Today', 'Restaurant correction instantly restores badge to "Verified Today"');
  assert(dishRecovered.badgeTone === 'positive', 'Restored badge tone is positive');

  // --------------------------------------------------------------------------
  // Group 6: Privacy-Preserving Geographic Coarsening
  // --------------------------------------------------------------------------
  console.log('\nTest Group 6: Privacy-Preserving Geographic Coarsening');

  const coarsened = coarsenLocation(-6.755, 39.280);
  assert(coarsened.wardName === 'Masaki / Oysterbay', 'Coarsens raw GPS near Masaki to "Masaki / Oysterbay"');
  assert(coarsened.latitude === TRUST_RULES.DARES_SALAAM_CENTROIDS[1].latitude, 'Centroid latitude used instead of raw client latitude');
  assert(coarsened.longitude === TRUST_RULES.DARES_SALAAM_CENTROIDS[1].longitude, 'Centroid longitude used instead of raw client longitude');

  const normalized = normalizeSearchQuery('  Kuku   WA Kienyeji  ');
  assert(normalized === 'kuku wa kienyeji', 'Normalizes query by trimming and converting to lowercase');

  // --------------------------------------------------------------------------
  // Group 7: Supply Gap Intelligence & Zero-Result Telemetry
  // --------------------------------------------------------------------------
  console.log('\nTest Group 7: Supply Gap Intelligence & Zero-Result Telemetry');

  const searchEvt = SupplyGapService.recordSearch({
    query: 'Ugali wa Muhogo',
    sessionId: 'sess_1',
    resultsCount: 0,
    rawLatitude: -6.820,
    rawLongitude: 39.275,
  });
  assert(searchEvt.isZeroResult === true, 'Zero-result search flagged accurately');
  assert(searchEvt.wardName === 'Kariakoo', 'Search ward snapped to Kariakoo centroid');
  assert(searchEvt.normalizedQuery === 'ugali wa muhogo', 'Normalized query recorded');

  // Rapid refinement detection
  SupplyGapService.recordSearch({
    query: 'Shawarma',
    sessionId: 'sess_refine',
    resultsCount: 0,
  });
  const refinementEvt = SupplyGapService.recordSearch({
    query: 'Mshikaki',
    sessionId: 'sess_refine',
    resultsCount: 5,
  });
  assert(refinementEvt.isRefinement === true, 'Search within 30s detected as rapid refinement');
  assert(refinementEvt.previousQuery === 'shawarma', 'Previous query recorded on refinement');

  // Supply gap formula
  for (let i = 0; i < 15; i++) {
    SupplyGapService.recordSearch({
      query: 'Samaki wa Kupaka',
      sessionId: `sess_gap_${i}`,
      resultsCount: 0,
      rawLatitude: -6.821,
      rawLongitude: 39.278,
    });
  }

  const gaps = SupplyGapService.computeSupplyGaps({
    'Kariakoo::samaki wa kupaka': 0,
  });
  assert(gaps.length > 0, 'Supply gaps computed');
  const samakiGap = gaps.find((g) => g.categoryOrDish === 'SAMAKI WA KUPAKA');
  assert(Boolean(samakiGap), 'Samaki wa Kupaka gap identified');
  assert(samakiGap?.wardName === 'Kariakoo', 'Ward is Kariakoo');
  assert(samakiGap?.zeroResultCount === 15, 'Zero result count is 15');
  assert(samakiGap?.supplyGapIndex === 45.0, 'Supply Gap Index calculated to 45.0');
  assert(samakiGap?.urgencyLevel === 'CRITICAL', 'Urgency level is CRITICAL');

  // Funnel progression step
  const funnelStep = SupplyGapService.recordFunnelStep({
    stage: 'DISH_CLICKED',
    sessionId: 'sess_fnl_test',
    dishId: 'dish_biryani',
    restaurantId: 'rest_zanzibar',
    wardName: 'Mikocheni',
  });
  assert(funnelStep.stage === 'DISH_CLICKED', 'Funnel event stage recorded');
  assert(funnelStep.dishId === 'dish_biryani', 'Dish ID recorded in funnel event');

  console.log('\n======================================================');
  console.log(`🏁 TRUST ENGINE TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

// Direct execution support
if (require.main === module) {
  runTrustEngineTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
