import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { AdminTabId } from './AdminSidebar';
import { FINANCIAL_CONFIG, formatTzs } from '../../config/platformFees';

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
  onNavigateTab: (tab: AdminTabId) => void;
  language?: 'en' | 'sw';
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  stats,
  attentionItems,
  onNavigateTab,
  language = 'en',
}) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. PLATFORM ATTENTION CENTER */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="notifications-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Kituo cha Hatua za Haraka' : 'Platform Attention Center'}
            </Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            {language === 'sw'
              ? 'Mambo yanayohitaji uamuzi wa haraka wa wasimamizi'
              : 'Items requiring operational intervention'}
          </Text>
        </View>

        {attentionItems.length === 0 ? (
          <View style={styles.allClearCard}>
            <Ionicons name="checkmark-done-circle" size={32} color="#10b981" />
            <View>
              <Text style={styles.allClearTitle}>All Systems Optimal</Text>
              <Text style={styles.allClearSubtitle}>No outstanding critical issues or unreviewed queues.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.attentionGrid}>
            {attentionItems.map((item) => {
              const isCrit = item.severity === 'CRITICAL';
              const isHigh = item.severity === 'HIGH';
              const isMed = item.severity === 'MEDIUM';

              const badgeBg = isCrit ? '#fee2e2' : isHigh ? '#ffedd5' : isMed ? '#fef3c7' : '#eff6ff';
              const badgeColor = isCrit ? '#b91c1c' : isHigh ? '#c2410c' : isMed ? '#b45309' : '#1d4ed8';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.attentionCard, isCrit && styles.attentionCardCritical]}
                  onPress={() => onNavigateTab(item.targetTab)}
                >
                  <View style={styles.attentionTopRow}>
                    <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.severityText, { color: badgeColor }]}>{item.severity}</Text>
                    </View>
                    {item.count !== undefined && item.count > 0 && (
                      <Text style={styles.attentionCount}>+{item.count}</Text>
                    )}
                  </View>
                  <Text style={styles.attentionTitle}>{item.title}</Text>
                  <Text style={styles.attentionDesc}>{item.description}</Text>
                  <View style={styles.attentionActionRow}>
                    <Text style={styles.attentionActionText}>Resolve Now</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 2. OPERATIONAL KPI METRICS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'sw' ? 'Takwimu za Uendeshaji' : 'Operational Health Metrics'}
        </Text>

        <View style={styles.kpiGrid}>
          {/* Active Restaurants */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiIconWrapper}>
              <Ionicons name="restaurant" size={20} color="#0284c7" />
            </View>
            <Text style={styles.kpiValue}>{stats.totalRestaurants}</Text>
            <Text style={styles.kpiLabel}>Registered Restaurants</Text>
            <Text style={styles.kpiSubLabel}>
              {stats.verifiedSellers} Verified • {stats.basicSellers} Basic
            </Text>
          </View>

          {/* Pending Applications */}
          <TouchableOpacity style={styles.kpiCard} onPress={() => onNavigateTab('APPLICATIONS')}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#ffedd5' }]}>
              <Ionicons name="document-text" size={20} color="#ea580c" />
            </View>
            <Text style={[styles.kpiValue, stats.pendingApplications > 0 && { color: '#ea580c' }]}>
              {stats.pendingApplications}
            </Text>
            <Text style={styles.kpiLabel}>Pending Applications</Text>
            <Text style={styles.kpiSubLabel}>Awaiting review & onboarding</Text>
          </TouchableOpacity>

          {/* Open Customer Reports */}
          <TouchableOpacity style={styles.kpiCard} onPress={() => onNavigateTab('REPORTS')}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
            </View>
            <Text style={[styles.kpiValue, stats.openReports > 0 && { color: '#dc2626' }]}>
              {stats.openReports}
            </Text>
            <Text style={styles.kpiLabel}>Data Reports</Text>
            <Text style={styles.kpiSubLabel}>Price / availability reports</Text>
          </TouchableOpacity>

          {/* Orders Today & Fulfillment */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="cart" size={20} color="#16a34a" />
            </View>
            <Text style={styles.kpiValue}>{stats.totalOrders}</Text>
            <Text style={styles.kpiLabel}>Total Orders Tracked</Text>
            <Text style={styles.kpiSubLabel}>
              {stats.completedOrders} completed
            </Text>
          </View>

          {/* Platform Financials */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="cash" size={20} color="#9333ea" />
            </View>
            <Text style={styles.kpiValue}>{formatTzs(stats.grossVolumeTzs)}</Text>
            <Text style={styles.kpiLabel}>Gross Platform Volume</Text>
            <Text style={styles.kpiSubLabel}>
              Est. Comm ({FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 100}%): {formatTzs(stats.platformRevenueTzs)}
            </Text>
          </View>

          {/* Catalog Freshness */}
          <TouchableOpacity style={styles.kpiCard} onPress={() => onNavigateTab('VERIFICATION')}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#4338ca" />
            </View>
            <Text style={styles.kpiValue}>{stats.freshnessScorePct}%</Text>
            <Text style={styles.kpiLabel}>Catalog Freshness</Text>
            <Text style={styles.kpiSubLabel}>Verified dishes & prices</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. QUICK ACTIONS BAR */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'sw' ? 'Njia za Mkato' : 'Administrative Quick Actions'}
        </Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigateTab('APPLICATIONS')}>
            <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Review Applications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigateTab('REPORTS')}>
            <Ionicons name="shield-outline" size={18} color="#0284c7" />
            <Text style={styles.actionBtnText}>Resolve Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigateTab('NOTIFICATIONS')}>
            <Ionicons name="megaphone-outline" size={18} color="#16a34a" />
            <Text style={styles.actionBtnText}>Platform Broadcast</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigateTab('AUDIT_LOGS')}>
            <Ionicons name="list-outline" size={18} color="#64748b" />
            <Text style={styles.actionBtnText}>Audit Trail</Text>
          </TouchableOpacity>
        </View>
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
  section: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.xs,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  allClearCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  allClearSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  attentionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  attentionCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  attentionCardCritical: {
    borderColor: '#fecaca',
    backgroundColor: '#fffaf0',
  },
  attentionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  attentionCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  attentionDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  attentionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  attentionActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
  },
  kpiIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  kpiSubLabel: {
    fontSize: 11,
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});
