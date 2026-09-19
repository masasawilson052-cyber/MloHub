import { RealtimeService } from '../../services/RealtimeService';
import { CanonicalRealtimeEvent } from '../../types/realtime';

export type OrderEventType =
  | 'NEW_ORDER_PLACED'
  | 'QUOTE_OFFERED'
  | 'QUOTE_ACCEPTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_ACCEPTED'
  | 'STATUS_UPDATED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'BROADCAST_ANNOUNCEMENT'
  | string;

export interface RealtimeEventPayload<T = any> {
  eventId: string;
  eventType?: OrderEventType;
  topic: string;
  orderId?: string;
  customerId?: string;
  restaurantId?: string;
  timestamp: string;
  data?: T;
  title?: string;
  message?: string;
  action?: string;
  applicationId?: string;
  application?: any;
  restaurant?: any;
  reason?: string;
  ownerUserId?: string;
}

type EventListener<T = any> = (payload: RealtimeEventPayload<T>) => void;

class RealtimeEventEngineImpl {
  /**
   * Subscribe to a topic (e.g. `orders:restaurant:<id>`, `orders:customer:<id>`, `orders:*`)
   */
  public subscribe<T = any>(topic: string, callback: EventListener<T>): () => void {
    // Delegate to authoritative RealtimeService
    return RealtimeService.subscribe(topic, (evt) => {
      const p = evt.payload || {};
      const payload: RealtimeEventPayload<T> = {
        eventId: p.eventId || `sb_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        eventType: p.eventType || (evt.canonicalEvent as any),
        topic,
        orderId: p.orderId || p.id || '',
        customerId: p.customerId || p.customer_id || p.userId || p.user_id || '',
        restaurantId: p.restaurantId || p.restaurant_id || p.targetRestaurantId || '',
        timestamp: evt.timestamp || new Date().toISOString(),
        data: (p.data !== undefined ? p.data : p) as T,
        title: p.title,
        message: p.message,
        action: p.action,
        applicationId: p.applicationId,
        application: p.application,
        restaurant: p.restaurant,
        reason: p.reason,
        ownerUserId: p.ownerUserId,
      };
      callback(payload);
    });
  }

  /**
   * Publishes an event to a topic, notifying local and cloud subscribers
   */
  public publish<T = any>(
    topic: string,
    event: Omit<RealtimeEventPayload<T>, 'eventId' | 'timestamp' | 'topic'>
  ): RealtimeEventPayload<T> {
    const fullPayload: RealtimeEventPayload<T> = {
      ...event,
      topic,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    let canonicalEvent: CanonicalRealtimeEvent = 'ORDER_CREATED';
    const evtType = event.eventType || '';

    if (evtType === 'ORDER_ACCEPTED' || evtType === 'ORDER_CONFIRMED') {
      canonicalEvent = 'ORDER_ACCEPTED';
    } else if (evtType === 'STATUS_UPDATED') {
      canonicalEvent = 'ORDER_ACCEPTED';
    } else if (evtType === 'ORDER_CANCELLED') {
      canonicalEvent = 'ORDER_CANCELLED';
    } else if (evtType === 'PAYMENT_RECEIVED' || evtType === 'PAYMENT_CONFIRMED') {
      canonicalEvent = 'PAYMENT_CONFIRMED';
    } else if (topic.startsWith('menu:')) {
      canonicalEvent = 'MENU_ITEM_UPDATED';
    } else if (topic.startsWith('reservations:')) {
      canonicalEvent = 'RESERVATION_CREATED';
    } else if (topic.startsWith('notifications:')) {
      canonicalEvent = 'NOTIFICATION_CREATED';
    }

    // Publish to RealtimeService
    RealtimeService.publishEvent(topic, canonicalEvent, fullPayload);

    return fullPayload;
  }

  public emit(topic: string, data?: any): void {
    this.publish(topic, {
      eventType: 'STATUS_UPDATED',
      orderId: '',
      customerId: '',
      restaurantId: '',
      data,
    });
  }

  public broadcast(topic: string, data?: any): void {
    this.publish(topic, {
      eventType: 'STATUS_UPDATED',
      orderId: '',
      customerId: '',
      restaurantId: '',
      data,
    });
  }

  /**
   * Clears all listeners (useful for test resets)
   */
  public clearAll(): void {
    RealtimeService.clearAll();
  }
}

export const RealtimeEventEngine = new RealtimeEventEngineImpl();
