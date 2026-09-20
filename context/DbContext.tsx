import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MloHubDB,
  MloHubDatabaseSchema,
  RestaurantEntity,
  ReservationEntity,
  CustomMealRequestEntity,
  NotificationEntity,
  PaymentTransactionEntity,
  ReviewEntity,
  UserEntity,
  UserRole,
} from '../db';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import { RestaurantRepository } from '../repositories/restaurants.repository';
import { ReservationRepository } from '../repositories/reservations.repository';
import { OrderRepository } from '../repositories/orders.repository';
import { CustomMealRepository } from '../repositories/customMeals.repository';
import { NotificationRepository } from '../repositories/notifications.repository';
import { ReviewRepository } from '../repositories/reviews.repository';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { RealtimeService } from '../services/RealtimeService';
import { Restaurant, Reservation, Order, CustomMealRequest, Notification } from '../types/domain';

const allowLocalFallbacks = runtimeConfig.allowLocalDataFallbacks;

const ONBOARDING_PREF_KEY = '@mlohub_onboarding_completed';

async function getClientPreference(key: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      return await AsyncStorage.getItem(key);
    }
  } catch {
    // fallback to null
  }
  return null;
}

async function setClientPreference(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback
  }
}

export function createEmptyDbSnapshot(): MloHubDatabaseSchema {
  return {
    version: 1,
    hasCompletedOnboarding: false,
    users: [],
    customerProfiles: [],
    restaurantMemberships: [],
    sessions: [],
    activeUserId: undefined,
    restaurants: [],
    reservations: [],
    customMealRequests: [],
    payments: [],
    paymentEvents: [],
    refunds: [],
    reviews: [],
    notifications: [],
    favorites: [],
    auditLogs: [],
    otpChallenges: [],
    smsLogs: [],
    restaurantApplications: [],
    lastSyncedAt: new Date().toISOString(),
  };
}

