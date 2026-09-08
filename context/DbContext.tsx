import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
} from '../db';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';

interface DbContextType {
  isReady: boolean;
  dbSnapshot: MloHubDatabaseSchema;
  hasCompletedOnboarding: boolean;
  user: UserEntity;
  users: UserEntity[];
  restaurants: RestaurantEntity[];
  reservations: ReservationEntity[];
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
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export const DbProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [dbState, setDbState] = useState<MloHubDatabaseSchema>(MloHubDB.getSnapshot());

  useEffect(() => {
    const bootstrap = async () => {
      const snapshot = await MloHubDB.init();
      setDbState({ ...snapshot });
      setIsReady(true);
    };
    bootstrap();

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

    return () => {
      unsubOrders();
      unsubNotif();
      unsubRestaurants();
    };
  }, []);

  const refreshState = () => {
    setDbState({ ...MloHubDB.getSnapshot() });
  };

  const setOnboardingCompleted = async (completed: boolean = true): Promise<void> => {
    await MloHubDB.setOnboardingCompleted(completed);
    refreshState();
  };

  const updateUser = async (data: Partial<UserEntity>): Promise<UserEntity> => {
    const updated = await MloHubDB.user.update(data);
    refreshState();
    return updated;
  };

  const switchUser = async (userId: string): Promise<UserEntity> => {
    const switched = await MloHubDB.user.switch(userId);
    refreshState();
    return switched;
  };

  const toggleFavorite = async (restaurantId: string): Promise<boolean> => {
    const isFav = await MloHubDB.restaurants.toggleFavorite(restaurantId);
    refreshState();
    return isFav;
  };

  const createReservation = async (
    data: Omit<ReservationEntity, 'id' | 'createdAt'>
  ): Promise<ReservationEntity> => {
    const res = await MloHubDB.reservations.create(data);
    refreshState();
    return res;
  };

  const cancelReservation = async (id: string): Promise<boolean> => {
    const res = await MloHubDB.reservations.cancel(id);
    refreshState();
    return res;
  };

  const createCustomOrder = async (
    data: Omit<CustomMealRequestEntity, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomMealRequestEntity> => {
    const ord = await MloHubDB.customOrders.create(data);
    refreshState();
    return ord;
  };

  const updateCustomOrder = async (
    id: string,
    data: Partial<CustomMealRequestEntity>
  ): Promise<CustomMealRequestEntity | undefined> => {
    const ord = await MloHubDB.customOrders.update(id, data);
    refreshState();
    return ord;
  };

  const deleteCustomOrder = async (id: string): Promise<boolean> => {
    const res = await MloHubDB.customOrders.delete(id);
    refreshState();
    return res;
  };

  const addReview = async (
    data: Omit<ReviewEntity, 'id' | 'createdAt'>
  ): Promise<ReviewEntity> => {
    const rev = await MloHubDB.reviews.create(data);
    refreshState();
    return rev;
  };

  const resetDatabase = async (): Promise<void> => {
    await MloHubDB.reset();
    refreshState();
  };

  const exportDatabaseSnapshot = (): string => {
    return JSON.stringify(MloHubDB.getSnapshot(), null, 2);
  };

  const activeUser =
    dbState.users.find((u) => u.id === dbState.activeUserId) ||
    dbState.users[0] ||
    MloHubDB.user.get();

  return (
    <DbContext.Provider
      value={{
        isReady,
        dbSnapshot: dbState,
        hasCompletedOnboarding: !!dbState.hasCompletedOnboarding,
        user: activeUser,
        users: dbState.users,
        restaurants: dbState.restaurants,
        reservations: dbState.reservations,
        customOrders: dbState.customMealRequests,
        notifications: dbState.notifications,
        payments: dbState.payments,
        favorites: dbState.favorites,
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
