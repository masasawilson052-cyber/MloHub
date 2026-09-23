import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SubsystemStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNVERIFIED';

export interface PlatformHealthStatus {
  status: SubsystemStatus;
  latencyMs?: number;
  message?: string;
  checkedAt?: string;
}

export interface SubsystemHealth {
  name: string;
  category: string;
  status: SubsystemStatus;
  latencyMs?: number;
  message: string;
  checkedAt: string;
  details?: Record<string, any>;
}

export interface PlatformHealthReport {
  overallStatus: SubsystemStatus;
  checkedAt: string;
  checks: SubsystemHealth[];
}

export class AdminSystemHealthService {
  /**
   * Quick health status snapshot for headers and overview cards.
   */
  public static async getHealth(): Promise<PlatformHealthStatus> {
    const report = await this.checkHealth();
    const dbCheck = report.checks.find((c) => c.name.toLowerCase().includes('database'));
    return {
      status: report.overallStatus,
      latencyMs: dbCheck?.latencyMs,
      message: `${report.checks.filter((c) => c.status === 'HEALTHY').length}/${report.checks.length} Subsystems Healthy`,
      checkedAt: report.checkedAt,
    };
  }

  /**
   * Probe platform health authoritatively via admin-system-health Edge Function.
   */
  public static async checkHealth(): Promise<PlatformHealthReport> {
    const now = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      return {
        overallStatus: 'UNVERIFIED',
        checkedAt: now,
        checks: [
          {
            name: 'PostgreSQL Database',
            category: 'Core Data Engine',
            status: 'UNVERIFIED',
            message: 'Supabase client is not configured; offline development mode active.',
            checkedAt: now,
          },
          {
            name: 'Payment Processing Gateway',
            category: 'Financial Operations',
            status: 'UNVERIFIED',
            message: 'Gateway unreachable in unconfigured environment.',
            checkedAt: now,
          },
        ],
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-system-health');
      if (!error && data && data.checks) {
        return data as PlatformHealthReport;
      }
    } catch {
      // Edge function call failed; fall back to direct DB probe below
    }

    // Direct client fallback probe if edge function invoke failed
    const start = performance.now();
    let dbStatus: SubsystemStatus = 'HEALTHY';
    let latency = 0;
    let msg = 'PostgreSQL reachable via direct client probe.';

    try {
      const { error } = await supabase.from('platform_financial_settings').select('id').limit(1);
      latency = Math.round(performance.now() - start);
      if (error) {
        dbStatus = 'DEGRADED';
        msg = `Database query returned: ${error.message}`;
      }
    } catch (e: any) {
      dbStatus = 'DOWN';
      msg = e?.message || 'Database unreachable';
    }

    const fallbackChecks: SubsystemHealth[] = [
      {
        name: 'PostgreSQL Database',
        category: 'Core Data Engine',
        status: dbStatus,
        latencyMs: latency,
        message: msg,
        checkedAt: now,
      },
      {
        name: 'Realtime WebSockets',
        category: 'Event Distribution Engine',
        status: 'UNVERIFIED',
        message: 'Realtime channel active verification requires subscription handshake.',
        checkedAt: now,
      },
      {
        name: 'SMS Gateway Provider',
        category: 'Telecom Adapter',
        status: 'UNVERIFIED',
        message: 'Live telecom carrier probe unverified.',
        checkedAt: now,
      },
      {
        name: 'Payment Processing Gateway',
        category: 'Financial Adapter',
        status: 'UNVERIFIED',
        message: 'Payment credentials reside securely on server; probe unverified.',
        checkedAt: now,
      },
    ];

    return {
      overallStatus: dbStatus === 'DOWN' ? 'DOWN' : 'UNVERIFIED',
      checkedAt: now,
      checks: fallbackChecks,
    };
  }
}
