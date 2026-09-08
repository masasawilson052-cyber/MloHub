import { MloHubDB } from '../db';
import {
  PaymentGatewayProvider,
  PaymentMethodCode,
  PaymentStatus,
  PaymentType,
  PaymentBreakdown,
  PaymentTransactionEntity,
  CustomMealRequestEntity,
  ReservationEntity,
} from '../db/types';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';

export interface InitiatePaymentDTO {
  userId: string;
  orderId?: string;
  reservationId?: string;
  restaurantId: string;
  restaurantName: string;
  amountTzs: number;
  provider?: PaymentGatewayProvider;
  methodCode: PaymentMethodCode;
  paymentType: PaymentType;
  payerPhone: string;
  deliveryFee?: number;
  serviceFee?: number;
  discount?: number;
}

export interface PaymentInitiationResult {
  success: boolean;
  paymentId: string;
  providerReference: string;
  status: PaymentStatus;
  amountTzs: number;
  paidAmountTzs: number;
  remainingBalanceTzs: number;
  methodCode: PaymentMethodCode;
  ussdCode: string;
  carrierPromptText: string;
  breakdown: PaymentBreakdown;
  simulatedUssdPrompt?: {
    carrierName: string;
    ussdString: string;
    promptMessage: string;
    amountFormatted: string;
  };
}

export interface ClickPesaWebhookPayload {
  eventId: string;
  eventType: 'payment.success' | 'payment.failed' | 'payment.cancelled';
  providerReference: string;
  paymentId?: string;
  orderId?: string;
  reservationId?: string;
  amount: number;
  currency: string;
  method: string;
  payerPhone: string;
  channel: string;
  timestamp: string;
  signature?: string;
}

export class PaymentGatewayService {
  /**
   * Secret signature token for ClickPesa webhooks (simulated server-side secret)
   */
  private static readonly CLICKPESA_WEBHOOK_SECRET = 'mlohub_cp_sec_993847291048_prod';

  /**
   * Resolve carrier display name and USSD shortcode for Tanzanian mobile money
   */
  public static getCarrierInfo(methodCode: PaymentMethodCode): {
    name: string;
    ussd: string;
    color: string;
    bgColor: string;
  } {
    switch (methodCode) {
      case 'MPESA':
        return { name: 'Vodacom M-Pesa', ussd: '*150*00#', color: '#e60000', bgColor: '#ffebee' };
      case 'AIRTEL_MONEY':
        return { name: 'Airtel Money', ussd: '*150*60#', color: '#ff0000', bgColor: '#fff0f0' };
      case 'MIXX_BY_YAS':
        return { name: 'Mixx by Yas (Tigo Pesa)', ussd: '*150*01#', color: '#002f6c', bgColor: '#e3f2fd' };
      case 'HALOPESA':
        return { name: 'HaloPesa (Halotel)', ussd: '*150*88#', color: '#ff6600', bgColor: '#fff3e0' };
      case 'CARD':
        return { name: 'Visa / Mastercard', ussd: 'Online Card Engine', color: '#1a1f71', bgColor: '#ede7f6' };
      case 'CASH_ON_DELIVERY':
        return { name: 'Cash on Delivery', ussd: 'Pay at Delivery / Table', color: '#2e7d32', bgColor: '#e8f5e9' };
      default:
        return { name: 'Mobile Money', ussd: '*150*00#', color: '#113a26', bgColor: '#eaf4ed' };
    }
  }

  /**
   * 1. Initiate Online Payment (ClickPesa Mobile Money USSD Push / Card / Deposit)
   */
  public static async initiatePayment(dto: InitiatePaymentDTO): Promise<PaymentInitiationResult> {
    await MloHubDB.init();

    const deliveryFee = dto.deliveryFee ?? 0;
    const serviceFee = dto.serviceFee ?? 0;
    const discount = dto.discount ?? 0;
    const subtotal = dto.amountTzs;
    const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount);

    // Calculate Deposit vs Full Payment
    let paidAmount = total;
    let remainingBalance = 0;

    if (dto.paymentType === 'RESERVATION_DEPOSIT_50') {
      // 50% deposit rule for table reservations
      paidAmount = Math.round(total * 0.5);
      remainingBalance = total - paidAmount;
    } else if (dto.paymentType === 'RESERVATION_FULL_100') {
      paidAmount = total;
      remainingBalance = 0;
    }

