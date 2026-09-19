import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  BranchOperationalMode,
  BranchServiceType,
  BranchOperatingHour,
  BranchScheduleOverride,
  BranchDeliveryZone,
  KitchenCapacityBucket,
  RestaurantOperationalAuditLog,
  BranchOperationalStatus,
} from '../types/domain';

export class BranchOperationsRepository {
  /**
   * Evaluates branch operational status server-side via PostgreSQL RPC.
   * Checks operational_mode, temporary pause expiry, weekly hours, date overrides, and dayparts.
   */
  public static async getBranchOperationalStatus(
    branchId: string,
    serviceType: BranchServiceType = 'PICKUP'
  ): Promise<BranchOperationalStatus> {
    if (!isSupabaseConfigured()) {
      return { available: true, mode: 'OPEN', estimatedPrepMinutes: 25 };
    }

    const { data, error } = await supabase.rpc('get_branch_operational_status', {
      p_branch_id: branchId,
      p_service_type: serviceType,
    });

    if (error) {
      console.error(`BranchOperationsRepository.getBranchOperationalStatus error:`, error.message);
      throw new Error(`Failed to check branch operational status: ${error.message}`);
    }

    return {
      available: data?.available ?? false,
      reason: data?.reason,
      pauseReason: data?.pause_reason,
      pausedUntil: data?.paused_until,
      mode: data?.mode,
      estimatedPrepMinutes: data?.estimated_prep_minutes,
      busyDelayMinutes: data?.busy_delay_minutes,
      timezone: data?.timezone,
      opensAt: data?.opens_at,
      closesAt: data?.closes_at,
      reasonCode: data?.reason_code,
    };
  }

  /**
   * Sets branch operational mode (OPEN, BUSY, PAUSED, CLOSED) with authorization check and audit trail.
   */
  public static async setBranchOperationalMode(
    branchId: string,
    mode: BranchOperationalMode,
    pauseDurationMinutes: number | null = null,
    pauseReason: string | null = null,
    busyDelayMinutes: number | null = null
  ): Promise<{ success: boolean; operationalMode: BranchOperationalMode; pausedUntil?: string }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const { data, error } = await supabase.rpc('set_branch_operational_mode_secure', {
      p_branch_id: branchId,
      p_mode: mode,
      p_pause_duration_minutes: pauseDurationMinutes,
      p_pause_reason: pauseReason,
      p_busy_delay_minutes: busyDelayMinutes,
    });

    if (error) {
      console.error(`BranchOperationsRepository.setBranchOperationalMode error:`, error.message);
      throw new Error(`Failed to update operational mode: ${error.message}`);
    }

