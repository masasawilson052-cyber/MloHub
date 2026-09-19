/**
 * ============================================================================
 * MLOHUB DEMO & TEST ORDER PIPELINE ADAPTER
 * Strictly scoped for deterministic offline mock tests and demo mode
 * ============================================================================
 */

import { MloHubDB, CustomMealRequestEntity } from '../../db';
import { RealtimeEventEngine, RealtimeEventPayload } from '../../db/realtime/eventEngine';

export interface SubmitOrderDTO {
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

export interface QuoteMealDTO {
  quotedPriceTzs: number;
  estimatedDeliveryTime: string;
  inclusions: string;
  chefNotes?: string;
}

export class DemoOrderPipelineAdapter {
  private static broadcastOrderEvent(
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

  static async submitCustomMealOrder(dto: SubmitOrderDTO): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const orderNumber = `MLO-${Date.now().toString().slice(-4)}`;
    const targetRestId = dto.targetRestaurantId || 'mama-amina-biryani';
    const rest = MloHubDB.restaurants.getById(targetRestId);
    const restaurantName = dto.restaurantName || rest?.name || 'Mama Amina Authentic Biryani';

    const newOrder = await MloHubDB.customOrders.create({
      userId: dto.userId,
      dishName: dto.dishName,
      restaurantName,
      targetRestaurantId: targetRestId,
      specialInstructions: dto.specialInstructions,
      budgetTzs: dto.budgetTzs,
      servingsCount: dto.servingsCount,
      diningOption: dto.diningOption,
      status: 'Pending Confirmation',
      statusMessageEn: `Submitted to ${restaurantName}. Awaiting kitchen confirmation.`,
      statusMessageSw: `Imetumwa kwa ${restaurantName}. Inasubiri uthibitisho wa jikoni.`,
      paymentStatus: 'UNPAID',
    });

    const payload = {
      order: newOrder,
      customer: {
        name: dto.customerName || 'Customer',
        phone: dto.customerPhone || '+255 754 000 000',
        neighborhood: dto.neighborhood || 'Mikocheni',
      },
    };

    this.broadcastOrderEvent('NEW_ORDER_PLACED', newOrder.id, dto.userId, targetRestId, payload);
    return newOrder;
  }

  static async acceptOrder(
    orderId: string,
    prepTimeMinutes: number = 25,
    restaurantId: string = 'mama-amina-biryani'
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) throw new Error(`Order ${orderId} not found`);

    const rest = MloHubDB.restaurants.getById(restaurantId);
    const restaurantName = rest?.name || existing.restaurantName;

    const updated = await MloHubDB.customOrders.update(orderId, {
      status: 'Confirmed',
      statusMessageEn: `Order accepted by ${restaurantName}. Freshly cooking now! (Estimated prep: ${prepTimeMinutes} mins)`,
      statusMessageSw: `Agizo limekubaliwa na ${restaurantName}. Linapikwa sasa hivi! (Muda uliokadiriwa: dk ${prepTimeMinutes})`,
    });

    if (!updated) throw new Error('Failed to accept order');

    const payload = {
      order: updated,
      prepTimeMinutes,
      status: 'Confirmed',
    };

    this.broadcastOrderEvent('ORDER_CONFIRMED', orderId, existing.userId, restaurantId, payload);
    return updated;
  }

  static async acceptAndConfirmOrder(
    orderId: string,
    restaurantId: string = 'mama-amina-biryani',
    restaurantName: string = 'Mama Amina Authentic Biryani',
    prepTimeMinutes: number = 30
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) throw new Error(`Order ${orderId} not found`);

    const updated = await MloHubDB.customOrders.update(orderId, {
      status: 'Confirmed',
      statusMessageEn: `Order Confirmed by ${restaurantName}. Chef is preparing your batch (Est: ${prepTimeMinutes} mins).`,
      statusMessageSw: `Agizo Limethibitishwa na ${restaurantName}. Mpishi anakuandalia mlo wako (Takribani: dk ${prepTimeMinutes}).`,
      targetRestaurantId: restaurantId,
      restaurantName,
    });

    if (!updated) throw new Error('Failed to confirm order');

    const payload = {
      order: updated,
      prepTimeMinutes,
      status: 'Confirmed',
      restaurantName,
    };

    this.broadcastOrderEvent('ORDER_CONFIRMED', orderId, existing.userId, restaurantId, payload);
    return updated;
  }

  static async quoteCustomMeal(
    orderId: string,
    restaurantId: string,
    restaurantName: string,
    quote: QuoteMealDTO
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) throw new Error(`Order ${orderId} not found`);

    const updated = await MloHubDB.customOrders.update(orderId, {
      budgetTzs: quote.quotedPriceTzs,
      targetRestaurantId: restaurantId,
      restaurantName,
      statusMessageEn: `Quoted TZS ${quote.quotedPriceTzs.toLocaleString()} by ${restaurantName}. Delivery: ${quote.estimatedDeliveryTime}`,
      statusMessageSw: `Imekadiriwa TZS ${quote.quotedPriceTzs.toLocaleString()} na ${restaurantName}. Uwasilishaji: ${quote.estimatedDeliveryTime}`,
    });

    if (!updated) throw new Error('Failed to quote custom meal');

    this.broadcastOrderEvent('QUOTE_OFFERED', orderId, existing.userId, restaurantId, { quote, order: updated });
    return updated;
  }

  static async rejectOrder(
    orderId: string,
    reason: string = 'Kitchen at maximum capacity'
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) throw new Error(`Order ${orderId} not found`);

    const updated = await MloHubDB.customOrders.update(orderId, {
      status: 'Cancelled',
      statusMessageEn: `Order could not be fulfilled: ${reason}.`,
      statusMessageSw: `Agizo halikuweza kupikwa: ${reason}.`,
    });

    if (!updated) throw new Error('Failed to reject order');

    const payload = { order: updated, reason, status: 'Cancelled' };
    this.broadcastOrderEvent('STATUS_UPDATED', orderId, existing.userId, existing.targetRestaurantId || '', payload);
    return updated;
  }

  static async updateFulfillmentStatus(
    orderId: string,
    status: 'Cooking' | 'Ready' | 'Completed' | 'Cancelled',
    customMessageEn?: string,
    customMessageSw?: string
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) throw new Error(`Order with ID ${orderId} not found.`);

    let defaultEn = `Order status: ${status}`;
    let defaultSw = `Hali ya agizo: ${status}`;

    if (status === 'Cooking') {
      defaultEn = 'Chef is simmering spices and packaging fresh servings.';
      defaultSw = 'Mpishi anaendelea kupika na kuandaa vifungashio safi.';
    } else if (status === 'Ready') {
      defaultEn = 'Packed with tamper-evident seal. Ready for pickup or courier dispatch!';
      defaultSw = 'Limefungwa kwa usalama. Tayari kwa kuchukuliwa au dereva!';
    } else if (status === 'Completed') {
      defaultEn = 'Delivered & Completed! Thank you for dining with MloHub.';
      defaultSw = 'Limepokelewa na kukamilika! Asante kwa kuchagua MloHub.';
    }

    const updated = await MloHubDB.customOrders.update(orderId, {
      status,
      statusMessageEn: customMessageEn || defaultEn,
      statusMessageSw: customMessageSw || defaultSw,
    });

    if (!updated) throw new Error('Failed to update order status');

    const payload = { order: updated, status };
    this.broadcastOrderEvent('STATUS_UPDATED', orderId, existing.userId, existing.targetRestaurantId || '', payload);
    return updated;
  }
}
