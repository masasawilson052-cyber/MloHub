import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantRole } from '../types/auth';
import { StaffMember } from '../components/restaurant/StaffManager';

export class RestaurantMemberRepository {
  public static async acceptInvitation(token: string): Promise<{
    restaurantId: string;
    membershipId: string;
    role: RestaurantRole;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }
    const { data, error } = await supabase.rpc('accept_restaurant_invitation_secure', {
      p_invitation_token: token,
    });
    if (error) throw new Error(`Failed to accept staff invitation: ${error.message}`);
    if (!data?.success) throw new Error(data?.message || 'Invitation acceptance failed.');
    return {
      restaurantId: data.restaurant_id,
      membershipId: data.membership_id,
      role: data.role as RestaurantRole,
    };
  }

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
   * Invite a staff member to the restaurant via server-authoritative RPC.
   * Creates a pending membership record and queues an email/SMS invitation.
   * Full delivery requires external SMTP/SMS credentials to be configured.
   */
  public static async inviteMember(
    restaurantId: string,
    email: string,
    role: RestaurantRole,
    fullName?: string
  ): Promise<StaffMember> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Cannot send staff invitations.');
    }

    const { data, error } = await supabase.rpc('invite_restaurant_member_secure', {
      p_restaurant_id: restaurantId,
      p_email: email.trim().toLowerCase(),
      p_role: role,
      p_invited_full_name: fullName || null,
    });

    if (error) {
      console.error(`RestaurantMemberRepository.inviteMember error:`, error.message);
      throw new Error(`Failed to send staff invitation: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.message || 'Invitation failed for an unknown reason.');
    }

    // Return a representative pending staff member record
    return {
      id: data.membership_id,
      userId: '',
      fullName: fullName || email,
      email: email.trim().toLowerCase(),
      role,
      isActive: false,  // Inactive until the invitee accepts
      joinedAt: new Date().toISOString(),
    };
  }
}
