import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Reservation,
  ReservationStatus,
  ReservationSlot,
  AreaPreference,
  ReservationRejectionReason,
} from '../types/domain';

export class ReservationRepository {
  private static mapRowToReservation(row: any): Reservation {
    return {
      id: row.id,
      customerId: row.user_id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurants?.name,
      branchId: row.branch_id,
      branchName: row.restaurant_branches?.name,
      partySize: row.party_size,
      scheduledAt: row.scheduled_at,
      slotEndAt: row.slot_end_at,
      reservationDate: row.reservation_date,
      reservationTime: row.reservation_time,
      reference: row.reference,
      tableId: row.table_id,
      tableName: row.restaurant_tables?.label,
      status: row.status || 'CONFIRMED',
      customerNote: row.special_requests,
      restaurantNote: row.restaurant_note,
      rejectionReason: row.rejection_reason,
      confirmationMode: row.confirmation_mode || 'AUTO',
      depositPolicy: row.deposit_policy || 'NONE',
      depositOption: row.deposit_amount_tzs && row.deposit_amount_tzs > 0 ? 'deposit_50' : 'full_100',
      depositAmountTzs: row.deposit_amount_tzs || 0,
      totalBillTzs: row.total_bill_tzs,
      remainingBalanceTzs: row.remaining_balance_tzs,
      isDepositPaid: row.is_deposit_paid ?? false,
      depositDueAt: row.deposit_due_at,
      noShowEligibleAt: row.no_show_eligible_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      paymentId: row.payment_id,
      areaPreference: row.area_preference || 'ANY',
      refundEligibility: row.refund_eligibility || 'NONE',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Authoritative server-calculated availability for requested date & party size.
   */
  public static async getAvailability(params: {
    restaurantId: string;
    branchId: string;
    date: string; // YYYY-MM-DD
    partySize: number;
  }): Promise<ReservationSlot[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase.rpc('get_reservation_availability', {
      p_restaurant_id: params.restaurantId,
      p_branch_id: params.branchId,
      p_date: params.date,
      p_party_size: params.partySize,
    });

    if (error) {
      console.error('ReservationRepository.getAvailability error:', error.message);
      throw new Error(`Failed to check reservation availability: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      slotStart: row.slot_start,
      slotEnd: row.slot_end,
      availableCapacity: row.available_capacity,
      isAvailable: row.is_available,
      depositRequired: row.deposit_required,
      depositAmountTzs: row.deposit_amount_tzs,
      confirmationMode: row.confirmation_mode,
      availabilityStatus: row.availability_status,
    }));
  }

  /**
   * Concurrency-safe, server-authoritative reservation creation.
   */
  public static async createSecure(params: {
    restaurantId: string;
    branchId: string;
    scheduledAt: string; // ISO 8601 string
    partySize: number;
    areaPreference?: AreaPreference;
    specialRequests?: string;
  }): Promise<{
    success: boolean;
    reservationId: string;
    reference: string;
    status: ReservationStatus;
    depositRequired: boolean;
    depositAmountTzs: number;
    depositDueAt?: string;
    scheduledAt: string;
    partySize: number;
    branchId: string;
    tableId?: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('create_reservation_secure', {
      p_restaurant_id: params.restaurantId,
      p_branch_id: params.branchId,
      p_scheduled_at: params.scheduledAt,
      p_party_size: params.partySize,
      p_area_preference: params.areaPreference || 'ANY',
      p_special_requests: params.specialRequests || null,
    });

    if (error) {
      console.error('ReservationRepository.createSecure error:', error.message);
      throw new Error(`Reservation failed: ${error.message}`);
    }

    return {
      success: data.success,
      reservationId: data.reservation_id,
      reference: data.reference,
      status: data.status,
      depositRequired: data.deposit_required,
      depositAmountTzs: data.deposit_amount_tzs,
      depositDueAt: data.deposit_due_at,
      scheduledAt: data.scheduled_at,
      partySize: data.party_size,
      branchId: data.branch_id,
      tableId: data.table_id,
    };
  }

  /**
   * Restaurant operator accepts or rejects a PENDING_RESTAURANT_APPROVAL reservation.
   */
  public static async restaurantDecide(params: {
    reservationId: string;
    decision: 'ACCEPT' | 'REJECT';
    rejectionReason?: ReservationRejectionReason | string;
    tableId?: string;
  }): Promise<{
    success: boolean;
    status: ReservationStatus;
    reservationId: string;
    tableId?: string;
    depositDueAt?: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('restaurant_decide_reservation', {
      p_reservation_id: params.reservationId,
      p_decision: params.decision,
      p_rejection_reason: params.rejectionReason || null,
      p_table_id: params.tableId || null,
    });

    if (error) {
      console.error('ReservationRepository.restaurantDecide error:', error.message);
      throw new Error(`Failed to decide reservation: ${error.message}`);
    }

    return {
      success: data.success,
      status: data.status,
      reservationId: data.reservation_id,
      tableId: data.table_id,
      depositDueAt: data.deposit_due_at,
    };
  }

  /**
   * Restaurant transitions attendance: SEATED, COMPLETED, NO_SHOW.
   */
  public static async transitionAttendance(
    reservationId: string,
    nextStatus: 'SEATED' | 'COMPLETED' | 'NO_SHOW'
  ): Promise<{
    success: boolean;
    status: ReservationStatus;
    reservationId: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('transition_reservation_attendance', {
      p_reservation_id: reservationId,
      p_next_status: nextStatus,
    });

    if (error) {
      console.error('ReservationRepository.transitionAttendance error:', error.message);
      throw new Error(`Failed to transition attendance: ${error.message}`);
    }

    return {
      success: data.success,
      status: data.status,
      reservationId: data.reservation_id,
    };
  }

  /**
   * Cancel a reservation with server-authoritative ownership and policy validation.
   */
  public static async cancelSecure(
    reservationId: string,
    cancellationReason?: string
  ): Promise<{
    success: boolean;
    status: ReservationStatus;
    reservationId: string;
    refundEligibility: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('cancel_reservation_secure', {
      p_reservation_id: reservationId,
      p_cancellation_reason: cancellationReason || null,
    });

    if (error) {
      console.error('ReservationRepository.cancelSecure error:', error.message);
      throw new Error(`Failed to cancel reservation: ${error.message}`);
    }

    return {
      success: data.success,
      status: data.status,
      reservationId: data.reservation_id,
      refundEligibility: data.refund_eligibility,
    };
  }

  public static async listByCustomer(customerId: string): Promise<Reservation[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('reservations')
      .select('*, restaurants(name), restaurant_branches(name), restaurant_tables(label)')
      .eq('user_id', customerId)
      .order('scheduled_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error(`ReservationRepository.listByCustomer error:`, error.message);
      throw new Error(`Failed to list customer reservations: ${error.message}`);
    }

    return (data || []).map(this.mapRowToReservation);
  }

  public static async listByRestaurant(restaurantId: string): Promise<Reservation[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('reservations')
      .select('*, restaurants(name), restaurant_branches(name), restaurant_tables(label)')
      .eq('restaurant_id', restaurantId)
      .order('scheduled_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error(`ReservationRepository.listByRestaurant error:`, error.message);
      throw new Error(`Failed to list restaurant reservations: ${error.message}`);
    }

    return (data || []).map(this.mapRowToReservation);
  }

  public static async getById(reservationId: string): Promise<Reservation | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('reservations')
      .select('*, restaurants(name), restaurant_branches(name), restaurant_tables(label)')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) {
      console.error(`ReservationRepository.getById error:`, error.message);
      throw new Error(`Failed to fetch reservation: ${error.message}`);
    }

    return data ? this.mapRowToReservation(data) : null;
  }

  public static async create(res: Partial<Reservation>): Promise<Reservation> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      id: res.id || `res_${Date.now()}`,
      user_id: res.customerId,
      restaurant_id: res.restaurantId,
      branch_id: res.branchId,
      party_size: res.partySize || 2,
      reservation_date: res.reservationDate || new Date().toISOString().split('T')[0],
      reservation_time: res.reservationTime || '07:30 PM',
      status: res.status || 'CONFIRMED',
      deposit_amount_tzs: res.depositAmountTzs || 0,
      is_deposit_paid: res.isDepositPaid ?? false,
      special_requests: res.customerNote,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert(row)
      .select('*, restaurants(name), restaurant_branches(name), restaurant_tables(label)')
      .single();

    if (error) {
      console.error('ReservationRepository.create error:', error.message);
      throw new Error(`Failed to create reservation: ${error.message}`);
    }

    return this.mapRowToReservation(data);
  }

  public static async cancel(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    try {
      await this.cancelSecure(id);
      return true;
    } catch {
      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error(`ReservationRepository.cancel(${id}) error:`, error.message);
        throw new Error(`Failed to cancel reservation: ${error.message}`);
      }
      return true;
    }
  }

  public static async updateStatus(id: string, nextStatus: ReservationStatus): Promise<Reservation> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    try {
      if (nextStatus === 'CONFIRMED') {
        await this.restaurantDecide({ reservationId: id, decision: 'ACCEPT' });
      } else if (nextStatus === 'REJECTED') {
        await this.restaurantDecide({ reservationId: id, decision: 'REJECT' });
      } else if (nextStatus === 'SEATED' || nextStatus === 'COMPLETED' || nextStatus === 'NO_SHOW') {
        await this.transitionAttendance(id, nextStatus as any);
      } else if (nextStatus === 'CANCELLED') {
        await this.cancelSecure(id);
      } else {
        const { error } = await supabase
          .from('reservations')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
    } catch {
      const { error } = await supabase
        .from('reservations')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }

    const updated = await this.getById(id);
    if (!updated) throw new Error(`Reservation ${id} not found after update`);
    return updated;
  }
}
