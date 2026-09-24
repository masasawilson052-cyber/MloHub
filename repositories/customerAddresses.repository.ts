import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CustomerSavedAddress, ServiceCity, ServiceArea } from '../types/domain';

export class CustomerAddressesRepository {
  private static mapRowToAddress(row: any): CustomerSavedAddress {
    return {
      id: row.id,
      customerId: row.customer_id,
      label: row.label || 'Home',
      streetAddress: row.street_address,
      deliveryInstructions: row.delivery_instructions,
      city: row.city || 'Dar es Salaam',
      areaName: row.area_name,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static async list(customerId: string): Promise<CustomerSavedAddress[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('customer_saved_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('CustomerAddressesRepository.list error:', error.message);
      throw new Error(`Failed to load addresses: ${error.message}`);
    }

    return (data || []).map(this.mapRowToAddress);
  }

  public static async create(params: {
    customerId: string;
    label: string;
    streetAddress: string;
    deliveryInstructions?: string;
    city?: string;
    areaName?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  }): Promise<CustomerSavedAddress> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('customer_saved_addresses')
      .insert({
        customer_id: params.customerId,
        label: params.label,
        street_address: params.streetAddress,
        delivery_instructions: params.deliveryInstructions || null,
        city: params.city || 'Dar es Salaam',
        area_name: params.areaName || null,
        latitude: params.latitude || null,
        longitude: params.longitude || null,
        is_default: Boolean(params.isDefault),
      })
      .select('*')
      .single();

    if (error) {
      console.error('CustomerAddressesRepository.create error:', error.message);
      throw new Error(`Failed to save address: ${error.message}`);
    }

    return this.mapRowToAddress(data);
  }

  public static async update(
    id: string,
    customerId: string,
    updates: Partial<{
      label: string;
      streetAddress: string;
      deliveryInstructions: string;
      city: string;
      areaName: string;
      latitude: number;
      longitude: number;
      isDefault: boolean;
    }>
  ): Promise<CustomerSavedAddress> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.label !== undefined) payload.label = updates.label;
    if (updates.streetAddress !== undefined) payload.street_address = updates.streetAddress;
    if (updates.deliveryInstructions !== undefined) payload.delivery_instructions = updates.deliveryInstructions;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.areaName !== undefined) payload.area_name = updates.areaName;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;

    const { data, error } = await supabase
      .from('customer_saved_addresses')
      .update(payload)
      .eq('id', id)
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (error) {
      console.error('CustomerAddressesRepository.update error:', error.message);
      throw new Error(`Failed to update address: ${error.message}`);
    }

    return this.mapRowToAddress(data);
  }

  public static async delete(id: string, customerId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('customer_saved_addresses')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    if (error) {
      console.error('CustomerAddressesRepository.delete error:', error.message);
      throw new Error(`Failed to delete address: ${error.message}`);
    }

    return true;
  }

  public static async setDefault(id: string, customerId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    // Unset all defaults for customer first, then set target
    await supabase
      .from('customer_saved_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);

    const { error } = await supabase
      .from('customer_saved_addresses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', customerId);

    if (error) {
      console.error('CustomerAddressesRepository.setDefault error:', error.message);
      throw new Error(`Failed to set default address: ${error.message}`);
    }

    return true;
  }

  public static async listServiceCities(): Promise<ServiceCity[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('service_cities')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('CustomerAddressesRepository.listServiceCities error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      region: row.region || 'Tanzania',
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    }));
  }

  public static async listServiceAreas(cityId?: string): Promise<ServiceArea[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('service_areas')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (cityId) {
      query = query.eq('city_id', cityId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('CustomerAddressesRepository.listServiceAreas error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      cityId: row.city_id,
      name: row.name,
      centerLatitude: row.center_latitude != null ? Number(row.center_latitude) : null,
      centerLongitude: row.center_longitude != null ? Number(row.center_longitude) : null,
      radiusKm: Number(row.radius_km || 5),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    }));
  }
}
