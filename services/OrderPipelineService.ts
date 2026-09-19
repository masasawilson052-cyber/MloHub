/**
 * ============================================================================
 * MLOHUB STAGE 14: AUTHORITATIVE RESTAURANT ORDER PIPELINE SERVICE
 * ============================================================================
 * Manages standard restaurant customer orders (public.orders, public.order_items),
 * restaurant acceptance, kitchen fulfillment progression, cancellation,
 * and realtime notification broadcasts.
 *
 * State Machine (Strict Database Authority):
 * PENDING -> ACCEPTED -> PREPARING -> READY -> COMPLETED (Terminal)
 * CANCELLED is Terminal.
 * ============================================================================
 */

import { Order, OrderStatus } from '../types/domain';
import { OrderRepository } from '../repositories/orders.repository';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { runtimeConfig } from '../lib/runtimeConfig';
import { isSupabaseConfigured } from '../lib/supabase';
import { DemoOrderPipelineAdapter } from './demo/DemoOrderPipelineAdapter';

export interface SubmitMenuOrderDTO {
  userId: string;
  customerName?: string;
  customerPhone?: string;
  restaurantId: string;
  branchId?: string;
  items: {
    menuItemId?: string;
    name: string;
    unitPriceTzs: number;
    quantity: number;
    totalPriceTzs: number;
    specialNotes?: string;
  }[];
  diningOption: 'Delivery' | 'Dine-In' | 'Takeaway';
  deliveryAddress?: string;
  specialInstructions?: string;
}

export type KitchenProgressionStatus = 'Cooking' | 'Ready' | 'Completed' | 'Cancelled' | OrderStatus;

export class OrderPipelineServiceImpl {
  /**
   * Broadcast order events to Customer, Restaurant, Admin, and wildcard channels
   */
  private broadcastOrderEvent(
    eventType: string,
    orderId: string,
    customerId: string,
    restaurantId: string,
    data: any
  ) {
    const payload = {
      eventType,
      orderId,
      customerId,
      restaurantId,
      data,
    };
    if (customerId) {
      RealtimeEventEngine.publish(`orders:customer:${customerId}`, payload);
    }
    if (restaurantId) {
      RealtimeEventEngine.publish(`orders:restaurant:${restaurantId}`, payload);
    }
    RealtimeEventEngine.publish('orders:admin', payload);
    RealtimeEventEngine.publish('orders:*', payload);
  }

  /**
   * 1. Customer places a standard menu order into public.orders
   */
  async submitStandardMenuOrder(dto: SubmitMenuOrderDTO): Promise<Order> {
    if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
      const subtotal = dto.items.reduce((sum, item) => sum + item.totalPriceTzs, 0);
      const serviceFee = 1500;
      const deliveryFee = dto.diningOption === 'Delivery' ? 2500 : 0;
      const totalTzs = subtotal + serviceFee + deliveryFee;

      const fallbackResult = await DemoOrderPipelineAdapter.submitCustomMealOrder({
        userId: dto.userId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        dishName: dto.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
        targetRestaurantId: dto.restaurantId,
        specialInstructions: dto.specialInstructions || '',
        budgetTzs: totalTzs,
        servingsCount: `${dto.items.reduce((s, i) => s + i.quantity, 0)} Items`,
        diningOption: dto.diningOption,
      });
      return {
        id: fallbackResult.id,
        orderNumber: fallbackResult.orderNumber || fallbackResult.id,
        customerId: fallbackResult.userId,
        restaurantId: fallbackResult.targetRestaurantId || dto.restaurantId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalTzs: subtotal,
        serviceFeeTzs: serviceFee,
        deliveryFeeTzs: deliveryFee,
        totalTzs,
        currency: 'TZS',
        fulfillmentType: dto.diningOption,
        items: dto.items.map((it, idx) => ({
          id: `item-${idx}`,
          orderId: fallbackResult.id,
          itemNameSnapshot: it.name,
          priceSnapshot: it.unitPriceTzs,
          quantity: it.quantity,
          subtotal: it.totalPriceTzs,
          createdAt: new Date().toISOString(),
        })),
        createdAt: fallbackResult.createdAt,
        updatedAt: fallbackResult.updatedAt,
      };
    }

    const subtotal = dto.items.reduce((sum, item) => sum + item.totalPriceTzs, 0);
    const serviceFee = 1500;
    const deliveryFee = dto.diningOption === 'Delivery' ? 2500 : 0;
    const totalTzs = subtotal + serviceFee + deliveryFee;

