import { PaymentTransactionEntity, ReviewEntity, NotificationEntity } from '../../db/types';

/**
 * Isolated demo / test payment, review, and notification fixtures.
 * STRICTLY FOR USE IN TESTS AND DEMO SANDBOX MODE.
 * FORBIDDEN IN PRODUCTION, STAGING, AND LOCAL DEVELOPMENT BACKEND CALLS.
 */
export const DEMO_PAYMENTS: PaymentTransactionEntity[] = [
  {
    id: 'pay-301',
    userId: 'usr-frank',
    orderId: 'cm-201',
    restaurantId: 'mama-amina-biryani',
    restaurantName: 'Mama Amina Biryani House',
    provider: 'CLICKPESA',
    providerReference: 'CP-TZ-982173-MPESA',
    amountTzs: 110000,
    currency: 'TZS',
    paymentMethod: 'M-Pesa',
    methodCode: 'MPESA',
    status: 'PAID',
    paymentType: 'ORDER_FULL',
    payerPhone: '+255 754 123 456',
    breakdown: {
      subtotal: 110000,
      deliveryFee: 0,
      serviceFee: 0,
      discount: 0,
      total: 110000,
      paidAmount: 110000,
      remainingBalance: 0,
    },
    paidAt: '2026-08-26T12:00:00Z',
    createdAt: '2026-08-26T12:00:00Z',
  },
];

export const DEMO_REVIEWS: ReviewEntity[] = [
  {
    id: 'rev-401',
    userId: 'usr-frank',
    userName: 'Frank Mlaki',
    restaurantId: 'mama-amina-biryani',
    rating: 5,
    comment: 'The best authentic Zanzibar biryani in Dar es Salaam! Delivered right on time for our office meeting.',
    createdAt: '2026-08-20T15:00:00Z',
  },
];

export const DEMO_NOTIFICATIONS: NotificationEntity[] = [
  {
    id: 'notif-1',
    userId: 'usr-frank',
    type: 'specialist_quote_ready',
    category: 'order',
    titleEn: 'Specialist Bid Received!',
    titleSw: 'Ofa Kutoka kwa Mtaalamu Imepokelewa!',
    messageEn: 'Mama Amina Biryani House submitted a bid of TZS 110,000 for your 10-person Mikocheni lunch tomorrow.',
    messageSw: 'Mama Amina Biryani House ametuma ofa ya TZS 110,000 kwa ajili ya chakula cha watu 10 kesho Mikocheni.',
    isRead: false,
    createdAt: '2026-08-27T07:15:00Z',
    timeAgoEn: '10 min ago',
    timeAgoSw: 'Dk 10 zilizopita',
    restaurantName: 'Mama Amina Biryani House',
    restaurantId: 'mama-amina-biryani',
    price: 110000,
    actionType: 'order_details',
  },
];

export const DEMO_FAVORITES: string[] = ['mama-amina-biryani', 'kibo-mchemsho', 'green-leaf'];
