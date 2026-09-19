import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import {
  UserEntity,
  UserRole,
  CustomerProfileEntity,
  RestaurantEntity,
  RestaurantMembershipEntity,
  RegisterCustomerDTO,
  RegisterRestaurantDTO,
  LoginDTO,
  AuthSessionResponse,
} from '../db/types';
import { AccountType, RestaurantRole, UserProfile, AuthenticatedUser } from '../types/auth';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { RealtimeService } from '../services/RealtimeService';
import { OtpApi } from '../services/api/OtpApi';

export interface AuthorizedWorkspaceOption {
  type: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  name: string;
  subtitle: string;
  icon: string;
  role: UserRole;
  restaurantId?: string;
}

export interface SignUpCustomerParams {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  location?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthContextType {
  // Production Supabase Auth State
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAuthLoading: boolean; // Backward compatibility alias
  isAuthenticated: boolean;

  // Helper flags
  isCustomer: boolean;
  isRestaurantUser: boolean;
  isRestaurantOwner: boolean;
  isRestaurantStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;

  // Workspace & Role state
  currentRole: UserRole | null;
  activeWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN';
  authorizedWorkspaces: AuthorizedWorkspaceOption[];
  memberships: RestaurantMembershipEntity[];
  activeRestaurant: RestaurantEntity | null;
  token: string | null;

