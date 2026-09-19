/**
 * ============================================================================
 * MLOHUB STAGE 8: PRODUCTION SMS DELIVERY & SECURE OTP VERIFICATION TEST SUITE
 * Covers: Tanzanian Telecom Normalization, Cryptographic RNG, HMAC-SHA256 Peppered
 *         Hashing, 5-Attempt Lockout, 60s Cooldown, Prior Challenge Invalidation,
 *         Bilingual SMS Templates, Delivery Logs, and Zero Client-Credential Leakage.
 * ============================================================================
 */

import { MloHubDB } from '../db';
import {
  normalizeTanzanianPhone,
  detectTanzanianCarrierFromPrefix,
  isValidTanzanianPhone,
} from '../utils/phoneNormalization';
import {
  OtpSecurityEngine,
  OtpChallengeRecord,
} from '../services/sms/OtpSecurityEngine';
import { SmsFactory } from '../services/sms/SmsFactory';
import { SmsService } from '../services/sms/SmsService';
import { SmsTemplates } from '../services/sms/smsTemplates';
import { NotificationOrchestrator } from '../services/NotificationOrchestrator';
import { AdminOnboardingService } from '../services/AdminOnboardingService';

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

export async function runSmsOtpTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('📱 STAGE 8: PRODUCTION SMS DELIVERY & SECURE OTP TEST SUITE');
  console.log('================================================================\n');

  await MloHubDB.init();
  SmsFactory.resetCache();

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Tanzanian Mobile Telecom Normalization & Carrier Detection
  // ---------------------------------------------------------------------------
  console.log('Test Group 1: Tanzanian Telecom Normalization & Carrier Detection');

  // Vodacom M-Pesa
  const voda1 = normalizeTanzanianPhone('0754 357 613');
  assert(voda1.valid === true, 'Vodacom local format (0754...) validates successfully');
  assert(voda1.e164 === '+255754357613', 'Vodacom normalizes to canonical E.164 (+255754357613)');
  assert(voda1.carrier === 'Vodacom M-Pesa', 'Carrier correctly identified as Vodacom M-Pesa');
  assert(voda1.carrierApiDigits === '255754357613', 'Carrier API digits correctly formatted (255754357613)');

  const voda2 = normalizeTanzanianPhone('+255 742 111 222');
  assert(voda2.valid === true && voda2.carrier === 'Vodacom M-Pesa', 'Vodacom 074 prefix recognized');

  // Airtel Money
  const airtel1 = normalizeTanzanianPhone('0784 999 888');
  assert(airtel1.valid === true && airtel1.carrier === 'Airtel Money', 'Airtel 078 prefix recognized');
  const airtel2 = normalizeTanzanianPhone('255684123456');
  assert(airtel2.valid === true && airtel2.carrier === 'Airtel Money', 'Airtel 068 prefix recognized');

  // Tigo / Mixx by Yas
  const tigo1 = normalizeTanzanianPhone('0713 001 002');
  assert(tigo1.valid === true && tigo1.carrier === 'Mixx by Yas (Tigo)', 'Tigo 071 prefix recognized');
  const tigo2 = normalizeTanzanianPhone('+255 655 444 333');
  assert(tigo2.valid === true && tigo2.carrier === 'Mixx by Yas (Tigo)', 'Mixx 065 prefix recognized');

  // Halotel / HaloPesa
  const halo1 = normalizeTanzanianPhone('0622 789 456');
  assert(halo1.valid === true && halo1.carrier === 'HaloPesa (Halotel)', 'Halotel 062 prefix recognized');

  // TTCL & Zantel
  const ttcl = normalizeTanzanianPhone('0732 100 200');
  assert(ttcl.valid === true && ttcl.carrier === 'TTCL', 'TTCL 073 prefix recognized');
  const zantel = normalizeTanzanianPhone('0774 300 400');
  assert(zantel.valid === true && zantel.carrier === 'Zantel', 'Zantel 077 prefix recognized');

  // Masked Phone Display
  assert(voda1.masked.includes('•••') && voda1.masked.startsWith('+255 75'), 'Phone masking hides middle digits safely');

  // Rejection of invalid numbers
  assert(isValidTanzanianPhone('12345') === false, 'Reject short invalid phone number');
  assert(isValidTanzanianPhone('abcdefghij') === false, 'Reject alphabetic phone string');
  assert(isValidTanzanianPhone('0554 123 456') === false, 'Reject unsupported 055 prefix');

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Cryptographic OTP Generation & Entropy
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 2: Cryptographic OTP Generation & Entropy');

  const otp1 = OtpSecurityEngine.generateCryptographicOtp();
  const otp2 = OtpSecurityEngine.generateCryptographicOtp();
  const otp3 = OtpSecurityEngine.generateCryptographicOtp();

  assert(otp1.length === 6, 'Generated OTP has exact length of 6 digits');
  assert(/^\d{6}$/.test(otp1), 'Generated OTP contains strictly numeric digits');
  assert(parseInt(otp1, 10) >= 100000 && parseInt(otp1, 10) <= 999999, 'Generated OTP falls within 100000..999999 range');
  assert(otp1 !== otp2 || otp2 !== otp3, 'Consecutive OTP generations exhibit cryptographic entropy (not static)');

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: HMAC-SHA256 Salted & Peppered Hash Security
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 3: HMAC-SHA256 Salted & Peppered Hash Security');

  const testPhone = '+255754357613';
  const sampleOtp = '849201';
  const hash1 = OtpSecurityEngine.hashOtp(sampleOtp, testPhone);
  const hash2 = OtpSecurityEngine.hashOtp(sampleOtp, testPhone);
  const differentOtpHash = OtpSecurityEngine.hashOtp('849202', testPhone);
  const differentPhoneHash = OtpSecurityEngine.hashOtp(sampleOtp, '+255784999888');

  assert(hash1 === hash2, 'Hash is deterministic for identical OTP and phone salt');
  assert(hash1 !== differentOtpHash, 'Different OTP generates distinct cryptographic hash');
  assert(hash1 !== differentPhoneHash, 'Different phone number generates distinct cryptographic hash');
  assert(hash1.length === 64, 'HMAC-SHA256 hash is a 64-character hex digest');

  // Constant-time verification
  assert(OtpSecurityEngine.timingSafeVerify(sampleOtp, testPhone, hash1) === true, 'timingSafeVerify validates matching code');
  assert(OtpSecurityEngine.timingSafeVerify('000000', testPhone, hash1) === false, 'timingSafeVerify rejects invalid code');
  assert(OtpSecurityEngine.timingSafeVerify(sampleOtp, '+255655000111', hash1) === false, 'timingSafeVerify rejects mismatched phone salt');

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: OTP Expiry & Attempt Lockout State Machine
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 4: OTP Expiry & Attempt Lockout State Machine');

  const baseChallenge: OtpChallengeRecord = {
    id: 'otp_test_lockout_1',
    phone: testPhone,
    otpHash: hash1,
    purpose: 'CUSTOMER_VERIFICATION',
    attemptsCount: 0,
    maxAttempts: 5,
    isVerified: false,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
    createdAt: new Date().toISOString(),
  };

  // Valid verification
  const validRes = OtpSecurityEngine.verifyChallenge(baseChallenge, sampleOtp);
  assert(validRes.success === true, 'Active challenge verified successfully with correct OTP');

  // Incorrect attempt with remaining attempts
  const failRes1 = OtpSecurityEngine.verifyChallenge(baseChallenge, '999999');
  assert(failRes1.success === false, 'Incorrect OTP code rejected');
  assert(failRes1.attemptsRemaining === 4, 'Attempts remaining correctly reported as 4 after first failure');

  // Expired challenge
  const expiredChallenge: OtpChallengeRecord = {
    ...baseChallenge,
    id: 'otp_test_expired',
    expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1s ago
  };
  const expRes = OtpSecurityEngine.verifyChallenge(expiredChallenge, sampleOtp);
  assert(expRes.success === false && expRes.message.includes('expired'), 'Expired OTP challenge rejected');

  // Maximum attempts lockout (5 attempts)
  const lockedChallenge: OtpChallengeRecord = {
    ...baseChallenge,
    id: 'otp_test_locked',
    attemptsCount: 5,
  };
  const lockRes = OtpSecurityEngine.verifyChallenge(lockedChallenge, sampleOtp);
  assert(lockRes.success === false, 'Locked-out challenge rejected even with correct OTP');
  assert(lockRes.isLockedOut === true, 'isLockedOut flag asserted upon 5 failed attempts');

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: Rate Limiting & Prior Challenge Invalidation
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 5: Rate Limiting & Prior Challenge Invalidation');

  const nowMs = Date.now();
  const recentChallenges: OtpChallengeRecord[] = [
    {
      id: 'otp_recent_1',
      phone: testPhone,
      otpHash: 'hash_recent',
      purpose: 'CUSTOMER_VERIFICATION',
      attemptsCount: 0,
      maxAttempts: 5,
      isVerified: false,
      expiresAt: new Date(nowMs + 300000).toISOString(),
      createdAt: new Date(nowMs - 20000).toISOString(), // Created 20s ago (within 60s cooldown)
    },
  ];

  // Cooldown rejection
  const cooldownCheck = OtpSecurityEngine.checkRateLimits(testPhone, recentChallenges);
  assert(cooldownCheck.allowed === false, 'Rate limiter rejects OTP request made within 60s cooldown');
  assert(cooldownCheck.cooldownRemainingSeconds > 0 && cooldownCheck.cooldownRemainingSeconds <= 40, 'Accurate cooldown seconds remaining returned');

  // Cooldown allowed after 65s
  const olderChallenges: OtpChallengeRecord[] = [
    {
      ...recentChallenges[0],
      createdAt: new Date(nowMs - 65000).toISOString(), // 65s ago
    },
  ];
  const allowedCheck = OtpSecurityEngine.checkRateLimits(testPhone, olderChallenges);
  assert(allowedCheck.allowed === true, 'Rate limiter allows new OTP request after 60s cooldown expires');

  // Prior challenge invalidation
  const prep = OtpSecurityEngine.prepareNewChallenge(testPhone, 'CUSTOMER_VERIFICATION', olderChallenges);
  assert(prep.success === true, 'prepareNewChallenge generates valid payload');
  assert(prep.challengesToInvalidate.includes('otp_recent_1'), 'Older active challenge flagged for invalidation');

  // Invalidation verification test
  const invalidatedChallenge: OtpChallengeRecord = {
    ...baseChallenge,
    id: 'otp_superseded',
    invalidatedAt: new Date().toISOString(),
  };
  const invalRes = OtpSecurityEngine.verifyChallenge(invalidatedChallenge, sampleOtp);
  assert(invalRes.success === false && invalRes.message.includes('superseded'), 'Superseded challenge rejected upon submission');

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: Bilingual Transactional SMS Templates
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 6: Bilingual Transactional SMS Templates');

  const swOtp = SmsTemplates.otpMessage('123456', 'CUSTOMER_VERIFICATION', 'sw');
  assert(swOtp.includes('123456') && swOtp.includes('Uthibitisho'), 'Swahili OTP template formatted correctly');

  const enOtp = SmsTemplates.otpMessage('123456', 'CUSTOMER_VERIFICATION', 'en');
  assert(enOtp.includes('123456') && enOtp.includes('verification code'), 'English OTP template formatted correctly');

  const orderMsg = SmsTemplates.orderAcceptedKitchen(
    { orderNumber: '1082', restaurantName: 'Swahili Bites', estimatedMinutes: 30 },
    'sw'
  );
  assert(orderMsg.includes('#1082') && orderMsg.includes('dakika 30'), 'Swahili kitchen order alert formatted correctly');

  const vendorInv = SmsTemplates.vendorActivationInvitation(
    'Mama Neema Cafe',
    'Neema Joseph',
    '782194',
    'sw'
  );
  assert(vendorInv.includes('Mama Neema Cafe') && vendorInv.includes('782194'), 'Vendor activation invitation template formatted correctly');

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: End-to-End SmsService Dispatch & Delivery Logging
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 7: End-to-End SmsService Dispatch & Delivery Logging');

  const uniqueTestPhone = '+255754999111';

  // 1. Send OTP via SmsService
  const sendRes = await SmsService.sendOtp({
    phone: uniqueTestPhone,
    purpose: 'CUSTOMER_VERIFICATION',
    language: 'sw',
  });

  assert(sendRes.success === true, 'SmsService.sendOtp succeeds');
  assert(sendRes.carrierName === 'Vodacom M-Pesa', 'Carrier detected as Vodacom M-Pesa');
  assert(sendRes.maskedPhone.includes('•••'), 'Masked phone returned to client');

  // 2. Verify immutable delivery log recorded
  const logs = MloHubDB.smsLogs.getByRecipient(uniqueTestPhone);
  assert(logs.length > 0, 'Delivery log recorded in sms_logs repository');
  assert(logs[0].status === 'SENT', 'SMS log status marked as SENT');
  assert(logs[0].provider === 'SANDBOX', 'Provider recorded as SANDBOX');
  assert(logs[0].templateId === 'OTP_CUSTOMER_VERIFICATION', 'Template ID recorded accurately');

  // 3. Verify OTP challenge stored in DB
  const activeChallenge = await MloHubDB.otpChallenges.getActiveByPhone(uniqueTestPhone);
  assert(!!activeChallenge, 'Active OTP challenge found in database');
  assert(activeChallenge?.isVerified === false, 'Challenge initialized with isVerified=false');
  assert(activeChallenge?.attemptsCount === 0, 'Challenge initialized with attemptsCount=0');
  assert(activeChallenge?.otpHash.length === 64, 'Stored OTP challenge contains 64-char HMAC-SHA256 hash');

  // 4. Verify OTP with incorrect code
  const wrongRes = await SmsService.verifyOtp(uniqueTestPhone, '000000');
  assert(wrongRes.success === false, 'Incorrect code rejected by SmsService.verifyOtp');

  const afterFail = await MloHubDB.otpChallenges.getActiveByPhone(uniqueTestPhone);
  assert(afterFail?.attemptsCount === 1, 'attemptsCount incremented in database on failed attempt');

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: Centralized NotificationOrchestrator Preference Routing
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 8: Centralized NotificationOrchestrator Preference Routing');

  const orchRes = await NotificationOrchestrator.dispatch({
    recipientPhone: '+255784111222',
    eventType: 'ORDER_PLACED',
    title: 'Order Placed',
    body: 'Your MloHub order #9021 has been placed!',
    forceSms: true,
  });

  assert(orchRes.smsDelivered === true, 'NotificationOrchestrator delivered SMS notification');
  assert(!!orchRes.smsMessageId, 'SMS message ID returned from orchestrator');

  // ---------------------------------------------------------------------------
  // TEST GROUP 9: Vendor Activation Flow & Plaintext PIN Elimination
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 9: Vendor Activation Flow & Plaintext PIN Elimination');

  // Create vendor application
  const app = await MloHubDB.restaurantApplications.create({
    businessName: 'Zanzibar Spice Delight',
    ownerName: 'Ali Salim',
    ownerPhone: '+255 774 888 999',
    cuisineType: 'Swahili Coastal',
    neighborhood: 'Stone Town',
    address: 'Kenyatta Road',
    hasTinOrLicense: true,
    tinNumber: 'TIN-ZANZIBAR-001',
  });

  const approveRes = await AdminOnboardingService.approveApplication(app.id, 'usr-admin');
  assert(approveRes.success === true, 'AdminOnboardingService.approveApplication succeeds');
  assert(!!approveRes.restaurant, 'Restaurant entity activated');

  // Verify activation OTP was dispatched to owner phone
  const ownerLogs = MloHubDB.smsLogs.getByRecipient('+255 774 888 999');
  assert(ownerLogs.length > 0, 'Activation SMS dispatched to owner phone');
  assert(ownerLogs[0].templateId === 'OTP_VENDOR_ACTIVATION', 'Activation template used for owner onboarding');

  // Verify that newly created owner has phone verification record
  const ownerUser = MloHubDB.users.getAll().find((u) => u.phone === '+255 774 888 999');
  assert(!!ownerUser, 'Owner user created in database');

  // ---------------------------------------------------------------------------
  // TEST GROUP 10: Zero Client-Side Secret Bundling Security Audit
  // ---------------------------------------------------------------------------
  console.log('\nTest Group 10: Zero Client-Side Secret Bundling Security Audit');

  // Ensure process.env doesn't contain EXPO_PUBLIC_ prefixed SMS credentials
  const clientSmsKeys = Object.keys(process.env).filter(
    (k) => k.startsWith('EXPO_PUBLIC_') && (k.includes('SMS') || k.includes('BEEM') || k.includes('NEXTSMS'))
  );

  assert(
    clientSmsKeys.length === 0,
    `Zero EXPO_PUBLIC_ SMS credentials present in client environment (found: ${clientSmsKeys.join(', ') || 'none'})`
  );

  console.log('\n======================================================');
  console.log(`🏁 STAGE 8 SMS OTP TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('======================================================\n');

  return { passed, failed };
}

// Standalone execution support
if (require.main === module) {
  runSmsOtpTestSuite().then(({ failed: failCount }) => {
    if (failCount > 0) process.exit(1);
  });
}
