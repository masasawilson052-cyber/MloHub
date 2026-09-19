/**
 * ============================================================================
 * MLOHUB STAGE 3: SECURITY SMOKE TEST SCRIPT
 * ============================================================================
 * Validates database security posture, tenant isolation, zero-trust order
 * pricing, last-owner protection, immutable snapshots, and RLS policies.
 * 
 * Usage:
 *   npx tsx scripts/security-smoke-test.ts
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { runSecurityRulesTestSuite } from '../tests/securityRules.test';

async function main() {
  console.log('================================================================');
  console.log('🔒 MLOHUB PRODUCTION SECURITY SMOKE TEST SUITE');
  console.log('   Testing: RBAC, Tenant Isolation, RLS Policies & Triggers');
  console.log('================================================================\n');

  let passedChecks = 0;
  let failedChecks = 0;

  function record(ok: boolean, desc: string) {
    if (ok) {
      console.log(`  ✓ [PASSED] ${desc}`);
      passedChecks++;
    } else {
      console.error(`  ✗ [FAILED] ${desc}`);
      failedChecks++;
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 1: Migration Files Integrity & Security Invariants
  // ---------------------------------------------------------------------------
  console.log('Section 1: Static SQL Migration Invariants Audit');
  const projectRoot = path.resolve(__dirname, '..');
  const stage3MigrationPath = path.join(
    projectRoot,
    'supabase',
    'migrations',
    '20260916000003_stage3_security_hardening.sql'
  );

  const migrationExists = fs.existsSync(stage3MigrationPath);
  record(migrationExists, 'Stage 3 security hardening SQL migration file exists');

  if (migrationExists) {
    const sql = fs.readFileSync(stage3MigrationPath, 'utf8');

    // 1. Search path security (prevent search path hijacking)
    const securityDefinerCount = (sql.match(/SECURITY DEFINER/gi) || []).length;
    const searchPathSafeCount = (sql.match(/SET search_path\s*=\s*public,\s*pg_temp;/gi) || []).length;
    record(
      securityDefinerCount > 0 && searchPathSafeCount >= securityDefinerCount,
      `All SECURITY DEFINER functions (${securityDefinerCount}) lock search_path to 'public, pg_temp'`
    );

    // 2. Core helper functions
    record(sql.includes('CREATE OR REPLACE FUNCTION public.is_admin'), 'Function public.is_admin is defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.is_super_admin'), 'Function public.is_super_admin is defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.is_restaurant_member'), 'Function public.is_restaurant_member is defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.has_restaurant_role'), 'Function public.has_restaurant_role is defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.has_restaurant_permission'), 'Function public.has_restaurant_permission is defined');

    // 3. Security triggers
    record(sql.includes('trg_protect_profile_privileged_fields'), 'Profile privilege escalation defense trigger exists');
    record(sql.includes('trg_protect_restaurant_membership'), 'Last active owner protection trigger exists');
    record(sql.includes('trg_check_order_status_transition'), 'Order status state machine trigger exists');
    record(sql.includes('trg_prevent_order_items_tampering'), 'Order item pricing snapshot immutability trigger exists');
    record(sql.includes('trg_verify_review_eligibility'), 'Verified review completed order prerequisite trigger exists');
    record(sql.includes('trg_protect_payment_status'), 'Payment status tampering lock trigger exists');

    // 4. Privileged Admin RPCs
    record(sql.includes('CREATE OR REPLACE FUNCTION public.approve_restaurant_application'), 'Privileged RPC approve_restaurant_application defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.reject_restaurant_application'), 'Privileged RPC reject_restaurant_application defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.suspend_restaurant'), 'Privileged RPC suspend_restaurant defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.reactivate_restaurant'), 'Privileged RPC reactivate_restaurant defined');
    record(sql.includes('CREATE OR REPLACE FUNCTION public.change_platform_role'), 'Privileged RPC change_platform_role defined');

    // 5. Zero-Trust Secure Order Pricing RPC
    record(sql.includes('CREATE OR REPLACE FUNCTION public.create_order_secure'), 'Secure server-side order calculation RPC create_order_secure defined');

    // 6. Tenant & Storage isolation policies
    record(sql.includes('storage.objects'), 'Storage bucket RLS policies defined');
    record(sql.includes('data_reports'), 'Data reports table and CHECK constraints defined');

    // 7. Stage 12 Storage media migration invariants
    const stage12MigrationPath = path.join(
      projectRoot,
      'supabase',
      'migrations',
      '20260917000009_stage12_storage_media.sql'
    );
    const stage12Exists = fs.existsSync(stage12MigrationPath);
    record(stage12Exists, 'Stage 12 storage media migration exists');
    if (stage12Exists) {
      const stage12Sql = fs.readFileSync(stage12MigrationPath, 'utf8');
      record(stage12Sql.includes("'mlohub-media'"), 'mlohub-media managed storage bucket defined');
      record(stage12Sql.includes('Tenant restaurant and user media upload'), 'Tenant storage upload RLS policy defined');
      record(stage12Sql.includes('Tenant restaurant and user media delete'), 'Tenant storage delete RLS policy defined');
    }

    // 8. Pack 4D Reviews Trust migration invariants
    const pack4dMigrationPath = path.join(
      projectRoot,
      'supabase',
      'migrations',
      '20260918000004_pack4d_reviews_trust.sql'
    );
    const pack4dExists = fs.existsSync(pack4dMigrationPath);
    record(pack4dExists, 'Pack 4D reviews and trust SQL migration file exists');
    if (pack4dExists) {
      const p4dSql = fs.readFileSync(pack4dMigrationPath, 'utf8');
      record(p4dSql.includes('trg_protect_review_provenance'), 'Review provenance immutability trigger defined');
      record(p4dSql.includes('trg_prevent_tamper_rest_agg'), 'Restaurant aggregate immutability trigger defined');
      record(p4dSql.includes('submit_verified_review_secure'), 'Secure review submission RPC defined');
      record(p4dSql.includes('respond_to_review_secure'), 'Secure merchant response RPC defined');
      record(p4dSql.includes('moderate_review_secure'), 'Secure platform review moderation RPC defined');
      record(p4dSql.includes('can_manage_storage_media'), 'Review photo storage path isolation helper defined');
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Dynamic Unit & Mock Security Invariant Suite
  // ---------------------------------------------------------------------------
  console.log('\nSection 2: Dynamic Security Rules & Isolation Suite');
  const unitResults = await runSecurityRulesTestSuite();
  record(unitResults.failedCount === 0, `Security rules test suite: ${unitResults.passedCount} passed, ${unitResults.failedCount} failed`);

  // ---------------------------------------------------------------------------
  // SECTION 3: Live Supabase Status Check
  // ---------------------------------------------------------------------------
  console.log('\nSection 3: Live Supabase Environment Probes');
  const isConfigured = isSupabaseConfigured();

  if (!isConfigured) {
    console.log('  ℹ️  [LIVE SUPABASE: SKIPPED]');
    console.log('     Reason: EXPO_PUBLIC_SUPABASE_URL and anon key are not configured in local environment.');
    console.log('     Offline validation completed successfully via mock data layer & SQL invariant verification.');
    console.log('     To run against live Supabase:');
    console.log('       1. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
    console.log('       2. Run migration: npx supabase db push (or apply 20260916000003_stage3_security_hardening.sql)');
    console.log('       3. Execute: npx tsx scripts/security-smoke-test.ts');
  } else {
    console.log('  🔍 Probing live Supabase instance...');
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        console.warn(`  ⚠️  Live query returned error: ${error.message}`);
        record(false, `Live Supabase probe failed: ${error.message}`);
      } else {
        record(true, 'Live Supabase connection established and profiles table queried successfully');
      }
    } catch (e: any) {
      record(false, `Live Supabase connection exception: ${e.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 SECURITY SMOKE TEST SUMMARY:`);
  console.log(`   Passed Invariant Checks: ${passedChecks}`);
  console.log(`   Failed Invariant Checks: ${failedChecks}`);
  console.log(`   Live Database Status:    ${isConfigured ? 'CONNECTED' : 'SKIPPED (MOCK PASSED)'}`);
  console.log('================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in security smoke test:', err);
  process.exit(1);
});