  // Core Supabase Auth Operations
  signUpCustomer: (params: SignUpCustomerParams) => Promise<{ user: any; session: any }>;
  signIn: (params: SignInParams) => Promise<{ user: any; session: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshProfile: () => Promise<void>;

  // Backward-Compatible Screen Aliases
  login: (dto: LoginDTO) => Promise<AuthSessionResponse>;
  registerCustomer: (dto: RegisterCustomerDTO) => Promise<AuthSessionResponse>;
  registerRestaurant: (dto: RegisterRestaurantDTO) => Promise<AuthSessionResponse>;
  sendCustomerOtp: (phone: string) => Promise<{ success: boolean; carrierName: string; message: string; error?: string }>;
  verifyCustomerOtp: (phone: string, enteredOtp: string) => Promise<{ success: boolean; message: string }>;
  switchWorkspace: (
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ) => Promise<AuthSessionResponse>;
  switchRole: (targetRole: UserRole, restaurantId?: string) => Promise<AuthSessionResponse>;
  switchUser: (userId: string) => Promise<AuthSessionResponse>;
  logout: () => Promise<void>;
  refreshAuthSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapRestaurantRowToEntity(restRow: any): RestaurantEntity {
  return {
    id: restRow.id,
    ownerId: restRow.owner_id || '',
    sellerTier: restRow.seller_tier || 'BASIC_SELLER',
    name: restRow.name,
    slug: restRow.slug || restRow.name.toLowerCase().replace(/\s+/g, '-'),
    cuisine: restRow.cuisine || 'Local',
    description: restRow.description || undefined,
    rating: Number(restRow.rating) || 0,
    reviewsCount: restRow.reviews_count || 0,
    minPrice: restRow.min_price_tzs || 0,
    maxPrice: restRow.max_price_tzs || 0,
    address: restRow.address || '',
    neighborhood: restRow.neighborhood || '',
    regionCity: restRow.region_city || 'Dar es Salaam',
    distanceKm: Number(restRow.distance_km) || 1.0,
    estimatedPrepTimeMinutes: restRow.estimated_prep_time_minutes || 25,
    isOpen: restRow.is_open ?? true,
    isVerified: restRow.is_verified ?? false,
    isPublished: restRow.is_published ?? false,
    isActive: restRow.is_active ?? true,
    verificationStatus: restRow.verification_status || 'PENDING_VERIFICATION',
    logoUrl: restRow.logo_url || undefined,
    coverImageUrl: restRow.cover_image_url || undefined,
    emoji: restRow.emoji || '🍲',
    specialty: restRow.specialty || restRow.cuisine || 'Local Cuisine',
    tags: restRow.tags || [],
    menu: [],
    createdAt: restRow.created_at || new Date().toISOString(),
    updatedAt: restRow.updated_at || new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);
  const [memberships, setMemberships] = useState<RestaurantMembershipEntity[]>([]);
  const [activeRestaurant, setActiveRestaurant] = useState<RestaurantEntity | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN'>('CUSTOMER');

  // Helper function to resolve profile and memberships from Supabase
  const fetchProfileAndMemberships = async (sbUser: SupabaseUser | null): Promise<{
    profile: UserProfile | null;
    memberships: RestaurantMembershipEntity[];
    activeRest: RestaurantEntity | null;
  }> => {
    if (!sbUser) {
      return { profile: null, memberships: [], activeRest: null };
    }

    try {
      // 1. Fetch Profile from public.profiles
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('[AuthContext] Error fetching profile:', profileErr.message);
      }

      const userEmail = sbUser.email || profileRow?.email || '';
      const userFullName = profileRow?.full_name || sbUser.user_metadata?.full_name || splitEmail(userEmail);
      const userPhone = profileRow?.phone || sbUser.user_metadata?.phone || '';
      const rawRole = profileRow?.role || 'CUSTOMER';
      const resolvedRole: UserRole = (UserRole as any)[rawRole] || UserRole.CUSTOMER;
      const roles: UserRole[] = Array.isArray(profileRow?.roles) && profileRow.roles.length > 0
        ? profileRow.roles.map((r: string) => (UserRole as any)[r] || UserRole.CUSTOMER)
        : [resolvedRole];
      const accountType: AccountType = profileRow?.account_type || (
        resolvedRole === UserRole.ADMIN || resolvedRole === UserRole.SUPER_ADMIN ? 'ADMIN'
        : resolvedRole === UserRole.RESTAURANT_OWNER || resolvedRole === UserRole.RESTAURANT_STAFF ? 'RESTAURANT'
        : 'CUSTOMER'
      );

      const parsedProfile: UserProfile = {
        id: sbUser.id,
        fullName: userFullName,
        email: userEmail,
        phone: userPhone,
        accountType,
        role: resolvedRole,
        roles,
        status: profileRow?.status || 'ACTIVE',
        preferredLanguage: profileRow?.preferred_language || profileRow?.language || 'sw',
        avatarUrl: profileRow?.avatar_url,
        location: profileRow?.location || '',
        companyOrGroup: profileRow?.company_or_group,
        dietaryPreferences: profileRow?.dietary_preferences || [],
        activeRestaurantId: profileRow?.active_restaurant_id,
        createdAt: profileRow?.created_at || sbUser.created_at,
        updatedAt: profileRow?.updated_at,
      };

      // 2. Fetch Memberships from public.restaurant_members
      let userMemberships: RestaurantMembershipEntity[] = [];
      const { data: memberRows, error: memberErr } = await supabase
        .from('restaurant_members')
        .select('*')
        .eq('user_id', sbUser.id);

      if (memberErr) {
        console.warn('[AuthContext] Error fetching restaurant_members:', memberErr.message);
      }

      if (memberRows && memberRows.length > 0) {
        userMemberships = memberRows.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          restaurantId: m.restaurant_id,
          role: m.role || 'STAFF',
          status: m.status || (m.is_active ? 'ACTIVE' : 'REVOKED'),
          permissions: m.permissions || ['all'],
          isPrimaryOwner: !!m.is_primary_owner,
          createdAt: m.created_at || new Date().toISOString(),
        }));
      }

      // Fallback to local DB memberships ONLY in TEST / DEMO mode
      if (userMemberships.length === 0 && runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        userMemberships = DemoAuthAdapter.resolveMemberships(sbUser.id, parsedProfile.email);
      }

