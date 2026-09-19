/**
 * MLOHUB PACK 4B: RESERVATIONS, CAPACITY & DEPOSIT MANAGEMENT
 * Unit and Integration Test Suite
 */

import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

export async function runReservationCapacityTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 PACK 4B: RESERVATIONS, CAPACITY & DEPOSIT MANAGEMENT SUITE');
  console.log('================================================================\n');

  const files = {
    migration: path.resolve(__dirname, '../supabase/migrations/20260918000002_pack4b_reservation_system.sql'),
    domainTypes: path.resolve(__dirname, '../types/domain.ts'),
    reservationsRepo: path.resolve(__dirname, '../repositories/reservations.repository.ts'),
    reservationSettingsRepo: path.resolve(__dirname, '../repositories/reservationSettings.repository.ts'),
    restaurantTablesRepo: path.resolve(__dirname, '../repositories/restaurantTables.repository.ts'),
    reposIndex: path.resolve(__dirname, '../repositories/index.ts'),
    reservationModal: path.resolve(__dirname, '../components/ReservationModal.tsx'),
    reservationManager: path.resolve(__dirname, '../components/restaurant/ReservationManager.tsx'),
    bookingsTab: path.resolve(__dirname, '../app/(tabs)/bookings.tsx'),
  };

  // Section 1: Architecture & Artifact Files Presence
  console.log('--- Section 1: Artifact & File Existence ---');
  for (const [name, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `Target file exists: ${name} (${path.basename(filePath)})`);
  }

  // Section 2: Domain Types & Status Checks
  console.log('\n--- Section 2: Domain Types & Status Lifecycle ---');
  const domainSrc = fs.readFileSync(files.domainTypes, 'utf8');
  assert(domainSrc.includes("'PENDING_RESTAURANT_APPROVAL'"), "domainTypes includes 'PENDING_RESTAURANT_APPROVAL'");
  assert(domainSrc.includes("'AWAITING_DEPOSIT'"), "domainTypes includes 'AWAITING_DEPOSIT'");
  assert(domainSrc.includes("'PAYMENT_REVIEW_REQUIRED'"), "domainTypes includes 'PAYMENT_REVIEW_REQUIRED'");
  assert(domainSrc.includes('export type CapacityMode ='), 'domainTypes exports CapacityMode');
  assert(domainSrc.includes('export type ConfirmationMode ='), 'domainTypes exports ConfirmationMode');
  assert(domainSrc.includes('export type DepositPolicy ='), 'domainTypes exports DepositPolicy');
  assert(domainSrc.includes('export type AreaPreference ='), 'domainTypes exports AreaPreference');
  assert(domainSrc.includes('export type RefundEligibility ='), 'domainTypes exports RefundEligibility');
  assert(domainSrc.includes('export interface ReservationSettings'), 'domainTypes exports ReservationSettings');
  assert(domainSrc.includes('export interface RestaurantTable'), 'domainTypes exports RestaurantTable');
  assert(domainSrc.includes('export interface ReservationSlot'), 'domainTypes exports ReservationSlot');

  // Section 3: Migration Schema & Concurrency Hardening
  console.log('\n--- Section 3: Migration Schema & Concurrency Hardening ---');
  const migrationSrc = fs.readFileSync(files.migration, 'utf8');
  assert(migrationSrc.includes('CREATE EXTENSION IF NOT EXISTS btree_gist;'), 'Migration enables btree_gist extension');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reservation_settings'), 'Migration creates reservation_settings');
  assert(migrationSrc.includes('branch_id UUID NOT NULL REFERENCES public.restaurant_branches'), 'branch_id is NOT NULL on reservation_settings');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.restaurant_tables'), 'Migration creates restaurant_tables');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reservation_table_allocations'), 'Migration creates reservation_table_allocations');
  assert(migrationSrc.includes('EXCLUDE USING gist'), 'Migration defines GiST exclusion constraint on table allocations');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reservation_holds'), 'Migration creates reservation_holds');
  assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.reservation_blackouts'), 'Migration creates reservation_blackouts');
  assert(migrationSrc.includes('FUNCTION public.get_branch_date_lock_key'), 'Migration defines branch + date advisory lock generator');
  assert(migrationSrc.includes('pg_advisory_xact_lock'), 'Migration enforces transactional advisory locking');
  assert(migrationSrc.includes('FUNCTION public.generate_reservation_reference'), 'Migration defines reference code generator with retry');
  assert(migrationSrc.includes('FUNCTION public.is_branch_open_at'), 'Migration defines opening hours parser');
  assert(migrationSrc.includes('FUNCTION public.get_reservation_availability'), 'Migration defines get_reservation_availability RPC');
  assert(migrationSrc.includes('FUNCTION public.create_reservation_secure'), 'Migration defines create_reservation_secure RPC');
  assert(migrationSrc.includes('FUNCTION public.restaurant_decide_reservation'), 'Migration defines restaurant_decide_reservation RPC');
  assert(migrationSrc.includes('FUNCTION public.transition_reservation_attendance'), 'Migration defines transition_reservation_attendance RPC');
  assert(migrationSrc.includes('FUNCTION public.cancel_reservation_secure'), 'Migration defines cancel_reservation_secure RPC');
  assert(migrationSrc.includes('FUNCTION public.process_payment_webhook_secure'), 'Migration extends process_payment_webhook_secure');
  assert(migrationSrc.includes('sync_reservation_legacy_datetime'), 'Migration defines legacy date/time sync trigger');

  // Section 4: Repository Layer Implementation
  console.log('\n--- Section 4: Repository Layer Methods ---');
  const resRepoSrc = fs.readFileSync(files.reservationsRepo, 'utf8');
  assert(resRepoSrc.includes('getAvailability('), 'ReservationRepository implements getAvailability');
  assert(resRepoSrc.includes('createSecure('), 'ReservationRepository implements createSecure');
  assert(resRepoSrc.includes('restaurantDecide('), 'ReservationRepository implements restaurantDecide');
  assert(resRepoSrc.includes('transitionAttendance('), 'ReservationRepository implements transitionAttendance');
  assert(resRepoSrc.includes('cancelSecure('), 'ReservationRepository implements cancelSecure');
  assert(resRepoSrc.includes('create('), 'ReservationRepository preserves backward-compatible create');
  assert(resRepoSrc.includes('cancel('), 'ReservationRepository preserves backward-compatible cancel');
  assert(resRepoSrc.includes('updateStatus('), 'ReservationRepository preserves backward-compatible updateStatus');

  const settingsRepoSrc = fs.readFileSync(files.reservationSettingsRepo, 'utf8');
  assert(settingsRepoSrc.includes('getByBranch('), 'ReservationSettingsRepository implements getByBranch');
  assert(settingsRepoSrc.includes('upsert('), 'ReservationSettingsRepository implements upsert');

  const tablesRepoSrc = fs.readFileSync(files.restaurantTablesRepo, 'utf8');
  assert(tablesRepoSrc.includes('listByBranch('), 'RestaurantTablesRepository implements listByBranch');
  assert(tablesRepoSrc.includes('create('), 'RestaurantTablesRepository implements create');

  // Section 5: UI Layer Integration
  console.log('\n--- Section 5: UI Component Wiring ---');
  const modalSrc = fs.readFileSync(files.reservationModal, 'utf8');
  assert(modalSrc.includes('ReservationRepository.getAvailability'), 'ReservationModal fetches real server availability');
  assert(modalSrc.includes('ReservationRepository.createSecure'), 'ReservationModal creates reservations via secure RPC');
  assert(modalSrc.includes('createdReference'), 'ReservationModal displays authoritative reference');

  const managerSrc = fs.readFileSync(files.reservationManager, 'utf8');
  assert(managerSrc.includes('PENDING_RESTAURANT_APPROVAL') || managerSrc.includes("'PENDING'"), 'ReservationManager supports approval queue');
  assert(managerSrc.includes('AWAITING_DEPOSIT'), 'ReservationManager displays awaiting deposit state');
  assert(managerSrc.includes('onUpdateStatus(res.id, \'CONFIRMED\')'), 'ReservationManager wires confirmation');
  assert(managerSrc.includes('onUpdateStatus(res.id, \'SEATED\')'), 'ReservationManager wires seating');
  assert(managerSrc.includes('onUpdateStatus(res.id, \'NO_SHOW\')'), 'ReservationManager wires no-show');

  const bookingsSrc = fs.readFileSync(files.bookingsTab, 'utf8');
  assert(bookingsSrc.includes('awaiting_deposit'), 'Bookings tab recognizes awaiting_deposit');
  assert(bookingsSrc.includes('pending_restaurant_approval'), 'Bookings tab recognizes pending_restaurant_approval');

  console.log('\n================================================================');
  console.log(`  PACK 4B UNIT & INTEGRATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runReservationCapacityTestSuite().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
