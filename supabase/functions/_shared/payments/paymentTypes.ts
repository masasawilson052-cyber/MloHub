/**
 * MloHub Tanzanian Payment Architecture - Unified Type Definitions
 * Shared across Supabase Edge Functions, Node Services, and Test Suites.
 */

export type PaymentProvider = 'clickpesa' | 'selcom' | 'sandbox';

export type PaymentMethodCode =
  | 'MPESA'
  | 'AIRTEL_MONEY'
  | 'MIXX_BY_YAS'
  | 'HALOPESA'
  | 'CARD'
  | 'CASH_ON_DELIVERY';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentType =
  | 'ORDER_FULL'
  | 'CUSTOM_MEAL_QUOTE'
  | 'CUSTOM_MEAL_FULL'
  | 'RESERVATION_DEPOSIT_50'
  | 'RESERVATION_FULL_100';

export interface AuthoritativePaymentRequest {
  userId: string;
  orderId?: string;
  reservationId?: string;
  customOrderId?: string;
  restaurantId: string;
  restaurantName: string;
  methodCode: PaymentMethodCode;
  paymentType: PaymentType;
  payerPhone: string;
  idempotencyKey?: string;
}

export interface InitiateUssdPushRequest {
  amount: number; // In Tanzanian Shillings (TZS)
  currency: 'TZS';
  orderReference: string; // Merchant Reference (max 20 alphanumeric chars)
  phoneNumber: string; // E.164 or 255XXXXXXXXX format
  methodCode: PaymentMethodCode;
  paymentType: PaymentType;
  payerName?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface InitiateUssdPushResponse {
  success: boolean;
  provider: PaymentProvider;
  gatewayReference: string;
  merchantReference: string;
  status: PaymentStatus;
  amountTzs: number;
  ussdCode: string;
  carrierName: string;
  carrierPromptText: string;
  expiresAt: string;
  rawResponse?: any;
  error?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  provider: PaymentProvider;
  eventId: string;
  merchantReference: string;
  gatewayReference: string;
  status: PaymentStatus;
  amountTzs: number;
  currency: string;
  timestamp: string;
  payerPhone: string;
  rawPayload: any;
  error?: string;
}

export interface StatusQueryResponse {
  success: boolean;
  status: PaymentStatus;
  amountTzs: number;
  gatewayReference: string;
  merchantReference: string;
  paidAt?: string;
  failureReason?: string;
  rawResponse?: any;
}

export interface RefundGatewayRequest {
  paymentId: string;
  gatewayReference: string;
  merchantReference: string;
  amountTzs: number;
  reason: string;
  adminUserId: string;
}

export interface RefundGatewayResponse {
  success: boolean;
  refundReference: string;
  amountTzs: number;
  status: 'REFUNDED' | 'FAILED' | 'PENDING';
  message: string;
  rawResponse?: any;
}

export interface CarrierDetails {
  code: PaymentMethodCode;
  name: string;
  ussd: string;
  color: string;
  bgColor: string;
}

export function getCarrierDetails(methodCode: PaymentMethodCode): CarrierDetails {
  switch (methodCode) {
    case 'MPESA':
      return { code: 'MPESA', name: 'Vodacom M-Pesa', ussd: '*150*00#', color: '#e60000', bgColor: '#ffebee' };
    case 'AIRTEL_MONEY':
      return { code: 'AIRTEL_MONEY', name: 'Airtel Money', ussd: '*150*60#', color: '#ff0000', bgColor: '#fff0f0' };
    case 'MIXX_BY_YAS':
      return { code: 'MIXX_BY_YAS', name: 'Mixx by Yas (Tigo)', ussd: '*150*01#', color: '#002f6c', bgColor: '#e3f2fd' };
    case 'HALOPESA':
      return { code: 'HALOPESA', name: 'HaloPesa (Halotel)', ussd: '*150*88#', color: '#ff6600', bgColor: '#fff3e0' };
    case 'CARD':
      return { code: 'CARD', name: 'Visa / Mastercard', ussd: 'Web Checkout', color: '#1a1f71', bgColor: '#ede7f6' };
    case 'CASH_ON_DELIVERY':
      return { code: 'CASH_ON_DELIVERY', name: 'Cash on Delivery', ussd: 'Pay at Door', color: '#2e7d32', bgColor: '#e8f5e9' };
    default:
      return { code: 'MPESA', name: 'Mobile Money', ussd: '*150*00#', color: '#113a26', bgColor: '#eaf4ed' };
  }
}
