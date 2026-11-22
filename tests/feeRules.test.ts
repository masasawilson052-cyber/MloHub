import assert from 'assert';
import {
  computeServiceFeeTzs,
  deliveryMinimumShortfall,
  DEFAULT_FEE_RULES,
  PublicFeeRules,
} from '../config/platformFees';

export async function runFeeRulesTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB AUTHORITATIVE FEE RULES & SHORTFALL SUITE');
  console.log('================================================================\n');

  const rules: PublicFeeRules = { ...DEFAULT_FEE_RULES };

  // ---------------------------------------------------------------------------
  // 1. Service Fee Delivery Tier Computations
  // ---------------------------------------------------------------------------
  console.log('--- Scenario 1: Delivery Service Fee Math & Clamping ---');

  const testCases: Array<[number, number]> = [
    [3000, 200],    // 3,000 * 3% = 90 -> clamped to min 200
    [5000, 200],    // 5,000 * 3% = 150 -> clamped to min 200
    [12000, 360],   // 12,000 * 3% = 360 -> exactly 360
    [12345, 370],   // 12,345 * 3% = 370.35 -> 370
    [16000, 480],   // 16,000 * 3% = 480 -> exactly 480
    [16500, 500],   // 16,500 * 3% = 495 -> round nearest 10 = 500
    [20000, 500],   // 20,000 * 3% = 600 -> clamped to max 500
    [30000, 500],   // 30,000 * 3% = 900 -> clamped to max 500
  ];

  for (const [subtotal, expectedFee] of testCases) {
    const fee = computeServiceFeeTzs(subtotal, 'Delivery', rules);
    assert.strictEqual(
      fee,
      expectedFee,
      `Service fee for TZS ${subtotal.toLocaleString()} Delivery should be ${expectedFee}, got ${fee}`
    );
    console.log(`  ✓ Subtotal TZS ${subtotal.toLocaleString()} -> Service Fee TZS ${fee}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Non-Delivery Fulfillment Types Always Free
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Non-Delivery Fulfillment Types (0 Fee) ---');

  const nonDeliveryTypes = ['Takeaway', 'Dine-In', 'Pickup', 'Reservation', null, undefined];
  for (const type of nonDeliveryTypes) {
    const fee = computeServiceFeeTzs(15000, type as any, rules);
    assert.strictEqual(
      fee,
      0,
      `Service fee for ${type || 'empty'} must always be 0, got ${fee}`
    );
    console.log(`  ✓ Fulfillment "${type}" -> Service Fee TZS 0`);
  }

  // Edge cases: null, 0, or negative subtotal
  assert.strictEqual(computeServiceFeeTzs(0, 'Delivery', rules), 0, 'Subtotal 0 returns 0 fee');
  assert.strictEqual(computeServiceFeeTzs(-500, 'Delivery', rules), 0, 'Negative subtotal returns 0 fee');
  assert.strictEqual(computeServiceFeeTzs(null as any, 'Delivery', rules), 0, 'Null subtotal returns 0 fee');

  // ---------------------------------------------------------------------------
  // 3. Delivery Minimum Shortfall Calculations
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Delivery Minimum Shortfall Calculations ---');

  // Case A: 4,000 with default delivery minimum (5,000) -> shortfall 1,000
  const shortfall4k = deliveryMinimumShortfall(4000, rules);
  assert.strictEqual(
    shortfall4k,
    1000,
    `Shortfall for 4,000 against default 5,000 min must be 1,000, got ${shortfall4k}`
  );
  console.log('  ✓ 4,000 subtotal against 5,000 default min -> Shortfall TZS 1,000');

  // Case B: 6,000 against a zone minimum of 7,000 -> shortfall 1,000
  const shortfall6kAgainstZone7k = deliveryMinimumShortfall(6000, rules, 7000);
  assert.strictEqual(
    shortfall6kAgainstZone7k,
    1000,
    `Shortfall for 6,000 against zone 7,000 min must be 1,000, got ${shortfall6kAgainstZone7k}`
  );
  console.log('  ✓ 6,000 subtotal against 7,000 zone min -> Shortfall TZS 1,000');

  // Case C: 5,000 with default delivery minimum (5,000) -> shortfall 0
  const shortfall5k = deliveryMinimumShortfall(5000, rules);
  assert.strictEqual(
    shortfall5k,
    0,
    `Shortfall for 5,000 against default 5,000 min must be 0, got ${shortfall5k}`
  );
  console.log('  ✓ 5,000 subtotal against 5,000 default min -> Shortfall TZS 0');

  // Case D: Exceeding minimum (10,000 against 5,000) -> shortfall 0
  const shortfall10k = deliveryMinimumShortfall(10000, rules);
  assert.strictEqual(
    shortfall10k,
    0,
    `Shortfall for 10,000 against default 5,000 min must be 0, got ${shortfall10k}`
  );
  console.log('  ✓ 10,000 subtotal against 5,000 default min -> Shortfall TZS 0');

  console.log('\n================================================================');
  console.log('✓ ALL FEE RULES & SHORTFALL TESTS PASSED');
  console.log('================================================================\n');
}

if (require.main === module) {
  runFeeRulesTests().catch((err) => {
    console.error('Fee rules test failed:', err);
    process.exit(1);
  });
}
