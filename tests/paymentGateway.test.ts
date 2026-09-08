import { PaymentGatewayService } from '../services/PaymentGatewayService';
import { MloHubDB } from '../db';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { AuthService } from '../db/auth/service';

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

export async function runPaymentGatewayTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB CLICKPESA TANZANIA ONLINE PAYMENT & CHECKOUT TESTS');
  console.log('================================================================\n');

  await MloHubDB.init();
  RealtimeEventEngine.clearAll();

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Tanzania Mobile Money & Card Carrier Info
  // -------------------------------------------------------------------------
  console.log('Test Group 1: Carrier & USSD Code Resolver');
  
  const mpesa = PaymentGatewayService.getCarrierInfo('MPESA');
  assert(mpesa.name === 'Vodacom M-Pesa' && mpesa.ussd === '*150*00#', 'M-Pesa resolves Vodacom and *150*00#');

  const airtel = PaymentGatewayService.getCarrierInfo('AIRTEL_MONEY');
  assert(airtel.name === 'Airtel Money' && airtel.ussd === '*150*60#', 'Airtel Money resolves *150*60#');

  const mixx = PaymentGatewayService.getCarrierInfo('MIXX_BY_YAS');
  assert(mixx.name === 'Mixx by Yas (Tigo Pesa)' && mixx.ussd === '*150*01#', 'Mixx by Yas resolves Tigo Pesa and *150*01#');

  const halo = PaymentGatewayService.getCarrierInfo('HALOPESA');
  assert(halo.name === 'HaloPesa (Halotel)' && halo.ussd === '*150*88#', 'HaloPesa resolves Halotel and *150*88#');

  const card = PaymentGatewayService.getCarrierInfo('CARD');
  assert(card.name === 'Visa / Mastercard', 'Card resolves Visa / Mastercard');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Table Reservation 50% Deposit Rule & Calculation
  // -------------------------------------------------------------------------
  console.log('\nTest Group 2: Table Reservation 50% Deposit vs 100% Full Bill');

  const reservation = await MloHubDB.reservations.create({
    userId: 'usr-frank',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    address: 'Mikocheni B, Dar es Salaam',
    reservationDate: '2026-09-08',
    timeSlot: '8:00 PM',
    guestsCount: '4',
    status: 'pending',
    specialNotes: 'VIP table for client dinner',
  });

  // 4 guests @ TZS 20,000 = TZS 80,000
  const estimatedBill = 80000;

  // Test 50% Deposit Initiation
  const deposit50Res = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    reservationId: reservation.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: estimatedBill,
    methodCode: 'MPESA',
    paymentType: 'RESERVATION_DEPOSIT_50',
    payerPhone: '+255 754 123 456',
    deliveryFee: 0,
    serviceFee: 0,
  });

  assert(deposit50Res.paidAmountTzs === 40000, '50% deposit option calculates exactly TZS 40,000');
  assert(deposit50Res.remainingBalanceTzs === 40000, 'Remaining balance is recorded as TZS 40,000 for restaurant settlement');
  assert(deposit50Res.status === 'AWAITING_PAYMENT', 'Deposit payment created in AWAITING_PAYMENT status');

  // Verify reservation in DB was linked
  const updatedRes = MloHubDB.reservations.getAll().find((r) => r.id === reservation.id);
  assert(updatedRes?.depositAmountTzs === 40000, 'Reservation entity updated with 50% deposit amount');
  assert(updatedRes?.depositOption === 'deposit_50', 'Reservation entity flagged with deposit_50 option');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Custom Meal Order Payment Initiation (ClickPesa USSD Push)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 3: Custom Meal Payment Initiation');

  const customOrder = await MloHubDB.customOrders.create({
    userId: 'usr-frank',
    dishName: '10x Zanzibar Spiced Beef Pilau Feast',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Extra tamarind kachumbari, less oil',
    budgetTzs: 120000,
    servingsCount: '10',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Awaiting customer payment confirmation',
    statusMessageSw: 'Inasubiri malipo ya mteja',
  });

  const orderPaymentRes = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: customOrder.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 120000,
    deliveryFee: 0,
    serviceFee: 1500,
    discount: 0,
    methodCode: 'MIXX_BY_YAS',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 713 000 111',
  });

  assert(orderPaymentRes.paidAmountTzs === 121500, 'Total bill includes TZS 120,000 + TZS 1,500 service fee = TZS 121,500');
  assert(orderPaymentRes.providerReference.startsWith('CP-TZ-'), 'Unique ClickPesa provider reference generated');
  assert(orderPaymentRes.simulatedUssdPrompt?.ussdString === '*150*01#', 'USSD prompt pre-configured for Mixx by Yas (*150*01#)');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Cryptographic Webhook Processing & Security Verification
  // -------------------------------------------------------------------------
  console.log('\nTest Group 4: Cryptographic Webhook Security & Idempotency');

  // Test 4a: Invalid HMAC Signature
  const badSigResult = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt_bad_sig',
      eventType: 'payment.success',
      providerReference: orderPaymentRes.providerReference,
      amount: 121500,
      currency: 'TZS',
      method: 'MIXX_BY_YAS',
      payerPhone: '+255 713 000 111',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'invalid_secret_signature'
  );
  assert(!badSigResult.success, 'Invalid cryptographic signature rejected');

  // Test 4b: Invalid Currency (e.g. USD)
  const badCurrencyResult = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt_bad_curr',
      eventType: 'payment.success',
      providerReference: orderPaymentRes.providerReference,
      amount: 121500,
      currency: 'USD',
      method: 'MIXX_BY_YAS',
      payerPhone: '+255 713 000 111',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'mlohub_cp_sec_993847291048_prod'
  );
  assert(!badCurrencyResult.success, 'Non-TZS currency rejected');

  // Test 4c: Amount Mismatch (e.g. paid 50,000 instead of 121,500)
  const mismatchResult = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt_mismatch',
      eventType: 'payment.success',
      providerReference: orderPaymentRes.providerReference,
      amount: 50000,
      currency: 'TZS',
      method: 'MIXX_BY_YAS',
      payerPhone: '+255 713 000 111',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'mlohub_cp_sec_993847291048_prod'
  );
  assert(!mismatchResult.success, 'Payment amount mismatch correctly rejected');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Verified Webhook ➔ Order Marked PAID & Kitchen Confirmed
  // -------------------------------------------------------------------------
  console.log('\nTest Group 5: Verified Payment ➔ Automatic Kitchen Confirmation');

  let kitchenReceivedAlert: RealtimeEventPayload | null = null;
  const unsubKitchen = RealtimeEventEngine.subscribe('orders:restaurant:mama-amina-biryani', (evt) => {
    if (evt.eventType === 'ORDER_CONFIRMED') {
      kitchenReceivedAlert = evt;
    }
  });

  const validWebhookResult = await PaymentGatewayService.processWebhook(
    {
      eventId: `cp_evt_${Date.now()}`,
      eventType: 'payment.success',
      providerReference: orderPaymentRes.providerReference,
      paymentId: orderPaymentRes.paymentId,
      orderId: customOrder.id,
      amount: 121500,
      currency: 'TZS',
      method: 'MIXX_BY_YAS',
      payerPhone: '+255 713 000 111',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'mlohub_cp_sec_993847291048_prod'
  );

  assert(validWebhookResult.success, 'Valid ClickPesa webhook successfully verified');
  assert(validWebhookResult.payment?.status === 'PAID', 'Payment status updated to PAID in DB');

  // Verify Custom Order in DB
  const paidOrder = MloHubDB.customOrders.getById(customOrder.id);
  assert(paidOrder?.status === 'Confirmed', 'Order automatically transitioned to Confirmed in DB');
  assert(paidOrder?.paymentStatus === 'PAID', 'Order paymentStatus flagged as PAID');

  // Verify Real-time Kitchen Alert
  assert(kitchenReceivedAlert !== null, 'Restaurant kitchen received real-time ORDER_CONFIRMED broadcast upon payment');

  // Verify Kitchen In-App Notification in DB
  const kitchenNotif = MloHubDB.notifications.getAll().find(
    (n) => n.userId === 'usr-chef-amina' && n.data?.orderId === customOrder.id && n.titleEn?.includes('Payment Verified')
  );
  assert(kitchenNotif !== undefined, 'In-app notification created for kitchen manager with payment confirmation');

  // Test 5b: Idempotency (Duplicate Webhook Prevention)
  const duplicateWebhookResult = await PaymentGatewayService.processWebhook(
    {
      eventId: `cp_evt_${Date.now()}`,
      eventType: 'payment.success',
      providerReference: orderPaymentRes.providerReference,
      paymentId: orderPaymentRes.paymentId,
      orderId: customOrder.id,
      amount: 121500,
      currency: 'TZS',
      method: 'MIXX_BY_YAS',
      payerPhone: '+255 713 000 111',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'mlohub_cp_sec_993847291048_prod'
  );
  assert(duplicateWebhookResult.success && duplicateWebhookResult.message.includes('idempotent'), 'Duplicate webhook processed idempotently without re-triggering');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Reservation Webhook & Deposit Confirmation
  // -------------------------------------------------------------------------
  console.log('\nTest Group 6: Table Reservation Deposit Webhook');

  const resWebhookResult = await PaymentGatewayService.processWebhook(
    {
      eventId: `cp_res_evt_${Date.now()}`,
      eventType: 'payment.success',
      providerReference: deposit50Res.providerReference,
      paymentId: deposit50Res.paymentId,
      reservationId: reservation.id,
      amount: 40000,
      currency: 'TZS',
      method: 'MPESA',
      payerPhone: '+255 754 123 456',
      channel: 'USSD_PUSH',
      timestamp: new Date().toISOString(),
    },
    'mlohub_cp_sec_993847291048_prod'
  );

  assert(resWebhookResult.success, 'Reservation deposit webhook processed successfully');

  const finalRes = MloHubDB.reservations.getAll().find((r) => r.id === reservation.id);
  assert(finalRes?.status === 'confirmed', 'Reservation status updated to confirmed in DB');
  assert(finalRes?.isDepositPaid === true, 'Reservation isDepositPaid set to true');
  assert(finalRes?.depositAmountTzs === 40000, 'Deposit amount of TZS 40,000 persisted');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Automated Refund Flow
  // -------------------------------------------------------------------------
  console.log('\nTest Group 7: Automated Payment Refund Pipeline');

  const refundResult = await PaymentGatewayService.refundPayment(
    orderPaymentRes.paymentId,
    'Kitchen ran out of fresh passion juice'
  );

  assert(refundResult.success, 'Payment refund processed successfully');
  assert(refundResult.payment?.status === 'REFUNDED', 'Payment transaction marked as REFUNDED in DB');

  const refundedOrder = MloHubDB.customOrders.getById(customOrder.id);
  assert(refundedOrder?.status === 'Cancelled', 'Order status updated to Cancelled upon refund');
  assert(refundedOrder?.paymentStatus === 'REFUNDED', 'Order paymentStatus updated to REFUNDED');

  // Customer refund notification
  const refundNotif = MloHubDB.notifications.getAll().find(
    (n) => n.userId === 'usr-frank' && n.titleEn?.includes('Refund Processed')
  );
  assert(refundNotif !== undefined, 'Customer in-app notification created for refund');

  unsubKitchen();

  console.log('\n================================================================');
  console.log(`🏁 PAYMENT GATEWAY TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runPaymentGatewayTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
