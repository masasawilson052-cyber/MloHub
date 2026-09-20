import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { runtimeConfig } from '../lib/runtimeConfig';
import { DataReport, DataReportStatus, DataReportType } from '../types/domain';

// Local test fixtures and offline fallback cache
const INITIAL_DATA_REPORTS: DataReport[] = [
  {
    id: 'rep-mock-1',
    reporterUserId: 'usr-cust-1',
    reporterName: 'Juma Hamisi',
    restaurantId: 'rest-swahili-food-spot',
    restaurantName: 'Swahili Food Spot',
    branchId: 'branch-1',
    menuItemId: 'item-1',
    menuItemName: 'Samaki wa Kupaka & Ugali',
    reportType: 'WRONG_PRICE',
    message: 'Menu listed at 8,500 TZS but restaurant charged 9,500 TZS at checkout counter.',
    reportedValue: '9,500 TZS',
    catalogValue: '8,500 TZS',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
  },
  {
    id: 'rep-mock-2',
    reporterUserId: 'usr-cust-2',
    reporterName: 'Amina Selemani',
    restaurantId: 'rest-supu-chapati-hub',
    restaurantName: 'Supu ya Ng\'ombe & Chapati Hub',
    branchId: 'branch-2',
    menuItemId: 'item-2',
    menuItemName: 'Supu ya Kongoro',
    reportType: 'ITEM_UNAVAILABLE',
    message: 'Tried ordering in person and server said Kongoro was finished at 11am.',
    reportedValue: 'Out of Stock',
    catalogValue: 'Available',
    status: 'INVESTIGATING',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
  },
  {
    id: 'rep-mock-3',
    reporterUserId: 'usr-cust-3',
    reporterName: 'David Makwaya',
    restaurantId: 'rest-nyama-choma-banda',
    restaurantName: 'Nyama Choma Banda Mikocheni',
    reportType: 'WRONG_HOURS',
    message: 'App says open until 11:00 PM, but gate was locked at 9:30 PM on Sunday.',
    reportedValue: 'Closes 9:30 PM on Sundays',
    catalogValue: 'Closes 11:00 PM Daily',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 36 hours ago
  },
];

let localReports: DataReport[] = [...INITIAL_DATA_REPORTS];

export class DataReportsRepository {
  private static mapRowToReport(row: any): DataReport {
    return {
      id: row.id,
      reporterUserId: row.reporter_user_id,
      reporterName: row.reporter_name || 'Customer',
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      branchId: row.branch_id,
      menuItemId: row.menu_item_id,
      menuItemName: row.menu_item_name,
      reportType: row.report_type as DataReportType,
      message: row.message,
      reportedValue: row.reported_value,
      catalogValue: row.catalog_value,
      status: (row.status || 'OPEN') as DataReportStatus,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      resolutionNotes: row.notes,
      createdAt: row.created_at || new Date().toISOString(),
    };
  }

  public static async listAll(filter?: {
    restaurantId?: string;
    status?: string;
    reportType?: string;
  }): Promise<DataReport[]> {
    if (isSupabaseConfigured() && !runtimeConfig.allowLocalDataFallbacks) {
      let query = supabase.from('data_reports').select('*');
      if (filter?.restaurantId) query = query.eq('restaurant_id', filter.restaurantId);
      if (filter?.status && filter.status !== 'ALL') query = query.eq('status', filter.status);
      if (filter?.reportType && filter.reportType !== 'ALL') query = query.eq('report_type', filter.reportType);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('DataReportsRepository.listAll error:', error.message);
        throw new Error(`Failed to fetch data reports: ${error.message}`);
      }
      return (data || []).map(this.mapRowToReport);
    }

    if (!runtimeConfig.allowLocalDataFallbacks) {
      return [];
    }

    return localReports.filter((r) => {
      if (filter?.restaurantId && r.restaurantId !== filter.restaurantId) return false;
      if (filter?.status && filter.status !== 'ALL' && r.status !== filter.status) return false;
      if (filter?.reportType && filter.reportType !== 'ALL' && r.reportType !== filter.reportType) return false;
      return true;
    });
  }

  public static async getById(id: string): Promise<DataReport | null> {
    if (isSupabaseConfigured() && !runtimeConfig.allowLocalDataFallbacks) {
      const { data, error } = await supabase
        .from('data_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        console.error('DataReportsRepository.getById error:', error.message);
        throw new Error(`Failed to fetch data report: ${error.message}`);
      }
      return data ? this.mapRowToReport(data) : null;
    }

    if (!runtimeConfig.allowLocalDataFallbacks) {
      return null;
    }

    return localReports.find((r) => r.id === id) || null;
  }

  public static async submit(report: Omit<DataReport, 'id' | 'createdAt'>): Promise<DataReport> {
    const newReport: DataReport = {
      ...report,
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: report.status || 'OPEN',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && !runtimeConfig.allowLocalDataFallbacks) {
      const { data, error } = await supabase
        .from('data_reports')
        .insert({
          reporter_user_id: newReport.reporterUserId,
          restaurant_id: newReport.restaurantId,
          branch_id: newReport.branchId,
          menu_item_id: newReport.menuItemId,
          report_type: newReport.reportType,
          message: newReport.message,
          reported_value: newReport.reportedValue,
          status: newReport.status,
        })
        .select()
        .single();

      if (error) {
        console.error('DataReportsRepository.submit error:', error.message);
        throw new Error(`Failed to submit data report: ${error.message}`);
      }
      return this.mapRowToReport(data);
    }

    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error('Local report submission is disabled in production mode.');
    }

    localReports.unshift(newReport);
    return newReport;
  }

  public static async resolveReport(
    id: string,
    reviewedBy: string,
    status: 'RESOLVED' | 'REJECTED' | 'INVESTIGATING',
    resolutionNotes?: string
  ): Promise<DataReport> {
    const reviewedAt = new Date().toISOString();

    if (isSupabaseConfigured() && !runtimeConfig.allowLocalDataFallbacks) {
      const { data, error } = await supabase
        .from('data_reports')
        .update({
          status,
          reviewed_by: reviewedBy,
          reviewed_at: reviewedAt,
          notes: resolutionNotes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('DataReportsRepository.resolveReport error:', error.message);
        throw new Error(`Failed to resolve data report: ${error.message}`);
      }
      return this.mapRowToReport(data);
    }

    if (!runtimeConfig.allowLocalDataFallbacks) {
      throw new Error(`Data report ${id} not found.`);
    }

    const idx = localReports.findIndex((r) => r.id === id);
    if (idx >= 0) {
      localReports[idx] = {
        ...localReports[idx],
        status,
        reviewedBy,
        reviewedAt,
        resolutionNotes,
      };
      return localReports[idx];
    }

    throw new Error(`Data report ${id} not found.`);
  }

  public static resetMockData(): void {
    localReports = [...INITIAL_DATA_REPORTS];
  }
}
