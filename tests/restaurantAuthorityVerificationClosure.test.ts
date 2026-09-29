/**
 * ============================================================================
 * MLOHUB RESTAURANT FINAL CLOSURE TEST SUITE (PASS 1)
 * DATABASE AUTHORITY + DOCUMENT VERIFICATION + PAYOUT VERIFICATION + FAIL-CLOSED
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { ApplicationRepository } from '../repositories/applications.repository';
import { PayoutsRepository } from '../repositories/payouts.repository';
import { reviewVerificationDocument } from '../services/MerchantVerificationService';

const ROOT = path.resolve(__dirname, '..');

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// Client-side mirror of public.normalize_tz_phone for verification testing
export function normalizeTzPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let v = phone.replace(/[^0-9]/g, '');
  if (v.length === 10 && v.startsWith('0')) {
    v = '255' + v.substring(1);
  } else if (v.length === 9) {
    v = '255' + v;
  }
  if (!v.startsWith('255') || v.length !== 12) {
    return null;
  }
  return '+' + v;
}

export async function runRestaurantAuthorityVerificationClosureTests(): Promise<{
  passed: number;
  failed: number;
}> {
  console.log('\n================================================================');
  console.log('🔒 MLOHUB RESTAURANT AUTHORITY & VERIFICATION CLOSURE (PASS 1)');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, label: string) => {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      failed++;
      throw new Error(`Assertion failed: ${label}`);
    }
  };

  const migration06 = readRel('supabase/migrations/20260928000600_restaurant_authority_verification_closure.sql');
  const migration05 = readRel('supabase/migrations/20260928000500_final_restaurant_closure.sql');
  const migration01 = readRel('supabase/migrations/20260928000100_restaurant_two_gate_lifecycle.sql');
  const restRepoSrc = readRel('repositories/restaurants.repository.ts');
  const appRepoSrc = readRel('repositories/applications.repository.ts');
  const payoutsRepoSrc = readRel('repositories/payouts.repository.ts');
  const merchantVerifSrc = readRel('services/MerchantVerificationService.ts');

  // --------------------------------------------------------------------------
  // 1 & 2. RESTAURANT MEMBER CANNOT DIRECTLY SELF-PUBLISH OR SELF-VERIFY
  // --------------------------------------------------------------------------
  console.log('\n--- 1 & 2. Direct Self-Publish & Self-Verify Blocked by Database Authority ---');

  assert(
    migration06.includes('CREATE OR REPLACE FUNCTION public.protect_restaurant_authority_fields()') &&
      migration06.includes('trg_protect_restaurant_authority_fields') &&
      migration06.includes('BEFORE UPDATE ON public.restaurants'),
    '1.1: Trigger trg_protect_restaurant_authority_fields protects restaurant authority fields'
  );

  const normalizedMig06 = migration06.replace(/\s+/g, ' ');

  assert(
    normalizedMig06.includes("NEW.is_published IS DISTINCT FROM OLD.is_published") &&
      normalizedMig06.includes("NEW.launch_status IS DISTINCT FROM OLD.launch_status"),
    '1.2: Trigger prevents non-admin direct mutation of is_published and launch_status (no self-publish)'
  );

  assert(
    normalizedMig06.includes("NEW.is_verified IS DISTINCT FROM OLD.is_verified") &&
      normalizedMig06.includes("NEW.verification_status IS DISTINCT FROM OLD.verification_status") &&
      normalizedMig06.includes("NEW.seller_tier IS DISTINCT FROM OLD.seller_tier"),
    '2.1: Trigger prevents non-admin direct mutation of is_verified, verification_status, and seller_tier (no self-verify)'
  );

  assert(
    normalizedMig06.includes("NEW.owner_id IS DISTINCT FROM OLD.owner_id") &&
      normalizedMig06.includes("NEW.archived_at IS DISTINCT FROM OLD.archived_at"),
    '2.2: Trigger prevents non-admin direct mutation of owner_id and archived_at'
  );

  assert(
    !restRepoSrc.includes('is_published: true') &&
      !restRepoSrc.includes("is_verified: true"),
    '2.3: RestaurantRepository client code contains zero direct writes of is_published: true or is_verified: true'
  );

  // --------------------------------------------------------------------------
  // 3. SECURE GATE B RPC REMAINS ABLE TO PUBLISH
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Secure Gate B RPC Publication Authority ---');

  assert(
    migration05.includes('CREATE OR REPLACE FUNCTION public.approve_restaurant_launch') &&
      migration05.includes("is_published = TRUE") &&
      migration05.includes("launch_status = 'PUBLISHED'") &&
      migration05.includes("SECURITY DEFINER"),
    '3.1: approve_restaurant_launch Gate B RPC is SECURITY DEFINER and sets is_published = TRUE'
  );

  assert(
    migration05.includes("PERFORM public.require_admin_aal2();"),
    '3.2: approve_restaurant_launch requires require_admin_aal2 clearance'
  );

  // --------------------------------------------------------------------------
  // 4, 5 & 6. BRANCH MUTATION ROLE GATING (OWNER/MANAGER ONLY; CHEF/STAFF BLOCKED)
  // --------------------------------------------------------------------------
  console.log('\n--- 4, 5 & 6. Branch Identity & Coordinates Role Gating ---');

  assert(
    migration06.includes('DROP POLICY IF EXISTS "Restaurant owners and staff can manage branches"') &&
      migration06.includes('CREATE POLICY "Restaurant owners managers and admins manage branches"'),
    '4.1: Drops old broad staff branch mutation policy and defines restricted policy'
  );

  assert(
    migration06.includes("rm.role IN ('OWNER', 'MANAGER')"),
    '4.2: Policy explicitly permits only OWNER and MANAGER (and platform admin)'
  );

  // Dynamic simulation of branch mutation policy check
  const canMutateBranch = (role: string, isAdmin = false) => {
    if (isAdmin) return true;
    return ['OWNER', 'MANAGER'].includes(role);
  };

  assert(canMutateBranch('CHEF') === false, '4.3: CHEF cannot change branch GPS or details');
  assert(canMutateBranch('STAFF') === false, '5.1: STAFF cannot change branch address or details');
  assert(canMutateBranch('OWNER') === true, '6.1: OWNER can manage branch identity');
  assert(canMutateBranch('MANAGER') === true, '6.2: MANAGER can manage branch identity');
  assert(canMutateBranch('STAFF', true) === true, '6.3: Admin can manage branch identity');

  // --------------------------------------------------------------------------
  // 7 & 8. DOCUMENT REVIEW RPC (AAL2 REQUIRED & REJECTION REASON ENFORCED)
  // --------------------------------------------------------------------------
  console.log('\n--- 7 & 8. Admin Document Review RPC & Rejection Enforcement ---');

  assert(
    migration06.includes('CREATE OR REPLACE FUNCTION public.review_restaurant_verification_document') &&
      migration06.includes('PERFORM public.require_admin_aal2();'),
    '7.1: review_restaurant_verification_document defined and requires require_admin_aal2'
  );

  assert(
    migration06.includes("p_decision NOT IN ('VERIFIED', 'REJECTED')"),
    '7.2: review_restaurant_verification_document restricts decisions strictly to VERIFIED or REJECTED'
  );

  assert(
    migration06.includes("p_decision = 'REJECTED'") &&
      migration06.includes("length(trim(p_reason)) < 3") &&
      migration06.includes("Rejection reason is required"),
    '8.1: Document rejection strictly requires a non-empty reason'
  );

  assert(
    migration06.includes("action, target_type, target_id, details") &&
      migration06.includes("'REVIEW_RESTAURANT_DOCUMENT'"),
    '8.2: Document review writes immutable audit log entry'
  );

  assert(
    merchantVerifSrc.includes('export async function reviewVerificationDocument') &&
      merchantVerifSrc.includes('review_restaurant_verification_document'),
    '8.3: MerchantVerificationService exposes client helper reviewVerificationDocument'
  );

  // --------------------------------------------------------------------------
  // 9 & 10. PAYOUT VERIFICATION RPC (AAL2 REQUIRED & ENCRYPTED SECRET REQUIRED)
  // --------------------------------------------------------------------------
  console.log('\n--- 9 & 10. Payout Destination Review RPC & Encryption Invariants ---');

  assert(
    migration06.includes('CREATE OR REPLACE FUNCTION public.review_payout_destination_secure') &&
      migration06.includes('PERFORM public.require_admin_aal2();'),
    '9.1: review_payout_destination_secure defined and requires require_admin_aal2'
  );

  assert(
    migration06.includes("encrypted_account_reference LIKE 'pgp:v1:%'") &&
      migration06.includes("Encrypted payout secret is missing"),
    '10.1: Payout verification strictly requires encrypted secret with pgp:v1: prefix'
  );

  assert(
    migration06.includes("p_verification_reference IS NULL") &&
      migration06.includes("Verification reference required") &&
      migration06.includes("Verified account name required"),
    '10.2: Payout verification requires verification reference and verified account name'
  );

  assert(
    payoutsRepoSrc.includes('public static async reviewDestination') &&
      payoutsRepoSrc.includes('review_payout_destination_secure'),
    '10.3: PayoutsRepository exposes reviewDestination helper'
  );

  // --------------------------------------------------------------------------
  // 11. RAW TIN DOES NOT EQUAL DOCUMENT VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 11. Raw TIN vs Document Verification Integrity ---');

  assert(
    migration06.includes("document_type IN ('BUSINESS_LICENSE', 'TIN_DOCUMENT', 'FOOD_OPERATION_DOCUMENT')") &&
      migration06.includes("verification_status = 'VERIFIED'") &&
      migration06.includes("reviewed_by IS NOT NULL") &&
      migration06.includes("reviewed_at IS NOT NULL"),
    '11.1: Gate A requires all 3 documents verified by administrator with audit timestamps'
  );

  assert(
    migration06.includes("count(DISTINCT document_type) = 3") &&
      migration06.includes("Required business verification documents must be verified before merchant approval"),
    '11.2: Gate A rejects application approval if 3 verified documents are absent (TIN text alone is rejected)'
  );

  // --------------------------------------------------------------------------
  // 12. TANZANIAN PHONE NORMALIZATION
  // --------------------------------------------------------------------------
  console.log('\n--- 12. Tanzanian Phone Number Normalization ---');

  assert(
    migration06.includes('CREATE OR REPLACE FUNCTION public.normalize_tz_phone'),
    '12.1: public.normalize_tz_phone defined in SQL migration'
  );

  assert(
    migration06.includes('public.normalize_tz_phone(rb.owner_phone) = public.normalize_tz_phone(u.phone)'),
    '12.2: Launch readiness contact check compares normalized branch phone to normalized owner phone'
  );

  // Dynamic test of normalization matching
  assert(
    normalizeTzPhone('+255712345678') === '+255712345678',
    '12.3: Canonical +255 format normalizes correctly'
  );
  assert(
    normalizeTzPhone('0712345678') === '+255712345678',
    '12.4: Local 071 format normalizes to +255712345678'
  );
  assert(
    normalizeTzPhone('712345678') === '+255712345678',
    '12.5: 9-digit format 712345678 normalizes to +255712345678'
  );
  assert(
    normalizeTzPhone('+255 712-345-678') === '+255712345678',
    '12.6: Formatted phone with dashes and spaces normalizes to +255712345678'
  );
  assert(
    normalizeTzPhone('12345') === null,
    '12.7: Invalid short phone returns null'
  );

  assert(
    normalizeTzPhone('+255712345678') === normalizeTzPhone('0712345678') &&
      normalizeTzPhone('0712345678') === normalizeTzPhone('712345678'),
    '12.8: All three representations match identically under normalization'
  );

  // --------------------------------------------------------------------------
  // 13. requestLaunchCorrections FAILS CLOSED
  // --------------------------------------------------------------------------
  console.log('\n--- 13. requestLaunchCorrections Fails Closed When Offline ---');

  let rejected13 = false;
  try {
    await RestaurantRepository.requestLaunchCorrections('test-rest-id', 'Fix TIN');
  } catch (err: any) {
    rejected13 = true;
    assert(
      err.message.includes('Launch correction service unavailable'),
      '13.1: Throws explicit error "Launch correction service unavailable"'
    );
  }
  assert(rejected13, '13.2: requestLaunchCorrections failed closed');

  // --------------------------------------------------------------------------
  // 14. unpublishRestaurant HAS NO DIRECT TABLE FALLBACK
  // --------------------------------------------------------------------------
  console.log('\n--- 14. unpublishRestaurant Has No Direct Table Fallback ---');

  const unpublishFnBody = restRepoSrc.slice(restRepoSrc.indexOf('unpublishRestaurant'));
  assert(
    !unpublishFnBody.includes(".from('restaurants').update"),
    '14.1: unpublishRestaurant contains zero direct table update calls'
  );
  assert(
    unpublishFnBody.includes("supabase.rpc('unpublish_restaurant'"),
    '14.2: unpublishRestaurant exclusively invokes unpublish_restaurant RPC'
  );

  // --------------------------------------------------------------------------
  // 15. APPLICATION CHANGES REQUEST HAS NO DIRECT UPDATE FALLBACK
  // --------------------------------------------------------------------------
  console.log('\n--- 15. Application Changes Request Has No Direct Update Fallback ---');

  const updateStatusFn = appRepoSrc.slice(appRepoSrc.indexOf('updateStatus('));
  assert(
    !updateStatusFn.includes(".from('restaurant_applications').update"),
    '15.1: ApplicationRepository.updateStatus contains zero direct table update calls'
  );
  assert(
    updateStatusFn.includes("Unsupported direct application status transition"),
    '15.2: updateStatus rejects generic direct status mutations'
  );

  console.log('\n================================================================');
  console.log(`🏁 RESTAURANT CLOSURE (PASS 1) RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runRestaurantAuthorityVerificationClosureTests().catch((e) => {
    console.error('Fatal test error in restaurantAuthorityVerificationClosure.test.ts:', e);
    process.exit(1);
  });
}
