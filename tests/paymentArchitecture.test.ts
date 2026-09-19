/**
 * ==============================================================================
 * MLOHUB STAGE 9: SERVER-DRIVEN PAYMENT ARCHITECTURE TEST SUITE
 * ==============================================================================
 * Validates:
 * 1. Authoritative Amount Resolution (Zero-Trust)
 * 2. Standard Order Mobile Money USSD Push & Webhook Fulfillment
 * 3. Custom Meal Batch Quote Payment & Kitchen Locking
 * 4. Table Reservation 50% Deposit & 100% Full Payment
 * 5. Cryptographic Webhook HMAC-SHA256 Signature Verification & Forgery Defense
 * 6. Replay Attack Prevention & Idempotency
 * 7. Amount Mismatch & Underpayment Fraud Defense
 * 8. Telecom Carrier Prefix Detection & Routing
 * 9. Multi-Gateway Provider Abstraction (ClickPesa, Selcom, Sandbox)
 * 10. Admin-Authorized Refund Lifecycle & Ledger Auditing
 * 11. Automated Reconciliation of Stranded Transactions
 * ==============================================================================
 */

import { MloHubDB } from '../db';
import { PaymentGatewayService } from '../services/PaymentGatewayService';
import { PaymentGatewayFactory, SandboxPaymentGateway, ClickPesaGateway, SelcomGateway } from '../services/payments';
import { PaymentReconciliationService } from '../services/PaymentReconciliationService';
import { normalizeTanzanianPhone } from '../utils/phoneNormalization';

