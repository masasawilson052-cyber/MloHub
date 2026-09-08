import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  updatePreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void;
  simulateIncomingNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [preferences, setPreferences] = useState<NotificationPreferences>(INITIAL_PREFERENCES);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const addNotification = (notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotif: Notification = {
      ...notificationData,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // Simulator helper for testing real-time updates
  const simulateIncomingNotification = () => {
    const simTypes: Omit<Notification, 'id' | 'createdAt' | 'isRead'>[] = [
      {
        userId: 'user-1',
        type: 'custom_meal_ready',
        category: 'order',
        titleEn: 'Your Custom Meal Is Ready!',
        titleSw: 'Mlo Wako Maalum Uko Tayari!',
        messageEn: 'Chef Juma at Spice Bowl has finished cooking your Coconut Fish Curry. It is packed hot for pickup!',
        messageSw: 'Mpishi Juma wa Spice Bowl amemaliza kupika Samaki wako wa Nazi. Umefungwa ukiwa wa moto tayari!',
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: 'Spice Bowl',
        dishName: 'Swahili Coconut Fish Curry',
        actionType: 'view_order',
      },
      {
        userId: 'user-1',
        type: 'reservation_confirmed',
        category: 'reservation',
        titleEn: 'Table Reservation Confirmed',
        titleSw: 'Nafasi ya Meza Imethibitishwa',
        messageEn: 'Kariakoo Spices has confirmed your table reservation for 8:00 PM tonight.',
        messageSw: 'Kariakoo Spices wamethibitisha nafasi yako ya meza kwa saa 2:00 Usiku leo.',
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: 'Kariakoo Spices',
        reservationTime: '08:00 PM',
        guests: '3 Guests',
        address: 'Msimbazi St, Kariakoo',
        actionType: 'view_reservation',
      },
      {
        userId: 'user-1',
        type: 'payment_success',
        category: 'payment',
        titleEn: 'Payment Received',
        titleSw: 'Malipo Yamepokelewa',
        messageEn: 'Payment of TZS 18,000 was confirmed for Order #MLO-9912 via Tigo Pesa.',
        messageSw: 'Malipo ya TZS 18,000 yamethibitishwa kwa Agizo #MLO-9912 kupitia Tigo Pesa.',
        timeAgoEn: 'Just now',
        timeAgoSw: 'Sasa hivi',
        restaurantName: 'Samaki Corner',
        paymentAmount: 18000,
        paymentMethod: 'Tigo Pesa (Tigo)',
        referenceNumber: `TP-${Math.floor(10000000 + Math.random() * 90000000)}`,
        actionType: 'view_receipt',
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