interface DbContextType {
  isReady: boolean;
  loading: boolean;
  error: string | null;
  isCloudBacked: boolean;
  dbSnapshot: MloHubDatabaseSchema;
  hasCompletedOnboarding: boolean;
  user?: UserEntity;
  users: UserEntity[];
  restaurants: RestaurantEntity[];
  reservations: ReservationEntity[];
  orders: Order[];
  customOrders: CustomMealRequestEntity[];
  notifications: NotificationEntity[];
  payments: PaymentTransactionEntity[];
  favorites: string[];
  // Actions
  setOnboardingCompleted: (completed?: boolean) => Promise<void>;
  updateUser: (data: Partial<UserEntity>) => Promise<UserEntity>;
  switchUser: (userId: string) => Promise<UserEntity>;
  toggleFavorite: (restaurantId: string) => Promise<boolean>;
  createReservation: (data: Omit<ReservationEntity, 'id' | 'createdAt'>) => Promise<ReservationEntity>;
  cancelReservation: (id: string) => Promise<boolean>;
  createCustomOrder: (data: Omit<CustomMealRequestEntity, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => Promise<CustomMealRequestEntity>;
  updateCustomOrder: (id: string, data: Partial<CustomMealRequestEntity>) => Promise<CustomMealRequestEntity | undefined>;
  deleteCustomOrder: (id: string) => Promise<boolean>;
  addReview: (data: Omit<ReviewEntity, 'id' | 'createdAt'>) => Promise<ReviewEntity>;
  resetDatabase: () => Promise<void>;
  exportDatabaseSnapshot: () => string;
  refreshState: () => void;
  retry: () => Promise<void>;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

function mapDomainRestaurantToEntity(r: Restaurant): RestaurantEntity {
  return {
    id: r.id,
    ownerId: r.ownerId || '',
    name: r.name,
    slug: r.slug,
    cuisine: r.cuisine || 'Local',
    description: r.description,
    sellerTier: r.sellerTier || 'BASIC_SELLER',
    rating: r.rating ?? 0,
    reviews: r.reviewsCount || 0,
    reviewsCount: r.reviewsCount || 0,
    price: r.minPriceTzs ? `TZS ${r.minPriceTzs.toLocaleString()}` : '',
    minPrice: r.minPriceTzs || 0,
    maxPrice: r.maxPriceTzs || 0,
    minPriceTzs: r.minPriceTzs || 0,
    maxPriceTzs: r.maxPriceTzs || 0,
    address: r.address || '',
    neighborhood: r.neighborhood || '',
    regionCity: r.regionCity || '',
    distanceKm: r.distanceKm || 0,
    distance: r.distanceKm ? `${r.distanceKm} km` : undefined,
    estimatedPrepTimeMinutes: r.estimatedPrepTimeMinutes || 0,
    time: r.estimatedPrepTimeMinutes ? `${r.estimatedPrepTimeMinutes} mins` : undefined,
    isOpen: r.isOpen ?? false,
    isVerified: r.isVerified ?? false,
    verificationStatus: r.verificationStatus || 'PENDING_VERIFICATION',
    tinNumber: r.tinNumber,
    businessLicenseNumber: r.businessLicenseNumber,
    payoutPhoneNumber: r.payoutPhoneNumber,
    payoutProvider: r.payoutProvider,
    openingHours: r.openingHours || '',
    closingHours: r.closingHours || '',
    logoUrl: r.logoUrl,
    coverImageUrl: r.coverImageUrl,
    foodSpotPhotos: r.foodSpotPhotos || [],
    specialty: r.specialty || r.cuisine || 'Local Cuisine',
    specialistBadge: r.specialistBadge,
    specialistCategory: r.specialistCategory,
    emoji: r.emoji || '🍲',
    tags: r.tags || [],
    supportsOrderAhead: r.supportsOrderAhead ?? false,
    menu: [],
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt,
  };
}

function mapDomainReservationToEntity(r: Reservation): ReservationEntity {
  let mappedStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed' = 'confirmed';
  if (r.status === 'CANCELLED') mappedStatus = 'cancelled';
  else if (r.status === 'PENDING') mappedStatus = 'pending';
  else if (r.status === 'CONFIRMED' || r.status === 'SEATED') mappedStatus = 'confirmed';

  return {
    id: r.id,
    userId: r.customerId,
    restaurantId: r.restaurantId,
    restaurantName: r.restaurantName || 'Restaurant',
    guestsCount: `${r.partySize || 2} Guests`,
    reservationDate: r.reservationDate,
    timeSlot: r.reservationTime,
    address: '',
    depositAmountTzs: r.depositAmountTzs || 0,
    depositOption: r.depositOption || 'deposit_50',
    specialNotes: r.customerNote,
    status: mappedStatus,
    createdAt: r.createdAt,
  };
}

function mapDomainCustomMealToEntity(r: CustomMealRequest): CustomMealRequestEntity {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    userId: r.customerId,
    dishName: r.dishName || r.title || 'Custom Meal',
    restaurantName: 'All Participating Chefs',
    specialInstructions: r.specialInstructions || r.description || '',
    budgetTzs: r.budgetTzs,
    servingsCount: r.servingsCount || r.servings || '1',
    diningOption: (r.diningOption as any) || 'Delivery',
    deliveryAddress: r.deliveryLocation,
    status: 'Pending Confirmation',
    statusMessageEn: r.statusMessageEn || 'Order submitted.',
    statusMessageSw: r.statusMessageSw || 'Agizo limetumwa.',
    paymentStatus: 'UNPAID',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapDomainNotificationToEntity(n: Notification): NotificationEntity {
  return {
    id: n.id,
    userId: n.userId,
    type: (n.type as any) || 'system',
    titleEn: n.titleEn,
    titleSw: n.titleSw,
    messageEn: n.messageEn,
    messageSw: n.messageSw,
    isRead: n.isRead,
    createdAt: n.createdAt,
    timeAgoEn: 'Just now',
    timeAgoSw: 'Sasa hivi',
    data: n.payload,
  };
}

export const DbProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In test/demo mode initialize with local snapshot; in real mode initialize with clean empty snapshot
  const [dbState, setDbState] = useState<MloHubDatabaseSchema>(() =>
    allowLocalFallbacks ? MloHubDB.getSnapshot() : createEmptyDbSnapshot()
  );

  const [cloudRestaurants, setCloudRestaurants] = useState<RestaurantEntity[]>([]);
  const [cloudReservations, setCloudReservations] = useState<ReservationEntity[]>([]);
  const [cloudStandardOrders, setCloudStandardOrders] = useState<Order[]>([]);
  const [cloudOrders, setCloudOrders] = useState<CustomMealRequestEntity[]>([]);
  const cloudCustomOrders = cloudOrders;
  const setCloudCustomOrders = setCloudOrders;
  const [cloudNotifications, setCloudNotifications] = useState<NotificationEntity[]>([]);
  const [cloudUser, setCloudUser] = useState<UserEntity | undefined>(undefined);
  const [onboardingState, setOnboardingState] = useState<boolean>(false);
  const [clientFavorites, setClientFavorites] = useState<string[]>([]);

  const isCloud = isSupabaseConfigured();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (allowLocalFallbacks) {
        // Test / Demo mode: preserve existing local snapshot behavior
        const snapshot = await MloHubDB.init();
        setDbState({ ...snapshot });

        if (isCloud) {
          try {
            const restaurants = await RestaurantRepository.list();
            setCloudRestaurants((restaurants || []).map(mapDomainRestaurantToEntity));
            if (snapshot.activeUserId) {
              const reservations = await ReservationRepository.listByCustomer(snapshot.activeUserId);
              setCloudReservations(reservations.map(mapDomainReservationToEntity));

              const standardOrders = await OrderRepository.listByCustomer(snapshot.activeUserId);
              setCloudStandardOrders(standardOrders);

              const orders = await CustomMealRepository.listRequestsForCustomer(snapshot.activeUserId);
              setCloudCustomOrders(orders.map(mapDomainCustomMealToEntity));

              const notifications = await NotificationRepository.listForUser(snapshot.activeUserId);
              setCloudNotifications(notifications.map(mapDomainNotificationToEntity));
            }
          } catch (subErr) {
            console.warn('DbContext [test/demo]: Notice loading user-specific data from Supabase:', subErr);
          }
        }
      } else {
        // Development / Staging / Production mode: Supabase is authoritative
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase client is not configured in this environment.');
        }

        // 1. Authoritative Restaurants
        const restaurants = await RestaurantRepository.list();
        setCloudRestaurants((restaurants || []).map(mapDomainRestaurantToEntity));

        // 2. Client preference for onboarding completion
        const onboardingPref = await getClientPreference(ONBOARDING_PREF_KEY);
        if (onboardingPref === 'true') {
          setOnboardingState(true);
        }

        // 3. Current Authenticated Supabase User
        const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
        if (authErr) {
          console.warn('[DbContext] Supabase auth.getUser notice:', authErr.message);
        }

        if (authUser?.id) {
          // Derive profile for compatibility user in DbContext
          try {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .maybeSingle();

            if (profileRow) {
              const mappedUser: UserEntity = {
                id: profileRow.id,
                fullName: profileRow.full_name || authUser.user_metadata?.full_name || '',
                email: profileRow.email || authUser.email || '',
                phone: profileRow.phone || authUser.phone || '',
                passwordHash: 'sb-external',
                role: (UserRole as any)[profileRow.role] || UserRole.CUSTOMER,
                roles: Array.isArray(profileRow.roles)
                  ? profileRow.roles.map((r: string) => (UserRole as any)[r] || UserRole.CUSTOMER)
                  : [UserRole.CUSTOMER],
                activeRole: (UserRole as any)[profileRow.role] || UserRole.CUSTOMER,
                activeWorkspace: profileRow.active_workspace || 'CUSTOMER',
                location: profileRow.location || '',
                status: profileRow.status || 'ACTIVE',
                language: profileRow.language || profileRow.preferred_language || 'sw',
                createdAt: profileRow.created_at || authUser.created_at,
                updatedAt: profileRow.updated_at,
              };
              setCloudUser(mappedUser);
            } else {
              setCloudUser(undefined);
            }
          } catch (profileErr) {
            console.warn('[DbContext] Notice deriving profile from Supabase:', profileErr);
            setCloudUser(undefined);
          }

          // Fetch authenticated user's reservations, orders, and notifications
          const [reservations, standardOrders, customOrders, notifications] = await Promise.all([
            ReservationRepository.listByCustomer(authUser.id).catch((err) => {
              console.warn('[DbContext] Error loading reservations:', err.message);
              return [];
            }),
            OrderRepository.listByCustomer(authUser.id).catch((err) => {
              console.warn('[DbContext] Error loading standard orders:', err.message);
              return [];
            }),
            CustomMealRepository.listRequestsForCustomer(authUser.id).catch((err) => {
              console.warn('[DbContext] Error loading custom meals:', err.message);
              return [];
            }),
            NotificationRepository.listForUser(authUser.id).catch((err) => {
              console.warn('[DbContext] Error loading notifications:', err.message);
              return [];
            }),
          ]);

          setCloudReservations(reservations.map(mapDomainReservationToEntity));
          setCloudStandardOrders(standardOrders);
          setCloudCustomOrders(customOrders.map(mapDomainCustomMealToEntity));
          setCloudNotifications(notifications.map(mapDomainNotificationToEntity));
        } else {
          setCloudUser(undefined);
          setCloudReservations([]);
          setCloudStandardOrders([]);
          setCloudCustomOrders([]);
          setCloudNotifications([]);
        }
      }
    } catch (err: any) {
      console.error('DbContext loadData error:', err);
      setError(err?.message || 'Failed to initialize database connection');
    } finally {
      setIsReady(true);
      setLoading(false);
    }
  }, [isCloud]);

  useEffect(() => {
    loadData();

    // Realtime listeners to keep state synchronized across tabs & flows
    const unsubOrders = RealtimeEventEngine.subscribe('orders:*', () => {
      refreshState();
    });
    const unsubNotif = RealtimeEventEngine.subscribe('notifications:*', () => {
      refreshState();
    });
    const unsubRestaurants = RealtimeEventEngine.subscribe('restaurants:*', () => {
      refreshState();
    });
    const unsubAuth = RealtimeEventEngine.subscribe('auth:*', () => {
      refreshState();
    });

    const unsubResync = RealtimeService.registerResyncCallback('db_context', () => {
      refreshState();
    });

    return () => {
      unsubOrders();
      unsubNotif();
      unsubRestaurants();
      unsubAuth();
      unsubResync();
    };
  }, [loadData]);

  const refreshState = () => {
    loadData();
  };

  const setOnboardingCompleted = async (completed: boolean = true): Promise<void> => {
    if (allowLocalFallbacks) {
      await MloHubDB.setOnboardingCompleted(completed);
      refreshState();
      return;
    }
    // Real mode: client preference only
    await setClientPreference(ONBOARDING_PREF_KEY, String(completed));
    setOnboardingState(completed);
  };

  const updateUser = async (data: Partial<UserEntity>): Promise<UserEntity> => {
    if (!allowLocalFallbacks) {
      const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
      if (!currentAuthUser?.id) {
        throw new Error('Cannot update user profile: no authenticated user found.');
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (data.fullName !== undefined) updates.full_name = data.fullName.trim();
      if (data.phone !== undefined) updates.phone = data.phone.trim();
      if (data.language !== undefined) updates.preferred_language = data.language;

      const { data: updatedRow, error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentAuthUser.id)
        .select('*')
        .single();

      if (updateErr) {
        throw new Error(`Failed to update profile: ${updateErr.message}`);
      }

      const mappedUser: UserEntity = {
        id: updatedRow.id,
        fullName: updatedRow.full_name || '',
        email: updatedRow.email || currentAuthUser.email || '',
        phone: updatedRow.phone || '',
        passwordHash: 'sb-external',
        role: (UserRole as any)[updatedRow.role] || UserRole.CUSTOMER,
        roles: Array.isArray(updatedRow.roles)
          ? updatedRow.roles.map((r: string) => (UserRole as any)[r] || UserRole.CUSTOMER)
          : [UserRole.CUSTOMER],
        activeRole: (UserRole as any)[updatedRow.role] || UserRole.CUSTOMER,
        activeWorkspace: updatedRow.active_workspace || 'CUSTOMER',
        location: updatedRow.location || '',
        status: updatedRow.status || 'ACTIVE',
        language: updatedRow.language || updatedRow.preferred_language || 'sw',
        createdAt: updatedRow.created_at,
        updatedAt: updatedRow.updated_at,
      };

      setCloudUser(mappedUser);
      refreshState();
      return mappedUser;
    }

    // Test/demo fallback:
    const updated = await MloHubDB.user.update(data);
    refreshState();
    return updated;
  };

  const switchUser = async (userId: string): Promise<UserEntity> => {
    if (!allowLocalFallbacks) {
      throw new Error('Account switching is disabled in this environment.');
    }
    const switched = await MloHubDB.user.switch(userId);
    refreshState();
    return switched;
  };

  const toggleFavorite = async (restaurantId: string): Promise<boolean> => {
    if (allowLocalFallbacks) {
      const isFav = await MloHubDB.restaurants.toggleFavorite(restaurantId);
      refreshState();
      return isFav;
    }
    // Real mode: Favorites persistence is deferred until canonical backend exists
    return false;
  };

  const createReservation = async (
    data: Omit<ReservationEntity, 'id' | 'createdAt'>
  ): Promise<ReservationEntity> => {
    if (!allowLocalFallbacks) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        throw new Error('Authentication required to create a reservation.');
      }
      const partySize = parseInt(data.guestsCount || '2', 10) || 2;
      const created = await ReservationRepository.create({
        customerId: authUser.id,
        restaurantId: data.restaurantId,
        partySize,
        reservationDate: data.reservationDate,
        reservationTime: data.timeSlot,
        status: data.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        customerNote: data.specialNotes,
        depositOption: data.depositOption || 'deposit_50',
        depositAmountTzs: data.depositAmountTzs || 0,
      });
      const entity = mapDomainReservationToEntity(created);
      setCloudReservations((prev) => [entity, ...prev]);
      return entity;
    }

    const res = await MloHubDB.reservations.create(data);
    refreshState();
    return res;
  };

  const cancelReservation = async (id: string): Promise<boolean> => {
    if (!allowLocalFallbacks) {
      const success = await ReservationRepository.cancel(id);
      if (success) {
        setCloudReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)));
      }
      return success;
    }

    const res = await MloHubDB.reservations.cancel(id);
    refreshState();
    return res;
  };

  const createCustomOrder = async (
    data: Omit<CustomMealRequestEntity, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomMealRequestEntity> => {
    if (!allowLocalFallbacks) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        throw new Error('Authentication required to create a custom meal request.');
      }
      const created = await CustomMealRepository.createRequest({
        customerId: authUser.id,
        dishName: data.dishName,
        specialInstructions: data.specialInstructions,
        budgetTzs: data.budgetTzs,
        servingsCount: data.servingsCount,
        diningOption: data.diningOption,
        deliveryLocation: data.deliveryAddress || 'Mikocheni',
      });
      const entity = mapDomainCustomMealToEntity(created);
      setCloudCustomOrders((prev) => [entity, ...prev]);
      return entity;
    }

    const ord = await MloHubDB.customOrders.create(data);
    refreshState();
    return ord;
  };

  const updateCustomOrder = async (
    id: string,
    data: Partial<CustomMealRequestEntity>
  ): Promise<CustomMealRequestEntity | undefined> => {
    if (!allowLocalFallbacks) {
      const updated = await CustomMealRepository.updateRequest(id, {
        dishName: data.dishName,
        specialInstructions: data.specialInstructions,
        budgetTzs: data.budgetTzs,
        servingsCount: data.servingsCount,
        diningOption: data.diningOption,
        deliveryLocation: data.deliveryAddress,
      });
      const entity = mapDomainCustomMealToEntity(updated);
      setCloudCustomOrders((prev) => prev.map((o) => (o.id === id ? entity : o)));
      return entity;
    }

    const ord = await MloHubDB.customOrders.update(id, data);
    refreshState();
    return ord;
  };

  const deleteCustomOrder = async (id: string): Promise<boolean> => {
    if (!allowLocalFallbacks) {
      const success = await CustomMealRepository.cancelRequest(id);
      if (success) {
        setCloudCustomOrders((prev) => prev.filter((o) => o.id !== id));
      }
      return success;
    }

    const res = await MloHubDB.customOrders.delete(id);
    refreshState();
    return res;
  };

  const addReview = async (
    data: Omit<ReviewEntity, 'id' | 'createdAt'>
  ): Promise<ReviewEntity> => {
    if (!allowLocalFallbacks) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.id) {
        throw new Error('Authentication required to submit a review.');
      }
      const created = await ReviewRepository.create({
        customerId: authUser.id,
        restaurantId: data.restaurantId,
        overallRating: data.rating,
        comment: data.comment,
      });
      return {
        id: created.id,
        restaurantId: created.restaurantId,
        userId: created.customerId,
        userName: data.userName || authUser.user_metadata?.full_name || 'Customer',
        rating: created.overallRating,
        comment: created.comment || '',
        createdAt: created.createdAt,
      };
    }

    const rev = await MloHubDB.reviews.create(data);
    refreshState();
    return rev;
  };

  const resetDatabase = async (): Promise<void> => {
    if (!allowLocalFallbacks) {
      throw new Error('Database reset is available only in test/demo mode.');
    }
    await MloHubDB.reset();
    refreshState();
  };

  const exportDatabaseSnapshot = (): string => {
    if (!allowLocalFallbacks) {
      return JSON.stringify(
        {
          environment: runtimeConfig.mode,
          isCloudBacked: true,
          restaurantsCount: activeRestaurants.length,
          reservationsCount: activeReservations.length,
          ordersCount: activeStandardOrders.length,
          customOrdersCount: activeCustomOrders.length,
          notificationsCount: activeNotifications.length,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      );
    }
    return JSON.stringify(MloHubDB.getSnapshot(), null, 2);
  };

  const activeUser = allowLocalFallbacks
    ? (dbState.activeUserId
        ? dbState.users.find((u) => u.id === dbState.activeUserId) || MloHubDB.user.get()
        : undefined)
    : cloudUser;

  // In real modes, cloud data is authoritative; empty arrays remain empty!
  const activeRestaurants = allowLocalFallbacks ? dbState.restaurants : cloudRestaurants;
  const activeReservations = allowLocalFallbacks ? dbState.reservations : cloudReservations;
  const activeStandardOrders = allowLocalFallbacks ? ((dbState as any).orders || []) : cloudStandardOrders;
  const activeOrders = allowLocalFallbacks ? dbState.customMealRequests : cloudOrders;
  const activeCustomOrders = activeOrders;
  const activeNotifications = allowLocalFallbacks ? dbState.notifications : cloudNotifications;
  const activePayments = allowLocalFallbacks ? dbState.payments : [];
  const activeUsers = allowLocalFallbacks ? dbState.users : (cloudUser ? [cloudUser] : []);
  const activeFavorites = allowLocalFallbacks ? dbState.favorites : [];
  const activeOnboarding = allowLocalFallbacks ? !!dbState.hasCompletedOnboarding : onboardingState;

  // Legacy compatibility shape only; not a production source of truth.
  const activeDbSnapshot = allowLocalFallbacks ? dbState : createEmptyDbSnapshot();

  return (
    <DbContext.Provider
      value={{
        isReady,
        loading,
        error,
        isCloudBacked: isCloud,
        dbSnapshot: activeDbSnapshot,
        hasCompletedOnboarding: activeOnboarding,
        user: activeUser,
        users: activeUsers,
        restaurants: activeRestaurants,
        reservations: activeReservations,
        orders: activeStandardOrders,
        customOrders: activeCustomOrders,
        notifications: activeNotifications,
        payments: activePayments,
        favorites: activeFavorites,
        setOnboardingCompleted,
        updateUser,
        switchUser,
        toggleFavorite,
        createReservation,
        cancelReservation,
        createCustomOrder,
        updateCustomOrder,
        deleteCustomOrder,
        addReview,
        resetDatabase,
        exportDatabaseSnapshot,
        refreshState,
        retry: loadData,
      }}
    >
      {children}
    </DbContext.Provider>
  );
};

export const useMloHubDB = (): DbContextType => {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useMloHubDB must be used within a DbProvider');
  }
  return context;
};
