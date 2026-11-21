/**
 * ============================================================================
 * MLOHUB RESTAURANT DECISION FACTS & HEADER TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Authoritative opening hours evaluation in Africa/Dar_es_Salaam (UTC+3)
 * 2. Regular shift, opens later, closed days, and paused restaurants
 * 3. Overnight shifts (e.g. 18:00 to 02:00)
 * 4. Device timezone invariance (Intl.DateTimeFormat with Africa/Dar_es_Salaam)
 * 5. Delivery zone matching with case-insensitivity and ward suffix tolerance
 * 6. No-matching-zone fallback handling
 * 7. Restaurant logo initials extraction
 */

import {
  evaluateOpeningStatus,
  getDarEsSalaamTime,
  OperatingHoursRow,
} from '../utils/openingStatus';
import {
  matchDeliveryZone,
  getRestaurantInitials,
} from '../utils/deliveryZoneMatcher';
import { computeDistanceKm } from '../utils/customerLocationResolver';
import { formatDistance, formatTzs } from '../utils/formatters';

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

export async function runRestaurantDecisionFactsTestSuite(): Promise<{ passed: number; failed: number }> {
  passed = 0;
  failed = 0;
  console.log('\n================================================================');
  console.log('🧪 RESTAURANT DECISION FACTS, HOURS & ZONE MATCHING SUITE');
  console.log('================================================================\n');

  // --- Group 1: Timezone & Dar es Salaam Clock Parts ---
  console.log('--- Group 1: Africa/Dar_es_Salaam Timezone Authority ---');
  // 12:00 UTC is 15:00 in Dar es Salaam (UTC+3)
  const utcNoon = new Date('2026-11-21T12:00:00.000Z');
  const eatTime = getDarEsSalaamTime(utcNoon);
  assert(eatTime.hours === 15 && eatTime.minutes === 0, '12:00 UTC resolves to 15:00 EAT');
  assert(eatTime.timeStr === '15:00', 'timeStr is correctly formatted as "15:00"');

  // 22:30 UTC on Saturday is 01:30 EAT on Sunday
  const satNightUtc = new Date('2026-11-21T22:30:00.000Z');
  const sunEat = getDarEsSalaamTime(satNightUtc);
  assert(sunEat.hours === 1 && sunEat.minutes === 30, '22:30 UTC Saturday resolves to 01:30 Sunday EAT');
  assert(sunEat.dayOfWeek === 0, 'Day of week correctly rolls over to Sunday in EAT');

  // --- Group 2: Authoritative Opening Status Evaluation ---
  console.log('\n--- Group 2: Opening Status Scenarios ---');
  // Saturday schedule: 08:00 - 22:00
  const standardHours: OperatingHoursRow[] = [
    { dayOfWeek: 6, opensAt: '08:00', closesAt: '22:00', isClosed: false },
    { dayOfWeek: 0, opensAt: '09:00', closesAt: '21:00', isClosed: false },
  ];

  // 1. Open Now: 15:00 EAT on Saturday
  const openResult = evaluateOpeningStatus(true, standardHours, 'PICKUP', utcNoon);
  assert(openResult.isOpen === true, 'Restaurant is open at 15:00 EAT');
  assert(openResult.status === 'OPEN', 'Status is "OPEN"');
  assert(openResult.labelEn === 'Open Now', 'labelEn is "Open Now"');
  assert(openResult.labelSw === 'Imefunguliwa', 'labelSw is "Imefunguliwa"');

  // 2. Opens Later: 04:30 UTC is 07:30 EAT on Saturday (opens at 08:00)
  const morningUtc = new Date('2026-11-21T04:30:00.000Z');
  const morningResult = evaluateOpeningStatus(true, standardHours, 'PICKUP', morningUtc);
  assert(morningResult.isOpen === false, 'Restaurant is not open yet at 07:30 EAT');
  assert(morningResult.status === 'OPENS_LATER', 'Status is "OPENS_LATER"');
  assert(morningResult.labelEn === 'Opens at 08:00', 'labelEn displays "Opens at 08:00"');
  assert(morningResult.labelSw === 'Inafungua saa 08:00', 'labelSw displays "Inafungua saa 08:00"');

  // 3. Closed after hours: 20:00 UTC is 23:00 EAT on Saturday (closed at 22:00)
  const nightUtc = new Date('2026-11-21T20:00:00.000Z');
  const nightResult = evaluateOpeningStatus(true, standardHours, 'PICKUP', nightUtc);
  assert(nightResult.isOpen === false, 'Restaurant is closed after 22:00');
  assert(nightResult.status === 'CLOSED', 'Status is "CLOSED"');
  assert(nightResult.labelEn === 'Closed', 'labelEn is "Closed"');
  assert(nightResult.labelSw === 'Imefungwa', 'labelSw is "Imefungwa"');

  // 4. Closed day
  const closedDayHours: OperatingHoursRow[] = [
    { dayOfWeek: 6, opensAt: '08:00', closesAt: '22:00', isClosed: true },
  ];
  const closedDayResult = evaluateOpeningStatus(true, closedDayHours, 'PICKUP', utcNoon);
  assert(closedDayResult.isOpen === false, 'Restaurant is closed on isClosed: true day');
  assert(closedDayResult.status === 'CLOSED_TODAY', 'Status is "CLOSED_TODAY"');

  // 5. Restaurant pause override: isOpen = false
  const pausedResult = evaluateOpeningStatus(false, standardHours, 'PICKUP', utcNoon);
  assert(pausedResult.isOpen === false, 'Paused restaurant returns isOpen: false');
  assert(pausedResult.isPaused === true, 'Paused restaurant returns isPaused: true');
  assert(pausedResult.status === 'PAUSED', 'Status is "PAUSED"');
  assert(
    pausedResult.labelEn === 'Not taking orders right now',
    'labelEn is "Not taking orders right now"'
  );
  assert(pausedResult.labelSw === 'Haipokei oda kwa sasa', 'labelSw is "Haipokei oda kwa sasa"');

  // --- Group 3: Overnight Shift Scenarios (e.g., 18:00 to 02:00) ---
  console.log('\n--- Group 3: Overnight Shift Scenarios ---');
  const overnightHours: OperatingHoursRow[] = [
    { dayOfWeek: 6, opensAt: '18:00', closesAt: '02:00', isClosed: false }, // Saturday night into Sunday
    { dayOfWeek: 0, opensAt: '18:00', closesAt: '02:00', isClosed: false }, // Sunday night into Monday
  ];

  // Saturday 21:00 EAT (18:00 UTC) -> Open
  const satOvernightDate = new Date('2026-11-21T18:00:00.000Z');
  const satShiftResult = evaluateOpeningStatus(true, overnightHours, 'PICKUP', satOvernightDate);
  assert(satShiftResult.isOpen === true, 'Open during overnight shift before midnight');
  assert(satShiftResult.status === 'OPEN', 'Status is "OPEN" before midnight in overnight shift');

  // Sunday 01:15 EAT (22:15 UTC Saturday) -> Open (extended from Saturday)
  const sunEarlyMorning = new Date('2026-11-21T22:15:00.000Z');
  const sunCarryoverResult = evaluateOpeningStatus(true, overnightHours, 'PICKUP', sunEarlyMorning);
  assert(sunCarryoverResult.isOpen === true, 'Open in early morning carry-over from yesterday shift');
  assert(sunCarryoverResult.status === 'OPEN', 'Status is "OPEN" after midnight in overnight shift');

  // Sunday 03:00 EAT (00:00 UTC Sunday) -> Closed (after 02:00, before next shift 18:00)
  const sunAfterClose = new Date('2026-11-22T00:00:00.000Z');
  const sunAfterCloseResult = evaluateOpeningStatus(true, overnightHours, 'PICKUP', sunAfterClose);
  assert(sunAfterCloseResult.isOpen === false, 'Closed after 02:00 close');
  assert(sunAfterCloseResult.status === 'OPENS_LATER', 'Status is "OPENS_LATER"');
  assert(sunAfterCloseResult.labelEn === 'Opens at 18:00', 'Next opens at 18:00');

  // --- Group 4: Delivery Zone & Ward Suffix Matching ---
  console.log('\n--- Group 4: Delivery Zone & Ward Matching ---');
  const mockDeliveryZones = [
    {
      id: 'zone_1',
      zoneName: 'Mikocheni Ward Zone',
      feeTzs: 2500,
      minimumOrderTzs: 5000,
      estimatedDeliveryMinutes: 30,
      supportedWards: ['Mikocheni A', 'Mikocheni B'],
    },
    {
      id: 'zone_2',
      zoneName: 'Peninsula & Oysterbay Zone',
      feeTzs: 3500,
      minimumOrderTzs: 10000,
      estimatedDeliveryMinutes: 45,
      supportedWards: ['Oysterbay', 'Masaki', 'Msasani'],
    },
  ];

  // 1. Exact ward match
  const matchExact = matchDeliveryZone(mockDeliveryZones, 'Oysterbay');
  assert(matchExact?.id === 'zone_2', 'Exact ward "Oysterbay" matches zone_2');

  // 2. Customer area "Mikocheni" matches zone with ward "Mikocheni A" (prefix tolerance)
  const matchPrefix = matchDeliveryZone(mockDeliveryZones, 'Mikocheni');
  assert(matchPrefix?.id === 'zone_1', '"Mikocheni" matches zone containing "Mikocheni A"');

  // 3. Customer area "Mikocheni A" matches zone containing "Mikocheni" (reverse suffix tolerance)
  const reverseZone = [
    { id: 'zone_rev', zoneName: 'Mikocheni Base', feeTzs: 2000, supportedWards: ['Mikocheni'] },
  ];
  const matchReverse = matchDeliveryZone(reverseZone, 'Mikocheni A');
  assert(matchReverse?.id === 'zone_rev', '"Mikocheni A" matches zone with ward "Mikocheni"');

  // 4. Case-insensitivity
  const matchCase = matchDeliveryZone(mockDeliveryZones, 'mAsAkI');
  assert(matchCase?.id === 'zone_2', 'Case-insensitive "mAsAkI" matches zone_2');

  // 5. Zone name fallback
  const matchZoneName = matchDeliveryZone(mockDeliveryZones, 'Peninsula');
  assert(matchZoneName?.id === 'zone_2', 'Area "Peninsula" matches zone name');

  // 6. Unserved area returns null
  const matchUnserved = matchDeliveryZone(mockDeliveryZones, 'Kigamboni');
  assert(matchUnserved === null, 'Unserved area "Kigamboni" returns null');

  // 7. Empty or missing customer area returns null
  assert(matchDeliveryZone(mockDeliveryZones, undefined) === null, 'Undefined customer area returns null');
  assert(matchDeliveryZone([], 'Mikocheni') === null, 'Empty zones list returns null');

  // --- Group 5: Restaurant Header Logo Initials ---
  console.log('\n--- Group 5: Restaurant Header Logo Initials ---');
  assert(getRestaurantInitials('Choma Point') === 'CP', '"Choma Point" initials are CP');
  assert(getRestaurantInitials('Mamboz') === 'MA', '"Mamboz" initials are MA');
  assert(getRestaurantInitials('Kuku & Chipsi Spot') === 'K&', '"Kuku & Chipsi Spot" initials are K&');
  assert(getRestaurantInitials('') === 'ML', 'Empty name defaults to ML');

  // --- Group 6: Distance & Formatter Helpers ---
  console.log('\n--- Group 6: Distance and Currency Formatting ---');
  // Mikocheni (-6.7720, 39.2540) to Oysterbay (-6.7680, 39.2740) ~ 2.25 km
  const dist = computeDistanceKm(-6.772, 39.254, -6.768, 39.274);
  assert(dist > 2.0 && dist < 2.5, 'Distance between Mikocheni and Oysterbay is ~2.2 km');
  assert(formatDistance(dist) === '2.3 km', 'Formatted distance is 2.3 km');
  assert(formatDistance(0.45) === '450 m', 'Sub-kilometer distance formatted as 450 m');
  assert(formatTzs(2500) === 'TZS 2,500', 'formatTzs formats 2500 as "TZS 2,500"');

  console.log(`\nRestaurant Decision Facts Suite: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}
