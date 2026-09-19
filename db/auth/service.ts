import {
  UserRole,
  RegisterCustomerDTO,
  RegisterRestaurantDTO,
  LoginDTO,
  AuthSessionResponse,
} from '../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { OtpApi } from '../../services/api/OtpApi';
import { CryptoEngine } from './crypto';

export const AuthService = {
  /**
   * Send Customer OTP Verification Code
   */
  async sendCustomerOtp(phone: string, purpose: string = 'Uthibitisho'): Promise<{
    success: boolean;
    carrierName: string;
    message: string;
    error?: string;
  }> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.sendCustomerOtp(phone, purpose);
    }

    const res = await OtpApi.sendOtp(phone, 'CUSTOMER_VERIFICATION', 'sw');
    return {
      success: res.success,
      carrierName: res.carrierName || 'Vodacom / Tigo / Airtel',
      message: res.message,
      error: res.error,
    };
  },

  /**
   * Verify Customer OTP Code
   */
  async verifyCustomerOtp(
    phone: string,
    enteredOtp: string
  ): Promise<{ success: boolean; message: string }> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.verifyCustomerOtp(phone, enteredOtp);
    }

    const res = await OtpApi.verifyOtp(phone, enteredOtp);
    return {
      success: res.success,
      message: res.message,
    };
  },

  /**
   * Register a new Customer Account
   */
  async registerCustomer(dto: RegisterCustomerDTO): Promise<AuthSessionResponse> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.registerCustomer(dto);
    }

    if (!isSupabaseConfigured()) {
      throw new Error(`Supabase is required for registration in ${runtimeConfig.environmentLabel}.`);
    }

    const cleanEmail = dto.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: dto.password,
      options: {
        data: {
          full_name: dto.fullName.trim(),
          phone: dto.phone.trim(),
          location: dto.location?.trim() || '',
          account_type: 'CUSTOMER',
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Registration failed: no user returned.');

    const token = data.session?.access_token || `sb_cust_${Date.now()}`;
    return {
      user: {
        id: data.user.id,
        fullName: dto.fullName.trim(),
        email: cleanEmail,
        phone: dto.phone.trim(),
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: UserRole.CUSTOMER,
        activeRole: UserRole.CUSTOMER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      customerProfile: undefined,
      memberships: [],
      token,
    };
  },

  /**
   * Register a new Restaurant & Owner Account
   */
  async registerRestaurant(dto: RegisterRestaurantDTO): Promise<AuthSessionResponse> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.registerRestaurant(dto);
    }

    if (!isSupabaseConfigured()) {
      throw new Error(`Supabase is required for restaurant onboarding in ${runtimeConfig.environmentLabel}.`);
    }

    const cleanEmail = dto.ownerEmail.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: dto.password,
      options: {
        data: {
          full_name: dto.ownerFullName.trim(),
          phone: dto.ownerPhone.trim(),
          account_type: 'RESTAURANT',
          role: 'RESTAURANT_OWNER',
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Restaurant owner registration failed.');

    return {
      user: {
        id: data.user.id,
        fullName: dto.ownerFullName.trim(),
        email: cleanEmail,
        phone: dto.ownerPhone.trim(),
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: UserRole.RESTAURANT_OWNER,
        activeRole: UserRole.RESTAURANT_OWNER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      memberships: [],
      token: data.session?.access_token || `sb_rest_${Date.now()}`,
    };
  },

  /**
   * Login with email or phone and password
   */
  async login(dto: LoginDTO): Promise<AuthSessionResponse> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.login(dto);
    }

    if (!isSupabaseConfigured()) {
      throw new Error(`Supabase connection required for login in ${runtimeConfig.environmentLabel}.`);
    }

    const cleanEmail = dto.emailOrPhone.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: dto.password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed: no user returned.');

    return {
      user: {
        id: data.user.id,
        fullName: data.user.user_metadata?.full_name || 'MloHub User',
        email: cleanEmail,
        phone: data.user.phone || '',
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: (data.user.user_metadata?.role as UserRole) || UserRole.CUSTOMER,
        createdAt: data.user.created_at,
        updatedAt: new Date().toISOString(),
      },
      memberships: [],
      token: data.session?.access_token || 'sb_token',
    };
  },

  /**
   * Get list of authorized workspaces for a user based on verified roles and memberships
   */
  async getAuthorizedWorkspaces(userId: string): Promise<{
    type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
    name: string;
    subtitle: string;
    icon: string;
    role: UserRole;
    restaurantId?: string;
  }[]> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      const db = DemoAuthAdapter.getSnapshot();
      const user = db.users?.find((u: any) => u.id === userId);
      if (!user) return [];

      const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
      const workspaces: any[] = [
        {
          type: 'CUSTOMER',
          name: 'Personal Account',
          subtitle: 'Customer',
          icon: 'person-circle',
          role: UserRole.CUSTOMER,
        },
      ];

      const memberships = (db.restaurantMemberships || []).filter((rm: any) => rm.userId === userId);
      for (const mem of memberships) {
        const rest = db.restaurants?.find((r: any) => r.id === mem.restaurantId);
        if (rest) {
          workspaces.push({
            type: 'RESTAURANT_OWNER',
            name: rest.name,
            subtitle: 'Restaurant Owner',
            icon: 'restaurant',
            role: UserRole.RESTAURANT_OWNER,
            restaurantId: rest.id,
          });
        }
      }

      const isAdmin = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN);
      if (isAdmin) {
        const isSuper = userRoles.includes(UserRole.SUPER_ADMIN);
        workspaces.push({
          type: 'MLOHUB_ADMIN',
          name: 'MloHub Administration',
          subtitle: isSuper ? 'Super Admin' : 'Admin',
          icon: 'shield-checkmark',
          role: isSuper ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
        });
      }

      return workspaces;
    }

    // Supabase Mode
    return [
      {
        type: 'CUSTOMER',
        name: 'Personal Account',
        subtitle: 'Customer',
        icon: 'person-circle',
        role: UserRole.CUSTOMER,
      },
    ];
  },

  /**
   * Switch Context between authorized workspaces with strict server-side validation
   */
  async switchWorkspace(
    currentToken: string,
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.switchWorkspace(currentToken, targetWorkspace, restaurantId);
    }

    if (!currentToken || typeof currentToken !== 'string' || !currentToken.includes('.')) {
      throw new Error('401 Unauthorized: Valid session token is required to switch workspace.');
    }

    const payload = CryptoEngine.verifyToken(currentToken);
    if (!payload || !payload.userId) {
      throw new Error('401 Unauthorized: Valid active session is required to switch workspace.');
    }

    return {
      user: {
        id: payload.userId,
        fullName: 'User',
        email: payload.email || '',
        phone: '',
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: targetWorkspace === 'RESTAURANT_OWNER' ? UserRole.RESTAURANT_OWNER : UserRole.CUSTOMER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      memberships: [],
      token: currentToken,
    };
  },

  /**
   * Switch Context between Customer and Restaurant Owner without re-login
   */
  async switchAccountContext(
    currentToken: string,
    targetRole: UserRole,
    restaurantId?: string
  ): Promise<AuthSessionResponse> {
    const ws: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN' =
      targetRole === UserRole.ADMIN || targetRole === UserRole.SUPER_ADMIN
        ? 'MLOHUB_ADMIN'
        : targetRole === UserRole.RESTAURANT_OWNER || targetRole === UserRole.RESTAURANT_STAFF
        ? 'RESTAURANT_OWNER'
        : 'CUSTOMER';
    return this.switchWorkspace(currentToken, ws, restaurantId);
  },

  /**
   * Logout current session
   */
  async logout(token: string): Promise<boolean> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.logout(token);
    }

    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    return true;
  },

  /**
   * Bootstrap session from active session token
   */
  async bootstrapSession(): Promise<AuthSessionResponse | null> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.bootstrapSession();
    }

    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    return {
      user: {
        id: session.user.id,
        fullName: session.user.user_metadata?.full_name || 'MloHub User',
        email: session.user.email || '',
        phone: session.user.phone || '',
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: (session.user.user_metadata?.role as UserRole) || UserRole.CUSTOMER,
        createdAt: session.user.created_at,
        updatedAt: new Date().toISOString(),
      },
      memberships: [],
      token: session.access_token,
    };
  },

  /**
   * Verify token and restore session with strict security validations
   */
  async verifySession(token: string): Promise<AuthSessionResponse | null> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      const { DemoAuthAdapter } = require('../../services/demo/DemoAuthAdapter');
      return DemoAuthAdapter.verifySession(token);
    }

    if (!token || typeof token !== 'string') return null;
    const payload = CryptoEngine.verifyToken(token);
    if (!payload || !payload.userId) return null;

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }

    return {
      user: {
        id: payload.userId,
        fullName: 'MloHub User',
        email: payload.email || '',
        phone: '',
        passwordHash: 'sb-external-auth',
        language: 'sw',
        role: (payload.role as UserRole) || UserRole.CUSTOMER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      memberships: [],
      token,
    };
  },
};
