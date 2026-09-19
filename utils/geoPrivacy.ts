/**
 * Stage 11: Privacy-Preserving Geographic Coarsening Utility
 * Strips precise GPS coordinates and snaps user searches to municipal ward centroids.
 * Guarantees zero precise location tracking in analytics data layers.
 */

import { TRUST_RULES } from '../config/trustRules';
import { CoarsenedLocation } from '../types/analytics';

/**
 * Calculates haversine distance in kilometers between two lat/lng coordinates.
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
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

/**
 * Snaps raw GPS coordinates to the nearest authorized municipal ward centroid.
 * Never stores or returns the raw input coordinates.
 */
export function coarsenLocation(
  rawLat?: number | null,
  rawLng?: number | null,
  fallbackWard = 'City Centre / Posta'
): CoarsenedLocation {
  if (rawLat == null || rawLng == null || isNaN(rawLat) || isNaN(rawLng)) {
    const defaultCentroid = TRUST_RULES.DARES_SALAAM_CENTROIDS.find(
      (c) => c.name === fallbackWard
    ) || TRUST_RULES.DARES_SALAAM_CENTROIDS[0];
    return {
      wardName: defaultCentroid.name,
      latitude: defaultCentroid.latitude,
      longitude: defaultCentroid.longitude,
    };
  }

  let nearest: (typeof TRUST_RULES.DARES_SALAAM_CENTROIDS)[number] =
    TRUST_RULES.DARES_SALAAM_CENTROIDS[0];
  let minDistance = Infinity;

  for (const centroid of TRUST_RULES.DARES_SALAAM_CENTROIDS) {
    const dist = haversineDistanceKm(
      rawLat,
      rawLng,
      centroid.latitude,
      centroid.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearest = centroid;
    }
  }

  return {
    wardName: nearest.name,
    latitude: nearest.latitude,
    longitude: nearest.longitude,
  };
}

/**
 * Sanitizes search query string: trims, lowercases, removes excessive whitespace.
 */
export function normalizeSearchQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
