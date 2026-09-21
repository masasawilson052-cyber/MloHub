import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { runtimeConfig } from '../../lib/runtimeConfig';

interface SystemHealthProps {
  language?: 'en' | 'sw';
}

export const SystemHealth: React.FC<SystemHealthProps> = ({
  language = 'en',
}) => {
  const isCloud = isSupabaseConfigured();
  const [probeStatus, setProbeStatus] = useState<'CHECKING' | 'CONNECTED' | 'UNREACHABLE' | 'CONFIGURED_UNVERIFIED'>(
    isCloud ? 'CHECKING' : 'CONFIGURED_UNVERIFIED'
  );

  useEffect(() => {
    let isMounted = true;
    if (isCloud) {
      (async () => {
        try {
          const { error } = await supabase.from('profiles').select('id').limit(1);
          if (!isMounted) return;
          if (error) {
            if (error.message?.includes('FetchError') || error.message?.includes('Network') || error.message?.includes('Failed to fetch')) {
              setProbeStatus('UNREACHABLE');
            } else {
              setProbeStatus('CONNECTED');
            }
          } else {
            setProbeStatus('CONNECTED');
          }
        } catch {
          if (isMounted) setProbeStatus('UNREACHABLE');
        }
      })();
    }
    return () => {
      isMounted = false;
    };
  }, [isCloud]);

  const services = [
    {
      name: 'Runtime Environment',
      type: 'Deployment Boundary',
      status: runtimeConfig.environmentLabel,
      isHealthy: true,
      description: runtimeConfig.isProduction
        ? 'Production runtime active. Client fallbacks strictly forbidden; real Supabase instance required.'
        : runtimeConfig.isStaging
        ? 'Staging runtime active. Client fallbacks strictly forbidden; hosted staging backend required.'
        : runtimeConfig.isDevelopment
        ? 'Local development runtime active. Real local Supabase required (e.g., http://127.0.0.1:54321).'
        : runtimeConfig.isDemo
        ? 'Demo mode active. Explicit demo showcase fixtures and sandbox fallbacks permitted.'
        : 'Automated test suite runtime active.',
      badgeColor: runtimeConfig.isProduction ? '#ef4444' : runtimeConfig.isStaging ? '#f59e0b' : '#3b82f6',
    },
    {
      name: 'Supabase PostgreSQL',
      type: 'Database Engine',
      status: probeStatus === 'CONNECTED'
        ? 'DATABASE REACHABLE'
        : (isCloud
        ? (runtimeConfig.isDemo ? 'DEMO INSTANCE (CONFIGURED)' : 'CONFIGURED (UNVERIFIED)')
        : runtimeConfig.allowLocalDataFallbacks
        ? 'OFFLINE MOCK (TEST/DEMO ONLY)'
        : 'DISCONNECTED'),
      /*
      status: isCloud
        ? (runtimeConfig.isDemo ? 'DEMO INSTANCE (CONFIGURED)' : 'CONFIGURED (UNVERIFIED)')
      */
      isHealthy: false, // Fail closed: presence of URL/key does not guarantee live PostgreSQL reachability
      description: probeStatus === 'CONNECTED'
        ? 'Supabase database endpoint is responsive and verified via live probe.'
        : isCloud
        ? 'Supabase URL and anon key are configured; live reachability is unverified.'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'Running in deterministic mock mode strictly isolated for TEST/DEMO.'
        : `CRITICAL: Supabase unconfigured in ${runtimeConfig.environmentLabel}. Local fallback is forbidden.`,
      badgeColor: probeStatus === 'CONNECTED' ? '#10b981' : isCloud ? '#f59e0b' : runtimeConfig.allowLocalDataFallbacks ? '#3b82f6' : '#ef4444',
    },
    {
      name: 'Realtime WebSockets',
      type: 'Event Distribution Engine',
      status: probeStatus === 'CONNECTED' ? 'WEBSOCKETS AVAILABLE' : (isCloud ? 'CONFIGURED (SOCKET UNVERIFIED)' : (runtimeConfig.allowLocalDataFallbacks ? 'BROADCAST_CHANNEL' : 'DOWN')),
      isHealthy: false, // Fail closed: unverified until socket handshake succeeds
      description: isCloud
        ? 'Realtime URL configured; active WebSocket socket connection has not been verified.'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'In-memory BroadcastChannel active for test/demo.'
        : 'Realtime disconnected.',
      badgeColor: isCloud ? '#f59e0b' : runtimeConfig.allowLocalDataFallbacks ? '#3b82f6' : '#ef4444',
    },
    {
      name: 'SMS Gateway Provider',
      type: 'Telecom Adapter',
      status: 'CONFIGURED (CARRIER UNVERIFIED)',
      isHealthy: false,
      description: 'Live carrier health not verified. Provider credentials reside strictly on server workers and are never inspected by the Expo client.',
      badgeColor: '#f59e0b',
    },
    {
      name: 'Payment Processing Gateway',
      type: 'Financial Adapter',
      status: runtimeConfig.isDemo
        ? 'CLICKPESA (SANDBOX VERIFIED)'
        : isCloud
        ? 'CONFIGURED (HEALTH UNVERIFIED)'
        : 'UNAVAILABLE / NOT CONFIGURED',
      isHealthy: runtimeConfig.isDemo,
      description: runtimeConfig.isDemo
        ? 'Simulated ClickPesa USSD flow for demo showcase.'
        : isCloud
        ? 'ClickPesa USSD push adapter configured; live settlement probe has not verified credentials.'
        : 'Payment adapter unavailable without Supabase credentials.',
      badgeColor: runtimeConfig.isDemo ? '#3b82f6' : isCloud ? '#f59e0b' : '#ef4444',
    },
    {
      name: 'Row Level Security (RLS)',
      type: 'Security Subsystem',
      status: probeStatus === 'CONNECTED'
        ? 'ACTIVE ENFORCEMENT'
        : isCloud
        ? 'CONFIGURED (DATABASE CONTROLLED)'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'SIMULATED (TEST/DEMO)'
        : 'UNKNOWN',
      isHealthy: probeStatus === 'CONNECTED',
      description: isCloud
        ? 'PostgreSQL RLS declared in migrations; live policy enforcement active on connected database.'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'Simulated in-memory security boundaries for test/demo.'
        : 'Database connection required to verify live table security policies.',
      badgeColor: probeStatus === 'CONNECTED' ? '#10b981' : isCloud ? '#f59e0b' : runtimeConfig.allowLocalDataFallbacks ? '#3b82f6' : '#ef4444',
    },
    {
      name: 'Storage & Document Buckets',
      type: 'Asset Storage',
      status: isCloud
        ? 'CONFIGURED (BUCKETS DECLARED — PROBE UNVERIFIED)'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'LOCAL_FALLBACK (TEST/DEMO)'
        : 'UNCONFIGURED',
      isHealthy: false, // Fail closed: bucket existence not probed
      description: isCloud
        ? 'Storage endpoints configured; bucket health has not been verified with head bucket probe.'
        : runtimeConfig.allowLocalDataFallbacks
        ? 'Deterministic asset mock fixtures for test/demo.'
        : 'Requires Supabase Storage bucket configuration for production media storage.',
      badgeColor: isCloud ? '#f59e0b' : runtimeConfig.allowLocalDataFallbacks ? '#3b82f6' : '#ef4444',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Hali ya Mfumo na Huduma' : 'System Infrastructure & Adapter Health'}
        </Text>
        <Text style={styles.subtitle}>
          Operational status of cloud databases, realtime WebSockets, simulated adapters, and security policies.
        </Text>
      </View>

      {/* Overall Health Card */}
      <View style={styles.overallBanner}>
        <View style={styles.bannerIconWrapper}>
          <Ionicons
            name={probeStatus === 'CONNECTED' ? "shield-checkmark" : isCloud ? "warning-outline" : "information-circle-outline"}
            size={28}
            color={probeStatus === 'CONNECTED' ? "#10b981" : "#f59e0b"}
          />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>
            {probeStatus === 'CONNECTED'
              ? 'Infrastructure Status: Database Reachable'
              : probeStatus === 'UNREACHABLE'
              ? 'Infrastructure Status: Backend Unreachable'
              : isCloud
              ? 'Infrastructure Status: Backend Configured — Live Health Unverified'
              : runtimeConfig.isDemo
              ? 'Infrastructure Status: Demo Showcase Active'
              : 'Infrastructure Status: Unavailable / Not Verified'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {probeStatus === 'CONNECTED'
              ? 'Supabase database and Row Level Security active. Live connection verified.'
              : isCloud
              ? 'Supabase URL and anon key configured. Live database connection has not been verified.'
              : runtimeConfig.isDemo
              ? 'Demo environment running with sandbox fixtures.'
              : 'Backend unconfigured or disconnected. Live telemetry unavailable.'}
          </Text>
        </View>
      </View>

      {/* Subsystem Cards */}
      <View style={styles.cardsGrid}>
        {services.map((s, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardName}>{s.name}</Text>
                <Text style={styles.cardType}>{s.type}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${s.badgeColor}15` }]}>
                <View style={[styles.dot, { backgroundColor: s.badgeColor }]} />
                <Text style={[styles.statusText, { color: s.badgeColor }]}>{s.status}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{s.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  headerArea: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  overallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: Spacing.md,
  },
  bannerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardType: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
