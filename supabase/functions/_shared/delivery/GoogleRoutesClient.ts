/**
 * Server-Side Authoritative Google Routes Client for MloHub
 *
 * Calls the Google Routes Directions API (v2:computeRoutes) exclusively from the server.
 * NEVER exposed to Expo client or client-side bundles.
 * Simulation / Geodesic estimation is STRICTLY prohibited in production.
 */

export interface LatLngCoordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryPricingConfig {
  baseFeeTzs: number;
  includedDistanceMeters: number;
  billingIncrementMeters: number;
  feePerIncrementTzs: number;
  minimumFeeTzs: number;
  maximumFeeTzs: number;
  maxDeliveryDistanceMeters: number;
  pricingMode?: 'ROUTE_DISTANCE' | 'FIXED_ZONE';
  configurationConfirmed?: boolean;
}

export interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  isSimulated?: boolean;
}

export const DEFAULT_PROVISIONAL_DELIVERY_PRICING: DeliveryPricingConfig = {
  baseFeeTzs: 2000,
  includedDistanceMeters: 2000, // 2 km included in base fee
  billingIncrementMeters: 1000, // per 1 km thereafter
  feePerIncrementTzs: 500, // +500 TZS per km
  minimumFeeTzs: 2000,
  maximumFeeTzs: 15000,
  maxDeliveryDistanceMeters: 25000, // 25 km maximum delivery radius
  pricingMode: 'ROUTE_DISTANCE',
  configurationConfirmed: false,
};

/**
 * Calculates Haversine great-circle distance between two coordinates in meters
 */
export function calculateHaversineDistanceMeters(
  coord1: LatLngCoordinates,
  coord2: LatLngCoordinates
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Pure server-authoritative delivery fee calculation function.
 *
 * Rules:
 * 1. If distanceMeters > maxDeliveryDistanceMeters -> Throws OUTSIDE_DELIVERY_RANGE error.
 * 2. Billable meters = max(0, distanceMeters - includedDistanceMeters).
 * 3. Increments = ceil(billableMeters / billingIncrementMeters).
 * 4. Raw fee = baseFeeTzs + increments * feePerIncrementTzs.
 * 5. Final fee is clamped between minimumFeeTzs and maximumFeeTzs.
 */
export function calculateDeliveryFee(
  distanceMeters: number,
  config: DeliveryPricingConfig = DEFAULT_PROVISIONAL_DELIVERY_PRICING
): number {
  if (distanceMeters > config.maxDeliveryDistanceMeters) {
    throw new Error(
      `OUTSIDE_DELIVERY_RANGE: Distance (${Math.round(distanceMeters / 1000)}km) exceeds maximum delivery radius (${Math.round(config.maxDeliveryDistanceMeters / 1000)}km).`
    );
  }

  const billableMeters = Math.max(0, distanceMeters - config.includedDistanceMeters);
  const increments = config.billingIncrementMeters > 0
    ? Math.ceil(billableMeters / config.billingIncrementMeters)
    : 0;

  const rawFee = config.baseFeeTzs + increments * config.feePerIncrementTzs;
  const clampedFee = Math.min(
    config.maximumFeeTzs,
    Math.max(config.minimumFeeTzs, rawFee)
  );

  return Math.round(clampedFee);
}

function getEnv(name: string): string | undefined {
  try {
    if (typeof (globalThis as any).Deno !== 'undefined') {
      return (globalThis as any).Deno.env.get(name);
    }
  } catch {}
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Simulated road calculation for local non-production testing ONLY.
 * Explicitly prohibited in production.
 */
export function simulateRoute(
  origin: LatLngCoordinates,
  destination: LatLngCoordinates
): RouteCalculationResult {
  const geodesicMeters = calculateHaversineDistanceMeters(origin, destination);
  const roadDistanceMeters = Math.round(geodesicMeters * 1.35);
  const transitSeconds = Math.round(roadDistanceMeters / 6.67) + 300;

  return {
    distanceMeters: roadDistanceMeters,
    durationSeconds: Math.max(300, transitSeconds),
    isSimulated: true,
  };
}

/**
 * Computes driving route distance and duration using Google Routes API v2.
 * Fails closed in production if Google Routes is unavailable or unconfigured.
 */
export async function computeDrivingRoute(
  origin: LatLngCoordinates,
  destination: LatLngCoordinates
): Promise<RouteCalculationResult> {
  const routeMode = getEnv('DELIVERY_ROUTE_MODE') || 'GOOGLE';
  const environment = getEnv('APP_ENV') || getEnv('NODE_ENV') || 'development';
  const simulationAllowed = routeMode === 'SIMULATED' && environment !== 'production';

  const apiKey = getEnv('GOOGLE_ROUTES_API_KEY');
  if (!apiKey || apiKey.trim().length === 0) {
    if (!simulationAllowed) {
      throw new Error('ROUTE_PROVIDER_NOT_CONFIGURED');
    }
    return simulateRoute(origin, destination);
  }

  try {
    const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const route = data.routes?.[0];
      if (route && typeof route.distanceMeters === 'number') {
        const durationSeconds = parseInt(
          String(route.duration || '0').replace('s', ''),
          10
        );
        return {
          distanceMeters: route.distanceMeters,
          durationSeconds: Math.max(300, durationSeconds || 600),
          polyline: route.polyline?.encodedPolyline,
          isSimulated: false,
        };
      }
    }

    const errorText = await res.text().catch(() => '');
    console.warn(`[GoogleRoutesClient] Routes API returned ${res.status}: ${errorText}`);

    if (!simulationAllowed) {
      throw new Error('ROUTE_PROVIDER_UNAVAILABLE');
    }

    return simulateRoute(origin, destination);
  } catch (err: any) {
    if (err?.message && (err.message.includes('ROUTE_PROVIDER_UNAVAILABLE') || err.message.includes('ROUTE_PROVIDER_NOT_CONFIGURED'))) {
      throw err;
    }
    console.warn('[GoogleRoutesClient] Error connecting to Google Routes API:', err);
    if (!simulationAllowed) {
      throw new Error('ROUTE_PROVIDER_UNAVAILABLE');
    }
    return simulateRoute(origin, destination);
  }
}
