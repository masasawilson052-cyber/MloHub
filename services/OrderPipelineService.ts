import { MloHubDB, CustomMealRequestEntity } from '../db';
import { RealtimeEventEngine, RealtimeEventPayload } from '../db/realtime/eventEngine';
import { MenuItemEntity } from '../db/types';

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

export interface QuoteMealDTO {
  quotedPriceTzs: number;
  estimatedDeliveryTime: string;
  inclusions: string;
  chefNotes?: string;
}

export class OrderPipelineServiceImpl {
  /**
   * 1. Customer places a standard menu order
   */
  async submitStandardMenuOrder(dto: SubmitMenuOrderDTO): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const orderNumber = `MLO-${Date.now().toString().slice(-4)}`;
    const rest = MloHubDB.restaurants.getById(dto.restaurantId);
    const restaurantName = rest?.name || 'MloHub Kitchen';

    const subtotal = dto.items.reduce((sum, item) => sum + item.totalPriceTzs, 0);
    const serviceFee = 1500;
    const deliveryFee = dto.diningOption === 'Delivery' ? 2500 : 0;
    const totalTzs = subtotal + serviceFee + deliveryFee;

    const itemsSummary = dto.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');

    // Decrement stock in menu items if applicable
    if (rest && rest.menu) {
      for (const item of dto.items) {
        if (item.menuItemId) {
          const menuItem = rest.menu.find((m) => m.id === item.menuItemId);
          if (menuItem && menuItem.stockQuantity !== undefined) {
            menuItem.stockQuantity = Math.max(0, menuItem.stockQuantity - item.quantity);
            if (menuItem.stockQuantity === 0) {
              menuItem.isAvailable = false;
            }
          }
        }
      }
      await MloHubDB.save();
    }

    const newOrder = await MloHubDB.customOrders.create({
      userId: dto.userId,
      dishName: itemsSummary,
      restaurantName,
      targetRestaurantId: dto.restaurantId,
      specialInstructions: dto.specialInstructions || '',
      budgetTzs: totalTzs,
      servingsCount: `${dto.items.reduce((s, i) => s + i.quantity, 0)} Items`,
      diningOption: dto.diningOption,
      status: 'Pending Confirmation',
      statusMessageEn: `Order #${orderNumber} submitted to ${restaurantName}. Awaiting kitchen acceptance.`,
      statusMessageSw: `Agizo #${orderNumber} limetumwa kwa ${restaurantName}. Linasubiri kukubaliwa na jikoni.`,
      paymentStatus: 'UNPAID',
    });

    // Customer In-App Notification
    await MloHubDB.notifications.create({
      userId: dto.userId,
      type: 'order',
      titleEn: `Order #${orderNumber} Placed!`,
      titleSw: `Agizo #${orderNumber} Limewekwa!`,
      messageEn: `Your order for "${itemsSummary}" has been sent to ${restaurantName}.`,
      messageSw: `Agizo lako la "${itemsSummary}" limetumwa kwa ${restaurantName}.`,
      data: { orderId: newOrder.id, orderNumber, restaurantId: dto.restaurantId },
    });

    // Kitchen Owner In-App Notification
    const ownerId = rest?.ownerId || 'usr-chef-amina';
    await MloHubDB.notifications.create({
      userId: ownerId,
      type: 'order',
      titleEn: `New Incoming Order: #${orderNumber}`,
      titleSw: `Agizo Jipya Jikoni: #${orderNumber}`,
      messageEn: `${dto.customerName || 'Customer'} ordered: ${itemsSummary} (TZS ${totalTzs.toLocaleString()}).`,
      messageSw: `${dto.customerName || 'Mteja'} ameagiza: ${itemsSummary} (TZS ${totalTzs.toLocaleString()}).`,
      data: { orderId: newOrder.id, orderNumber, restaurantId: dto.restaurantId },
    });

    // Real-Time Broadcast
    const payload = {
      order: newOrder,
      items: dto.items,
      totalTzs,
      customer: {
        name: dto.customerName || 'Customer',
        phone: dto.customerPhone || '+255 754 000 000',
        deliveryAddress: dto.deliveryAddress || 'Mikocheni',
      },
    };

