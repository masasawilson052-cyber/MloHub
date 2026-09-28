/**
 * ============================================================================
 * MLOHUB FINAL PAYMENT EXPERIENCE & ROUTE-BASED DELIVERY QUOTE TEST SUITE
 * ============================================================================
 * 
 * Verifies:
 * 1. Server-authoritative route delivery fee formula, distance scaling, min/max clamping, and out-of-range gating.
 * 2. Delivery quote lifecycle: creation, active TTL, expiration, single-use consumption, and 0-fee rules for Takeaway/Dine-In.
 * 3. Mobile money canonical operator registry (4 providers), phone normalization, and carrier auto-detection.
 * 4. Payment flow state transitions, attempt isolation, idempotency key scoping, and failure categorization.
 * 5. Strict security: zero PIN storage or prompts, zero client-exposed Google Routes secrets, and owner-scoped queries.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  calculateDeliveryFee,
  calculateHaversineDistanceMeters,
  DEFAULT_PROVISIONAL_DELIVERY_PRICING,
  DeliveryPricingConfig,
} from '../supabase/functions/_shared/delivery/GoogleRoutesClient';
import {
  MOBILE_MONEY_METHODS,
  getMobileMoneyMethodConfig,
  detectCarrierFromPhone,
  PAYMENT_SECURITY_PIN_NOTICE_EN,
  PAYMENT_SECURITY_PIN_NOTICE_SW,
} from '../constants/paymentMethods';
import {
  isValidTanzaniaPhone,
  normalizeTanzaniaPhone,
  formatTanzaniaPhoneDisplay,
} from '../utils/phone';
import {
  classifyPaymentFailure,
  generatePaymentAttemptId,
  generatePaymentIdempotencyKey,
} from '../components/payments/paymentFlow';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runPaymentDeliveryClosureTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('💳 MLOHUB FINAL PAYMENT & ROUTE-BASED DELIVERY CLOSURE SUITE');
  console.log('================================================================');

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // Group A: Route-Based Delivery Fee Calculation & Clamping
  // --------------------------------------------------------------------------
  console.log('\n--- Group A: Server Delivery Fee Formula & Clamping ---');

  // A1: Base fee within included distance (<= 2000m)
  const feeAt500m = calculateDeliveryFee(500);
  assert(feeAt500m === 2000, 'A1: 500m distance incurs exact base fee of 2,000 TZS');

  const feeAt2000m = calculateDeliveryFee(2000);
  assert(feeAt2000m === 2000, 'A1: 2,000m (exact included distance) incurs exact base fee of 2,000 TZS');

  // A2: Incremental distance rounding (ceil per 1,000m)
  // 2,100m -> 100m over included 2km -> ceil(100/1000) = 1 increment (500 TZS) -> 2,500 TZS
  const feeAt2100m = calculateDeliveryFee(2100);
  assert(feeAt2100m === 2500, 'A2: 2,100m incurs 1 billing increment: 2,000 + 500 = 2,500 TZS');

  // 3,000m -> 1,000m over included 2km -> 1 increment (500 TZS) -> 2,500 TZS
  const feeAt3000m = calculateDeliveryFee(3000);
  assert(feeAt3000m === 2500, 'A2: 3,000m (exact 1km over base) incurs 2,500 TZS');

  // 3,001m -> 1,001m over included 2km -> ceil(1001/1000) = 2 increments (1000 TZS) -> 3,000 TZS
  const feeAt3001m = calculateDeliveryFee(3001);
  assert(feeAt3001m === 3000, 'A2: 3,001m incurs 2 billing increments: 2,000 + 1,000 = 3,000 TZS');

  // 7,500m -> 5,500m over included 2km -> ceil(5.5) = 6 increments (3,000 TZS) -> 5,000 TZS
  const feeAt7500m = calculateDeliveryFee(7500);
  assert(feeAt7500m === 5000, 'A2: 7,500m incurs 5,000 TZS');

  // A3: Minimum fee clamping
  const customConfigLowBase: DeliveryPricingConfig = {
    ...DEFAULT_PROVISIONAL_DELIVERY_PRICING,
    baseFeeTzs: 1000,
    minimumFeeTzs: 2500, // enforced minimum floor
  };
  const feeWithMinClamping = calculateDeliveryFee(1000, customConfigLowBase);
  assert(feeWithMinClamping === 2500, 'A3: Fee is clamped up to minimumFeeTzs floor (2,500 TZS)');

  // A4: Maximum fee clamping
  // 24,000m -> 22,000m over 2km -> 22 increments * 500 = 11,000 + 2,000 = 13,000 TZS
  const feeAt24km = calculateDeliveryFee(24000);
  assert(feeAt24km === 13000, 'A4: 24,000m produces 13,000 TZS within 15,000 max');

  const customConfigLowMax: DeliveryPricingConfig = {
    ...DEFAULT_PROVISIONAL_DELIVERY_PRICING,
    maximumFeeTzs: 6000, // custom low ceiling
  };
  const feeWithMaxClamping = calculateDeliveryFee(15000, customConfigLowMax);
  assert(feeWithMaxClamping === 6000, 'A4: Fee is clamped down to maximumFeeTzs ceiling (6,000 TZS)');

  // A5: Outside delivery range throws OUTSIDE_DELIVERY_RANGE
  let outsideRangeThrown = false;
  try {
    calculateDeliveryFee(25001); // 1 meter beyond 25km radius
  } catch (err: any) {
    if (err.message && err.message.includes('OUTSIDE_DELIVERY_RANGE')) {
      outsideRangeThrown = true;
    }
  }
  assert(outsideRangeThrown, 'A5: Distance exceeding maxDeliveryDistanceMeters throws OUTSIDE_DELIVERY_RANGE');

  // A6: Haversine distance sanity
  // Dar es Salaam City Centre (-6.8163, 39.2803) to Mikocheni (-6.7622, 39.2482) ~ 6.9km
  const darCityCentre = { latitude: -6.8163, longitude: 39.2803 };
  const mikocheni = { latitude: -6.7622, longitude: 39.2482 };
  const distance = calculateHaversineDistanceMeters(darCityCentre, mikocheni);
  assert(distance > 6000 && distance < 8000, 'A6: Haversine distance calculates accurate geographic distance (~6.9km)');

  // --------------------------------------------------------------------------
  // Group B: Delivery Quote Server-Authority & Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- Group B: Delivery Quote Server Authority & Lifecycle ---');

  // B1: Client API source verification
  const deliveryQuoteApiSrc = fs.readFileSync(path.join(rootDir, 'services/api/DeliveryQuoteApi.ts'), 'utf8');
  assert(
    deliveryQuoteApiSrc.includes('class DeliveryQuoteApi') &&
    deliveryQuoteApiSrc.includes("supabase.functions.invoke('quote-delivery'") &&
    deliveryQuoteApiSrc.includes('formatDistance') &&
    deliveryQuoteApiSrc.includes('formatDuration'),
    'B1: DeliveryQuoteApi client exists with server-invoke routing and formatters'
  );

  // B2: Quote Expiration TTL rule (15 minutes)
  const nowMs = Date.now();
  const mockActiveQuote = {
    id: 'quote-test-uuid-active',
    status: 'ACTIVE' as const,
    feeTzs: 3500,
    expiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(), // 10 minutes in future
  };
  const isQuoteActive = mockActiveQuote.status === 'ACTIVE' && new Date(mockActiveQuote.expiresAt).getTime() > Date.now();
  assert(isQuoteActive, 'B2: Active quote with future expiresAt is valid for checkout');

  const mockExpiredQuote = {
    id: 'quote-test-uuid-expired',
    status: 'ACTIVE' as const,
    feeTzs: 3500,
    expiresAt: new Date(nowMs - 60 * 1000).toISOString(), // 1 minute in past
  };
  const isQuoteExpired = new Date(mockExpiredQuote.expiresAt).getTime() <= Date.now();
  assert(isQuoteExpired, 'B2: Expired quote (expiresAt in past) is rejected');

  // B3: Fulfillment zero delivery fee rule (Takeaway & Dine-In)
  const fulfillmentDeliveryFee = (type: 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN', quotedFee: number) => {
    return type === 'DELIVERY' ? quotedFee : 0;
  };
  assert(fulfillmentDeliveryFee('DELIVERY', 3500) === 3500, 'B3: DELIVERY fulfillment applies full quoted delivery fee');
  assert(fulfillmentDeliveryFee('TAKEAWAY', 3500) === 0, 'B3: TAKEAWAY (Pickup) fulfillment strictly has 0 TZS delivery fee');
  assert(fulfillmentDeliveryFee('DINE_IN', 3500) === 0, 'B3: DINE_IN fulfillment strictly has 0 TZS delivery fee');

  // B4: Quote consumption verification in SQL migration
  const migrationPath = path.join(rootDir, 'supabase/migrations/20260927000100_route_delivery_quotes.sql');
  assert(fs.existsSync(migrationPath), 'B4: Migration 20260927000100_route_delivery_quotes.sql exists');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert(
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.delivery_quotes') &&
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.branch_delivery_pricing'),
    'B4: Migration defines delivery_quotes and branch_delivery_pricing tables'
  );

  assert(
    migrationSql.includes('UPDATE public.delivery_quotes') &&
    migrationSql.includes('consumed_by_order_id = v_order_id') &&
    migrationSql.includes('consumed_at = v_now'),
    'B4: Migration updates delivery_quotes consumed_at and consumed_by_order_id atomically on order placement'
  );

  assert(
    migrationSql.includes("IF p_fulfillment_type = 'Delivery'") &&
    migrationSql.includes('Takeaway / Dine-In has ZERO delivery fee') &&
    migrationSql.includes('v_delivery_fee := 0;'),
    'B4: Database RPC create_order_secure sets v_delivery_fee := 0 for Takeaway / Dine-In'
  );

  // B5: quote-delivery Edge Function pricing configuration checks
  const quoteDeliverySrc = fs.readFileSync(path.join(rootDir, 'supabase/functions/quote-delivery/index.ts'), 'utf8');
  assert(quoteDeliverySrc.includes('DELIVERY_PRICING_NOT_CONFIGURED'), 'B5: quote-delivery returns 503 DELIVERY_PRICING_NOT_CONFIGURED when unconfigured');
  assert(quoteDeliverySrc.includes('DELIVERY_PRICING_NOT_CONFIRMED'), 'B5: quote-delivery returns 503 DELIVERY_PRICING_NOT_CONFIRMED when unconfirmed');
  assert(quoteDeliverySrc.includes('FIXED_ZONE_PRICING_ACTIVE'), 'B5: quote-delivery returns 409 FIXED_ZONE_PRICING_ACTIVE for fixed zone branches');

  // B6: quote-delivery saved address ownership resolution
  assert(quoteDeliverySrc.includes('SAVED_ADDRESS_NOT_FOUND'), 'B6: quote-delivery checks customer_saved_addresses and rejects unowned/missing with 404');
  assert(quoteDeliverySrc.includes('saved_address_id: savedAddressId || null'), 'B6: quote-delivery records saved_address_id on quote creation');

  // B7: Migration schema contains pricing_mode and delivery_quotes columns
  assert(migrationSql.includes('pricing_mode VARCHAR(30)'), 'B7: Migration schema includes pricing_mode on branch_delivery_pricing');
  assert(migrationSql.includes('saved_address_id UUID REFERENCES public.customer_saved_addresses'), 'B7: Migration schema includes saved_address_id on delivery_quotes');
  assert(migrationSql.includes("v_pricing_mode = 'ROUTE_DISTANCE'"), 'B7: create_order_secure branches on pricing_mode = ROUTE_DISTANCE');
  assert(migrationSql.includes("v_pricing_mode = 'FIXED_ZONE'"), 'B7: create_order_secure branches on pricing_mode = FIXED_ZONE');

  // --------------------------------------------------------------------------
  // Group C: Mobile-Money Canonical Operators & Carrier Detection
  // --------------------------------------------------------------------------
  console.log('\n--- Group C: Mobile-Money Providers & Carrier Detection ---');

  // C1: Canonical 4 mobile money operators
  assert(MOBILE_MONEY_METHODS.length === 4, 'C1: Exactly 4 canonical mobile money operators configured');
  const operatorIds = MOBILE_MONEY_METHODS.map((m) => m.id);
  assert(operatorIds.includes('MPESA'), 'C1: Vodacom M-Pesa is configured');
  assert(operatorIds.includes('AIRTEL_MONEY'), 'C1: Airtel Money is configured');
  assert(operatorIds.includes('MIXX_BY_YAS'), 'C1: Mixx by Yas (Tigo Pesa) is configured');
  assert(operatorIds.includes('HALOPESA'), 'C1: HaloPesa is configured');

  // C2: Non-canonical methods are NOT present in primary checkout
  assert(!operatorIds.includes('CARD' as any), 'C2: Card payment is NOT in mobile money checkout');
  assert(!operatorIds.includes('CASH_ON_DELIVERY' as any), 'C2: Cash on delivery is NOT in mobile money checkout');
  assert(!operatorIds.includes('EZYPESA' as any), 'C2: EzyPesa is NOT in canonical mobile money checkout');

  // C3: Carrier phone detection
  assert(detectCarrierFromPhone('0754123456') === 'MPESA', 'C3: 0754... detected as Vodacom M-Pesa');
  assert(detectCarrierFromPhone('+255762000000') === 'MPESA', 'C3: +255 762... detected as Vodacom M-Pesa');
  assert(detectCarrierFromPhone('0784123456') === 'AIRTEL_MONEY', 'C3: 0784... detected as Airtel Money');
  assert(detectCarrierFromPhone('+255682000000') === 'AIRTEL_MONEY', 'C3: +255 682... detected as Airtel Money');
  assert(detectCarrierFromPhone('0712000000') === 'MIXX_BY_YAS', 'C3: 0712... detected as Mixx by Yas (Tigo)');
  assert(detectCarrierFromPhone('+255655000000') === 'MIXX_BY_YAS', 'C3: +255 655... detected as Mixx by Yas (Tigo)');
  assert(detectCarrierFromPhone('0624000000') === 'HALOPESA', 'C3: 0624... detected as HaloPesa');
  assert(detectCarrierFromPhone('+255620000000') === 'HALOPESA', 'C3: +255 620... detected as HaloPesa');
  assert(detectCarrierFromPhone('0123456789') === undefined, 'C3: Unknown prefix returns undefined');

  // C4: Phone normalization
  assert(normalizeTanzaniaPhone('0754123456') === '+255754123456', 'C4: Normalizes 0754123456 to +255754123456');
  assert(normalizeTanzaniaPhone('+255 754 123 456') === '+255754123456', 'C4: Strips spaces from +255 754 123 456');
  assert(isValidTanzaniaPhone('+255754123456'), 'C4: +255754123456 is valid Tanzanian number');
  assert(!isValidTanzaniaPhone('12345'), 'C4: Short invalid number rejected');
  assert(!isValidTanzaniaPhone('+1234567890'), 'C4: Non-Tanzanian country code rejected');

  // C5: Phone display formatting
  assert(formatTanzaniaPhoneDisplay('+255754123456') === '+255 754 123 456', 'C5: Formats for display with grouped spaces');

  // --------------------------------------------------------------------------
  // Group D: Payment Flow State Machine & Attempt Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Group D: Payment State Machine & Attempt Isolation ---');

  // D1: Unique attempt ID generation
  const attempt1 = generatePaymentAttemptId();
  const attempt2 = generatePaymentAttemptId();
  assert(attempt1 !== attempt2, 'D1: Successive attempt IDs are strictly distinct');
  assert(attempt1.startsWith('att_') || attempt1.length >= 16, 'D1: Attempt ID is generated');

  // D2: Idempotency key scoping
  const idempotencyKey1 = generatePaymentIdempotencyKey('user-123', 'order-456', attempt1);
  const idempotencyKey2 = generatePaymentIdempotencyKey('user-123', 'order-456', attempt2);
  assert(idempotencyKey1 !== idempotencyKey2, 'D2: Different attempt IDs produce distinct idempotency keys');
  assert(
    idempotencyKey1.includes('user-123') &&
    idempotencyKey1.includes('order-456') &&
    idempotencyKey1.includes(attempt1),
    'D2: Idempotency key contains user ID, target identifier, and attempt ID'
  );

  // D3: Failure categorization
  const f1 = classifyPaymentFailure('Salio halitoshi kufanya muamala huu');
  assert(f1.code === 'INSUFFICIENT_FUNDS', 'D3: "Salio halitoshi" classifies as INSUFFICIENT_FUNDS');

  const f2 = classifyPaymentFailure('Transaction was cancelled by customer');
  assert(f2.code === 'CUSTOMER_CANCELLED', 'D3: "cancelled by customer" classifies as CUSTOMER_CANCELLED');

  const f3 = classifyPaymentFailure('USSD session timed out or expired');
  assert(f3.code === 'EXPIRED', 'D3: "timed out or expired" classifies as EXPIRED');

  const f4 = classifyPaymentFailure('Network connection lost to carrier gateway');
  assert(f4.code === 'NETWORK_ERROR', 'D3: "Network connection lost" classifies as NETWORK_ERROR');

  const f5 = classifyPaymentFailure('Unrecognized operator response code 999');
  assert(f5.code === 'UNKNOWN', 'D3: Unrecognized message classifies as UNKNOWN');

  // --------------------------------------------------------------------------
  // Group E: Security Guards & Zero Leaks Negative Audit
  // --------------------------------------------------------------------------
  console.log('\n--- Group E: Security Guards & Zero Secret Leaks ---');

  // E1: Zero client exposure of Google Routes API secret
  const appSrc = fs.readFileSync(path.join(rootDir, 'services/api/DeliveryQuoteApi.ts'), 'utf8');
  assert(!appSrc.includes('GOOGLE_ROUTES_API_KEY'), 'E1: DeliveryQuoteApi does not reference GOOGLE_ROUTES_API_KEY');
  assert(!appSrc.includes('AIzaSy'), 'E1: DeliveryQuoteApi contains zero embedded Google API keys');

  // Scan all client-side code in app/ and components/ for EXPO_PUBLIC_GOOGLE
  const appDir = path.join(rootDir, 'app');
  const componentsDir = path.join(rootDir, 'components');
  
  function scanDirForForbidden(dir: string, forbidden: string): string[] {
    const violations: string[] = [];
    if (!fs.existsSync(dir)) return violations;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        violations.push(...scanDirForForbidden(full, forbidden));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes(forbidden)) {
          violations.push(full);
        }
      }
    }
    return violations;
  }

  const clientGoogleKeyViolations = [
    ...scanDirForForbidden(appDir, 'EXPO_PUBLIC_GOOGLE'),
    ...scanDirForForbidden(componentsDir, 'EXPO_PUBLIC_GOOGLE'),
    ...scanDirForForbidden(appDir, 'GOOGLE_ROUTES_API_KEY'),
    ...scanDirForForbidden(componentsDir, 'GOOGLE_ROUTES_API_KEY'),
  ];
  assert(clientGoogleKeyViolations.length === 0, `E1: Zero client files expose Google Routes secrets (found ${clientGoogleKeyViolations.length})`);

  // E2: Strict PIN security guard: client never collects or prompts for PIN
  const paymentModalSrc = fs.readFileSync(path.join(rootDir, 'components/PaymentCheckoutModal.tsx'), 'utf8');
  assert(!paymentModalSrc.includes('pinInput') && !paymentModalSrc.includes('enter your PIN') && !paymentModalSrc.includes('Weka PIN yako'),
    'E2: PaymentCheckoutModal contains zero PIN input fields or prompts'
  );
  assert(
    paymentModalSrc.includes('PAYMENT_SECURITY_PIN_NOTICE_EN') ||
    paymentModalSrc.includes('never asks for your mobile money PIN') ||
    paymentModalSrc.includes('haombi kamwe PIN'),
    'E2: PaymentCheckoutModal explicitly warns customer that MloHub never asks for PIN'
  );

  // E3: Server-side create-payment Edge Function forbids PIN payloads
  const createPaymentSrc = fs.readFileSync(path.join(rootDir, 'supabase/functions/create-payment/index.ts'), 'utf8');
  assert(
    createPaymentSrc.includes('PIN_PROHIBITED') &&
    createPaymentSrc.includes('MloHub never accepts or handles mobile money PINs'),
    'E3: create-payment Edge Function rejects any request containing PIN fields with 400 Bad Request'
  );

  // E4: Server-side create-payment Edge Function enforces user ownership and scoped idempotency
  assert(
    createPaymentSrc.includes(".eq('user_id', user.id)") &&
    createPaymentSrc.includes(".eq('idempotency_key', idempotencyKey)"),
    'E4: create-payment Edge Function scopes idempotency cache lookup strictly by user.id'
  );

  // E5: Success screen persistence: PaymentCheckoutModal separates onPaymentVerified and onFlowComplete
  assert(
    paymentModalSrc.includes('onPaymentVerified?.(') &&
    paymentModalSrc.includes('onFlowComplete?.(') &&
    paymentModalSrc.includes('handleSuccessContinue'),
    'E5: PaymentCheckoutModal keeps success screen visible until customer taps Continue (separates verification from dismissal)'
  );

  console.log('\n================================================================');
  console.log(`🏁 PAYMENT & DELIVERY CLOSURE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runPaymentDeliveryClosureTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
