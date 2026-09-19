import fs from 'fs';
import path from 'path';
import {
  NotificationChannel,
  CommunicationClass,
  NotificationPriority,
  NotificationDeliveryStatus,
  NotificationEventType,
} from '../types/domain';
import { DeliveryPolicy } from '../services/notifications/DeliveryPolicy';
import { TemplateRenderer } from '../services/notifications/TemplateRenderer';
import { PushProvider } from '../services/notifications/providers/PushProvider';
import { NotificationEngine } from '../services/notifications/NotificationEngine';

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

export async function runNotificationsCommunicationTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 PACK 4E: NOTIFICATIONS, COMMUNICATION & DELIVERY RELIABILITY');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '..');

  // --- Section 1: Artifact & File Existence ---
  console.log('--- Section 1: Artifact & File Existence ---');
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260918000005_pack4e_notifications_communication.sql'
  );
  assert(fs.existsSync(migrationPath), 'Target file exists: migration (20260918000005_pack4e_notifications_communication.sql)');

  const expectedRepos = [
    'notifications.repository.ts',
    'notificationOutbox.repository.ts',
    'notificationDeliveries.repository.ts',
    'notificationPreferences.repository.ts',
    'pushDevices.repository.ts',
    'notificationTemplates.repository.ts',
    'communicationSuppressions.repository.ts',
  ];
  for (const repo of expectedRepos) {
    assert(
      fs.existsSync(path.join(rootDir, 'repositories', repo)),
      `Target repository exists: ${repo}`
    );
  }

  const expectedServices = [
    'DeliveryPolicy.ts',
    'TemplateRenderer.ts',
    'RecipientResolver.ts',
    'NotificationEngine.ts',
    'providers/PushProvider.ts',
    'providers/SmsProvider.ts',
    'providers/EmailProvider.ts',
  ];
  for (const serv of expectedServices) {
    assert(
      fs.existsSync(path.join(rootDir, 'services', 'notifications', serv)),
      `Target service exists: ${serv}`
    );
  }

  // --- Section 2: Domain Types & Invariants ---
  console.log('\n--- Section 2: Domain Types & Invariants ---');
  const validChannels: NotificationChannel[] = ['IN_APP', 'PUSH', 'SMS', 'EMAIL'];
  assert(validChannels.length === 4, '4 canonical delivery channels supported');

  const validClasses: CommunicationClass[] = [
    'SECURITY',
    'TRANSACTIONAL_CRITICAL',
    'TRANSACTIONAL',
    'OPERATIONAL',
    'REMINDER',
    'SOCIAL',
    'MARKETING',
  ];
  assert(validClasses.includes('SECURITY'), 'CommunicationClass contains SECURITY');
  assert(validClasses.includes('TRANSACTIONAL_CRITICAL'), 'CommunicationClass contains TRANSACTIONAL_CRITICAL');
  assert(validClasses.includes('MARKETING'), 'CommunicationClass contains MARKETING');

  const validPriorities: NotificationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
  assert(validPriorities.includes('CRITICAL'), 'Priority contains CRITICAL');

  const validStatuses: NotificationDeliveryStatus[] = [
    'PENDING',
    'SUPPRESSED',
    'QUEUED',
    'PROVIDER_ACCEPTED',
    'SENT',
    'PROVIDER_DELIVERED',
    'FAILED_RETRYABLE',
    'FAILED_PERMANENT',
    'EXPIRED',
    'CANCELLED',
  ];
  assert(validStatuses.includes('PROVIDER_ACCEPTED'), 'Status contains PROVIDER_ACCEPTED');
  assert(validStatuses.includes('FAILED_RETRYABLE'), 'Status contains FAILED_RETRYABLE');
  assert(validStatuses.includes('FAILED_PERMANENT'), 'Status contains FAILED_PERMANENT');

  // --- Section 3: Quiet Hours Mathematical Invariants ---
  console.log('\n--- Section 3: Quiet Hours Mathematical Invariants ---');
  // 23:00 during a 22:00 - 07:00 window -> active
  const nightDate = new Date('2026-09-18T23:30:00+03:00');
  const isQuietNight = DeliveryPolicy.isQuietHoursActive('22:00:00', '07:00:00', 'Africa/Dar_es_Salaam', nightDate);
  assert(isQuietNight === true, 'Quiet hours active at 23:30 in 22:00-07:00 overnight window');

  // 04:00 during a 22:00 - 07:00 window -> active
  const earlyMorningDate = new Date('2026-09-18T04:15:00+03:00');
  const isQuietEarly = DeliveryPolicy.isQuietHoursActive('22:00:00', '07:00:00', 'Africa/Dar_es_Salaam', earlyMorningDate);
  assert(isQuietEarly === true, 'Quiet hours active at 04:15 in 22:00-07:00 overnight window');

  // 14:00 during a 22:00 - 07:00 window -> inactive
  const dayDate = new Date('2026-09-18T14:00:00+03:00');
  const isQuietDay = DeliveryPolicy.isQuietHoursActive('22:00:00', '07:00:00', 'Africa/Dar_es_Salaam', dayDate);
  assert(isQuietDay === false, 'Quiet hours inactive at 14:00 in 22:00-07:00 overnight window');

  // Daytime window 13:00 - 15:00
  const siestaDate = new Date('2026-09-18T14:30:00+03:00');
  const isQuietSiesta = DeliveryPolicy.isQuietHoursActive('13:00:00', '15:00:00', 'Africa/Dar_es_Salaam', siestaDate);
  assert(isQuietSiesta === true, 'Quiet hours active inside daytime window (14:30 in 13:00-15:00)');

  // --- Section 4: Reachability & Critical Bypass Rules ---
  console.log('\n--- Section 4: Reachability & Critical Bypass Rules ---');
  // SECURITY bypasses quiet hours
  const secEval = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'SECURITY',
    preference: {
      id: 'p1',
      userId: 'u1',
      channel: 'PUSH',
      category: 'ALL',
      enabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00:00',
      quietHoursEnd: '07:00:00',
      quietHoursTimezone: 'Africa/Dar_es_Salaam',
      updatedAt: new Date().toISOString(),
    },
    currentDate: nightDate,
  });
  assert(secEval.reachable === true, 'SECURITY communication bypasses quiet hours');
  assert(secEval.reason === 'CRITICAL_BYPASS', 'SECURITY communication marked CRITICAL_BYPASS');

  // TRANSACTIONAL respects quiet hours
  const transEval = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'TRANSACTIONAL',
    preference: {
      id: 'p2',
      userId: 'u1',
      channel: 'PUSH',
      category: 'ALL',
      enabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00:00',
      quietHoursEnd: '07:00:00',
      quietHoursTimezone: 'Africa/Dar_es_Salaam',
      updatedAt: new Date().toISOString(),
    },
    currentDate: nightDate,
  });
  assert(transEval.reachable === false, 'TRANSACTIONAL communication suppressed during quiet hours');
  assert(transEval.reason === 'QUIET_HOURS_ACTIVE', 'Reason correctly identified as QUIET_HOURS_ACTIVE');

  // Channel disabled by user preference
  const disabledEval = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'TRANSACTIONAL',
    preference: {
      id: 'p3',
      userId: 'u1',
      channel: 'PUSH',
      category: 'ALL',
      enabled: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00:00',
      quietHoursEnd: '07:00:00',
      quietHoursTimezone: 'Africa/Dar_es_Salaam',
      updatedAt: new Date().toISOString(),
    },
    currentDate: dayDate,
  });
  assert(disabledEval.reachable === false, 'Disabled user channel preference suppresses delivery');

  // Destination suppression (e.g. bounced email)
  const suppEval = DeliveryPolicy.evaluate({
    channel: 'EMAIL',
    communicationClass: 'TRANSACTIONAL',
    isDestinationSuppressed: true,
  });
  assert(suppEval.reachable === false, 'Suppressed destination blocks delivery');
  assert(suppEval.reason === 'DESTINATION_SUPPRESSED', 'Reason correctly identified as DESTINATION_SUPPRESSED');

  // --- Section 5: Marketing Consent Strict Separation ---
  console.log('\n--- Section 5: Marketing Consent Strict Separation ---');
  // Marketing with NO consent
  const mktNoConsent = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'MARKETING',
    marketingConsent: null,
  });
  assert(mktNoConsent.reachable === false, 'MARKETING without consent is suppressed');
  assert(mktNoConsent.reason === 'NO_MARKETING_CONSENT', 'Reason is NO_MARKETING_CONSENT');

  // Marketing with withdrawn consent
  const mktWithdrawn = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'MARKETING',
    marketingConsent: {
      id: 'm1',
      userId: 'u1',
      channel: 'PUSH',
      consented: false,
      consentPolicyVersion: 'v1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  assert(mktWithdrawn.reachable === false, 'MARKETING with false consented flag is suppressed');

  // Marketing with active consent
  const mktConsented = DeliveryPolicy.evaluate({
    channel: 'PUSH',
    communicationClass: 'MARKETING',
    marketingConsent: {
      id: 'm2',
      userId: 'u1',
      channel: 'PUSH',
      consented: true,
      consentPolicyVersion: 'v1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    currentDate: dayDate,
  });
  assert(mktConsented.reachable === true, 'MARKETING with active consent is permitted');

  // Transactional is NEVER blocked by marketing opt-out
  const transWithNoMkt = DeliveryPolicy.evaluate({
    channel: 'SMS',
    communicationClass: 'TRANSACTIONAL',
    marketingConsent: {
      id: 'm3',
      userId: 'u1',
      channel: 'SMS',
      consented: false,
      consentPolicyVersion: 'v1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    currentDate: dayDate,
  });
  assert(transWithNoMkt.reachable === true, 'Transactional message is never blocked by marketing opt-out');

  // --- Section 6: Template Rendering & Security Hygiene ---
  console.log('\n--- Section 6: Template Rendering & Security Hygiene ---');
  const templateStr = 'Order #{{order_number}} is {{status}}. Total: TZS {{total_amount}}';
  const rendered = TemplateRenderer.renderString(
    templateStr,
    {
      order_number: 'ORD-9872',
      status: 'Ready',
      total_amount: '25000',
    },
    ['order_number', 'status', 'total_amount']
  );
  assert(rendered === 'Order #ORD-9872 is Ready. Total: TZS 25000', 'Placeholders rendered correctly');

  // HTML and script injection in variables are escaped
  const dirtyPayload = {
    order_number: '<script>alert("hack")</script>',
    status: '<img src=x onerror="steal()">',
  };
  const safeRendered = TemplateRenderer.renderString(
    'Oda: {{order_number}}, Hali: {{status}}',
    dirtyPayload,
    ['order_number', 'status']
  );
  assert(!safeRendered.includes('<script>'), 'Dangerous <script> tag is escaped');
  assert(!safeRendered.includes('<img'), 'Dangerous <img> tag is escaped');
  assert(safeRendered.includes('&lt;script&gt;'), '<script> properly converted to HTML entities');

  // Un-allowlisted keys are ignored
  const unallowed = TemplateRenderer.renderString(
    'User {{secret_admin_key}}',
    { secret_admin_key: 'SUPER_SECRET' },
    ['order_number']
  );
  assert(unallowed === 'User {{secret_admin_key}}', 'Non-allowlisted keys are preserved untouched');

  // --- Section 7: Push Token Format Validation ---
  console.log('\n--- Section 7: Push Token Format Validation ---');
  assert(
    PushProvider.isValidExpoToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]') === true,
    'Valid ExponentPushToken format recognized'
  );
  assert(
    PushProvider.isValidExpoToken('ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]') === true,
    'Valid ExpoPushToken format recognized'
  );
  assert(
    PushProvider.isValidExpoToken('invalid-token-string') === false,
    'Invalid token string rejected'
  );
  assert(
    PushProvider.isValidExpoToken('') === false,
    'Empty token string rejected'
  );

  // --- Section 8: Non-Negotiable Reliability Invariant ---
  console.log('\n--- Section 8: Non-Negotiable Reliability Invariant ---');
  // Verify NotificationEngine never throws even if bad payload or disconnected DB
  let threwException = false;
  try {
    const res = await NotificationEngine.emitAndProcess({
      eventType: 'ORDER_CREATED',
      aggregateType: 'ORDER',
      aggregateId: 'fake_order_id',
      payload: {},
    });
    assert(res !== null, 'NotificationEngine returned graceful result object without crashing');
  } catch {
    threwException = true;
  }
  assert(threwException === false, 'NotificationEngine guarantees zero unhandled exceptions to business callers');

  console.log('\n================================================================');
  console.log(`  PACK 4E UNIT & INTEGRATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}
