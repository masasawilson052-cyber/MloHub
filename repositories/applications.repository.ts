import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantApplication } from '../types/domain';

export class ApplicationRepository {
  private static mapRowToApplication(row: any): RestaurantApplication {
    return {
      id: row.id,
      applicantUserId: row.applicant_user_id,
      businessName: row.business_name,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      ownerEmail: row.owner_email,
      cuisineType: row.cuisine_type || '',
      neighborhood: row.neighborhood || '',
      address: row.address || '',
      businessType: row.business_type,
      hasTinOrLicense: row.has_tin_or_license ?? false,
      tinNumber: row.tin_number,
      licenseNumber: row.business_license_number,
      status: row.status || 'PENDING',
      rejectionReason: row.rejection_reason || row.notes,
      notes: row.notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  public static async listAll(status?: string): Promise<RestaurantApplication[]> {
    if (!isSupabaseConfigured()) return [];

    let query = supabase.from('restaurant_applications').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('ApplicationRepository.listAll error:', error.message);
      throw new Error(`Failed to list applications: ${error.message}`);
    }

    return (data || []).map(this.mapRowToApplication);
  }

  public static async listMine(): Promise<RestaurantApplication[]> {
    if (!isSupabaseConfigured()) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('restaurant_applications')
      .select('*')
      .eq('applicant_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ApplicationRepository.listMine error:', error.message);
      throw new Error(`Failed to list your applications: ${error.message}`);
    }

    return (data || []).map(this.mapRowToApplication);
  }

  public static async getById(id: string): Promise<RestaurantApplication | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('restaurant_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`ApplicationRepository.getById(${id}) error:`, error.message);
      throw new Error(`Failed to find application: ${error.message}`);
    }

    return data ? this.mapRowToApplication(data) : null;
  }

  public static async submit(app: Partial<RestaurantApplication>): Promise<RestaurantApplication> {
    if (!app.businessName?.trim()) {
      throw new Error('Business name is required.');
    }
    if (!app.ownerName?.trim()) {
      throw new Error('Owner name is required.');
    }
    if (!app.ownerPhone?.trim()) {
      throw new Error('Owner phone number is required.');
    }

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    let applicantUserId = app.applicantUserId;
    if (!applicantUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      applicantUserId = user?.id;
    }

    if (!applicantUserId) {
      throw new Error('Authenticated user session required to submit restaurant application.');
    }

    const row = {
      id: app.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      applicant_user_id: applicantUserId,
      business_name: app.businessName.trim(),
      owner_name: app.ownerName.trim(),
      owner_phone: app.ownerPhone.trim(),
      owner_email: app.ownerEmail?.trim() || null,
      cuisine_type: app.cuisineType?.trim() || null,
      neighborhood: app.neighborhood?.trim() || null,
      address: app.address?.trim() || null,
      has_tin_or_license: app.hasTinOrLicense ?? false,
      tin_number: app.tinNumber?.trim() || null,
      status: 'PENDING',
      notes: app.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('restaurant_applications')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('ApplicationRepository.submit error:', error.message);
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    return this.mapRowToApplication(data);
  }

  public static async updateStatus(
    id: string,
    status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    rejectionReason?: string
  ): Promise<RestaurantApplication> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    if (status === 'APPROVED') {
      const { error: rpcError } = await supabase.rpc('approve_restaurant_application', {
        p_application_id: id,
      });
      if (rpcError) {
        console.error('approve_restaurant_application RPC error:', rpcError.message);
        throw new Error(`Failed to approve application via server RPC: ${rpcError.message}`);
      }
      const app = await this.getById(id);
      if (!app) throw new Error('Application approved but could not be re-fetched.');
      return app;
    }

    if (status === 'REJECTED') {
      const { error: rpcError } = await supabase.rpc('reject_restaurant_application', {
        p_application_id: id,
        p_reason: rejectionReason || 'Application does not meet platform requirements',
      });
      if (rpcError) {
        console.error('reject_restaurant_application RPC error:', rpcError.message);
        throw new Error(`Failed to reject application via server RPC: ${rpcError.message}`);
      }
      const app = await this.getById(id);
      if (!app) throw new Error('Application rejected but could not be re-fetched.');
      return app;
    }

    const updates: any = {
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (rejectionReason) {
      updates.rejection_reason = rejectionReason;
      updates.notes = rejectionReason;
    }

    const { data, error } = await supabase
      .from('restaurant_applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`ApplicationRepository.updateStatus(${id}) error:`, error.message);
      throw new Error(`Failed to update application status: ${error.message}`);
    }

    return this.mapRowToApplication(data);
  }
}
