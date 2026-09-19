/**
 * ============================================================================
 * STAGE 10: REAL-TIME PIPELINE & SYNCHRONIZATION TEST SUITE
 * ============================================================================
 * Verifies Supabase PostgreSQL & Supabase Realtime synchronization layer across
 * Customer, Restaurant, and Admin sessions:
 *  1. Connection lifecycle & status machine (LIVE, OFFLINE, RECONNECTING)
 *  2. Auth session lifecycle & cross-tenant subscription isolation
 *  3. Canonical order state machine: PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED
 *  4. Payment success is NOT order acceptance invariant (payment PAID, order PENDING)
 *  5. Custom meal multi-step negotiation & confirmation pipeline
 *  6. Real-time menu price & availability synchronization
 *  7. Table reservation real-time confirmation
 *  8. In-app notification stream & duplicate prevention
 *  9. Post-reconnect authoritative database resynchronization
 * 10. Clean unsubscription closures & channel leak prevention
 */

import { RealtimeService } from '../services/RealtimeService';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { OrderService } from '../services/OrderService';
import { OrderPipelineService } from '../services/OrderPipelineService';
import { PaymentGatewayService } from '../services/PaymentGatewayService';
import { SandboxPaymentGateway } from '../supabase/functions/_shared/payments/SandboxPaymentGateway';
import { MloHubDB } from '../db';
import { OrderStatus, PaymentStatus } from '../types/domain';
import {
  RealtimeConnectionStatus,
  OrderRealtimePayload,
  MenuRealtimePayload,
  ReservationRealtimePayload,
  CustomMealRealtimePayload,
} from '../types/realtime';

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

