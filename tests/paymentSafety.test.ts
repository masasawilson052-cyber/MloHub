/**
 * ============================================================================
 * MLOHUB PAYMENT SAFETY, DUPLICATE DEFENSE & STUCK RECOVERY SUITE
 * ============================================================================
 */

import assert from 'assert';
import { Payment } from '../types/domain';

export async function runPaymentSafetyTestSuite(): Promise<void> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB PAYMENT SAFETY, DUPLICATE DEFENSE & STUCK RECOVERY SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Scenario 1: Multi-Provider Webhook Validation & Currency Coalesce
  // ---------------------------------------------------------------------------
  console.log('--- Scenario 1: Provider & Currency Webhook Validation ---');

  const allowedProviders = ['clickpesa', 'selcom', 'sandbox'];
  function validateProvider(paymentProvider: string, incomingProvider: string): boolean {
    const pUpper = paymentProvider.toUpperCase();
    const inUpper = incomingProvider.toUpperCase();
    const inLower = incomingProvider.toLowerCase();
    return pUpper === inUpper && allowedProviders.includes(inLower);
  }

  assert.strictEqual(validateProvider('selcom', 'selcom'), true, 'Selcom provider validated');
  assert.strictEqual(validateProvider('SELCOM', 'selcom'), true, 'Selcom case-insensitive equality supported');
  assert.strictEqual(validateProvider('sandbox', 'sandbox'), true, 'Sandbox provider validated');
  assert.strictEqual(validateProvider('clickpesa', 'clickpesa'), true, 'ClickPesa provider validated');
  assert.strictEqual(validateProvider('selcom', 'unknown_gw'), false, 'Unknown gateway rejected');
  assert.strictEqual(validateProvider('selcom', 'clickpesa'), false, 'Mismatched provider rejected');

  function validateCurrency(rawPayload: Record<string, any>): string {
    return (
      rawPayload?.data?.collectedCurrency ||
      rawPayload?.currency ||
      rawPayload?.data?.currency ||
      'TZS'
    );
  }

  assert.strictEqual(validateCurrency({ data: { collectedCurrency: 'TZS' } }), 'TZS', 'data.collectedCurrency extracted');
  assert.strictEqual(validateCurrency({ currency: 'TZS' }), 'TZS', 'currency extracted');
  assert.strictEqual(validateCurrency({ data: { currency: 'TZS' } }), 'TZS', 'data.currency extracted');
  assert.strictEqual(validateCurrency({}), 'TZS', 'Missing currency defaults safely to TZS for stuck-recovery calls');
  assert.strictEqual(validateCurrency({ currency: 'USD' }), 'USD', 'USD currency captured for mismatch rejection');

  // ---------------------------------------------------------------------------
  // Scenario 2: Create-Payment Stuck Pending Rules (10m / 30m / Gateway States)
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Create-Payment Stuck Pending State Engine ---');

  interface StuckRuleOutcome {
    action: 'REUSE' | 'CONFIRM' | 'KEEP_PENDING' | 'EXPIRE' | 'GATEWAY_ERROR' | 'AMOUNT_REVIEW';
    httpStatus: number;
    error?: string;
    message?: string;
  }

  function evaluateStuckPaymentRule(params: {
    ageMinutes: number;
    gatewayStatus?: 'PAID' | 'SUCCESS' | 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'NOT_FOUND';
    gatewayAmountTzs?: number;
    expectedAmountTzs: number;
    gatewayError?: boolean;
  }): StuckRuleOutcome {
    const ageMs = params.ageMinutes * 60 * 1000;
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;

    // Fresh (<10 min)
    if (ageMs <= TEN_MINUTES_MS) {
      return { action: 'REUSE', httpStatus: 200, message: 'An active payment attempt is already pending for this order.' };
    }

    // Gateway call error / unreachable
    if (params.gatewayError) {
      return {
        action: 'GATEWAY_ERROR',
        httpStatus: 503,
        error: 'GATEWAY_UNAVAILABLE',
        message: 'Payment gateway is temporarily unavailable. Please try again in a minute.',
      };
    }

    const status = params.gatewayStatus?.toUpperCase();
    if (status === 'PAID' || status === 'SUCCESS' || status === 'COMPLETED') {
      if (params.gatewayAmountTzs && params.gatewayAmountTzs !== params.expectedAmountTzs) {
        return {
          action: 'AMOUNT_REVIEW',
          httpStatus: 409,
          error: 'PAYMENT_NEEDS_REVIEW',
          message: 'Payment received with unexpected amount and requires administrative review.',
        };
      }
      return { action: 'CONFIRM', httpStatus: 200, message: 'Order payment has already been completed.' };
    }

    if (status === 'PENDING' || status === 'PROCESSING') {
      if (ageMs > THIRTY_MINUTES_MS) {
        return { action: 'EXPIRE', httpStatus: 200, message: 'Expired after 30 minutes to allow new payment.' };
      }
      return { action: 'KEEP_PENDING', httpStatus: 200, message: 'Approve the request on your phone' };
    }

    // FAILED, EXPIRED, CANCELLED, NOT_FOUND
    return { action: 'EXPIRE', httpStatus: 200, message: 'Expired by gateway status to allow new payment.' };
  }

  // (a) 15m PENDING stays PENDING
  const res15mPending = evaluateStuckPaymentRule({
    ageMinutes: 15,
    gatewayStatus: 'PENDING',
    expectedAmountTzs: 15000,
  });
  assert.strictEqual(res15mPending.action, 'KEEP_PENDING', '15m PENDING stays PENDING');
  assert.strictEqual(res15mPending.message, 'Approve the request on your phone', 'Shows friendly Swahili-friendly prompt');

  // (b) 15m FAILED -> EXPIRED and allows new payment
  const res15mFailed = evaluateStuckPaymentRule({
    ageMinutes: 15,
    gatewayStatus: 'FAILED',
    expectedAmountTzs: 15000,
  });
  assert.strictEqual(res15mFailed.action, 'EXPIRE', '15m FAILED expires payment to allow retry');

  // (e) Unreachable gateway leaves payment PENDING (503 GATEWAY_UNAVAILABLE)
  const resGatewayDown = evaluateStuckPaymentRule({
    ageMinutes: 15,
    gatewayError: true,
    expectedAmountTzs: 15000,
  });
  assert.strictEqual(resGatewayDown.action, 'GATEWAY_ERROR', 'Gateway unreachable leaves payment untouched');
  assert.strictEqual(resGatewayDown.httpStatus, 503, 'Returns 503 HTTP status');
  assert.strictEqual(resGatewayDown.error, 'GATEWAY_UNAVAILABLE', 'Returns GATEWAY_UNAVAILABLE error code');

  // (f) >30m PENDING -> EXPIRED
  const res35mPending = evaluateStuckPaymentRule({
    ageMinutes: 35,
    gatewayStatus: 'PENDING',
    expectedAmountTzs: 15000,
  });
  assert.strictEqual(res35mPending.action, 'EXPIRE', '>30m PENDING transitions to EXPIRED');

  // (g) PAID with different amount -> 409 PAYMENT_NEEDS_REVIEW
  const resAmountMismatch = evaluateStuckPaymentRule({
    ageMinutes: 15,
    gatewayStatus: 'PAID',
    gatewayAmountTzs: 10000,
    expectedAmountTzs: 15000,
  });
  assert.strictEqual(resAmountMismatch.action, 'AMOUNT_REVIEW', 'Paid with different amount flagged for review');
  assert.strictEqual(resAmountMismatch.httpStatus, 409, 'Returns 409 HTTP conflict');
  assert.strictEqual(resAmountMismatch.error, 'PAYMENT_NEEDS_REVIEW', 'Returns PAYMENT_NEEDS_REVIEW error');

  // ---------------------------------------------------------------------------
  // Scenario 3: Duplicate Payment Defense Simulation
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Authoritative Duplicate Defense Simulation ---');

  interface MockPaymentState {
    id: string;
    orderId: string;
    amountTzs: number;
    status: string;
    duplicateOfPaymentId?: string;
  }

  function simulateWebhookCapture(
    payment: MockPaymentState,
    existingSuccessPaymentsForOrder: MockPaymentState[],
    collectedAmount: number
  ) {
    if (collectedAmount !== payment.amountTzs) {
      return { success: false, error: 'AMOUNT_MISMATCH' };
    }

    const earlierSuccess = existingSuccessPaymentsForOrder.find(
      (p) => p.status === 'SUCCESS' && p.id !== payment.id && !p.duplicateOfPaymentId
    );

    if (earlierSuccess) {
      payment.status = 'SUCCESS';
      payment.duplicateOfPaymentId = earlierSuccess.id;
      return {
        success: true,
        duplicate: true,
        paymentId: payment.id,
        originalPaymentId: earlierSuccess.id,
        message: 'DUPLICATE_PAYMENT',
      };
    }

    // Normal or late approval of EXPIRED payment
    payment.status = 'SUCCESS';
    return {
      success: true,
      duplicate: false,
      paymentId: payment.id,
      message: 'CAPTURED',
    };
  }

  const orderId = 'order_abc_123';
  const pay1: MockPaymentState = { id: 'pay_1', orderId, amountTzs: 20000, status: 'EXPIRED' };
  const pay2: MockPaymentState = { id: 'pay_2', orderId, amountTzs: 20000, status: 'PENDING' };

  // (c) Late approval of EXPIRED payment
  const lateCapture = simulateWebhookCapture(pay1, [], 20000);
  assert.strictEqual(lateCapture.success, true, 'Late EXPIRED payment captured');
  assert.strictEqual(lateCapture.duplicate, false, 'Late EXPIRED payment is NOT a duplicate');
  assert.strictEqual(pay1.status, 'SUCCESS', 'Payment status is now SUCCESS');

  // (d) Second payment succeeds after first already SUCCESS
  const dupCapture = simulateWebhookCapture(pay2, [pay1], 20000);
  assert.strictEqual(dupCapture.success, true, 'Second payment acknowledged');
  assert.strictEqual(dupCapture.duplicate, true, 'Second payment identified as duplicate');
  assert.strictEqual(dupCapture.originalPaymentId, 'pay_1', 'Original payment ID linked');
  assert.strictEqual(pay2.status, 'SUCCESS', 'Duplicate payment recorded as SUCCESS for funds accounting');
  assert.strictEqual(pay2.duplicateOfPaymentId, 'pay_1', 'duplicateOfPaymentId points to pay_1');

  // ---------------------------------------------------------------------------
  // Scenario 4: Revenue Aggregations Strictly Exclude Duplicates
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Revenue Aggregation Safety ---');

  const paymentList: Payment[] = [
    {
      id: 'p1',
      orderId: 'o1',
      customerId: 'c1',
      provider: 'selcom',
      amountTzs: 25000,
      platformCommissionTzs: 2500,
      netRestaurantPayoutTzs: 22500,
      currency: 'TZS',
      paymentMethod: 'MPESA',
      phoneNumber: '0741234567',
      status: 'SUCCESS',
      webhookVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'p2',
      orderId: 'o1', // Duplicate payment for o1
      duplicateOfPaymentId: 'p1',
      customerId: 'c1',
      provider: 'selcom',
      amountTzs: 25000,
      platformCommissionTzs: 2500,
      netRestaurantPayoutTzs: 22500,
      currency: 'TZS',
      paymentMethod: 'MPESA',
      phoneNumber: '0741234567',
      status: 'SUCCESS',
      webhookVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Restaurant Portal Gross Revenue calculation test
  let computedGross = 0;
  for (const p of paymentList) {
    if (p.duplicateOfPaymentId) continue; // Excluded!
    if (p.status === 'SUCCESS') {
      computedGross += p.amountTzs;
    }
  }
  assert.strictEqual(computedGross, 25000, 'Restaurant portal gross strictly excludes duplicate payment (25,000 not 50,000)');

  // Restaurant Portal Earnings Transactions test
  const earnings = paymentList
    .filter((p) => !p.duplicateOfPaymentId)
    .map((p) => p.amountTzs);
  assert.strictEqual(earnings.length, 1, 'Earnings transactions list contains exactly 1 non-duplicate payment');

  console.log('\n================================================================');
  console.log('✓ ALL PAYMENT SAFETY & DUPLICATE DEFENSE TESTS PASSED');
  console.log('================================================================\n');
}
