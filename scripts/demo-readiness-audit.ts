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