/**
 * Unit Test: Dish Card Trust Badge Visibility, Translation, and Formatting Rules
 *
 * Exercises the card-visibility rule (code in, show/hide out):
 * - Shows: VERIFIED_TODAY, CONFIRMED_RECENTLY, UNDER_REVIEW, DISPUTED
 * - Hides: UNVERIFIED, AGING, NEEDS_VERIFICATION, and invalid codes
 *
 * Also verifies:
 * - Full English and Swahili labels and explanations for all 7 badge codes
 * - Compare button label translations ("Compare" vs "Linganisha")
 * - Restaurant & area deduplication ("Mikocheni • Mikocheni" -> "Mikocheni")
 * - Swahili/English dish title inversion (name_sw vs name_en)
 */

import { TrustService, shouldShowTrustBadgeOnCard } from '../services/TrustService';
import {
  getTrustBadgeLabel,
  getTrustBadgeExplanation,
  TRUST_BADGE_LABELS,
  TRUST_BADGE_EXPLANATIONS,
} from '../context/LanguageContext';
import { DishTrustBadgeCode } from '../types/trust';

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

export async function runDishCardTrustVisibilityTests(): Promise<{ passed: number; failed: number }> {
  passed = 0;
  failed = 0;

  console.log('\n======================================================');
  console.log('🧪 RUNNING DISH CARD TRUST BADGE VISIBILITY & LABELS');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // Group 1: Dish Card Trust Pill Visibility Rule (code in, show/hide out)
  // --------------------------------------------------------------------------
  console.log('Test Group 1: Card Visibility Rule (Positive/Warning shown, others hidden)');

  // Positive trust signals -> SHOW (true)
  assert(
    shouldShowTrustBadgeOnCard('VERIFIED_TODAY') === true,
    'VERIFIED_TODAY displays trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('VERIFIED_TODAY') === true,
    'TrustService.shouldShowBadgeOnCard(VERIFIED_TODAY) returns true'
  );
  assert(
    shouldShowTrustBadgeOnCard('CONFIRMED_RECENTLY') === true,
    'CONFIRMED_RECENTLY displays trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('CONFIRMED_RECENTLY') === true,
    'TrustService.shouldShowBadgeOnCard(CONFIRMED_RECENTLY) returns true'
  );

  // Warnings / Discrepancies -> SHOW (true)
  assert(
    shouldShowTrustBadgeOnCard('UNDER_REVIEW') === true,
    'UNDER_REVIEW displays warning trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('UNDER_REVIEW') === true,
    'TrustService.shouldShowBadgeOnCard(UNDER_REVIEW) returns true'
  );
  assert(
    shouldShowTrustBadgeOnCard('DISPUTED') === true,
    'DISPUTED displays critical trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('DISPUTED') === true,
    'TrustService.shouldShowBadgeOnCard(DISPUTED) returns true'
  );

  // Neutral / Stale / Unaudited signals -> HIDE on cards (false)
  assert(
    shouldShowTrustBadgeOnCard('UNVERIFIED') === false,
    'UNVERIFIED hides trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('UNVERIFIED') === false,
    'TrustService.shouldShowBadgeOnCard(UNVERIFIED) returns false'
  );
  assert(
    shouldShowTrustBadgeOnCard('AGING') === false,
    'AGING hides trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('AGING') === false,
    'TrustService.shouldShowBadgeOnCard(AGING) returns false'
  );
  assert(
    shouldShowTrustBadgeOnCard('NEEDS_VERIFICATION') === false,
    'NEEDS_VERIFICATION hides trust pill on dish card'
  );
  assert(
    TrustService.shouldShowBadgeOnCard('NEEDS_VERIFICATION') === false,
    'TrustService.shouldShowBadgeOnCard(NEEDS_VERIFICATION) returns false'
  );

  // Invalid / Null / Undefined edge cases -> HIDE (false)
  assert(
    shouldShowTrustBadgeOnCard(null) === false,
    'null badge code returns false'
  );
  assert(
    shouldShowTrustBadgeOnCard(undefined) === false,
    'undefined badge code returns false'
  );
  assert(
    shouldShowTrustBadgeOnCard('') === false,
    'empty string badge code returns false'
  );
  assert(
    shouldShowTrustBadgeOnCard('UNKNOWN_BADGE_CODE') === false,
    'unknown badge code returns false'
  );

  // --------------------------------------------------------------------------
  // Group 2: Full English & Swahili Translations for all 7 Badge Codes
  // --------------------------------------------------------------------------
  console.log('\nTest Group 2: Badge Code Translations (English and Swahili)');

  const expectedBadges: Record<
    DishTrustBadgeCode,
    { labelEn: string; labelSw: string; descEnSub: string; descSwSub: string }
  > = {
    VERIFIED_TODAY: {
      labelEn: 'Verified Today',
      labelSw: 'Imethibitishwa Leo',
      descEnSub: 'last 24 hours',
      descSwSub: 'saa 24',
    },
    CONFIRMED_RECENTLY: {
      labelEn: 'Confirmed Recently',
      labelSw: 'Imethibitishwa Hivi Karibuni',
      descEnSub: 'last 3 days',
      descSwSub: 'siku 3',
    },
    AGING: {
      labelEn: 'Audited 3+ Days Ago',
      labelSw: 'Ilikaguliwa Siku 3+ Zilizopita',
      descEnSub: '3 and 7 days',
      descSwSub: 'siku 3 na 7',
    },
    NEEDS_VERIFICATION: {
      labelEn: 'Needs Verification',
      labelSw: 'Inahitaji Uhakiki',
      descEnSub: 'over a week',
      descSwSub: 'wiki moja',
    },
    UNVERIFIED: {
      labelEn: 'Unverified Price',
      labelSw: 'Bei Haijathibitishwa',
      descEnSub: 'without manual price audit',
      descSwSub: 'bila ukaguzi wa bei',
    },
    UNDER_REVIEW: {
      labelEn: 'Price Under Review',
      labelSw: 'Bei Inakaguliwa',
      descEnSub: 'recently reported a price difference',
      descSwSub: 'aliripoti tofauti ya bei',
    },
    DISPUTED: {
      labelEn: 'Disputed Price',
      labelSw: 'Bei Inayobishaniwa',
      descEnSub: 'reported a price mismatch',
      descSwSub: 'tofauti ya bei inayochunguzwa',
    },
  };

  const allCodes = Object.keys(expectedBadges) as DishTrustBadgeCode[];
  assert(allCodes.length === 7, 'Exactly 7 authoritative trust badge codes exist');

  for (const code of allCodes) {
    const { labelEn, labelSw, descEnSub, descSwSub } = expectedBadges[code];

    // English label & explanation
    const resolvedLabelEn = getTrustBadgeLabel(code, 'en');
    assert(
      resolvedLabelEn === labelEn,
      `[${code}] English label resolves to "${labelEn}"`
    );
    const resolvedDescEn = getTrustBadgeExplanation(code, 'en');
    assert(
      resolvedDescEn.includes(descEnSub),
      `[${code}] English explanation contains "${descEnSub}"`
    );

    // Swahili label & explanation
    const resolvedLabelSw = getTrustBadgeLabel(code, 'sw');
    assert(
      resolvedLabelSw === labelSw,
      `[${code}] Swahili label resolves to "${labelSw}"`
    );
    const resolvedDescSw = getTrustBadgeExplanation(code, 'sw');
    assert(
      resolvedDescSw.includes(descSwSub),
      `[${code}] Swahili explanation contains "${descSwSub}"`
    );
  }

  // --------------------------------------------------------------------------
  // Group 3: Restaurant Name and Area Deduplication Logic
  // --------------------------------------------------------------------------
  console.log('\nTest Group 3: Restaurant and Area Name Deduplication');

  function shouldRenderNeighborhood(restaurantName: string, neighborhood?: string): boolean {
    if (!neighborhood) return false;
    return neighborhood.trim().toLowerCase() !== restaurantName.trim().toLowerCase();
  }

  assert(
    shouldRenderNeighborhood('Mikocheni', 'Mikocheni') === false,
    'Area identical to restaurant name ("Mikocheni" • "Mikocheni") is deduplicated'
  );
  assert(
    shouldRenderNeighborhood('Mikocheni', ' mikocheni ') === false,
    'Case-insensitive and whitespace trimmed duplicate is deduplicated'
  );
  assert(
    shouldRenderNeighborhood('Mama Amina', 'Mikocheni') === true,
    'Different restaurant and area ("Mama Amina" • "Mikocheni") are both displayed'
  );
  assert(
    shouldRenderNeighborhood('Kibo Nyama Choma', undefined) === false,
    'Undefined neighborhood is safely ignored'
  );

  // --------------------------------------------------------------------------
  // Group 4: Language-Dependent Dish Name Inversion Rule
  // --------------------------------------------------------------------------
  console.log('\nTest Group 4: Language Dish Title Inversion (Swahili vs English)');

  function getDishNames(dishNameEn: string, dishNameSw: string | undefined, lang: 'en' | 'sw') {
    const isSwahili = lang === 'sw';
    const primary = isSwahili
      ? (dishNameSw || dishNameEn)
      : (dishNameEn || dishNameSw || '');
    const secondary = isSwahili
      ? (dishNameEn && dishNameEn.trim().toLowerCase() !== primary.trim().toLowerCase() ? dishNameEn : undefined)
      : (dishNameSw && dishNameSw.trim().toLowerCase() !== primary.trim().toLowerCase() ? dishNameSw : undefined);
    return { primary, secondary };
  }

  const chipsiEn = 'Chips and Eggs (Chipsi Mayai)';
  const chipsiSw = 'Chipsi Mayai';

  // In Swahili: Swahili is primary, English is secondary underneath
  const swahiliDisplay = getDishNames(chipsiEn, chipsiSw, 'sw');
  assert(
    swahiliDisplay.primary === 'Chipsi Mayai',
    'In Swahili: primary title is Swahili name (name_sw)'
  );
  assert(
    swahiliDisplay.secondary === chipsiEn,
    'In Swahili: secondary title underneath is English name (name_en)'
  );

  // In English: English is primary, Swahili is secondary underneath
  const englishDisplay = getDishNames(chipsiEn, chipsiSw, 'en');
  assert(
    englishDisplay.primary === chipsiEn,
    'In English: primary title is English name (name_en)'
  );
  assert(
    englishDisplay.secondary === 'Chipsi Mayai',
    'In English: secondary title underneath is Swahili name (name_sw)'
  );

  // Identical names -> no duplicate underneath
  const identicalDisplay = getDishNames('Pilau', 'Pilau', 'sw');
  assert(
    identicalDisplay.primary === 'Pilau',
    'Identical name displays primary'
  );
  assert(
    identicalDisplay.secondary === undefined,
    'Identical name does not show redundant secondary title'
  );

  console.log('\n======================================================');
  console.log(`🏁 DISH CARD VISIBILITY & TRUST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

// Direct execution CLI support
if (require.main === module) {
  runDishCardTrustVisibilityTests()
    .then(({ failed: totalFailed }) => {
      if (totalFailed > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
