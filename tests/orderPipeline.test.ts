import { OrderPipelineService } from '../services/OrderPipelineService';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { MloHubDB } from '../db';

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

export async function runOrderPipelineTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 MLOHUB REAL-TIME ORDER & CONFIRMATION PIPELINE TESTS');
  console.log('======================================================\n');

  await MloHubDB.init();
  RealtimeEventEngine.clearAll();

  // TEST GROUP 1: Real-Time Event Engine Pub/Sub
  console.log('Test Group 1: Realtime Pub/Sub Engine');
  let receivedBroadcast = false;
  const unsubTest = RealtimeEventEngine.subscribe('test:channel', (evt) => {
    receivedBroadcast = evt.eventType === 'NEW_ORDER_PLACED';
  });

  RealtimeEventEngine.publish('test:channel', {
    eventType: 'NEW_ORDER_PLACED',
    orderId: 'ord-123',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    data: { test: true },
  });

  assert(receivedBroadcast, 'Local and cross-channel event delivered to subscribers');
  unsubTest();

  // TEST GROUP 2: Customer Submits Order ➔ Restaurant Receives Event
  console.log('\nTest Group 2: Customer Order Submission & Restaurant Realtime Dispatch');
  let restaurantReceivedOrder: RealtimeEventPayload | null = null;

  const unsubRest = OrderPipelineService.subscribeToRestaurantOrders('mama-amina-biryani', (evt) => {
    if (evt.eventType === 'NEW_ORDER_PLACED') {
      restaurantReceivedOrder = evt;
    }
  });

  const newOrder = await OrderPipelineService.submitCustomMealOrder({
    userId: 'cust-frank',
    customerName: 'Frank Mlaki',
    customerPhone: '+255 754 123 456',
    dishName: 'Authentic 10-Person Zanzibar Spiced Biryani',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'Extra tamarind kachumbari, less oil',
    budgetTzs: 120000,
    servingsCount: '10',
    diningOption: 'Delivery',
    neighborhood: 'Mikocheni B',
  });

  assert(newOrder.id !== undefined, 'Order successfully saved in MloHub database');
  assert(newOrder.status === 'Pending Confirmation', 'Initial status set to Pending Confirmation');
  assert(restaurantReceivedOrder !== null, 'Restaurant received real-time order notification');
  assert(
    (restaurantReceivedOrder as any)?.data?.order?.id === newOrder.id,
    'Received order payload matches submitted order ID'
  );

  // TEST GROUP 3: Restaurant Quotes Custom Price ➔ Customer Receives Quote
  console.log('\nTest Group 3: Restaurant Custom Quotation Flow');
  let customerReceivedQuote: RealtimeEventPayload | null = null;

  const unsubCust = OrderPipelineService.subscribeToCustomerOrders('cust-frank', (evt) => {
    if (evt.eventType === 'QUOTE_OFFERED') {
      customerReceivedQuote = evt;
    }
  });

  const quoted = await OrderPipelineService.quoteCustomMeal(
    newOrder.id,
    'mama-amina-biryani',
    'Mama Amina Authentic Biryani',
    {
      quotedPriceTzs: 115000,
      estimatedDeliveryTime: 'Tomorrow 12:30 PM',
      inclusions: '10x boxed lunch sets with passion juice',
    }
  );

  assert(quoted.budgetTzs === 115000, 'Order record updated with quoted price in database');
  assert(customerReceivedQuote !== null, 'Customer received real-time quote event');
  assert(
    (customerReceivedQuote as any)?.data?.quote?.quotedPriceTzs === 115000,
    'Customer quote event contains correct proposed price'
  );

  // TEST GROUP 4: Kitchen Accepts & Locks Order ➔ Customer Receives Confirmation
  console.log('\nTest Group 4: Kitchen Order Confirmation & Locking');
  let customerReceivedConfirmation: RealtimeEventPayload | null = null;

  const unsubCustConf = OrderPipelineService.subscribeToCustomerOrders('cust-frank', (evt) => {
    if (evt.eventType === 'ORDER_CONFIRMED') {
      customerReceivedConfirmation = evt;
    }
  });

  const confirmed = await OrderPipelineService.acceptAndConfirmOrder(
    newOrder.id,
    'mama-amina-biryani',
    'Mama Amina Authentic Biryani',
    35
  );

  assert(confirmed.status === 'Confirmed', 'Database status transitioned to Confirmed');
  assert(customerReceivedConfirmation !== null, 'Customer received real-time confirmation');
  assert(
    (customerReceivedConfirmation as any)?.data?.prepTimeMinutes === 35,
    'Confirmation event contains kitchen estimated prep time'
  );

  // TEST GROUP 5: Order Fulfillment Transitions (Cooking ➔ Ready ➔ Completed)
  console.log('\nTest Group 5: Fulfillment Lifecycle & Tracking');
  let lastFulfillmentStatus: string | null = null;

  const unsubStatus = OrderPipelineService.subscribeToCustomerOrders('cust-frank', (evt) => {
    if (evt.eventType === 'STATUS_UPDATED') {
      lastFulfillmentStatus = evt.data?.status;
    }
  });

  await OrderPipelineService.updateFulfillmentStatus(newOrder.id, 'Cooking');
  assert(lastFulfillmentStatus === 'Cooking', 'Customer live tracker received Cooking status');

  await OrderPipelineService.updateFulfillmentStatus(newOrder.id, 'Ready');
  assert(lastFulfillmentStatus === 'Ready', 'Customer live tracker received Ready status');

  await OrderPipelineService.updateFulfillmentStatus(newOrder.id, 'Completed');
  assert(lastFulfillmentStatus === 'Completed', 'Customer live tracker received Completed status');

  // TEST GROUP 6: Multi-Tenant Channel Isolation
  console.log('\nTest Group 6: Restaurant Multi-Tenant Isolation');
  let wrongRestaurantReceived = false;

  const unsubOtherRest = RealtimeEventEngine.subscribe('orders:restaurant:other-kitchen-id', () => {
    wrongRestaurantReceived = true;
  });

  await OrderPipelineService.submitCustomMealOrder({
    userId: 'cust-2',
    dishName: 'Specific Dish for Mama Amina',
    targetRestaurantId: 'mama-amina-biryani',
    specialInstructions: 'None',
    budgetTzs: 20000,
    servingsCount: '1',
    diningOption: 'Dine-In',
  });

  assert(!wrongRestaurantReceived, 'Targeted restaurant orders are strictly isolated from other kitchens');

  // Clean up
  unsubRest();
  unsubCust();
  unsubCustConf();
  unsubStatus();
  unsubOtherRest();

  console.log('\n======================================================');
  console.log(`🏁 REAL-TIME PIPELINE TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runOrderPipelineTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
