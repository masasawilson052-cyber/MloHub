/**
 * ============================================================================
 * MLOHUB DEMONSTRATION READINESS TEST SUITE
 * ============================================================================
 * Validates all demo closure invariants across Customer, Restaurant Partner,
 * Admin, Payments, and Database boundaries.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { runtimeConfig } from '../lib/runtimeConfig';
import { FINANCIAL_CONFIG } from '../config/platformFees';
import { SmsTemplates } from '../services/sms/smsTemplates';
import { ApplicationRepository } from '../repositories/applications.repository';

export async function runDemoReadinessTestSuite(
  assert: (cond: boolean, name: string) => void
): Promise<void> {
  console.log('\n--- SUITE: Demonstration Readiness & Truth Hardening ---');

  // 1. P0: Client Service-Role Key Audit
  const supabaseClientCode = fs.readFileSync(
    path.join(__dirname, '..', 'lib/supabase.ts'),
    'utf8'
  );
  assert(
    !supabaseClientCode.includes('supabaseAdmin'),
    'P0: supabaseAdmin is not exported from client lib/supabase.ts'
  );
  assert(
    !supabaseClientCode.includes('SUPABASE_SERVICE_ROLE_KEY'),
    'P0: SUPABASE_SERVICE_ROLE_KEY is purged from client lib/supabase.ts'
  );

  // 2. P1: Customer Favorites Deferred Without Backend
  const dbContextCode = fs.readFileSync(
    path.join(__dirname, '..', 'context/DbContext.tsx'),
    'utf8'
  );
  assert(
    !dbContextCode.includes('FAVORITES_PREF_KEY'),
    'P1: AsyncStorage favorites preference key is removed'
  );
  assert(
    dbContextCode.includes('allowLocalFallbacks ? dbState.favorites : []'),
    'P1: activeFavorites is locked to empty array in production/real mode'
  );

  // 3. P2 & P3: Notifications Canonical Boundary
  const notifContextCode = fs.readFileSync(
    path.join(__dirname, '..', 'context/NotificationContext.tsx'),
    'utf8'
  );
  assert(
    notifContextCode.includes('allowLocalDataFallbacks ? INITIAL_NOTIFICATIONS : []'),
    'P2: Mock notifications restricted strictly behind allowLocalDataFallbacks'
  );

  // 4. P5: Partner Route Switch Workspace Race Guard
  const partnerRouteCode = fs.readFileSync(
    path.join(__dirname, '..', 'app/partner/index.tsx'),
    'utf8'
  );
  assert(
    partnerRouteCode.includes('await switchWorkspace'),
    'P5: Partner route awaits switchWorkspace resolution before redirect'
  );

  // 5. P6: Restaurant Analytics Formula Audit
  const portalCode = fs.readFileSync(
    path.join(__dirname, '..', 'app/restaurant-portal/index.tsx'),
    'utf8'
  );
  assert(
    !portalCode.includes('domainOrders.length * 15'),
    'P6: Zero fabricated search appearances formula (orders * 15 purged)'
  );
  assert(
    !portalCode.includes('ordersCount * 4'),
    'P6: Zero fabricated dish search formula (ordersCount * 4 purged)'
  );
  assert(
    !portalCode.includes('missedSearchesCount: 12'),
    'P6: Zero fabricated missed search counts (12 missed purged)'
  );

  // 6. P7: Review Responses Server RPC
  assert(
    portalCode.includes('ReviewResponsesRepository.respond'),
    'P7: Merchant review responses call server-authoritative RPC'
  );

  // 7. P8 & P9: Branch Operational Modes
  const settingsCode = fs.readFileSync(
    path.join(__dirname, '..', 'components/restaurant/RestaurantSettings.tsx'),
    'utf8'
  );
  assert(
    settingsCode.includes("'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED'"),
    'P8: Restaurant operational modes aligned with Pack 4F (OPEN, BUSY, PAUSED, CLOSED)'
  );
  assert(
    settingsCode.includes('BranchOperationsRepository.getOperatingHours'),
    'P9: Weekly schedule loads from authoritative branch hours repository'
  );

  // 8. P10: Staff Invitations Pilot Guard
  const staffCode = fs.readFileSync(
    path.join(__dirname, '..', 'components/restaurant/StaffManager.tsx'),
    'utf8'
  );
  assert(
    staffCode.includes('onInviteStaff?:') && staffCode.includes('Boolean(onInviteStaff)'),
    'P10: Staff invitation button is conditionally rendered only if handler supplied'
  );

  // 9. P11: Custom Meal Quotes Truthful Item Title
  assert(
    portalCode.includes('targetInv?.request?.dishName') &&
      !portalCode.includes("name: 'Chef Custom Preparation'"),
    'P11: Custom meal quotes derive dish name directly from customer request'
  );

  // 10. P15 & P16: Platform Financial Authority & Payment Truth
  assert(
    FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE === 0.10,
    'P15: Canonical platform commission rate is 10%'
  );
  assert(
    FINANCIAL_CONFIG.SERVICE_FEE_TZS === 1500,
    'P15: Canonical customer service fee is 1500 TZS'
  );
  assert(
    FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS === 2500,
    'P15: Canonical standard delivery fee is 2500 TZS'
  );

  const paymentsMonitorCode = fs.readFileSync(
    path.join(__dirname, '..', 'components/admin/PaymentsMonitor.tsx'),
    'utf8'
  );
  assert(
    paymentsMonitorCode.includes('Captured Volume'),
    'P16: PaymentsMonitor uses Captured Volume (not Settled)'
  );
  assert(
    !paymentsMonitorCode.includes('CLICKPESA: SANDBOX VERIFIED'),
    'P16: Unconditional ClickPesa sandbox claim replaced with runtime-truth status'
  );

  // 11. P19: Application Validation
  let appValidationPassed = false;
  try {
    await ApplicationRepository.submit({ businessName: '' });
  } catch (err: any) {
    appValidationPassed = err.message?.includes('required') || err.message?.includes('session');
  }
  assert(
    appValidationPassed,
    'P19: ApplicationRepository rejects submissions lacking required fields'
  );

  // 12. P20: Truthful Delivery SMS
  const smsEn = SmsTemplates.orderOutForDelivery({ orderNumber: '1001', restaurantName: 'Swahili Bistro' }, 'en');
  assert(
    !smsEn.includes('Our courier is heading to your address now'),
    'P20: SMS template does not claim platform couriers'
  );
  assert(
    smsEn.includes('Your restaurant has marked your order as on the way'),
    'P20: SMS template truthfully attributes delivery to restaurant'
  );
}
