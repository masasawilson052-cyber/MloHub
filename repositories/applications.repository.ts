import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RestaurantApplication } from '../types/domain';
import { RestaurantCredentialsService, RestaurantCredentialRecord } from '../lib/restaurantCredentials';

export class ApplicationRepository {
  private static mapRowToApplication(row: any): RestaurantApplication {
    const { cleanNotes, credHash } = RestaurantCredentialsService.extractHashAndCleanNotes(row.notes);
    const status = row.status || 'PENDING';
    const mapped: RestaurantApplication = {
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
      rejectionReason: row.rejection_reason || (status === 'REJECTED' ? cleanNotes : undefined),
      notes: cleanNotes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      restaurantId: row.restaurant_id || row.restaurantId,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };

    if (mapped.ownerEmail) {
      void RestaurantCredentialsService.syncFromApplicationRow(mapped, credHash);
    }

    return mapped;
  }

  private static mapCredentialRecordToApplication(rec: RestaurantCredentialRecord): RestaurantApplication {
    return {
      id: rec.applicationId,
      applicantUserId: rec.applicantUserId,
      businessName: rec.businessName,
      ownerName: rec.ownerName,
      ownerPhone: rec.ownerPhone,
      ownerEmail: rec.email,
      cuisineType: rec.cuisineType || '',
      neighborhood: rec.neighborhood || '',
      address: rec.address || '',
      hasTinOrLicense: rec.hasTinOrLicense ?? false,
      tinNumber: rec.tinNumber,
      status: rec.status || 'PENDING',
      rejectionReason: rec.rejectionReason,
      notes: rec.notes,
      restaurantId: rec.restaurantId,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    };
  }

  public static async flushPendingQueue(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const unsynced = await RestaurantCredentialsService.getUnsyncedApplications();
      if (unsynced.length === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const item of unsynced) {
        try {
          const row = {
            id: item.applicationId,
            applicant_user_id: user.id,
            business_name: item.businessName,
            owner_name: item.ownerName,
            owner_phone: item.ownerPhone,
            owner_email: item.email || null,
            cuisine_type: item.cuisineType || null,
            neighborhood: item.neighborhood || null,
            address: item.address || null,
            has_tin_or_license: item.hasTinOrLicense ?? false,
            tin_number: item.tinNumber || null,
            status: item.status || 'PENDING',
            notes: RestaurantCredentialsService.embedHashInNotes(item.notes, item.passwordHash),
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabase
            .from('restaurant_applications')
            .upsert(row, { onConflict: 'id' });
          if (!error) {
            await RestaurantCredentialsService.markApplicationSynced(item.applicationId, user.id);
          }
        } catch (flushErr) {
          console.warn('[ApplicationRepository] Pending queue item flush warning:', flushErr);
        }
      }
    } catch (e) {
      console.warn('[ApplicationRepository] flushPendingQueue warning:', e);
    }
  }

  public static async listAll(status?: string): Promise<RestaurantApplication[]> {
    if (!isSupabaseConfigured()) return [];

    await this.flushPendingQueue();

    let query = supabase.from('restaurant_applications').select('*');

    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('ApplicationRepository.listAll error:', error.message);
      throw new Error(`Failed to list applications: ${error.message}`);
    }

    const remoteApps = (data || []).map((r) => this.mapRowToApplication(r));
    const unsynced = await RestaurantCredentialsService.getUnsyncedApplications();
    const remoteIds = new Set(remoteApps.map((a) => a.id));
    for (const localRec of unsynced) {
      if (!remoteIds.has(localRec.applicationId)) {
        if (!status || status === 'ALL' || localRec.status === status) {
          remoteApps.unshift(this.mapCredentialRecordToApplication(localRec));
        }
      }
    }

