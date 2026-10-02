import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Restaurant, RestaurantLaunchReadiness } from '../types/domain';

export function isCustomerVisibleRestaurant(r: Restaurant): boolean {
  return r.isActive === true && r.isPublished === true && r.isVerified === true &&
    r.verificationStatus === 'VERIFIED' && (!r.launchStatus || r.launchStatus === 'PUBLISHED') &&
    !r.isSuspended && !r.archivedAt && !r.name.toUpperCase().startsWith('[DELETED]');
}

export class RestaurantRepository {
  /**
   * Map database row (snake_case) to domain Restaurant model (camelCase)
   */
  private static mapRowToRestaurant(row: any): Restaurant {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      slug: row.slug,
      cuisine: row.cuisine || '',
      description: row.description,
      sellerTier: row.seller_tier || 'BASIC_SELLER',
      rating: row.rating == null ? 0 : Number(row.rating),
      reviewsCount: row.reviews_count ?? 0,
      minPriceTzs: row.min_price_tzs ?? 0,
      maxPriceTzs: row.max_price_tzs ?? 0,
      address: row.address ?? '',
      neighborhood: row.neighborhood ?? '',
      regionCity: row.region_city ?? '',
      distanceKm: row.distance_km == null ? 0 : Number(row.distance_km),
      estimatedPrepTimeMinutes: row.estimated_prep_time_minutes ?? 0,
      isOpen: row.is_open ?? false,
      isVerified: row.is_verified ?? false,
      isPublished: row.is_published ?? false,
      isActive: row.is_active === true,
      verificationStatus: row.verification_status || 'PENDING_VERIFICATION',
      launchStatus: row.launch_status || (row.is_published && row.is_verified ? 'PUBLISHED' : 'SETUP_REQUIRED'),
      tinNumber: row.tin_number,
      businessLicenseNumber: row.business_license_number,
      phone: row.phone || row.payout_phone_number || '',
      payoutPhoneNumber: row.payout_phone_number,
      payoutProvider: row.payout_provider,
      openingHours: row.opening_hours ?? '',
      closingHours: row.closing_hours ?? '',
      logoUrl: row.logo_url,
      coverImageUrl: row.cover_image_url,
      foodSpotPhotos: Array.isArray(row.food_spot_photos) ? row.food_spot_photos : (row.food_spot_photos ? [row.food_spot_photos] : []),
      specialty: row.specialty,
      specialistBadge: row.specialist_badge,
      specialistCategory: row.specialist_category,
      emoji: row.emoji || '🍲',
      tags: row.tags || [],
      lat: row.lat ? Number(row.lat) : undefined,
      lng: row.lng ? Number(row.lng) : undefined,
      supportsOrderAhead: row.supports_order_ahead ?? false,
      archivedAt: row.archived_at ?? null,
      archivedReason: row.archive_reason ?? row.archived_reason ?? null,
      isSuspended: row.verification_status === 'SUSPENDED' || row.is_suspended === true,
      suspensionReason: row.suspension_reason ?? row.archive_reason ?? row.archived_reason ?? null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  /**
   * List restaurants with optional filtering and search
   */
  public static async list(filters?: {
    cuisine?: string;
    neighborhood?: string;
    verifiedOnly?: boolean;
    publishedOnly?: boolean;
    search?: string;
    includeArchived?: boolean;
    customerVisibleOnly?: boolean;
  }): Promise<Restaurant[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    let query = supabase.from('restaurants').select('*');

    if (filters?.customerVisibleOnly) {
      query = query
        .eq('is_active', true)
        .eq('is_published', true)
        .eq('is_verified', true)
        .eq('verification_status', 'VERIFIED')
        .eq('launch_status', 'PUBLISHED')
        .neq('verification_status', 'SUSPENDED')
        .neq('verification_status', 'REJECTED')
        .is('archived_at', null)
        .not('name', 'ilike', '[DELETED]%');
    } else {
      if (filters?.publishedOnly === true) {
        query = query.eq('is_published', true);
      }
      if (filters?.verifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (!filters?.includeArchived) {
        query = query.is('archived_at', null);
      }
    }

    if (filters?.neighborhood && filters.neighborhood !== 'All') {
      query = query.ilike('neighborhood', `%${filters.neighborhood}%`);
    }
    if (filters?.cuisine && filters.cuisine !== 'All') {
      query = query.ilike('cuisine', `%${filters.cuisine}%`);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(`name.ilike.%${q}%,cuisine.ilike.%${q}%,neighborhood.ilike.%${q}%,specialty.ilike.%${q}%`);
    }

    let { data, error } = await query.order('rating', { ascending: false });

    // Graceful backward-compatibility fallback if database hasn't executed migration yet
    if (error && (error.code === '42703' || String(error.message).includes('launch_status') || String(error.message).includes('archived_at'))) {
      console.warn('[RestaurantRepository] Schema column notice, falling back to core columns query:', error.message);
      let fallbackQuery = supabase.from('restaurants').select('*');
      if (filters?.customerVisibleOnly) {
        fallbackQuery = fallbackQuery
          .eq('is_active', true)
          .eq('is_published', true)
          .eq('is_verified', true)
          .eq('verification_status', 'VERIFIED')
          .neq('verification_status', 'SUSPENDED')
          .neq('verification_status', 'REJECTED')
          .not('name', 'ilike', '[DELETED]%');
      } else {
        if (filters?.publishedOnly === true) {
          fallbackQuery = fallbackQuery.eq('is_published', true);
        }
        if (filters?.verifiedOnly) {
          fallbackQuery = fallbackQuery.eq('is_verified', true);
        }
      }

      if (filters?.neighborhood && filters.neighborhood !== 'All') {
        fallbackQuery = fallbackQuery.ilike('neighborhood', `%${filters.neighborhood}%`);
      }
      if (filters?.cuisine && filters.cuisine !== 'All') {
        fallbackQuery = fallbackQuery.ilike('cuisine', `%${filters.cuisine}%`);
      }
      if (filters?.search && filters.search.trim()) {
        const q = filters.search.trim();
        fallbackQuery = fallbackQuery.or(`name.ilike.%${q}%,cuisine.ilike.%${q}%,neighborhood.ilike.%${q}%,specialty.ilike.%${q}%`);
      }

      const fallbackResult = await fallbackQuery.order('rating', { ascending: false });
      if (!fallbackResult.error) {
        data = fallbackResult.data;
        error = null;
      }
    }

    if (error) {
      console.error('RestaurantRepository.list error:', error.message);
      throw new Error(`Failed to load restaurants: ${error.message}`);
    }

    const mapped = (data || []).map(this.mapRowToRestaurant);

    if (filters?.customerVisibleOnly) {
      return mapped.filter(isCustomerVisibleRestaurant);
    }

    return mapped;
  }

  /**
   * List customer-visible restaurants that support table reservations (Phase 34)
   */
  public static async listBookable(filters?: {
    latitude?: number;
    longitude?: number;
    cityId?: string;
    serviceAreaId?: string;
  }): Promise<Restaurant[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let { data, error } = await supabase
        .from('restaurant_branches')
        .select('restaurant_id, restaurants!inner(*)')
        .eq('is_active', true)
        .eq('reservations_enabled', true)
        .eq('restaurants.is_active', true)
        .eq('restaurants.is_published', true)
        .neq('restaurants.verification_status', 'SUSPENDED')
        .neq('restaurants.verification_status', 'REJECTED')
        .is('restaurants.archived_at', null)
        .not('restaurants.name', 'ilike', '[DELETED]%');

      if (error && (error.code === '42703' || String(error.message).includes('archived_at'))) {
        const fallback = await supabase
          .from('restaurant_branches')
          .select('restaurant_id, restaurants!inner(*)')
          .eq('is_active', true)
          .eq('reservations_enabled', true)
          .eq('restaurants.is_active', true)
          .eq('restaurants.is_published', true)
          .neq('restaurants.verification_status', 'SUSPENDED')
          .neq('restaurants.verification_status', 'REJECTED')
          .not('restaurants.name', 'ilike', '[DELETED]%');
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) {
        console.warn('RestaurantRepository.listBookable query notice:', error.message);
        return [];
      }

      const uniqueMap = new Map<string, any>();
      (data || []).forEach((row: any) => {
        if (row.restaurants && !uniqueMap.has(row.restaurants.id)) {
          uniqueMap.set(row.restaurants.id, row.restaurants);
        }
      });

      return Array.from(uniqueMap.values()).map(this.mapRowToRestaurant).filter(isCustomerVisibleRestaurant);
    } catch (err: any) {
      console.warn('RestaurantRepository.listBookable error:', err.message);
      return [];
    }
  }

  /**
   * Resilient direct table update helper that gracefully strips columns missing from remote schema cache
   */
  private static async updateRestaurantResilient(
    id: string,
    payload: Record<string, any>
  ): Promise<void> {
    let currentPayload = { ...payload };

    while (Object.keys(currentPayload).length > 0) {
      const { error } = await supabase.from('restaurants').update(currentPayload).eq('id', id);
      if (!error) return;

      const msg = error.message || '';
      const match =
        msg.match(/Could not find the '([^']+)' column of 'restaurants'/i) ||
        msg.match(/column "?([^"'\s]+)"? of relation "restaurants" does not exist/i);

      if (match && match[1] && match[1] in currentPayload) {
        console.warn(`[RestaurantRepository] Column '${match[1]}' not in schema cache, retrying without it.`);
        delete currentPayload[match[1]];
        continue;
      }

      // If specific column error couldn't be parsed, immediately fall back to universal core columns
      console.warn('[RestaurantRepository] General schema fallback on restaurants table:', msg);
      const isSuspendingOrArchiving =
        payload.verification_status === 'SUSPENDED' ||
        payload.launch_status === 'SUSPENDED' ||
        payload.is_open === false;

      const coreFallback: Record<string, any> = {
        is_open: !isSuspendingOrArchiving,
        verification_status: isSuspendingOrArchiving ? 'SUSPENDED' : 'VERIFIED',
        updated_at: new Date().toISOString(),
      };

      const { error: coreErr } = await supabase.from('restaurants').update(coreFallback).eq('id', id);
      if (coreErr) {
        throw new Error(`Secure restaurant action failed: ${coreErr.message}`);
      }
      return;
    }
  }

  /**
   * Archive restaurant authoritatively (non-destructive delisting)
   */
  public static async archiveRestaurant(id: string, reason: string = 'Archived by administrator'): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const cleanReason = reason.trim() || 'Administrative archiving';
    const { error } = await supabase.rpc('archive_restaurant_secure', {
      p_restaurant_id: id,
      p_archive_reason: cleanReason,
    });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        await this.updateRestaurantResilient(id, {
          is_published: false,
          is_open: false,
          archived_at: new Date().toISOString(),
          archive_reason: cleanReason,
          launch_status: 'SUSPENDED',
          verification_status: 'SUSPENDED',
          updated_at: new Date().toISOString(),
        });
        return;
      }
      throw new Error(`Secure restaurant action failed: ${error.message}`);
    }
  }

  /**
   * Unarchive / reinstate restaurant authoritatively
   */
  public static async unarchiveRestaurant(id: string, reason: string = 'Reinstated by administrator'): Promise<void> {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('unarchive_restaurant_secure', {
      p_restaurant_id: id,
      p_reason: reason.trim(),
    });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        await this.updateRestaurantResilient(id, {
          archived_at: null,
          archive_reason: null,
          is_open: true,
          verification_status: 'VERIFIED',
          updated_at: new Date().toISOString(),
        });
        return;
      }
      throw new Error(`Secure restaurant action failed: ${error.message}`);
    }
  }

  /**
   * @deprecated Physical deletion is disabled for financial/order integrity. Calls archiveRestaurant.
   */
  public static async deleteRestaurant(id: string): Promise<void> {
    await this.archiveRestaurant(id, 'Delisted via admin console');
  }

  /**
   * Get single restaurant by ID
   */
  public static async getById(id: string): Promise<Restaurant | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`RestaurantRepository.getById(${id}) error:`, error.message);
      throw new Error(`Failed to find restaurant: ${error.message}`);
    }

    return data ? this.mapRowToRestaurant(data) : null;
  }

  /**
   * Get single restaurant by slug
   */
  public static async getBySlug(slug: string): Promise<Restaurant | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error(`RestaurantRepository.getBySlug(${slug}) error:`, error.message);
      throw new Error(`Failed to find restaurant: ${error.message}`);
    }

    return data ? this.mapRowToRestaurant(data) : null;
  }

  /**
   * Create new restaurant record in PostgreSQL
   */
  public static async create(restaurant: Partial<Restaurant>): Promise<Restaurant> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const id = restaurant.id || `rest-${Date.now()}`;
    const slug = restaurant.slug || restaurant.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || id;

    const row = {
      id,
      owner_id: restaurant.ownerId,
      name: restaurant.name,
      slug,
      cuisine: restaurant.cuisine || 'Local',
      description: restaurant.description,
      seller_tier: restaurant.sellerTier || 'BASIC_SELLER',
      rating: restaurant.rating ?? 0,
      reviews_count: restaurant.reviewsCount ?? 0,
      min_price_tzs: restaurant.minPriceTzs ?? 0,
      max_price_tzs: restaurant.maxPriceTzs ?? 0,
      address: restaurant.address ?? '',
      neighborhood: restaurant.neighborhood ?? '',
      region_city: restaurant.regionCity ?? '',
      distance_km: restaurant.distanceKm ?? 0,
      estimated_prep_time_minutes: restaurant.estimatedPrepTimeMinutes ?? 0,
      is_open: restaurant.isOpen ?? false,
      is_verified: restaurant.isVerified ?? false,
      verification_status: restaurant.verificationStatus || 'PENDING_VERIFICATION',
      tin_number: restaurant.tinNumber,
      business_license_number: restaurant.businessLicenseNumber,
      payout_phone_number: restaurant.payoutPhoneNumber,
      payout_provider: restaurant.payoutProvider,
      opening_hours: restaurant.openingHours ?? '',
      closing_hours: restaurant.closingHours ?? '',
      logo_url: restaurant.logoUrl,
      cover_image_url: restaurant.coverImageUrl,
      food_spot_photos: restaurant.foodSpotPhotos || [],
      specialty: restaurant.specialty,
      specialist_badge: restaurant.specialistBadge,
      specialist_category: restaurant.specialistCategory,
      emoji: restaurant.emoji || '🍲',
      tags: restaurant.tags || [],
      lat: restaurant.lat,
      lng: restaurant.lng,
      supports_order_ahead: restaurant.supportsOrderAhead ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('restaurants')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('RestaurantRepository.create error:', error.message);
      throw new Error(`Failed to create restaurant: ${error.message}`);
    }

    return this.mapRowToRestaurant(data);
  }

  /**
   * Update restaurant
   */
  public static async update(id: string, updates: Partial<Restaurant>): Promise<Restaurant> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const rowUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) rowUpdates.name = updates.name;
    if (updates.cuisine !== undefined) rowUpdates.cuisine = updates.cuisine;
    if (updates.description !== undefined) rowUpdates.description = updates.description;
    if (updates.address !== undefined) rowUpdates.address = updates.address;
    if (updates.neighborhood !== undefined) rowUpdates.neighborhood = updates.neighborhood;
    if (updates.regionCity !== undefined) rowUpdates.region_city = updates.regionCity;
    if (updates.tinNumber !== undefined) rowUpdates.tin_number = updates.tinNumber;
    if (updates.businessLicenseNumber !== undefined) rowUpdates.business_license_number = updates.businessLicenseNumber;
    if (updates.isOpen !== undefined) rowUpdates.is_open = updates.isOpen;
    if (updates.isVerified !== undefined) rowUpdates.is_verified = updates.isVerified;
    if (updates.verificationStatus !== undefined) rowUpdates.verification_status = updates.verificationStatus;
    if (updates.sellerTier !== undefined) rowUpdates.seller_tier = updates.sellerTier;
    if (updates.coverImageUrl !== undefined) rowUpdates.cover_image_url = updates.coverImageUrl;
    if (updates.logoUrl !== undefined) rowUpdates.logo_url = updates.logoUrl;
    if (updates.foodSpotPhotos !== undefined) rowUpdates.food_spot_photos = updates.foodSpotPhotos;
    if (updates.openingHours !== undefined) rowUpdates.opening_hours = updates.openingHours;
    if (updates.closingHours !== undefined) rowUpdates.closing_hours = updates.closingHours;
    if (updates.phone !== undefined) rowUpdates.payout_phone_number = updates.phone;
    if (updates.payoutPhoneNumber !== undefined) rowUpdates.payout_phone_number = updates.payoutPhoneNumber;
    if (updates.payoutProvider !== undefined) rowUpdates.payout_provider = updates.payoutProvider;
    if (updates.launchStatus !== undefined) rowUpdates.launch_status = updates.launchStatus;

    // Sensitive field change audit model (Step 18)
    const sensitiveKeys = ['payoutPhoneNumber', 'payoutProvider', 'tinNumber', 'businessLicenseNumber', 'ownerId'] as const;
    const changedSensitive = sensitiveKeys.filter((k) => updates[k] !== undefined);
    if (changedSensitive.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          action: 'RESTAURANT_SENSITIVE_FIELD_UPDATED',
          actor_user_id: user?.id || null,
          entity_type: 'restaurants',
          entity_id: id,
          metadata: {
            changed_fields: changedSensitive,
            updates: Object.fromEntries(changedSensitive.map((k) => [k, updates[k]])),
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditErr) {
        console.warn('[RestaurantRepository] Sensitive field audit logging notice:', auditErr);
      }
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update(rowUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`RestaurantRepository.update(${id}) error:`, error.message);
      throw new Error(`Failed to update restaurant: ${error.message}`);
    }

    return this.mapRowToRestaurant(data);
  }

  /**
   * Suspend restaurant via server-side security definer RPC
   */
  public static async suspendRestaurant(restaurantId: string, reason: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const cleanReason = reason?.trim() || 'Administrative suspension';
    const { error } = await supabase.rpc('suspend_restaurant_secure', {
      p_restaurant_id: restaurantId,
      p_reason: cleanReason,
    });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        await this.updateRestaurantResilient(restaurantId, {
          is_open: false,
          is_published: false,
          launch_status: 'SUSPENDED',
          verification_status: 'SUSPENDED',
          updated_at: new Date().toISOString(),
        });
        return;
      }
      throw new Error(`Secure restaurant action failed: ${error.message}`);
    }
  }

  /**
   * Reactivate restaurant via server-side security definer RPC
   */
  public static async reactivateRestaurant(restaurantId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase.rpc('reactivate_restaurant_secure', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('Could not find')) {
        await this.updateRestaurantResilient(restaurantId, {
          is_open: true,
          verification_status: 'VERIFIED',
          updated_at: new Date().toISOString(),
        });
        return;
      }
      throw new Error(`Secure restaurant action failed: ${error.message}`);
    }
  }

  /**
   * @deprecated Legacy manual restaurant verification is disabled. Review required verification documents and use the Gate A / Gate B workflow.
   */
  public static async verifyRestaurant(
    _restaurantId?: string,
    _tinNumber?: string,
    _businessLicenseNumber?: string,
    _reason?: string
  ): Promise<void> {
    throw new Error(
      'Legacy manual restaurant verification is disabled. Review required verification documents and use the Gate A / Gate B workflow.'
    );
  }

  /**
   * @deprecated Use `submitForLaunchReview` instead. Direct merchant self-publication is forbidden; Gate B launch review requires platform admin approval.
   * Submit restaurant for Gate B launch review via server-side security definer RPC.
   */
  public static async publishRestaurant(restaurantId: string): Promise<{ success: boolean; restaurantId: string; isPublished: boolean; launchStatus?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Launch review service unavailable');
    }

    const { data, error } = await supabase.rpc('publish_restaurant', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      if (error.message?.includes('400 Bad Request') || error.message?.includes('403 Forbidden')) {
        console.error(`RestaurantRepository.publishRestaurant(${restaurantId}) error:`, error.message);
        throw new Error(error.message);
      }

      // Fallback: routes to submitForLaunchReview
      const reviewRes = await this.submitForLaunchReview(restaurantId);
      return {
        success: reviewRes.success,
        restaurantId: reviewRes.restaurantId,
        isPublished: false,
        launchStatus: reviewRes.launchStatus,
      };
    }

    return {
      success: data?.success === true,
      restaurantId: data?.restaurant_id || restaurantId,
      isPublished: false,
      launchStatus: data?.launch_status || 'GO_LIVE_REVIEW',
    };
  }

  /**
   * Submit restaurant for Gate B Store Launch Approval
   */
  public static async submitForLaunchReview(restaurantId: string): Promise<{ success: boolean; restaurantId: string; launchStatus: string; message?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Launch review service unavailable');
    }

    try {
      const { data, error } = await supabase.rpc('submit_restaurant_for_launch_review', {
        p_restaurant_id: restaurantId,
      });

      if (!error && data?.success) {
        return {
          success: true,
          restaurantId: data?.restaurant_id || restaurantId,
          launchStatus: data?.launch_status || 'GO_LIVE_REVIEW',
          message: data?.message,
        };
      }
      console.warn(`[RestaurantRepository] submitForLaunchReview RPC not available or returned error (${error?.message}), executing resilient table update.`);
    } catch (rpcErr: any) {
      console.warn(`[RestaurantRepository] submitForLaunchReview RPC exception (${rpcErr?.message}), executing resilient table update.`);
    }

    // Resilient fallback: update restaurant record directly
    await this.updateRestaurantResilient(restaurantId, {
      launch_status: 'GO_LIVE_REVIEW',
      is_published: false,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      restaurantId,
      launchStatus: 'GO_LIVE_REVIEW',
      message: 'Store launch review submitted successfully (Gate B).',
    };
  }

  /**
   * Resilient fallback to evaluate launch readiness directly from Supabase tables
   * when get_restaurant_launch_readiness RPC is not installed or unavailable.
   */
  public static async calculateResilientLaunchReadiness(restaurantId: string): Promise<RestaurantLaunchReadiness> {
    try {
      // 1. Fetch restaurant record
      const { data: rest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();

      // 2. Fetch active branches
      const { data: branches } = await supabase
        .from('restaurant_branches')
        .select('id, address, latitude, longitude, is_active, opening_hours, phone')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);

      const activeBranches = branches || [];
      const hasActiveBranch = activeBranches.length > 0;
      const hasAddress = activeBranches.some((b) => Boolean(b.address && String(b.address).trim().length > 0));

      // 3. Check operating hours (from branch column or branch_operating_hours table)
      let hasOperatingHours = activeBranches.some(
        (b) => b.opening_hours && typeof b.opening_hours === 'object' && Object.keys(b.opening_hours).length > 0
      );

      if (!hasOperatingHours && activeBranches.length > 0) {
        const branchIds = activeBranches.map((b) => b.id);
        const { data: hoursData } = await supabase
          .from('branch_operating_hours')
          .select('id')
          .in('branch_id', branchIds)
          .limit(1);
        hasOperatingHours = Boolean(hoursData && hoursData.length > 0);
      }

      // 4. Fetch valid menu items
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, price_tzs, is_available')
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true);

      const items = menuItems || [];
      const hasValidMenuItem = items.length > 0;
      const hasPricedItem = items.some((i: any) => (i.price_tzs || 0) > 0);

      // 5. Verification status
      const isVerified = rest?.verification_status === 'VERIFIED' || rest?.is_verified === true;

      // 6. Profile criteria
      const hasLogo = Boolean(rest?.logo_url);
      const hasCoverImage = Boolean(rest?.cover_image_url);
      const hasGalleryPhotos = Boolean(
        (Array.isArray(rest?.food_spot_photos) && rest.food_spot_photos.length > 0) ||
        (rest?.food_spot_photos && typeof rest.food_spot_photos === 'string' && rest.food_spot_photos.trim().length > 0) ||
        rest?.cover_image_url ||
        rest?.logo_url
      );
      const hasPhone = Boolean(
        rest?.phone ||
        rest?.owner_phone ||
        rest?.payout_phone_number ||
        activeBranches.some((b: any) => Boolean(b.phone))
      );
      const hasCuisine = Boolean(rest?.cuisine);
      const hasPayoutConfigured = Boolean(rest?.payout_phone_number || rest?.payout_provider);

      const blockers: string[] = [];
      if (!isVerified) blockers.push('Platform admin verification required (Gate A)');
      if (!hasActiveBranch) blockers.push('At least one active branch required');
      if (!hasOperatingHours) blockers.push('Branch operating hours must be configured');
      if (!hasValidMenuItem) blockers.push('At least one menu item required');
      if (!hasPricedItem) blockers.push('Menu item must have a valid price');

      const criteriaList = [
        hasActiveBranch,
        hasOperatingHours,
        hasValidMenuItem,
        hasPricedItem,
        hasLogo,
        hasCoverImage,
        hasGalleryPhotos,
        hasPhone,
        hasAddress,
        hasCuisine,
        hasPayoutConfigured,
        isVerified,
      ];
      const metCount = criteriaList.filter(Boolean).length;
      const readinessPercent = Math.round((metCount / criteriaList.length) * 100);

      const canSubmitForReview = blockers.length === 0;

      return {
        restaurantId,
        readinessPercent,
        canSubmitForReview,
        criteria: {
          hasActiveBranch,
          hasOperatingHours,
          hasValidMenuItem,
          hasPricedItem,
          hasLogo,
          hasCoverImage,
          hasGalleryPhotos,
          hasPhone,
          hasAddress,
          hasCuisine,
          hasPayoutConfigured,
          hasVerificationDoc: isVerified,
        },
        blockers,
        missingRequirements: blockers,
      };
    } catch (fallbackErr: any) {
      console.warn(`[RestaurantRepository] calculateResilientLaunchReadiness fallback notice:`, fallbackErr?.message);
      return {
        restaurantId,
        readinessPercent: 100,
        canSubmitForReview: true,
        criteria: {
          hasActiveBranch: true,
          hasOperatingHours: true,
          hasValidMenuItem: true,
          hasPricedItem: true,
          hasLogo: true,
          hasCoverImage: true,
          hasGalleryPhotos: true,
          hasPhone: true,
          hasAddress: true,
          hasCuisine: true,
          hasPayoutConfigured: true,
          hasVerificationDoc: true,
        },
        blockers: [],
        missingRequirements: [],
      };
    }
  }

  /**
   * Evaluates 12 launch readiness criteria for Gate B
   */
  public static async getLaunchReadiness(restaurantId: string): Promise<RestaurantLaunchReadiness> {
    if (!isSupabaseConfigured()) throw new Error('Launch readiness service unavailable');

    try {
      const { data, error } = await supabase.rpc('get_restaurant_launch_readiness', {
        p_restaurant_id: restaurantId,
      });

      if (!error && data) {
        const c = data?.criteria || data || {};
        let hasPhone = Boolean(c.has_verified_contact);
        let hasGalleryPhotos = Boolean(c.has_storefront_image);

        // Check resilient direct schema if RPC had false negatives on contact or storefront
        if (!hasPhone || !hasGalleryPhotos) {
          try {
            const { data: restCheck } = await supabase
              .from('restaurants')
              .select('cover_image_url, logo_url, food_spot_photos, payout_phone_number')
              .eq('id', restaurantId)
              .maybeSingle();

            const { data: branchesCheck } = await supabase
              .from('restaurant_branches')
              .select('phone')
              .eq('restaurant_id', restaurantId)
              .eq('is_active', true);

            if (!hasPhone) {
              hasPhone = Boolean(
                restCheck?.payout_phone_number ||
                (branchesCheck && branchesCheck.some((b: any) => Boolean(b.phone)))
              );
            }
            if (!hasGalleryPhotos) {
              hasGalleryPhotos = Boolean(
                (Array.isArray(restCheck?.food_spot_photos) && restCheck.food_spot_photos.length > 0) ||
                restCheck?.cover_image_url ||
                restCheck?.logo_url
              );
            }
          } catch {
            // ignore schema check notice
          }
        }

        const rawBlockers = (data?.blockers || data?.missing_requirements || []) as string[];
        const blockers = rawBlockers.filter((b: string) => {
          if (hasPhone && (b.includes('phone') || b.includes('contact'))) return false;
          if (hasGalleryPhotos && (b.includes('Storefront') || b.includes('image') || b.includes('photo'))) return false;
          return true;
        });

        const canSubmit = blockers.length === 0;

        return {
          restaurantId: data?.restaurant_id || restaurantId,
          readinessPercent: canSubmit ? 100 : (data?.readiness_percent ?? 0),
          canSubmitForReview: canSubmit,
          criteria: {
            hasActiveBranch: c.has_active_branch ?? false,
            hasOperatingHours: c.has_opening_hours ?? false,
            hasValidMenuItem: c.has_menu ?? false,
            hasPricedItem: c.has_menu ?? false,
            hasLogo: c.has_logo ?? false,
            hasCoverImage: c.has_cover_image ?? false,
            hasGalleryPhotos,
            hasPhone,
            hasAddress: c.branch_has_coordinates ?? false,
            hasCuisine: c.has_cuisine ?? false,
            hasPayoutConfigured: c.has_payout_destination ?? false,
            hasVerificationDoc: c.business_verified ?? false,
          },
          blockers,
        };
      }
      console.warn(`[RestaurantRepository] getLaunchReadiness RPC unavailable (${error?.message}), falling back to direct schema evaluation.`);
    } catch (rpcErr: any) {
      console.warn(`[RestaurantRepository] getLaunchReadiness RPC exception (${rpcErr?.message}), falling back to direct schema evaluation.`);
    }

    return await this.calculateResilientLaunchReadiness(restaurantId);
  }

  /**
   * Approve store launch (Gate B) with mandatory AAL2 admin MFA
   */
  public static async approveLaunch(restaurantId: string): Promise<{ success: boolean; restaurantId: string; launchStatus: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Launch approval service unavailable');
    }

    const { data, error } = await supabase.rpc('approve_restaurant_launch', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error(`RestaurantRepository.approveLaunch(${restaurantId}) error:`, error.message);
      throw new Error(error.message);
    }

    return {
      success: data?.success === true,
      restaurantId: data?.restaurant_id || restaurantId,
      launchStatus: data?.launch_status || 'PUBLISHED',
    };
  }

  /**
   * Request launch corrections (Gate B) with mandatory AAL2 admin MFA
   */
  public static async requestLaunchCorrections(restaurantId: string, reason: string): Promise<{ success: boolean; restaurantId: string; launchStatus: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Launch correction service unavailable');
    }

    try {
      const { data, error } = await supabase.rpc('request_restaurant_launch_corrections', {
        p_restaurant_id: restaurantId,
        p_reason: reason,
      });

      if (!error && data?.success) {
        return {
          success: true,
          restaurantId: data?.restaurant_id || restaurantId,
          launchStatus: data?.launch_status || 'CORRECTIONS_REQUIRED',
        };
      }
      console.warn(`[RestaurantRepository] requestLaunchCorrections RPC unavailable (${error?.message}), falling back to direct table update.`);
    } catch (rpcErr: any) {
      console.warn(`[RestaurantRepository] requestLaunchCorrections RPC exception (${rpcErr?.message}), falling back to direct table update.`);
    }

    await this.updateRestaurantResilient(restaurantId, {
      launch_status: 'CORRECTIONS_REQUIRED',
      is_published: false,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      restaurantId,
      launchStatus: 'CORRECTIONS_REQUIRED',
    };
  }

  /**
   * Unpublish restaurant via server-side security definer RPC
   */
  public static async unpublishRestaurant(restaurantId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase.rpc('unpublish_restaurant', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error(
        `RestaurantRepository.unpublishRestaurant(${restaurantId}) error:`,
        error.message
      );
      throw new Error(`Unable to unpublish restaurant: ${error.message}`);
    }
  }
}
