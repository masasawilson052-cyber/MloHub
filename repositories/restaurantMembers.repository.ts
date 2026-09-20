import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantRole } from '../types/auth';
import { StaffMember } from '../components/restaurant/StaffManager';
import { runtimeConfig } from '../lib/runtimeConfig';

export class RestaurantMemberRepository {
  /**
   * List staff members strictly for the authorized restaurant tenant
   */
  public static async listByRestaurant(restaurantId: string): Promise<StaffMember[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('restaurant_members')
      .select('id, user_id, restaurant_id, role, is_active, created_at, profiles:user_id(id, full_name, email, phone)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`RestaurantMemberRepository.listByRestaurant(${restaurantId}) error:`, error.message);
      throw new Error(`Failed to list restaurant staff: ${error.message}`);
    }

    return (data || []).map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        userId: row.user_id,
        fullName: profile?.full_name || 'Staff Member',
        email: profile?.email || '',
        phone: profile?.phone || undefined,
        role: (row.role || 'STAFF') as RestaurantRole,
        isActive: row.is_active ?? true,
        joinedAt: row.created_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Update staff role with explicit tenant scoping and RLS/DB trigger enforcement
   */
  public static async updateRole(restaurantId: string, membershipId: string, newRole: RestaurantRole): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('restaurant_members')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error(`RestaurantMemberRepository.updateRole(${membershipId}) error:`, error.message);
      throw new Error(`Failed to update staff role: ${error.message}`);
    }
  }

  /**
   * Deactivate staff member with explicit tenant scoping and RLS/DB trigger enforcement
   */
  public static async deactivateMember(restaurantId: string, membershipId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { error } = await supabase
      .from('restaurant_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error(`RestaurantMemberRepository.deactivateMember(${membershipId}) error:`, error.message);
      throw new Error(`Failed to deactivate staff member: ${error.message}`);
    }
  }

  /**
   * Staff invitation is disabled in client code pending secure server workflow in Pack 4.
   * Does not use privileged keys, administrator endpoints, or synthetic accounts.
   */
  public static async inviteMember(
    restaurantId: string,
    email: string,
    role: RestaurantRole,
    fullName?: string
  ): Promise<StaffMember> {
    if (!runtimeConfig.isDemo) {
      throw new Error('Staff invitations are not available yet in this pilot build.');
    }

    // Isolated test/demo mode fixture only
    return {
      id: `mem_demo_${Date.now()}`,
      userId: `demo_user_${Date.now()}`,
      fullName: fullName || 'Demo Staff',
      email: email.trim().toLowerCase(),
      role,
      isActive: true,
      joinedAt: new Date().toISOString(),
    };
  }
}