    RealtimeEventEngine.publish(`orders:restaurant:${dto.restaurantId}`, {
      eventType: 'NEW_ORDER_PLACED',
      orderId: newOrder.id,
      customerId: dto.userId,
      restaurantId: dto.restaurantId,
      data: payload,
    });

    RealtimeEventEngine.publish(`orders:customer:${dto.userId}`, {
      eventType: 'NEW_ORDER_PLACED',
      orderId: newOrder.id,
      customerId: dto.userId,
      restaurantId: dto.restaurantId,
      data: payload,
    });

    return newOrder;
  }

  /**
   * 2. Customer places an advance custom meal request
   */
  async submitCustomMealOrder(dto: SubmitOrderDTO): Promise<CustomMealRequestEntity> {
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

    // Notifications & Realtime
    await MloHubDB.notifications.create({
      userId: dto.userId,
      type: 'order',
      titleEn: `Custom Meal #${orderNumber} Submitted!`,
      titleSw: `Ombi la Chakula #${orderNumber} Limetumwa!`,
      messageEn: `Your request for ${dto.dishName} has been sent to ${restaurantName}.`,
      messageSw: `Ombi lako la ${dto.dishName} limetumwa kwa ${restaurantName}.`,
      data: { orderId: newOrder.id, orderNumber },
    });

    const payload = {
      order: newOrder,
      customer: {
        name: dto.customerName || 'Customer',
        phone: dto.customerPhone || '+255 754 000 000',
        neighborhood: dto.neighborhood || 'Mikocheni',
      },
    };

    RealtimeEventEngine.publish(`orders:restaurant:${targetRestId}`, {
      eventType: 'NEW_ORDER_PLACED',
      orderId: newOrder.id,
      customerId: dto.userId,
      restaurantId: targetRestId,
      data: payload,
    });

    return newOrder;
  }

  /**
   * 3. Restaurant Owner accepts order and sets estimated prep time
   */
  async acceptOrder(
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

    // Create Notification
    await MloHubDB.notifications.create({
      userId: existing.userId,
      type: 'order',
      titleEn: `Order #${existing.orderNumber} Accepted!`,
      titleSw: `Agizo #${existing.orderNumber} Limekubaliwa!`,
      messageEn: `${restaurantName} is preparing your order. Estimated ready in ${prepTimeMinutes} mins.`,
      messageSw: `${restaurantName} anakuandalia chakula chako. Kitakuwa tayari ndani ya dk ${prepTimeMinutes}.`,
      data: { orderId, prepTimeMinutes },
    });

    const payload = {
      order: updated,
      prepTimeMinutes,
      status: 'Confirmed',
    };

    RealtimeEventEngine.publish(`orders:customer:${existing.userId}`, {
      eventType: 'ORDER_CONFIRMED',
      orderId,
      customerId: existing.userId,
      restaurantId,
      data: payload,
    });

    RealtimeEventEngine.publish(`orders:restaurant:${restaurantId}`, {
      eventType: 'ORDER_CONFIRMED',
      orderId,
      customerId: existing.userId,
      restaurantId,
      data: payload,
    });

    return updated;
  }

  /**
   * 3b. Legacy / Convenience: accept and confirm order with custom restaurant name
   */
  async acceptAndConfirmOrder(
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

    // Customer Notification
    await MloHubDB.notifications.create({
      userId: existing.userId,
      type: 'order',
      titleEn: `Order #${existing.orderNumber} Confirmed!`,
      titleSw: `Agizo #${existing.orderNumber} Limethibitishwa!`,
      messageEn: `${restaurantName} has confirmed your order. Estimated prep time: ${prepTimeMinutes} mins.`,
      messageSw: `${restaurantName} amethibitisha agizo lako. Muda wa kuandaa: dk ${prepTimeMinutes}.`,
      data: { orderId, prepTimeMinutes, restaurantId },
    });

    const payload = {
      order: updated,
      prepTimeMinutes,
      status: 'Confirmed',
      restaurantName,
    };

    RealtimeEventEngine.publish(`orders:customer:${existing.userId}`, {
      eventType: 'ORDER_CONFIRMED',
      orderId,
      customerId: existing.userId,
      restaurantId,
      data: payload,
    });

    RealtimeEventEngine.publish(`orders:restaurant:${restaurantId}`, {
      eventType: 'ORDER_CONFIRMED',
      orderId,
      customerId: existing.userId,
      restaurantId,
      data: payload,
    });

    return updated;
  }

  /**
   * 3c. Chef quotes a custom meal request
   */
  async quoteCustomMeal(
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

    await MloHubDB.notifications.create({
      userId: existing.userId,
      type: 'order',
      titleEn: `New Kitchen Quote: TZS ${quote.quotedPriceTzs.toLocaleString()}`,
      titleSw: `Bei Mpya ya Jikoni: TZS ${quote.quotedPriceTzs.toLocaleString()}`,
      messageEn: `${restaurantName} quoted TZS ${quote.quotedPriceTzs.toLocaleString()} for your custom feast.`,
      messageSw: `${restaurantName} amekadiria TZS ${quote.quotedPriceTzs.toLocaleString()} kwa agizo lako maalum.`,
      data: { orderId, quote, restaurantId },
    });

    RealtimeEventEngine.publish(`orders:customer:${existing.userId}`, {
      eventType: 'QUOTE_OFFERED',
      orderId,
      customerId: existing.userId,
      restaurantId,
      data: { quote, order: updated },
    });

    return updated;
  }

  /**
   * 4. Restaurant Owner rejects order
   */
  async rejectOrder(
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

    // Customer Notification
    await MloHubDB.notifications.create({
      userId: existing.userId,
      type: 'order',
      titleEn: `Order #${existing.orderNumber} Cancelled`,
      titleSw: `Agizo #${existing.orderNumber} Limesitishwa`,
      messageEn: `Reason: ${reason}. Any pre-authorized payment is immediately refunded.`,
      messageSw: `Sababu: ${reason}. Malipo yoyote yaliyofanyika yanarudishwa mara moja.`,
      data: { orderId, reason },
    });

    const payload = { order: updated, reason, status: 'Cancelled' };
    RealtimeEventEngine.publish(`orders:customer:${existing.userId}`, {
      eventType: 'STATUS_UPDATED',
      orderId,
      customerId: existing.userId,
      restaurantId: existing.targetRestaurantId || '',
      data: payload,
    });

    return updated;
  }

  /**
   * 5. Update kitchen fulfillment status (Cooking ➔ Ready ➔ Completed)
   */
  async updateFulfillmentStatus(
    orderId: string,
    status: 'Cooking' | 'Ready' | 'Completed' | 'Cancelled',
    customMessageEn?: string,
    customMessageSw?: string
  ): Promise<CustomMealRequestEntity> {
    await MloHubDB.init();
    const existing = MloHubDB.customOrders.getById(orderId);
    if (!existing) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }

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

    // Create Notification
    await MloHubDB.notifications.create({
      userId: existing.userId,
      type: 'order',
      titleEn: `Order #${existing.orderNumber}: ${status}`,
      titleSw: `Agizo #${existing.orderNumber}: ${status}`,
      messageEn: customMessageEn || defaultEn,
      messageSw: customMessageSw || defaultSw,
      data: { orderId, status },
    });

    // Realtime Dispatch
    const payload = { order: updated, status };

    RealtimeEventEngine.publish(`orders:customer:${existing.userId}`, {
      eventType: 'STATUS_UPDATED',
      orderId,
      customerId: existing.userId,
      restaurantId: existing.targetRestaurantId || '',
      data: payload,
    });

    if (existing.targetRestaurantId) {
      RealtimeEventEngine.publish(`orders:restaurant:${existing.targetRestaurantId}`, {
        eventType: 'STATUS_UPDATED',
        orderId,
        customerId: existing.userId,
        restaurantId: existing.targetRestaurantId,
        data: payload,
      });
    }

    return updated;
  }

  /**
   * Helper: Subscribe to incoming restaurant orders
   */
  subscribeToRestaurantOrders(
    restaurantId: string,
    callback: (event: RealtimeEventPayload) => void
  ): () => void {
    const unsub1 = RealtimeEventEngine.subscribe(`orders:restaurant:${restaurantId}`, callback);
    const unsub2 = RealtimeEventEngine.subscribe('custom_meals:broadcast', callback);
    return () => {
      unsub1();
      unsub2();
    };
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