    return {
      success: data?.success ?? true,
      operationalMode: data?.operational_mode ?? mode,
      pausedUntil: data?.paused_until,
    };
  }

  /**
   * Retrieves structured weekly operating hours for a branch.
   */
  public static async getOperatingHours(branchId: string): Promise<BranchOperatingHour[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('branch_operating_hours')
      .select('*')
      .eq('branch_id', branchId)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error(`BranchOperationsRepository.getOperatingHours error:`, error.message);
      throw new Error(`Failed to load operating hours: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      dayOfWeek: row.day_of_week,
      serviceType: row.service_type,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Upserts operating hours schedule for a branch.
   */
  public static async upsertOperatingHours(
    branchId: string,
    hours: Array<{
      dayOfWeek: number;
      serviceType?: BranchServiceType;
      opensAt: string;
      closesAt: string;
      isClosed?: boolean;
    }>
  ): Promise<BranchOperatingHour[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const rows = hours.map((h) => ({
      branch_id: branchId,
      day_of_week: h.dayOfWeek,
      service_type: h.serviceType || 'PICKUP',
      opens_at: h.opensAt,
      closes_at: h.closesAt,
      is_closed: h.isClosed ?? false,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('branch_operating_hours')
      .upsert(rows, { onConflict: 'branch_id,day_of_week,service_type' })
      .select();

    if (error) {
      console.error(`BranchOperationsRepository.upsertOperatingHours error:`, error.message);
      throw new Error(`Failed to save operating hours: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      dayOfWeek: row.day_of_week,
      serviceType: row.service_type,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Retrieves special schedule overrides (holidays, maintenance, special openings).
   */
  public static async getScheduleOverrides(
    branchId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<BranchScheduleOverride[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('branch_schedule_overrides')
      .select('*')
      .eq('branch_id', branchId);

    if (dateFrom) query = query.gte('override_date', dateFrom);
    if (dateTo) query = query.lte('override_date', dateTo);

    const { data, error } = await query.order('override_date', { ascending: true });

    if (error) {
      console.error(`BranchOperationsRepository.getScheduleOverrides error:`, error.message);
      throw new Error(`Failed to load schedule overrides: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      overrideDate: row.override_date,
      serviceType: row.service_type,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      isClosed: row.is_closed,
      reasonCode: row.reason_code,
      noteInternal: row.note_internal,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Adds or updates a special schedule override.
   */
  public static async upsertScheduleOverride(
    override: {
      branchId: string;
      overrideDate: string;
      serviceType?: BranchServiceType;
      opensAt?: string | null;
      closesAt?: string | null;
      isClosed?: boolean;
      reasonCode?: string;
      noteInternal?: string | null;
    }
  ): Promise<BranchScheduleOverride> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      branch_id: override.branchId,
      override_date: override.overrideDate,
      service_type: override.serviceType || 'PICKUP',
      opens_at: override.opensAt || null,
      closes_at: override.closesAt || null,
      is_closed: override.isClosed ?? false,
      reason_code: override.reasonCode || 'SPECIAL_EVENT',
      note_internal: override.noteInternal || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('branch_schedule_overrides')
      .upsert(row, { onConflict: 'branch_id,override_date,service_type' })
      .select()
      .single();

    if (error) {
      console.error(`BranchOperationsRepository.upsertScheduleOverride error:`, error.message);
      throw new Error(`Failed to save schedule override: ${error.message}`);
    }

    return {
      id: data.id,
      branchId: data.branch_id,
      overrideDate: data.override_date,
      serviceType: data.service_type,
      opensAt: data.opens_at,
      closesAt: data.closes_at,
      isClosed: data.is_closed,
      reasonCode: data.reason_code,
      noteInternal: data.note_internal,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Deletes a special schedule override.
   */
  public static async deleteScheduleOverride(overrideId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('branch_schedule_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      console.error(`BranchOperationsRepository.deleteScheduleOverride error:`, error.message);
      throw new Error(`Failed to delete override: ${error.message}`);
    }

    return true;
  }

  /**
   * Retrieves restaurant-managed delivery zones for a branch.
   */
  public static async getDeliveryZones(branchId: string): Promise<BranchDeliveryZone[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('branch_delivery_zones')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('fee_tzs', { ascending: true });

    if (error) {
      console.error(`BranchOperationsRepository.getDeliveryZones error:`, error.message);
      throw new Error(`Failed to load delivery zones: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      zoneName: row.zone_name,
      feeTzs: row.fee_tzs,
      minimumOrderTzs: row.minimum_order_tzs,
      estimatedDeliveryMinutes: row.estimated_delivery_minutes,
      supportedWards: row.supported_wards || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Upserts a restaurant-managed delivery zone.
   */
  public static async upsertDeliveryZone(
    zone: {
      branchId: string;
      zoneName: string;
      feeTzs: number;
      minimumOrderTzs?: number;
      estimatedDeliveryMinutes?: number;
      supportedWards?: string[];
      isActive?: boolean;
    }
  ): Promise<BranchDeliveryZone> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    const row = {
      branch_id: zone.branchId,
      zone_name: zone.zoneName,
      fee_tzs: zone.feeTzs,
      minimum_order_tzs: zone.minimumOrderTzs ?? 0,
      estimated_delivery_minutes: zone.estimatedDeliveryMinutes ?? 30,
      supported_wards: zone.supportedWards || [],
      is_active: zone.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('branch_delivery_zones')
      .upsert(row, { onConflict: 'branch_id,zone_name' })
      .select()
      .single();

    if (error) {
      console.error(`BranchOperationsRepository.upsertDeliveryZone error:`, error.message);
      throw new Error(`Failed to save delivery zone: ${error.message}`);
    }

    return {
      id: data.id,
      branchId: data.branch_id,
      zoneName: data.zone_name,
      feeTzs: data.fee_tzs,
      minimumOrderTzs: data.minimum_order_tzs,
      estimatedDeliveryMinutes: data.estimated_delivery_minutes,
      supportedWards: data.supported_wards,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Retrieves operational audit logs for a restaurant or branch.
   */
  public static async getAuditLogs(
    restaurantId: string,
    branchId?: string,
    limit: number = 50
  ): Promise<RestaurantOperationalAuditLog[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase
      .from('restaurant_operational_audit_logs')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`BranchOperationsRepository.getAuditLogs error:`, error.message);
      throw new Error(`Failed to load audit logs: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      branchId: row.branch_id,
      action: row.action,
      actorUserId: row.actor_user_id,
      actorRole: row.actor_role,
      reason: row.reason,
      beforeState: row.before_state,
      afterState: row.after_state,
      createdAt: row.created_at,
    }));
  }
}
