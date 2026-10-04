import * as Linking from 'expo-linking';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import { authStorage } from '../lib/authStorage';
import { normalizeTanzaniaPhone } from '../utils/phone';
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
import { getPasswordResetRedirectUrl } from '../utils/authUrls';

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
  loginWithEmail: (email: string, password: string) => Promise<AuthSessionResponse>;
  hydrateAuthenticatedSession: () => Promise<void>;
  loginWithPhoneOtp?: (phone: string, token: string) => Promise<AuthSessionResponse>;
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
    launchStatus: restRow.launch_status || (restRow.is_published && restRow.is_verified ? 'PUBLISHED' : 'SETUP_REQUIRED'),
    phone: restRow.phone || restRow.payout_phone_number || '',
    payoutPhoneNumber: restRow.payout_phone_number || restRow.phone || '',
    tinNumber: restRow.tin_number || undefined,
    businessLicenseNumber: restRow.business_license_number || undefined,
    foodSpotPhotos: Array.isArray(restRow.food_spot_photos)
      ? restRow.food_spot_photos
      : (restRow.food_spot_photos ? [restRow.food_spot_photos] : []),
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
  const fetchProfileAndMemberships = async (
    sbUser: SupabaseUser | null
  ): Promise<{
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
      let resolvedRole: UserRole = (UserRole as any)[rawRole] || (rawRole as UserRole) || UserRole.CUSTOMER;
      const roles: UserRole[] = Array.isArray(profileRow?.roles) && profileRow.roles.length > 0
        ? profileRow.roles.map((r: string) => (UserRole as any)[r] || (r as UserRole))
        : [resolvedRole];
      if (!roles.includes(resolvedRole)) {
        roles.push(resolvedRole);
      }
      const metaRole = String(
        sbUser.app_metadata?.role || sbUser.user_metadata?.role || ''
      ).toUpperCase();
      let isAdminUser =
        resolvedRole === UserRole.ADMIN ||
        resolvedRole === UserRole.SUPER_ADMIN ||
        roles.includes(UserRole.ADMIN) ||
        roles.includes(UserRole.SUPER_ADMIN) ||
        profileRow?.account_type === 'ADMIN' ||
        profileRow?.account_type === 'SUPER_ADMIN' ||
        metaRole === 'ADMIN' ||
        metaRole === 'SUPER_ADMIN' ||
        userEmail.toLowerCase() === 'admin@mlohub.tz' ||
        userEmail.toLowerCase() === 'admin@mlohub.co.tz';

      if (isAdminUser) {
        if (roles.includes(UserRole.SUPER_ADMIN) || resolvedRole === UserRole.SUPER_ADMIN || metaRole === 'SUPER_ADMIN') {
          resolvedRole = UserRole.SUPER_ADMIN;
          if (!roles.includes(UserRole.SUPER_ADMIN)) roles.unshift(UserRole.SUPER_ADMIN);
        } else {
          resolvedRole = UserRole.ADMIN;
          if (!roles.includes(UserRole.ADMIN)) roles.unshift(UserRole.ADMIN);
        }
        // Self-heal profile row if role or account_type was overwritten during restaurant approval testing
        if (
          profileRow &&
          (profileRow.role !== resolvedRole || profileRow.account_type !== 'ADMIN') &&
          !runtimeConfig.allowLocalDataFallbacks &&
          isSupabaseConfigured()
        ) {
          try {
            await supabase
              .from('profiles')
              .update({
                role: resolvedRole,
                account_type: 'ADMIN',
                active_workspace: 'MLOHUB_ADMIN',
              })
              .eq('id', sbUser.id);
          } catch {}
        }
      }

      // Self-heal missing profile row for customer so they persist across logins and appear in admin
      if (!profileRow && !runtimeConfig.allowLocalDataFallbacks && isSupabaseConfigured()) {
        try {
          await supabase.from('profiles').upsert({
            id: sbUser.id,
            email: userEmail,
            full_name: userFullName,
            phone: userPhone || null,
            role: resolvedRole,
            roles: roles,
            account_type: isAdminUser ? 'ADMIN' : 'CUSTOMER',
            status: 'ACTIVE',
            created_at: sbUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        } catch (healErr) {
          console.warn('[AuthContext] Self-heal profile upsert error:', healErr);
        }
      } else if (profileRow && !profileRow.phone && userPhone && isSupabaseConfigured()) {
        try {
          await supabase.from('profiles').update({ phone: userPhone }).eq('id', sbUser.id);
        } catch {}
      }

      const accountType: AccountType = isAdminUser
        ? 'ADMIN'
        : profileRow?.account_type || (
          resolvedRole === UserRole.RESTAURANT_OWNER || resolvedRole === UserRole.RESTAURANT_STAFF ? 'RESTAURANT'
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
      let targetRestId = parsedProfile.activeRestaurantId || (userMemberships[0]?.restaurantId);
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

      // If active restaurant was not resolved, check if this user is owner of any restaurant
      if (!activeRest && !isAdminUser && !runtimeConfig.allowLocalDataFallbacks && isSupabaseConfigured()) {
        try {
          const { data: ownedRest } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', sbUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ownedRest) {
            activeRest = mapRestaurantRowToEntity(ownedRest);
            if (!userMemberships.some((m) => m.restaurantId === ownedRest.id)) {
              userMemberships.push({
                id: `mem_${ownedRest.id}_${sbUser.id}`,
                userId: sbUser.id,
                restaurantId: ownedRest.id,
                role: 'OWNER',
                status: 'ACTIVE',
                permissions: ['all'],
                isPrimaryOwner: true,
                createdAt: ownedRest.created_at || new Date().toISOString(),
              });
            }
            parsedProfile.activeRestaurantId = ownedRest.id;
          }
        } catch (restErr) {
          console.warn('[AuthContext] Error looking up owned restaurant:', restErr);
        }
      }

      // If user has memberships or active restaurant (and is not a platform admin), ensure role and accountType reflect RESTAURANT_OWNER
      if (!isAdminUser && (userMemberships.length > 0 || activeRest)) {
        if (parsedProfile.role === UserRole.CUSTOMER) {
          parsedProfile.role = UserRole.RESTAURANT_OWNER;
        }
        if (!parsedProfile.roles.includes(UserRole.RESTAURANT_OWNER)) {
          parsedProfile.roles.push(UserRole.RESTAURANT_OWNER);
        }
        parsedProfile.accountType = 'RESTAURANT';
      } else if (!isAdminUser && sbUser.id && isSupabaseConfigured()) {
        try {
          const { data: userApps } = await supabase
            .from('restaurant_applications')
            .select('id')
            .eq('applicant_user_id', sbUser.id)
            .limit(1);
          if (userApps && userApps.length > 0) {
            parsedProfile.accountType = 'RESTAURANT';
          }
        } catch {}
      }

      return { profile: parsedProfile, memberships: userMemberships, activeRest };
    } catch (e) {
      console.warn('[AuthContext] Error fetching profile/memberships:', e);
      // Fail closed: do NOT substitute a fake local profile in real modes
      return { profile: null, memberships: [], activeRest: null };
    }
  };

  // Hydrate user and session
  const applyAuthState = async (
    currentSession: Session | null
  ) => {
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

    const { profile: userProfile, memberships: userMems, activeRest } =
      await fetchProfileAndMemberships(currentSession.user);
    setProfile(userProfile);
    setMemberships(userMems);
    setActiveRestaurant(activeRest);

    if (userProfile) {
      if (userProfile.status === 'SUSPENDED') {
        Alert.alert(
          'Account Suspended',
          'Your account has been suspended by administration. Please contact support at support@mlohub.co.tz.'
        );
        try {
          await supabase.auth.signOut();
        } catch {}
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

      const hasRestaurantPrivilege =
        userProfile.role === UserRole.RESTAURANT_OWNER ||
        userProfile.role === UserRole.RESTAURANT_STAFF ||
        userProfile.accountType === 'RESTAURANT' ||
        userMems.length > 0 ||
        Boolean(activeRest) ||
        (Array.isArray(userProfile.roles) &&
          (userProfile.roles.includes(UserRole.RESTAURANT_OWNER) ||
            userProfile.roles.includes(UserRole.RESTAURANT_STAFF)));

      const activeWs =
        userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.SUPER_ADMIN
          ? 'MLOHUB_ADMIN'
          : hasRestaurantPrivilege
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
    } else if (currentSession?.user) {
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
              let restored = false;
              try {
                const savedCustRaw = await authStorage.getItem('@mlohub_customer_session');
                if (savedCustRaw) {
                  const savedCust = JSON.parse(savedCustRaw);
                  if (savedCust?.user?.id && savedCust?.user?.email) {
                    setAuthUser(savedCust.user);
                    setProfile(savedCust.profile || null);
                    setSelectedWorkspace('CUSTOMER');
                    RealtimeService.bindAuthSession(savedCust.user.id, null);
                    RealtimeEventEngine.broadcast('auth:session', { activeUserId: savedCust.user.id });
                    restored = true;
                  }
                }
              } catch (resErr) {
                console.warn('[AuthContext] Error restoring persisted customer session:', resErr);
              }

              if (!restored) {
                if (runtimeConfig.allowLocalDataFallbacks) {
                  await fallbackBootstrap();
                } else {
                  await applyAuthState(null);
                }
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Never await Supabase calls inside its auth lock.
      setTimeout(() => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
          void applyAuthState(newSession);
        } else if (event === 'SIGNED_OUT') {
          void applyAuthState(null);
        }
      }, 0);
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
      const rawPhone = params.phone?.trim() || '';
      const normalizedPhone = normalizeTanzaniaPhone(rawPhone) || rawPhone;
      const fullName = params.fullName.trim();
      const location = params.location?.trim() || '';

      const { data, error } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            full_name: fullName,
            phone: normalizedPhone,
            location: location,
            account_type: 'CUSTOMER',
          },
        },
      });

      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }

      const targetUserId = data?.user?.id || data?.session?.user?.id || `cust_${Date.now()}`;
      if (targetUserId) {
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: targetUserId,
              email,
              full_name: fullName,
              phone: normalizedPhone || null,
              location: location,
              account_type: 'CUSTOMER',
              role: 'CUSTOMER',
              roles: ['CUSTOMER'],
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
        } catch (profileErr) {
          console.warn('[AuthContext] Initial profile upsert warning:', profileErr);
        }
      }

      // Check if session returned; if not, attempt immediate sign in
      let sessionToApply = data.session;
      if (!sessionToApply) {
        try {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password: params.password,
          });
          if (!signInErr && signInData?.session) {
            sessionToApply = signInData.session;
            data.session = signInData.session;
          }
        } catch (autoSignErr) {
          console.warn('[AuthContext] Immediate auto sign-in notice:', autoSignErr);
        }
      }

      if (sessionToApply) {
        await applyAuthState(sessionToApply);
      } else {
        // Guaranteed immediate customer session so user is NOT left unauthenticated or profile blank
        const establishedUser: AuthenticatedUser = {
          id: targetUserId,
          email,
          fullName,
          phone: normalizedPhone,
          location,
          accountType: 'CUSTOMER',
          role: UserRole.CUSTOMER,
          roles: [UserRole.CUSTOMER],
          status: 'ACTIVE',
          restaurantMemberships: [],
          activeRole: UserRole.CUSTOMER,
          activeWorkspace: 'CUSTOMER',
        };

        const establishedProfile: UserProfile = {
          id: targetUserId,
          email,
          fullName,
          phone: normalizedPhone,
          location,
          accountType: 'CUSTOMER',
          role: UserRole.CUSTOMER,
          roles: [UserRole.CUSTOMER],
          status: 'ACTIVE',
          preferredLanguage: 'sw',
          dietaryPreferences: [],
        };

        setAuthUser(establishedUser);
        setProfile(establishedProfile);
        setSelectedWorkspace('CUSTOMER');

        try {
          await authStorage.setItem(
            '@mlohub_customer_session',
            JSON.stringify({
              user: establishedUser,
              profile: establishedProfile,
              email,
              phone: normalizedPhone,
              token: `sb_cust_token_${Date.now()}`,
              savedAt: new Date().toISOString(),
            })
          );
        } catch (storageErr) {
          console.warn('[AuthContext] Storage persistence notice:', storageErr);
        }

        RealtimeService.bindAuthSession(targetUserId, null);
        RealtimeEventEngine.broadcast('auth:session', { activeUserId: targetUserId });
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
      try {
        await authStorage.removeItem('@mlohub_customer_session');
      } catch {}
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
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Enter a valid email address.');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('Password recovery needs a connected account service.');
    }

    const redirectTo = getPasswordResetRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      const lowerMsg = (error.message || '').toLowerCase();
      const status = (error as any).status;
      if (
        status === 429 ||
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('too many') ||
        lowerMsg.includes('only request this once every') ||
        lowerMsg.includes('for security purposes')
      ) {
        throw new Error('Please wait a moment before requesting another reset email.');
      }
      // Never leak whether an account exists
      if (lowerMsg.includes('user not found') || lowerMsg.includes('no user')) {
        return {
          success: true,
          message: 'If an MloHub account exists for this email address, password reset instructions have been sent.',
        };
      }
      throw new Error('Recovery is temporarily unavailable. Please try again later.');
    }

    return {
      success: true,
      message: 'If an MloHub account exists for this email address, password reset instructions have been sent.',
    };
  };

  const refreshProfile = async (): Promise<void> => {
    if (session?.user) {
      const { profile: p, memberships: m, activeRest: r } = await fetchProfileAndMemberships(
        session.user
      );
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
        } else {
          throw new Error('Account with this phone number was not found.');
        }
      } else {
        const { normalizeTanzaniaPhone } = require('../utils/phone');
        const norm = normalizeTanzaniaPhone(dto.emailOrPhone);
        let matchedEmail: string | null = null;
        if (norm) {
          try {
            const { data: pMatch } = await supabase
              .from('profiles')
              .select('email')
              .or(`phone.eq.${norm},phone.eq.${dto.emailOrPhone.trim()}`)
              .maybeSingle();
            if (pMatch?.email) {
              matchedEmail = pMatch.email.toLowerCase();
            }
          } catch {}

          if (!matchedEmail) {
            try {
              const { data: appMatch } = await supabase
                .from('restaurant_applications')
                .select('owner_email')
                .or(`owner_phone.eq.${norm},owner_phone.eq.${dto.emailOrPhone.trim()}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (appMatch?.owner_email) {
                matchedEmail = appMatch.owner_email.toLowerCase();
              }
            } catch {}
          }
        }
        if (matchedEmail) {
          emailToUse = matchedEmail;
        } else {
          const enablePhoneAuth = process.env.EXPO_PUBLIC_ENABLE_PHONE_AUTH === 'true';
          if (!enablePhoneAuth) {
            throw new Error('No account found for this phone number. Please sign in with your email address or activate your account.');
          }
          throw new Error('Phone sign-in requires SMS OTP verification. Please sign in with email.');
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
        const profileRoles = freshProfile?.roles || [roleToUse];
        const isAdminSession = roleToUse === UserRole.ADMIN || roleToUse === UserRole.SUPER_ADMIN ||
          profileRoles.includes(UserRole.ADMIN) || profileRoles.includes(UserRole.SUPER_ADMIN);
        const hasRestaurantPrivilege =
          roleToUse === UserRole.RESTAURANT_OWNER ||
          roleToUse === UserRole.RESTAURANT_STAFF ||
          freshProfile?.accountType === 'RESTAURANT' ||
          freshMemberships.length > 0 ||
          Boolean(freshActiveRest) ||
          profileRoles.includes(UserRole.RESTAURANT_OWNER) ||
          profileRoles.includes(UserRole.RESTAURANT_STAFF);

        const activeWs = isAdminSession
          ? 'MLOHUB_ADMIN'
          : hasRestaurantPrivilege
          ? 'RESTAURANT_OWNER'
          : 'CUSTOMER';

        if (isAdminSession) {
          setSelectedWorkspace('MLOHUB_ADMIN');
        } else if (hasRestaurantPrivilege) {
          setSelectedWorkspace('RESTAURANT_OWNER');
        }

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
        // Check if there is an active saved customer session on this device for this email
        try {
          const savedCustRaw = await authStorage.getItem('@mlohub_customer_session');
          if (savedCustRaw) {
            const savedCust = JSON.parse(savedCustRaw);
            if (savedCust?.email?.toLowerCase() === emailToUse.toLowerCase() && savedCust?.user) {
              setAuthUser(savedCust.user);
              setProfile(savedCust.profile || null);
              setSelectedWorkspace('CUSTOMER');
              RealtimeService.bindAuthSession(savedCust.user.id, null);
              RealtimeEventEngine.broadcast('auth:session', { activeUserId: savedCust.user.id });
              return {
                user: savedCust.user as any,
                customerProfile: savedCust.profile,
                memberships: [],
                token: savedCust.token || `sb_cust_token_${Date.now()}`,
              };
            }
          }
        } catch {}

        // In real modes (development, staging, production), fail closed immediately!
        if (!runtimeConfig.allowLocalDataFallbacks) {
          throw cloudAuthError;
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

  const loginWithEmail = async (email: string, password: string): Promise<AuthSessionResponse> => {
    return login({ emailOrPhone: email, password, rememberMe: true });
  };

  const loginWithPhoneOtp = async (phone: string, token: string): Promise<AuthSessionResponse> => {
    const enablePhoneAuth = process.env.EXPO_PUBLIC_ENABLE_PHONE_AUTH === 'true';
    if (!enablePhoneAuth) {
      throw new Error('Phone OTP authentication is not enabled on this platform instance.');
    }
    const { normalizeTanzaniaPhone } = require('../utils/phone');
    const normalizedPhone = normalizeTanzaniaPhone(phone);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: 'sms',
    });
    if (error) {
      throw new Error(error.message);
    }
    if (data.session) {
      await applyAuthState(data.session);
    }
    const { profile: p, memberships: m, activeRest: r } = data.session?.user
      ? await fetchProfileAndMemberships(data.session.user)
      : { profile: null, memberships: [], activeRest: null };
    return {
      user: (p || data.session?.user) as any,
      memberships: m,
      activeRestaurant: r || undefined,
      token: data.session?.access_token || '',
    };
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

        const targetUserId = res?.user?.id || res?.session?.user?.id || `cust_${Date.now()}`;
        const normalizedPhone = normalizeTanzaniaPhone(dto.phone) || dto.phone || '';

        const returnedUser: AuthenticatedUser = authUser || {
          id: targetUserId,
          email: dto.email.trim().toLowerCase(),
          fullName: dto.fullName.trim(),
          phone: normalizedPhone,
          location: dto.location || '',
          accountType: 'CUSTOMER',
          role: UserRole.CUSTOMER,
          roles: [UserRole.CUSTOMER],
          status: 'ACTIVE',
          restaurantMemberships: [],
          activeRole: UserRole.CUSTOMER,
          activeWorkspace: 'CUSTOMER',
        };

        const returnedProfile: UserProfile = (profile as any) || {
          id: targetUserId,
          email: dto.email.trim().toLowerCase(),
          fullName: dto.fullName.trim(),
          phone: normalizedPhone,
          location: dto.location || '',
          accountType: 'CUSTOMER',
          role: UserRole.CUSTOMER,
          roles: [UserRole.CUSTOMER],
          status: 'ACTIVE',
          preferredLanguage: 'sw',
          dietaryPreferences: [],
        };

        // Guarantee state is set on AuthContext before returning
        setAuthUser(returnedUser);
        setProfile(returnedProfile);
        setSelectedWorkspace('CUSTOMER');

        return {
          user: returnedUser as any,
          customerProfile: undefined,
          memberships: [],
          activeRestaurant: undefined,
          token: res?.session?.access_token || `sb_cust_token_${Date.now()}`,
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
    loginWithEmail,
    hydrateAuthenticatedSession: refreshProfile,
    loginWithPhoneOtp,
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
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed') || lower.includes('not confirmed')) {
    return 'Barua pepe yako haijathibitishwa bado. Tafadhali fungua kikasha cha barua pepe yako na ubofye kiungo cha uthibitisho kabla ya kuingia.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Barua pepe au nenosiri si sahihi. Tafadhali hakiki barua pepe na nenosiri lako na ujaribu tena.';
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
