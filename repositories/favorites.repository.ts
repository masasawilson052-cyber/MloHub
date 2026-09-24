import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CustomerFavoriteRestaurant } from '../types/domain';

export class FavoritesRepository {
  public static async listFavorites(customerId: string): Promise<string[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('customer_favorite_restaurants')
      .select('restaurant_id')
      .eq('customer_id', customerId);

    if (error) {
      console.error('FavoritesRepository.listFavorites error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => row.restaurant_id);
  }

  public static async isFavorite(customerId: string, restaurantId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data, error } = await supabase
      .from('customer_favorite_restaurants')
      .select('id')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      console.error('FavoritesRepository.isFavorite error:', error.message);
      return false;
    }

    return Boolean(data);
  }

  public static async addFavorite(customerId: string, restaurantId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('customer_favorite_restaurants')
      .insert({
        customer_id: customerId,
        restaurant_id: restaurantId,
      });

    if (error && error.code !== '23505') { // Ignore unique conflict
      console.error('FavoritesRepository.addFavorite error:', error.message);
      throw new Error(`Failed to add favorite: ${error.message}`);
    }

    return true;
  }

  public static async removeFavorite(customerId: string, restaurantId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('customer_favorite_restaurants')
      .delete()
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error('FavoritesRepository.removeFavorite error:', error.message);
      throw new Error(`Failed to remove favorite: ${error.message}`);
    }

    return true;
  }
}
