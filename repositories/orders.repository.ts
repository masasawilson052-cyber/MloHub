import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import { Order, OrderItem, OrderStatus, PaymentStatus, OrderOperationalEvent } from '../types/domain';

export class OrderRepository {
  private static mapRowToOrder(row: any, items?: OrderItem[]): Order {
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.user_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurants?.name || row.restaurant_name || row.restaurantName || undefined,
      branchId: row.branch_id,
      status: row.status,
      paymentStatus: row.payment_status || 'PENDING',
      subtotalTzs: row.subtotal_tzs || 0,
      serviceFeeTzs: row.service_fee_tzs || 0,
      deliveryFeeTzs: row.delivery_fee_tzs || 0,
      totalTzs: row.total_tzs || 0,
      currency: 'TZS',
      fulfillmentType: row.dining_option || 'Delivery',
      deliveryAddress: row.delivery_address,
      specialInstructions: row.special_instructions,
      estimatedPrepMinutes: row.estimated_prep_minutes || 30,
      acceptedAt: row.accepted_at,
      readyAt: row.ready_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      items: items || (row.order_items || []).map(this.mapRowToOrderItem),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  private static mapRowToOrderItem(row: any): OrderItem {
    return {
      id: row.id,
      orderId: row.order_id,
      menuItemId: row.menu_item_id,
      itemNameSnapshot: row.item_name_snapshot || row.item_name || 'Dish',
      priceSnapshot: row.price_snapshot || row.unit_price_tzs || 0,
      quantity: row.quantity || 1,
      subtotal: row.total_price_tzs || ((row.unit_price_tzs || 0) * (row.quantity || 1)),
      specialNotes: row.special_notes,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  public static async createOrder(order: Partial<Order>, items: Partial<OrderItem>[]): Promise<Order> {
    if (!order.branchId || !order.branchId.trim()) {
      throw new Error('A valid restaurant branch is required to place this order.');
    }

    if (order.fulfillmentType === 'Delivery' && (!order.deliveryAddress || !order.deliveryAddress.trim())) {
      throw new Error('A valid delivery address is required for delivery orders.');
    }

    if (!isSupabaseConfigured()) {
      if (!runtimeConfig.allowLocalDataFallbacks) {
        throw new Error('Supabase client is not configured and local data fallbacks are disabled.');
      }
    } else {
      // Production/development/staging standard orders MUST use create_order_secure
      const rpcPayload = {
        p_branch_id: order.branchId,
        p_items: items.map((i) => {
          if (!i.menuItemId) {
            throw new Error('A canonical menuItemId is required for each order item.');
          }
          return {
            menu_item_id: i.menuItemId,
            quantity: i.quantity || 1,
            special_notes: i.specialNotes || null,
          };
        }),
        p_fulfillment_type: order.fulfillmentType || 'Delivery',
        p_delivery_zone_id: order.fulfillmentType === 'Delivery' ? (order.deliveryZoneId || null) : null,
        p_delivery_address: order.fulfillmentType === 'Delivery' ? (order.deliveryAddress?.trim() || null) : null,
        p_special_instructions: order.specialInstructions?.trim() || null,
      };

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_order_secure', rpcPayload);
      if (rpcError) {
        throw new Error(`Order creation failed: ${rpcError.message}`);
      }
      if (!rpcResult || !rpcResult.order_id) {
        throw new Error('Order creation failed: server did not return an order.');
      }

      const loadedOrder = await this.getOrderById(rpcResult.order_id);
      if (!loadedOrder) {
        throw new Error(`Order creation succeeded but order ${rpcResult.order_id} could not be retrieved.`);
      }
      return loadedOrder;
    }

    // Direct insert ONLY when runtimeConfig.allowLocalDataFallbacks is true and Supabase is not configured
    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error('Direct table insertion is prohibited in non-fallback environments.');
    }

    const orderId = order.id || `ord_${Date.now()}`;
    const orderNumber = order.orderNumber || `MLO-${Date.now().toString().slice(-4)}`;

    const orderRow = {
      id: orderId,
      order_number: orderNumber,
      user_id: order.customerId,
      restaurant_id: order.restaurantId,
      branch_id: order.branchId,
      status: order.status || 'PENDING',
      payment_status: order.paymentStatus || 'PENDING',
      subtotal_tzs: order.subtotalTzs || 0,
      service_fee_tzs: order.serviceFeeTzs || 1500,
      delivery_fee_tzs: order.deliveryFeeTzs || 0,
      total_tzs: order.totalTzs || 0,
      dining_option: order.fulfillmentType || 'Delivery',
      delivery_address: order.fulfillmentType === 'Delivery' ? order.deliveryAddress?.trim() : null,
      special_instructions: order.specialInstructions?.trim() || null,
      estimated_prep_minutes: order.estimatedPrepMinutes || 30,
      updated_at: new Date().toISOString(),
    };

    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select()
      .single();

    if (orderError) {
      console.error('OrderRepository.createOrder error:', orderError.message);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // Insert order items with snapshots
    const itemRows = items.map((item, idx) => ({
      id: item.id || `item_ord_${Date.now()}_${idx}`,
      order_id: orderId,
      menu_item_id: item.menuItemId,
      item_name: item.itemNameSnapshot || 'Item',
      item_name_snapshot: item.itemNameSnapshot || 'Item',
      unit_price_tzs: item.priceSnapshot || 0,
      price_snapshot: item.priceSnapshot || 0,
      quantity: item.quantity || 1,
      total_price_tzs: item.subtotal || ((item.priceSnapshot || 0) * (item.quantity || 1)),
      special_notes: item.specialNotes,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(itemRows)
      .select();

    if (itemsError) {
      console.error('OrderRepository.createOrder items error:', itemsError.message);
      throw new Error(`Failed to save order line items: ${itemsError.message}`);
    }

    return this.mapRowToOrder(
      insertedOrder,
      (insertedItems || []).map(this.mapRowToOrderItem)
    );
  }

  public static async getOrderById(id: string): Promise<Order | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), restaurants(name)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`OrderRepository.getOrderById(${id}) error:`, error.message);
      throw new Error(`Failed to find order: ${error.message}`);
    }

    return data ? this.mapRowToOrder(data) : null;
  }

  public static async listOrdersForCustomer(customerId: string): Promise<Order[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), restaurants(name)')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`OrderRepository.listOrdersForCustomer error:`, error.message);
      throw new Error(`Failed to list customer orders: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToOrder(row));
  }

  public static async listByCustomer(customerId: string): Promise<Order[]> {
    return this.listOrdersForCustomer(customerId);
  }

  public static async listOrdersForRestaurant(
    restaurantId: string,
    status?: OrderStatus
  ): Promise<Order[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('orders')
      .select('*, order_items(*), restaurants(name)')
      .eq('restaurant_id', restaurantId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error(`OrderRepository.listOrdersForRestaurant error:`, error.message);
      throw new Error(`Failed to list restaurant orders: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToOrder(row));
  }

  public static async listAll(options?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase.from('orders').select('*, order_items(*), restaurants(name)');
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (error) {
      console.error('OrderRepository.listAll error:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapRowToOrder(row));
  }

  public static async transitionRestaurantOrder(
    orderId: string,
    nextStatus: OrderStatus,
    cancellationReason?: string,
    estimatedPrepMinutes?: number
  ): Promise<Order> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    // Map REJECTED to canonical CANCELLED
    const canonicalStatus = (nextStatus === 'REJECTED' ? 'CANCELLED' : nextStatus) as OrderStatus;

    const { data: rpcResult, error: rpcError } = await supabase.rpc('transition_restaurant_order', {
      p_order_id: orderId,
      p_next_status: canonicalStatus,
      p_cancellation_reason: cancellationReason || null,
      p_estimated_prep_minutes: estimatedPrepMinutes || null,
    });

    if (rpcError) {
      console.error(`OrderRepository.transitionRestaurantOrder(${orderId}) error:`, rpcError.message);
      throw new Error(`Failed to transition order status: ${rpcError.message}`);
    }

    // Refetch the full authoritative order including items and restaurant metadata
    const refreshed = await this.getOrderById(orderId);
    if (!refreshed) {
      throw new Error(`Order ${orderId} not found after transition.`);
    }

    return refreshed;
  }

  public static async updateStatus(
    orderId: string,
    status: OrderStatus,
    cancellationReason?: string,
    estimatedPrepMinutes?: number
  ): Promise<Order> {
    return this.transitionRestaurantOrder(orderId, status, cancellationReason, estimatedPrepMinutes);
  }

  public static async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (error) {
      console.error(`OrderRepository.updatePaymentStatus(${orderId}) error:`, error.message);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return this.mapRowToOrder(data);
  }

  /**
   * Records an append-only operational timeline event for an order (received, viewed, accepted, prep, ready, etc.).
   */
  public static async recordOperationalEvent(
    orderId: string,
    eventType: string,
    reasonCode?: string | null,
    details: Record<string, any> = {}
  ): Promise<{ success: boolean; orderId: string; eventType: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('record_order_operational_event_secure', {
      p_order_id: orderId,
      p_event_type: eventType,
      p_reason_code: reasonCode || null,
      p_details: details,
    });

    if (error) {
      console.error(`OrderRepository.recordOperationalEvent error:`, error.message);
      throw new Error(`Failed to record operational event: ${error.message}`);
    }

    return {
      success: data?.success ?? true,
      orderId: data?.order_id ?? orderId,
      eventType: data?.event_type ?? eventType,
    };
  }

  /**
   * Retrieves full operational event timeline for an order.
   */
  public static async getOperationalEvents(orderId: string): Promise<OrderOperationalEvent[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('order_operational_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`OrderRepository.getOperationalEvents(${orderId}) error:`, error.message);
      throw new Error(`Failed to load order operational events: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      actorRole: row.actor_role,
      reasonCode: row.reason_code,
      eventDetails: row.event_details || {},
      createdAt: row.created_at,
    }));
  }
}

