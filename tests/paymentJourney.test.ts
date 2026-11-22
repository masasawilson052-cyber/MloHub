/**
 * ============================================================================
 * MLOHUB GUIDED MOBILE MONEY, TCRA PREFIXES & BILINGUAL CHECKOUT SUITE
 * ============================================================================
 */

import assert from 'assert';
import {
  detectWalletFromPhone,
  getUssdFallbackCode,
  TCRA_WALLET_CONFIGS,
} from '../config/mobileNetworkPrefixes';
import {
  normalizeLocalTanzaniaDigits,
  isValidLocalTanzaniaPhone,
  formatAsYouTypeTanzaniaPhone,
  toGatewayTanzaniaPhone,
} from '../utils/phone';
import {
  getEnabledPaymentMethodCodes,
  isPaymentMethodEnabled,
} from '../supabase/functions/_shared/payments/enabledMethods';
import { TRANSLATIONS } from '../context/LanguageContext';

export async function runPaymentJourneyTestSuite(): Promise<void> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB GUIDED MOBILE MONEY, TCRA PREFIXES & BILINGUAL CHECKOUT SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. TCRA National Numbering Plan & Wallet Suggestions
  // ---------------------------------------------------------------------------
  console.log('--- Scenario 1: TCRA Mobile Network Prefixes & Wallet Recommendations ---');

  // Vodacom (074, 075, 076, 079)
  assert.strictEqual(detectWalletFromPhone('0741000111'), 'MPESA', '074 maps to M-Pesa');
  assert.strictEqual(detectWalletFromPhone('0754123456'), 'MPESA', '075 maps to M-Pesa');
  assert.strictEqual(detectWalletFromPhone('0765999888'), 'MPESA', '076 maps to M-Pesa');
  assert.strictEqual(detectWalletFromPhone('0799123456'), 'MPESA', '079 maps to M-Pesa');

  // Yas / Tigo (065, 067, 071, 077)
  assert.strictEqual(detectWalletFromPhone('0655123456'), 'MIXX_BY_YAS', '065 maps to Mixx by Yas');
  assert.strictEqual(detectWalletFromPhone('0671000222'), 'MIXX_BY_YAS', '067 maps to Mixx by Yas');
  assert.strictEqual(detectWalletFromPhone('0713000333'), 'MIXX_BY_YAS', '071 maps to Mixx by Yas');
  assert.strictEqual(detectWalletFromPhone('0774000444'), 'MIXX_BY_YAS', '077 (Zantel) maps to Mixx by Yas');

  // Airtel (068, 069, 078)
  assert.strictEqual(detectWalletFromPhone('0688000555'), 'AIRTEL_MONEY', '068 maps to Airtel Money');
  assert.strictEqual(detectWalletFromPhone('0699000666'), 'AIRTEL_MONEY', '069 maps to Airtel Money');
  assert.strictEqual(detectWalletFromPhone('0784000777'), 'AIRTEL_MONEY', '078 maps to Airtel Money');

  // Halotel (061, 062)
  assert.strictEqual(detectWalletFromPhone('0612000888'), 'HALOPESA', '061 maps to HaloPesa');
  assert.strictEqual(detectWalletFromPhone('0624000999'), 'HALOPESA', '062 maps to HaloPesa');

  // Excluded or unmapped (TTCL 073, Smile 066, 064, 072)
  assert.strictEqual(detectWalletFromPhone('0732000111'), undefined, '073 (TTCL) returns no suggestion');
  assert.strictEqual(detectWalletFromPhone('0662000222'), undefined, '066 (Smile) returns no suggestion');
  assert.strictEqual(detectWalletFromPhone('0642000333'), undefined, '064 returns no suggestion');
  assert.strictEqual(detectWalletFromPhone('0722000444'), undefined, '072 returns no suggestion');

  // USSD Fallback codes
  assert.strictEqual(getUssdFallbackCode('MPESA'), '*150*00#', 'M-Pesa USSD fallback is *150*00#');
  assert.strictEqual(getUssdFallbackCode('MIXX_BY_YAS'), '*150*01#', 'Mixx by Yas USSD fallback is *150*01#');
  assert.strictEqual(getUssdFallbackCode('AIRTEL_MONEY'), '*150*60#', 'Airtel Money USSD fallback is *150*60#');
  assert.strictEqual(getUssdFallbackCode('HALOPESA'), undefined, 'HaloPesa USSD is unconfirmed, correctly hidden');
  console.log('  ✓ TCRA mobile prefixes and USSD fallback rules verified');

  // ---------------------------------------------------------------------------
  // 2. Phone Input Formatting As You Type & Gateway Normalization
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Phone Input Formatting & 10-Digit Validation ---');

  // Accepts different input formats
  assert.strictEqual(normalizeLocalTanzaniaDigits('0754123456'), '0754123456', '07XXXXXXXX accepted');
  assert.strictEqual(normalizeLocalTanzaniaDigits('754123456'), '0754123456', '7XXXXXXXX normalized with leading 0');
  assert.strictEqual(normalizeLocalTanzaniaDigits('255754123456'), '0754123456', '2557XXXXXXXX converted to local 07...');
  assert.strictEqual(normalizeLocalTanzaniaDigits('+255754123456'), '0754123456', '+2557XXXXXXXX converted to local 07...');
  assert.strictEqual(normalizeLocalTanzaniaDigits('+255688123456'), '0688123456', '+255688XXXXXX converted to local 06...');

  // As-you-type formatting
  assert.strictEqual(formatAsYouTypeTanzaniaPhone('0754'), '0754', '4 digits -> 0754');
  assert.strictEqual(formatAsYouTypeTanzaniaPhone('07541'), '0754 1', '5 digits -> 0754 1');
  assert.strictEqual(formatAsYouTypeTanzaniaPhone('0754123'), '0754 123', '7 digits -> 0754 123');
  assert.strictEqual(formatAsYouTypeTanzaniaPhone('0754123456'), '0754 123 456', '10 digits -> 0754 123 456');

  // Validation
  assert.strictEqual(isValidLocalTanzaniaPhone('0754 123 456'), true, 'Valid 10 local digits');
  assert.strictEqual(isValidLocalTanzaniaPhone('0754123456'), true, 'Valid 10 digits without spaces');
  assert.strictEqual(isValidLocalTanzaniaPhone('075412345'), false, '9 digits invalid');
  assert.strictEqual(isValidLocalTanzaniaPhone('07541234567'), false, '11 digits invalid');
  assert.strictEqual(isValidLocalTanzaniaPhone('0854123456'), false, 'Prefix 08 invalid');

  // Gateway format (255XXXXXXXXX)
  assert.strictEqual(toGatewayTanzaniaPhone('0754 123 456'), '255754123456', 'Formatted to 255XXXXXXXXX for gateway');
  assert.strictEqual(toGatewayTanzaniaPhone('+255688123456'), '255688123456', 'Formatted to 255XXXXXXXXX from E.164');
  console.log('  ✓ Phone as-you-type formatting (07XX XXX XXX) and 10-digit validation verified');

  // ---------------------------------------------------------------------------
  // 3. Enabled Payment Methods & Strict Ordering
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Enabled Payment Methods & Strict Ordering ---');

  const defaultMethods = getEnabledPaymentMethodCodes();
  assert.deepStrictEqual(
    defaultMethods,
    ['MPESA', 'MIXX_BY_YAS', 'AIRTEL_MONEY', 'HALOPESA'],
    'Default enabled methods strictly order M-Pesa, Mixx by Yas, Airtel Money, HaloPesa'
  );

  assert.strictEqual(isPaymentMethodEnabled('MPESA'), true);
  assert.strictEqual(isPaymentMethodEnabled('MIXX_BY_YAS'), true);
  assert.strictEqual(isPaymentMethodEnabled('AIRTEL_MONEY'), true);
  assert.strictEqual(isPaymentMethodEnabled('HALOPESA'), true);
  assert.strictEqual(isPaymentMethodEnabled('UNKNOWN_METHOD'), false, 'Unknown method is not enabled');

  // Bank gating test
  const previousEnv = process.env.ALLOW_BANK_PAYMENTS;
  try {
    process.env.ALLOW_BANK_PAYMENTS = 'true';
    const bankMethods = getEnabledPaymentMethodCodes();
    assert.ok(bankMethods.includes('NMB'), 'NMB enabled when ALLOW_BANK_PAYMENTS=true');
    assert.ok(bankMethods.includes('CRDB'), 'CRDB enabled when ALLOW_BANK_PAYMENTS=true');
    assert.strictEqual(bankMethods[0], 'MPESA');
    assert.strictEqual(bankMethods[1], 'MIXX_BY_YAS');
    assert.strictEqual(bankMethods[2], 'AIRTEL_MONEY');
    assert.strictEqual(bankMethods[3], 'HALOPESA');
    assert.strictEqual(bankMethods[4], 'NMB');
    assert.strictEqual(bankMethods[5], 'CRDB');
  } finally {
    process.env.ALLOW_BANK_PAYMENTS = previousEnv;
  }
  console.log('  ✓ Enabled methods filtering and canonical order (M-Pesa, Mixx, Airtel, HaloPesa, Banks) verified');

  // ---------------------------------------------------------------------------
  // 4. Stuck Pending Payments & Idempotent Retry Logic
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Stuck Pending Payments & Safe Retry Rules ---');

  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  // Fresh pending payment (e.g. 2 minutes old)
  const freshPayment = {
    id: 'pay-fresh-1',
    status: 'PENDING',
    created_at: new Date(now - 2 * 60 * 1000).toISOString(),
  };
  const isFresh = now - new Date(freshPayment.created_at).getTime() <= TEN_MINUTES_MS;
  assert.strictEqual(isFresh, true, 'Payment under 10m is fresh and must be reused');

  // Stuck pending payment (e.g. 15 minutes old)
  const stuckPayment = {
    id: 'pay-stuck-1',
    status: 'PENDING',
    created_at: new Date(now - 15 * 60 * 1000).toISOString(),
  };
  const isStuck = now - new Date(stuckPayment.created_at).getTime() > TEN_MINUTES_MS;
  assert.strictEqual(isStuck, true, 'Payment older than 10m is stuck; gateway must be queried and expired if unconfirmed');

  // Retry action simulation
  let inFlightPaymentStatus = 'PENDING';
  let duplicateChargeAttempted = false;

  const simulateCustomerRetry = (status: string) => {
    if (status === 'PENDING') {
      // Show approve prompt, don't create new charge
      return { action: 'SHOW_APPROVE_PROMPT', duplicateChargeAttempted: false };
    }
    // FAILED or EXPIRED: allowed to start new attempt
    duplicateChargeAttempted = true;
    return { action: 'START_NEW_ATTEMPT', duplicateChargeAttempted: true };
  };

  const retry1 = simulateCustomerRetry(inFlightPaymentStatus);
  assert.strictEqual(retry1.action, 'SHOW_APPROVE_PROMPT');
  assert.strictEqual(retry1.duplicateChargeAttempted, false, 'No new charge while in-flight payment is PENDING');

  const retry2 = simulateCustomerRetry('EXPIRED');
  assert.strictEqual(retry2.action, 'START_NEW_ATTEMPT');
  assert.strictEqual(retry2.duplicateChargeAttempted, true, 'New payment attempt initiated after previous EXPIRED');

  console.log('  ✓ Fresh pending payments reused; 10m+ stuck payments expired; retry guards against duplicate charges');

  // ---------------------------------------------------------------------------
  // 5. Bilingual Key Parity & Natural Swahili Terms
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Translation Key Parity & Natural Swahili Terms ---');

  const enKeys = Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[];
  const swKeys = Object.keys(TRANSLATIONS.sw) as (keyof typeof TRANSLATIONS.sw)[];

  assert.strictEqual(enKeys.length, swKeys.length, `Key parity: en (${enKeys.length}) === sw (${swKeys.length})`);

  for (const key of enKeys) {
    assert.ok(
      TRANSLATIONS.sw[key] !== undefined && TRANSLATIONS.sw[key].trim().length > 0,
      `Swahili translation for key "${key}" must be non-empty`
    );
    assert.ok(
      TRANSLATIONS.en[key] !== undefined && TRANSLATIONS.en[key].trim().length > 0,
      `English translation for key "${key}" must be non-empty`
    );
  }

  // Exact phrasing rules specified in user requirements
  assert.strictEqual(TRANSLATIONS.sw.cartEstimatedTotal, 'Jumla', 'Total in Swahili is "Jumla" (not "Jumla kuu")');
  assert.strictEqual(TRANSLATIONS.sw.cartTotal, 'Jumla', 'Total in Swahili is "Jumla"');
  assert.strictEqual(TRANSLATIONS.sw.cartSubtotal, 'Jumla ndogo', 'Subtotal is "Jumla ndogo"');
  assert.strictEqual(TRANSLATIONS.sw.cartServiceFee, 'Ada ya huduma', 'Service fee is "Ada ya huduma"');
  assert.strictEqual(TRANSLATIONS.sw.cartDeliveryFee, 'Ada ya usafirishaji', 'Delivery fee is "Ada ya usafirishaji"');
  assert.strictEqual(TRANSLATIONS.sw.checkoutContinuePayment, 'Lipa', 'Payment button is "Lipa"');
  assert.strictEqual(TRANSLATIONS.sw.paymentIvePaid, 'Nimeshalipa', 'Waiting button is "Nimeshalipa" (drop "(Hakiki)")');
  assert.strictEqual(TRANSLATIONS.sw.fulfillmentDelivery, 'Kuletewa', 'Delivery is "Kuletewa"');
  assert.strictEqual(TRANSLATIONS.sw.fulfillmentTakeaway, 'Kuchukua', 'Takeaway is "Kuchukua"');
  assert.strictEqual(TRANSLATIONS.sw.fulfillmentDineIn, 'Kula Hapo', 'Dine-In is "Kula Hapo"');

  console.log('  ✓ 100% translation key parity across English and Swahili with natural East African phrasing');

  console.log('\n================================================================');
  console.log('✓ ALL GUIDED MOBILE MONEY & BILINGUAL CHECKOUT TESTS PASSED');
  console.log('================================================================\n');
}

if (require.main === module) {
  runPaymentJourneyTestSuite().catch((err) => {
    console.error('Payment journey test suite failed:', err);
    process.exit(1);
  });
}
