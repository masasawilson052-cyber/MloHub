import { supabase, isSupabaseConfigured } from './supabase';
import {
  RealtimeConnectionState,
  RealtimeConnectionStatus,
  CanonicalRealtimeEvent,
  RealtimeEventHandler,
  OrderRealtimePayload,
  MenuRealtimePayload,
  ReservationRealtimePayload,
  CustomMealRealtimePayload,
  NotificationRealtimePayload,
} from '../types/realtime';

export class RealtimeServiceImpl {
  private connectionState: RealtimeConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private statusListeners: Set<(status: RealtimeConnectionStatus) => void> = new Set();
  private listenersByTopic: Map<string, Map<string, RealtimeEventHandler<any>>> = new Map();
  private activeSupabaseChannels: Map<string, any> = new Map();
  private tableConfigs = new Map<string, { table: string; filter?: string; schema?: string }>();
  private resyncCallbacks: Map<string, () => Promise<void> | void> = new Map();

  // Auth context tracking
  private currentUserId: string | null = null;
  private currentRestaurantId: string | null = null;

  constructor() {
    // Static web export must not create sockets or reconnect timers.
    const isNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    if (isSupabaseConfigured() && typeof window === 'undefined' && !isNative) return;
    this.initConnection();
  }

  // ==========================================================================
  // CONNECTION LIFECYCLE MANAGEMENT
  // ==========================================================================

