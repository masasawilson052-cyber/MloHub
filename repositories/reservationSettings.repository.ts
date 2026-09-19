import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ReservationSettings } from '../types/domain';

export class ReservationSettingsRepository {
  private static mapRowToSettings(row: any): ReservationSettings {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      reservationsEnabled: row.reservations_enabled ?? true,
      capacityMode: row.capacity_mode || 'CAPACITY_ONLY',
      confirmationMode: row.confirmation_mode || 'AUTO',
      slotDurationMinutes: row.slot_duration_minutes ?? 30,
      minimumAdvanceMinutes: row.minimum_advance_minutes ?? 60,
      maximumAdvanceDays: row.maximum_advance_days ?? 30,
      minimumPartySize: row.minimum_party_size ?? 1,
      maximumPartySize: row.maximum_party_size ?? 20,
      defaultSlotCapacity: row.default_slot_capacity ?? 20,
      gracePeriodMinutes: row.grace_period_minutes ?? 20,
      turnTimeMinutes: row.turn_time_minutes ?? 90,
      depositPolicy: row.deposit_policy || 'NONE',
      depositFixedTzs: row.deposit_fixed_tzs ?? 0,
      depositPercentage: Number(row.deposit_percentage || 0),
      depositDueMinutes: row.deposit_due_minutes ?? 30,
      allowSameDay: row.allow_same_day ?? true,
      acceptsWalkIns: row.accepts_walk_ins ?? true,
      autoExpirePendingMinutes: row.auto_expire_pending_minutes ?? 30,
      freeCancellationBeforeMinutes: row.free_cancellation_before_minutes ?? 120,
      lateCancellationBehavior: row.late_cancellation_behavior || 'MANUAL_REVIEW',
      noShowBehavior: row.no_show_behavior || 'RECORD_ONLY',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async getByBranch(branchId: string): Promise<ReservationSettings | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('reservation_settings')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      console.error('ReservationSettingsRepository.getByBranch error:', error.message);
      throw new Error(`Failed to load reservation settings: ${error.message}`);
    }

    return data ? this.mapRowToSettings(data) : null;
  }

  public static async upsert(settings: Partial<ReservationSettings> & { restaurantId: string; branchId: string }): Promise<ReservationSettings> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const payload: any = {
      restaurant_id: settings.restaurantId,
      branch_id: settings.branchId,
      reservations_enabled: settings.reservationsEnabled ?? true,
      capacity_mode: settings.capacityMode ?? 'CAPACITY_ONLY',
      confirmation_mode: settings.confirmationMode ?? 'AUTO',
      slot_duration_minutes: settings.slotDurationMinutes ?? 30,
      minimum_advance_minutes: settings.minimumAdvanceMinutes ?? 60,
      maximum_advance_days: settings.maximumAdvanceDays ?? 30,
      minimum_party_size: settings.minimumPartySize ?? 1,
      maximum_party_size: settings.maximumPartySize ?? 20,
      default_slot_capacity: settings.defaultSlotCapacity ?? 20,
      grace_period_minutes: settings.gracePeriodMinutes ?? 20,
      turn_time_minutes: settings.turnTimeMinutes ?? 90,
      deposit_policy: settings.depositPolicy ?? 'NONE',
      deposit_fixed_tzs: settings.depositFixedTzs ?? 0,
      deposit_percentage: settings.depositPercentage ?? 0,
      deposit_due_minutes: settings.depositDueMinutes ?? 30,
      allow_same_day: settings.allowSameDay ?? true,
      accepts_walk_ins: settings.acceptsWalkIns ?? true,
      auto_expire_pending_minutes: settings.autoExpirePendingMinutes ?? 30,
      free_cancellation_before_minutes: settings.freeCancellationBeforeMinutes ?? 120,
      late_cancellation_behavior: settings.lateCancellationBehavior ?? 'MANUAL_REVIEW',
      no_show_behavior: settings.noShowBehavior ?? 'RECORD_ONLY',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reservation_settings')
      .upsert(payload, { onConflict: 'branch_id' })
      .select('*')
      .single();

    if (error) {
      console.error('ReservationSettingsRepository.upsert error:', error.message);
      throw new Error(`Failed to save reservation settings: ${error.message}`);
    }

    return this.mapRowToSettings(data);
  }
}