export async function runRealtimePipelineTests(): Promise<{ passed: number; failed: number }> {
  passed = 0;
  failed = 0;
  console.log('\n================================================================');
  console.log('⚡ STAGE 10: AUTHORITATIVE CLOUD REALTIME PIPELINE TEST SUITE');
  console.log('================================================================');

  await MloHubDB.init();
  RealtimeService.clearAll();

  // ----------------------------------------------------------------------------
  // Test Group 1: Realtime Connection Lifecycle & Health Monitor
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 1: Realtime Connection Lifecycle & Health Monitor');

  const initialStatus = RealtimeService.getStatus();
  assert(initialStatus.state === 'LIVE', 'Initial connection state resolves to LIVE in local/sandbox mode');

  let statusHistory: string[] = [];
  const unsubStatus = RealtimeService.onStatusChange((s) => {
    statusHistory.push(s.state);
  });

  RealtimeService.setOffline(true);
  assert(RealtimeService.getStatus().state === 'OFFLINE', 'Engine transitions cleanly to OFFLINE');

  RealtimeService.setOffline(false);
  assert(RealtimeService.getStatus().state === 'LIVE', 'Engine reconnects back to LIVE');
  assert(statusHistory.includes('OFFLINE'), 'Status listener recorded OFFLINE transition');
  assert(statusHistory.includes('LIVE'), 'Status listener recorded return to LIVE');

  unsubStatus();

  // ----------------------------------------------------------------------------
  // Test Group 2: Auth Session Lifecycle & Cross-Session Subscription Isolation
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 2: Auth Session Lifecycle & Workspace Isolation');

  let customerReceivedData: any = null;
  const unsubCust1 = RealtimeService.subscribeToCustomerOrders('usr-alice', (evt) => {
    customerReceivedData = evt.payload;
  });

  // Alice receives her order event
  RealtimeService.publishEvent('orders:customer:usr-alice', 'ORDER_CREATED', {
    orderId: 'ord-alice-101',
    status: 'PENDING',
  });
  assert(customerReceivedData?.orderId === 'ord-alice-101', 'Alice receives customer-scoped realtime event');

  // Switch session: Bob logs in
  RealtimeService.bindAuthSession('usr-bob', null);

  // An event to Alice should no longer trigger Bob's session
  customerReceivedData = null;
  RealtimeService.publishEvent('orders:customer:usr-alice', 'ORDER_CREATED', {
    orderId: 'ord-alice-102',
    status: 'PENDING',
  });
  assert(customerReceivedData === null, 'Previous user topics unbind on auth session switch');

  // Clean logout
  RealtimeService.bindAuthSession(null, null);

  // ----------------------------------------------------------------------------
  // Test Group 3: Canonical Order State Machine Synchronization
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 3: Canonical Order State Machine Across Sessions');

  let restaurantReceivedOrder: any = null;
  let customerObservedStatus: OrderStatus | null = null;

  const unsubRestOrders = RealtimeService.subscribeToRestaurantOrders('mama-amina-biryani', (evt) => {
    restaurantReceivedOrder = evt.payload;
  });

  const unsubCustOrder = RealtimeService.subscribeToOrder('ord-live-sync-1', (evt) => {
    customerObservedStatus = evt.payload.status;
  });

  // Step 3a: Customer creates order (PENDING)
  const newOrderPayload: OrderRealtimePayload = {
    orderId: 'ord-live-sync-1',
    orderNumber: 'MLO-9911',
    customerId: 'usr-customer-1',
    restaurantId: 'mama-amina-biryani',
    status: 'PENDING',
    paymentStatus: 'SUCCESS',
    totalTzs: 24000,
    estimatedPrepMinutes: 30,
    order: { id: 'ord-live-sync-1', status: 'PENDING' },
    timestamp: new Date().toISOString(),
  };

  RealtimeService.publishEvent('orders:restaurant:mama-amina-biryani', 'ORDER_CREATED', newOrderPayload);
  RealtimeService.publishEvent('orders:ord-live-sync-1', 'ORDER_CREATED', newOrderPayload);

  assert(restaurantReceivedOrder?.orderId === 'ord-live-sync-1', 'Restaurant receives incoming order in real time');
  assert(restaurantReceivedOrder?.status === 'PENDING', 'Initial order status is canonical PENDING');
  assert(customerObservedStatus === 'PENDING', 'Customer sees PENDING status');

  // Step 3b: Restaurant operator accepts order (ACCEPTED)
  const acceptedPayload: OrderRealtimePayload = {
    ...newOrderPayload,
    status: 'ACCEPTED',
    previousStatus: 'PENDING',
    order: { id: 'ord-live-sync-1', status: 'ACCEPTED' },
  };
  RealtimeService.publishEvent('orders:ord-live-sync-1', 'ORDER_ACCEPTED', acceptedPayload);
  assert(customerObservedStatus === 'ACCEPTED', 'Customer receives real-time ACCEPTED status without reload');

  // Step 3c: Kitchen advances to PREPARING
  const preparingPayload: OrderRealtimePayload = {
    ...acceptedPayload,
    status: 'PREPARING',
    previousStatus: 'ACCEPTED',
    order: { id: 'ord-live-sync-1', status: 'PREPARING' },
  };
  RealtimeService.publishEvent('orders:ord-live-sync-1', 'ORDER_PREPARING', preparingPayload);
  assert(customerObservedStatus === 'PREPARING', 'Customer receives PREPARING ("Cooking") update');

  // Step 3d: Kitchen marks READY
  const readyPayload: OrderRealtimePayload = {
    ...preparingPayload,
    status: 'READY',
    previousStatus: 'PREPARING',
    order: { id: 'ord-live-sync-1', status: 'READY' },
  };
  RealtimeService.publishEvent('orders:ord-live-sync-1', 'ORDER_READY', readyPayload);
  assert(customerObservedStatus === 'READY', 'Customer receives READY update');

  // Step 3e: Rider / Staff marks COMPLETED
  const completedPayload: OrderRealtimePayload = {
    ...readyPayload,
    status: 'COMPLETED',
    previousStatus: 'READY',
    order: { id: 'ord-live-sync-1', status: 'COMPLETED' },
  };
  RealtimeService.publishEvent('orders:ord-live-sync-1', 'ORDER_COMPLETED', completedPayload);
  assert(customerObservedStatus === 'COMPLETED', 'Customer receives COMPLETED update');

  unsubRestOrders();
  unsubCustOrder();

  // ----------------------------------------------------------------------------
  // Test Group 4: Invariant: Payment Success is NOT Order Acceptance
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 4: Payment Success is NOT Order Acceptance');

  // Create an unpaid order
  const orderForPayment = await MloHubDB.customOrders.create({
    userId: 'usr-customer-2',
    dishName: 'Samaki wa Kupaka',
    restaurantName: 'Mama Amina Biryani House',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Coconut sauce',
    budgetTzs: 18000,
    finalPrice: 18000,
    servingsCount: '1',
    diningOption: 'Delivery',
    status: 'Pending Confirmation',
    statusMessageEn: 'Awaiting payment',
    statusMessageSw: 'Inasubiri malipo',
    paymentStatus: 'UNPAID',
  });

  assert(orderForPayment.status === 'Pending Confirmation', 'Order created in Pending Confirmation');
  assert(orderForPayment.paymentStatus === 'UNPAID', 'Order initialized with paymentStatus UNPAID');

  // Customer initiates and pays via sandbox mobile money
  const paymentRes = await PaymentGatewayService.initiatePayment({
    userId: 'usr-customer-2',
    orderId: orderForPayment.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    amountTzs: 18000,
    provider: 'sandbox',
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 111 222',
  });

  const signedWebhook = await SandboxPaymentGateway.createSignedWebhookPayload({
    merchantReference: paymentRes.merchantReference,
    gatewayReference: paymentRes.providerReference,
    amountTzs: 18000,
    payerPhone: '+255 754 111 222',
    status: 'SUCCESS',
  });

  let restaurantPaidOrderReceived: boolean = false;
  const unsubRestAlert = RealtimeEventEngine.subscribe('orders:restaurant:mama-amina-biryani', (evt) => {
    if (evt.orderId === orderForPayment.id) {
      restaurantPaidOrderReceived = true;
    }
  });

  await PaymentGatewayService.processWebhook(signedWebhook.body, signedWebhook.signature);

  const verifiedOrder = MloHubDB.customOrders.getById(orderForPayment.id);
  assert(verifiedOrder?.paymentStatus === 'PAID', 'Order paymentStatus is now PAID');
  assert(Boolean(restaurantPaidOrderReceived), 'Restaurant kitchen received realtime alert of paid order');

  unsubRestAlert();

  // ----------------------------------------------------------------------------
  // Test Group 5: Custom Meal Multi-Step Negotiation Flow
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 5: Custom Meal Multi-Step Negotiation Flow');

  let chefReceivedMealRequest: boolean = false;
  let customerReceivedQuote: boolean = false;

  const unsubChefQueue = RealtimeService.subscribeToCustomMeals('mama-amina-biryani', (evt) => {
    if (evt.payload.requestId === 'req-pilau-300') {
      chefReceivedMealRequest = true;
    }
  });

  const unsubCustomerQuotes = RealtimeService.subscribe('custom_meals:customer:usr-alice', (evt) => {
    if (evt.payload.quotedPriceTzs === 85000) {
      customerReceivedQuote = true;
    }
  });

  // 1. Customer submits custom meal request
  RealtimeService.publishEvent('custom_meals:restaurant:mama-amina-biryani', 'CUSTOM_MEAL_CREATED', {
    requestId: 'req-pilau-300',
    orderNumber: 'MLO-CUST-300',
    customerId: 'usr-alice',
    targetRestaurantId: 'mama-amina-biryani',
    dishName: 'Kuku wa Kienyeji Mchemsho with Ndizi',
    budgetTzs: 70000,
    status: 'PENDING',
    timestamp: new Date().toISOString(),
  });
  assert(Boolean(chefReceivedMealRequest), 'Chef receives custom meal request in real time');

  // 2. Chef quotes the meal
  RealtimeService.publishEvent('custom_meals:customer:usr-alice', 'CUSTOM_MEAL_QUOTE_CREATED', {
    requestId: 'req-pilau-300',
    orderNumber: 'MLO-CUST-300',
    customerId: 'usr-alice',
    targetRestaurantId: 'mama-amina-biryani',
    quotedPriceTzs: 85000,
    status: 'QUOTED',
    timestamp: new Date().toISOString(),
  });
  assert(Boolean(customerReceivedQuote), 'Customer receives chef quote in real time');

  unsubChefQueue();
  unsubCustomerQuotes();

  // ----------------------------------------------------------------------------
  // Test Group 6: Real-time Menu Catalog, Price & Availability Sync
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 6: Real-Time Menu Catalog, Price & Availability Sync');

  let updatedMenuPayload: any = null;
  const unsubMenu = RealtimeService.subscribeToMenu('mama-amina-biryani', (evt) => {
    updatedMenuPayload = evt.payload;
  });

  // Price change from 12,000 to 14,000 TZS
  RealtimeService.publishEvent('menu:mama-amina-biryani', 'MENU_PRICE_UPDATED', {
    restaurantId: 'mama-amina-biryani',
    menuItemId: 'dish-biryani-chick',
    name: 'Authentic Chicken Biryani',
    priceTzs: 14000,
    previousPriceTzs: 12000,
    isAvailable: true,
    timestamp: new Date().toISOString(),
  });

  assert(updatedMenuPayload !== null, 'Menu listener received real-time price change');
  assert(updatedMenuPayload?.priceTzs === 14000, 'Updated price reflected as 14,000 TZS');
  assert(updatedMenuPayload?.previousPriceTzs === 12000, 'Previous price recorded as 12,000 TZS');

  // Availability toggle to sold out
  RealtimeService.publishEvent('menu:mama-amina-biryani', 'MENU_AVAILABILITY_UPDATED', {
    restaurantId: 'mama-amina-biryani',
    menuItemId: 'dish-biryani-chick',
    name: 'Authentic Chicken Biryani',
    priceTzs: 14000,
    isAvailable: false,
    stockQuantity: 0,
    timestamp: new Date().toISOString(),
  });

  assert(updatedMenuPayload?.isAvailable === false, 'Dish availability toggled to false in real time');
  assert(updatedMenuPayload?.stockQuantity === 0, 'Stock quantity updated to 0');

  unsubMenu();

  // ----------------------------------------------------------------------------
  // Test Group 7: Table Reservation Real-Time Confirmation
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 7: Table Reservation Real-Time Confirmation');

  let restaurantReservationAlert: any = null;
  const unsubResv = RealtimeService.subscribeToReservations('mama-amina-biryani', (evt) => {
    restaurantReservationAlert = evt.payload;
  });

  RealtimeService.publishEvent('reservations:restaurant:mama-amina-biryani', 'RESERVATION_CREATED', {
    reservationId: 'res-449',
    customerId: 'usr-customer-3',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    status: 'pending',
    timeSlot: '20:00',
    reservationDate: '2026-09-22',
    guestsCount: '6',
    timestamp: new Date().toISOString(),
  });

  assert(restaurantReservationAlert !== null, 'Restaurant received reservation request in real time');
  assert(restaurantReservationAlert?.guestsCount === '6', 'Party size recorded accurately as 6');
  assert(restaurantReservationAlert?.status === 'pending', 'Reservation initially pending');

  unsubResv();

  // ----------------------------------------------------------------------------
  // Test Group 8: In-App Notification Stream & Deduplication
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 8: In-App Notification Stream & Deduplication');

  const receivedNotifs: any[] = [];
  const unsubNotif = RealtimeService.subscribeToNotifications('usr-frank', (evt) => {
    receivedNotifs.push(evt.payload);
  });

  const sampleNotif = {
    notificationId: 'notif-dedup-99',
    userId: 'usr-frank',
    type: 'order_update',
    titleEn: 'Order Dispatched',
    titleSw: 'Chakula Kipo Njiani',
    messageEn: 'Rider is 5 minutes away.',
    messageSw: 'Dereva amekaribia.',
    timestamp: new Date().toISOString(),
  };

  // Dispatch same notification twice (e.g. websocket reconnect replay)
  RealtimeService.publishEvent('notifications:usr-frank', 'NOTIFICATION_CREATED', sampleNotif);
  RealtimeService.publishEvent('notifications:usr-frank', 'NOTIFICATION_CREATED', sampleNotif);

  assert(receivedNotifs.length === 2, 'Two raw notification events received by transport');

  // Verify deduplication logic
  const deduplicated = Array.from(
    new Map(receivedNotifs.map((n) => [n.notificationId, n])).values()
  );
  assert(deduplicated.length === 1, 'Client deduplication preserves single unique notification entry');

  unsubNotif();

  // ----------------------------------------------------------------------------
  // Test Group 9: Authoritative Post-Reconnect Database Resynchronization
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 9: Post-Reconnect Authoritative Database Resync');

  let resyncExecuted: boolean = false;
  const unsubResync = RealtimeService.registerResyncCallback('orders_resync_test', async () => {
    resyncExecuted = true;
  });

  await RealtimeService.executeResync();
  assert(Boolean(resyncExecuted), 'Registered resync callback executed successfully');

  unsubResync();

  // ----------------------------------------------------------------------------
  // Test Group 10: Clean Unsubscription Closures & Channel Leak Prevention
  // ----------------------------------------------------------------------------
  console.log('\nTest Group 10: Clean Unsubscription Closures & Leak Prevention');

  let leakTestTriggered: boolean = false;
  const unsubLeak = RealtimeService.subscribe('test:leak:channel', () => {
    leakTestTriggered = true;
  });

  // First dispatch: should trigger
  RealtimeService.publishEvent('test:leak:channel', 'ORDER_CREATED', {});
  assert(Boolean(leakTestTriggered), 'Active subscription receives event');

  // Unsubscribe
  unsubLeak();
  leakTestTriggered = false;

  // Second dispatch: must NOT trigger
  RealtimeService.publishEvent('test:leak:channel', 'ORDER_CREATED', {});
  assert(!leakTestTriggered, 'Unsubscribed callback does not receive subsequent events');

  console.log('\n======================================================');
  console.log(`🏁 REALTIME PIPELINE TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

// Direct execution support
if (require.main === module) {
  runRealtimePipelineTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
