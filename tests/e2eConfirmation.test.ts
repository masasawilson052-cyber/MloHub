import { OrderPipelineService } from '../services/OrderPipelineService';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { MloHubDB } from '../db';
import { AuthService } from '../db/auth/service';
import { UserRole } from '../db/types';

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

export async function runE2EConfirmationTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB FULL END-TO-END CONFIRMATION & ORDER LIFECYCLE TESTS');
  console.log('================================================================\n');

  await MloHubDB.init();
  RealtimeEventEngine.clearAll();

  // =========================================================================
  // SCENARIO 1: CUSTOMER SIGNS IN & PLACES CUSTOM ADVANCE MEAL ORDER
  // =========================================================================
  console.log('--- SCENARIO 1: Customer Authentication & Order Placement ---');
  
  const customerSession = await AuthService.login({
    emailOrPhone: 'frank.mlaki@mlohub.tz',
    password: 'password123',
  });
  assert(customerSession.user.role === UserRole.CUSTOMER, 'Customer successfully authenticated with CUSTOMER role');

  let restaurantLiveAlert: RealtimeEventPayload | null = null;
  const unsubRestaurant = OrderPipelineService.subscribeToRestaurantOrders('mama-amina-biryani', (evt) => {
    if (evt.eventType === 'NEW_ORDER_PLACED') {
      restaurantLiveAlert = evt;
    }
  });

  const submittedOrder = await OrderPipelineService.submitCustomMealOrder({
    userId: customerSession.user.id,
    customerName: customerSession.user.fullName,
    customerPhone: customerSession.user.phone,
    dishName: 'Authentic 15-Person Zanzibar Spiced Beef Pilau & Biryani Feast',
    targetRestaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    specialInstructions: 'Time: Tomorrow 1:00 PM | Area: Mikocheni B | Corporate Lunch (15 Staff) | Extra tamarind kachumbari',
    budgetTzs: 0, // No pre-set budget; restaurant quotes direct price
    servingsCount: '15',
    diningOption: 'Delivery',
    neighborhood: 'Mikocheni',
  });

  assert(submittedOrder.id.startsWith('cmo-') || submittedOrder.id.length > 0, 'Custom order assigned persistent ID');
  assert(submittedOrder.status === 'Pending Confirmation', 'Order initialized in "Pending Confirmation" state');
  assert(submittedOrder.servingsCount === '15', 'Portions accurately recorded as 15 people');
  assert(restaurantLiveAlert !== null, 'Restaurant received real-time "NEW_ORDER_PLACED" event');
  assert((restaurantLiveAlert as any)?.orderId === submittedOrder.id, 'Real-time alert matches submitted order ID');

  // Verify restaurant in-app notification
  const allNotifs = MloHubDB.notifications.getAll();
  const restNotif = allNotifs.find((n) => n.userId === 'usr-chef-amina' && n.data?.orderId === submittedOrder.id);
  assert(restNotif !== undefined, 'In-app notification created in DB for the kitchen manager');
  assert(Boolean(restNotif?.titleEn?.includes('New Custom Order Request')), 'Kitchen notification has correct title');

  // =========================================================================
  // SCENARIO 2: RESTAURANT REVIEWS DEMAND & SENDS CUSTOM QUOTE
  // =========================================================================
  console.log('\n--- SCENARIO 2: Restaurant Kitchen Quotation & Pricing ---');

  let customerReceivedQuote: RealtimeEventPayload | null = null;
  const unsubCustomer = OrderPipelineService.subscribeToCustomerOrders(customerSession.user.id, (evt) => {
    if (evt.eventType === 'QUOTE_OFFERED') {
      customerReceivedQuote = evt;
    }
  });

  const quoteResponse = await OrderPipelineService.quoteCustomMeal(
    submittedOrder.id,
    'mama-amina-biryani',
    'Mama Amina Biryani House',
    {
      quotedPriceTzs: 180000,
      estimatedDeliveryTime: 'Tomorrow 12:45 PM',
      inclusions: '15x boxed sets with beef pilau, tamarind kachumbari, fried plantains, and 15x cold passion juices',
    }
  );

  assert(quoteResponse.budgetTzs === 180000, 'Database order updated with kitchen quoted price (TZS 180,000)');
  assert(customerReceivedQuote !== null, 'Customer channel received live "QUOTE_OFFERED" event');
  assert((customerReceivedQuote as any)?.data?.quote?.quotedPriceTzs === 180000, 'Customer quote event contains accurate pricing terms');

  // =========================================================================
  // SCENARIO 3: KITCHEN CONFIRMS & LOCKS ORDER BATCH (E2E CONFIRMATION)
  // =========================================================================
  console.log('\n--- SCENARIO 3: End-to-End Kitchen Confirmation & Lock ---');

  let customerReceivedConfirmation: RealtimeEventPayload | null = null;
  const unsubCustomerConf = OrderPipelineService.subscribeToCustomerOrders(customerSession.user.id, (evt) => {
    if (evt.eventType === 'ORDER_CONFIRMED') {
      customerReceivedConfirmation = evt;
    }
  });

  const confirmedOrder = await OrderPipelineService.acceptAndConfirmOrder(
    submittedOrder.id,
    'mama-amina-biryani',
    'Mama Amina Biryani House',
    45
  );

  assert(confirmedOrder.status === 'Confirmed', 'Order status transitioned to "Confirmed" in DB');
  assert(confirmedOrder.statusMessageEn.toLowerCase().includes('confirmed'), 'Status message updated with confirmation details');
  assert(customerReceivedConfirmation !== null, 'Customer received instant "ORDER_CONFIRMED" broadcast');
  assert((customerReceivedConfirmation as any)?.data?.prepTimeMinutes === 45, 'Confirmation payload carries 45-min prep time');

  // Verify Customer in-app notification in DB
  const custConfirmationNotif = MloHubDB.notifications.getAll().find(
    (n) => n.userId === customerSession.user.id && n.data?.orderId === submittedOrder.id && n.data?.prepTimeMinutes === 45
  );
  assert(custConfirmationNotif !== undefined, 'Customer received in-app confirmation notification');
  assert(custConfirmationNotif?.titleSw.includes('Agizo Limethibitishwa') === true, 'Bilingual Swahili notification title verified');

  // =========================================================================
  // SCENARIO 4: LIVE KITCHEN FULFILLMENT TRACKING (Cooking ➔ Ready ➔ Completed)
  // =========================================================================
  console.log('\n--- SCENARIO 4: Live Fulfillment Tracking Lifecycle ---');

  const receivedFulfillmentStatuses: string[] = [];
  const unsubStatusTracking = OrderPipelineService.subscribeToCustomerOrders(customerSession.user.id, (evt) => {
    if (evt.eventType === 'STATUS_UPDATED') {
      receivedFulfillmentStatuses.push(evt.data?.status);
    }
  });

  // Step 4a: Cooking
  await OrderPipelineService.updateFulfillmentStatus(submittedOrder.id, 'Cooking');
  const cookingOrder = MloHubDB.customOrders.getById(submittedOrder.id);
  assert(cookingOrder?.status === 'Cooking', 'Database status transitioned to "Cooking"');
  assert(receivedFulfillmentStatuses.includes('Cooking'), 'Customer live tracker received "Cooking" status broadcast');

  // Step 4b: Ready
  await OrderPipelineService.updateFulfillmentStatus(submittedOrder.id, 'Ready');
  const readyOrder = MloHubDB.customOrders.getById(submittedOrder.id);
  assert(readyOrder?.status === 'Ready', 'Database status transitioned to "Ready"');
  assert(receivedFulfillmentStatuses.includes('Ready'), 'Customer live tracker received "Ready" status broadcast');

  // Step 4c: Completed
  await OrderPipelineService.updateFulfillmentStatus(submittedOrder.id, 'Completed');
  const completedOrder = MloHubDB.customOrders.getById(submittedOrder.id);
  assert(completedOrder?.status === 'Completed', 'Database status transitioned to "Completed"');
  assert(receivedFulfillmentStatuses.includes('Completed'), 'Customer live tracker received "Completed" status broadcast');

  // =========================================================================
  // SCENARIO 5: TABLE RESERVATION CONFIRMATION END-TO-END
  // =========================================================================
  console.log('\n--- SCENARIO 5: Table Reservation Confirmation Flow ---');

  const reservation = await MloHubDB.reservations.create({
    userId: customerSession.user.id,
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    address: 'Mikocheni B, Dar es Salaam',
    reservationDate: '2026-09-05',
    timeSlot: '7:30 PM',
    guestsCount: '6',
    status: 'confirmed',
    specialNotes: 'Anniversary family dinner',
  });

  assert(reservation.id.startsWith('res-'), 'Table reservation created with persistent ID');
  assert(reservation.status === 'confirmed', 'Reservation initialized in confirmed state');
  
  const resNotif = MloHubDB.notifications.getAll().find((n) => n.userId === customerSession.user.id && n.category === 'reservation');
  assert(resNotif !== undefined, 'Reservation notification automatically generated in DB');
  assert(resNotif?.restaurantName === 'Mama Amina Biryani House', 'Reservation notification contains restaurant identity');

  // =========================================================================
  // SCENARIO 6: MULTI-TENANT ISOLATION & AUDIT INTEGRITY
  // =========================================================================
  console.log('\n--- SCENARIO 6: Multi-Tenant Channel Isolation ---');

  let otherKitchenAlertReceived = false;
  const unsubOtherKitchen = RealtimeEventEngine.subscribe('orders:restaurant:chef-hassan-choma', () => {
    otherKitchenAlertReceived = true;
  });

  await OrderPipelineService.submitCustomMealOrder({
    userId: 'cust-isolated',
    customerName: 'David Kweka',
    customerPhone: '+255 754 999 888',
    dishName: 'Private Order Exclusively for Mama Amina',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Confidential corporate order',
    budgetTzs: 0,
    servingsCount: '5',
    diningOption: 'Dine-In',
  });

  assert(!otherKitchenAlertReceived, 'Strict channel isolation: Chef Hassan kitchen received 0 cross-tenant alerts');

  // Clean up all subscriptions
  unsubRestaurant();
  unsubCustomer();
  unsubCustomerConf();
  unsubStatusTracking();
  unsubOtherKitchen();

  console.log('\n================================================================');
  console.log(`🏁 E2E CONFIRMATION TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runE2EConfirmationTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
