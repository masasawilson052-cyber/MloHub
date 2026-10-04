import { ServiceArea } from '../types/domain';

export interface CustomerLocationState {
  cityId?: string;
  cityName?: string;
  serviceAreaId?: string;
  serviceAreaName?: string;
  savedAddressId?: string;
  addressLine?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  source: 'DEVICE' | 'SAVED_ADDRESS' | 'MANUAL_AREA' | 'NONE';
}

export const ACTIVE_LOCATION_STORAGE_KEY = '@mlohub_customer_active_location';

export const DEFAULT_DAR_LOCATION: CustomerLocationState = {
  cityName: 'Dar es Salaam',
  serviceAreaName: 'Mikocheni',
  source: 'MANUAL_AREA',
};

export interface GeoAreaCandidate {
  name: string;
  cityName: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * Canonical centroids of major residential and commercial wards in Tanzania.
 * Used to accurately resolve device coordinates into real local neighborhoods
 * rather than coarse regional or district municipality boundaries (e.g. Kinondoni).
 */
export const KNOWN_TANZANIA_AREAS: GeoAreaCandidate[] = [
  // Dar es Salaam - Kinondoni Municipality
  { name: 'Masaki', cityName: 'Dar es Salaam', lat: -6.7450, lng: 39.2780, radiusKm: 3.5 },
  { name: 'Oysterbay', cityName: 'Dar es Salaam', lat: -6.7680, lng: 39.2740, radiusKm: 3.0 },
  { name: 'Mikocheni', cityName: 'Dar es Salaam', lat: -6.7720, lng: 39.2540, radiusKm: 3.5 },
  { name: 'Msasani', cityName: 'Dar es Salaam', lat: -6.7600, lng: 39.2680, radiusKm: 3.0 },
  { name: 'Kawe', cityName: 'Dar es Salaam', lat: -6.7350, lng: 39.2350, radiusKm: 3.5 },
  { name: 'Mwenge', cityName: 'Dar es Salaam', lat: -6.7710, lng: 39.2180, radiusKm: 3.0 },
  { name: 'Sinza', cityName: 'Dar es Salaam', lat: -6.7840, lng: 39.2220, radiusKm: 3.0 },
  { name: 'Kijitonyama', cityName: 'Dar es Salaam', lat: -6.7780, lng: 39.2450, radiusKm: 3.0 },
  { name: 'Kinondoni', cityName: 'Dar es Salaam', lat: -6.7900, lng: 39.2570, radiusKm: 3.0 },
  { name: 'Mwananyamala', cityName: 'Dar es Salaam', lat: -6.7850, lng: 39.2500, radiusKm: 2.5 },
  { name: 'Magomeni', cityName: 'Dar es Salaam', lat: -6.8020, lng: 39.2550, radiusKm: 2.5 },
  { name: 'Mbezi Beach', cityName: 'Dar es Salaam', lat: -6.7120, lng: 39.2240, radiusKm: 4.5 },
  { name: 'Tegeta', cityName: 'Dar es Salaam', lat: -6.6780, lng: 39.2050, radiusKm: 5.0 },
  { name: 'Kunduchi', cityName: 'Dar es Salaam', lat: -6.6700, lng: 39.2150, radiusKm: 4.0 },
  { name: 'Salasala', cityName: 'Dar es Salaam', lat: -6.6900, lng: 39.2100, radiusKm: 4.0 },
  { name: 'Boko', cityName: 'Dar es Salaam', lat: -6.6400, lng: 39.1700, radiusKm: 5.0 },
  { name: 'Bunju', cityName: 'Dar es Salaam', lat: -6.6000, lng: 39.1400, radiusKm: 6.0 },
  { name: 'Goba', cityName: 'Dar es Salaam', lat: -6.7300, lng: 39.1750, radiusKm: 5.0 },
  { name: 'Mlimani', cityName: 'Dar es Salaam', lat: -6.7760, lng: 39.2150, radiusKm: 2.5 },

  // Dar es Salaam - Ilala Municipality
  { name: 'Posta / CBD', cityName: 'Dar es Salaam', lat: -6.8160, lng: 39.2890, radiusKm: 3.5 },
  { name: 'Upanga', cityName: 'Dar es Salaam', lat: -6.8040, lng: 39.2750, radiusKm: 2.5 },
  { name: 'Kariakoo', cityName: 'Dar es Salaam', lat: -6.8220, lng: 39.2770, radiusKm: 2.5 },
  { name: 'Ilala', cityName: 'Dar es Salaam', lat: -6.8280, lng: 39.2600, radiusKm: 3.0 },
  { name: 'Tabata', cityName: 'Dar es Salaam', lat: -6.8350, lng: 39.2300, radiusKm: 4.0 },
  { name: 'Buguruni', cityName: 'Dar es Salaam', lat: -6.8250, lng: 39.2450, radiusKm: 3.0 },
  { name: 'Vingunguti', cityName: 'Dar es Salaam', lat: -6.8400, lng: 39.2400, radiusKm: 3.5 },

  // Dar es Salaam - Ubungo Municipality
  { name: 'Ubungo', cityName: 'Dar es Salaam', lat: -6.7880, lng: 39.2080, radiusKm: 3.5 },
  { name: 'Kimara', cityName: 'Dar es Salaam', lat: -6.7900, lng: 39.1750, radiusKm: 5.0 },
  { name: 'Mbezi Luis', cityName: 'Dar es Salaam', lat: -6.7800, lng: 39.1400, radiusKm: 5.0 },

  // Dar es Salaam - Kigamboni & Temeke
  { name: 'Kigamboni', cityName: 'Dar es Salaam', lat: -6.8320, lng: 39.3100, radiusKm: 6.0 },
  { name: 'Chang\'ombe', cityName: 'Dar es Salaam', lat: -6.8450, lng: 39.2750, radiusKm: 3.5 },
  { name: 'Temeke', cityName: 'Dar es Salaam', lat: -6.8600, lng: 39.2650, radiusKm: 4.0 },
  { name: 'Kurasini', cityName: 'Dar es Salaam', lat: -6.8500, lng: 39.2900, radiusKm: 3.0 },
  { name: 'Mbagala', cityName: 'Dar es Salaam', lat: -6.9000, lng: 39.2600, radiusKm: 6.0 },

  // Arusha
  { name: 'Arusha CBD', cityName: 'Arusha', lat: -3.3730, lng: 36.6940, radiusKm: 4.0 },
  { name: 'Njiro', cityName: 'Arusha', lat: -3.4080, lng: 36.7110, radiusKm: 5.0 },
  { name: 'Sakina', cityName: 'Arusha', lat: -3.3550, lng: 36.6780, radiusKm: 4.5 },

  // Zanzibar
  { name: 'Stone Town', cityName: 'Zanzibar', lat: -6.1630, lng: 39.1890, radiusKm: 3.5 },
  { name: 'Paje', cityName: 'Zanzibar', lat: -6.2660, lng: 39.5340, radiusKm: 5.0 },

  // Dodoma
  { name: 'Dodoma CBD', cityName: 'Dodoma', lat: -6.1730, lng: 35.7410, radiusKm: 5.0 },
];

/**
 * Calculates Great-Circle distance using Haversine formula
 */
export function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeocodeHints {
  district?: string | null;
  subregion?: string | null;
  name?: string | null;
  city?: string | null;
  region?: string | null;
}

/**
 * Resolves exact device coordinates into the closest specific neighborhood.
 */
export function resolvePreciseNeighborhood(
  lat: number,
  lng: number,
  reverseGeocodeResult?: GeocodeHints | null,
  dynamicAreas?: ServiceArea[]
): { serviceAreaName: string; cityName: string } {
  const candidatePool: GeoAreaCandidate[] = [...KNOWN_TANZANIA_AREAS];

  if (dynamicAreas && dynamicAreas.length > 0) {
    for (const a of dynamicAreas) {
      if (a.centerLatitude != null && a.centerLongitude != null) {
        if (!candidatePool.some((c) => c.name.toLowerCase() === a.name.toLowerCase())) {
          candidatePool.push({
            name: a.name,
            cityName: 'Dar es Salaam',
            lat: a.centerLatitude,
            lng: a.centerLongitude,
            radiusKm: a.radiusKm || 4.0,
          });
        }
      }
    }
  }

  // 1. Check if reverse geocode gave a specific neighborhood name directly
  const rawDistrict = reverseGeocodeResult?.district;
  const rawSubregion = reverseGeocodeResult?.subregion;
  const rawName = reverseGeocodeResult?.name;
  const rawCity = reverseGeocodeResult?.city || reverseGeocodeResult?.region;

  if (rawName && candidatePool.some((c) => c.name.toLowerCase() === rawName.toLowerCase())) {
    const match = candidatePool.find((c) => c.name.toLowerCase() === rawName.toLowerCase())!;
    return { serviceAreaName: match.name, cityName: match.cityName };
  }

  // 2. Find closest centroid
  let bestCandidate: GeoAreaCandidate | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidatePool) {
    const dist = computeDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestCandidate = candidate;
    }
  }

  // If closest candidate is within reasonable urban proximity (15km)
  if (bestCandidate && bestDistance <= 15) {
    return {
      serviceAreaName: bestCandidate.name,
      cityName: bestCandidate.cityName,
    };
  }

  // 3. Fallback to reverse geocode hints
  const fallbackArea = rawDistrict || rawSubregion || rawName || 'Nearby';
  const fallbackCity = rawCity || 'Dar es Salaam';

  return {
    serviceAreaName: fallbackArea,
    cityName: fallbackCity,
  };
}
