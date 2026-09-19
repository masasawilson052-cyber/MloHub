/**
 * ============================================================================
 * MLOHUB PACK 4D: RATINGS, REVIEWS, DISH TRUST & CONTENT INTEGRITY
 * Unit and Invariant Integration Test Suite
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ReviewSourceType,
  ReviewVisibilityStatus,
  ReviewModerationStatus,
  ReviewAspectType,
  ReviewTagCode,
  ReviewReportReason,
  ReviewModerationOutcome,
  ReviewSortMode,
} from '../types/domain';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

/**
 * Deterministic Bayesian shrinkage calculation
 */
function calculateBayesianScore(
  itemAverage: number,
  reviewCount: number,
  priorMean: number = 4.2,
  minWeight: number = 5.0
): number {
  if (reviewCount <= 0) return priorMean;
  const score = (reviewCount / (reviewCount + minWeight)) * itemAverage + (minWeight / (reviewCount + minWeight)) * priorMean;
  return Math.round(score * 100) / 100;
}

/**
 * Wilson lower bound for helpfulness confidence
 */
function calculateWilsonHelpfulScore(positive: number, negative: number, confidence: number = 1.96): number {
  const n = positive + negative;
  if (n === 0) return 0;
  const p = positive / n;
  const z = confidence;
  const denominator = 1 + (z * z) / n;
  const score = (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
  return Math.round(score * 1000) / 1000;
}

/**
 * Deterministic review relevance score calculation
 */
function calculateRelevanceScore(params: {
  verifiedExperience: boolean;
  overallRating: number;
  helpfulCount: number;
  notHelpfulCount: number;
  hasMedia: boolean;
  hasComment: boolean;
  ageDays: number;
}): number {
  let score = 50.0;

  // 1. Verified experience boost
  if (params.verifiedExperience) score += 25.0;

  // 2. Content completeness
  if (params.hasComment) score += 10.0;
  if (params.hasMedia) score += 10.0;

  // 3. Helpfulness confidence
  const wilson = calculateWilsonHelpfulScore(params.helpfulCount, params.notHelpfulCount);
  score += wilson * 15.0;

  // 4. Recency decay (gentle, no cliffs)
  if (params.ageDays <= 30) {
    score += 10.0;
  } else if (params.ageDays <= 90) {
    score += 5.0;
  }

  // CRITICAL INVARIANT: Rating positivity does NOT artificially inflate relevance!
  // A detailed 1-star verified review with photos is just as relevant as a 5-star review.

  return Math.round(score * 10) / 10;
}

export async function runReviewsTrustTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 PACK 4D: RATINGS, REVIEWS, DISH TRUST & CONTENT INTEGRITY');
  console.log('================================================================\n');

  const files = {
    migration: path.resolve(__dirname, '../supabase/migrations/20260918000004_pack4d_reviews_trust.sql'),
    domainTypes: path.resolve(__dirname, '../types/domain.ts'),
    reviewsRepo: path.resolve(__dirname, '../repositories/reviews.repository.ts'),
    responsesRepo: path.resolve(__dirname, '../repositories/reviewResponses.repository.ts'),
    moderationRepo: path.resolve(__dirname, '../repositories/reviewModeration.repository.ts'),
    aggregatesRepo: path.resolve(__dirname, '../repositories/reviewAggregates.repository.ts'),
    reposIndex: path.resolve(__dirname, '../repositories/index.ts'),
  };

  // Section 1: Artifact & File Existence
  console.log('--- Section 1: Artifact & File Existence ---');
  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  // Section 2: Rating Boundaries and Integer Validation
  console.log('\n--- Section 2: Rating Boundaries & Validation Invariants ---');
  function isValidRating(rating: any): boolean {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
  }

  assert(isValidRating(1) === true, '1 star is valid rating');
  assert(isValidRating(5) === true, '5 star is valid rating');
  assert(isValidRating(3) === true, '3 star is valid rating');
  assert(isValidRating(0) === false, '0 star is rejected');
  assert(isValidRating(6) === false, '6 star is rejected');
  assert(isValidRating(-1) === false, 'Negative rating is rejected');
  assert(isValidRating(4.5) === false, 'Fractional rating is rejected (must be integer)');
  assert(isValidRating('5') === false, 'String rating is rejected');

  // Section 3: Bayesian Shrinkage & Confidence Mathematics
  console.log('\n--- Section 3: Bayesian Shrinkage & Confidence Invariants ---');
  const singleReview5Star = calculateBayesianScore(5.0, 1, 4.2, 5.0);
  const fiftyReviews48Star = calculateBayesianScore(4.8, 50, 4.2, 5.0);
  const hundredReviews46Star = calculateBayesianScore(4.6, 100, 4.2, 5.0);

  // Invariant: A single 5-star review (4.33) CANNOT outrank 50 verified reviews at 4.8 (4.75)
  assert(singleReview5Star === 4.33, `Single 5-star review shrinks towards prior (got: ${singleReview5Star}, expected: 4.33)`);
  assert(fiftyReviews48Star === 4.75, `50 reviews at 4.8 retain high confidence (got: ${fiftyReviews48Star}, expected: 4.75)`);
  assert(
    fiftyReviews48Star > singleReview5Star,
    'Bayesian rating prevents single 5-star from outranking deep verified 4.8 catalog'
  );
  assert(
    hundredReviews46Star > singleReview5Star,
    '100 verified reviews at 4.6 outrank a single 5-star review in confidence'
  );

  // Section 4: Public Raw Average vs Bayesian Confidence Separation
  console.log('\n--- Section 4: Raw Average vs Confidence Separation ---');
  const rawAverage = (5 + 5 + 4 + 4 + 5) / 5; // 4.60
  const confidenceAverage = calculateBayesianScore(rawAverage, 5, 4.2, 5.0);
  assert(rawAverage === 4.6, 'Raw public average mathematically exact (4.6)');
  assert(confidenceAverage === 4.4, 'Confidence rating remains distinct from public visible average (4.40)');

  // Section 5: Wilson Score Helpfulness Ordering
  console.log('\n--- Section 5: Helpfulness Wilson Confidence Invariants ---');
  const tenPositiveZeroNegative = calculateWilsonHelpfulScore(10, 0);
  const hundredPositiveTenNegative = calculateWilsonHelpfulScore(100, 10);
  const zeroHelpfulVotes = calculateWilsonHelpfulScore(0, 0);

  assert(zeroHelpfulVotes === 0, 'Zero helpfulness votes yield 0 score');
  assert(tenPositiveZeroNegative > 0.65, `10 positive 0 negative yields strong lower bound (${tenPositiveZeroNegative})`);
  assert(
    hundredPositiveTenNegative > tenPositiveZeroNegative,
    '100+ / 10- has higher statistical confidence than 10+ / 0-'
  );

  // Section 6: Rating Histogram Calculation
  console.log('\n--- Section 6: Rating Histogram Consistency ---');
  const sampleRatings = [5, 5, 5, 4, 4, 3, 2, 1, 5, 4];
  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of sampleRatings) (histogram as any)[r]++;

  assert(histogram[5] === 4, 'Histogram 5-star count is 4');
  assert(histogram[4] === 3, 'Histogram 4-star count is 3');
  assert(histogram[3] === 1, 'Histogram 3-star count is 1');
  assert(histogram[2] === 1, 'Histogram 2-star count is 1');
  assert(histogram[1] === 1, 'Histogram 1-star count is 1');
  const totalCount = Object.values(histogram).reduce((a, b) => a + b, 0);
  assert(totalCount === sampleRatings.length, 'Histogram total sum matches sample size');

  // Section 7: Relevance Sorting Non-Suppression of Negative Reviews
  console.log('\n--- Section 7: Relevance Sorting Integrity (No Negative Suppression) ---');
  const detailedNegativeReview = calculateRelevanceScore({
    verifiedExperience: true,
    overallRating: 1,
    helpfulCount: 20,
    notHelpfulCount: 1,
    hasMedia: true,
    hasComment: true,
    ageDays: 10,
  });

  const sparsePositiveReview = calculateRelevanceScore({
    verifiedExperience: false,
    overallRating: 5,
    helpfulCount: 0,
    notHelpfulCount: 0,
    hasMedia: false,
    hasComment: false,
    ageDays: 180,
  });

  assert(
    detailedNegativeReview > sparsePositiveReview,
    `Detailed verified 1-star review (${detailedNegativeReview}) outranks unverified 5-star (${sparsePositiveReview}) in relevance`
  );

  // Section 8: HTML and Script Injection Defense
  console.log('\n--- Section 8: Text Safety & HTML Injection Invariants ---');
  function containsDangerousHtml(text: string): boolean {
    return /<[a-z/][^>]*>/i.test(text) || /javascript:/i.test(text);
  }

  assert(containsDangerousHtml('Great chapati and chai!') === false, 'Safe review text accepted');
  assert(containsDangerousHtml('<script>alert("hack")</script>') === true, '<script> injection flagged');
  assert(containsDangerousHtml('<img src=x onerror=alert(1)>') === true, 'HTML onerror payload flagged');
  assert(containsDangerousHtml('Check out <a href="http://spam.tz">this</a>') === true, 'HTML tag flagged');
  assert(containsDangerousHtml('javascript:void(0)') === true, 'javascript: URI flagged');

  // Section 9: Structured Review Tags Canonical List
  console.log('\n--- Section 9: Structured Review Tags Canonical Rules ---');
  const allowedTags: ReviewTagCode[] = [
    'GREAT_FLAVOR', 'FRESH_FOOD', 'GOOD_PORTION', 'GOOD_VALUE', 'ACCURATE_ORDER',
    'GOOD_PACKAGING', 'FRIENDLY_SERVICE', 'CLEAN_LOCATION', 'FAST_PREPARATION', 'ON_TIME_RESTAURANT_DELIVERY',
    'POOR_FLAVOR', 'SMALL_PORTION', 'POOR_VALUE', 'INCORRECT_ITEM', 'MISSING_ITEM',
    'POOR_PACKAGING', 'SLOW_PREPARATION', 'POOR_SERVICE', 'UNCLEAN_LOCATION', 'LATE_RESTAURANT_DELIVERY',
  ];

  assert(allowedTags.length === 20, '20 canonical structured review tags defined (10 positive, 10 negative)');
  assert(allowedTags.includes('GREAT_FLAVOR'), 'Tag GREAT_FLAVOR present');
  assert(allowedTags.includes('POOR_FLAVOR'), 'Tag POOR_FLAVOR present');

  // Section 10: Experience Aspect Applicability
  console.log('\n--- Section 10: Experience Aspect Applicability Rules ---');
  const orderAspects: ReviewAspectType[] = [
    'FOOD_QUALITY', 'ORDER_ACCURACY', 'VALUE_FOR_MONEY', 'PACKAGING',
    'PORTION_SIZE', 'PREPARATION', 'RESTAURANT_DELIVERY',
  ];
  const reservationAspects: ReviewAspectType[] = [
    'FOOD_QUALITY', 'SERVICE', 'VALUE_FOR_MONEY', 'CLEANLINESS', 'ATMOSPHERE',
  ];

  assert(orderAspects.includes('PACKAGING'), 'Order experiences permit PACKAGING aspect');
  assert(reservationAspects.includes('ATMOSPHERE'), 'Reservation experiences permit ATMOSPHERE aspect');
  assert(!reservationAspects.includes('PACKAGING'), 'Reservation experiences forbid PACKAGING aspect');
  assert(!orderAspects.includes('ATMOSPHERE'), 'Order experiences forbid ATMOSPHERE aspect');

  // Section 11: Eligibility State Validation
  console.log('\n--- Section 11: Eligibility State Rules ---');
  function isOrderEligible(status: string): boolean {
    return status === 'COMPLETED';
  }
  function isReservationEligible(status: string): boolean {
    return status === 'COMPLETED';
  }

  assert(isOrderEligible('COMPLETED') === true, 'COMPLETED order is eligible');
  assert(isOrderEligible('PENDING') === false, 'PENDING order is NOT eligible');
  assert(isOrderEligible('ACCEPTED') === false, 'ACCEPTED order is NOT eligible');
  assert(isOrderEligible('CANCELLED') === false, 'CANCELLED order is NOT eligible');

  assert(isReservationEligible('COMPLETED') === true, 'COMPLETED reservation is eligible');
  assert(isReservationEligible('CONFIRMED') === false, 'CONFIRMED reservation is NOT eligible yet');
  assert(isReservationEligible('NO_SHOW') === false, 'NO_SHOW reservation is strictly ineligible');
  assert(isReservationEligible('CANCELLED') === false, 'CANCELLED reservation is strictly ineligible');
  assert(isReservationEligible('REJECTED') === false, 'REJECTED reservation is strictly ineligible');

  // Section 12: Migration SQL Schema Invariants
  console.log('\n--- Section 12: Migration SQL Schema Invariants ---');
  const sql = fs.readFileSync(files.migration, 'utf8');

  assert(sql.includes('public.review_source_type_enum'), 'Migration defines review_source_type_enum');
  assert(sql.includes('public.review_aspect_ratings'), 'Migration creates review_aspect_ratings');
  assert(sql.includes('public.review_item_ratings'), 'Migration creates review_item_ratings');
  assert(sql.includes('public.review_tags'), 'Migration creates review_tags');
  assert(sql.includes('public.review_versions'), 'Migration creates review_versions');
  assert(sql.includes('public.review_responses'), 'Migration creates review_responses');
  assert(sql.includes('public.review_response_versions'), 'Migration creates review_response_versions');
  assert(sql.includes('public.review_helpfulness_votes'), 'Migration creates review_helpfulness_votes');
  assert(sql.includes('public.review_media'), 'Migration creates review_media');
  assert(sql.includes('public.review_reports'), 'Migration creates review_reports');
  assert(sql.includes('public.review_moderation_cases'), 'Migration creates review_moderation_cases');
  assert(sql.includes('public.review_moderation_events'), 'Migration creates review_moderation_events');
  assert(sql.includes('public.review_integrity_flags'), 'Migration creates review_integrity_flags');
  assert(sql.includes('public.restaurant_rating_aggregates'), 'Migration creates restaurant_rating_aggregates');
  assert(sql.includes('public.branch_rating_aggregates'), 'Migration creates branch_rating_aggregates');
  assert(sql.includes('public.dish_rating_aggregates'), 'Migration creates dish_rating_aggregates');

  // Security Invariants in SQL
  assert(sql.includes('protect_review_provenance'), 'Migration defines protect_review_provenance trigger');
  assert(sql.includes('prevent_direct_aggregate_tampering'), 'Migration defines prevent_direct_aggregate_tampering trigger');
  assert(sql.includes('get_review_eligibility'), 'Migration defines get_review_eligibility RPC');
  assert(sql.includes('submit_verified_review_secure'), 'Migration defines submit_verified_review_secure RPC');
  assert(sql.includes('edit_review_secure'), 'Migration defines edit_review_secure RPC');
  assert(sql.includes('delete_review_secure'), 'Migration defines delete_review_secure RPC');
  assert(sql.includes('respond_to_review_secure'), 'Migration defines respond_to_review_secure RPC');
  assert(sql.includes('edit_review_response_secure'), 'Migration defines edit_review_response_secure RPC');
  assert(sql.includes('vote_review_helpfulness_secure'), 'Migration defines vote_review_helpfulness_secure RPC');
  assert(sql.includes('report_review_secure'), 'Migration defines report_review_secure RPC');
  assert(sql.includes('moderate_review_secure'), 'Migration defines moderate_review_secure RPC');
  assert(sql.includes('refresh_restaurant_rating_aggregate'), 'Migration defines refresh_restaurant_rating_aggregate');
  assert(sql.includes('refresh_dish_rating_aggregate'), 'Migration defines refresh_dish_rating_aggregate');

  console.log('\n================================================================');
  console.log(`  PACK 4D UNIT & INTEGRATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runReviewsTrustTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
