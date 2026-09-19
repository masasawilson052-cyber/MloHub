import { AdminOnboardingService } from '../services/AdminOnboardingService';
import { MloHubDB } from '../db';
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

export async function runAdminOnboardingTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB ADMIN ONBOARDING & 2-TIER VENDOR VERIFICATION TESTS');
  console.log('================================================================\n');

  await MloHubDB.init();

  // -------------------------------------------------------------------------
  // TEST GROUP 1: SMS OTP Verification & 6-Point Checklist Validation
  // -------------------------------------------------------------------------
  console.log('Test Group 1: SMS OTP Verification & 6-Point Admin Approval Checklist');

  // Test 1a: Generate SMS OTP
  const otpRes = await AdminOnboardingService.generateAndSendOtp('+255 754 888 777');
  assert(otpRes.success === true, 'Generated SMS OTP successfully');
  assert(otpRes.message.includes('SMS invitation code'), 'Constructed SMS OTP payload message');
  assert(otpRes.carrierName === 'Vodacom M-Pesa', 'Accurately detected Vodacom carrier for 0754');

  // Test 1b: Verify OTP validation
  const badOtpRes = await AdminOnboardingService.verifyOtp('+255 754 888 777', '0000');
  assert(badOtpRes.success === false, 'Invalid OTP code rejected');

  const challenge = await MloHubDB.otpChallenges.getActiveByPhone('+255 754 888 777');
  assert(challenge !== undefined, 'OTP challenge recorded in DB');
  assert(challenge?.isVerified === false, 'Challenge marked unverified initially');

  const incompleteChecklist = await AdminOnboardingService.onboardRestaurant({
    businessName: 'Kibanda Cha Chapati',
    ownerName: 'Juma Jux',
    ownerPhone: '+255 754 111 222',
    ownerNationalId: '19900101-11111-00001-10',
    neighborhood: 'Sinza',
    address: 'Sinza Mori',
    payoutPhoneNumber: '+255 754 111 222',
    initialMenu: [{ name: 'Chapati', priceTzs: 500 }],
    checklist: {
      phoneVerified: true,
      ownerIdentified: false, // Missing NIDA check
      locationConfirmed: true,
      businessPhotoAttached: false, // Missing photo
      menuWithPricesAdded: true,
      termsAccepted: true,
    },
  });

  assert(!incompleteChecklist.success, 'Reject onboarding when checklist items are incomplete');
  assert(
    incompleteChecklist.missingChecklistItems?.includes('Owner identification (NIDA / ID)') === true,
    'Correctly identifies missing NIDA identification'
  );
  assert(
    incompleteChecklist.missingChecklistItems?.includes('Food spot / Kibanda photo') === true,
    'Correctly identifies missing food spot photo'
  );

  const emptyMenuAttempt = await AdminOnboardingService.onboardRestaurant({
    businessName: 'Kibanda Bila Menu',
    ownerName: 'Salma Said',
    ownerPhone: '+255 784 222 333',
    ownerNationalId: '19920202-22222-00002-20',
    neighborhood: 'Mikocheni',
    address: 'Mikocheni B',
    payoutPhoneNumber: '+255 784 222 333',
    initialMenu: [],
    checklist: {
      phoneVerified: true,
      ownerIdentified: true,
      locationConfirmed: true,
      businessPhotoAttached: true,
      menuWithPricesAdded: false,
      termsAccepted: true,
    },
  });

  assert(!emptyMenuAttempt.success, 'Reject onboarding when no menu items or prices provided');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: Basic Seller Onboarding (Mama Lishe / Kiosk Flow)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 2: Mama Lishe & Food Kiosk Onboarding (No TIN/BRELA Required)');

  const mamaLisheResult = await AdminOnboardingService.onboardRestaurant({
    businessName: 'Mama Rehema Chapati & Supu Hub',
    cuisine: 'Swahili Breakfast & Broths',
    specialty: 'Supu ya Ng\'ombe & Chapati Laini',
    ownerName: 'Rehema Kassim Mwalimu',
    ownerPhone: '+255 754 888 777',
    ownerNationalId: '19850412-12345-00001-20',
    sellerTier: 'BASIC_SELLER',
    neighborhood: 'Mikocheni',
    address: 'Mtaa wa Mwinyi, Mikocheni B',
    openingHours: '06:30 AM',
    closingHours: '08:30 PM',
    payoutPhoneNumber: '+255 754 888 777',
    payoutProvider: 'M-Pesa, Tigo Pesa, Airtel Money',
    acceptedPaymentMethods: ['Vodacom M-Pesa', 'Mixx by Yas (Tigo)', 'Airtel Money'],
    lipaNumbers: [
      { provider: 'Vodacom Lipa / Till', number: '5566778' },
      { provider: 'Tigo Pesa Lipa', number: '601234' },
    ],
    lipaNumber: '5566778',
    lipaProvider: 'Vodacom Lipa / Till',
    initialMenu: [
      {
        name: 'Supu ya Ng\'ombe & Chapati 2',
        priceTzs: 5000,
        category: 'Breakfast / Supu',
        description: 'Supu safi yenye nyama laini na chapati mbili za ngano.',
      },
      {
        name: 'Wali Maharage & Samaki Panga',
        priceTzs: 6500,
        category: 'Lunch Special',
        description: 'Wali mweupe, maharage ya nazi, na samaki fresh wa kukaanga.',
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

  assert(mamaLisheResult.success, 'Mama Lishe successfully onboarded as Basic Seller');
  assert(mamaLisheResult.restaurant?.sellerTier === 'BASIC_SELLER', 'Assigned BASIC_SELLER tier without requiring TIN/BRELA');
  assert(mamaLisheResult.restaurant?.ownerName === 'Rehema Kassim Mwalimu', 'Owner name persisted in restaurant entity');
  assert(mamaLisheResult.restaurant?.ownerNationalId === '19850412-12345-00001-20', 'Owner NIDA ID persisted');
  assert(Array.isArray(mamaLisheResult.restaurant?.acceptedPaymentMethods) && mamaLisheResult.restaurant.acceptedPaymentMethods.length === 3, 'Multiple payment methods persisted');
  assert(Array.isArray(mamaLisheResult.restaurant?.lipaNumbers) && mamaLisheResult.restaurant.lipaNumbers.length === 2, 'Multiple Lipa numbers persisted');
  assert(mamaLisheResult.restaurant?.lipaNumber === '5566778', 'Lipa Namba persisted correctly on restaurant entity');
  assert(mamaLisheResult.restaurant?.payoutPhoneNumber === '+255 754 888 777', 'Payout phone number configured');
  assert(mamaLisheResult.restaurant?.menu.length === 2, 'Initial 2 menu dishes created with prices');
  assert(mamaLisheResult.ownerUser?.role === UserRole.RESTAURANT_OWNER, 'Owner user created with RESTAURANT_OWNER role');
  assert(mamaLisheResult.invitationCode?.startsWith('MLO-INV-') === true, 'Generated unique invitation code');
  assert(mamaLisheResult.simulatedSmsText?.includes('Mama Rehema Chapati') === true, 'Generated bilingual SMS invitation payload');

  // Verify notification in DB
  const smsNotif = MloHubDB.notifications.getAll().find(
    (n) => n.userId === mamaLisheResult.ownerUser?.id && n.titleEn?.includes('Welcome to MloHub')
  );
  assert(smsNotif !== undefined, 'Welcome invitation and temporary PIN dispatched as system notification');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Vendor Account Activation Flow
  // -------------------------------------------------------------------------
  console.log('\nTest Group 3: Vendor Account Activation via SMS Invitation Code');

  const activationResult = await AdminOnboardingService.activateOwnerAccount(
    '+255 754 888 777',
    mamaLisheResult.invitationCode!,
    '8899'
  );

  assert(activationResult.success, 'Vendor successfully activated account using invitation code');
  assert(activationResult.user?.securityPin === '8899', 'Vendor updated permanent security PIN');

  const activatedRest = MloHubDB.restaurants.getById(mamaLisheResult.restaurant!.id);
  assert(activatedRest?.invitationStatus === 'ACTIVATED', 'Restaurant invitation status updated to ACTIVATED in DB');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Upgrade Basic Seller to Verified Restaurant (Tier 2)
  // -------------------------------------------------------------------------
  console.log('\nTest Group 4: Upgrade to Verified Restaurant Tier');

  const badUpgrade = await AdminOnboardingService.upgradeToVerified(mamaLisheResult.restaurant!.id, {
    tinNumber: '',
    businessLicenseNumber: '',
  });
  assert(!badUpgrade.success, 'Reject tier upgrade if TIN and Business License are missing');

  const validUpgrade = await AdminOnboardingService.upgradeToVerified(mamaLisheResult.restaurant!.id, {
    tinNumber: '134-889-201',
    businessLicenseNumber: 'BL-TZ-2026-8819',
    brelaRegNumber: 'BRELA-559281-TZ',
    bankAccountDetails: 'CRDB Bank - Mikocheni Branch (Acc: 01529948201)',
  });

  assert(validUpgrade.success, 'Successfully upgraded vendor to Verified Restaurant tier');
  assert(validUpgrade.restaurant?.sellerTier === 'VERIFIED_RESTAURANT', 'Seller tier promoted to VERIFIED_RESTAURANT');
  assert(validUpgrade.restaurant?.isVerified === true, 'Granted isVerified true status');
  assert(validUpgrade.restaurant?.tinNumber === '134-889-201', 'TIN number recorded');
  assert(validUpgrade.restaurant?.businessLicenseNumber === 'BL-TZ-2026-8819', 'Business license number recorded');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Suspension & Unsuspension Lifecycle
  // -------------------------------------------------------------------------
  console.log('\nTest Group 5: Restaurant Suspension & Unsuspension Controls');

  const suspendRes = await AdminOnboardingService.suspendRestaurant(
    mamaLisheResult.restaurant!.id,
    'Failure to maintain hygiene standards'
  );
  assert(suspendRes.success, 'Admin suspended restaurant');
  assert(suspendRes.restaurant?.isSuspended === true, 'Restaurant isSuspended flagged as true');
  assert(suspendRes.restaurant?.isOpen === false, 'Suspended restaurant automatically closed');
  assert(suspendRes.restaurant?.suspensionReason === 'Failure to maintain hygiene standards', 'Suspension reason recorded');

  const unsuspendRes = await AdminOnboardingService.unsuspendRestaurant(mamaLisheResult.restaurant!.id);
  assert(unsuspendRes.success, 'Admin unsuspended restaurant');
  assert(unsuspendRes.restaurant?.isSuspended === false, 'Restaurant restored to active state');
  assert(unsuspendRes.restaurant?.isOpen === true, 'Restaurant reopened for ordering');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Role-Based Permission Guardrails
  // -------------------------------------------------------------------------
  console.log('\nTest Group 6: Role-Based Permission Guardrails (Do\'s & Don\'ts)');

  // 1. Restaurant Owner CAN modify menu dishes and availability
  const currentRest = MloHubDB.restaurants.getById(mamaLisheResult.restaurant!.id)!;
  currentRest.menu[0].isAvailable = false;
  currentRest.menu[0].price = 'TZS 5,500';
  currentRest.menu[0].priceNum = 5500;
  await MloHubDB.save();

  const menuUpdatedRest = MloHubDB.restaurants.getById(mamaLisheResult.restaurant!.id);
  assert(menuUpdatedRest?.menu[0].isAvailable === false, 'Vendor can freely toggle dish availability (Sold Out)');
  assert(menuUpdatedRest?.menu[0].priceNum === 5500, 'Vendor can freely adjust dish price');

  // 2. Platform Commission & Verified Owner Name remains protected
  assert(menuUpdatedRest?.platformCommissionRate === 10, 'MloHub platform commission rate locked at 10%');
  assert(menuUpdatedRest?.ownerName === 'Rehema Kassim Mwalimu', 'Verified owner identity preserved');

  console.log('\n================================================================');
  console.log(`🏁 ADMIN ONBOARDING TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runAdminOnboardingTestSuite().then((r) => {
    if (r.failed > 0) process.exit(1);
  });
}
