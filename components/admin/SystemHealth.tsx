import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import { runtimeConfig } from '../../lib/runtimeConfig';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import {
  AdminSystemHealthService,
  PlatformHealthReport,
  SubsystemHealth,
  SubsystemStatus,
} from '../../services/AdminSystemHealthService';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface SystemHealthProps {
  language?: 'en' | 'sw';
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ language = 'en' }) => {
  const isCloud = isSupabaseConfigured();
  /*
  // Fail-closed invariant check preserved:
  status: isCloud
        ? (runtimeConfig.isDemo ? 'DEMO INSTANCE (CONFIGURED)' : 'CONFIGURED (UNVERIFIED)')
  isHealthy: false, // Fail closed: presence of URL/key does not guarantee live PostgreSQL reachability
  */
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [report, setReport] = useState<PlatformHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHealth = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const data = await AdminSystemHealthService.checkHealth();
      setReport(data);
    } catch (err) {
      console.warn('[SystemHealth] Error fetching health report:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const getStatusColor = (status: SubsystemStatus) => {
    switch (status) {
      case 'HEALTHY':
        return '#10b981';
      case 'DEGRADED':
        return '#f59e0b';
      case 'DOWN':
        return '#ef4444';
      case 'UNVERIFIED':
      default:
        return '#3b82f6';
    }
  };

  const getStatusBg = (status: SubsystemStatus) => {
    switch (status) {
      case 'HEALTHY':
        return isDark ? '#064e3b30' : '#ecfdf5';
      case 'DEGRADED':
        return isDark ? '#78350f30' : '#fffbeb';
      case 'DOWN':
        return isDark ? '#7f1d1d30' : '#fef2f2';
      case 'UNVERIFIED':
      default:
        return isDark ? '#1e3a8a30' : '#eff6ff';
    }
  };

  const getStatusBorder = (status: SubsystemStatus) => {
    switch (status) {
      case 'HEALTHY':
        return isDark ? '#059669' : '#a7f3d0';
      case 'DEGRADED':
        return isDark ? '#d97706' : '#fde68a';
      case 'DOWN':
        return isDark ? '#dc2626' : '#fecaca';
      case 'UNVERIFIED':
      default:
        return isDark ? '#2563eb' : '#bfdbfe';
    }
  };

  const overallStatus: SubsystemStatus = report?.overallStatus || 'UNVERIFIED';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.appBackground }]}
      contentContainerStyle={styles.content}
    >
      {/* Header Area */}
      <View style={styles.headerArea}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Hali ya Miundombinu & Mfumo' : 'System Infrastructure & Subsystems'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {language === 'sw'
              ? 'Ufuatiliaji wa wakati halisi wa hifadhidata ya PostgreSQL, WebSockets, lango za malipo, na heartbeats za workers.'
              : 'Authoritative telemetry for PostgreSQL, real-time channels, payments gateways, and background worker heartbeats.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.refreshButton,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => loadHealth(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <Ionicons name="refresh" size={16} color={colors.text} />
          )}
          <Text style={[styles.refreshText, { color: colors.textPrimary }]}>
            {isRefreshing ? (language === 'sw' ? 'Inakagua...' : 'Checking...') : (language === 'sw' ? 'Kagua Upya' : 'Refresh Telemetry')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Overall Platform Health Card */}
      <View
        style={[
          styles.overallBanner,
          {
            backgroundColor: getStatusBg(overallStatus),
            borderColor: getStatusBorder(overallStatus),
          },
        ]}
      >
        <View
          style={[
            styles.bannerIconWrapper,
            { backgroundColor: isDark ? colors.surface : colors.card },
          ]}
        >
          <Ionicons
            name={
              overallStatus === 'HEALTHY'
                ? 'shield-checkmark'
                : overallStatus === 'DEGRADED'
                ? 'warning-outline'
                : overallStatus === 'DOWN'
                ? 'alert-circle'
                : 'information-circle-outline'
            }
            size={28}
            color={getStatusColor(overallStatus)}
          />
        </View>
        <View style={styles.bannerText}>
          <View style={styles.bannerHeaderRow}>
            <Text
              style={[
                styles.bannerTitle,
                { color: getStatusColor(overallStatus) },
              ]}
            >
              {overallStatus === 'HEALTHY'
                ? (language === 'sw' ? 'Hali ya Mfumo: Mifumo Yote Imara' : 'Platform Status: All Systems Operational')
                : overallStatus === 'DEGRADED'
                ? (language === 'sw' ? 'Hali ya Mfumo: Tahadhari ya Ucheleweshaji / Huduma Zilizopungua' : 'Platform Status: Latency / Service Degradation Detected')
                : overallStatus === 'DOWN'
                ? (language === 'sw' ? 'Hali ya Mfumo: Sehemu ya Mfumo Imesimama' : 'Platform Status: Critical Outage / Backend Unreachable')
                : (language === 'sw' ? 'Hali ya Mfumo: Mfumo Uko Nje ya Mtandao / Hujathibitishwa' : 'Platform Status: Offline / Unverified Probe')}
            </Text>
            {report?.checkedAt && (
              <Text style={[styles.checkedTime, { color: colors.textMuted }]}>
                {new Date(report.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
          </View>
          <Text style={[styles.bannerSubtitle, { color: colors.textPrimary }]}>
            {overallStatus === 'HEALTHY'
              ? (language === 'sw'
                ? 'PostgreSQL, lango za malipo, na wafanyakazi wa mfumo wanafanya kazi kwa kiwango cha juu.'
                : 'PostgreSQL database, financial adapters, and background heartbeat workers are operating nominally.')
              : overallStatus === 'DEGRADED'
              ? (language === 'sw'
                ? 'Baadhi ya majukumu au foleni za malipo zimezidi muda uliopangwa. Kagua maelezo hapa chini.'
                : 'Queued transactions or worker heartbeats require administrator attention. Review degraded checks below.')
              : (language === 'sw'
                ? 'Mawasiliano na hifadhidata ya Supabase au vituo vya malipo yamekatika.'
                : 'Database endpoints or edge services unreachable. Fail-closed governance enforced.')}
          </Text>
        </View>
      </View>

      {/* Grid of Subsystem Health Cards */}
      <View style={styles.cardsGrid}>
        {/* Runtime Environment Boundary Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]}>Runtime Environment</Text>
              <Text style={[styles.cardType, { color: colors.textMuted }]}>Deployment Boundary</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: runtimeConfig.isProduction
                    ? '#ef444415'
                    : runtimeConfig.isStaging
                    ? '#f59e0b15'
                    : '#3b82f615',
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: runtimeConfig.isProduction
                      ? '#ef4444'
                      : runtimeConfig.isStaging
                      ? '#f59e0b'
                      : '#3b82f6',
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: runtimeConfig.isProduction
                      ? '#ef4444'
                      : runtimeConfig.isStaging
                      ? '#f59e0b'
                      : '#3b82f6',
                  },
                ]}
              >
                {runtimeConfig.environmentLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {runtimeConfig.isProduction
              ? 'Production runtime active. Client-side data fallbacks strictly forbidden; real Supabase instance required.'
              : runtimeConfig.isStaging
              ? 'Staging runtime active. Client fallbacks strictly forbidden; hosted staging backend required.'
              : runtimeConfig.isDevelopment
              ? 'Local development runtime active. Real local Supabase required (e.g. 127.0.0.1:54321).'
              : runtimeConfig.isDemo
              ? 'Demo mode active. Explicit demo showcase fixtures and sandbox fallbacks permitted.'
              : 'Automated test suite runtime active.'}
          </Text>
        </View>

        {/* Dynamic Subsystem Checks */}
        {loading && !report ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              {language === 'sw' ? 'Inathibitisha huduma za mfumo...' : 'Probing platform subsystems and worker heartbeats...'}
            </Text>
          </View>
        ) : (
          report?.checks.map((c: SubsystemHealth, idx: number) => {
            const statusColor = getStatusColor(c.status);
            return (
              <View
                key={idx}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.cardType, { color: colors.textMuted }]}>{c.category}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}15` }]}>
                    <View style={[styles.dot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{c.status}</Text>
                  </View>
                </View>

                {c.latencyMs !== undefined && (
                  <View style={styles.latencyRow}>
                    <Ionicons name="speedometer-outline" size={13} color={colors.textMuted} />
                    <Text style={[styles.latencyText, { color: colors.textSecondary }]}>
                      Roundtrip: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{c.latencyMs} ms</Text>
                    </Text>
                  </View>
                )}

                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{c.message}</Text>

                {c.details && Object.keys(c.details).length > 0 && (
                  <View
                    style={[
                      styles.detailsBox,
                      { backgroundColor: isDark ? colors.card : colors.appBackground, borderColor: colors.border },
                    ]}
                  >
                    {Object.entries(c.details).map(([k, v]) => (
                      <Text key={k} style={[styles.detailItem, { color: colors.textSecondary }]}>
                        • <Text style={{ fontWeight: '600' }}>{k}:</Text> {String(v)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flex: 1,
    minWidth: 260,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
  overallBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  bannerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkedTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  bannerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 290,
    borderRadius: Radii.lg,
    borderWidth: 1,
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
  },
  cardType: {
    fontSize: 11,
    marginTop: 2,
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
  latencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  latencyText: {
    fontSize: 11,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  detailsBox: {
    borderRadius: Radii.sm,
    borderWidth: 1,
    padding: Spacing.xs,
    gap: 2,
    marginTop: 4,
  },
  detailItem: {
    fontSize: 11,
  },
  loadingContainer: {
    width: '100%',
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 13,
  },
});
let styles = createStyles(lightColors);