    return remoteApps;
  }

  public static async listMine(ownerEmailOverride?: string): Promise<RestaurantApplication[]> {
    if (!isSupabaseConfigured()) return [];

    await this.flushPendingQueue();

    const activeRestEmail =
      ownerEmailOverride?.trim().toLowerCase() ||
      (await RestaurantCredentialsService.getActiveRestaurantLoginEmail());

    let { data: { user } } = await supabase.auth.getUser();
    if (!user && activeRestEmail) {
      await RestaurantCredentialsService.ensureSupabaseBridgeSession(supabase);
      const retryUser = await supabase.auth.getUser();
      user = retryUser.data.user;
    }

    let apps: RestaurantApplication[] = [];

    if (user) {
      const { data, error } = await supabase
        .from('restaurant_applications')
        .select('*')
        .eq('applicant_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ApplicationRepository.listMine error:', error.message);
      } else if (data) {
        apps = data.map((r) => this.mapRowToApplication(r));
      }

      // If we are looking for a specific restaurant email (e.g. logged in as restaurant owner),
      // also check by owner_email in case applicant_user_id was bound to a different session
      const targetEmail = activeRestEmail || user.email?.toLowerCase();
      if (targetEmail) {
        const emailMatched = apps.filter(
          (a) => a.ownerEmail && a.ownerEmail.trim().toLowerCase() === targetEmail
        );
        if (emailMatched.length > 0) {
          apps = emailMatched;
        } else {
          try {
            const { data: byEmailData } = await supabase
              .from('restaurant_applications')
              .select('*')
              .ilike('owner_email', targetEmail)
              .order('created_at', { ascending: false });
            if (byEmailData && byEmailData.length > 0) {
              apps = byEmailData.map((r) => this.mapRowToApplication(r));
            } else if (activeRestEmail) {
              // Do not leak another applicant's applications when logged in with a specific restaurant email
              apps = [];
            }
          } catch {}
        }
      }
    }

    // Merge / fallback to locally synced credential record for this restaurant email
    if (apps.length === 0 && activeRestEmail) {
      const localRec = await RestaurantCredentialsService.getRecordByEmail(activeRestEmail);
      if (localRec) {
        apps = [this.mapCredentialRecordToApplication(localRec)];
      }
    }

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
        if (approvedWithoutRest.restaurantId && approvedWithoutRest.ownerEmail) {
          await RestaurantCredentialsService.saveCredentialRecord({
            email: approvedWithoutRest.ownerEmail,
            applicationId: approvedWithoutRest.id,
            restaurantId: approvedWithoutRest.restaurantId,
            status: 'APPROVED',
          });
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
    app: Partial<RestaurantApplication> & { passwordHash?: string }
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
      throw new Error('Supabase client is not configured.');
    }

    const appId = app.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cleanEmail = app.ownerEmail?.trim().toLowerCase() || '';

    // Save credential record locally first so login credentials are never lost
    let existingRec = cleanEmail ? await RestaurantCredentialsService.getRecordByEmail(cleanEmail) : null;
    const passwordHash = app.passwordHash || existingRec?.passwordHash;

    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await RestaurantCredentialsService.ensureSupabaseBridgeSession(supabase);
      const retryAuth = await supabase.auth.getUser();
      user = retryAuth.data.user;
    }

    if (!user) {
      // Queue locally for automatic sync on next authenticated session so submission never fails
      const queued = await RestaurantCredentialsService.saveCredentialRecord({
        email: cleanEmail || app.ownerPhone.trim(),
        passwordHash,
        applicationId: appId,
        businessName: app.businessName.trim(),
        ownerName: app.ownerName.trim(),
        ownerPhone: app.ownerPhone.trim(),
        cuisineType: app.cuisineType?.trim() || 'Swahili',
        neighborhood: app.neighborhood?.trim() || 'Dar es Salaam',
        address: app.address?.trim() || 'Dar es Salaam',
        hasTinOrLicense: app.hasTinOrLicense ?? false,
        tinNumber: app.tinNumber?.trim() || undefined,
        notes: app.notes?.trim() || undefined,
        status: 'PENDING',
        syncedToServer: false,
      });
      return this.mapCredentialRecordToApplication(queued);
    }

    const applicantUserId = user.id;
    const embeddedNotes = RestaurantCredentialsService.embedHashInNotes(app.notes?.trim(), passwordHash);

    const row = {
      id: appId,
      applicant_user_id: applicantUserId,
      business_name: app.businessName.trim(),
      owner_name: app.ownerName.trim(),
      owner_phone: app.ownerPhone.trim(),
      owner_email: cleanEmail || null,
      cuisine_type: app.cuisineType?.trim() || null,
      neighborhood: app.neighborhood?.trim() || null,
      address: app.address?.trim() || null,
      has_tin_or_license: app.hasTinOrLicense ?? false,
      tin_number: app.tinNumber?.trim() || null,
      status: 'PENDING',
      notes: embeddedNotes,
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

    if (cleanEmail) {
      await RestaurantCredentialsService.saveCredentialRecord({
        email: cleanEmail,
        passwordHash,
        applicationId: data.id,
        applicantUserId,
        businessName: app.businessName.trim(),
        ownerName: app.ownerName.trim(),
        ownerPhone: app.ownerPhone.trim(),
        cuisineType: app.cuisineType?.trim() || '',
        neighborhood: app.neighborhood?.trim() || '',
        address: app.address?.trim() || '',
        hasTinOrLicense: app.hasTinOrLicense ?? false,
        tinNumber: app.tinNumber?.trim() || undefined,
        notes: app.notes?.trim() || undefined,
        status: 'PENDING',
        syncedToServer: true,
      });
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

    await this.flushPendingQueue();

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

      if (app.ownerEmail) {
        await RestaurantCredentialsService.saveCredentialRecord({
          email: app.ownerEmail,
          applicationId: app.id,
          applicantUserId: app.applicantUserId,
          businessName: app.businessName,
          ownerName: app.ownerName,
          ownerPhone: app.ownerPhone,
          status: 'APPROVED',
          restaurantId,
          syncedToServer: true,
        });
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

      if (app.ownerEmail) {
        await RestaurantCredentialsService.saveCredentialRecord({
          email: app.ownerEmail,
          applicationId: app.id,
          applicantUserId: app.applicantUserId,
          businessName: app.businessName,
          ownerName: app.ownerName,
          ownerPhone: app.ownerPhone,
          status: 'REJECTED',
          rejectionReason: app.rejectionReason || reasonToUse,
          syncedToServer: true,
        });
      }

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