      // 3. Resolve active restaurant
      let activeRest: RestaurantEntity | null = null;
      const targetRestId = parsedProfile.activeRestaurantId || (userMemberships[0]?.restaurantId);
      if (targetRestId) {
        if (runtimeConfig.allowLocalDataFallbacks) {
          const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
          activeRest = DemoAuthAdapter.resolveActiveRestaurant(targetRestId);
        } else {
          try {
            const { data: restRow } = await supabase
              .from('restaurants')
              .select('*')
              .eq('id', targetRestId)
              .maybeSingle();
            if (restRow) {
              activeRest = mapRestaurantRowToEntity(restRow);
            }
          } catch (e) {
            console.warn('[AuthContext] Error loading active restaurant:', e);
          }
        }
      }

      return { profile: parsedProfile, memberships: userMemberships, activeRest };
    } catch (e) {
      console.warn('[AuthContext] Error fetching profile/memberships:', e);
      // Fail closed: do NOT substitute a fake local profile in real modes
      return { profile: null, memberships: [], activeRest: null };
    }
  };

  // Hydrate user and session
  const applyAuthState = async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setSession(null);
      setProfile(null);
      setAuthUser(null);
      setMemberships([]);
      setActiveRestaurant(null);
      setSelectedWorkspace('CUSTOMER');
      RealtimeService.bindAuthSession(null, null);
      RealtimeEventEngine.broadcast('auth:session', { activeUserId: null });
      return;
    }

    setSession(currentSession);
    const { profile: userProfile, memberships: userMems, activeRest } = await fetchProfileAndMemberships(currentSession.user);
    setProfile(userProfile);
    setMemberships(userMems);
    setActiveRestaurant(activeRest);

    if (userProfile) {
      const activeWs = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.SUPER_ADMIN
        ? 'MLOHUB_ADMIN'
        : userProfile.role === UserRole.RESTAURANT_OWNER || userProfile.role === UserRole.RESTAURANT_STAFF
        ? 'RESTAURANT_OWNER'
        : 'CUSTOMER';

      setSelectedWorkspace(activeWs);

      const authenticatedUser: AuthenticatedUser = {
        id: userProfile.id,
        email: userProfile.email,
        fullName: userProfile.fullName,
        phone: userProfile.phone,
        accountType: userProfile.accountType,
        role: userProfile.role,
        roles: userProfile.roles,
        status: userProfile.status,
        avatarUrl: userProfile.avatarUrl,
        location: userProfile.location,
        companyOrGroup: userProfile.companyOrGroup,
        dietaryPreferences: userProfile.dietaryPreferences,
        restaurantMemberships: userMems.map((m) => ({
          id: m.id,
          userId: m.userId,
          restaurantId: m.restaurantId,
          role: m.role as RestaurantRole,
          status: m.status as any,
          permissions: m.permissions,
          isPrimaryOwner: m.isPrimaryOwner,
        })),
        activeRestaurantId: activeRest?.id,
        activeRole: userProfile.role,
        activeWorkspace: activeWs,
      };

      setAuthUser(authenticatedUser);

      // Sync activeUserId with local DB snapshot ONLY in test/demo mode
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        const db = DemoAuthAdapter.getSnapshot();
        db.activeUserId = authenticatedUser.id;
      }
      RealtimeService.bindAuthSession(authenticatedUser.id, activeRest?.id);
      RealtimeEventEngine.broadcast('auth:session', { activeUserId: authenticatedUser.id });
    } else if (currentSession.user) {
      // Supabase Auth session exists but profile fetch failed:
      // Safe incomplete state derived from session metadata without faking a local profile
      const sbUser = currentSession.user;
      const userEmail = sbUser.email || '';
      const fallbackName = sbUser.user_metadata?.full_name || splitEmail(userEmail);
      const safeIncompleteUser: AuthenticatedUser = {
        id: sbUser.id,
        email: userEmail,
        fullName: fallbackName,
        phone: sbUser.phone || sbUser.user_metadata?.phone || '',
        accountType: 'CUSTOMER',
        role: UserRole.CUSTOMER,
        roles: [UserRole.CUSTOMER],
        status: 'ACTIVE',
        restaurantMemberships: [],
        activeRole: UserRole.CUSTOMER,
        activeWorkspace: 'CUSTOMER',
      };
      setAuthUser(safeIncompleteUser);
      setSelectedWorkspace('CUSTOMER');
      RealtimeService.bindAuthSession(sbUser.id, null);
      RealtimeEventEngine.broadcast('auth:session', { activeUserId: sbUser.id });
    }
  };

  // Mount: Initialize Supabase Session & Listen to Auth State Changes
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        if (isSupabaseConfigured()) {
          const { data: { session: initialSession }, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('[AuthContext] Session retrieval error:', error.message || error);
          }
          if (isMounted) {
            if (initialSession) {
              await applyAuthState(initialSession);
            } else {
              // No Supabase cloud session: authenticated user is null in real modes
              if (runtimeConfig.allowLocalDataFallbacks) {
                await fallbackBootstrap();
              } else {
                await applyAuthState(null);
              }
            }
          }
        } else {
          // Supabase not configured: ONLY allowed in test/demo mode
          if (runtimeConfig.allowLocalDataFallbacks) {
            await fallbackBootstrap();
          } else {
            await applyAuthState(null);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Initialization failure:', err);
        if (isMounted) {
          await applyAuthState(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Supabase Realtime Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await applyAuthState(newSession);
      } else if (event === 'SIGNED_OUT') {
        await applyAuthState(null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Fallback bootstrap ONLY for test/demo mode
  const fallbackBootstrap = async () => {
    if (!runtimeConfig.allowLocalDataFallbacks) {
      await applyAuthState(null);
      return;
    }
    const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
    const res = await DemoAuthAdapter.fallbackBootstrap();
    setProfile(res.profile);
    setMemberships(res.memberships);
    setActiveRestaurant(res.activeRest);
    setSelectedWorkspace(res.activeWorkspace);
    setAuthUser(res.user);
    if (res.user) {
      RealtimeService.bindAuthSession(res.user.id, res.activeRest?.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Core Supabase Auth Operations
  // ---------------------------------------------------------------------------
  const signUpCustomer = async (params: SignUpCustomerParams) => {
    setLoading(true);
    try {
      const email = params.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone?.trim(),
            location: params.location?.trim() || '',
            account_type: 'CUSTOMER',
          },
        },
      });

      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }

      if (data.session) {
        await applyAuthState(data.session);
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (params: SignInParams) => {
    setLoading(true);
    try {
      const email = params.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });

      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }

      if (data.session) {
        await applyAuthState(data.session);
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        await DemoAuthAdapter.logout(session?.access_token || '');
      }
      await applyAuthState(null);
    } catch (err) {
      console.warn('[AuthContext] SignOut error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) {
          console.warn('[AuthContext] Reset password notice:', error.message);
        }
      }
      return {
        success: true,
        message: 'If an account exists for this email, password reset instructions have been sent.',
      };
    } catch (err: any) {
      return {
        success: true,
        message: 'If an account exists for this email, password reset instructions have been sent.',
      };
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (session?.user) {
      const { profile: p, memberships: m, activeRest: r } = await fetchProfileAndMemberships(session.user);
      setProfile(p);
      setMemberships(m);
      setActiveRestaurant(r);
      if (p) {
        setAuthUser((prev) => (prev ? { ...prev, ...p } : null));
      }
    } else {
      if (runtimeConfig.allowLocalDataFallbacks) {
        await fallbackBootstrap();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Backward-Compatible Screen Methods
  // ---------------------------------------------------------------------------
  const login = async (dto: LoginDTO): Promise<AuthSessionResponse> => {
    const isEmail = dto.emailOrPhone.includes('@');
    let emailToUse = dto.emailOrPhone.trim().toLowerCase();

    if (!isEmail) {
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        const db = DemoAuthAdapter.getSnapshot();
        const cleanInput = dto.emailOrPhone.replace(/[^0-9]/g, '');
        const matched = db.users?.find((u: any) => u.phone.replace(/[^0-9]/g, '') === cleanInput);
        if (matched?.email) {
          emailToUse = matched.email.toLowerCase();
        }
      } else {
        // Resolve email from public.profiles by phone number
        try {
          const rawPhone = dto.emailOrPhone.trim();
          const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
          const { data: profileWithPhone } = await supabase
            .from('profiles')
            .select('email')
            .or(`phone.eq.${rawPhone},phone.eq.+${cleanPhone},phone.eq.${cleanPhone}`)
            .maybeSingle();
          if (profileWithPhone?.email) {
            emailToUse = profileWithPhone.email.toLowerCase();
          }
        } catch (e) {
          console.warn('[AuthContext] Phone to email resolution error:', e);
        }
      }
    }

    let cloudAuthError: any = null;
    if (isSupabaseConfigured()) {
      try {
        const result = await signIn({ email: emailToUse, password: dto.password });
        const currentUser = result.session?.user;
        let freshProfile: any = null;
        let freshMemberships: any[] = [];
        let freshActiveRest: any = null;
        if (currentUser) {
          const res = await fetchProfileAndMemberships(currentUser);
          freshProfile = res.profile;
          freshMemberships = res.memberships;
          freshActiveRest = res.activeRest;
        }

        const roleToUse = freshProfile?.role || UserRole.CUSTOMER;
        const activeWs = (roleToUse === UserRole.ADMIN || roleToUse === UserRole.SUPER_ADMIN)
          ? 'MLOHUB_ADMIN'
          : (roleToUse === UserRole.RESTAURANT_OWNER || roleToUse === UserRole.RESTAURANT_STAFF)
          ? 'RESTAURANT_OWNER'
          : 'CUSTOMER';

        const authenticatedUser = freshProfile ? {
          ...freshProfile,
          restaurantMemberships: freshMemberships,
          activeRole: roleToUse,
          activeWorkspace: activeWs,
        } : (authUser || (profile as any));

        return {
          user: authenticatedUser as any,
          customerProfile: undefined,
          memberships: freshMemberships.length > 0 ? freshMemberships : memberships,
          activeRestaurant: freshActiveRest || activeRestaurant || undefined,
          token: result.session?.access_token || 'sb-active-token',
        };
      } catch (supaErr: any) {
        cloudAuthError = supaErr;
        // In real modes (development, staging, production), fail closed immediately!
        if (!runtimeConfig.allowLocalDataFallbacks) {
          throw supaErr;
        }
        console.warn('[AuthContext] [TEST/DEMO ONLY] Supabase sign-in error, evaluating test fixtures:', supaErr?.message || supaErr);
      }
    }

    // Fail closed in real modes
    if (!runtimeConfig.allowLocalDataFallbacks) {
      if (cloudAuthError) throw cloudAuthError;
      throw new Error('Authentication failed and local fallbacks are disabled in this environment.');
    }

    // Local DB fallback for seeded platform accounts (TEST/DEMO mode ONLY)
    const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
    const demoRes = await DemoAuthAdapter.login(dto);
    await fallbackBootstrap();
    return demoRes;
  };

  const registerCustomer = async (dto: RegisterCustomerDTO): Promise<AuthSessionResponse> => {
    try {
      if (isSupabaseConfigured()) {
        const res = await signUpCustomer({
          email: dto.email,
          password: dto.password,
          fullName: dto.fullName,
          phone: dto.phone,
          location: dto.location,
        });
        return {
          user: authUser || (profile as any),
          customerProfile: undefined,
          memberships: [],
          activeRestaurant: undefined,
          token: res.session?.access_token || `sb_token_${Date.now()}`,
        };
      }
    } catch (err: any) {
      if (isSupabaseConfigured()) throw err;
    }

    // Local DB fallback ONLY in TEST / DEMO mode
    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error('Customer registration requires an active Supabase connection in this environment.');
    }

    const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
    const res = await DemoAuthAdapter.registerCustomer(dto);
    await fallbackBootstrap();
    return res;
  };

  const registerRestaurant = async (dto: RegisterRestaurantDTO): Promise<AuthSessionResponse> => {
    // Restaurant intake creates application and registers base user
    return await registerCustomer({
      fullName: dto.ownerFullName,
      email: dto.ownerEmail,
      phone: dto.ownerPhone,
      password: dto.password,
      location: dto.address || dto.neighborhood,
      agreeTerms: dto.agreeTerms,
    });
  };

  const sendCustomerOtp = async (phone: string) => {
    const userLang = (
      authUser?.language ||
      profile?.language ||
      profile?.preferredLanguage ||
      'sw'
    ) as 'en' | 'sw';
    const res = await OtpApi.sendOtp(
      phone,
      'CUSTOMER_VERIFICATION',
      userLang
    );
    return {
      success: res.success,
      carrierName: res.carrierName || 'Unknown',
      message: res.message,
      error: res.error,
    };
  };

  const verifyCustomerOtp = async (
    phone: string,
    enteredOtp: string
  ) => {
    const res = await OtpApi.verifyOtp(phone, enteredOtp);
    if (res.success) {
      await refreshProfile();
      if (authUser) {
        setAuthUser({
          ...authUser,
          isPhoneVerified: true,
        });
      }
    }
    return {
      success: res.success,
      message: res.message,
    };
  };

  const switchWorkspace = async (
    targetWorkspace: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'MLOHUB_ADMIN',
    restaurantId?: string
  ): Promise<AuthSessionResponse> => {
    setSelectedWorkspace(targetWorkspace);
    if (restaurantId) {
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        const rest = DemoAuthAdapter.resolveActiveRestaurant(restaurantId);
        setActiveRestaurant(rest);
      } else {
        try {
          const { data: restRow } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .maybeSingle();
          if (restRow) {
            setActiveRestaurant(mapRestaurantRowToEntity(restRow));
          }
        } catch (e) {
          console.warn('[AuthContext] Failed to load restaurant in switchWorkspace:', e);
        }
      }
    }
    if (authUser) {
      authUser.activeWorkspace = targetWorkspace;
      if (targetWorkspace === 'RESTAURANT_OWNER') {
        authUser.activeRole = UserRole.RESTAURANT_OWNER;
      } else if (targetWorkspace === 'MLOHUB_ADMIN') {
        authUser.activeRole = authUser.role === UserRole.SUPER_ADMIN ? UserRole.SUPER_ADMIN : UserRole.ADMIN;
      } else {
        authUser.activeRole = UserRole.CUSTOMER;
      }
    }
    return {
      user: authUser || (profile as any),
      customerProfile: undefined,
      memberships,
      activeRestaurant: activeRestaurant || undefined,
      token: session?.access_token || 'sb_active_session',
    };
  };

  const switchRole = async (targetRole: UserRole, restaurantId?: string): Promise<AuthSessionResponse> => {
    const ws = targetRole === UserRole.ADMIN || targetRole === UserRole.SUPER_ADMIN
      ? 'MLOHUB_ADMIN'
      : targetRole === UserRole.RESTAURANT_OWNER || targetRole === UserRole.RESTAURANT_STAFF
      ? 'RESTAURANT_OWNER'
      : 'CUSTOMER';
    return switchWorkspace(ws, restaurantId);
  };

  const switchUser = async (userId: string): Promise<AuthSessionResponse> => {
    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error('Account switching is disabled in this environment. Please log in with credentials.');
    }
    if (authUser?.id !== userId) {
      const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
      const res = await DemoAuthAdapter.switchUser(userId);
      await fallbackBootstrap();
      return {
        user: res.user as any,
        customerProfile: undefined,
        memberships: res.memberships,
        activeRestaurant: res.activeRestaurant || undefined,
        token: res.token,
      };
    }
    return {
      user: authUser as any,
      customerProfile: undefined,
      memberships,
      activeRestaurant: activeRestaurant || undefined,
      token: session?.access_token || 'sb_active_session',
    };
  };

  // Helper flags
  const role = authUser?.activeRole || authUser?.role || profile?.role || null;
  const isCustomer = role === UserRole.CUSTOMER;
  const isRestaurantOwner = role === UserRole.RESTAURANT_OWNER;
  const isRestaurantStaff = role === UserRole.RESTAURANT_STAFF;
  const isRestaurantUser = isRestaurantOwner || isRestaurantStaff;
  const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  const isSuperAdmin = role === UserRole.SUPER_ADMIN;

  // Build list of authorized workspaces
  const authorizedWorkspaces: AuthorizedWorkspaceOption[] = [
    {
      type: 'CUSTOMER',
      name: 'Customer Workspace',
      subtitle: 'Browse meals & order food',
      icon: 'person-circle-outline',
      role: UserRole.CUSTOMER,
    },
  ];

  if (memberships.length > 0) {
    memberships.forEach((m) => {
      let restName = 'Restaurant Kitchen';
      if (runtimeConfig.allowLocalDataFallbacks) {
        const { DemoAuthAdapter } = require('../services/demo/DemoAuthAdapter');
        const rest = DemoAuthAdapter.resolveActiveRestaurant(m.restaurantId);
        if (rest?.name) restName = rest.name;
      } else if (activeRestaurant && activeRestaurant.id === m.restaurantId) {
        restName = activeRestaurant.name;
      }
      authorizedWorkspaces.push({
        type: 'RESTAURANT_OWNER',
        name: restName,
        subtitle: m.role === 'OWNER' ? 'Restaurant Owner' : 'Kitchen Staff',
        icon: 'storefront-outline',
        role: UserRole.RESTAURANT_OWNER,
        restaurantId: m.restaurantId,
      });
    });
  }

  if (isAdmin) {
    authorizedWorkspaces.push({
      type: 'MLOHUB_ADMIN',
      name: 'MloHub Back-Office',
      subtitle: isSuperAdmin ? 'Super Administrator' : 'Platform Administrator',
      icon: 'shield-checkmark-outline',
      role: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.ADMIN,
    });
  }

  const contextValue: AuthContextType = {
    user: authUser,
    profile,
    session,
    loading,
    isAuthLoading: loading,
    isAuthenticated: !!authUser && authUser.status !== 'SUSPENDED' && authUser.status !== 'INACTIVE',
    isCustomer,
    isRestaurantUser,
    isRestaurantOwner,
    isRestaurantStaff,
    isAdmin,
    isSuperAdmin,
    currentRole: role,
    activeWorkspace: selectedWorkspace,
    authorizedWorkspaces,
    memberships,
    activeRestaurant,
    token: session?.access_token || null,

    // Core operations
    signUpCustomer,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,

    // Screen aliases
    login,
    registerCustomer,
    registerRestaurant,
    sendCustomerOtp,
    verifyCustomerOtp,
    switchWorkspace,
    switchRole,
    switchUser,
    logout: signOut,
    refreshAuthSession: refreshProfile,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function splitEmail(email: string): string {
  if (!email || !email.includes('@')) return 'MloHub User';
  const namePart = email.split('@')[0];
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

function mapSupabaseAuthError(rawMsg: string): string {
  const lower = (rawMsg || '').toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Barua pepe au nenosiri si sahihi. Tafadhali hakiki na ujaribu tena.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Akaunti yenye barua pepe hii tayari ipo. Tafadhali ingia au tumia barua pepe nyingine.';
  }
  if (lower.includes('password should be at least')) {
    return 'Nenosiri linatakiwa liwe na herufi angalau 6.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Hitilafu ya mtandao. Tafadhali angalia mtandao wako na ujaribu tena.';
  }
  return rawMsg;
}
