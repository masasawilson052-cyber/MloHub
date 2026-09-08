export type OrderEventType =
  | 'NEW_ORDER_PLACED'
  | 'QUOTE_OFFERED'
  | 'QUOTE_ACCEPTED'
  | 'ORDER_CONFIRMED'
  | 'STATUS_UPDATED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_RECEIVED';

export interface RealtimeEventPayload<T = any> {
  eventId: string;
  eventType: OrderEventType;
  topic: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  timestamp: string;
  data: T;
}

type EventListener<T = any> = (payload: RealtimeEventPayload<T>) => void;

class RealtimeEventEngineImpl {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private broadcastChannel: any = null;

  constructor() {
    // Cross-tab / Cross-window sync via Web BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new (window as any).BroadcastChannel('mlohub_realtime_channel_v1');
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data && event.data.topic) {
            this.dispatchLocally(event.data.topic, event.data);
          }
        };
      } catch (e) {
        console.warn('Realtime BroadcastChannel initialization notice:', e);
      }
    }
  }

  /**
   * Subscribe to a specific topic (e.g. `orders:restaurant:<id>`, `orders:customer:<id>`, `orders:*`)
   */
  public subscribe<T = any>(topic: string, callback: EventListener<T>): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    const topicListeners = this.listeners.get(topic)!;
    topicListeners.add(callback as EventListener);

    // Return unsubscription function
    return () => {
      topicListeners.delete(callback as EventListener);
      if (topicListeners.size === 0) {
        this.listeners.delete(topic);
      }
    };
  }

  /**
   * Publishes an event to a topic, notifying local subscribers and broadcasting to other tabs
   */
  public publish<T = any>(topic: string, event: Omit<RealtimeEventPayload<T>, 'eventId' | 'timestamp' | 'topic'>): RealtimeEventPayload<T> {
    const fullPayload: RealtimeEventPayload<T> = {
      ...event,
      topic,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // 1. Dispatch to local subscribers matching topic or wildcard `orders:*`
    this.dispatchLocally(topic, fullPayload);

    // 2. Broadcast across tabs/windows
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullPayload);
      } catch (e) {
        console.warn('Broadcast error:', e);
      }
    }

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

  private dispatchLocally(topic: string, payload: RealtimeEventPayload) {
    // Exact topic match
    const exactListeners = this.listeners.get(topic);
    if (exactListeners) {
      exactListeners.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Error in realtime event listener:', err);
        }
      });
    }

    // Wildcard topics (e.g., `orders:*`)
    this.listeners.forEach((set, key) => {
      if (key !== topic && (key === 'orders:*' || key === '*' || (key.endsWith('*') && topic.startsWith(key.slice(0, -1))))) {
        set.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('Error in wildcard event listener:', err);
          }
        });
      }
    });
  }

  /**
   * Clears all listeners (useful for test resets)
   */
  public clearAll(): void {
    this.listeners.clear();
  }
}

export const RealtimeEventEngine = new RealtimeEventEngineImpl();
