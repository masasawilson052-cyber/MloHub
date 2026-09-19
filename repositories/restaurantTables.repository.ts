import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantTable, AreaPreference } from '../types/domain';

export class RestaurantTablesRepository {
  private static mapRowToTable(row: any): RestaurantTable {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      label: row.label,
      capacity: row.capacity,
      area: row.area || 'INDOOR',
      isActive: row.is_active ?? true,
      notes: row.notes,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async listByBranch(branchId: string): Promise<RestaurantTable[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('capacity', { ascending: true });

    if (error) {
      console.error('RestaurantTablesRepository.listByBranch error:', error.message);
      throw new Error(`Failed to list tables: ${error.message}`);
    }

    return (data || []).map(this.mapRowToTable);
  }

  public static async create(table: {
    restaurantId: string;
    branchId: string;
    label: string;
    capacity: number;
    area?: AreaPreference;
    notes?: string;
  }): Promise<RestaurantTable> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert({
        restaurant_id: table.restaurantId,
        branch_id: table.branchId,
        label: table.label,
        capacity: table.capacity,
        area: table.area || 'INDOOR',
        notes: table.notes,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('RestaurantTablesRepository.create error:', error.message);
      throw new Error(`Failed to create table: ${error.message}`);
    }

    return this.mapRowToTable(data);
  }
}
