import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../constants/theme';
import { AdminTabId } from './AdminSidebar';
import { formatTzs } from '../../config/platformFees';
import { useTheme } from '../../context/ThemeContext';
import { PlatformHealthStatus } from '../../services/AdminSystemHealthService';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

export interface AttentionItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  description: string;
  targetTab: AdminTabId;
  count?: number;
}

interface AdminOverviewProps {
  stats: {
    totalRestaurants: number;
    basicSellers: number;
    verifiedSellers: number;
    suspendedRestaurants: number;
    pendingApplications: number;
    openReports: number;
    totalOrders: number;
    completedOrders: number;
    grossVolumeTzs: number;
    platformRevenueTzs: number;
    freshnessScorePct: number;
  };
  attentionItems: AttentionItem[];
  systemHealth?: PlatformHealthStatus | null;
  onNavigateTab: (tab: AdminTabId) => void;
  language?: 'en' | 'sw';
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  stats,
  attentionItems,
  systemHealth,
  onNavigateTab,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const effectiveAttentionItems: AttentionItem[] = [...attentionItems];

  if (systemHealth && systemHealth.status !== 'HEALTHY') {
    effectiveAttentionItems.unshift({
      id: 'att-system-health',
      severity: systemHealth.status === 'DOWN' ? 'CRITICAL' : 'HIGH',
      title:
        systemHealth.status === 'DOWN'
          ? 'Backend Offline or Degraded'
          : 'Worker / Background Latency Warning',
      description:
        'One or more platform workers or database connections require operator review.',
      targetTab: 'HEALTH',
      count: 1,
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.appBackground }]}
      contentContainerStyle={styles.content}
    >
      {/* 1. PLATFORM ATTENTION CENTER */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="pulse-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'sw' ? 'Kituo cha Hatua za Haraka' : 'Platform Attention Center'}
            </Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {language === 'sw'
              ? 'Mambo yanayohitaji uamuzi wa haraka wa wasimamizi'
              : 'Operational queues & alerts requiring governance action'}
          </Text>
        </View>

        {effectiveAttentionItems.length === 0 ? (
          <View
            style={[
              styles.allClearCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.allClearIcon, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="checkmark-done" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.allClearTitle, { color: colors.textPrimary }]}>
                All Systems Optimal
              </Text>
              <Text style={[styles.allClearSubtitle, { color: colors.textSecondary }]}>
                No outstanding critical issues or unreviewed operational queues.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.attentionGrid}>
            {effectiveAttentionItems.map((item) => {
              const isCrit = item.severity === 'CRITICAL';
              const isHigh = item.severity === 'HIGH';
              const isMed = item.severity === 'MEDIUM';

              const badgeBg = isCrit
                ? colors.dangerSoft
                : isHigh
                ? colors.primarySoft
                : isMed
                ? colors.warningSoft
                : colors.infoSoft;

              const badgeColor = isCrit
                ? colors.danger
                : isHigh
                ? colors.primary
                : isMed
                ? colors.warning
                : colors.info;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.attentionCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isCrit ? colors.danger : colors.border,
                    },
                  ]}
                  onPress={() => onNavigateTab(item.targetTab)}
                  activeOpacity={0.85}
                >
                  <View style={styles.attentionTopRow}>
                    <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.severityText, { color: badgeColor }]}>
                        {item.severity}
                      </Text>
                    </View>
                    {item.count !== undefined && item.count > 0 && (
                      <View
                        style={[
                          styles.countPill,
                          { backgroundColor: colors.surfaceInteractive },
                        ]}
                      >
                        <Text style={[styles.attentionCount, { color: colors.textPrimary }]}>
                          +{item.count}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.attentionTitle, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.attentionDesc, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                  <View style={styles.attentionActionRow}>
                    <Text style={[styles.attentionActionText, { color: colors.primary }]}>
                      Resolve Now
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 2. OPERATIONAL KPI METRICS */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {language === 'sw' ? 'Takwimu za Uendeshaji' : 'Operational Health Metrics'}
        </Text>

        <View style={styles.kpiGrid}>
          {/* Primary Highlight Card: Gross Platform Volume */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              styles.kpiHighlightCard,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primaryHover,
              },
            ]}
            onPress={() => onNavigateTab('PAYMENTS')}
            activeOpacity={0.9}
          >
            <View style={styles.kpiTopRow}>
              <View
                style={[
                  styles.kpiIconWrapper,
                  { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
                ]}
              >
                <Ionicons name="wallet-outline" size={18} color={colors.onPrimary} />
              </View>
              <View
                style={[
                  styles.highlightPill,
                  { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
                ]}
              >
                <Text style={styles.highlightPillText}>VERIFIED VOLUME</Text>
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: colors.onPrimary }]}>
              {formatTzs(stats.grossVolumeTzs)}
            </Text>
            <Text style={[styles.kpiLabel, { color: 'rgba(255, 255, 255, 0.92)' }]}>
              Gross Platform Volume
            </Text>
            <Text style={[styles.kpiSubLabel, { color: 'rgba(255, 255, 255, 0.76)' }]}>
              Platform Commission: {formatTzs(stats.platformRevenueTzs)}
            </Text>
          </TouchableOpacity>

          {/* Active Restaurants */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('RESTAURANTS')}
            activeOpacity={0.85}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="restaurant-outline" size={18} color={colors.info} />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
              {stats.totalRestaurants}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Registered Restaurants
            </Text>
            <Text style={[styles.kpiSubLabel, { color: colors.textMuted }]}>
              {stats.verifiedSellers} Verified • {stats.basicSellers} Basic
            </Text>
          </TouchableOpacity>

          {/* Pending Applications */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('APPLICATIONS')}
            activeOpacity={0.85}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.kpiValue,
                {
                  color:
                    stats.pendingApplications > 0 ? colors.primary : colors.textPrimary,
                },
              ]}
            >
              {stats.pendingApplications}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Pending Applications
            </Text>
            <Text style={[styles.kpiSubLabel, { color: colors.textMuted }]}>
              Awaiting review & onboarding
            </Text>
          </TouchableOpacity>

          {/* Open Customer Reports */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('REPORTS')}
            activeOpacity={0.85}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: stats.openReports > 0 ? colors.danger : colors.textPrimary },
              ]}
            >
              {stats.openReports}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Data Reports
            </Text>
            <Text style={[styles.kpiSubLabel, { color: colors.textMuted }]}>
              Price / availability reports
            </Text>
          </TouchableOpacity>

          {/* Orders Today & Fulfillment */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('ORDERS')}
            activeOpacity={0.85}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="cart-outline" size={18} color={colors.success} />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
              {stats.totalOrders}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Total Orders Tracked
            </Text>
            <Text style={[styles.kpiSubLabel, { color: colors.textMuted }]}>
              {stats.completedOrders} completed
            </Text>
          </TouchableOpacity>

          {/* Catalog Freshness */}
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('VERIFICATION')}
            activeOpacity={0.85}
          >
            <View style={[styles.kpiIconWrapper, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.warning} />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
              {stats.freshnessScorePct}%
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
              Catalog Freshness
            </Text>
            <Text style={[styles.kpiSubLabel, { color: colors.textMuted }]}>
              Verified dishes & prices
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. QUICK ACTIONS BAR */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {language === 'sw' ? 'Njia za Mkato' : 'Administrative Quick Actions'}
        </Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('APPLICATIONS')}
          >
            <Ionicons name="person-add-outline" size={17} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              Review Applications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('REPORTS')}
          >
            <Ionicons name="shield-outline" size={17} color={colors.info} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              Resolve Reports
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('NOTIFICATIONS')}
          >
            <Ionicons name="megaphone-outline" size={17} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              Platform Broadcast
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onNavigateTab('AUDIT_LOGS')}
          >
            <Ionicons name="list-outline" size={17} color={colors.textMuted} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              Audit Trail
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    marginBottom: 2,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  allClearCard: {
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
  },
  allClearIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  allClearSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  attentionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  attentionCard: {
    flex: 1,
    minWidth: 260,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    gap: 8,
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  attentionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  attentionCount: {
    fontSize: 11,
    fontWeight: '800',
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  attentionDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  attentionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  attentionActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: 196,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
  },
  kpiHighlightCard: {
    minWidth: 230,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  highlightPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  highlightPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 0.5,
  },
  kpiIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  kpiSubLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
let styles = createStyles(lightColors);
