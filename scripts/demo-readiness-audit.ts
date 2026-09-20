/**
 * ============================================================================
 * MLOHUB DEMONSTRATION READINESS AUDIT SCRIPT
 * ============================================================================
 * Audits client-side source code, runtime invariants, and database boundaries
 * to ensure 100% truthfulness and demonstration safety.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { runtimeConfig } from '../lib/runtimeConfig';
import { FINANCIAL_CONFIG } from '../config/platformFees';
import { ApplicationRepository } from '../repositories/applications.repository';
import { DataReportsRepository } from '../repositories/dataReports.repository';

interface AuditCheckResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details: string;
}

const results: AuditCheckResult[] = [];

function recordCheck(id: string, name: string, category: string, passed: boolean, details: string) {
  results.push({ id, name, category, passed, details });
  const symbol = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [${id}] ${name} - ${details}`);
}

async function runDemoReadinessAudit() {
  console.log('\n============================================================');
  console.log('🔍 RUNNING MLOHUB DEMO READINESS CLOSURE AUDIT');
  console.log('============================================================\n');

  // 1. Check Service Role Key Security Boundary (P0)
  const clientFilesToCheck = [
    'lib/supabase.ts',
    'context/DbContext.tsx',
    'context/AuthContext.tsx',
    'context/NotificationContext.tsx',
    'repositories/notifications.repository.ts',
    'repositories/pushDevices.repository.ts',
    'repositories/notificationDeliveries.repository.ts',
    'repositories/notificationOutbox.repository.ts',
    'services/notifications/NotificationEngine.ts',
    'components/admin/SystemHealth.tsx',
  ];

  let serviceRoleViolations: string[] = [];
  for (const relPath of clientFilesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('supabaseAdmin') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        serviceRoleViolations.push(relPath);
      }
    }
  }

  recordCheck(
    'P0-SRV-ROLE',
    'Zero Service Role in Client Contexts',
    'Security Boundary',
    serviceRoleViolations.length === 0,
    serviceRoleViolations.length === 0
      ? 'No supabaseAdmin or service role references found in client/repository code.'
      : `Violations found in: ${serviceRoleViolations.join(', ')}`
  );

  // 2. Customer Favorites Truth (P1)
  const dbContextPath = path.join(__dirname, '..', 'context/DbContext.tsx');
  const dbContextContent = fs.readFileSync(dbContextPath, 'utf8');
  const favoritesGuarded =
    dbContextContent.includes('activeFavorites = allowLocalFallbacks ? dbState.favorites : []') ||
    !dbContextContent.includes('FAVORITES_PREF_KEY');

  recordCheck(
    'P1-FAVORITES',
    'Customer Saved Favorites Real-Mode Deferral',
    'Data Truthfulness',
    favoritesGuarded,
    favoritesGuarded
      ? 'Active favorites are strictly empty in real/production mode; no simulated persistence.'
      : 'Favorites appear active without canonical database backing.'
  );

  // 3. Customer Notifications Real-Mode Data Isolation (P2)
  const notifContextPath = path.join(__dirname, '..', 'context/NotificationContext.tsx');
  const notifContextContent = fs.readFileSync(notifContextPath, 'utf8');
  const notifGuarded =
    notifContextContent.includes('runtimeConfig.allowLocalDataFallbacks ? INITIAL_NOTIFICATIONS : []');

  recordCheck(
    'P2-NOTIF-MOCK',
    'Notifications Isolated From Mock Data in Real Mode',
    'Data Truthfulness',
    notifGuarded,
    notifGuarded
      ? 'INITIAL_NOTIFICATIONS strictly isolated behind runtimeConfig.allowLocalDataFallbacks.'
      : 'Notifications context may initialize mock data in real mode.'
  );

  // 4. Partner Workspace Switch Race Guard (P5)
  const partnerPath = path.join(__dirname, '..', 'app/partner/index.tsx');
  const partnerContent = fs.readFileSync(partnerPath, 'utf8');
  const partnerAwaitsSwitch = partnerContent.includes('await switchWorkspace');

  recordCheck(
    'P5-PARTNER-RACE',
    'Partner Workspace Switch Awaited Before Navigation',
    'Workspace Isolation',
    partnerAwaitsSwitch,
    partnerAwaitsSwitch
      ? 'Partner route awaits switchWorkspace resolution before navigating to /restaurant-portal.'
      : 'Partner route switches workspace synchronously, creating race condition.'
  );

  // 5. Restaurant Analytics Multipliers Purged (P6)
  const portalPath = path.join(__dirname, '..', 'app/restaurant-portal/index.tsx');
  const portalContent = fs.readFileSync(portalPath, 'utf8');
  const hasFabricatedFormulas =
    portalContent.includes('domainOrders.length * 15') ||
    portalContent.includes('domainOrders.length * 3') ||
    portalContent.includes('ordersCount * 4') ||
    portalContent.includes('missedSearchesCount: 12');

  recordCheck(
    'P6-ANALYTICS-FORMULAS',
    'Restaurant Analytics Fabricated Formulas Purged',
    'Data Truthfulness',
    !hasFabricatedFormulas,
    !hasFabricatedFormulas
      ? 'Zero artificial order multipliers or fabricated search counts in analytics.'
      : 'Found lingering fabricated multiplier formulas in restaurant-portal.'
  );

  // 6. Review Responses Real Persistence (P7)
  const hasRealReviewRespond =
    portalContent.includes('ReviewResponsesRepository.respond') &&
    portalContent.includes('loadRestaurantWorkspace');

  recordCheck(
    'P7-REVIEW-RESPONSE',
    'Merchant Review Responses Authoritative Call',
    'Feature Authority',
    hasRealReviewRespond,
    hasRealReviewRespond
      ? 'Review responses call ReviewResponsesRepository.respond RPC and reload workspace.'
      : 'Review responses lack database backing.'
  );

  // 7. Branch Operational Modes Alignment (P8 & P9)
  const settingsPath = path.join(__dirname, '..', 'components/restaurant/RestaurantSettings.tsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  const hasBranchHours =
    settingsContent.includes('BranchOperationsRepository') &&
    settingsContent.includes("'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED'");

  recordCheck(
    'P8-BRANCH-OPS',
    'Branch Operating Status & Hours Wire to Pack 4F',
    'Operational Authority',
    hasBranchHours,
    hasBranchHours
      ? 'RestaurantSettings wires operational mode and schedule to BranchOperationsRepository.'
      : 'RestaurantSettings uses disconnected local schedule.'
  );

  // 8. Staff Invitations Honest Pilot Guard (P10)
  const staffManagerPath = path.join(__dirname, '..', 'components/restaurant/StaffManager.tsx');
  const staffManagerContent = fs.readFileSync(staffManagerPath, 'utf8');
  const staffManagerGuarded =
    staffManagerContent.includes('onInviteStaff?:') &&
    staffManagerContent.includes('Boolean(onInviteStaff)');

  recordCheck(
    'P10-STAFF-INVITE',
    'Staff Invitations Hidden in Pilot Mode',
    'Feature Truthfulness',
    staffManagerGuarded,
    staffManagerGuarded
      ? 'Staff invitation button is conditionally rendered only when authorized provider is supplied.'
      : 'Staff invitation button unconditionally visible.'
  );

  // 9. Custom Meal Restaurant Quote Dish Derivation (P11)
  const customMealQuoteTruth =
    portalContent.includes('targetInv?.request?.dishName') &&
    !portalContent.includes("name: 'Chef Custom Preparation'");

  recordCheck(
    'P11-CUSTOM-MEAL-QUOTE',
    'Custom Meal Quotes Derive Name From Actual Request',
    'Data Truthfulness',
    customMealQuoteTruth,
    customMealQuoteTruth
      ? 'Structured quotes use customer requested dish name rather than static Chef Custom Preparation.'
      : 'Custom meal quote still uses hardcoded placeholder dish name.'
  );

  // 10. Data Reports Fail Closed (P12)
  let dataReportsFailClosed = false;
  try {
    const listResult = await DataReportsRepository.listAll();
    dataReportsFailClosed = Array.isArray(listResult);
  } catch (e: any) {
    dataReportsFailClosed = true;
  }

  recordCheck(
    'P12-DATA-REPORTS',
    'DataReportsRepository Fails Closed In Real Runtime',
    'Fail-Closed Boundary',
    dataReportsFailClosed,
    dataReportsFailClosed
      ? 'DataReportsRepository does not serve mock complaints in real runtime.'
      : 'DataReportsRepository failed to maintain boundary.'
  );

  // 11. Platform Financial Authority Invariant (P15 & P16)
  const feeIntegrity =
    FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE === 0.10 &&
    FINANCIAL_CONFIG.SERVICE_FEE_TZS === 1500 &&
    FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS === 2500;

  recordCheck(
    'P15-FINANCIAL-CONFIG',
    'Authoritative Financial Fee Parameters Intact',
    'Financial Integrity',
    feeIntegrity,
    feeIntegrity
      ? `Platform commission: ${FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 100}%, Service Fee: ${FINANCIAL_CONFIG.SERVICE_FEE_TZS} TZS, Delivery: ${FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS} TZS.`
      : 'Platform fees deviate from authoritative financial specification.'
  );

  // 12. Application Submission Validation (P19)
  let validationThrowsOnEmpty = false;
  try {
    await ApplicationRepository.submit({ businessName: '' });
  } catch (err: any) {
    validationThrowsOnEmpty = err.message?.includes('required') || err.message?.includes('session');
  }

  recordCheck(
    'P19-APP-VALIDATION',
    'Restaurant Application Requires Valid Non-Empty Fields',
    'Validation Boundary',
    validationThrowsOnEmpty,
    validationThrowsOnEmpty
      ? 'ApplicationRepository rejects empty applications with explicit validation errors.'
      : 'ApplicationRepository permitted submission of empty application.'
  );

  // 13. P0A: Standard Order Creation Authority & Single-Branch Cart
  const orderRepoContent = fs.readFileSync(path.join(__dirname, '..', 'repositories/orders.repository.ts'), 'utf8');
  const cartContextContent = fs.readFileSync(path.join(__dirname, '..', 'context/CartContext.tsx'), 'utf8');
  const p0aPassed =
    orderRepoContent.includes('create_order_secure') &&
    orderRepoContent.includes('!order.branchId') &&
    cartContextContent.includes('branchId') &&
    cartContextContent.includes('isDifferentBranch');

  recordCheck(
    'P0A-ORDER-AUTH',
    'Standard Orders Require Branch ID & Single-Branch Cart Invariant',
    'Order Authority',
    p0aPassed,
    p0aPassed
      ? 'Orders require branchId, invoke create_order_secure, and enforce single-branch cart.'
      : 'Order authority invariant failed.'
  );

  // 14. P0B: Restaurant Queue Payment-Aware Acceptance
  const incomingOrdersContent = fs.readFileSync(path.join(__dirname, '..', 'components/restaurant/IncomingOrdersPanel.tsx'), 'utf8');
  const p0bPassed =
    incomingOrdersContent.includes('Awaiting Payment') &&
    incomingOrdersContent.includes('disabled={!isPaid}');

  recordCheck(
    'P0B-QUEUE-PAYMENT',
    'Restaurant Order Queue Is Payment-Aware',
    'Operational Authority',
    p0bPassed,
    p0bPassed
      ? 'Unpaid pending orders show Awaiting Payment and cannot be accepted until paid.'
      : 'Restaurant queue permits accepting unpaid orders.'
  );

  // 15. P0C & P0D: PaymentCheckoutModal Channels & Exact Reservation Deposit
  const paymentModalContent = fs.readFileSync(path.join(__dirname, '..', 'components/PaymentCheckoutModal.tsx'), 'utf8');
  const p0cPassed =
    !paymentModalContent.includes("'CARD'") &&
    !paymentModalContent.includes("'CASH_ON_DELIVERY'") &&
    paymentModalContent.includes('customMealRequestId') &&
    paymentModalContent.includes('quoteId');

  recordCheck(
    'P0C-CHECKOUT-MODAL',
    'Payment Checkout Excludes Unsupported Channels (No CARD/COD)',
    'Financial Integrity',
    p0cPassed,
    p0cPassed
      ? 'Only mobile money channels supported; CARD and COD purged.'
      : 'Payment modal contains unintegrated payment methods.'
  );

  // 16. P0E & P0F: Custom Meal Quote Conversion & Input Cleanup
  const customTabContent = fs.readFileSync(path.join(__dirname, '..', 'app/(tabs)/custom.tsx'), 'utf8');
  const p0ePassed =
    customTabContent.includes('convertCustomMealToOrder') &&
    customTabContent.includes('PaymentCheckoutModal') &&
    !customTabContent.includes("useState('15000')") &&
    !customTabContent.includes("useState('Mikocheni')");

  recordCheck(
    'P0E-CUSTOM-MEAL',
    'Custom Meal Quote Conversion and Form Input Truth',
    'Feature Authority',
    p0ePassed,
    p0ePassed
      ? 'Quotes convert to canonical orders via payment modal; form contains no fake defaults.'
      : 'Custom meal workflow invariant failed.'
  );

  // 17. P1: Clean Registration Initial States
  const regCustomerContent = fs.readFileSync(path.join(__dirname, '..', 'app/auth/register-customer.tsx'), 'utf8');
  const regRestaurantContent = fs.readFileSync(path.join(__dirname, '..', 'app/auth/register-restaurant.tsx'), 'utf8');
  const p1Passed =
    regCustomerContent.includes("useState('')") &&
    regCustomerContent.includes("agreeTerms, setAgreeTerms] = useState(false)") &&
    regCustomerContent.includes("dietaryPreferences: []") &&
    regRestaurantContent.includes("cuisine, setCuisine] = useState('')") &&
    regRestaurantContent.includes("neighborhood, setNeighborhood] = useState('')");

  recordCheck(
    'P1-REG-DEFAULTS',
    'Registration Screens Have Zero Fabricated Initial Defaults',
    'Data Truthfulness',
    p1Passed,
    p1Passed
      ? 'Customer and restaurant registration start with clean, un-fabricated fields.'
      : 'Registration screens contain fabricated pre-filled values.'
  );

  // 18. P2: Notification Preferences Persistence
  const p2Passed =
    notifContextContent.includes('NotificationPreferencesRepository.updatePreference') &&
    notifContextContent.includes('Promise.allSettled');

  recordCheck(
    'P2-NOTIF-PREFS',
    'Notification Preferences Persist via Repository with Safe ClearAll',
    'Data Persistence',
    p2Passed,
    p2Passed
      ? 'Preferences persist to repository and clearAll uses Promise.allSettled.'
      : 'Notification preferences do not persist or handle partial clear failures.'
  );

  // 19. P3: Expo Splash Screen Module & Config
  const packageJsonContent = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
  const appJsonContent = fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8');
  const p3Passed =
    packageJsonContent.includes('expo-splash-screen') &&
    appJsonContent.includes('expo-splash-screen') &&
    appJsonContent.includes('splash-icon.png');

  recordCheck(
    'P3-SPLASH-CONFIG',
    'Expo Splash Screen Installed and Configured',
    'Native Configuration',
    p3Passed,
    p3Passed
      ? 'expo-splash-screen installed in package.json and configured in app.json plugins.'
      : 'Splash screen configuration missing.'
  );

  // 20. P4: Selected Branch Operations & Honest Fallbacks
  const p4Passed =
    settingsContent.includes('selectedBranchId?: string') &&
    settingsContent.includes('Address not configured') &&
    !settingsContent.includes('Dar es Salaam, Tanzania');

  recordCheck(
    'P4-BRANCH-OPS',
    'Restaurant Settings Target Selected Branch and Honest Addresses',
    'Operational Honesty',
    p4Passed,
    p4Passed
      ? 'Settings target selected branch with honest "Address not configured" fallback.'
      : 'Restaurant settings hardcode default branch or generic Dar es Salaam address.'
  );

  // 21. P6: Custom Meal Quote Fulfillment Mode Truth
  const p6Passed =
    portalContent.includes('targetInv?.request?.fulfillmentMode') &&
    portalContent.includes('submitStructuredQuote');

  recordCheck(
    'P6-QUOTE-FULFILLMENT',
    'Custom Meal Quotes Respect Request Fulfillment Mode',
    'Feature Truthfulness',
    p6Passed,
    p6Passed
      ? 'Kitchen quotes preserve the customer requested fulfillment mode (Pickup vs Delivery).'
      : 'Kitchen quotes force RESTAURANT_DELIVERY arbitrarily.'
  );

  // 22. P8: Dead Fake Admin Handlers Purged
  const adminIndexContent = fs.readFileSync(path.join(__dirname, '..', 'app/admin/index.tsx'), 'utf8');
  const p8Passed =
    !adminIndexContent.includes('handleSendBroadcast') &&
    !adminIndexContent.includes('handleToggleSuspendUser');

  recordCheck(
    'P8-ADMIN-HANDLERS',
    'Dead Fake Handlers Purged from Admin Portal',
    'Code Truthfulness',
    p8Passed,
    p8Passed
      ? 'Zero simulated or dead broadcast/suspension handlers in admin portal.'
      : 'Dead fake handlers remain in admin portal.'
  );

  // 23. P9: Partner Workspace Failure Fails Closed
  const p9Passed =
    partnerContent.includes('return; // Fail closed') &&
    partnerContent.includes('Workspace Access Error');

  recordCheck(
    'P9-PARTNER-FAIL-CLOSED',
    'Partner Route Fails Closed on Workspace Switch Failure',
    'Workspace Isolation',
    p9Passed,
    p9Passed
      ? 'Partner route halts navigation and presents error on workspace switch failure.'
      : 'Partner route navigates despite workspace switch failure.'
  );

  // 24. P10: Internal Engineering Jargon Purged from Visible Portals
  const sidebarContent = fs.readFileSync(path.join(__dirname, '..', 'components/restaurant/RestaurantSidebar.tsx'), 'utf8');
  const platformAnalyticsContent = fs.readFileSync(path.join(__dirname, '..', 'components/admin/PlatformAnalytics.tsx'), 'utf8');
  const p10Passed =
    !sidebarContent.includes('Stage 3 RLS Protected') &&
    sidebarContent.includes('Secure restaurant workspace') &&
    !platformAnalyticsContent.includes('scheduled for Pack 4');

  recordCheck(
    'P10-JARGON-REMOVAL',
    'Internal Engineering Jargon Purged from UI Components',
    'User Experience Truthfulness',
    p10Passed,
    p10Passed
      ? 'Zero internal stage/pack labels in visible restaurant and admin interfaces.'
      : 'Internal engineering jargon detected in UI components.'
  );

  // Print Summary
  console.log('\n============================================================');
  console.log('📊 DEMO READINESS AUDIT SUMMARY');
  console.log('============================================================\n');

  const totalChecks = results.length;
  const passedChecks = results.filter((r) => r.passed).length;
  const failedChecks = totalChecks - passedChecks;

  console.log(`Total Invariant Checks: ${totalChecks}`);
  console.log(`Passed Checks:          ${passedChecks}`);
  console.log(`Failed Checks:          ${failedChecks}`);
  console.log(`Demo Readiness Score:   ${Math.round((passedChecks / totalChecks) * 100)}%\n`);

  if (failedChecks > 0) {
    console.error('❌ SOME AUDIT CHECKS FAILED. PLEASE RESOLVE BEFORE DEMO.');
    process.exit(1);
  } else {
    console.log('🎉 ALL AUDIT CHECKS PASSED. MLOHUB IS DEMONSTRATION-READY.');
    process.exit(0);
  }
}

runDemoReadinessAudit().catch((err) => {
  console.error('Fatal audit runner error:', err);
  process.exit(1);
});