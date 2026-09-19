import { StorageDriver } from './storage';
import { INITIAL_DATABASE_SEED } from './seed';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  MloHubDatabaseSchema,
  RestaurantEntity,
  ReservationEntity,
  CustomMealRequestEntity,
  NotificationEntity,
  PaymentTransactionEntity,
  ReviewEntity,
  UserEntity,
  CustomerProfileEntity,
  RestaurantMembershipEntity,
  RefreshSessionEntity,
  AuditLogEntity,
  MenuItemEntity,
  OtpChallengeEntity,
  SmsLogEntity,
  RestaurantApplicationEntity,
  PaymentEventEntity,
  RefundEntity,
} from './types';

/**
 * @deprecated [STAGE 2 DEPRECATION]
 * Legacy local JSON prototype database engine.
 * Supabase PostgreSQL via `repositories/*` and `services/*` is now the single source of truth.
 * This class is maintained solely for test suite compatibility and offline fixtures.
 * Do not use for new production features.
 */
class MloHubDatabaseEngine {
  private db: MloHubDatabaseSchema = INITIAL_DATABASE_SEED;
  private isInitialized = false;

  async init(): Promise<MloHubDatabaseSchema> {
    if (this.isInitialized) return this.db;

    try {
      const raw = await StorageDriver.getItem();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === INITIAL_DATABASE_SEED.version) {
          this.db = parsed;
          this.db.restaurantApplications = this.db.restaurantApplications || [];
        } else {
          this.db = { ...INITIAL_DATABASE_SEED, lastSyncedAt: new Date().toISOString() };
        }
      } else {
        this.db = { ...INITIAL_DATABASE_SEED, lastSyncedAt: new Date().toISOString() };
      }
    } catch (e) {
      console.warn('MloHub DB load error, using initial seed:', e);
      this.db = { ...INITIAL_DATABASE_SEED, lastSyncedAt: new Date().toISOString() };
    }

    this.db.restaurantApplications = this.db.restaurantApplications || [];
    await this.syncFromCloud();
    this.isInitialized = true;
    return this.db;
  }

  async syncFromCloud(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      // 1. Fetch vendor applications from Supabase 'users' table (which has full anon read/write permissions)
      const { data: cloudUsers } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'RESTAURANT_OWNER');

      if (cloudUsers && cloudUsers.length > 0) {
        const apps = (this.db.restaurantApplications = this.db.restaurantApplications || []);
        cloudUsers.forEach((u: any) => {
          if (u.password_hash && u.password_hash.startsWith('APP_META:')) {
            try {
              const meta = JSON.parse(u.password_hash.replace('APP_META:', ''));
              const appId = meta.appId || `app-${u.id}`;
              const existingIdx = apps.findIndex(
                (a) => a.id === appId || (a.ownerPhone && a.ownerPhone.replace(/[^0-9]/g, '') === (u.phone || '').replace(/[^0-9]/g, ''))
              );
              const appData: RestaurantApplicationEntity = {
                id: appId,
                businessName: u.company_or_group || meta.businessName || 'Mgahawa',
                ownerName: u.full_name || 'Mmiliki',
                ownerPhone: u.phone || '+255...',
                ownerEmail: u.email && !u.email.includes('@mlohub.co.tz') ? u.email : undefined,
                cuisineType: meta.cuisineType || 'Swahili',
                neighborhood: meta.neighborhood || 'Mikocheni',
                address: meta.address || 'Dar es Salaam',
                hasTinOrLicense: !!meta.hasTinOrLicense,
                tinNumber: meta.tinNumber,
                status: meta.status || 'PENDING',
                notes: meta.notes,
                createdAt: meta.createdAt || u.created_at,
                updatedAt: meta.updatedAt || u.updated_at,
              };
              if (existingIdx >= 0) {
                apps[existingIdx] = {
                  ...apps[existingIdx],
                  ...appData,
                };
              } else {
                apps.unshift(appData);
              }
            } catch (e) {
              console.warn('Failed to parse app metadata:', e);
            }
          }
        });
      }

      // 2. Fetch live verified restaurants from Supabase
      const { data: cloudRestaurants } = await supabase.from('restaurants').select('*');
      if (cloudRestaurants && cloudRestaurants.length > 0) {
        cloudRestaurants.forEach((cr: any) => {
          const existing = this.db.restaurants.find((r) => r.id === cr.id);
          if (!existing) {
            this.db.restaurants.push({
              ...cr,
              distanceKm: Number(cr.distance_km) || 1.0,
              minPrice: cr.min_price_tzs || 5000,
              maxPrice: cr.max_price_tzs || 25000,
              reviews: cr.reviews_count || 0,
              menu: [],
            });
          }
        });
      }

      await this.save();
    } catch (err) {
      console.warn('Supabase cloud hydration notice:', err);
    }
  }

  async save(): Promise<void> {
    this.db.lastSyncedAt = new Date().toISOString();
    await StorageDriver.setItem(undefined, JSON.stringify(this.db));
  }

  async reset(): Promise<void> {
    this.db = { ...INITIAL_DATABASE_SEED, lastSyncedAt: new Date().toISOString() };
    await this.save();
  }

  getSnapshot(): MloHubDatabaseSchema {
    return this.db;
  }

  hasCompletedOnboarding(): boolean {
    return !!this.db.hasCompletedOnboarding;
  }

  async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    this.db.hasCompletedOnboarding = completed;
    await this.save();
  }

  // --- USERS REPO ---
  users = {
    getAll: (): UserEntity[] => this.db.users,
    getById: (id: string): UserEntity | undefined =>
      this.db.users.find((u) => u.id === id),
    getByPhone: (phone: string): UserEntity | undefined =>
      this.db.users.find((u) => u.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')),
    getByEmail: (email: string): UserEntity | undefined =>
      this.db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
    create: async (data: UserEntity): Promise<UserEntity> => {
      this.db.users.unshift(data);
      await this.save();
      return data;
    },
    update: async (id: string, data: Partial<UserEntity>): Promise<UserEntity | undefined> => {
      const idx = this.db.users.findIndex((u) => u.id === id);
      if (idx >= 0) {
        this.db.users[idx] = { ...this.db.users[idx], ...data, updatedAt: new Date().toISOString() };
        await this.save();
        return this.db.users[idx];
      }
      return undefined;
    },
  };

  // --- USER REPO (ACTIVE USER) ---
  user = {
    getAll: (): UserEntity[] => this.db.users,
    get: (): UserEntity | undefined => {
      const activeUserId = this.db.activeUserId;
      if (!activeUserId) return undefined;
      return this.db.users.find((user) => user.id === activeUserId);
    },
    update: async (data: Partial<UserEntity>): Promise<UserEntity> => {
      const activeUserId = this.db.activeUserId;
      if (!activeUserId) {
        throw new Error('Authentication required: No active user session to update.');
      }
      const idx = this.db.users.findIndex((u) => u.id === activeUserId);
      if (idx >= 0) {
        this.db.users[idx] = { ...this.db.users[idx], ...data, updatedAt: new Date().toISOString() };
        await this.save();
        return this.db.users[idx];
      }
      throw new Error('User not found: Active user account does not exist.');
    },
    switch: async (userId: string): Promise<UserEntity> => {
      const activeUserId = this.db.activeUserId;
      if (!activeUserId || activeUserId !== userId) {
        throw new Error('403 Forbidden: Arbitrary account switching is disabled. Please log in with valid credentials.');
      }
      const targetUser = this.db.users.find((u) => u.id === userId);
      if (!targetUser) {
        throw new Error(`Cannot switch to unknown user ID: ${userId}`);
      }
      return targetUser;
    },
  };

  // --- RESTAURANTS REPO ---
  restaurants = {
    getAll: (): RestaurantEntity[] => this.db.restaurants,
    getById: (id: string): RestaurantEntity | undefined =>
      this.db.restaurants.find((r) => r.id === id),
    getFavorites: (): RestaurantEntity[] =>
      this.db.restaurants.filter((r) => this.db.favorites.includes(r.id)),
    isFavorite: (id: string): boolean => this.db.favorites.includes(id),
    toggleFavorite: async (id: string): Promise<boolean> => {
      if (this.db.favorites.includes(id)) {
        this.db.favorites = this.db.favorites.filter((favId) => favId !== id);
      } else {
        this.db.favorites.push(id);
      }
      await this.save();
      return this.db.favorites.includes(id);
    },
    create: async (data: RestaurantEntity): Promise<RestaurantEntity> => {
      this.db.restaurants.unshift(data);
      await this.save();
      return data;
    },
    update: async (id: string, data: Partial<RestaurantEntity>): Promise<RestaurantEntity | undefined> => {
      const idx = this.db.restaurants.findIndex((r) => r.id === id);
      if (idx >= 0) {
        this.db.restaurants[idx] = { ...this.db.restaurants[idx], ...data, updatedAt: new Date().toISOString() };
        await this.save();
        return this.db.restaurants[idx];
      }
      return undefined;
    },
    addMenuItem: async (
      restaurantId: string,
      item: Omit<MenuItemEntity, 'id' | 'createdAt' | 'restaurantId'> & { restaurantId?: string }
    ): Promise<MenuItemEntity | undefined> => {
      const rest = this.db.restaurants.find((r) => r.id === restaurantId);
      if (rest) {
        const newItem: MenuItemEntity = {
          ...item,
          id: `item-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          restaurantId,
          isAvailable: item.isAvailable ?? true,
          isArchived: false,
          createdAt: new Date().toISOString(),
        };
        rest.menu = rest.menu || [];
        rest.menu.push(newItem);
        await this.save();
        return newItem;
      }
      return undefined;
    },
    updateMenuItem: async (restaurantId: string, itemId: string, data: Partial<MenuItemEntity>): Promise<MenuItemEntity | undefined> => {
      const rest = this.db.restaurants.find((r) => r.id === restaurantId);
      if (rest && rest.menu) {
        const idx = rest.menu.findIndex((m) => m.id === itemId);
        if (idx >= 0) {
          rest.menu[idx] = { ...rest.menu[idx], ...data };
          await this.save();
          return rest.menu[idx];
        }
      }
      return undefined;
    },
    archiveMenuItem: async (restaurantId: string, itemId: string): Promise<boolean> => {
      const rest = this.db.restaurants.find((r) => r.id === restaurantId);
      if (rest && rest.menu) {
        const item = rest.menu.find((m) => m.id === itemId);
        if (item) {
          item.isArchived = true;
          item.isAvailable = false;
          await this.save();
          return true;
        }
      }
      return false;
    },
    deleteMenuItem: async (restaurantId: string, itemId: string): Promise<boolean> => {
      const rest = this.db.restaurants.find((r) => r.id === restaurantId);
      if (rest && rest.menu) {
        rest.menu = rest.menu.filter((m) => m.id !== itemId);
        await this.save();
        return true;
      }
      return false;
    },
  };

  // --- RESTAURANT MEMBERSHIPS REPO ---
  restaurantMemberships = {
    getAll: (): RestaurantMembershipEntity[] => this.db.restaurantMemberships || [],
    getByUserId: (userId: string): RestaurantMembershipEntity[] =>
      (this.db.restaurantMemberships || []).filter((rm) => rm.userId === userId),
    getByRestaurantId: (restaurantId: string): RestaurantMembershipEntity[] =>
      (this.db.restaurantMemberships || []).filter((rm) => rm.restaurantId === restaurantId),
    create: async (
      data: Omit<RestaurantMembershipEntity, 'id' | 'createdAt'> & { id?: string }
    ): Promise<RestaurantMembershipEntity> => {
      this.db.restaurantMemberships = this.db.restaurantMemberships || [];
      const newMembership: RestaurantMembershipEntity = {
        ...data,
        id: data.id || `rm-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
      };
      this.db.restaurantMemberships.unshift(newMembership);
      await this.save();
      return newMembership;
    },
  };

  // --- RESERVATIONS REPO ---
  reservations = {
    getAll: (): ReservationEntity[] => this.db.reservations,
    getById: (id: string): ReservationEntity | undefined =>
      this.db.reservations.find((r) => r.id === id),
    create: async (data: Omit<ReservationEntity, 'id' | 'createdAt'>): Promise<ReservationEntity> => {
      const newRes: ReservationEntity = {
        ...data,
        id: `res-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      this.db.reservations.unshift(newRes);

      // Trigger automatic notification in DB
      this.db.notifications.unshift({
        id: `notif-${Date.now()}`,
        userId: data.userId,
        type: 'reservation_pending',
        category: 'reservation',
        titleEn: 'Reservation Request Sent',
        titleSw: 'Ombi la Meza Limetumwa',
        messageEn: `Your reservation request at ${data.restaurantName} for ${data.timeSlot} (${data.reservationDate}) has been received.`,
        messageSw: `Ombi lako la meza ${data.restaurantName} kwa ${data.timeSlot} (${data.reservationDate}) limepokelewa.`,
        isRead: false,
        createdAt: new Date().toISOString(),
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: data.restaurantName,
        reservationDate: data.reservationDate,
        reservationTime: data.timeSlot,
        guests: data.guestsCount,
        actionType: 'view_reservation',
      });

      await this.save();
      return newRes;
    },
    cancel: async (id: string): Promise<boolean> => {
      const idx = this.db.reservations.findIndex((r) => r.id === id);
      if (idx >= 0) {
        this.db.reservations[idx].status = 'cancelled';
        await this.save();
        return true;
      }
      return false;
    },
  };

  // --- CUSTOM ORDERS REPO (VISION X) ---
  customOrders = {
    getAll: (): CustomMealRequestEntity[] => this.db.customMealRequests,
    getById: (id: string): CustomMealRequestEntity | undefined =>
      this.db.customMealRequests.find((c) => c.id === id),
    create: async (
      data: Omit<CustomMealRequestEntity, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
    ): Promise<CustomMealRequestEntity> => {
      const deliveryPin = data.deliveryPin || Math.floor(1000 + Math.random() * 9000).toString();
      const newOrd: CustomMealRequestEntity = {
        ...data,
        deliveryPin,
        id: `cm-${Date.now()}`,
        orderNumber: `MLO-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.customMealRequests.unshift(newOrd);

      // Trigger automatic notification in DB with delivery PIN
      this.db.notifications.unshift({
        id: `notif-${Date.now()}`,
        userId: data.userId,
        type: 'custom_meal_submitted',
        category: 'order',
        titleEn: 'Order Broadcasted! PIN: ' + deliveryPin,
        titleSw: 'Agizo Limetumwa! PIN: ' + deliveryPin,
        messageEn: `Your order "${data.dishName}" is in preparation. Your delivery confirmation PIN is ${deliveryPin}.`,
        messageSw: `Agizo lako "${data.dishName}" linaandaliwa. Namba yako ya uthibitisho (PIN) ni ${deliveryPin}.`,
        isRead: false,
        createdAt: new Date().toISOString(),
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: data.restaurantName,
        dishName: data.dishName,
        price: data.budgetTzs,
        actionType: 'view_custom_orders',
      });

      await this.save();

      // Broadcast order across cloud WebSockets via Supabase Realtime
      if (isSupabaseConfigured()) {
        try {
          supabase.from('custom_meal_requests').insert({
            id: newOrd.id,
            user_id: newOrd.userId,
            order_number: newOrd.orderNumber,
            dish_name: newOrd.dishName,
            restaurant_name: newOrd.restaurantName,
            target_restaurant_id: newOrd.targetRestaurantId || null,
            special_instructions: newOrd.specialInstructions,
            budget_tzs: newOrd.budgetTzs,
            servings_count: newOrd.servingsCount,
            dining_option: newOrd.diningOption,
            status: newOrd.status,
            status_message_en: newOrd.statusMessageEn,
            status_message_sw: newOrd.statusMessageSw,
          }).then(({ error }) => {
            if (error) console.warn('[Supabase Order Sync Warning]:', error.message);
          });
        } catch (e) {
          console.warn('[Supabase Order Sync Catch]:', e);
        }
      }

      return newOrd;
    },
    update: async (
      id: string,
      data: Partial<CustomMealRequestEntity>
    ): Promise<CustomMealRequestEntity | undefined> => {
      const idx = this.db.customMealRequests.findIndex((c) => c.id === id);
      if (idx >= 0) {
        this.db.customMealRequests[idx] = {
          ...this.db.customMealRequests[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        };
        await this.save();

        // Broadcast status update across cloud WebSockets
        if (isSupabaseConfigured()) {
          try {
            supabase.from('custom_meal_requests').update({
              status: data.status,
              status_message_en: data.statusMessageEn,
              status_message_sw: data.statusMessageSw,
              updated_at: new Date().toISOString(),
            }).eq('id', id).then(({ error }) => {
              if (error) console.warn('[Supabase Status Update Warning]:', error.message);
            });
          } catch (e) {
            console.warn('[Supabase Status Update Catch]:', e);
          }
        }

        return this.db.customMealRequests[idx];
      }
      return undefined;
    },
    delete: async (id: string): Promise<boolean> => {
      this.db.customMealRequests = this.db.customMealRequests.filter((c) => c.id !== id);
      await this.save();
      return true;
    },
  };

  // --- REVIEWS REPO ---
  reviews = {
    getAll: (): ReviewEntity[] => this.db.reviews,
    getByRestaurantId: (restaurantId: string): ReviewEntity[] =>
      this.db.reviews.filter((r) => r.restaurantId === restaurantId),
    create: async (data: Omit<ReviewEntity, 'id' | 'createdAt'>): Promise<ReviewEntity> => {
      const newRev: ReviewEntity = {
        ...data,
        id: `rev-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      this.db.reviews.unshift(newRev);
      await this.save();
      return newRev;
    },
  };

  // --- NOTIFICATIONS REPO ---
  notifications = {
    getAll: (): NotificationEntity[] => this.db.notifications,
    create: async (data: Partial<NotificationEntity> & { userId: string; titleEn: string; titleSw: string; messageEn: string; messageSw: string }): Promise<NotificationEntity> => {
      const newNotif: NotificationEntity = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: data.userId,
        type: (data.type as any) || 'system',
        category: data.category || 'general',
        titleEn: data.titleEn,
        titleSw: data.titleSw,
        messageEn: data.messageEn,
        messageSw: data.messageSw,
        isRead: false,
        createdAt: new Date().toISOString(),
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        data: data.data,
      };
      this.db.notifications.unshift(newNotif);
      await this.save();
      return newNotif;
    },
    markAsRead: async (id: string): Promise<void> => {
      const notif = this.db.notifications.find((n) => n.id === id);
      if (notif) {
        notif.isRead = true;
        await this.save();
      }
    },
    markAllAsRead: async (): Promise<void> => {
      this.db.notifications.forEach((n) => (n.isRead = true));
      await this.save();
    },
    clearAll: async (): Promise<void> => {
      this.db.notifications = [];
      await this.save();
    },
  };

  // --- PAYMENTS REPOSITORY (CLICKPESA & TANZANIA MOBILE MONEY) ---
  payments = {
    getAll: (): PaymentTransactionEntity[] => this.db.payments,
    getById: (id: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.id === id),
    getByOrderId: (orderId: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.orderId === orderId),
    getByReservationId: (reservationId: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.reservationId === reservationId),
    getByProviderReference: (providerRef: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.providerReference === providerRef || p.providerTransactionId === providerRef),
    getByMerchantReference: (merchantRef: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.merchantReference === merchantRef),
    getByIdempotencyKey: (key: string): PaymentTransactionEntity | undefined =>
      this.db.payments.find((p) => p.idempotencyKey === key),
    create: async (
      data: Omit<PaymentTransactionEntity, 'id' | 'createdAt'>
    ): Promise<PaymentTransactionEntity> => {
      const newPay: PaymentTransactionEntity = {
        ...data,
        id: `pay-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.payments.unshift(newPay);
      await this.save();
      return newPay;
    },
    update: async (
      id: string,
      data: Partial<PaymentTransactionEntity>
    ): Promise<PaymentTransactionEntity | undefined> => {
      const idx = this.db.payments.findIndex((p) => p.id === id);
      if (idx >= 0) {
        this.db.payments[idx] = {
          ...this.db.payments[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        };
        await this.save();
        return this.db.payments[idx];
      }
      return undefined;
    },
  };

  // --- PAYMENT EVENTS REPOSITORY (APPEND-ONLY FINANCIAL LEDGER) ---
  paymentEvents = {
    getAll: (): PaymentEventEntity[] => this.db.paymentEvents || [],
    getByPaymentId: (paymentId: string): PaymentEventEntity[] =>
      (this.db.paymentEvents || []).filter((e) => e.paymentId === paymentId),
    getByEventId: (eventId: string): PaymentEventEntity | undefined =>
      (this.db.paymentEvents || []).find((e) => e.eventId === eventId),
    create: async (data: Omit<PaymentEventEntity, 'id' | 'createdAt'>): Promise<PaymentEventEntity> => {
      this.db.paymentEvents = this.db.paymentEvents || [];
      const newEvent: PaymentEventEntity = {
        ...data,
        id: `evt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
      };
      this.db.paymentEvents.unshift(newEvent);
      await this.save();
      return newEvent;
    },
  };

  // --- REFUNDS REPOSITORY ---
  refunds = {
    getAll: (): RefundEntity[] => this.db.refunds || [],
    getById: (id: string): RefundEntity | undefined =>
      (this.db.refunds || []).find((r) => r.id === id),
    getByPaymentId: (paymentId: string): RefundEntity[] =>
      (this.db.refunds || []).filter((r) => r.paymentId === paymentId),
    create: async (data: Omit<RefundEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<RefundEntity> => {
      this.db.refunds = this.db.refunds || [];
      const newRefund: RefundEntity = {
        ...data,
        id: `ref-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.refunds.unshift(newRefund);
      await this.save();
      return newRefund;
    },
    update: async (id: string, data: Partial<RefundEntity>): Promise<RefundEntity | undefined> => {
      this.db.refunds = this.db.refunds || [];
      const idx = this.db.refunds.findIndex((r) => r.id === id);
      if (idx >= 0) {
        this.db.refunds[idx] = {
          ...this.db.refunds[idx],
          ...data,
          updatedAt: new Date().toISOString(),
        };
        await this.save();
        return this.db.refunds[idx];
      }
      return undefined;
    },
  };

  // --- AUDIT LOGS REPO ---
  auditLogs = {
    getAll: (): AuditLogEntity[] => this.db.auditLogs || [],
    getById: (id: string): AuditLogEntity | undefined =>
      (this.db.auditLogs || []).find((a) => a.id === id),
    filterByAdmin: (adminUserId: string): AuditLogEntity[] =>
      (this.db.auditLogs || []).filter((a) => a.adminUserId === adminUserId),
    filterByTarget: (targetType: string, targetId: string): AuditLogEntity[] =>
      (this.db.auditLogs || []).filter(
        (a) => a.targetType === targetType && a.targetId === targetId
      ),
    create: async (
      data: Omit<AuditLogEntity, 'id' | 'timestamp'>
    ): Promise<AuditLogEntity> => {
      this.db.auditLogs = this.db.auditLogs || [];
      const newLog: AuditLogEntity = {
        ...data,
        id: `audit-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: new Date().toISOString(),
      };
      this.db.auditLogs.unshift(newLog);
      await this.save();
      return newLog;
    },
  };

  // --- OTP CHALLENGES REPO ---
  otpChallenges = {
    getAll: (): OtpChallengeEntity[] => this.db.otpChallenges || [],
    getActiveByPhone: async (phone: string): Promise<OtpChallengeEntity | undefined> => {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const challenges = this.db.otpChallenges || [];
      // Find latest unverified, non-invalidated challenge
      return challenges
        .filter((c) => c.phone.replace(/[^0-9]/g, '') === cleanPhone && !c.isVerified && !c.invalidatedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    },
    create: async (
      data: Omit<OtpChallengeEntity, 'id' | 'createdAt'>
    ): Promise<OtpChallengeEntity> => {
      this.db.otpChallenges = this.db.otpChallenges || [];
      const newChallenge: OtpChallengeEntity = {
        ...data,
        id: `otp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        createdAt: new Date().toISOString(),
      };
      this.db.otpChallenges.unshift(newChallenge);
      await this.save();
      return newChallenge;
    },
    incrementAttempts: async (id: string): Promise<void> => {
      this.db.otpChallenges = this.db.otpChallenges || [];
      const challenge = this.db.otpChallenges.find((c) => c.id === id);
      if (challenge) {
        challenge.attemptsCount += 1;
        await this.save();
      }
    },
    markVerified: async (id: string): Promise<void> => {
      this.db.otpChallenges = this.db.otpChallenges || [];
      const challenge = this.db.otpChallenges.find((c) => c.id === id);
      if (challenge) {
        challenge.isVerified = true;
        await this.save();
      }
    },
    invalidate: async (id: string): Promise<void> => {
      this.db.otpChallenges = this.db.otpChallenges || [];
      const challenge = this.db.otpChallenges.find((c) => c.id === id);
      if (challenge) {
        challenge.invalidatedAt = new Date().toISOString();
        await this.save();
      }
    },
  };

  // --- SMS LOGS REPO (Stage 8) ---
  smsLogs = {
    getAll: (): SmsLogEntity[] => this.db.smsLogs || [],
    getByRecipient: (phone: string): SmsLogEntity[] => {
      const clean = phone.replace(/[^0-9]/g, '');
      return (this.db.smsLogs || []).filter(
        (l) => l.recipient.replace(/[^0-9]/g, '') === clean
      );
    },
    create: async (data: SmsLogEntity): Promise<SmsLogEntity> => {
      this.db.smsLogs = this.db.smsLogs || [];
      this.db.smsLogs.unshift(data);
      await this.save();
      return data;
    },
    updateStatus: async (
      id: string,
      status: SmsLogEntity['status'],
      errorMessage?: string
    ): Promise<void> => {
      this.db.smsLogs = this.db.smsLogs || [];
      const log = this.db.smsLogs.find((l) => l.id === id);
      if (log) {
        log.status = status;
        if (errorMessage) log.errorMessage = errorMessage;
        log.updatedAt = new Date().toISOString();
        await this.save();
      }
    },
  };

  // --- RESTAURANT APPLICATIONS REPO ---
  restaurantApplications = {
    getAll: (): RestaurantApplicationEntity[] => this.db.restaurantApplications || [],
    getAllAsync: async (): Promise<RestaurantApplicationEntity[]> => {
      await this.syncFromCloud();
      return this.db.restaurantApplications || [];
    },
    getById: (id: string): RestaurantApplicationEntity | undefined =>
      (this.db.restaurantApplications || []).find((a) => a.id === id),
    create: async (
      data: Omit<RestaurantApplicationEntity, 'id' | 'status' | 'createdAt' | 'updatedAt'>
    ): Promise<RestaurantApplicationEntity> => {
      this.db.restaurantApplications = this.db.restaurantApplications || [];
      const newApp: RestaurantApplicationEntity = {
        ...data,
        id: `app-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.restaurantApplications.unshift(newApp);
      await this.save();

      if (isSupabaseConfigured()) {
        try {
          const metaPayload = JSON.stringify({
            appId: newApp.id,
            businessName: newApp.businessName,
            cuisineType: newApp.cuisineType,
            neighborhood: newApp.neighborhood,
            address: newApp.address,
            hasTinOrLicense: newApp.hasTinOrLicense,
            tinNumber: newApp.tinNumber,
            status: 'PENDING',
            notes: newApp.notes,
            createdAt: newApp.createdAt,
            updatedAt: newApp.updatedAt,
          });

          const safeEmail =
            newApp.ownerEmail && newApp.ownerEmail.includes('@')
              ? newApp.ownerEmail.trim().toLowerCase()
              : `vendor_${newApp.id.replace(/[^a-zA-Z0-9]/g, '')}@mlohub.co.tz`;
          const cleanPhone = newApp.ownerPhone.replace(/[^0-9+]/g, '');

          await supabase.from('users').upsert(
            {
              full_name: newApp.ownerName,
              company_or_group: newApp.businessName,
              email: safeEmail,
              phone: cleanPhone,
              password_hash: `APP_META:${metaPayload}`,
              role: 'RESTAURANT_OWNER',
              active_role: 'RESTAURANT_OWNER',
              is_phone_verified: true,
              security_pin: '1234',
            },
            { onConflict: 'phone' }
          );
        } catch (err) {
          console.warn('Failed to sync restaurant application to Supabase users:', err);
        }
      }

      return newApp;
    },
    updateStatus: async (
      id: string,
      status: 'PENDING' | 'APPROVED' | 'REJECTED',
      notes?: string,
      reviewedBy?: string
    ): Promise<RestaurantApplicationEntity | undefined> => {
      this.db.restaurantApplications = this.db.restaurantApplications || [];
      const app = this.db.restaurantApplications.find((a) => a.id === id);
      if (app) {
        app.status = status;
        if (notes !== undefined) app.notes = notes;
        if (reviewedBy !== undefined) app.reviewedBy = reviewedBy;
        app.updatedAt = new Date().toISOString();
        await this.save();

        if (isSupabaseConfigured()) {
          try {
            const cleanPhone = app.ownerPhone.replace(/[^0-9+]/g, '');
            const metaPayload = JSON.stringify({
              appId: app.id,
              businessName: app.businessName,
              cuisineType: app.cuisineType,
              neighborhood: app.neighborhood,
              address: app.address,
              hasTinOrLicense: app.hasTinOrLicense,
              tinNumber: app.tinNumber,
              status,
              notes: app.notes,
              createdAt: app.createdAt,
              updatedAt: app.updatedAt,
            });
            await supabase
              .from('users')
              .update({
                password_hash: `APP_META:${metaPayload}`,
                updated_at: app.updatedAt,
              })
              .eq('phone', cleanPhone);
          } catch (err) {
            console.warn('Failed to update restaurant status in Supabase users:', err);
          }
        }

        return app;
      }
      return undefined;
    },
  };
}

/**
 * @deprecated [STAGE 2 DEPRECATION]
 * Use repositories from `repositories/*` and domain services from `services/*`.
 * This singleton is retained for legacy test suites and offline mock fallbacks.
 */
export const MloHubDB = new MloHubDatabaseEngine();
