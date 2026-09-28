import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantApplication, ApplicationStatus } from '../types/domain';

export class ApplicationRepository {
  private static mapRowToApplication(row: any): RestaurantApplication {
    const status = (row.status || 'PENDING') as ApplicationStatus;
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
      status,
      rejectionReason: row.rejection_reason || undefined,
      notes: row.notes || undefined,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      restaurantId: row.restaurant_id || row.restaurantId,
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

    return (data || []).map((r) => this.mapRowToApplication(r));
  }

  public static async listMine(ownerEmailOverride?: string): Promise<RestaurantApplication[]> {
    if (!isSupabaseConfigured()) return [];

    let { data: { user } } = await supabase.auth.getUser();
    const cleanEmail = ownerEmailOverride?.trim().toLowerCase();

    if (!user && !cleanEmail) return [];

    let query = supabase.from('restaurant_applications').select('*');

    if (user?.id) {
      if (cleanEmail) {
        query = query.or(`applicant_user_id.eq.${user.id},owner_email.ilike.${cleanEmail}`);
      } else {
        query = query.eq('applicant_user_id', user.id);
      }
    } else if (cleanEmail) {
      query = query.ilike('owner_email', cleanEmail);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('ApplicationRepository.listMine error:', error.message);
      return [];
    }

    const apps = (data || []).map((r) => this.mapRowToApplication(r));

    // Resolve restaurant ID for approved applications if missing on row
    const approvedWithoutRest = apps.find((a) => a.status === 'APPROVED' && !a.restaurantId);
    if (approvedWithoutRest) {
      try {
        let restQuery = supabase
          .from('restaurants')
          .select('id, name, owner_id')
          .ilike('name', approvedWithoutRest.businessName)
          .order('created_at', { ascending: false })
          .limit(1);

        const { data: matchedByName } = await restQuery.maybeSingle();
        if (matchedByName?.id) {
          approvedWithoutRest.restaurantId = matchedByName.id;
        } else if (approvedWithoutRest.applicantUserId || user?.id) {
          const { data: restRow } = await supabase
            .from('restaurants')
            .select('id')
            .eq('owner_id', approvedWithoutRest.applicantUserId || user!.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (restRow?.id) {
            approvedWithoutRest.restaurantId = restRow.id;
          }
        }
      } catch (e) {
        console.warn('[ApplicationRepository] listMine restaurant lookup warning:', e);
      }
    }

    return apps;
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

  public static async submit(
    app: Partial<RestaurantApplication>
  ): Promise<RestaurantApplication> {
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
      return {
        id: app.id || `app_${Date.now()}`,
        applicantUserId: app.applicantUserId || 'mock_user',
        businessName: app.businessName.trim(),
        ownerName: app.ownerName.trim(),
        ownerPhone: app.ownerPhone.trim(),
        ownerEmail: app.ownerEmail?.trim().toLowerCase(),
        cuisineType: app.cuisineType || 'Swahili',
        neighborhood: app.neighborhood || 'Dar es Salaam',
        address: app.address || 'Dar es Salaam',
        hasTinOrLicense: app.hasTinOrLicense ?? false,
        tinNumber: app.tinNumber?.trim() || undefined,
        status: 'SUBMITTED',
        notes: app.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const appId = app.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanEmail = app.ownerEmail?.trim().toLowerCase() || null;

    let { data: { user } } = await supabase.auth.getUser();
    const applicantUserId = app.applicantUserId || user?.id || null;

    const row = {
      id: appId,
      applicant_user_id: applicantUserId,
      business_name: app.businessName.trim(),
      owner_name: app.ownerName.trim(),
      owner_phone: app.ownerPhone.trim(),
      owner_email: cleanEmail,
      cuisine_type: app.cuisineType?.trim() || null,
      neighborhood: app.neighborhood?.trim() || null,
      address: app.address?.trim() || null,
      has_tin_or_license: app.hasTinOrLicense ?? false,
      tin_number: app.tinNumber?.trim() || null,
      status: 'SUBMITTED',
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
    status: ApplicationStatus,
    reviewedBy: string,
    rejectionReason?: string
  ): Promise<RestaurantApplication> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase client is not configured.');
    }

    if (status === 'APPROVED') {
      const { data: rpcData, error: rpcError } = await supabase.rpc('approve_restaurant_application', {
        p_application_id: id,
      });
      if (rpcError) {
        console.error('approve_restaurant_application RPC error:', rpcError.message);
        throw new Error(`Failed to approve application via server RPC: ${rpcError.message}`);
      }
      const restaurantId: string | undefined = rpcData?.restaurant_id ?? undefined;
      const app = await this.getById(id);
      if (!app) throw new Error('Application approved but could not be re-fetched.');

      // Explicitly activate applicant's profile ONLY if they are a CUSTOMER (never downgrade ADMIN)
      if (app.applicantUserId) {
        try {
          await supabase
            .from('profiles')
            .update({
              role: 'RESTAURANT_OWNER',
              active_workspace: 'RESTAURANT_OWNER',
              active_restaurant_id: restaurantId,
              account_type: 'RESTAURANT',
            })
            .eq('id', app.applicantUserId)
            .eq('role', 'CUSTOMER');
        } catch (profErr) {
          console.warn('[ApplicationRepository] Profile role update warning:', profErr);
        }
      }

      // Attach the server-generated restaurant ID so callers can reference the new restaurant
      return { ...app, restaurantId };
    }

    if (status === 'REJECTED') {
      const reasonToUse = rejectionReason || 'Application does not meet platform requirements';
      const { error: rpcError } = await supabase.rpc('reject_restaurant_application', {
        p_application_id: id,
        p_reason: reasonToUse,
      });
      if (rpcError) {
        console.error('reject_restaurant_application RPC error:', rpcError.message);
        throw new Error(`Failed to reject application via server RPC: ${rpcError.message}`);
      }
      const app = await this.getById(id);
      if (!app) throw new Error('Application rejected but could not be re-fetched.');
      return app;
    }

    if (status === 'CHANGES_REQUESTED') {
      const reasonToUse = rejectionReason || 'Corrections required for application approval';
      const { error: rpcError } = await supabase.rpc('request_restaurant_application_changes', {
        p_application_id: id,
        p_reason: reasonToUse,
      });
      if (rpcError) {
        // Fallback to direct row update if RPC migration not yet deployed
        const { data, error } = await supabase
          .from('restaurant_applications')
          .update({
            status: 'CHANGES_REQUESTED',
            rejection_reason: reasonToUse,
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        if (error) {
          throw new Error(`Failed to request changes: ${error.message}`);
        }
        return this.mapRowToApplication(data);
      }
      const app = await this.getById(id);
      if (!app) throw new Error('Application updated but could not be re-fetched.');
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