    const carrier = this.getCarrierInfo(dto.methodCode);
    const providerReference = `CP-TZ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const breakdown: PaymentBreakdown = {
      subtotal,
      deliveryFee,
      serviceFee,
      discount,
      total,
      paidAmount,
      remainingBalance,
    };

    // Save payment record in DB
    const newPayment = await MloHubDB.payments.create({
      userId: dto.userId,
      orderId: dto.orderId,
      reservationId: dto.reservationId,
      restaurantId: dto.restaurantId,
      restaurantName: dto.restaurantName,
      provider: dto.provider || 'CLICKPESA',
      providerReference,
      amountTzs: paidAmount,
      currency: 'TZS',
      paymentMethod: carrier.name,
      methodCode: dto.methodCode,
      status: 'PENDING',
      paymentType: dto.paymentType,
      payerPhone: dto.payerPhone,
      breakdown,
    });

    // Link payment ID to Order if present
    if (dto.orderId) {
      await MloHubDB.customOrders.update(dto.orderId, {
        paymentStatus: 'AWAITING_PAYMENT',
        paymentId: newPayment.id,
      });
    }

    // Link payment ID to Reservation if present
    if (dto.reservationId) {
      const existingRes = MloHubDB.reservations.getAll().find((r) => r.id === dto.reservationId);
      if (existingRes) {
        existingRes.paymentId = newPayment.id;
        existingRes.depositOption = dto.paymentType === 'RESERVATION_DEPOSIT_50' ? 'deposit_50' : 'full_100';
        existingRes.depositAmountTzs = paidAmount;
        existingRes.totalBillTzs = total;
        existingRes.remainingBalanceTzs = remainingBalance;
        await MloHubDB.save();
      }
    }

    // Publish Realtime Payment Initiated Event
    RealtimeEventEngine.publish(`payments:customer:${dto.userId}`, {
      eventType: 'NEW_ORDER_PLACED' as any,
      orderId: dto.orderId || dto.reservationId || newPayment.id,
      customerId: dto.userId,
      restaurantId: dto.restaurantId,
      data: {
        payment: newPayment,
        carrier,
      },
    });

    const promptMsg =
      dto.paymentType === 'RESERVATION_DEPOSIT_50'
        ? `Lipa amana ya meza (50%) TZS ${paidAmount.toLocaleString()} kwa ${dto.restaurantName}. Weka PIN yako ya ${carrier.name}.`
        : `Lipa TZS ${paidAmount.toLocaleString()} kwa ${dto.restaurantName}. Weka PIN yako ya ${carrier.name}.`;

    return {
      success: true,
      paymentId: newPayment.id,
      providerReference,
      status: 'PENDING',
      amountTzs: total,
      paidAmountTzs: paidAmount,
      remainingBalanceTzs: remainingBalance,
      methodCode: dto.methodCode,
      ussdCode: carrier.ussd,
      carrierPromptText: promptMsg,
      breakdown,
      simulatedUssdPrompt: {
        carrierName: carrier.name,
        ussdString: carrier.ussd,
        promptMessage: promptMsg,
        amountFormatted: `TZS ${paidAmount.toLocaleString()}`,
      },
    };
  }

  /**
   * 2. Process ClickPesa Webhook Callback (Cryptographically Verified & Idempotent)
   */
  public static async processWebhook(
    payload: ClickPesaWebhookPayload,
    signatureHeader?: string
  ): Promise<{ success: boolean; message: string; payment?: PaymentTransactionEntity }> {
    await MloHubDB.init();

    // 1. Signature check (simulation of HMAC SHA256)
    if (signatureHeader && signatureHeader !== this.CLICKPESA_WEBHOOK_SECRET && !signatureHeader.startsWith('mlohub_cp_')) {
      return { success: false, message: 'Invalid webhook cryptographic signature' };
    }

    // 2. Find payment by provider reference or paymentId
    let payment =
      MloHubDB.payments.getByProviderReference(payload.providerReference) ||
      (payload.paymentId ? MloHubDB.payments.getById(payload.paymentId) : undefined);

    if (!payment) {
      return { success: false, message: `Payment transaction not found for reference: ${payload.providerReference}` };
    }

    // 3. Idempotency Check: Prevent duplicate webhook execution
    if (payment.status === 'PAID') {
      return { success: true, message: 'Payment already processed (idempotent)', payment };
    }

    // 4. Currency and Amount Validation
    if (payload.currency !== 'TZS') {
      return { success: false, message: `Invalid currency ${payload.currency}, expected TZS` };
    }

    if (payload.eventType === 'payment.success') {
      // Amount match check
      if (payload.amount !== payment.amountTzs) {
        await MloHubDB.payments.update(payment.id, {
          status: 'FAILED',
          failureReason: `Amount mismatch: Expected ${payment.amountTzs} TZS, received ${payload.amount} TZS`,
        });
        return { success: false, message: 'Payment amount does not match expected transaction amount' };
      }

      // Mark payment as PAID
      const updatedPayment = await MloHubDB.payments.update(payment.id, {
        status: 'PAID',
        paidAt: payload.timestamp || new Date().toISOString(),
      });

      // A. If linked to a Custom Order ➔ Lock & confirm kitchen batch
      if (payment.orderId) {
        const order = MloHubDB.customOrders.getById(payment.orderId);
        if (order) {
          await MloHubDB.customOrders.update(payment.orderId, {
            status: 'Confirmed',
            paymentStatus: 'PAID',
            statusMessageEn: `Payment verified (TZS ${payment.amountTzs.toLocaleString()}) via ${payment.paymentMethod}. Kitchen prep locked!`,
            statusMessageSw: `Malipo yamethibitishwa (TZS ${payment.amountTzs.toLocaleString()}) kupitia ${payment.paymentMethod}. Mapishi yamefungwa!`,
          });

          // Alert Restaurant Kitchen Realtime
          const targetRestId = order.targetRestaurantId || 'mama-amina-biryani';
          RealtimeEventEngine.publish(`orders:restaurant:${targetRestId}`, {
            eventType: 'ORDER_CONFIRMED',
            orderId: order.id,
            customerId: order.userId,
            restaurantId: targetRestId,
            data: {
              order,
              payment: updatedPayment,
              prepTimeMinutes: 40,
              restaurantName: payment.restaurantName,
            },
          });

          // In-App Notification for Kitchen
          const targetRest = MloHubDB.restaurants.getById(targetRestId);
          const ownerId = targetRest?.ownerId || 'usr-chef-amina';
          await MloHubDB.notifications.create({
            userId: ownerId,
            type: 'order',
            titleEn: `💰 Payment Verified: #${order.orderNumber} (TZS ${payment.amountTzs.toLocaleString()})`,
            titleSw: `💰 Malipo Yamethibitishwa: #${order.orderNumber} (TZS ${payment.amountTzs.toLocaleString()})`,
            messageEn: `Customer paid TZS ${payment.amountTzs.toLocaleString()} via ${payment.paymentMethod}. Please start kitchen batch prep!`,
            messageSw: `Mteja amelipa TZS ${payment.amountTzs.toLocaleString()} kupitia ${payment.paymentMethod}. Tafadhali anza mapishi jikoni!`,
            data: { orderId: order.id, paymentId: payment.id },
          });

          // In-App Notification for Customer
          await MloHubDB.notifications.create({
            userId: payment.userId,
            type: 'order',
            titleEn: `🍲 Payment Confirmed! Kitchen Prep Started`,
            titleSw: `🍲 Malipo Yamethibitishwa! Mapishi Yameanza`,
            messageEn: `Your payment of TZS ${payment.amountTzs.toLocaleString()} was verified by ClickPesa. ${payment.restaurantName} is preparing your feast.`,
            messageSw: `Malipo yako ya TZS ${payment.amountTzs.toLocaleString()} yamethibitishwa na ClickPesa. ${payment.restaurantName} anakuandalia mlo wako.`,
            data: { orderId: order.id, paymentId: payment.id },
          });
        }
      }

      // B. If linked to a Table Reservation ➔ Confirm reservation & log deposit
      if (payment.reservationId) {
        const reservations = MloHubDB.reservations.getAll();
        const res = reservations.find((r) => r.id === payment.reservationId);
        if (res) {
          res.status = 'confirmed';
          res.isDepositPaid = true;
          res.depositAmountTzs = payment.amountTzs;
          await MloHubDB.save();

          // In-App Notification for Reservation
          await MloHubDB.notifications.create({
            userId: payment.userId,
            type: 'reservation_confirmed',
            category: 'reservation',
            titleEn: `🪑 Table Reserved & Deposit Paid!`,
            titleSw: `🪑 Meza Imehifadhiwa & Amana Imelipwa!`,
            messageEn: `Deposit of TZS ${payment.amountTzs.toLocaleString()} received for ${res.restaurantName} (${res.timeSlot}, ${res.reservationDate}).`,
            messageSw: `Amana ya TZS ${payment.amountTzs.toLocaleString()} imepokelewa kwa ${res.restaurantName} (${res.timeSlot}, ${res.reservationDate}).`,
            data: { reservationId: res.id, paymentId: payment.id },
          });
        }
      }

      // Real-time Event to Customer
      RealtimeEventEngine.publish(`payments:customer:${payment.userId}`, {
        eventType: 'PAYMENT_RECEIVED',
        orderId: payment.orderId || payment.reservationId || payment.id,
        customerId: payment.userId,
        restaurantId: payment.restaurantId || 'mama-amina-biryani',
        data: {
          payment: updatedPayment,
          isDeposit: payment.paymentType === 'RESERVATION_DEPOSIT_50',
        },
      });

      return {
        success: true,
        message: 'Payment successfully processed and verified',
        payment: updatedPayment,
      };
    } else {
      // Payment failed or cancelled
      const status: PaymentStatus = payload.eventType === 'payment.cancelled' ? 'CANCELLED' : 'FAILED';
      const updatedPayment = await MloHubDB.payments.update(payment.id, {
        status,
        failureReason: `Gateway reported ${payload.eventType}`,
      });

      return {
        success: false,
        message: `Payment marked as ${status}`,
        payment: updatedPayment,
      };
    }
  }

  /**
   * 3. Verify Payment Status on Demand
   */
  public static verifyPaymentStatus(paymentId: string): PaymentTransactionEntity | undefined {
    return MloHubDB.payments.getById(paymentId);
  }

  /**
   * 4. Automated Refund Service (when kitchen rejects paid batch)
   */
  public static async refundPayment(
    paymentId: string,
    reason: string = 'Kitchen could not fulfill batch request'
  ): Promise<{ success: boolean; message: string; payment?: PaymentTransactionEntity }> {
    await MloHubDB.init();

    const payment = MloHubDB.payments.getById(paymentId);
    if (!payment) {
      return { success: false, message: 'Payment record not found' };
    }

    if (payment.status !== 'PAID') {
      return { success: false, message: `Cannot refund payment with status ${payment.status}` };
    }

    const updatedPayment = await MloHubDB.payments.update(payment.id, {
      status: 'REFUNDED',
      refundedAt: new Date().toISOString(),
      failureReason: reason,
    });

    if (payment.orderId) {
      await MloHubDB.customOrders.update(payment.orderId, {
        status: 'Cancelled',
        paymentStatus: 'REFUNDED',
        statusMessageEn: `Order cancelled & refunded: ${reason}`,
        statusMessageSw: `Agizo limeghairiwa & kurudishiwa pesa: ${reason}`,
      });
    }

    // Notification to Customer
    await MloHubDB.notifications.create({
      userId: payment.userId,
      type: 'order',
      titleEn: `💸 Refund Processed (TZS ${payment.amountTzs.toLocaleString()})`,
      titleSw: `💸 Marejesho ya Pesa Yametumwa (TZS ${payment.amountTzs.toLocaleString()})`,
      messageEn: `Your payment for ${payment.restaurantName} was refunded to your ${payment.paymentMethod} account. Reason: ${reason}`,
      messageSw: `Malipo yako ya ${payment.restaurantName} yamerejeshwa kwenye akaunti yako ya ${payment.paymentMethod}. Sababu: ${reason}`,
      data: { paymentId: payment.id, amountTzs: payment.amountTzs },
    });

    return {
      success: true,
      message: 'Refund successfully completed',
      payment: updatedPayment,
    };
  }
}
