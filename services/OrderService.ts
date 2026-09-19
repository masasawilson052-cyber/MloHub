import { OrderRepository } from '../repositories/orders.repository';
import { CustomMealRepository } from '../repositories/customMeals.repository';
import { NotificationRepository } from '../repositories/notifications.repository';
import { isSupabaseConfigured } from '../lib/supabase';
import { Order, OrderItem, OrderStatus, CustomMealRequest } from '../types/domain';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { MloHubDB } from '../db';

export interface SubmitMenuOrderDTO {
  userId: string;
  customerName?: string;
  customerPhone?: string;
  restaurantId: string;
  items: {
    menuItemId?: string;
    name: string;
    unitPriceTzs: number;
    quantity: number;
    totalPriceTzs: number;
  }[];
  diningOption: 'Delivery' | 'Dine-In' | 'Takeaway';
  deliveryAddress?: string;
  specialInstructions?: string;
}

export interface SubmitCustomOrderDTO {
  userId: string;
  customerName?: string;
  customerPhone?: string;
  dishName: string;
  restaurantName?: string;
  targetRestaurantId?: string;
  specialInstructions: string;
  budgetTzs: number;
  servingsCount: string;
  diningOption: 'Delivery' | 'Dine-In' | 'Takeaway';
  neighborhood?: string;
}

export interface OrderQuote {
  subtotalTzs: number;
  deliveryFeeTzs: number;
  serviceFeeTzs: number;
  totalTzs: number;
  currency: 'TZS';
  fulfillmentType: 'Delivery' | 'Dine-In' | 'Takeaway';
  itemCount: number;
}

