import { Order, OrderStatus, PaymentStatus, MenuItem, BranchMenuItem, Reservation, CustomMealRequest } from './domain';

// ============================================================================
// 1. CONNECTION LIFECYCLE & ENGINE STATES
// ============================================================================

export type RealtimeConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LIVE'
  | 'RECONNECTING'
  | 'OFFLINE';

export interface RealtimeConnectionStatus {
  state: RealtimeConnectionState;
  connectedAt?: string;
  reconnectAttempts: number;
  lastLatencyMs?: number;
  activeChannelsCount: number;
  error?: string;
}

// ============================================================================
// 2. CANONICAL DATABASE REALTIME EVENTS
// ============================================================================

export type CanonicalRealtimeEvent =
  // Order Lifecycle (Strict State Machine)
  | 'ORDER_CREATED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REJECTED'

  // Payment Confirmation
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'

  // Food Catalog & Freshness
  | 'MENU_ITEM_UPDATED'
  | 'MENU_PRICE_UPDATED'
  | 'MENU_AVAILABILITY_UPDATED'
  | 'MENU_VERIFIED'

  // Table Reservations
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_CANCELLED'

  // Custom Meals Negotiation
  | 'CUSTOM_MEAL_CREATED'
  | 'CUSTOM_MEAL_QUOTE_CREATED'
  | 'CUSTOM_MEAL_QUOTE_ACCEPTED'

  // Operational & Admin Governance
  | 'RESTAURANT_STATUS_UPDATED'
  | 'DATA_REPORT_CREATED'
  | 'DATA_REPORT_RESOLVED'
  | 'NOTIFICATION_CREATED';

// ============================================================================
// 3. DATABASE CHANGE PAYLOAD SCHEMAS (SUPABASE POSTGRES_CHANGES)
// ============================================================================

export type PostgresEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface PostgresChangeEnvelope<T = Record<string, any>> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
  errors?: string[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorUserId?: string;
  actorRole?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ============================================================================
// 4. STRONGLY TYPED REALTIME EVENT PACKAGES
// ============================================================================

export interface OrderRealtimePayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  restaurantId: string;
  branchId?: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  paymentStatus: PaymentStatus;
  totalTzs: number;
  estimatedPrepMinutes?: number;
  order: Partial<Order>;
  timestamp: string;
}

export interface MenuRealtimePayload {
  restaurantId: string;
  branchId?: string;
  menuItemId: string;
  name: string;
  priceTzs: number;
  previousPriceTzs?: number;
  isAvailable: boolean;
  stockQuantity?: number;
  verifiedAt?: string;
  timestamp: string;
}

export interface ReservationRealtimePayload {
  reservationId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  timeSlot: string;
  reservationDate: string;
  guestsCount: string;
  timestamp: string;
}

export interface CustomMealRealtimePayload {
  requestId: string;
  orderNumber: string;
  customerId: string;
  targetRestaurantId?: string;
  dishName: string;
  budgetTzs: number;
  quotedPriceTzs?: number;
  status: string;
  timestamp: string;
}

export interface NotificationRealtimePayload {
  notificationId: string;
  userId: string;
  type: string;
  titleEn: string;
  titleSw: string;
  messageEn: string;
  messageSw: string;
  data?: Record<string, any>;
  timestamp: string;
}

// ============================================================================
// 5. GENERIC SUBSCRIPTION DEFINITIONS
// ============================================================================

export type RealtimeEventHandler<T = any> = (event: {
  canonicalEvent: CanonicalRealtimeEvent;
  payload: T;
  source: 'SUPABASE_REALTIME' | 'OFFLINE_FALLBACK' | 'OPTIMISTIC_SYNC';
  timestamp: string;
}) => void;

export interface RealtimeSubscriptionConfig {
  topic: string;
  table?: string;
  filter?: string;
  onResyncRequired?: () => Promise<void> | void;
}
