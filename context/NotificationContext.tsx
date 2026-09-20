import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { runtimeConfig } from '../lib/runtimeConfig';
import { NotificationRepository } from '../repositories/notifications.repository';
import { NotificationPreferencesRepository } from '../repositories/notificationPreferences.repository';
import { NotificationChannel } from '../types/domain';
import { useAuth } from './AuthContext';

export type NotificationType =
  | 'reservation_confirmed'
  | 'reservation_pending'
  | 'reservation_cancelled'
  | 'reservation_reminder'
  | 'custom_meal_received'
  | 'custom_meal_accepted'
  | 'custom_meal_rejected'
  | 'custom_meal_preparing'
  | 'custom_meal_ready'
  | 'payment_success'
  | 'payment_failed'
  | 'review_reminder'
  | 'promotion';

export type NotificationCategory = 'all' | 'reservation' | 'order' | 'payment' | 'offer';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: 'reservation' | 'order' | 'payment' | 'offer';
  titleEn: string;
  titleSw: string;
  messageEn: string;
  messageSw: string;
  isRead: boolean;
  createdAt: string;
  timeAgoEn: string;
  timeAgoSw: string;
  restaurantName?: string;
  restaurantId?: string;
  reservationDate?: string;
  reservationTime?: string;
  guests?: string;
  address?: string;
  cancellationReasonEn?: string;
  cancellationReasonSw?: string;
  dishName?: string;
  price?: number;
  prepTime?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  discountPercentage?: number;
  actionType?:
    | 'view_reservation'
    | 'view_receipt'
    | 'rate_restaurant'
    | 'view_order'
    | 'retry_payment'
    | 'get_directions'
    | 'find_restaurant'
    | 'edit_request';
}