export async function runPaymentArchitectureTestSuite(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log('💳 STAGE 9: SERVER-DRIVEN TANZANIAN PAYMENT ARCHITECTURE TEST SUITE');
  console.log('================================================================');

  await MloHubDB.init();

  // ----------------------------------------------------------------------------
  // Test Group 1: Authoritative Amount Resolution (Zero-Trust)
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 1: Authoritative Amount Resolution & Zero-Trust Pricing');

  const customMealOrder = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: 'Authentic Bagia za Dengu Feast',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Extra tamarind sauce for 15 people',
    budgetTzs: 45000,
    quotedPriceTzs: 55000,
    finalPrice: 55000,
    servingsCount: '15',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Quote ready',
    statusMessageSw: 'Ofa tayari',
  });

  const initRes = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: customMealOrder.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 100, // Tampered client amount!
    deliveryFee: 2500,
    serviceFee: 1500,
    discount: 0,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 111 222',
  });

  assert(initRes.success === true, 'Payment initiated successfully');
  assert(initRes.paidAmountTzs === 59000, `Client tampered amount (100) ignored; authoritative total locked: ${initRes.paidAmountTzs} TZS (55,000 + 2,500 + 1,500)`);
  assert(initRes.merchantReference.startsWith('CPTZ'), 'Valid merchant reference generated');
  assert(initRes.status === 'PENDING', 'Payment begins in PENDING status');

  const initialPaymentEvents = MloHubDB.paymentEvents.getByPaymentId(initRes.paymentId);
  assert(initialPaymentEvents.length === 1, 'Initial PAYMENT_INITIATED event recorded in append-only ledger');
  assert(initialPaymentEvents[0].actorType === 'CUSTOMER', 'Ledger logs CUSTOMER as initiation actor');

  // ----------------------------------------------------------------------------
  // Test Group 2: Standard Order USSD Push & Webhook Confirmation
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 2: Standard Order USSD Push & Webhook Confirmation');

  const standardOrder = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: 'Kuku Choma & Ndizi',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Hot pilipili',
    budgetTzs: 28000,
    finalPrice: 28000,
    servingsCount: '2',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Pending payment',
    statusMessageSw: 'Inasubiri malipo',
  });

  const orderPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: standardOrder.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 28000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 999 888',
  });

  assert(orderPayment.success === true, 'Order payment initiated');
  assert(orderPayment.carrierName === 'Vodacom M-Pesa', 'Vodacom M-Pesa carrier resolved');
  assert(orderPayment.ussdCode === '*150*00#', 'USSD code *150*00# resolved for M-Pesa');

  // Construct valid signed webhook payload
  const { body: webhookBody, signature: webhookSig } = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: orderPayment.merchantReference,
    gatewayReference: orderPayment.providerReference,
    amountTzs: orderPayment.paidAmountTzs,
    payerPhone: '+255 754 999 888',
    status: 'SUCCESS',
  });

  const webhookResult = await PaymentGatewayService.processWebhook(webhookBody, webhookSig);
  assert(webhookResult.success === true, 'Webhook processed and verified successfully');
  assert(webhookResult.payment?.status === 'PAID', 'Payment status transitioned to PAID');

  const updatedOrder = MloHubDB.customOrders.getById(standardOrder.id);
  assert(updatedOrder?.status === 'Confirmed', 'Order status transitioned to Confirmed');
  assert(updatedOrder?.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID');

  const confirmedEvents = MloHubDB.paymentEvents.getByPaymentId(orderPayment.paymentId);
  assert(confirmedEvents.some((e) => e.eventType === 'PAYMENT_CONFIRMED'), 'PAYMENT_CONFIRMED recorded in ledger');

  // ----------------------------------------------------------------------------
  // Test Group 3: Custom Meal Batch Quote Payment & Kitchen Prep Lock
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 3: Custom Meal Batch Quote Payment & Kitchen Prep Lock');

  const batchMeal = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: 'Corporate Seafood Pilau 50 Pax',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Prawns and calamari',
    budgetTzs: 250000,
    quotedPriceTzs: 320000,
    finalPrice: 320000,
    servingsCount: '50',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Awaiting customer deposit',
    statusMessageSw: 'Inasubiri malipo ya awali',
  });

  const batchPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: batchMeal.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 320000,
    provider: 'sandbox',
    methodCode: 'AIRTEL_MONEY',
    paymentType: 'CUSTOM_MEAL_QUOTE',
    payerPhone: '+255 784 333 444',
  });

  assert(batchPayment.paidAmountTzs === 320000, 'Authoritative batch amount locked at 320,000 TZS');

  const batchWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: batchPayment.merchantReference,
    gatewayReference: batchPayment.providerReference,
    amountTzs: 320000,
    payerPhone: '+255 784 333 444',
    status: 'SUCCESS',
  });

  const batchRes = await PaymentGatewayService.processWebhook(batchWebhook.body, batchWebhook.signature);
  assert(batchRes.success === true, 'Batch webhook verified');

  const lockedBatch = MloHubDB.customOrders.getById(batchMeal.id);
  assert(lockedBatch?.status === 'Confirmed', 'Batch order locked in Confirmed status');
  assert(Boolean(lockedBatch?.statusMessageEn?.includes('Kitchen prep locked!')), 'Kitchen prep locked message set');

  // ----------------------------------------------------------------------------
  // Test Group 4: Table Reservation Deposit & Full Payment
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 4: Table Reservation 50% Deposit & 100% Full Payment');

  const reservation50 = await MloHubDB.reservations.create({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    guestsCount: '4',
    reservationDate: '2026-09-20',
    timeSlot: '19:30',
    address: 'Kijitonyama, Dar es Salaam',
    totalBillTzs: 80000,
    status: 'pending',
  });

  const depositRes = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    reservationId: reservation50.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 80000,
    provider: 'sandbox',
    methodCode: 'MIXX_BY_YAS',
    paymentType: 'RESERVATION_DEPOSIT_50',
    payerPhone: '+255 713 555 666',
  });

  assert(depositRes.paidAmountTzs === 40000, '50% deposit rule accurately computed (40,000 TZS)');
  assert(depositRes.remainingBalanceTzs === 40000, 'Remaining balance is 40,000 TZS');

  const depositWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: depositRes.merchantReference,
    gatewayReference: depositRes.providerReference,
    amountTzs: 40000,
    payerPhone: '+255 713 555 666',
    status: 'SUCCESS',
  });

  const depositProcess = await PaymentGatewayService.processWebhook(depositWebhook.body, depositWebhook.signature);
  assert(depositProcess.success === true, 'Reservation deposit webhook processed');

  const confirmedRes = MloHubDB.reservations.getAll().find((r) => r.id === reservation50.id);
  assert(confirmedRes?.isDepositPaid === true, 'Reservation isDepositPaid marked true');
  assert(confirmedRes?.status === 'confirmed', 'Reservation status transitioned to confirmed');
  assert(confirmedRes?.depositAmountTzs === 40000, 'Deposit amount accurately logged on reservation');

  // ----------------------------------------------------------------------------
  // Test Group 5: Cryptographic Webhook HMAC-SHA256 Signature Verification
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 5: Cryptographic Webhook HMAC-SHA256 Verification & Forgery Defense');

  const forgedPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 15000,
    provider: 'sandbox',
    methodCode: 'HALOPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 622 777 888',
  });

  const forgedPayload = JSON.stringify({
    eventId: `forged_${Date.now()}`,
    orderReference: forgedPayment.merchantReference,
    paymentId: forgedPayment.providerReference,
    amount: 15000,
    currency: 'TZS',
    status: 'SUCCESS',
    phoneNumber: '+255 622 777 888',
  });

  // Test with completely forged signature
  const forgedResult = await PaymentGatewayService.processWebhook(forgedPayload, 'forged_fake_signature_abc123');
  assert(forgedResult.success === false, 'Forged webhook signature strictly rejected');
  assert(forgedResult.message.includes('signature'), 'Error message specifies signature verification failure');

  // Test with legacy bypass signature (e.g. startsWith 'mlohub_cp_')
  const bypassResult = await PaymentGatewayService.processWebhook(forgedPayload, 'mlohub_cp_sec_legacy_bypass');
  assert(bypassResult.success === false, 'Legacy mlohub_cp_ prefix bypass strictly blocked');

  // Verify that SIGNATURE_FAILED event was logged in the ledger
  const signatureFailEvents = MloHubDB.paymentEvents.getAll().filter((e) => e.eventType === 'SIGNATURE_FAILED');
  assert(signatureFailEvents.length > 0, 'SIGNATURE_FAILED logged to audit ledger');

  // ----------------------------------------------------------------------------
  // Test Group 6: Replay Attack Defense & Idempotency
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 6: Replay Attack Defense & Idempotency');

  const idempotencyPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 20000,
    idempotencyKey: 'idemp-key-test-uuid-001',
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 000 111',
  });

  // Duplicate payment initiation with same idempotency key
  const duplicateInit = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 20000,
    idempotencyKey: 'idemp-key-test-uuid-001',
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 000 111',
  });

  assert(duplicateInit.paymentId === idempotencyPayment.paymentId, 'Duplicate initiation returns existing transaction (idempotent)');
  assert(duplicateInit.merchantReference === idempotencyPayment.merchantReference, 'Merchant reference preserved across idempotent calls');

  // Process webhook for this payment
  const idempWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: idempotencyPayment.merchantReference,
    gatewayReference: idempotencyPayment.providerReference,
    amountTzs: 20000,
    payerPhone: '+255 754 000 111',
    status: 'SUCCESS',
  });

  const firstWebhookCall = await PaymentGatewayService.processWebhook(idempWebhook.body, idempWebhook.signature);
  assert(firstWebhookCall.success === true, 'First webhook delivery succeeds');

  // Deliver the identical webhook second time (Replay attack simulation)
  const replayWebhookCall = await PaymentGatewayService.processWebhook(idempWebhook.body, idempWebhook.signature);
  assert(replayWebhookCall.success === true, 'Replay webhook handled idempotently');
  assert(replayWebhookCall.message.includes('idempotent'), 'Replay returns idempotent response without duplicating ledger entries');

  // ----------------------------------------------------------------------------
  // Test Group 7: Amount Mismatch & Underpayment Fraud Defense
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 7: Amount Mismatch & Underpayment Fraud Defense');

  const fraudOrder = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: 'Zanzibar King Feast',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Royal feast',
    budgetTzs: 70000,
    finalPrice: 70000,
    servingsCount: '4',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Pending payment',
    statusMessageSw: 'Inasubiri malipo',
  });

  const fraudPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: fraudOrder.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 70000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 222 333',
  });

  // Webhook reports customer paid only 1,000 TZS instead of 70,000 TZS
  const underpaidWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: fraudPayment.merchantReference,
    gatewayReference: fraudPayment.providerReference,
    amountTzs: 1000,
    payerPhone: '+255 754 222 333',
    status: 'SUCCESS',
  });

  const fraudRes = await PaymentGatewayService.processWebhook(underpaidWebhook.body, underpaidWebhook.signature);
  assert(fraudRes.success === false, 'Underpayment strictly rejected');
  assert(fraudRes.message.includes('does not match'), 'Error message alerts amount mismatch');

  const flaggedPayment = MloHubDB.payments.getById(fraudPayment.paymentId);
  assert(flaggedPayment?.status === 'FAILED', 'Fraudulent transaction marked FAILED in database');
  assert(Boolean(flaggedPayment?.failureReason?.includes('Amount mismatch')), 'Failure reason documents underpayment discrepancy');

  const fraudOrderCheck = MloHubDB.customOrders.getById(fraudOrder.id);
  assert(fraudOrderCheck?.status !== 'Confirmed', 'Order remains unconfirmed when underpayment detected');

  // ----------------------------------------------------------------------------
  // Test Group 8: Telecom Carrier Prefix Detection & Routing
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 8: Telecom Carrier Prefix Detection & Routing');

  const voda = normalizeTanzanianPhone('0754123456');
  assert(voda.carrier === 'Vodacom M-Pesa', 'Prefix 0754 detected as Vodacom M-Pesa');

  const airtel = normalizeTanzanianPhone('0784987654');
  assert(airtel.carrier === 'Airtel Money', 'Prefix 0784 detected as Airtel Money');

  const tigo = normalizeTanzanianPhone('0713112233');
  assert(tigo.carrier === 'Mixx by Yas (Tigo)', 'Prefix 0713 detected as Mixx by Yas (Tigo)');

  const halo = normalizeTanzanianPhone('0622334455');
  assert(halo.carrier === 'HaloPesa (Halotel)', 'Prefix 0622 detected as HaloPesa (Halotel)');

  const mpesaCarrier = PaymentGatewayService.getCarrierInfo('MPESA');
  assert(mpesaCarrier.ussd === '*150*00#', 'M-Pesa USSD shortcode is *150*00#');

  const airtelCarrier = PaymentGatewayService.getCarrierInfo('AIRTEL_MONEY');
  assert(airtelCarrier.ussd === '*150*60#', 'Airtel Money USSD shortcode is *150*60#');

  // ----------------------------------------------------------------------------
  // Test Group 9: Multi-Gateway Provider Abstraction
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 9: Multi-Gateway Provider Abstraction (ClickPesa, Selcom, Sandbox)');

  const sandboxGw = PaymentGatewayFactory.getGateway('sandbox');
  assert(sandboxGw.provider === 'sandbox', 'PaymentGatewayFactory resolves Sandbox gateway');

  const clickpesaGw = PaymentGatewayFactory.getGateway('clickpesa');
  assert(clickpesaGw.provider === 'clickpesa', 'PaymentGatewayFactory resolves ClickPesa gateway');

  const selcomGw = PaymentGatewayFactory.getGateway('selcom');
  assert(selcomGw.provider === 'selcom', 'PaymentGatewayFactory resolves Selcom gateway');

  // Test deterministic sandbox rule: phone ending with '00' returns instant failure
  const failPhonePayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 10000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 000 000', // ends in 00
  });

  assert(failPhonePayment.success === false, 'Sandbox deterministic rule: 00 suffix triggers expected failure');
  assert(failPhonePayment.status === 'FAILED', 'Status accurately marked FAILED');

  // ----------------------------------------------------------------------------
  // Test Group 10: Admin-Authorized Mobile Money Refund Lifecycle
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 10: Admin-Authorized Refund Lifecycle & Ledger Auditing');

  // Create a settled payment
  const refundOrder = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: 'Cancel Test Feast',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'To be cancelled',
    budgetTzs: 35000,
    finalPrice: 35000,
    servingsCount: '2',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Cooking',
    statusMessageSw: 'Inapikwa',
  });

  const payToRefund = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: refundOrder.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 35000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 777 666',
  });

  const refundWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: payToRefund.merchantReference,
    gatewayReference: payToRefund.providerReference,
    amountTzs: 35000,
    payerPhone: '+255 754 777 666',
    status: 'SUCCESS',
  });
  await PaymentGatewayService.processWebhook(refundWebhook.body, refundWebhook.signature);

  // Execute admin refund
  const refundResult = await PaymentGatewayService.refundPayment(
    payToRefund.paymentId,
    'Kitchen out of primary ingredients for feast',
    'usr-admin'
  );

  assert(refundResult.success === true, 'PaymentGatewayService.refundPayment executes successfully');
  assert(refundResult.payment?.status === 'REFUNDED', 'Payment status updated to REFUNDED');

  const refundedOrder = MloHubDB.customOrders.getById(refundOrder.id);
  assert(refundedOrder?.status === 'Cancelled', 'Linked order cancelled upon refund');
  assert(refundedOrder?.paymentStatus === 'REFUNDED', 'Order paymentStatus marked REFUNDED');

  const refundRecords = MloHubDB.refunds.getByPaymentId(payToRefund.paymentId);
  assert(refundRecords.length > 0, 'Refund record created in refunds database table');
  assert(refundRecords[0].authorizedBy === 'usr-admin', 'Refund record identifies authorized admin user');

  const refundEvents = MloHubDB.paymentEvents.getByPaymentId(payToRefund.paymentId);
  assert(refundEvents.some((e) => e.eventType === 'REFUND_DISPATCHED'), 'REFUND_DISPATCHED appended to payment events ledger');

  // ----------------------------------------------------------------------------
  // Test Group 11: Automated Reconciliation of Stranded Transactions
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 11: Automated Reconciliation Service');

  // Create stranded payment older than threshold
  const strandedPayment = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 18000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 111 999',
  });

  // Manually age the payment by 20 minutes
  const agedTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await MloHubDB.payments.update(strandedPayment.paymentId, {
    createdAt: agedTime,
  });

  // Simulate gateway confirming payment in background
  const gatewayRecord = SandboxPaymentGateway['store'].get(strandedPayment.providerReference);
  if (gatewayRecord) {
    gatewayRecord.status = 'PAID';
  }

  // Run reconciliation
  const reconResult = await PaymentReconciliationService.reconcileStaleTransactions(15);
  assert(reconResult.totalPendingScanned >= 1, 'Reconciliation identifies aged pending payment');
  assert(reconResult.reconciledToPaid >= 1, 'Reconciliation recovers stranded payment to PAID');

  const reconciledCheck = MloHubDB.payments.getById(strandedPayment.paymentId);
  assert(reconciledCheck?.status === 'PAID', 'Stranded payment verified and confirmed in database');

  console.log('\n======================================================');
  console.log(`🏁 PAYMENT ARCHITECTURE TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}
