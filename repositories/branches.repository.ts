import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantBranch } from '../types/domain';

export class BranchRepository {
  private static mapRowToBranch(row: any): RestaurantBranch {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      address: row.address,
      region: row.region ?? '',
      district: row.district,
      ward: row.ward,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      phone: row.phone,
      openingHours: row.opening_hours || {},
      isActive: row.is_active ?? true,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async listByRestaurant(restaurantId: string): Promise<RestaurantBranch[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('restaurant_branches')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error(`BranchRepository.listByRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to list branches: ${error.message}`);
    }

    return (data || []).map(this.mapRowToBranch);
  }

  public static async getById(branchId: string): Promise<RestaurantBranch | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurant_branches')
      .select('*')
      .eq('id', branchId)
      .maybeSingle();

    if (error) {
      console.error(`BranchRepository.getById(${branchId}) error:`, error.message);
      throw new Error(`Failed to find branch: ${error.message}`);
    }

    return data ? this.mapRowToBranch(data) : null;
  }

  public static async create(branch: Partial<RestaurantBranch>): Promise<RestaurantBranch> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      restaurant_id: branch.restaurantId,
      name: branch.name,
      address: branch.address,
      region: branch.region,
      district: branch.district,
      ward: branch.ward,
      latitude: branch.latitude,
      longitude: branch.longitude,
      phone: branch.phone,
      opening_hours: branch.openingHours || {},
      is_active: branch.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('restaurant_branches')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('BranchRepository.create error:', error.message);
      throw new Error(`Failed to create branch: ${error.message}`);
    }

    return this.mapRowToBranch(data);
  }

  public static async update(branchId: string, updates: Partial<RestaurantBranch>): Promise<RestaurantBranch> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.region !== undefined) payload.region = updates.region;
    if (updates.district !== undefined) payload.district = updates.district;
    if (updates.ward !== undefined) payload.ward = updates.ward;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.openingHours !== undefined) payload.opening_hours = updates.openingHours;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('restaurant_branches')
      .update(payload)
      .eq('id', branchId)
      .select()
      .single();

    if (error) {
      console.error(`BranchRepository.update(${branchId}) error:`, error.message);
      throw new Error(`Failed to update branch: ${error.message}`);
    }

    return this.mapRowToBranch(data);
  }
}