export interface NotificationPreferences {
  reservationUpdates: boolean;
  reservationReminders: boolean;
  customMealUpdates: boolean;
  paymentNotifications: boolean;
  ratingReminders: boolean;
  offersPromotions: boolean;
  nearbySuggestions: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

const INITIAL_PREFERENCES: NotificationPreferences = {
  reservationUpdates: true,
  reservationReminders: true,
  customMealUpdates: true,
  paymentNotifications: true,
  ratingReminders: true,
  offersPromotions: true,
  nearbySuggestions: false,
  pushEnabled: true,
  smsEnabled: true,
  emailEnabled: false,
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-1',
    type: 'reservation_confirmed',
    category: 'reservation',
    titleEn: 'Reservation Confirmed',
    titleSw: 'Nafasi ya Meza Imethibitishwa',
    messageEn: 'Your table reservation at Ocean View Restaurant for 7:00 PM has been confirmed.',
    messageSw: 'Nafasi yako ya meza katika Ocean View Restaurant kwa saa 1:00 Usiku imethibitishwa.',
    isRead: false,
    createdAt: '2026-08-26T14:15:00Z',
    timeAgoEn: '10m ago',
    timeAgoSw: 'Dakika 10 zilizopita',
    restaurantName: 'Ocean View Restaurant',
    restaurantId: 'ocean-view',
    reservationDate: 'Today',
    reservationTime: '07:00 PM',
    guests: '2 Guests',
    address: 'Toure Drive, Masaki, Dar es Salaam',
    actionType: 'view_reservation',
  },
  {
    id: 'notif-2',
    userId: 'user-1',
    type: 'custom_meal_accepted',
    category: 'order',
    titleEn: 'Your Custom Meal Was Accepted',
    titleSw: 'Mlo Wako Maalum Umekubaliwa',
    messageEn: 'Spice Bowl has accepted your custom Swahili Fish Curry request. Kitchen preparation is ready to start.',
    messageSw: 'Spice Bowl wamekubali ombi lako la Samaki wa Kupaka. Uandaaji jikoni uko tayari kuanza.',
    isRead: false,
    createdAt: '2026-08-26T13:45:00Z',
    timeAgoEn: '40m ago',
    timeAgoSw: 'Dakika 40 zilizopita',
    restaurantName: 'Spice Bowl',
    restaurantId: 'spice-bowl',
    dishName: 'Swahili Coconut Fish Curry',
    price: 18000,
    prepTime: '25 mins',
    actionType: 'view_order',
  },
  {
    id: 'notif-3',
    userId: 'user-1',
    type: 'payment_success',
    category: 'payment',
    titleEn: 'Payment Successful',
    titleSw: 'Malipo Yamekamilika',
    messageEn: 'Your payment of TZS 25,000 for Order #MLO-7320 was successful via M-Pesa.',
    messageSw: 'Malipo yako ya TZS 25,000 kwa Agizo #MLO-7320 yamekamilika kupitia M-Pesa.',
    isRead: false,
    createdAt: '2026-08-26T12:30:00Z',
    timeAgoEn: '2h ago',
    timeAgoSw: 'Saa 2 zilizopita',
    restaurantName: 'Green Leaf Café',
    paymentAmount: 25000,
    paymentMethod: 'M-Pesa (Vodacom)',
    referenceNumber: 'MP-894291849',
    actionType: 'view_receipt',
  },
  {
    id: 'notif-4',
    userId: 'user-1',
    type: 'reservation_reminder',
    category: 'reservation',
    titleEn: 'Upcoming Reservation in 1 Hour',
    titleSw: 'Kumbusho: Nafasi ya Meza ndani ya Saa 1',
    messageEn: 'Your reservation at Urban Grill starts in 1 hour (03:30 PM). Table is reserved under Frank Mlaki.',
    messageSw: 'Nafasi yako katika Urban Grill inaanza ndani ya saa 1 (Saa 9:30 Alasiri). Meza imehifadhiwa kwa jina la Frank Mlaki.',
    isRead: false,
    createdAt: '2026-08-26T11:00:00Z',
    timeAgoEn: '3h ago',
    timeAgoSw: 'Saa 3 zilizopita',
    restaurantName: 'Urban Grill',
    reservationTime: '03:30 PM',
    address: 'Haile Selassie Rd, Oysterbay',
    guests: '4 Guests',
    actionType: 'get_directions',
  },
  {
    id: 'notif-5',
    userId: 'user-1',
    type: 'promotion',
    category: 'offer',
    titleEn: '20% Off Today at Samaki Corner',
    titleSw: 'Punguzo la 20% Leo Samaki Corner',
    messageEn: 'Enjoy 20% off all grilled seafood platters and fresh coconut curries in Masaki today!',
    messageSw: 'Furahia punguzo la 20% kwa vyakula vyote vya baharini na samaki wa nazi leo Masaki!',
    isRead: true,
    createdAt: '2026-08-26T09:00:00Z',
    timeAgoEn: '5h ago',
    timeAgoSw: 'Saa 5 zilizopita',
    restaurantName: 'Samaki Corner',
    restaurantId: 'samaki-corner',
    discountPercentage: 20,
    actionType: 'find_restaurant',
  },
  {
    id: 'notif-6',
    userId: 'user-1',
    type: 'custom_meal_preparing',
    category: 'order',
    titleEn: 'Your Meal Is Being Prepared',
    titleSw: 'Mlo Wako Unaandaliwa Jikoni',
    messageEn: 'Chef Juma has started cooking your Charcoal Grilled Mishkaki & Spicy Pilau order.',
    messageSw: 'Mpishi Juma ameanza kuandaa mishkaki yako ya kuchoma na pilau ya viungo.',
    isRead: true,
    createdAt: '2026-08-25T19:30:00Z',
    timeAgoEn: 'Yesterday',
    timeAgoSw: 'Jana',
    restaurantName: 'Spice Bowl',
    dishName: 'Charcoal Grilled Beef Mishkaki & Spicy Pilau',
    prepTime: '20 mins',
    actionType: 'view_order',
  },
  {
    id: 'notif-7',
    userId: 'user-1',
    type: 'review_reminder',
    category: 'reservation',
    titleEn: 'How Was Your Dining Experience?',
    titleSw: 'Uzoefu Wako Ulikuwaje?',
    messageEn: 'Rate your recent dining experience at Green Leaf Café and help other Dar es Salaam food lovers.',
    messageSw: 'Toa tathmini ya chakula chako Green Leaf Café ili kusaidia walaji wengine Dar es Salaam.',
    isRead: true,
    createdAt: '2026-08-25T14:00:00Z',
    timeAgoEn: 'Yesterday',
    timeAgoSw: 'Jana',
    restaurantName: 'Green Leaf Café',
    restaurantId: 'green-leaf',
    actionType: 'rate_restaurant',
  },
  {
    id: 'notif-8',
    userId: 'user-1',
    type: 'reservation_cancelled',
    category: 'reservation',
    titleEn: 'Reservation Cancelled',
    titleSw: 'Nafasi ya Meza Imeghairiwa',
    messageEn: 'Your reservation at Bella Restaurant was cancelled due to a private event booking.',
    messageSw: 'Nafasi yako Bella Restaurant imeghairiwa kutokana na shughuli binafsi ya ukumbi.',
    isRead: true,
    createdAt: '2026-08-24T16:00:00Z',
    timeAgoEn: '2 days ago',
    timeAgoSw: 'Siku 2 zilizopita',
    restaurantName: 'Bella Restaurant',
    cancellationReasonEn: 'Restaurant fully booked for private corporate dinner.',
    cancellationReasonSw: 'Mgahawa umehifadhiwa wote kwa ajili ya hafla ya kampuni.',
    actionType: 'find_restaurant',
  },
];

