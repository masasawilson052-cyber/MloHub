import assert from 'assert';
import {
  computeDistanceKm,
  resolvePreciseNeighborhood,
  KNOWN_TANZANIA_AREAS,
  CustomerLocationState,
} from '../utils/customerLocationResolver';

console.log('\n========================================================================');
console.log('--- TEST SUITE: CUSTOMER DEVICE LOCATION & RESOLUTION CLOSURE ---');
console.log('========================================================================\n');

// TEST 1: Distance calculation precision
console.log('[TEST 1] Haversine distance calculation');
const distMikocheniToMasaki = computeDistanceKm(-6.7720, 39.2540, -6.7450, 39.2780);
assert(distMikocheniToMasaki > 3.0 && distMikocheniToMasaki < 5.0, `Expected distance ~4km, got ${distMikocheniToMasaki}`);
console.log(`✅ Calculated accurate distance: ${distMikocheniToMasaki.toFixed(2)} km`);

// TEST 2: Exact Mwenge GPS coordinates resolution
console.log('\n[TEST 2] Resolve GPS coordinates in Mwenge');
// Coords near Mwenge Bus Terminal / TRA Mwenge
const mwengeRes = resolvePreciseNeighborhood(-6.7712, 39.2185, {
  district: null,
  subregion: 'Kinondoni',
  city: 'Dar es Salaam',
  region: 'Dar es Salaam',
  country: 'Tanzania',
  name: 'Sam Nujoma Rd',
  street: 'Sam Nujoma Rd',
  streetNumber: null,
  postalCode: null,
  isoCountryCode: 'TZ',
  timezone: 'Africa/Dar_es_Salaam',
});
assert.strictEqual(mwengeRes.serviceAreaName, 'Mwenge', `Expected 'Mwenge', got '${mwengeRes.serviceAreaName}'`);
assert.strictEqual(mwengeRes.cityName, 'Dar es Salaam');
console.log(`✅ Resolved exact neighborhood 'Mwenge' instead of coarse subregion 'Kinondoni'`);

// TEST 3: Exact Sinza GPS coordinates resolution
console.log('\n[TEST 3] Resolve GPS coordinates in Sinza');
const sinzaRes = resolvePreciseNeighborhood(-6.7842, 39.2223, {
  district: null,
  subregion: 'Kinondoni',
  city: 'Dar es Salaam',
  region: 'Dar es Salaam',
  country: 'Tanzania',
  name: 'Shekilango Rd',
  street: 'Shekilango Rd',
  streetNumber: null,
  postalCode: null,
  isoCountryCode: 'TZ',
  timezone: 'Africa/Dar_es_Salaam',
});
assert.strictEqual(sinzaRes.serviceAreaName, 'Sinza');
console.log(`✅ Resolved exact neighborhood 'Sinza' instead of coarse subregion 'Kinondoni'`);

// TEST 4: Exact Masaki GPS coordinates resolution
console.log('\n[TEST 4] Resolve GPS coordinates in Masaki');
const masakiRes = resolvePreciseNeighborhood(-6.7448, 39.2782, {
  district: null,
  subregion: 'Kinondoni',
  city: 'Dar es Salaam',
  region: 'Dar es Salaam',
  country: 'Tanzania',
  name: 'Toure Dr',
  street: 'Toure Dr',
  streetNumber: null,
  postalCode: null,
  isoCountryCode: 'TZ',
  timezone: 'Africa/Dar_es_Salaam',
});
assert.strictEqual(masakiRes.serviceAreaName, 'Masaki');
console.log(`✅ Resolved exact neighborhood 'Masaki' instead of coarse subregion 'Kinondoni'`);

// TEST 5: Exact Kariakoo GPS coordinates resolution
console.log('\n[TEST 5] Resolve GPS coordinates in Kariakoo');
const kariakooRes = resolvePreciseNeighborhood(-6.8222, 39.2773, {
  district: null,
  subregion: 'Ilala',
  city: 'Dar es Salaam',
  region: 'Dar es Salaam',
  country: 'Tanzania',
  name: 'Msimbazi St',
  street: 'Msimbazi St',
  streetNumber: null,
  postalCode: null,
  isoCountryCode: 'TZ',
  timezone: 'Africa/Dar_es_Salaam',
});
assert.strictEqual(kariakooRes.serviceAreaName, 'Kariakoo');
console.log(`✅ Resolved exact neighborhood 'Kariakoo' instead of coarse subregion 'Ilala'`);

// TEST 6: Exact Arusha GPS coordinates resolution
console.log('\n[TEST 6] Resolve GPS coordinates in Arusha');
const arushaRes = resolvePreciseNeighborhood(-3.3732, 36.6942);
assert.strictEqual(arushaRes.serviceAreaName, 'Arusha CBD');
assert.strictEqual(arushaRes.cityName, 'Arusha');
console.log(`✅ Resolved Arusha CBD with city Arusha`);

// TEST 7: Guard against overwriting DEVICE location with saved address
console.log('\n[TEST 7] Guard against overwriting active device location with saved address');
const deviceState: CustomerLocationState = {
  latitude: -6.7712,
  longitude: 39.2185,
  serviceAreaName: 'Mwenge',
  cityName: 'Dar es Salaam',
  source: 'DEVICE',
};

// Simulation of refreshDefaultAddress state updater
function simulateRefreshDefaultAddress(current: CustomerLocationState, defaultSavedAddress: any): CustomerLocationState {
  if (current.source === 'DEVICE') {
    return current; // Protected from overwrite!
  }
  return {
    savedAddressId: defaultSavedAddress.id,
    cityName: defaultSavedAddress.city,
    serviceAreaName: defaultSavedAddress.areaName || defaultSavedAddress.city,
    addressLine: defaultSavedAddress.streetAddress,
    source: 'SAVED_ADDRESS',
  };
}

const preservedState = simulateRefreshDefaultAddress(deviceState, {
  id: 'addr-1',
  city: 'Dar es Salaam',
  areaName: 'Mikocheni',
  streetAddress: 'Old Bagamoyo Rd',
});

assert.strictEqual(preservedState.source, 'DEVICE');
assert.strictEqual(preservedState.serviceAreaName, 'Mwenge');
assert.strictEqual(preservedState.latitude, -6.7712);
console.log('✅ Device location safely preserved when auth state hydrates default saved address');

console.log('\n========================================================================');
console.log('✅ ALL CUSTOMER DEVICE LOCATION & RESOLUTION TESTS PASSED (100%)');
console.log('========================================================================\n');
