import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantCustomMealSettings, CustomMealFulfillmentMode } from '../types/domain';

export class RestaurantCustomMealSettingsRepository {
  private static mapRowToSettings(row: any): RestaurantCustomMealSettings {
    return {
      restaurantId: row.restaurant_id,
      acceptsCustomMeals: row.accepts_custom_meals ?? false,
      minimumNoticeMinutes: row.minimum_notice_minutes || 120,
      minimumOrderTzs: row.minimum_order_tzs || 15000,
      maximumServings: row.maximum_servings || 50,
      maximumActiveRequests: row.maximum_active_requests || 10,
      supportedFulfillmentModes: row.supported_fulfillment_modes || ['PICKUP', 'RESTAURANT_DELIVERY'],
      supportedCuisines: row.supported_cuisines || [],
      dietaryCapabilities: row.dietary_capabilities || [],
      allergyHandlingCapabilities: row.allergy_handling_capabilities || [],
      serviceRadiusKm: row.service_radius_km || 10.0,
      serviceAreas: row.service_areas || [],
      pausedUntil: row.paused_until,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async getSettings(restaurantId: string): Promise<RestaurantCustomMealSettings | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurant_custom_meal_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      console.error(`RestaurantCustomMealSettingsRepository.getSettings(${restaurantId}) error:`, error.message);
      return null;
    }

    return data ? this.mapRowToSettings(data) : null;
  }

  public static async upsertSettings(
    settings: Partial<RestaurantCustomMealSettings> & { restaurantId: string }
  ): Promise<RestaurantCustomMealSettings> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      restaurant_id: settings.restaurantId,
      accepts_custom_meals: settings.acceptsCustomMeals ?? true,
      minimum_notice_minutes: settings.minimumNoticeMinutes ?? 120,
      minimum_order_tzs: settings.minimumOrderTzs ?? 15000,
      maximum_servings: settings.maximumServings ?? 50,
      maximum_active_requests: settings.maximumActiveRequests ?? 10,
      supported_fulfillment_modes: settings.supportedFulfillmentModes ?? ['PICKUP', 'RESTAURANT_DELIVERY'],
      supported_cuisines: settings.supportedCuisines ?? [],
      dietary_capabilities: settings.dietaryCapabilities ?? [],
      allergy_handling_capabilities: settings.allergyHandlingCapabilities ?? [],
      service_radius_km: settings.serviceRadiusKm ?? 10.0,
      service_areas: settings.serviceAreas ?? [],
      paused_until: settings.pausedUntil ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('restaurant_custom_meal_settings')
      .upsert(row)
      .select()
      .single();

    if (error) {
      console.error('RestaurantCustomMealSettingsRepository.upsertSettings error:', error.message);
      throw new Error(`Failed to save custom meal settings: ${error.message}`);
    }

    return this.mapRowToSettings(data);
  }

  public static async toggleAccepting(
    restaurantId: string,
    accepts: boolean
  ): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('restaurant_custom_meal_settings')
      .upsert({
        restaurant_id: restaurantId,
        accepts_custom_meals: accepts,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('RestaurantCustomMealSettingsRepository.toggleAccepting error:', error.message);
      throw new Error(`Failed to toggle custom meal acceptance: ${error.message}`);
    }

    return true;
  }
}
