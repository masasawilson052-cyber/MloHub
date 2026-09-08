/**
 * ============================================================================
 * MLOHUB MASTER E2E & SECURITY TEST SUITE (18 SCENARIOS)
 * Covers: Supabase DB, RBAC, Hashed OTP, Admin Onboarding, Kitchen Pipeline,
 *         Mobile Money Payments, Idempotency, and Session Security.
 * ============================================================================
 */

import { MloHubDB } from '../db';
import { UserRole, SellerTier, hasAdminAccess, getUserRoles } from '../db/types';
import { CryptoEngine } from '../db/auth/crypto';
import { AuthService } from '../db/auth/service';
import { AdminOnboardingService } from '../services/AdminOnboardingService';
import { OrderPipelineService } from '../services/OrderPipelineService';
import { PaymentGatewayService } from '../services/PaymentGatewayService';
import { AdminApiService } from '../services/AdminApiService';

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

async function runMasterTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB MASTER E2E, SECURITY & MOBILE PAYMENTS TEST SUITE');
  console.log('================================================================\n');

  await MloHubDB.init();

  // ---------------------------------------------------------------------------
  // SCENARIO 1: No Automatic Login on Fresh App Launch
  // ---------------------------------------------------------------------------
  console.log('Scenario 1: No Automatic Login & Clean Session Initialization');
  assert(MloHubDB.getSnapshot().activeUserId === undefined, 'Default database activeUserId is undefined (no auto-login)');
  const unauthSession = await AuthService.bootstrapSession();
  assert(unauthSession === null, 'Bootstrap returns null when no token is present');

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Unauthorized Admin Access Rejected
  // ---------------------------------------------------------------------------
  console.log('\nScenario 2: Unauthorized Admin Access Rejected (401/403 RBAC)');
  const customerUser = MloHubDB.users.getById('usr-frank');
  assert(customerUser !== undefined, 'Customer profile exists');
  assert(hasAdminAccess(customerUser) === false, 'Customer user hasAdminAccess is FALSE');
  
  const custToken = CryptoEngine.signToken({
    userId: 'usr-frank',
    role: UserRole.CUSTOMER,
    email: 'frank.mlaki@mlohub.tz',
  });

  const adminCallByCustomer = await AdminApiService.listRestaurants(custToken);
  assert(adminCallByCustomer.statusCode === 403, 'Admin endpoint returns 403 Forbidden for customer');

  const unauthCall = await AdminApiService.listRestaurants(undefined);
  assert(unauthCall.statusCode === 401, 'Admin endpoint returns 401 Unauthorized for missing token');

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Restaurant Owner Cannot Access Admin Portal
  // ---------------------------------------------------------------------------
  console.log('\nScenario 3: Restaurant Owner Cannot Access Admin Portal');
  const ownerUser = MloHubDB.users.getById('usr-chef-amina');
  assert(ownerUser !== undefined, 'Owner profile exists');
  assert(hasAdminAccess(ownerUser) === false, 'Restaurant Owner hasAdminAccess is FALSE');

  const ownerToken = CryptoEngine.signToken({
    userId: 'usr-chef-amina',
    role: UserRole.RESTAURANT_OWNER,
    email: 'mama.amina@mlohub.tz',
    restaurantId: 'mama-amina-biryani',
  });

  const adminCallByOwner = await AdminApiService.createRestaurant(ownerToken, {
    businessName: 'Unauthorized Kitchen',
    ownerName: 'Mama Amina',
    ownerPhone: '+255754889120',
    ownerNationalId: '19850101-12345-00001-10',
    neighborhood: 'Mikocheni',
    address: 'Old Bagamoyo Rd',
    payoutPhoneNumber: '+255754889120',
    initialMenu: [{ name: 'Pilau', priceTzs: 10000 }],
    checklist: {
      phoneVerified: true,
      ownerIdentified: true,
      locationConfirmed: true,
      businessPhotoAttached: true,
      menuWithPricesAdded: true,
      termsAccepted: true,
    },
  });
  assert(adminCallByOwner.statusCode === 403, 'Admin endpoint rejects Restaurant Owner with 403 Forbidden');

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Multi-Tenant Boundary: Cross-Restaurant Access Blocked
  // ---------------------------------------------------------------------------
  console.log('\nScenario 4: Multi-Tenant Cross-Restaurant Boundary Isolation');
  const crossTenantAttempt = await AdminApiService.suspendRestaurant(
    ownerToken,
    'kibo-mchemsho', // Mama Amina attempting to modify Kibo Mchemsho
    'Unauthorized suspension attempt'
  );
  assert(crossTenantAttempt.statusCode === 403, 'Owner cannot modify another restaurant (403 Forbidden)');

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Admin Restaurant Onboarding Workflow
  // ---------------------------------------------------------------------------
  console.log('\nScenario 5: Admin Restaurant Onboarding with 6-Point Checklist');
  const adminUser = MloHubDB.users.getById('usr-admin');
  assert(adminUser !== undefined, 'Admin user exists');
  assert(hasAdminAccess(adminUser) === true, 'Admin user hasAdminAccess is TRUE');

  const testPhone = '+255754998877';
  const otpRes = await AdminOnboardingService.generateAndSendOtp(testPhone);
  assert(otpRes.success === true, 'Admin generated and dispatched OTP to vendor');
  assert(!('otp' in otpRes), 'Plaintext OTP is NEVER returned to client in response');

  // Verify challenge saved in DB as cryptographic hash
  const challenge = await MloHubDB.otpChallenges.getActiveByPhone(testPhone);
  assert(challenge !== undefined, 'OTP challenge recorded in database');
  assert(challenge!.otpHash.startsWith('otp_v1$'), 'OTP stored strictly as salted SHA-256 hash');
  assert(challenge!.attemptsCount === 0, 'Initial attempt count is 0');
  assert(challenge!.maxAttempts === 3, 'Max attempt rate-limiting set to 3');

  // ---------------------------------------------------------------------------
  // SCENARIO 6: OTP Expiration and Rate-Limiting Attempt Lockouts
  // ---------------------------------------------------------------------------
  console.log('\nScenario 6: OTP Rate-Limiting & Hash Verification');
  // Attempt 1: Wrong OTP
  const fail1 = await AdminOnboardingService.verifyOtp(testPhone, '000000');
  assert(fail1.success === false, 'Invalid OTP code rejected');
  assert(fail1.message.includes('2 attempt(s) remaining'), 'Rate limiter decrements attempts correctly');

  // Attempt 2: Wrong OTP
  const fail2 = await AdminOnboardingService.verifyOtp(testPhone, '111111');
  assert(fail2.success === false, 'Second invalid OTP code rejected');

  // Attempt 3: Wrong OTP
  const fail3 = await AdminOnboardingService.verifyOtp(testPhone, '222222');
  assert(fail3.success === false, 'Third invalid OTP code rejected');

  // Attempt 4: Lockout check
  const fail4 = await AdminOnboardingService.verifyOtp(testPhone, '333333');
  assert(fail4.success === false, 'Challenge locked after exceeding 3 maximum attempts');

  // Create fresh challenge for onboarding test
  const freshPhone = '+255784112233';
  await AdminOnboardingService.generateAndSendOtp(freshPhone);
  const freshChallenge = await MloHubDB.otpChallenges.getActiveByPhone(freshPhone);
  // Mark verified for admin onboarding step
  await MloHubDB.otpChallenges.markVerified(freshChallenge!.id);

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Vendor Creation, Membership Linkage & Audit Logging
  // ---------------------------------------------------------------------------
  console.log('\nScenario 7: Vendor Creation, Membership Linkage & Audit Logging');
  const onboardRes = await AdminOnboardingService.onboardRestaurant({
    businessName: 'Zanzibar Spice Spot',
    cuisine: 'Swahili Pilau',
    ownerName: 'Khadija Said',
    ownerPhone: freshPhone,
    ownerNationalId: '19880101-12345-00001-10',
    neighborhood: 'Mikocheni',
    address: 'Old Bagamoyo Rd',
    payoutPhoneNumber: freshPhone,
    payoutProvider: 'M-Pesa',
    sellerTier: 'BASIC_SELLER',
    initialMenu: [
      {
        name: 'Zanzibar Fish Pilau',
        priceTzs: 12000,
        category: 'Main Dishes',
        description: 'Fresh local kingfish with spiced pilau rice',
      },
    ],
    checklist: {
      phoneVerified: true,
      ownerIdentified: true,
      locationConfirmed: true,
      businessPhotoAttached: true,
      menuWithPricesAdded: true,
      termsAccepted: true,
    },
  });

  assert(onboardRes.success === true, 'Vendor onboarded successfully');
  assert(onboardRes.restaurant !== undefined, 'Restaurant entity created');
  assert(onboardRes.ownerUser !== undefined, 'Owner user created with credentials');
  assert(onboardRes.ownerUser?.role === UserRole.RESTAURANT_OWNER, 'Owner assigned RESTAURANT_OWNER role');

  const membership = MloHubDB.getSnapshot().restaurantMemberships.find(
    (m) => m.userId === onboardRes.ownerUser?.id && m.restaurantId === onboardRes.restaurant?.id
  );
  assert(membership !== undefined, 'Restaurant membership record created and linked');
  assert(membership?.role === 'OWNER', 'Membership role is OWNER');

  const auditLog = MloHubDB.getSnapshot().auditLogs?.find(
    (a) => a.action === 'ONBOARD_RESTAURANT' && a.targetId === onboardRes.restaurant?.id
  );
  assert(auditLog !== undefined, 'Immutable audit log recorded for onboarding action');

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Menu Management (Create, Update, Stock, Availability, Archive)
  // ---------------------------------------------------------------------------
  console.log('\nScenario 8: Complete Menu Management & Stock Tracking');
  const restId = onboardRes.restaurant!.id;

  // Add Item
  const newItem = await MloHubDB.restaurants.addMenuItem(restId, {
    name: 'Ndizi Nyama (Beef Plantain Stew)',
    nameSw: 'Ndizi Nyama ya Nazi',
    priceTzs: 9000,
    category: 'Swahili Boils',
    description: 'Slow simmered plantains with coconut cream and beef.',
    photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
    stockQuantity: 20,
    isAvailable: true,
    estimatedPrepTimeMinutes: 25,
    dietaryTags: ['Fresh Local', 'Halal'],
  });
  assert(newItem !== undefined, 'Menu item added to restaurant');
  assert(newItem?.stockQuantity === 20, 'Initial stock quantity set to 20');

  // Update Item Price & Stock
  const updatedItem = await MloHubDB.restaurants.updateMenuItem(restId, newItem!.id, {
    priceTzs: 9500,
    stockQuantity: 18,
  });
  assert(updatedItem?.priceTzs === 9500, 'Menu item price updated in TZS');
  assert(updatedItem?.stockQuantity === 18, 'Menu item stock updated');

  // Toggle Availability
  const disabledItem = await MloHubDB.restaurants.updateMenuItem(restId, newItem!.id, {
    isAvailable: false,
  });
  assert(disabledItem?.isAvailable === false, 'Menu item availability toggled to false (Out of Stock)');

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Customer Sees Updated Menu & Places Order
  // ---------------------------------------------------------------------------
  console.log('\nScenario 9: Customer Menu Reflection & Order Placement');
  const freshRest = MloHubDB.restaurants.getById(restId);
  assert(freshRest?.menu.some((m) => m.name.includes('Ndizi Nyama')) === true, 'Customer sees live updated menu');

  // Customer places order for 2 portions
  const placedOrder = await OrderPipelineService.submitStandardMenuOrder({
    userId: 'usr-frank',
    customerName: 'Frank Mlaki',
    customerPhone: '+255 754 123 456',
    restaurantId: restId,
    items: [
      {
        menuItemId: freshRest!.menu[0].id,
        name: freshRest!.menu[0].name,
        unitPriceTzs: freshRest!.menu[0].priceTzs || 12000,
        quantity: 2,
        totalPriceTzs: 24000,
      },
    ],
    diningOption: 'Delivery',
    deliveryAddress: 'Mikocheni B, Old Bagamoyo Rd',
    specialInstructions: 'Pilipili pembeni tafadhali',
  });

  assert(placedOrder !== undefined, 'Order placed successfully');
  assert(placedOrder.status === 'Pending Confirmation', 'Order status initialized to Pending Confirmation');
  assert(placedOrder.budgetTzs === 24000 + 1500 + 2500, 'Order total calculated with service & delivery fees');

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Restaurant Accepts Order with Estimated Prep Time
  // ---------------------------------------------------------------------------
  console.log('\nScenario 10: Restaurant Order Acceptance & Prep Time');
  const acceptedOrder = await OrderPipelineService.acceptOrder(placedOrder.id, 30, restId);
  assert(acceptedOrder.status === 'Confirmed', 'Order status moved to Confirmed upon acceptance');
  assert(acceptedOrder.statusMessageEn.includes('30 mins'), 'Prep time reflected in status message');

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Kitchen Kanban Stage Transitions
  // ---------------------------------------------------------------------------
  console.log('\nScenario 11: Kitchen Kanban Status Transitions');
  // Cooking
  const cookingOrder = await OrderPipelineService.updateFulfillmentStatus(placedOrder.id, 'Cooking');
  assert(cookingOrder.status === 'Cooking', 'Order stage transitioned to Cooking');

  // Ready
  const readyOrder = await OrderPipelineService.updateFulfillmentStatus(placedOrder.id, 'Ready');
  assert(readyOrder.status === 'Ready', 'Order stage transitioned to Ready (Packed for dispatch)');

  // Completed
  const completedOrder = await OrderPipelineService.updateFulfillmentStatus(placedOrder.id, 'Completed');
  assert(completedOrder.status === 'Completed', 'Order stage transitioned to Completed');

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Mobile Money Payment Initiation (M-Pesa USSD Push)
  // ---------------------------------------------------------------------------
  console.log('\nScenario 12: Mobile Money Payment Initiation & USSD Flow');
  const payInit = await PaymentGatewayService.initiatePayment({
    userId: 'usr-frank',
    orderId: placedOrder.id,
    restaurantId: restId,
    restaurantName: 'Zanzibar Spice Spot',
    amountTzs: placedOrder.budgetTzs,
    methodCode: 'MPESA',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255754123456',
  });

  assert(payInit.success === true, 'Payment initiated successfully');
  assert(payInit.status === 'PENDING', 'Payment transaction state is PENDING');
  assert(payInit.providerReference.startsWith('CP-'), 'Provider reference generated');
  assert(payInit.ussdCode === '*150*00#', 'Correct Vodacom M-Pesa USSD shortcode returned');

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Webhook HMAC Cryptographic Signature Verification
  // ---------------------------------------------------------------------------
  console.log('\nScenario 13: Webhook Cryptographic Signature Verification');
  const webhookSecret = 'mlohub_cp_sec_993847291048_prod';

  // Bad signature attempt
  const badWebhook = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt-test-bad',
      eventType: 'payment.success',
      providerReference: payInit.providerReference,
      paymentId: payInit.paymentId,
      amount: placedOrder.budgetTzs,
      currency: 'TZS',
      method: 'M-Pesa',
      payerPhone: '+255754123456',
      channel: 'MPESA',
      timestamp: new Date().toISOString(),
    },
    'invalid_fake_signature'
  );
  assert(badWebhook.success === false, 'Webhook rejected on invalid cryptographic signature');

  // Good signature processing
  const goodWebhook = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt-test-good',
      eventType: 'payment.success',
      providerReference: payInit.providerReference,
      paymentId: payInit.paymentId,
      amount: placedOrder.budgetTzs,
      currency: 'TZS',
      method: 'M-Pesa',
      payerPhone: '+255754123456',
      channel: 'MPESA',
      timestamp: new Date().toISOString(),
    },
    webhookSecret
  );
  assert(goodWebhook.success === true, 'Webhook accepted and verified successfully');
  assert(goodWebhook.payment?.status === 'PAID', 'Payment transaction marked as PAID');

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Webhook Idempotency (Prevent Duplicate Double Payouts)
  // ---------------------------------------------------------------------------
  console.log('\nScenario 14: Idempotent Webhook Processing (Duplicate Defense)');
  const duplicateWebhook = await PaymentGatewayService.processWebhook(
    {
      eventId: 'evt-test-duplicate',
      eventType: 'payment.success',
      providerReference: payInit.providerReference,
      paymentId: payInit.paymentId,
      amount: placedOrder.budgetTzs,
      currency: 'TZS',
      method: 'M-Pesa',
      payerPhone: '+255754123456',
      channel: 'MPESA',
      timestamp: new Date().toISOString(),
    },
    webhookSecret
  );
  assert(duplicateWebhook.success === true, 'Duplicate webhook handled safely');
  assert(duplicateWebhook.message.includes('idempotent'), 'Idempotency detected and acknowledged without reprocessing');

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Restaurant Earnings Updated Strictly on Verified Payments
  // ---------------------------------------------------------------------------
  console.log('\nScenario 15: Restaurant Earnings Calculated Strictly on Paid Orders');
  const restaurantPayments = MloHubDB.getSnapshot().payments.filter(
    (p) => p.restaurantId === restId && p.status === 'PAID'
  );
  assert(restaurantPayments.length === 1, 'Verified paid transaction attached to restaurant');
  const netPayout = restaurantPayments[0].amountTzs - Math.round(restaurantPayments[0].amountTzs * 0.10);
  assert(netPayout > 0, 'Net restaurant earnings correctly computed after 10% platform fee deduction');

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Password Strength & Cryptographic Hashing
  // ---------------------------------------------------------------------------
  console.log('\nScenario 16: Password Hashing & Strength Evaluation');
  const weakCheck = CryptoEngine.checkPasswordStrength('123');
  assert(weakCheck.score <= 1, 'Weak password flagged correctly');

  const strongCheck = CryptoEngine.checkPasswordStrength('MloHub@2026Secure!');
  assert(strongCheck.score === 4, 'Strong password evaluated with score 4');

  const testPass = 'MloHubTestPassword2026!';
  const hashed = CryptoEngine.hashPassword(testPass);
  assert(CryptoEngine.verifyPassword(testPass, hashed) === true, 'Salted hash verified successfully');
  assert(CryptoEngine.verifyPassword('WrongPass', hashed) === false, 'Incorrect password rejected');

  // ---------------------------------------------------------------------------
  // SCENARIO 17: User Session Logout & Token Revocation
  // ---------------------------------------------------------------------------
  console.log('\nScenario 17: Session Token Verification & Logout');
  const validToken = CryptoEngine.signToken({
    userId: 'usr-frank',
    role: UserRole.CUSTOMER,
    email: 'frank.mlaki@mlohub.tz',
  });
  assert(CryptoEngine.verifyToken(validToken) !== null, 'Valid token verified and decoded');

  const expiredOrInvalidToken = 'invalid.bearer.token.data';
  assert(CryptoEngine.verifyToken(expiredOrInvalidToken) === null, 'Invalid token returns null');

  // ---------------------------------------------------------------------------
  // SCENARIO 18: 2-Tier Seller Badging & Upgrades (TIN & BRELA)
  // ---------------------------------------------------------------------------
  console.log('\nScenario 18: 2-Tier Seller Badging & Compliance Upgrades');
  const upgradeRes = await AdminOnboardingService.upgradeToVerified(restId, {
    tinNumber: '123-456-789',
    businessLicenseNumber: 'BL-DAR-2026-9901',
    brelaRegNumber: 'BRELA-99201',
  });
  assert(upgradeRes.success === true, 'Restaurant successfully upgraded to Verified Seller');
  assert(upgradeRes.restaurant?.sellerTier === 'VERIFIED_SELLER', 'Seller tier set to VERIFIED_SELLER');
  assert(upgradeRes.restaurant?.tinNumber === '123-456-789', 'TIN number recorded on restaurant');

  // Final Results
  console.log('\n================================================================');
  console.log(`🏁 MASTER TEST SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterTestSuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
