import { ReservationRepository } from '../repositories/reservations.repository';
import { NotificationRepository } from '../repositories/notifications.repository';
import { isSupabaseConfigured } from '../lib/supabase';
import { Reservation, ReservationStatus } from '../types/domain';
import { RealtimeEventEngine } from '../db/realtime/eventEngine';
import { MloHubDB } from '../db';

export interface CreateReservationDTO {
  customerId: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  partySize: number;
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // e.g. "07:30 PM"
  customerNote?: string;
  depositOption: 'deposit_50' | 'full_100';
  perPersonDepositTzs?: number;
}

export class ReservationService {
  /**
   * Create a dining reservation with optional 50% advance deposit calculation
   */
  public static async createReservation(dto: CreateReservationDTO): Promise<Reservation> {
    const depositPerPerson = dto.perPersonDepositTzs || 10000;
    const fullDepositTotal = depositPerPerson * dto.partySize;
    const requiredDepositAmount = dto.depositOption === 'deposit_50' ? Math.round(fullDepositTotal * 0.5) : fullDepositTotal;

    if (isSupabaseConfigured()) {
      const reservationData: Partial<Reservation> = {
        customerId: dto.customerId,
        restaurantId: dto.restaurantId,
        branchId: dto.branchId,
        partySize: dto.partySize,
        reservationDate: dto.reservationDate,
        reservationTime: dto.reservationTime,
        status: 'CONFIRMED',
        customerNote: dto.customerNote,
        depositOption: dto.depositOption,
        depositAmountTzs: requiredDepositAmount,
        isDepositPaid: false,
      };

      const created = await ReservationRepository.create(reservationData);

      try {
        await NotificationRepository.createNotification({
          userId: dto.customerId,
          type: 'reservation',
          category: 'ORDER',
          titleEn: `Table Reserved at ${dto.restaurantName || 'Restaurant'}!`,
          titleSw: `Meza Imewekwa ${dto.restaurantName || 'Jikoni'}!`,
          messageEn: `Party of ${dto.partySize} on ${dto.reservationDate} at ${dto.reservationTime}.`,
          messageSw: `Watu ${dto.partySize} tarehe ${dto.reservationDate} saa ${dto.reservationTime}.`,
          restaurantId: dto.restaurantId,
        });
      } catch (err) {
        console.warn('Failed to send notification for reservation:', err);
      }

      RealtimeEventEngine.publish(`reservations:customer:${dto.customerId}`, {
        eventType: 'STATUS_UPDATED',
        customerId: dto.customerId,
        restaurantId: dto.restaurantId,
        data: { reservation: created },
      });

      return created;
    }

    // Mock fallback
    await MloHubDB.init();
    const mock = await MloHubDB.reservations.create({
      userId: dto.customerId,
      restaurantId: dto.restaurantId,
      restaurantName: dto.restaurantName || 'Restaurant',
      reservationDate: dto.reservationDate,
      timeSlot: dto.reservationTime,
      guestsCount: `${dto.partySize} Guests`,
      address: 'Mikocheni, Dar es Salaam',
      depositAmountTzs: requiredDepositAmount,
      depositOption: dto.depositOption,
      specialNotes: dto.customerNote,
      status: 'confirmed',
    });

    return {
      id: mock.id,
      customerId: dto.customerId,
      restaurantId: dto.restaurantId,
      partySize: dto.partySize,
      reservationDate: dto.reservationDate,
      reservationTime: dto.reservationTime,
      status: 'CONFIRMED',
      customerNote: dto.customerNote,
      depositOption: dto.depositOption,
      depositAmountTzs: requiredDepositAmount,
      isDepositPaid: false,
      createdAt: mock.createdAt,
      updatedAt: mock.createdAt,
    };
  }

  /**
   * Cancel reservation
   */
  public static async cancelReservation(reservationId: string, customerId?: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const success = await ReservationRepository.cancel(reservationId);
      if (customerId) {
        RealtimeEventEngine.publish(`reservations:customer:${customerId}`, {
          eventType: 'STATUS_UPDATED',
          customerId,
          data: { reservationId, status: 'CANCELLED' },
        });
      }
      return success;
    }

    await MloHubDB.init();
    return MloHubDB.reservations.cancel(reservationId);
  }

  /**
   * List reservations for customer
   */
  public static async listCustomerReservations(customerId: string): Promise<Reservation[]> {
    if (isSupabaseConfigured()) {
      return ReservationRepository.listByCustomer(customerId);
    }
    return [];
  }

  /**
   * List reservations for restaurant
   */
  public static async listRestaurantReservations(restaurantId: string): Promise<Reservation[]> {
    if (isSupabaseConfigured()) {
      return ReservationRepository.listByRestaurant(restaurantId);
    }
    return [];
  }
}
