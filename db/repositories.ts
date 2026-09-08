import { StorageDriver } from './storage';
import { INITIAL_DATABASE_SEED } from './seed';
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
  RestaurantApplicationEntity,
} from './types';

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
          this.isInitialized = true;
          return this.db;
        }
      }
    } catch (e) {
      console.warn('MloHub DB load error, using initial seed:', e);
    }

    this.db = { ...INITIAL_DATABASE_SEED, lastSyncedAt: new Date().toISOString() };
    await this.save();
    this.isInitialized = true;
    return this.db;
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
    get: (): UserEntity => {
      const active = this.db.users.find((u) => u.id === this.db.activeUserId);
      return active || this.db.users[0];
    },
    update: async (data: Partial<UserEntity>): Promise<UserEntity> => {
      const idx = this.db.users.findIndex((u) => u.id === (this.db.activeUserId || this.db.users[0].id));
      if (idx >= 0) {
        this.db.users[idx] = { ...this.db.users[idx], ...data, updatedAt: new Date().toISOString() };
        await this.save();
        return this.db.users[idx];
      }
      this.db.users[0] = { ...this.db.users[0], ...data, updatedAt: new Date().toISOString() };
      await this.save();
      return this.db.users[0];
    },
    switch: async (userId: string): Promise<UserEntity> => {
      this.db.activeUserId = userId;
      await this.save();
      return this.user.get();
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
      const newOrd: CustomMealRequestEntity = {
        ...data,
        id: `cm-${Date.now()}`,
        orderNumber: `MLO-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.db.customMealRequests.unshift(newOrd);

      // Trigger automatic notification in DB
      this.db.notifications.unshift({
        id: `notif-${Date.now()}`,
        userId: data.userId,
        type: 'custom_meal_submitted',
        category: 'order',
        titleEn: 'Custom Meal Request Broadcasted!',
        titleSw: 'Ombi Maalum la Mlo Limetumwa!',
        messageEn: `Your advance order "${data.dishName}" (${data.servingsCount} portions) has been sent to nearby rated specialist kitchens.`,
        messageSw: `Ombi lako la chakula "${data.dishName}" (watu ${data.servingsCount}) limetumwa kwa wapishi wa karibu.`,
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
      this.db.payments.find((p) => p.providerReference === providerRef),
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
      // Find latest unverified challenge
      return challenges
        .filter((c) => c.phone.replace(/[^0-9]/g, '') === cleanPhone && !c.isVerified)
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
  };

  // --- RESTAURANT APPLICATIONS REPO ---
  restaurantApplications = {
    getAll: (): RestaurantApplicationEntity[] => this.db.restaurantApplications || [],
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
        return app;
      }
      return undefined;
    },
  };
}

export const MloHubDB = new MloHubDatabaseEngine();