    const createdOrder = await OrderRepository.createOrder(
      {
        customerId: dto.userId,
        restaurantId: dto.restaurantId,
        branchId: dto.branchId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalTzs: subtotal,
        serviceFeeTzs: serviceFee,
        deliveryFeeTzs: deliveryFee,
        totalTzs,
        currency: 'TZS',
        fulfillmentType: dto.diningOption,
        deliveryAddress: dto.deliveryAddress,
        specialInstructions: dto.specialInstructions,
        estimatedPrepMinutes: 30,
      },
      dto.items.map((i) => ({
        menuItemId: i.menuItemId,
        itemNameSnapshot: i.name,
        priceSnapshot: i.unitPriceTzs,
        quantity: i.quantity,
        subtotal: i.totalPriceTzs,
        specialNotes: i.specialNotes,
      }))
    );

    // Broadcast Real-Time Signal
    this.broadcastOrderEvent('NEW_ORDER_PLACED', createdOrder.id, dto.userId, dto.restaurantId, {
      order: createdOrder,
      items: dto.items,
      totalTzs,
      customer: {
        name: dto.customerName,
        phone: dto.customerPhone,
        deliveryAddress: dto.deliveryAddress,
      },
    });

    return createdOrder;
  }

  /**
   * 2. Restaurant Owner / Staff accepts incoming order
   * Transitions PENDING -> ACCEPTED via authoritative server RPC
   */
  async acceptOrder(
    orderId: string,
    prepTimeMinutes: number = 25,
    restaurantId?: string
  ): Promise<Order> {
    if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
      const demoRes = await DemoOrderPipelineAdapter.acceptOrder(orderId, prepTimeMinutes, restaurantId);
      return {
        id: demoRes.id,
        orderNumber: demoRes.orderNumber || demoRes.id,
        customerId: demoRes.userId,
        restaurantId: demoRes.targetRestaurantId || restaurantId || 'mama-amina-biryani',
        status: 'ACCEPTED',
        paymentStatus: 'PENDING',
        subtotalTzs: demoRes.budgetTzs,
        serviceFeeTzs: 1500,
        deliveryFeeTzs: 2500,
        totalTzs: demoRes.budgetTzs,
        currency: 'TZS',
        fulfillmentType: demoRes.diningOption || 'Delivery',
        estimatedPrepMinutes: prepTimeMinutes,
        acceptedAt: new Date().toISOString(),
        items: [],
        createdAt: demoRes.createdAt,
        updatedAt: demoRes.updatedAt,
      };
    }

    // Propagates order state change to Supabase public.orders: OrderRepository.updateStatus(orderId, 'ACCEPTED')
    const updatedOrder = await OrderRepository.transitionRestaurantOrder(orderId, 'ACCEPTED', undefined, prepTimeMinutes);

    const payload = {
      order: updatedOrder,
      prepTimeMinutes,
      status: 'ACCEPTED',
    };

    this.broadcastOrderEvent(
      'ORDER_CONFIRMED',
      orderId,
      updatedOrder.customerId,
      updatedOrder.restaurantId,
      payload
    );

    return updatedOrder;
  }

  /**
   * 3. Restaurant Owner / Staff rejects / cancels order
   * Transitions current status -> CANCELLED via authoritative server RPC
   */
  async rejectOrder(
    orderId: string,
    reason: string = 'Kitchen at maximum capacity'
  ): Promise<Order> {
    if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
      const demoRes = await DemoOrderPipelineAdapter.rejectOrder(orderId, reason);
      return {
        id: demoRes.id,
        orderNumber: demoRes.orderNumber || demoRes.id,
        customerId: demoRes.userId,
        restaurantId: demoRes.targetRestaurantId || 'mama-amina-biryani',
        status: 'CANCELLED',
        paymentStatus: 'PENDING',
        subtotalTzs: demoRes.budgetTzs,
        serviceFeeTzs: 1500,
        deliveryFeeTzs: 2500,
        totalTzs: demoRes.budgetTzs,
        currency: 'TZS',
        fulfillmentType: demoRes.diningOption || 'Delivery',
        cancellationReason: reason,
        items: [],
        createdAt: demoRes.createdAt,
        updatedAt: demoRes.updatedAt,
      };
    }

    // Propagates order state change to Supabase public.orders: OrderRepository.updateStatus(orderId, 'CANCELLED', reason)
    const updatedOrder = await OrderRepository.transitionRestaurantOrder(orderId, 'CANCELLED', reason);

    const payload = {
      order: updatedOrder,
      reason,
      status: 'CANCELLED',
    };

    this.broadcastOrderEvent(
      'STATUS_UPDATED',
      orderId,
      updatedOrder.customerId,
      updatedOrder.restaurantId,
      payload
    );

    return updatedOrder;
  }

  /**
   * 4. Advance kitchen fulfillment status:
   * ACCEPTED -> PREPARING -> READY -> COMPLETED
   * Canonical database order statuses enforced server-side.
   */
  async updateFulfillmentStatus(
    orderId: string,
    status: KitchenProgressionStatus,
    customMessageEn?: string,
    customMessageSw?: string
  ): Promise<Order> {
    // Translate UI / legacy aliases to canonical order_status_enum
    let canonicalStatus: OrderStatus = 'PREPARING';
    let adapterStatus: 'Cooking' | 'Ready' | 'Completed' | 'Cancelled' = 'Cooking';

    if (status === 'Cooking' || status === 'PREPARING') {
      canonicalStatus = 'PREPARING';
      adapterStatus = 'Cooking';
    } else if (status === 'Ready' || status === 'READY') {
      canonicalStatus = 'READY';
      adapterStatus = 'Ready';
    } else if (status === 'Completed' || status === 'COMPLETED') {
      canonicalStatus = 'COMPLETED';
      adapterStatus = 'Completed';
    } else if (status === 'Cancelled' || status === 'CANCELLED') {
      canonicalStatus = 'CANCELLED';
      adapterStatus = 'Cancelled';
    } else {
      canonicalStatus = status as OrderStatus;
    }

    if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
      const demoRes = await DemoOrderPipelineAdapter.updateFulfillmentStatus(
        orderId,
        adapterStatus,
        customMessageEn,
        customMessageSw
      );
      return {
        id: demoRes.id,
        orderNumber: demoRes.orderNumber || demoRes.id,
        customerId: demoRes.userId,
        restaurantId: demoRes.targetRestaurantId || 'mama-amina-biryani',
        status: canonicalStatus,
        paymentStatus: 'PENDING',
        subtotalTzs: demoRes.budgetTzs,
        serviceFeeTzs: 1500,
        deliveryFeeTzs: 2500,
        totalTzs: demoRes.budgetTzs,
        currency: 'TZS',
        fulfillmentType: demoRes.diningOption || 'Delivery',
        items: [],
        createdAt: demoRes.createdAt,
        updatedAt: demoRes.updatedAt,
      };
    }

    const updatedOrder = await OrderRepository.transitionRestaurantOrder(
      orderId,
      canonicalStatus
    );

    const payload = {
      order: updatedOrder,
      status: canonicalStatus,
      customMessageEn,
      customMessageSw,
    };

    this.broadcastOrderEvent(
      'STATUS_UPDATED',
      orderId,
      updatedOrder.customerId,
      updatedOrder.restaurantId,
      payload
    );

    return updatedOrder;
  }

  /**
   * Legacy / Test Adapter Delegation for Custom Meal flows
   */
  async submitCustomMealOrder(dto: any): Promise<any> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      return DemoOrderPipelineAdapter.submitCustomMealOrder(dto);
    }
    throw new Error('Custom meals are not available via standard order pipeline in production.');
  }

  async quoteCustomMeal(
    orderId: string,
    restaurantId: string,
    restaurantName: string,
    quote: any
  ): Promise<any> {
    if (runtimeConfig.allowLocalDataFallbacks) {
      return DemoOrderPipelineAdapter.quoteCustomMeal(orderId, restaurantId, restaurantName, quote);
    }
    throw new Error('Custom meal quotes are not supported in production order pipeline.');
  }

  async acceptAndConfirmOrder(
    orderId: string,
    restaurantId?: string,
    restaurantName?: string,
    prepTimeMinutes?: number
  ): Promise<any> {
    if (runtimeConfig.allowLocalDataFallbacks && !isSupabaseConfigured()) {
      return DemoOrderPipelineAdapter.acceptAndConfirmOrder(
        orderId,
        restaurantId,
        restaurantName,
        prepTimeMinutes
      );
    }
    return this.acceptOrder(orderId, prepTimeMinutes, restaurantId);
  }

  /**
   * Helper: Subscribe to incoming restaurant orders
   */
  subscribeToRestaurantOrders(
    restaurantId: string,
    callback: (event: RealtimeEventPayload) => void
  ): () => void {
    const unsub = RealtimeEventEngine.subscribe(`orders:restaurant:${restaurantId}`, callback);
    return unsub;
  }

  /**
   * Helper: Subscribe to customer order updates
   */
  subscribeToCustomerOrders(
    customerId: string,
    callback: (event: RealtimeEventPayload) => void
  ): () => void {
    return RealtimeEventEngine.subscribe(`orders:customer:${customerId}`, callback);
  }
}

export const OrderPipelineService = new OrderPipelineServiceImpl();
