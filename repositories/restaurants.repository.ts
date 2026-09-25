import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Restaurant } from '../types/domain';

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
      isActive: row.is_active ?? true,
      verificationStatus: row.verification_status || 'PENDING_VERIFICATION',
      tinNumber: row.tin_number,
      businessLicenseNumber: row.business_license_number,
      payoutPhoneNumber: row.payout_phone_number,
      payoutProvider: row.payout_provider,
      openingHours: row.opening_hours ?? '',
      closingHours: row.closing_hours ?? '',
      logoUrl: row.logo_url,
      coverImageUrl: row.cover_image_url,
      foodSpotPhotos: row.food_spot_photos || [],
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

    // Graceful backward-compatibility fallback if database hasn't executed migration 20260923000003 yet
    if (error && (error.code === '42703' || error.message?.includes('archived_at'))) {
      let fallbackQuery = supabase.from('restaurants').select('*');
      if (filters?.customerVisibleOnly) {
        fallbackQuery = fallbackQuery
          .eq('is_active', true)
          .eq('is_published', true)
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
      const fallbackRes = await fallbackQuery.order('rating', { ascending: false });
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      console.error('RestaurantRepository.list error:', error.message);
      throw new Error(`Failed to load restaurants: ${error.message}`);
    }

    const mapped = (data || []).map(this.mapRowToRestaurant);

    if (filters?.customerVisibleOnly) {
      return mapped.filter(
        (r) =>
          r.isActive !== false &&
          r.isPublished === true &&
          r.verificationStatus !== 'SUSPENDED' &&
          r.verificationStatus !== 'REJECTED' &&
          !r.isSuspended &&
          !r.archivedAt &&
          !(r.name || '').toUpperCase().startsWith('[DELETED]')
      );
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
      const { data, error } = await supabase
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

      if (error) {
        console.warn('RestaurantRepository.listBookable query notice:', error.message);
        return await this.list({ customerVisibleOnly: true });
      }

      const uniqueMap = new Map<string, any>();
      (data || []).forEach((row: any) => {
        if (row.restaurants && !uniqueMap.has(row.restaurants.id)) {
          uniqueMap.set(row.restaurants.id, row.restaurants);
        }
      });

      return Array.from(uniqueMap.values())
        .map(this.mapRowToRestaurant)
        .filter(
          (r) =>
            r.isActive !== false &&
            r.isPublished === true &&
            r.verificationStatus !== 'SUSPENDED' &&
            r.verificationStatus !== 'REJECTED' &&
            !r.isSuspended &&
            !r.archivedAt &&
            !(r.name || '').toUpperCase().startsWith('[DELETED]')
        );
    } catch (err: any) {
      console.warn('RestaurantRepository.listBookable error:', err.message);
      return await this.list({ customerVisibleOnly: true });
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
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_open: false,
          is_published: false,
          is_active: false,
          verification_status: 'SUSPENDED',
          archived_at: new Date().toISOString(),
          archive_reason: cleanReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) {
        const { error: fallbackErr } = await supabase
          .from('restaurants')
          .update({
            is_open: false,
            is_verified: false,
            is_published: false,
            is_active: false,
            verification_status: 'SUSPENDED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (fallbackErr) {
          console.error('RestaurantRepository.archiveRestaurant error:', error.message);
          throw new Error(`Failed to archive restaurant: ${error.message}`);
        }
      }
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
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_active: true,
          verification_status: 'VERIFIED',
          archived_at: null,
          archive_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) {
        const { error: fallbackErr } = await supabase
          .from('restaurants')
          .update({
            is_active: true,
            is_verified: true,
            verification_status: 'VERIFIED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (fallbackErr) {
          console.error('RestaurantRepository.unarchiveRestaurant error:', error.message);
          throw new Error(`Failed to reinstate restaurant: ${error.message}`);
        }
      }
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
    if (updates.payoutPhoneNumber !== undefined) rowUpdates.payout_phone_number = updates.payoutPhoneNumber;
    if (updates.payoutProvider !== undefined) rowUpdates.payout_provider = updates.payoutProvider;

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
      // Fallback 1: Legacy Stage 3 RPC (public.suspend_restaurant)
      const { error: legacyRpcErr } = await supabase.rpc('suspend_restaurant', {
        p_restaurant_id: restaurantId,
        p_reason: cleanReason,
      });

      // Fallback 2 / Authoritative state sync: ensure is_published=false, is_active=false, is_open=false, verification_status='SUSPENDED'
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_open: false,
          is_verified: false,
          is_published: false,
          is_active: false,
          verification_status: 'SUSPENDED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (legacyRpcErr && updateErr) {
        const { error: minimalUpdateErr } = await supabase
          .from('restaurants')
          .update({
            is_open: false,
            is_verified: false,
            verification_status: 'SUSPENDED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', restaurantId);

        if (minimalUpdateErr) {
          console.error(`RestaurantRepository.suspendRestaurant(${restaurantId}) error:`, error.message);
          throw new Error(`Failed to suspend restaurant: ${error.message}`);
        }
      }
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
      // Fallback 1: Legacy Stage 3 RPC (public.reactivate_restaurant)
      const { error: legacyRpcErr } = await supabase.rpc('reactivate_restaurant', {
        p_restaurant_id: restaurantId,
      });

      // Fallback 2 / Authoritative state sync: restore active + verified status
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_open: true,
          is_verified: true,
          is_published: true,
          is_active: true,
          verification_status: 'VERIFIED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (legacyRpcErr && updateErr) {
        const { error: minimalUpdateErr } = await supabase
          .from('restaurants')
          .update({
            is_open: true,
            is_verified: true,
            verification_status: 'VERIFIED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', restaurantId);

        if (minimalUpdateErr) {
          console.error(`RestaurantRepository.reactivateRestaurant(${restaurantId}) error:`, error.message);
          throw new Error(`Failed to reactivate restaurant: ${error.message}`);
        }
      }
    }
  }

  /**
   * Verify restaurant via server-side security definer RPC
   */
  public static async verifyRestaurant(
    restaurantId: string,
    tinNumber: string,
    businessLicenseNumber: string,
    reason?: string
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase.rpc('verify_restaurant_secure', {
      p_restaurant_id: restaurantId,
      p_tin_number: tinNumber,
      p_business_license_number: businessLicenseNumber,
      p_reason: reason || 'Documents verified',
    });

    if (error) {
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          tin_number: tinNumber,
          business_license_number: businessLicenseNumber,
          is_verified: true,
          verification_status: 'VERIFIED',
          seller_tier: 'VERIFIED_SELLER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (updateErr) {
        console.error(`RestaurantRepository.verifyRestaurant(${restaurantId}) error:`, error.message);
        throw new Error(`Failed to verify restaurant: ${error.message}`);
      }
    }
  }

  /**
   * Publish restaurant via server-side security definer RPC
   * Requires at least one active branch and one available menu item with pricing
   */
  public static async publishRestaurant(restaurantId: string): Promise<{ success: boolean; restaurantId: string; isPublished: boolean }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('publish_restaurant', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      if (error.message?.includes('400 Bad Request') || error.message?.includes('403 Forbidden')) {
        console.error(`RestaurantRepository.publishRestaurant(${restaurantId}) error:`, error.message);
        throw new Error(error.message);
      }

      // Fallback when RPC is unavailable or caller authenticated via credential bridge:
      // 1. Check that the restaurant is not suspended by administration
      const { data: currentRest } = await supabase
        .from('restaurants')
        .select('verification_status')
        .eq('id', restaurantId)
        .maybeSingle();

      if (currentRest?.verification_status === 'SUSPENDED') {
        throw new Error('403 Forbidden: Cannot publish a suspended restaurant. Please contact platform administration.');
      }

      // 2. Verify active branch and available priced menu item before updating public.restaurants
      const [{ data: branchRows }, { data: itemRows }] = await Promise.all([
        supabase
          .from('restaurant_branches')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('menu_items')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('is_archived', false)
          .eq('is_available', true)
          .gt('price_tzs', 0)
          .limit(1),
      ]);

      if (!branchRows || branchRows.length === 0) {
        throw new Error('400 Bad Request: Restaurant must have at least one active branch before publication.');
      }
      if (!itemRows || itemRows.length === 0) {
        throw new Error('400 Bad Request: Restaurant must have at least one available menu item with a valid price before publication.');
      }

      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_published: true,
          is_open: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (updateErr) {
        console.error(`RestaurantRepository.publishRestaurant(${restaurantId}) error:`, error.message);
        throw new Error(error.message);
      }
    }

    return {
      success: true,
      restaurantId: (data as any)?.restaurant_id || restaurantId,
      isPublished: true,
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
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({
          is_published: false,
          is_open: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurantId);

      if (updateErr) {
        console.error(`RestaurantRepository.unpublishRestaurant(${restaurantId}) error:`, error.message);
        throw new Error(error.message);
      }
    }
  }
}
