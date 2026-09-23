import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Restaurant } from '../types/domain';

export class RestaurantRepository {
  private static DELETED_IDS_STORAGE_KEY = 'mlohub_deleted_restaurant_ids';

  public static async getDeletedIds(): Promise<Set<string>> {
    try {
      const raw = await AsyncStorage.getItem(RestaurantRepository.DELETED_IDS_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set();
  }

  public static async recordDeletedId(id: string): Promise<void> {
    try {
      const set = await RestaurantRepository.getDeletedIds();
      set.add(id);
      await AsyncStorage.setItem(
        RestaurantRepository.DELETED_IDS_STORAGE_KEY,
        JSON.stringify(Array.from(set))
      );
    } catch {}
  }
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
  }): Promise<Restaurant[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    let query = supabase.from('restaurants').select('*');

    if (filters?.publishedOnly === true) {
      query = query.eq('is_published', true);
    }
    if (filters?.verifiedOnly) {
      query = query.eq('is_verified', true);
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

    const { data, error } = await query.order('rating', { ascending: false });
    if (error) {
      console.error('RestaurantRepository.list error:', error.message);
      throw new Error(`Failed to load restaurants: ${error.message}`);
    }

    const deletedIds = await RestaurantRepository.getDeletedIds();

    const FAKE_SAMPLE_IDENTIFIERS = [
      'mama amina',
      'bahari swahili',
      'kibo mchemsho',
      'kibo peak',
    ];

    const cleanRows = (data || []).filter((row: any) => {
      const name = (row.name || '').toLowerCase();
      const slug = (row.slug || '').toLowerCase();
      const id = (row.id || '').toLowerCase();

      // Check deleted storage
      if (deletedIds.has(row.id) || deletedIds.has(id)) {
        return false;
      }

      // Check deleted name/slug marker
      if (name.startsWith('[deleted]') || slug.startsWith('deleted-')) {
        return false;
      }

      return !FAKE_SAMPLE_IDENTIFIERS.some((fake) =>
        name.includes(fake) || slug.includes(fake) || id.includes(fake)
      );
    });

    return cleanRows.map(this.mapRowToRestaurant);
  }

  /**
   * Delete restaurant by ID
   */
  public static async deleteRestaurant(id: string): Promise<void> {
    // 1. Immediately record in persistent deleted IDs
    await RestaurantRepository.recordDeletedId(id);

    if (!isSupabaseConfigured()) return;

    // 2. Try server-side security definer RPC first
    const { error: rpcError } = await supabase.rpc('admin_delete_restaurant', {
      p_restaurant_id: id,
    });

    if (!rpcError) {
      return;
    }

    // 3. Direct deletion with child reference cleanup
    try {
      await Promise.allSettled([
        supabase.from('tax_withholding_records').delete().eq('restaurant_id', id),
        supabase.from('platform_commission_records').delete().eq('restaurant_id', id),
        supabase.from('merchant_payouts').delete().eq('restaurant_id', id),
        supabase.from('merchant_settlement_batches').delete().eq('restaurant_id', id),
        supabase.from('financial_disputes').delete().eq('restaurant_id', id),
        supabase.from('refund_requests').delete().eq('restaurant_id', id),
        supabase.from('merchant_ledger_balances').delete().eq('restaurant_id', id),
        supabase.from('merchant_payout_destinations').delete().eq('restaurant_id', id),
        supabase.from('restaurant_applications').update({ restaurant_id: null }).eq('restaurant_id', id),
        supabase.from('restaurant_branches').delete().eq('restaurant_id', id),
        supabase.from('restaurant_memberships').delete().eq('restaurant_id', id),
        supabase.from('menu_categories').delete().eq('restaurant_id', id),
        supabase.from('menu_items').delete().eq('restaurant_id', id),
        supabase.from('reviews').delete().eq('restaurant_id', id),
      ]);
    } catch {
      // Continue to direct deletion
    }

    const { data: deletedRows, error: deleteErr } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id)
      .select();

    // 4. Fallback: If direct delete was blocked by RLS (0 rows affected or error)
    if (deleteErr || !deletedRows || deletedRows.length === 0) {
      console.warn(`Direct delete did not remove row (${deleteErr?.message || '0 rows'}), marking as [DELETED].`);
      await supabase
        .from('restaurants')
        .update({
          name: `[DELETED] ${id}`,
          slug: `deleted-${id}-${Date.now()}`,
          is_open: false,
          is_verified: false,
          is_published: false,
          verification_status: 'SUSPENDED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
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

    const { error } = await supabase.rpc('suspend_restaurant', {
      p_restaurant_id: restaurantId,
      p_reason: reason,
    });

    if (error) {
      console.error(`RestaurantRepository.suspendRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to suspend restaurant: ${error.message}`);
    }
  }

  /**
   * Reactivate restaurant via server-side security definer RPC
   */
  public static async reactivateRestaurant(restaurantId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase.rpc('reactivate_restaurant', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error(`RestaurantRepository.reactivateRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to reactivate restaurant: ${error.message}`);
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
      console.error(`RestaurantRepository.publishRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(error.message);
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
      console.error(`RestaurantRepository.unpublishRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(error.message);
    }
  }
}