function mapDomainNotificationToContext(dn: any): Notification {
  const payload = dn.payload || {};
  const cat = (dn.category || 'ORDER').toLowerCase();
  const mappedCategory: 'reservation' | 'order' | 'payment' | 'offer' =
    cat === 'reservation' ? 'reservation' : cat === 'payment' ? 'payment' : cat === 'offer' ? 'offer' : 'order';

  return {
    id: dn.id,
    userId: dn.userId,
    type: (dn.type?.toLowerCase() || 'order') as NotificationType,
    category: mappedCategory,
    titleEn: dn.titleEn || 'Notification',
    titleSw: dn.titleSw || 'Taarifa',
    messageEn: dn.messageEn || '',
    messageSw: dn.messageSw || '',
    isRead: dn.isRead ?? false,
    createdAt: dn.createdAt,
    timeAgoEn: 'Just now',
    timeAgoSw: 'Hivi punde',
    restaurantName: payload.restaurant_name || payload.restaurantName,
    restaurantId: dn.restaurantId || payload.restaurant_id || payload.restaurantId,
    reservationDate: payload.reservation_date || payload.reservationDate,
    reservationTime: payload.reservation_time || payload.reservationTime,
    guests: payload.party_size ? `${payload.party_size} Guests` : undefined,
    address: payload.address,
    cancellationReasonEn: payload.cancellation_reason_en || payload.rejectionReason,
    cancellationReasonSw: payload.cancellation_reason_sw,
    dishName: payload.dish_name || payload.dishName,
    price: payload.amount_tzs || payload.priceTzs,
    paymentAmount: payload.payment_amount || payload.amountTzs,
    paymentMethod: payload.payment_method || payload.paymentMethod,
    referenceNumber: payload.reference_number || payload.providerReference,
    actionType: dn.actionType || (mappedCategory === 'reservation' ? 'view_reservation' : mappedCategory === 'payment' ? 'view_receipt' : 'view_order'),
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void> | void;
  markAllAsRead: () => Promise<void> | void;
  deleteNotification: (id: string) => Promise<void> | void;
  clearAll: () => Promise<void> | void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'> & { id?: string }) => void;
  updatePreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => Promise<void> | void;
  simulateIncomingNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    runtimeConfig.allowLocalDataFallbacks ? INITIAL_NOTIFICATIONS : []
  );
  const [preferences, setPreferences] = useState<NotificationPreferences>(INITIAL_PREFERENCES);

  const refreshNotifications = useCallback(async () => {
    if (!runtimeConfig.allowLocalDataFallbacks) {
      if (user?.id) {
        try {
          const list = await NotificationRepository.listForUser(user.id);
          setNotifications((list || []).map(mapDomainNotificationToContext));
        } catch (e) {
          console.warn('[NotificationContext] Failed to load canonical notifications:', e);
        }
      } else {
        setNotifications([]);
      }
    }
  }, [user?.id]);

  const refreshPreferences = useCallback(async () => {
    if (!runtimeConfig.allowLocalDataFallbacks && user?.id) {
      try {
        const rows = await NotificationPreferencesRepository.getPreferences(user.id);
        if (rows && rows.length > 0) {
          setPreferences((prev) => {
            const updated = { ...prev };
            for (const row of rows) {
              if (row.category === 'RESERVATION') {
                updated.reservationUpdates = row.enabled;
                updated.reservationReminders = row.enabled;
              } else if (row.category === 'CUSTOM_MEAL') {
                updated.customMealUpdates = row.enabled;
              } else if (row.category === 'PAYMENT') {
                updated.paymentNotifications = row.enabled;
              } else if (row.category === 'REVIEW') {
                updated.ratingReminders = row.enabled;
              } else if (row.category === 'PROMOTION') {
                updated.offersPromotions = row.enabled;
              } else if (row.category === 'SUGGESTION') {
                updated.nearbySuggestions = row.enabled;
              } else if (row.channel === 'SMS' && (row.category === 'ALL' || !row.category)) {
                updated.smsEnabled = row.enabled;
              } else if (row.channel === 'PUSH' && (row.category === 'ALL' || !row.category)) {
                updated.pushEnabled = row.enabled;
              } else if (row.channel === 'EMAIL' && (row.category === 'ALL' || !row.category)) {
                updated.emailEnabled = row.enabled;
              }
            }
            return updated;
          });
        }
      } catch (e) {
        console.warn('[NotificationContext] Failed to load canonical notification preferences:', e);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    refreshNotifications();
    refreshPreferences();
  }, [refreshNotifications, refreshPreferences]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    if (runtimeConfig.allowLocalDataFallbacks) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      return;
    }
    try {
      await NotificationRepository.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.warn('[NotificationContext] markAsRead error:', e);
    }
  };

  const markAllAsRead = async () => {
    if (runtimeConfig.allowLocalDataFallbacks) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      return;
    }
    if (user?.id) {
      try {
        await NotificationRepository.markAllAsRead(user.id);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (e) {
        console.warn('[NotificationContext] markAllAsRead error:', e);
      }
    }
  };

  const deleteNotification = async (id: string) => {
    if (runtimeConfig.allowLocalDataFallbacks) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    try {
      await NotificationRepository.archiveNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.warn('[NotificationContext] deleteNotification error:', e);
    }
  };

  const clearAll = async () => {
    if (runtimeConfig.allowLocalDataFallbacks) {
      setNotifications([]);
      return;
    }
    const currentList = [...notifications];
    const results = await Promise.allSettled(
      currentList.map((notif) => NotificationRepository.archiveNotification(notif.id))
    );
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[NotificationContext] clearAll: ${failures.length} archive operations failed.`);
    }
    await refreshNotifications();
  };

  const addNotification = (notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'> & { id?: string }) => {
    if (!runtimeConfig.allowLocalDataFallbacks) return;
    const notifId = notificationData.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notifId)) {
        return prev;
      }
      const newNotif: Notification = {
        ...notificationData,
        id: notifId,
        createdAt: new Date().toISOString(),
        isRead: false,
      };
      return [newNotif, ...prev];
    });
  };

  const updatePreference = async <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    const prevPreferences = { ...preferences };
    setPreferences((prev) => ({ ...prev, [key]: value }));

    if (!runtimeConfig.allowLocalDataFallbacks && user?.id) {
      try {
        let channel: NotificationChannel = 'PUSH';
        let category = 'ALL';

        if (key === 'pushEnabled') {
          channel = 'PUSH';
          category = 'ALL';
        } else if (key === 'smsEnabled') {
          channel = 'SMS';
          category = 'ALL';
        } else if (key === 'emailEnabled') {
          channel = 'EMAIL';
          category = 'ALL';
        } else if (key === 'reservationUpdates' || key === 'reservationReminders') {
          channel = 'PUSH';
          category = 'RESERVATION';
        } else if (key === 'customMealUpdates') {
          channel = 'PUSH';
          category = 'CUSTOM_MEAL';
        } else if (key === 'paymentNotifications') {
          channel = 'PUSH';
          category = 'PAYMENT';
        } else if (key === 'ratingReminders') {
          channel = 'PUSH';
          category = 'REVIEW';
        } else if (key === 'offersPromotions') {
          channel = 'PUSH';
          category = 'PROMOTION';
        } else if (key === 'nearbySuggestions') {
          channel = 'PUSH';
          category = 'SUGGESTION';
        }

        await NotificationPreferencesRepository.updatePreference({
          channel,
          category,
          enabled: Boolean(value),
        });
      } catch (err) {
        console.warn('[NotificationContext] Failed to persist preference to database, reverting:', err);
        setPreferences(prevPreferences);
      }
    }
  };

  useEffect(() => {
    // 1. Listen for real-time order updates across the platform
    const unsubOrders = RealtimeEventEngine.subscribe('orders:*', () => {
      if (!runtimeConfig.allowLocalDataFallbacks) {
        refreshNotifications();
      }
    });

    // 2. Listen for platform announcements
    const unsubAnnouncements = RealtimeEventEngine.subscribe('announcements:broadcast', () => {
      if (!runtimeConfig.allowLocalDataFallbacks) {
        refreshNotifications();
      }
    });

    return () => {
      unsubOrders();
      unsubAnnouncements();
    };
  }, [refreshNotifications]);

  // Simulator helper for testing real-time updates (strictly demo / test only)
  const simulateIncomingNotification = () => {
    if (!runtimeConfig.isDemo) return;

    const simTypes: Omit<Notification, 'id' | 'createdAt' | 'isRead'>[] = [
      {
        userId: 'user-1',
        type: 'custom_meal_ready',
        category: 'order',
        titleEn: 'Your Custom Meal Is Ready!',
        titleSw: 'Mlo Wako Maalum Uko Tayari!',
        messageEn: 'Chef at restaurant has finished cooking your custom meal. It is ready!',
        messageSw: 'Mpishi amemaliza kuandaa mlo wako maalum. Uko tayari!',
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: 'Demo Kitchen',
        dishName: 'Custom Dish',
        actionType: 'view_order',
      },
      {
        userId: 'user-1',
        type: 'reservation_confirmed',
        category: 'reservation',
        titleEn: 'Table Reservation Confirmed',
        titleSw: 'Nafasi ya Meza Imethibitishwa',
        messageEn: 'Your table reservation has been confirmed.',
        messageSw: 'Nafasi yako ya meza imethibitishwa.',
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: 'Demo Restaurant',
        reservationTime: '08:00 PM',
        guests: '2 Guests',
        address: 'Dar es Salaam',
        actionType: 'view_reservation',
      },
    ];

    const randomChoice = simTypes[Math.floor(Math.random() * simTypes.length)];
    addNotification(randomChoice);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        addNotification,
        updatePreference,
        simulateIncomingNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
