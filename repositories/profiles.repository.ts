import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserEntity, UserRole, WorkspaceType } from '../db/types';

export class ProfileAdminRepository {
  private static mapRowToUserEntity(row: any): UserEntity {
    const role = (row.role as UserRole) || UserRole.CUSTOMER;
    const roles = Array.isArray(row.roles) && row.roles.length > 0
      ? (row.roles as UserRole[])
      : [role];

    let activeWorkspace: WorkspaceType = 'CUSTOMER';
    if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
      activeWorkspace = 'MLOHUB_ADMIN';
    } else if (role === UserRole.RESTAURANT_OWNER || role === UserRole.RESTAURANT_STAFF) {
      activeWorkspace = 'RESTAURANT_OWNER';
    }

    return {
      id: row.id,
      fullName: row.full_name || '',
      email: row.email || '',
      phone: row.phone || '',
      passwordHash: '', // Authentication secrets are strictly never exposed to client
      role,
      roles,
      activeRole: role,
      activeWorkspace,
      status: row.status || 'ACTIVE',
      location: row.location,
      language: (row.language || row.preferred_language || 'sw') as 'en' | 'sw',
      avatarEmoji: row.avatar_emoji || '👤',
      companyOrGroup: row.company_or_group,
      dietaryPreferences: row.dietary_preferences || [],
      isPhoneVerified: !!row.is_phone_verified,
      isEmailVerified: !!row.is_email_verified,
      memberSince: row.created_at
        ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async listAll(): Promise<UserEntity[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ProfileAdminRepository.listAll error:', error.message);
      throw new Error(`Failed to load platform profiles: ${error.message}`);
    }

    return (data || []).map(this.mapRowToUserEntity);
  }

  public static async getById(userId: string): Promise<UserEntity | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error(`ProfileAdminRepository.getById(${userId}) error:`, error.message);
      throw new Error(`Failed to load user profile: ${error.message}`);
    }

    return data ? this.mapRowToUserEntity(data) : null;
  }

  public static async changeRole(
    targetUserId: string,
    newRole: UserRole,
    newAccountType: string = 'CUSTOMER'
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    // Calls server-side SECURITY DEFINER RPC enforcing caller admin authorization
    const { error } = await supabase.rpc('change_platform_role', {
      p_target_user_id: targetUserId,
      p_new_role: newRole,
      p_new_account_type: newAccountType,
    });

    if (error) {
      console.error(`ProfileAdminRepository.changeRole(${targetUserId}) error:`, error.message);
      throw new Error(`Failed to change user role: ${error.message}`);
    }
  }

  public static async findById(userId: string): Promise<UserEntity | null> {
    return this.getById(userId);
  }
}

export const ProfilesRepository = ProfileAdminRepository;
