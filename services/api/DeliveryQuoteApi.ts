import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export interface GetDeliveryQuoteRequest {
  branchId: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  savedAddressId?: string;
  deliveryZoneId?: string;
}

export interface DeliveryQuoteResult {
  id: string;
  branchId: string;
  savedAddressId?: string | null;
  deliveryZoneId?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  distanceMeters: number;
  durationSeconds: number;
  deliveryFeeTzs: number;
  expiresAt: string;
  isProvisional: boolean;
  polyline?: string;
}

export interface DeliveryQuoteError {
  code: string;
  message: string;
  distanceMeters?: number;
  maxDistanceMeters?: number;
}

export class DeliveryQuoteApi {
  /**
   * Request an authoritative, route-calculated delivery quote from the server
   */
  public static async getQuote(
    request: GetDeliveryQuoteRequest
  ): Promise<DeliveryQuoteResult> {
    if (!isSupabaseConfigured()) {
      // In offline / test mode without backend: provide simulated fallback
      const dist = 3200;
      return {
        id: `mock_quote_${Date.now()}`,
        branchId: request.branchId,
        savedAddressId: request.savedAddressId || null,
        deliveryZoneId: request.deliveryZoneId || null,
        pickupLatitude: -6.7788,
        pickupLongitude: 39.2432,
        destinationLatitude: request.destinationLatitude ?? -6.7622,
        destinationLongitude: request.destinationLongitude ?? 39.2482,
        distanceMeters: dist,
        durationSeconds: 1200,
        deliveryFeeTzs: 2500,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        isProvisional: true,
      };
    }

    const { data, error } = await supabase.functions.invoke('quote-delivery', {
      body: request,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.success) {
      const err = new Error(
        data?.message || data?.error || 'Failed to calculate delivery quote.'
      ) as Error & { code?: string; distanceMeters?: number; maxDistanceMeters?: number };
      err.code = data?.error;
      err.distanceMeters = data?.distanceMeters;
      err.maxDistanceMeters = data?.maxDistanceMeters;
      throw err;
    }

    return data.quote as DeliveryQuoteResult;
  }

  /**
   * Formats distance in meters into human-readable kilometers (e.g. "3.2 km")
   */
  public static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters} m`;
    }
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
  }

  /**
   * Formats duration in seconds into human-readable transit estimate (e.g. "20-25 mins")
   */
  public static formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes <= 15) {
      return '10-15 mins';
    }
    const lower = Math.floor(minutes / 5) * 5;
    const upper = lower + 5;
    return `${lower}-${upper} mins`;
  }
}
