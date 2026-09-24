import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CustomerDietaryPreference } from '../types/domain';

export class DietaryRepository {
  public static async getByCustomer(customerId: string): Promise<CustomerDietaryPreference | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('customer_dietary_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      console.error('DietaryRepository.getByCustomer error:', error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      spiceLevel: data.spice_level || 'MEDIUM',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public static async save(params: {
    customerId: string;
    preferences: string[];
    allergies: string[];
    spiceLevel?: 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
  }): Promise<CustomerDietaryPreference> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('customer_dietary_preferences')
      .upsert(
        {
          customer_id: params.customerId,
          preferences: params.preferences,
          allergies: params.allergies,
          spice_level: params.spiceLevel || 'MEDIUM',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('DietaryRepository.save error:', error.message);
      throw new Error(`Failed to save dietary preferences: ${error.message}`);
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      spiceLevel: data.spice_level || 'MEDIUM',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
