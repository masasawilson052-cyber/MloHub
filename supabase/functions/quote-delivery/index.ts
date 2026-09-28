import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeadersFor } from '../_shared/cors.ts';
import {
  computeDrivingRoute,
  calculateDeliveryFee,
  DEFAULT_PROVISIONAL_DELIVERY_PRICING,
  DeliveryPricingConfig,
} from '../_shared/delivery/GoogleRoutesClient.ts';
import { enforceRateLimit, getRequestIp } from '../_shared/security/rateLimit.ts';

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const jsonHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'UNAUTHORIZED' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authenticated user
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_TOKEN' }),
        { status: 401, headers: jsonHeaders }
      );
    }
    const user = authData.user;
    const clientIp = getRequestIp(req);

    // Rate Limiting (20 quotes per 5 minutes per user)
    const rateLimitResult = await enforceRateLimit(adminClient, {
      key: `user:${user.id}:quote-delivery`,
      action: 'QUOTE_DELIVERY',
      maxHits: 20,
      windowSeconds: 300,
      ipAddress: clientIp,
      identifier: user.id,
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many delivery quote requests. Please wait a moment before trying again.',
        }),
        { status: 429, headers: jsonHeaders }
      );
    }

    const body = await req.json();
    const {
      branchId,
      savedAddressId,
      destinationLatitude,
      destinationLongitude,
      deliveryZoneId,
    } = body;

    if (!branchId) {
      return new Response(
        JSON.stringify({ success: false, error: 'BRANCH_ID_REQUIRED' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    let destLat: number;
    let destLng: number;

    // If savedAddressId is provided, resolve and verify ownership
    if (savedAddressId) {
      const { data: savedAddr, error: addrError } = await adminClient
        .from('customer_saved_addresses')
        .select('id, latitude, longitude, customer_id')
        .eq('id', savedAddressId)
        .eq('customer_id', user.id)
        .maybeSingle();

      if (addrError || !savedAddr) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'SAVED_ADDRESS_NOT_FOUND',
            message: 'Saved address not found or does not belong to customer.',
          }),
          { status: 404, headers: jsonHeaders }
        );
      }

      destLat = Number(savedAddr.latitude);
      destLng = Number(savedAddr.longitude);
    } else {
      destLat = Number(destinationLatitude);
      destLng = Number(destinationLongitude);
    }

    if (
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng) ||
      destLat < -90 ||
      destLat > 90 ||
      destLng < -180 ||
      destLng > 180
    ) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_DESTINATION_COORDINATES' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // 1. Fetch branch coordinates
    const { data: branch, error: branchError } = await adminClient
      .from('restaurant_branches')
      .select('id, restaurant_id, name, latitude, longitude, is_active')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError || !branch) {
      return new Response(
        JSON.stringify({ success: false, error: 'BRANCH_NOT_FOUND' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    if (!branch.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'BRANCH_INACTIVE' }),
        { status: 409, headers: jsonHeaders }
      );
    }

    const branchLat = Number(branch.latitude);
    const branchLng = Number(branch.longitude);

    if (!Number.isFinite(branchLat) || !Number.isFinite(branchLng)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'BRANCH_LOCATION_UNCONFIGURED',
          message: 'Branch does not have physical geographic coordinates configured.',
        }),
        { status: 422, headers: jsonHeaders }
      );
    }

    // 2. Fetch branch delivery pricing configuration
    const { data: pricingData, error: pricingError } = await adminClient
      .from('branch_delivery_pricing')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (pricingError || !pricingData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DELIVERY_PRICING_NOT_CONFIGURED',
          message: 'Delivery pricing is not configured for this branch.',
        }),
        { status: 503, headers: jsonHeaders }
      );
    }

    const pricingMode = pricingData.pricing_mode || 'ROUTE_DISTANCE';

    if (pricingMode === 'FIXED_ZONE') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'FIXED_ZONE_PRICING_ACTIVE',
          message: 'This branch uses fixed zone delivery pricing instead of route quoting.',
        }),
        { status: 409, headers: jsonHeaders }
      );
    }

    if (pricingMode === 'ROUTE_DISTANCE' && !pricingData.configuration_confirmed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DELIVERY_PRICING_NOT_CONFIRMED',
          message: 'Delivery pricing configuration has not been confirmed for this branch.',
        }),
        { status: 503, headers: jsonHeaders }
      );
    }

    const pricingConfig: DeliveryPricingConfig = {
      baseFeeTzs: Number(pricingData.base_fee_tzs),
      includedDistanceMeters: Number(pricingData.included_distance_meters),
      billingIncrementMeters: Number(pricingData.billing_increment_meters),
      feePerIncrementTzs: Number(pricingData.fee_per_increment_tzs),
      minimumFeeTzs: Number(pricingData.minimum_fee_tzs),
      maximumFeeTzs: Number(pricingData.maximum_fee_tzs),
      maxDeliveryDistanceMeters: Number(pricingData.max_delivery_distance_meters),
      pricingMode: pricingData.pricing_mode,
      configurationConfirmed: Boolean(pricingData.configuration_confirmed),
    };

    // 3. Compute driving route distance & duration
    const route = await computeDrivingRoute(
      { latitude: branchLat, longitude: branchLng },
      { latitude: destLat, longitude: destLng }
    );

    // 4. Calculate delivery fee
    let deliveryFeeTzs: number;
    try {
      deliveryFeeTzs = calculateDeliveryFee(route.distanceMeters, pricingConfig);
    } catch (err: any) {
      if (err.message && err.message.includes('OUTSIDE_DELIVERY_RANGE')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'OUTSIDE_DELIVERY_RANGE',
            message: 'Selected delivery location is outside the maximum service radius for this restaurant branch.',
            distanceMeters: route.distanceMeters,
            maxDistanceMeters: pricingConfig.maxDeliveryDistanceMeters,
          }),
          { status: 422, headers: jsonHeaders }
        );
      }
      throw err;
    }

    // 5. Store quote with 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: quote, error: insertError } = await adminClient
      .from('delivery_quotes')
      .insert({
        user_id: user.id,
        branch_id: branchId,
        saved_address_id: savedAddressId || null,
        delivery_zone_id: deliveryZoneId || null,
        pickup_latitude: branchLat,
        pickup_longitude: branchLng,
        destination_latitude: destLat,
        destination_longitude: destLng,
        distance_meters: route.distanceMeters,
        duration_seconds: route.durationSeconds,
        delivery_fee_tzs: deliveryFeeTzs,
        pricing_config: pricingConfig,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError || !quote) {
      console.error('[quote-delivery] Failed to record quote:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'QUOTE_CREATION_FAILED' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        quote: {
          id: quote.id,
          branchId: quote.branch_id,
          savedAddressId: quote.saved_address_id,
          deliveryZoneId: quote.delivery_zone_id,
          pickupLatitude: quote.pickup_latitude,
          pickupLongitude: quote.pickup_longitude,
          destinationLatitude: quote.destination_latitude,
          destinationLongitude: quote.destination_longitude,
          distanceMeters: quote.distance_meters,
          durationSeconds: quote.duration_seconds,
          deliveryFeeTzs: quote.delivery_fee_tzs,
          expiresAt: quote.expires_at,
          isProvisional: !pricingConfig.configurationConfirmed,
          polyline: route.polyline,
        },
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error('[quote-delivery] Unexpected error:', err);
    const isProviderErr =
      err.message &&
      (err.message.includes('ROUTE_PROVIDER_NOT_CONFIGURED') ||
        err.message.includes('ROUTE_PROVIDER_UNAVAILABLE'));

    return new Response(
      JSON.stringify({
        success: false,
        error: isProviderErr ? err.message : 'INTERNAL_SERVER_ERROR',
        message: isProviderErr
          ? 'Server route computation service is currently unavailable.'
          : err.message,
      }),
      { status: isProviderErr ? 503 : 500, headers: jsonHeaders }
    );
  }
});