export class OrderService {
  /**
   * Authoritative order quote calculation.
   * Ensures client UI previews use the exact same pricing and fee logic as create_order_secure.
   */
  public static quoteOrder(params: {
    items: { unitPriceTzs: number; quantity: number }[];
    diningOption: 'Delivery' | 'Dine-In' | 'Takeaway';
  }): OrderQuote {
    const subtotalTzs = params.items.reduce((sum, item) => sum + item.unitPriceTzs * item.quantity, 0);
    const serviceFeeTzs = 1500;
    const deliveryFeeTzs = params.diningOption === 'Delivery' ? 2500 : 0;
    const totalTzs = subtotalTzs + serviceFeeTzs + deliveryFeeTzs;
    const itemCount = params.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotalTzs,
      deliveryFeeTzs,
      serviceFeeTzs,
      totalTzs,
      currency: 'TZS',
      fulfillmentType: params.diningOption,
      itemCount,
    };
  }
  /**
   * Submit a standard menu order with line-item snapshots
   */
  public static async submitStandardMenuOrder(dto: SubmitMenuOrderDTO): Promise<Order> {
    const subtotal = dto.items.reduce((sum, item) => sum + item.totalPriceTzs, 0);
    const serviceFee = 1500;
    const deliveryFee = dto.diningOption === 'Delivery' ? 2500 : 0;
    const totalTzs = subtotal + serviceFee + deliveryFee;
    const orderNumber = `MLO-${Date.now().toString().slice(-4)}`;

    if (isSupabaseConfigured()) {
      const orderData: Partial<Order> = {
        customerId: dto.userId,
        restaurantId: dto.restaurantId,
        orderNumber,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalTzs: subtotal,
        serviceFeeTzs: serviceFee,
        deliveryFeeTzs: deliveryFee,
        totalTzs,
        fulfillmentType: dto.diningOption,
        deliveryAddress: dto.deliveryAddress,
        specialInstructions: dto.specialInstructions,
        estimatedPrepMinutes: 25,
      };

      const itemsData: Partial<OrderItem>[] = dto.items.map((it) => ({
        menuItemId: it.menuItemId,
        itemNameSnapshot: it.name,
        priceSnapshot: it.unitPriceTzs,
        quantity: it.quantity,
        subtotal: it.totalPriceTzs,
      }));

      const createdOrder = await OrderRepository.createOrder(orderData, itemsData);

      // In-app notifications
      try {
        await NotificationRepository.createNotification({
          userId: dto.userId,
          type: 'order',
          category: 'ORDER',
          titleEn: `Order #${orderNumber} Placed!`,
          titleSw: `Agizo #${orderNumber} Limewekwa!`,
          messageEn: `Your order for ${itemsData.length} items has been submitted.`,
          messageSw: `Agizo lako la vyakula ${itemsData.length} limetumwa jikoni.`,
          orderId: createdOrder.id,
          restaurantId: dto.restaurantId,
        });
      } catch (err) {
        console.warn('Failed to send notification in OrderService:', err);
      }

      RealtimeEventEngine.publish(`orders:customer:${dto.userId}`, {
        eventType: 'NEW_ORDER_PLACED',
        orderId: createdOrder.id,
        customerId: dto.userId,
        restaurantId: dto.restaurantId,
        data: { order: createdOrder },
      });
      RealtimeEventEngine.publish(`orders:restaurant:${dto.restaurantId}`, {
        eventType: 'NEW_ORDER_PLACED',
        orderId: createdOrder.id,
        customerId: dto.userId,
        restaurantId: dto.restaurantId,
        data: { order: createdOrder },
      });

      return createdOrder;
    }

    // Mock / Offline Fallback for automated tests
    const itemsSummary = dto.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    await MloHubDB.init();
    const mockOrder = await MloHubDB.customOrders.create({
      userId: dto.userId,
      dishName: itemsSummary,
      restaurantName: 'Restaurant',
      targetRestaurantId: dto.restaurantId,
      specialInstructions: dto.specialInstructions || '',
      budgetTzs: totalTzs,
      servingsCount: `${dto.items.reduce((s, i) => s + i.quantity, 0)} Items`,
      diningOption: dto.diningOption,
      status: 'Pending Confirmation',
      statusMessageEn: `Order #${orderNumber} submitted.`,
      statusMessageSw: `Agizo #${orderNumber} limetumwa.`,
      paymentStatus: 'UNPAID',
    });

    return {
      id: mockOrder.id,
      orderNumber,
      customerId: dto.userId,
      restaurantId: dto.restaurantId,
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
      estimatedPrepMinutes: 25,
      createdAt: mockOrder.createdAt,
      updatedAt: mockOrder.updatedAt,
      items: dto.items.map((it, idx) => ({
        id: `mock-item-${idx}`,
        orderId: mockOrder.id,
        menuItemId: it.menuItemId,
        itemNameSnapshot: it.name,
        priceSnapshot: it.unitPriceTzs,
        quantity: it.quantity,
        subtotal: it.totalPriceTzs,
        createdAt: mockOrder.createdAt,
      })),
    };
  }

  /**
   * Submit an advance custom meal request
   */
  public static async submitCustomMealRequest(dto: SubmitCustomOrderDTO): Promise<CustomMealRequest> {
    const orderNumber = `MLO-${Date.now().toString().slice(-4)}`;

    if (isSupabaseConfigured()) {
      const requestData: Partial<CustomMealRequest> = {
        orderNumber,
        customerId: dto.userId,
        title: dto.dishName,
        dishName: dto.dishName,
        specialInstructions: dto.specialInstructions,
        description: dto.specialInstructions,
        budgetTzs: dto.budgetTzs,
        servings: dto.servingsCount,
        servingsCount: dto.servingsCount,
        diningOption: dto.diningOption,
        deliveryLocation: dto.neighborhood || 'Mikocheni',
        status: 'PENDING',
      };

      const created = await CustomMealRepository.createRequest(requestData);

      try {
        await NotificationRepository.createNotification({
          userId: dto.userId,
          type: 'order',
          category: 'ORDER',
          titleEn: `Custom Meal #${orderNumber} Submitted!`,
          titleSw: `Ombi la Chakula #${orderNumber} Limetumwa!`,
          messageEn: `Your request for ${dto.dishName} has been broadcast to chefs.`,
          messageSw: `Ombi lako la ${dto.dishName} limetumwa kwa wapishi.`,
        });
      } catch (err) {
        console.warn('Failed to send notification:', err);
      }

      RealtimeEventEngine.publish(`orders:customer:${dto.userId}`, {
        eventType: 'NEW_ORDER_PLACED',
        orderId: created.id,
        customerId: dto.userId,
        data: { request: created },
      });

      return created;
    }

    // Mock fallback
    await MloHubDB.init();
    const mockReq = await MloHubDB.customOrders.create({
      userId: dto.userId,
      dishName: dto.dishName,
      restaurantName: dto.restaurantName || 'Mama Amina Authentic Biryani',
      targetRestaurantId: dto.targetRestaurantId || 'mama-amina-biryani',
      specialInstructions: dto.specialInstructions,
      budgetTzs: dto.budgetTzs,
      servingsCount: dto.servingsCount,
      diningOption: dto.diningOption,
      status: 'Pending Confirmation',
      statusMessageEn: 'Submitted to kitchen.',
      statusMessageSw: 'Imetumwa jikoni.',
      paymentStatus: 'UNPAID',
    });

    return {
      id: mockReq.id,
      orderNumber,
      customerId: dto.userId,
      title: dto.dishName,
      dishName: dto.dishName,
      specialInstructions: dto.specialInstructions,
      description: dto.specialInstructions,
      budgetTzs: dto.budgetTzs,
      servings: dto.servingsCount,
      servingsCount: dto.servingsCount,
      diningOption: dto.diningOption,
      status: 'PENDING',
      createdAt: mockReq.createdAt,
      updatedAt: mockReq.updatedAt,
    };
  }

  /**
   * Restaurant accepts order
   */
  public static async acceptOrder(orderId: string, prepMinutes: number = 25): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      const updated = await OrderRepository.updateStatus(orderId, 'ACCEPTED');
      RealtimeEventEngine.publish(`orders:customer:${updated.customerId}`, {
        eventType: 'ORDER_CONFIRMED',
        orderId: updated.id,
        customerId: updated.customerId,
        data: { order: updated, prepMinutes },
      });
      return updated;
    }

    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) return null;
    await MloHubDB.customOrders.update(orderId, { status: 'Confirmed' });
    return null;
  }

  /**
   * Update order fulfillment status (CONFIRMED -> PREPARING -> READY -> COMPLETED)
   */
  public static async updateFulfillmentStatus(
    orderId: string,
    status: OrderStatus,
    reason?: string
  ): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      const updated = await OrderRepository.updateStatus(orderId, status, reason);
      RealtimeEventEngine.publish(`orders:customer:${updated.customerId}`, {
        eventType: 'STATUS_UPDATED',
        orderId: updated.id,
        customerId: updated.customerId,
        data: { order: updated, status },
      });
      return updated;
    }
    return null;
  }

  /**
   * List customer orders
   */
  public static async listCustomerOrders(customerId: string): Promise<Order[]> {
    if (isSupabaseConfigured()) {
      return OrderRepository.listOrdersForCustomer(customerId);
    }
    return [];
  }

  /**
   * List restaurant orders
   */
  public static async listRestaurantOrders(restaurantId: string, status?: OrderStatus): Promise<Order[]> {
    if (isSupabaseConfigured()) {
      return OrderRepository.listOrdersForRestaurant(restaurantId, status);
    }
    return [];
  }

  /**
   * Get single order by ID
   */
  public static async getOrderById(orderId: string): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      return OrderRepository.getOrderById(orderId);
    }
    return null;
  }
}