  private setConnectionState(newState: RealtimeConnectionState, error?: string) {
    if (this.connectionState === newState && !error) return;
    this.connectionState = newState;

    const status = this.getStatus();
    if (error) status.error = error;
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('[RealtimeService] Error notifying status listener:', err);
      }
    });
  }

  public getStatus(): RealtimeConnectionStatus {
    return {
      state: this.connectionState,
      connectedAt: this.connectionState === 'LIVE' ? new Date().toISOString() : undefined,
      reconnectAttempts: this.reconnectAttempts,
      activeChannelsCount: this.activeSupabaseChannels.size,
    };
  }

  public onStatusChange(callback: (status: RealtimeConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  private initConnection() {
    if (!isSupabaseConfigured()) {
      // In offline/mock mode, connection is immediately ready and live locally
      this.setConnectionState('LIVE');
      return;
    }

    this.setConnectionState('CONNECTING');
    try {
      // Monitor Supabase connection state
      const channel = supabase.channel('mlohub_health_heartbeat');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
          this.setConnectionState('LIVE');
          this.executeResync();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.handleDisconnect('Channel closed or error');
        } else if (status === 'TIMED_OUT') {
          this.handleDisconnect('Connection timed out');
        }
      });
      this.activeSupabaseChannels.set('mlohub_health_heartbeat', channel);
    } catch (err: any) {
      this.handleDisconnect(err?.message || 'Initialization error');
    }
  }

  private handleDisconnect(reason: string) {
    if (this.connectionState === 'OFFLINE') return;
    this.reconnectAttempts++;
    this.setConnectionState('RECONNECTING', reason);

    // Exponential backoff reconnect
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    setTimeout(() => {
      if (this.connectionState === 'RECONNECTING') {
        this.reconnect();
      }
    }, delay);
  }

  public reconnect() {
    this.setConnectionState('CONNECTING');
    if (isSupabaseConfigured()) {
      try {
        // Re-establish subscriptions
        this.activeSupabaseChannels.forEach((ch) => ch.unsubscribe());
        this.activeSupabaseChannels.clear();
        this.initConnection();
        this.rebindActiveSubscriptions();
      } catch (err: any) {
        this.handleDisconnect(err?.message || 'Reconnect failed');
      }
    } else {
      this.setConnectionState('LIVE');
      this.executeResync();
    }
  }

  public setOffline(offline: boolean) {
    if (offline) {
      this.setConnectionState('OFFLINE');
    } else {
      this.reconnect();
    }
  }

  // ==========================================================================
  // AUTH SESSION LIFECYCLE & WORKSPACE ISOLATION
  // ==========================================================================

  public bindAuthSession(userId: string | null, activeRestaurantId?: string | null) {
    const userChanged = this.currentUserId !== userId;
    const workspaceChanged = this.currentRestaurantId !== activeRestaurantId;

    if (!userChanged && !workspaceChanged) return;

    // Teardown user/workspace scoped listeners if session cleared or changed
    if (userChanged) {
      this.removeTopicsByPrefix('orders:customer:');
      this.removeTopicsByPrefix('notifications:');
    }
    if (workspaceChanged) {
      this.removeTopicsByPrefix('orders:restaurant:');
    }

    this.currentUserId = userId;
    this.currentRestaurantId = activeRestaurantId || null;

    if (this.connectionState === 'LIVE') {
      this.executeResync();
    }
  }

  private removeTopicsByPrefix(prefix: string) {
    for (const topic of Array.from(this.listenersByTopic.keys())) {
      if (topic.startsWith(prefix)) {
        this.listenersByTopic.delete(topic);
        this.tableConfigs.delete(topic);
        this.resyncCallbacks.delete(topic);
        this.tableConfigs.delete(topic);
        this.resyncCallbacks.delete(topic);
        const channel = this.activeSupabaseChannels.get(topic);
        if (channel) {
          channel.unsubscribe();
          this.activeSupabaseChannels.delete(topic);
        }
      }
    }
  }

  // ==========================================================================
  // AUTHORITATIVE POST-RECONNECT RESYNCHRONIZATION
  // ==========================================================================

  public registerResyncCallback(topic: string, callback: () => Promise<void> | void): () => void {
    this.resyncCallbacks.set(topic, callback);
    return () => this.resyncCallbacks.delete(topic);
  }

  public async executeResync() {
    const promises: Promise<any>[] = [];
    this.resyncCallbacks.forEach((cb) => {
      try {
        const res = cb();
        if (res instanceof Promise) promises.push(res);
      } catch (e) {
        console.error('[RealtimeService] Resync callback error:', e);
      }
    });
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  // ==========================================================================
  // SUBSCRIPTION & DISPATCH LOGIC
  // ==========================================================================

  public subscribe<T = any>(
    topic: string,
    handler: RealtimeEventHandler<T>,
    tableConfig?: { table: string; filter?: string; schema?: string }
  ): () => void {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!this.listenersByTopic.has(topic)) {
      this.listenersByTopic.set(topic, new Map());
    }
    this.listenersByTopic.get(topic)!.set(subId, handler);

    if (tableConfig) this.tableConfigs.set(topic, tableConfig);

    // Setup cloud channel if connected to Supabase
    if (isSupabaseConfigured() && tableConfig && !this.activeSupabaseChannels.has(topic)) {
      this.setupSupabaseChannel(topic, tableConfig);
    }

    // Return cleanup closure
    return () => {
      const topicMap = this.listenersByTopic.get(topic);
      if (topicMap) {
        topicMap.delete(subId);
        if (topicMap.size === 0) {
          this.listenersByTopic.delete(topic);
          this.tableConfigs.delete(topic);
          const channel = this.activeSupabaseChannels.get(topic);
          if (channel) {
            channel.unsubscribe();
            this.activeSupabaseChannels.delete(topic);
          }
        }
      }
    };
  }

  private setupSupabaseChannel(topic: string, config: { table: string; filter?: string; schema?: string }) {
    try {
      const channelName = `sb_rt_${topic.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const channel = supabase.channel(channelName);

      const params: any = {
        event: '*',
        schema: config.schema || 'public',
        table: config.table,
      };
      if (config.filter) {
        params.filter = config.filter;
      }

      channel
        .on('postgres_changes', params, (payload: any) => {
          this.handlePostgresChange(topic, payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Supabase Realtime] Subscribed to topic: ${topic} (table: ${config.table})`);
          }
        });

      this.activeSupabaseChannels.set(topic, channel);
    } catch (err) {
      console.warn(`[Supabase Realtime] Failed to configure channel for ${topic}:`, err);
    }
  }

  private handlePostgresChange(topic: string, payload: any) {
    const row = payload.new || payload.old || {};
    let canonicalEvent: CanonicalRealtimeEvent = 'ORDER_CREATED';

    // Map DB table & eventType to canonical event
    if (payload.table === 'orders') {
      if (payload.eventType === 'INSERT') {
        canonicalEvent = 'ORDER_CREATED';
      } else if (payload.eventType === 'UPDATE') {
        const status = (row.status || '').toUpperCase();
        if (status === 'ACCEPTED') canonicalEvent = 'ORDER_ACCEPTED';
        else if (status === 'PREPARING') canonicalEvent = 'ORDER_PREPARING';
        else if (status === 'READY') canonicalEvent = 'ORDER_READY';
        else if (status === 'COMPLETED') canonicalEvent = 'ORDER_COMPLETED';
        else if (status === 'CANCELLED') canonicalEvent = 'ORDER_CANCELLED';
        else if (status === 'REJECTED') canonicalEvent = 'ORDER_REJECTED';
        else canonicalEvent = 'ORDER_ACCEPTED';
      }
    } else if (payload.table === 'payments') {
      canonicalEvent = (row.status || '').toUpperCase() === 'PAID' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_FAILED';
    } else if (payload.table === 'menu_items' || payload.table === 'branch_menu_items') {
      canonicalEvent = 'MENU_ITEM_UPDATED';
    } else if (payload.table === 'reservations') {
      canonicalEvent = payload.eventType === 'INSERT' ? 'RESERVATION_CREATED' : 'RESERVATION_CONFIRMED';
    } else if (payload.table === 'custom_meal_requests' || payload.table === 'custom_meal_invitations') {
      canonicalEvent = 'CUSTOM_MEAL_CREATED';
    } else if (payload.table === 'restaurant_quotes') {
      canonicalEvent = 'CUSTOM_MEAL_QUOTE_CREATED';
    } else if (payload.table === 'notifications') {
      canonicalEvent = 'NOTIFICATION_CREATED';
    }

    this.dispatchToTopic(topic, {
      canonicalEvent,
      payload: row,
      source: 'SUPABASE_REALTIME',
      timestamp: new Date().toISOString(),
    });
  }

  private rebindActiveSubscriptions() {
    for (const [topic, listeners] of this.listenersByTopic.entries()) {
      if (listeners.size > 0 && !this.activeSupabaseChannels.has(topic)) {
        const savedConfig = this.tableConfigs.get(topic);
        if (savedConfig) {
          this.setupSupabaseChannel(topic, savedConfig);
        } else if (topic.startsWith('orders:customer:')) {
          const customerId = topic.split(':')[2];
          this.setupSupabaseChannel(topic, { table: 'orders', filter: `user_id=eq.${customerId}` });
        } else if (topic.startsWith('orders:restaurant:')) {
          const restaurantId = topic.split(':')[2];
          this.setupSupabaseChannel(topic, { table: 'orders', filter: `restaurant_id=eq.${restaurantId}` });
        } else if (topic === 'orders:*') {
          this.setupSupabaseChannel(topic, { table: 'orders' });
        } else if (topic.startsWith('menu:')) {
          this.setupSupabaseChannel(topic, { table: 'menu_items' });
        } else if (topic.startsWith('notifications:')) {
          const userId = topic.split(':')[1];
          this.setupSupabaseChannel(topic, { table: 'notifications', filter: `user_id=eq.${userId}` });
        }
      }
    }
  }

  // ==========================================================================
  // DISPATCH & PUBLISH (AUTHORITATIVE & DETERMINISTIC FALLBACK)
  // ==========================================================================

  public publishEvent<T = any>(
    topic: string,
    canonicalEvent: CanonicalRealtimeEvent,
    payload: T,
    source: 'SUPABASE_REALTIME' | 'OFFLINE_FALLBACK' | 'OPTIMISTIC_SYNC' = 'OFFLINE_FALLBACK'
  ) {
    this.dispatchToTopic(topic, {
      canonicalEvent,
      payload,
      source,
      timestamp: new Date().toISOString(),
    });
  }

  private dispatchToTopic(topic: string, eventData: any) {
    // 1. Exact match dispatch
    const exactListeners = this.listenersByTopic.get(topic);
    if (exactListeners) {
      exactListeners.forEach((handler) => {
        try {
          handler(eventData);
        } catch (err) {
          console.error(`[RealtimeService] Listener error on topic ${topic}:`, err);
        }
      });
    }

    // 2. Wildcard dispatch (e.g., 'orders:*' listens to 'orders:restaurant:123')
    this.listenersByTopic.forEach((listeners, key) => {
      if (key !== topic) {
        if (
          key === '*' ||
          (key.endsWith('*') && topic.startsWith(key.slice(0, -1))) ||
          (topic.startsWith('orders:') && key === 'orders:*')
        ) {
          listeners.forEach((handler) => {
            try {
              handler(eventData);
            } catch (err) {
              console.error(`[RealtimeService] Wildcard listener error on ${key}:`, err);
            }
          });
        }
      }
    });
  }

  // ==========================================================================
  // SPECIALIZED DOMAIN SUBSCRIPTION APIS
  // ==========================================================================

  public subscribeToOrder(orderId: string, handler: RealtimeEventHandler<OrderRealtimePayload>): () => void {
    return this.subscribe(
      `orders:${orderId}`,
      handler,
      { table: 'orders', filter: `id=eq.${orderId}` }
    );
  }

  public subscribeToRestaurantOrders(restaurantId: string, handler: RealtimeEventHandler<OrderRealtimePayload>): () => void {
    return this.subscribe(
      `orders:restaurant:${restaurantId}`,
      handler,
      { table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }
    );
  }

  public subscribeToCustomerOrders(customerId: string, handler: RealtimeEventHandler<OrderRealtimePayload>): () => void {
    return this.subscribe(
      `orders:customer:${customerId}`,
      handler,
      { table: 'orders', filter: `user_id=eq.${customerId}` }
    );
  }

  public subscribeToMenu(restaurantId: string, handler: RealtimeEventHandler<MenuRealtimePayload>): () => void {
    return this.subscribe(
      `menu:${restaurantId}`,
      handler,
      { table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }
    );
  }

  public subscribeToNotifications(userId: string, handler: RealtimeEventHandler<NotificationRealtimePayload>): () => void {
    return this.subscribe(
      `notifications:${userId}`,
      handler,
      { table: 'notifications', filter: `user_id=eq.${userId}` }
    );
  }

  public subscribeToReservations(restaurantId: string, handler: RealtimeEventHandler<ReservationRealtimePayload>): () => void {
    return this.subscribe(
      `reservations:restaurant:${restaurantId}`,
      handler,
      { table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` }
    );
  }

  public subscribeToCustomMeals(restaurantId: string, handler: RealtimeEventHandler<CustomMealRealtimePayload>): () => void {
    return this.subscribe(
      `custom_meals:restaurant:${restaurantId}`,
      handler,
      { table: 'custom_meal_invitations', filter: `restaurant_id=eq.${restaurantId}` }
    );
  }

  public clearAll() {
    this.activeSupabaseChannels.forEach((ch) => ch.unsubscribe());
    this.activeSupabaseChannels.clear();
    this.listenersByTopic.clear();
    this.tableConfigs.clear();
    this.resyncCallbacks.clear();
    this.statusListeners.clear();
    this.setConnectionState('LIVE');
  }
}

export const RealtimeService = new RealtimeServiceImpl();
