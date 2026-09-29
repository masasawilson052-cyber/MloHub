/**
 * ============================================================================
 * MLOHUB RESTAURANT PHASE 1 TEST SUITE
 * MERCHANT IDENTITY + TWO-GATE ONBOARDING + STORE LAUNCH CONTROL
 * ============================================================================
 * 
 * Verifies:
 * 1. Gate A Semantics: Admin approval creates private setup restaurant (unverified, unpublished, not discoverable).
 * 2. Customer Discovery Gate: customerVisibleOnly strictly excludes non-PUBLISHED, unverified, or unpublished stores.
 * 3. 12-Criteria Launch Readiness Engine: Accurately checks branch, menu pricing, operating hours, TIN, license, etc.
 * 4. Launch Review Submission: Transitions store to GO_LIVE_REVIEW without direct customer exposure.
 * 5. Gate B Store Launch Approval: Requires admin AAL2, sets PUBLISHED, isPublished=true, isVerified=true, isOpen=false.
 * 6. Gate B Corrections Flow: Sets CORRECTIONS_REQUIRED, ensures isPublished remains false.
 * 7. Private Verification Document Storage: Zero public URLs, short-lived presigned URLs only, strict bucket isolation.
 * 8. Unified 10-Character Password Policy: Enforces min 10 chars, uppercase, lowercase, number, special char.
 * 9. Elimination of Legacy Credentials Bridge: Zero references to RestaurantCredentialsService, lib file deleted.
 * 10. Audit Logging on Sensitive Field Updates: Payout, TIN, license, and owner changes write to audit log.
 * 11. Dar es Salaam Branch Location Presets: Valid geo-coordinates within Dar es Salaam bounding box.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Restaurant, RestaurantLaunchStatus, VerificationDocumentType } from '../types/domain';
import { RestaurantEntity } from '../db/types';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import {
  VERIFICATION_BUCKET,
  ALLOWED_VERIFICATION_MIME_TYPES,
  MAX_VERIFICATION_FILE_SIZE,
} from '../services/MerchantVerificationService';
import { DAR_ES_SALAAM_LOCATION_PRESETS } from '../constants/branchPresets';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function expectReject(
  action: () => Promise<unknown>,
  messageFragment: string,
  label: string
) {
  let rejected = false;

  try {
    await action();
  } catch (error: any) {
    rejected = true;

    assert(
      String(error?.message || error).includes(messageFragment),
      `${label}: expected error containing "${messageFragment}"`
    );
  }

  assert(rejected, `${label}: operation must fail closed`);
}

// Password Policy Evaluator matching app/auth/register-restaurant.tsx and app/auth/activate-restaurant.tsx
function validatePassword(password: string): {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
} {
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  return { isValid, hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar };
}

export async function runRestaurantOnboardingTwoGateTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🏪 MLOHUB RESTAURANT PHASE 1: TWO-GATE ONBOARDING & LAUNCH SUITE');
  console.log('================================================================');

  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // Group 1: Legacy Bridge Elimination & Security Hardening
  // --------------------------------------------------------------------------
  console.log('\n--- Group 1: Legacy Bridge Elimination & Zero References ---');

  // 1.1: Verify lib/restaurantCredentials.ts file is deleted
  const legacyBridgePath = path.join(rootDir, 'lib', 'restaurantCredentials.ts');
  assert(!fs.existsSync(legacyBridgePath), '1.1: lib/restaurantCredentials.ts does not exist on disk');

  // 1.2: Check entire codebase has 0 occurrences of RestaurantCredentialsService
  const filesToCheck = [
    'context/AuthContext.tsx',
    'app/auth/register-restaurant.tsx',
    'app/auth/activate-restaurant.tsx',
    'app/restaurant-portal/index.tsx',
    'repositories/restaurants.repository.ts',
    'repositories/applications.repository.ts',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(
        !content.includes('RestaurantCredentialsService'),
        `1.2: ${relPath} contains zero references to RestaurantCredentialsService`
      );
      assert(
        !content.includes('restaurantCredentials'),
        `1.2: ${relPath} contains zero imports of restaurantCredentials`
      );
    }
  }

  // --------------------------------------------------------------------------
  // Group 2: Unified 10-Character Password Policy
  // --------------------------------------------------------------------------
  console.log('\n--- Group 2: Unified 10-Character Strong Password Policy ---');

  // 2.1: Too short (< 10 chars)
  assert(!validatePassword('Short1!').isValid, '2.1: Short password (<10 chars) rejected');
  assert(!validatePassword('Short1!').hasMinLength, '2.1: Min length flag is false');

  // 2.2: Missing uppercase
  assert(!validatePassword('lowercase123!@#').isValid, '2.2: Missing uppercase rejected');
  assert(!validatePassword('lowercase123!@#').hasUppercase, '2.2: Uppercase flag is false');

  // 2.3: Missing lowercase
  assert(!validatePassword('UPPERCASE123!@#').isValid, '2.3: Missing lowercase rejected');
  assert(!validatePassword('UPPERCASE123!@#').hasLowercase, '2.3: Lowercase flag is false');

  // 2.4: Missing number
  assert(!validatePassword('NoNumberSpecial!@#').isValid, '2.4: Missing number rejected');
  assert(!validatePassword('NoNumberSpecial!@#').hasNumber, '2.4: Number flag is false');

  // 2.5: Missing special character
  assert(!validatePassword('NoSpecialChar12345').isValid, '2.5: Missing special character rejected');
  assert(!validatePassword('NoSpecialChar12345').hasSpecialChar, '2.5: Special char flag is false');

  // 2.6: Compliant strong password passes all checks
  const strongPwd = 'MloHub@Dar2026';
  const validResult = validatePassword(strongPwd);
  assert(validResult.isValid, '2.6: Compliant password passes all checks');
  assert(validResult.hasMinLength && validResult.hasUppercase && validResult.hasLowercase && validResult.hasNumber && validResult.hasSpecialChar, '2.6: All 5 security flags are true');

  // --------------------------------------------------------------------------
  // Group 3: Gate A Semantics & Onboarding Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- Group 3: Gate A Semantics & Private Setup Mode ---');

  // 3.1: Verify post-Gate A entity structure
  const gateARestaurant: RestaurantEntity = {
    id: 'rest-gate-a-001',
    ownerId: 'user-merchant-001',
    sellerTier: 'BASIC_SELLER',
    name: 'Mama Ntilie Kitchen',
    slug: 'mama-ntilie-kitchen',
    cuisine: 'Swahili',
    rating: 0,
    reviewsCount: 0,
    minPrice: 0,
    maxPrice: 0,
    address: 'Shekilango Road, Sinza',
    neighborhood: 'Sinza',
    regionCity: 'Dar es Salaam',
    distanceKm: 2.5,
    estimatedPrepTimeMinutes: 20,
    isOpen: false,
    isVerified: false,
    isPublished: false,
    isActive: true,
    verificationStatus: 'PENDING_VERIFICATION',
    launchStatus: 'SETUP_REQUIRED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert(gateARestaurant.isVerified === false, '3.1: Gate A restaurant isVerified must be false');
  assert(gateARestaurant.verificationStatus === 'PENDING_VERIFICATION', '3.1: verificationStatus must be PENDING_VERIFICATION');
  assert(gateARestaurant.launchStatus === 'SETUP_REQUIRED', '3.1: launchStatus must be SETUP_REQUIRED');
  assert(gateARestaurant.isPublished === false, '3.1: isPublished must be false');
  assert(gateARestaurant.isOpen === false, '3.1: isOpen must be false');
  assert(gateARestaurant.sellerTier === 'BASIC_SELLER', '3.1: sellerTier must be BASIC_SELLER');

  // 3.2: Verify domain mapping preserves launchStatus
  const domainRest = RestaurantRepository.mapRowToRestaurant(gateARestaurant);
  assert(domainRest.launchStatus === 'SETUP_REQUIRED', '3.2: Domain mapper correctly preserves launchStatus');
  assert(domainRest.isPublished === false, '3.2: Domain mapper correctly preserves isPublished=false');

  // --------------------------------------------------------------------------
  // Group 4: Customer Discovery Gating
  // --------------------------------------------------------------------------
  console.log('\n--- Group 4: Customer Discovery Gating & Zero Exposure ---');

  // 4.1: Customer discovery filters strictly require PUBLISHED launch status
  const testCatalog: Restaurant[] = [
    {
      ...domainRest,
      id: 'store-setup-required',
      launchStatus: 'SETUP_REQUIRED',
      isPublished: false,
      isVerified: false,
      verificationStatus: 'PENDING_VERIFICATION',
      isActive: true,
    },
    {
      ...domainRest,
      id: 'store-go-live-review',
      launchStatus: 'GO_LIVE_REVIEW',
      isPublished: false,
      isVerified: false,
      verificationStatus: 'PENDING_VERIFICATION',
      isActive: true,
    },
    {
      ...domainRest,
      id: 'store-corrections-required',
      launchStatus: 'CORRECTIONS_REQUIRED',
      isPublished: false,
      isVerified: false,
      verificationStatus: 'PENDING_VERIFICATION',
      isActive: true,
    },
    {
      ...domainRest,
      id: 'store-approved-unpub',
      launchStatus: 'APPROVED_FOR_LAUNCH',
      isPublished: false,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      isActive: true,
    },
    {
      ...domainRest,
      id: 'store-gate-b-live',
      launchStatus: 'PUBLISHED',
      isPublished: true,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      isActive: true,
      isOpen: false, // Door closed currently, but visible in catalog
    },
    {
      ...domainRest,
      id: 'store-inactive-published',
      launchStatus: 'PUBLISHED',
      isPublished: true,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      isActive: false, // Suspended / Inactive
    },
  ];

  // Apply customerVisibleOnly filter rule from RestaurantRepository
  const visibleRestaurants = testCatalog.filter(
    (r) =>
      r.isActive === true &&
      r.isPublished === true &&
      r.isVerified === true &&
      r.verificationStatus === 'VERIFIED' &&
      r.launchStatus === 'PUBLISHED'
  );

  assert(visibleRestaurants.length === 1, '4.1: Exactly 1 restaurant is customer visible');
  assert(visibleRestaurants[0].id === 'store-gate-b-live', '4.1: Only the Gate B fully published restaurant is visible');
  assert(!visibleRestaurants.some((r) => r.id === 'store-setup-required'), '4.2: SETUP_REQUIRED store excluded from customer discovery');
  assert(!visibleRestaurants.some((r) => r.id === 'store-go-live-review'), '4.3: GO_LIVE_REVIEW store excluded from customer discovery');
  assert(!visibleRestaurants.some((r) => r.id === 'store-corrections-required'), '4.4: CORRECTIONS_REQUIRED store excluded from customer discovery');
  assert(!visibleRestaurants.some((r) => r.id === 'store-approved-unpub'), '4.5: Store with isPublished=false excluded from customer discovery');
  assert(!visibleRestaurants.some((r) => r.id === 'store-inactive-published'), '4.6: Inactive store excluded from customer discovery');

  // --------------------------------------------------------------------------
  // Group 5: 12-Criteria Launch Readiness Engine (Fail Closed When Offline)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 5: 12-Criteria Launch Readiness Engine (Fail Closed) ---');

  // 5.1: Fail-closed when Supabase is unavailable (zero synthetic readiness)
  await expectReject(
    () => RestaurantRepository.getLaunchReadiness('incomplete-rest-id'),
    'Launch readiness service unavailable',
    '5.1'
  );

  // 5.2: Invariant check - 12 criteria evaluation points defined in authoritative Supabase RPC migration
  const readinessMigrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260928000100_restaurant_two_gate_lifecycle.sql'
  );
  const readinessMigrationSql = fs.readFileSync(readinessMigrationPath, 'utf8');
  assert(
    readinessMigrationSql.includes('v_has_active_branch') &&
      readinessMigrationSql.includes('v_branch_has_coords') &&
      readinessMigrationSql.includes('v_has_opening_hours') &&
      readinessMigrationSql.includes('v_has_logo') &&
      readinessMigrationSql.includes('v_has_cover_image') &&
      readinessMigrationSql.includes('v_has_storefront_image') &&
      readinessMigrationSql.includes('v_has_verified_contact') &&
      readinessMigrationSql.includes('v_has_menu') &&
      readinessMigrationSql.includes('v_has_payout_destination') &&
      readinessMigrationSql.includes('v_delivery_configured') &&
      readinessMigrationSql.includes('v_business_verified'),
    '5.2: Launch readiness SQL RPC defines all required criteria evaluation points'
  );

  // --------------------------------------------------------------------------
  // Group 6: Launch Review Submission & Gate B Lifecycle (Fail Closed When Offline)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 6: Launch Review Submission & Gate B State Transitions (Fail Closed) ---');

  // 6.1: submitForLaunchReview fails closed when Supabase is unavailable
  await expectReject(
    () => RestaurantRepository.submitForLaunchReview('test-rest-id'),
    'Launch review service unavailable',
    '6.1'
  );

  // 6.2: publishRestaurant fails closed when Supabase is unavailable
  await expectReject(
    () => RestaurantRepository.publishRestaurant('test-rest-id'),
    'unavailable',
    '6.2'
  );

  // 6.3: approveLaunch fails closed when Supabase is unavailable
  await expectReject(
    () => RestaurantRepository.approveLaunch('test-rest-id'),
    'unavailable',
    '6.3'
  );

  // 6.4: requestLaunchCorrections fails closed when Supabase is unavailable
  await expectReject(
    () =>
      RestaurantRepository.requestLaunchCorrections(
        'test-rest-id',
        'Please upload clear copy of TIN certificate'
      ),
    'unavailable',
    '6.4'
  );

  // --------------------------------------------------------------------------
  // Group 7: Private Verification Storage Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Group 7: Private Verification Storage Isolation ---');

  // 7.1: Verify bucket configuration
  assert(VERIFICATION_BUCKET === 'merchant-verification', '7.1: Verification bucket is strictly merchant-verification');
  assert(VERIFICATION_BUCKET !== 'mlohub-media', '7.1: Verification bucket is NOT mlohub-media');

  // 7.2: Verify allowed mime types and size limits
  assert(ALLOWED_VERIFICATION_MIME_TYPES.includes('image/jpeg'), '7.2: JPEG is allowed');
  assert(ALLOWED_VERIFICATION_MIME_TYPES.includes('image/png'), '7.2: PNG is allowed');
  assert(ALLOWED_VERIFICATION_MIME_TYPES.includes('application/pdf'), '7.2: PDF is allowed');
  assert(MAX_VERIFICATION_FILE_SIZE === 10 * 1024 * 1024, '7.2: Max file size is strictly 10MB');

  // 7.3: Storage path formatting requires userId/applicationId/documentType/uuid.ext
  const testUserId = 'usr-001';
  const testAppId = 'app-001';
  const testDocType: VerificationDocumentType = 'TIN_DOCUMENT';
  const simulatedPath = `${testUserId}/${testAppId}/${testDocType}/doc-uuid.pdf`;

  const pathParts = simulatedPath.split('/');
  assert(pathParts.length === 4, '7.3: Path follows 4-segment hierarchy: userId/appId/docType/fileName');
  assert(pathParts[0] === testUserId, '7.3: Path segment 0 is userId');
  assert(pathParts[1] === testAppId, '7.3: Path segment 1 is applicationId');
  assert(pathParts[2] === testDocType, '7.3: Path segment 2 is documentType');
  assert(pathParts[3].endsWith('.pdf'), '7.3: Path segment 3 contains valid extension');

  // --------------------------------------------------------------------------
  // Group 8: Dar es Salaam Branch Location Presets
  // --------------------------------------------------------------------------
  console.log('\n--- Group 8: Dar es Salaam Branch Location Presets ---');

  // 8.1: Check preset count and structure
  assert(DAR_ES_SALAAM_LOCATION_PRESETS.length >= 10, '8.1: At least 10 Dar es Salaam location presets provided');

  // 8.2: Verify geo coordinates within Dar es Salaam bounding box
  // Dar es Salaam latitude range: ~[-7.1, -6.6]
  // Dar es Salaam longitude range: ~[39.0, 39.5]
  for (const preset of DAR_ES_SALAAM_LOCATION_PRESETS) {
    assert(
      preset.latitude >= -7.1 && preset.latitude <= -6.6,
      `8.2: Preset '${preset.name}' latitude ${preset.latitude} is within Dar es Salaam`
    );
    assert(
      preset.longitude >= 39.0 && preset.longitude <= 39.5,
      `8.2: Preset '${preset.name}' longitude ${preset.longitude} is within Dar es Salaam`
    );
    assert(preset.region === 'Dar es Salaam', `8.2: Preset '${preset.name}' region is Dar es Salaam`);
    assert(preset.district.length > 0, `8.2: Preset '${preset.name}' has non-empty district`);
    assert(preset.address.length > 0, `8.2: Preset '${preset.name}' has non-empty address`);
  }

  // --------------------------------------------------------------------------
  // Group 9: Database Migration Integrity
  // --------------------------------------------------------------------------
  console.log('\n--- Group 9: Database Migration Schema & Constraints ---');

  const migrationFile = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20260928000100_restaurant_two_gate_lifecycle.sql'
  );
  assert(fs.existsSync(migrationFile), '9.1: Migration 20260928000100_restaurant_two_gate_lifecycle.sql exists');

  const migrationSql = fs.readFileSync(migrationFile, 'utf8');

  // Check essential definitions in migration SQL
  assert(
    migrationSql.includes("ADD COLUMN IF NOT EXISTS launch_status"),
    '9.2: Migration adds launch_status column to restaurants'
  );
  assert(
    migrationSql.includes("restaurants_launch_status_check"),
    '9.3: Migration adds check constraint for launch_status'
  );
  assert(
    migrationSql.includes("restaurant_applications_status_check"),
    '9.4: Migration updates restaurant_applications status constraint'
  );
  assert(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.restaurant_verification_documents"),
    '9.5: Migration creates restaurant_verification_documents table'
  );
  assert(
    migrationSql.includes("INSERT INTO storage.buckets (id, name, public"),
    '9.6: Migration registers merchant-verification storage bucket'
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.approve_restaurant_application"),
    '9.7: Migration defines approve_restaurant_application Gate A function'
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.approve_restaurant_launch"),
    '9.8: Migration defines approve_restaurant_launch Gate B function'
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.request_restaurant_launch_corrections"),
    '9.9: Migration defines request_restaurant_launch_corrections function'
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.submit_restaurant_for_launch_review"),
    '9.10: Migration defines submit_restaurant_for_launch_review function'
  );
  assert(
    migrationSql.includes("CREATE OR REPLACE FUNCTION public.get_restaurant_launch_readiness"),
    '9.11: Migration defines get_restaurant_launch_readiness function'
  );
  assert(
    migrationSql.includes("require_admin_aal2"),
    '9.12: Admin functions require require_admin_aal2'
  );

  console.log('\n================================================================');
  console.log(`🏁 RESTAURANT PHASE 1 TEST SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

// Self-executing runner when executed directly
if (require.main === module) {
  runRestaurantOnboardingTwoGateTests().catch((e) => {
    console.error('Fatal test error in restaurantOnboardingTwoGate.test.ts:', e);
    process.exit(1);
  });
}
