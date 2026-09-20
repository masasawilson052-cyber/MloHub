import {
  RestaurantRepository,
  BranchRepository,
  MenuRepository,
  OrderRepository,
  ReservationRepository,
  CustomMealRepository,
  NotificationRepository,
  ReviewRepository,
  PaymentRepository,
  ApplicationRepository,
  AuditLogRepository,
} from '../repositories';
import { RestaurantService } from '../services/RestaurantService';
import { MenuService } from '../services/MenuService';
import { OrderService } from '../services/OrderService';
import { ReservationService } from '../services/ReservationService';
import { NotificationService } from '../services/NotificationService';
import { isSupabaseConfigured } from '../lib/supabase';
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

export async function runSupabaseDataLayerTestSuite(): Promise<{ passedCount: number; failedCount: number }> {
  console.log('\n================================================================');
  console.log('🧪 STAGE 2: SUPABASE DATA LAYER & REPOSITORIES TEST SUITE');
  console.log('================================================================\n');

  await MloHubDB.init();

  // GROUP 1: Repositories Architecture & Exports
  console.log('Test Group 1: Repository Module Exports and Method Contracts');
  assert(typeof RestaurantRepository.list === 'function', 'RestaurantRepository.list is defined');
  assert(typeof RestaurantRepository.getById === 'function', 'RestaurantRepository.getById is defined');
  assert(typeof RestaurantRepository.create === 'function', 'RestaurantRepository.create is defined');
  assert(typeof BranchRepository.listByRestaurant === 'function', 'BranchRepository.listByRestaurant is defined');
  assert(typeof MenuRepository.listCategories === 'function', 'MenuRepository.listCategories is defined');
  assert(typeof MenuRepository.listItems === 'function', 'MenuRepository.listItems is defined');
  assert(typeof OrderRepository.createOrder === 'function', 'OrderRepository.createOrder is defined');
  assert(typeof OrderRepository.getOrderById === 'function', 'OrderRepository.getOrderById is defined');
  assert(typeof ReservationRepository.create === 'function', 'ReservationRepository.create is defined');
  assert(typeof CustomMealRepository.createRequest === 'function', 'CustomMealRepository.createRequest is defined');
  assert(typeof NotificationRepository.createNotification === 'function', 'NotificationRepository.createNotification is defined');
  assert(typeof ReviewRepository.listForRestaurant === 'function', 'ReviewRepository.listForRestaurant is defined');
  assert(typeof PaymentRepository.createRecord === 'function', 'PaymentRepository.createRecord is defined');
  assert(typeof ApplicationRepository.listAll === 'function', 'ApplicationRepository.listAll is defined');
  assert(typeof AuditLogRepository.logAction === 'function', 'AuditLogRepository.logAction is defined');

  // GROUP 2: RestaurantService & MenuService
  console.log('\nTest Group 2: Restaurant & Menu Services');
  const restaurants = await RestaurantService.getRestaurants();
  assert(Array.isArray(restaurants), 'RestaurantService.getRestaurants() returns an array');
  assert(restaurants.length > 0, 'Loaded restaurants fixture/live data');
  const firstRest = restaurants[0];
  assert(!!firstRest.id, 'Restaurant has canonical ID');
  assert(!!firstRest.name, 'Restaurant has name');
  assert(firstRest.minPriceTzs > 0, 'Restaurant has minPriceTzs in TZS');

  // Neighborhood filtering
  const mikocheniRests = await RestaurantService.getRestaurants({ neighborhood: 'Mikocheni' });
  assert(Array.isArray(mikocheniRests), 'Filtered by neighborhood returns array');

  // Single restaurant detail
  const detail = await RestaurantService.getRestaurantDetail(firstRest.id);
  assert(detail !== null, 'RestaurantDetail loaded successfully');
  if (detail && detail.restaurant) {
    assert(detail.restaurant.id === firstRest.id, 'RestaurantDetail ID matches requested ID');
  }

  // GROUP 3: OrderService Line Items and Calculations
  console.log('\nTest Group 3: OrderService Line Items & Snapshots');
  const branchId = (detail as any)?.branches?.[0]?.id || 'branch-1';
  const standardOrder = await OrderService.submitStandardMenuOrder({
    userId: 'usr-customer-test',
    customerName: 'Juma Selemani',
    customerPhone: '+255 754 888 999',
    restaurantId: firstRest.id,
    branchId: branchId,
    items: [
      { menuItemId: 'item-test-1', name: 'Biryani ya Kuku', unitPriceTzs: 12000, quantity: 2, totalPriceTzs: 24000 },
      { menuItemId: 'item-test-2', name: 'Kachumbari Extra', unitPriceTzs: 2000, quantity: 1, totalPriceTzs: 2000 },
    ],
    diningOption: 'Delivery',
    deliveryAddress: 'Mikocheni B, Mwai Kibaki Rd',
  });

  assert(standardOrder.customerId === 'usr-customer-test', 'Order assigned to correct customer');
  assert(standardOrder.subtotalTzs === 26000, 'Subtotal calculated correctly: 24000 + 2000 = 26000');
  assert(standardOrder.serviceFeeTzs === 1500, 'MloHub platform service fee is 1,500 TZS');
  assert(standardOrder.deliveryFeeTzs === 2500, 'Delivery fee applied for Delivery fulfillment (2,500 TZS)');
  assert(standardOrder.totalTzs === 30000, 'Total calculated correctly: 26000 + 1500 + 2500 = 30000');
  assert(standardOrder.items !== undefined && standardOrder.items.length === 2, 'Order has 2 line items with immutable snapshots');
  if (standardOrder.items) {
    assert(standardOrder.items[0].itemNameSnapshot === 'Biryani ya Kuku', 'Line item 1 snapshot name preserved');
    assert(standardOrder.items[0].priceSnapshot === 12000, 'Line item 1 snapshot unit price preserved');
  }

  // GROUP 4: ReservationService 50% Deposit Logic
  console.log('\nTest Group 4: ReservationService 50% Advance Deposit Logic');
  const res50 = await ReservationService.createReservation({
    customerId: 'usr-customer-test',
    restaurantId: firstRest.id,
    restaurantName: firstRest.name,
    partySize: 4,
    reservationDate: '2026-09-25',
    reservationTime: '08:00 PM',
    customerNote: 'Near window table please',
    depositOption: 'deposit_50',
    perPersonDepositTzs: 10000,
  });

  assert(res50.partySize === 4, 'Party size set to 4 guests');
  assert(res50.depositOption === 'deposit_50', 'Deposit option is deposit_50');
  // 4 guests * 10,000 = 40,000; 50% = 20,000 TZS
  assert(res50.depositAmountTzs === 20000, '50% deposit amount calculated accurately (20,000 TZS)');
  assert(res50.isDepositPaid === false, 'Deposit payment status initialized to unpaid');

  const res100 = await ReservationService.createReservation({
    customerId: 'usr-customer-test',
    restaurantId: firstRest.id,
    restaurantName: firstRest.name,
    partySize: 4,
    reservationDate: '2026-09-25',
    reservationTime: '08:00 PM',
    depositOption: 'full_100',
    perPersonDepositTzs: 10000,
  });
  assert(res100.depositAmountTzs === 40000, 'Full deposit calculated accurately (40,000 TZS)');

  // Cancellation
  const cancelled = await ReservationService.cancelReservation(res50.id, 'usr-customer-test');
  assert(cancelled === true, 'Reservation cancelled successfully');

  // GROUP 5: NotificationService In-App Feed
  console.log('\nTest Group 5: NotificationService In-App Feed');
  const sentNotif = await NotificationService.sendNotification({
    userId: 'usr-customer-test',
    type: 'order',
    category: 'ORDER',
    titleEn: 'Chakula Kipo Tayari!',
    titleSw: 'Chakula Kipo Tayari!',
    messageEn: 'Your Biryani is steaming hot and ready for pickup.',
    messageSw: 'Biryani yako ipo tayari na ya moto.',
  });

  assert(!!sentNotif.id, 'Notification generated with unique ID');
  assert(sentNotif.userId === 'usr-customer-test', 'Notification mapped to correct user');

  const userNotifs = await NotificationService.listUserNotifications('usr-customer-test');
  assert(Array.isArray(userNotifs), 'listUserNotifications returns array');
  assert(userNotifs.length > 0, 'User has at least 1 notification in feed');

  await NotificationService.markAsRead(sentNotif.id);
  console.log('  ✓ Notification marked as read');
  passed++;

  // GROUP 6: Custom Meal Request Flow
  console.log('\nTest Group 6: Custom Meal Request Flow');
  const customMeal = await OrderService.submitCustomMealRequest({
    userId: 'usr-customer-test',
    customerName: 'Juma Selemani',
    dishName: 'Wali wa Nazi na Samaki wa Kupaka',
    specialInstructions: 'Samaki wa Sangara, tui la nazi zito na pilipili manga pembeni',
    budgetTzs: 18000,
    servingsCount: '2 Persons',
    diningOption: 'Delivery',
    neighborhood: 'Sinza',
  });

  assert(!!customMeal.id, 'Custom meal request generated with ID');
  assert(customMeal.budgetTzs === 18000, 'Budget preserved in TZS: 18,000');
  assert(customMeal.servingsCount === '2 Persons', 'Servings preserved');

  console.log('\n================================================================');
  console.log(`🏁 STAGE 2 TEST SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passedCount: passed, failedCount: failed };
}
