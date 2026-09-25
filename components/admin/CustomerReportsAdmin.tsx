import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { DataReport, DataReportStatus, DataReportType } from '../../types/domain';
import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface CustomerReportsAdminProps {
  reports: DataReport[];
  onResolveReport: (
    reportId: string,
    status: 'RESOLVED' | 'REJECTED' | 'INVESTIGATING',
    resolutionNotes?: string
  ) => Promise<void>;
  language?: 'en' | 'sw';
}

export const CustomerReportsAdmin: React.FC<CustomerReportsAdminProps> = ({
  reports,
  onResolveReport,
  language = 'en',
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DataReportStatus>('OPEN');
  const [typeFilter, setTypeFilter] = useState<'ALL' | DataReportType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<DataReport | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filtered = reports.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && r.reportType !== typeFilter) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      (r.restaurantName && r.restaurantName.toLowerCase().includes(query)) ||
      (r.menuItemName && r.menuItemName.toLowerCase().includes(query)) ||
      (r.reporterName && r.reporterName.toLowerCase().includes(query)) ||
      r.message.toLowerCase().includes(query)
    );
  });

  const openCount = reports.filter((r) => r.status === 'OPEN').length;
  const investigatingCount = reports.filter((r) => r.status === 'INVESTIGATING').length;
  const resolvedCount = reports.filter((r) => r.status === 'RESOLVED').length;

  const handleAction = async (
    status: 'RESOLVED' | 'REJECTED' | 'INVESTIGATING',
    resolutionType?: 'RESOLVED_ONLY' | 'CATALOG_CORRECTED'
  ) => {
    if (!selectedReport) return;
    setIsProcessing(true);
    try {
      const notePrefix = resolutionType === 'CATALOG_CORRECTED' ? '[CATALOG CORRECTION] ' : '';
      const finalNotes = resolutionNotes.trim() ? `${notePrefix}${resolutionNotes.trim()}` : (notePrefix ? '[CATALOG CORRECTION] Price or availability manually corrected.' : undefined);
      await onResolveReport(selectedReport.id, status, finalNotes);
      setSelectedReport(null);
      setResolutionNotes('');
      Alert.alert(
        'Success',
        status === 'RESOLVED'
          ? (resolutionType === 'CATALOG_CORRECTED' ? 'Report resolved and catalog correction logged.' : 'Customer report resolved.')
          : status === 'INVESTIGATING'
          ? 'Marked as under investigation.'
          : 'Report dismissed.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update report.');
    } finally {
      setIsProcessing(false);
    }
  };


  const getReportTypeBadge = (type: DataReportType) => {
    switch (type) {
      case 'WRONG_PRICE':
        return { label: 'Wrong Price', bg: '#fee2e2', color: colors.danger, icon: 'pricetag-outline' as const };
      case 'ITEM_UNAVAILABLE':
        return { label: 'Unavailable', bg: '#ffedd5', color: colors.primary, icon: 'close-circle-outline' as const };
      case 'WRONG_HOURS':
        return { label: 'Wrong Hours', bg: '#fef3c7', color: colors.warning, icon: 'time-outline' as const };
      case 'RESTAURANT_CLOSED':
        return { label: 'Closed Spot', bg: '#fee2e2', color: colors.danger, icon: 'lock-closed-outline' as const };
      default:
        return { label: type, bg: '#eff6ff', color: colors.info, icon: 'alert-circle-outline' as const };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Ripoti za Hitilafu za Bei na Upatikanaji' : 'Customer Data Discrepancy Reports'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Investigate customer feedback on inaccurate menu prices, out-of-stock dishes, and operating hours.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.statusPills}>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              statusFilter === 'OPEN' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setStatusFilter('OPEN')}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                statusFilter === 'OPEN' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Open ({openCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              statusFilter === 'INVESTIGATING' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setStatusFilter('INVESTIGATING')}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                statusFilter === 'INVESTIGATING' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Investigating ({investigatingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              statusFilter === 'RESOLVED' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setStatusFilter('RESOLVED')}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                statusFilter === 'RESOLVED' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Resolved ({resolvedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              statusFilter === 'ALL' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                statusFilter === 'ALL' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              All ({reports.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search report, restaurant, dish..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Reports List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#10b981" />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Data Reports in Queue</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {statusFilter === 'OPEN'
                ? 'All customer pricing and availability reports have been resolved!'
                : 'No reports found matching your criteria.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((report) => {
              const typeBadge = getReportTypeBadge(report.reportType);
              const isSelected = selectedReport?.id === report.id;

              return (
                <View
                  key={report.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, backgroundColor: isDark ? '#261b14' : '#fffaf5' },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
                      <Ionicons name={typeBadge.icon} size={12} color={typeBadge.color} />
                      <Text style={[styles.typeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusTag,
                        report.status === 'RESOLVED'
                          ? styles.statusResolved
                          : report.status === 'INVESTIGATING'
                          ? styles.statusInvestigating
                          : styles.statusOpen,
                      ]}
                    >
                      <Text style={styles.statusTagText}>{report.status}</Text>
                    </View>
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={[styles.restaurantName, { color: colors.textPrimary }]}>
                      {report.restaurantName || report.restaurantId}
                    </Text>
                    {report.menuItemName && (
                      <Text style={[styles.dishName, { color: colors.textSecondary }]}>Dish: {report.menuItemName}</Text>
                    )}
                    <Text style={[styles.messageText, { color: colors.textPrimary }]}>"{report.message}"</Text>
                  </View>

                  {/* Side-by-Side Comparison if values present */}
                  {(report.reportedValue || report.catalogValue) && (
                    <View style={[styles.comparisonBox, { backgroundColor: isDark ? colors.textPrimary : colors.appBackground, borderColor: colors.border }]}>
                      <View style={styles.compColumn}>
                        <Text style={[styles.compLabel, { color: colors.textMuted }]}>Catalog Value:</Text>
                        <Text style={styles.compCatalog}>{report.catalogValue || 'Unknown'}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                      <View style={styles.compColumn}>
                        <Text style={styles.compLabel}>Customer Reported:</Text>
                        <Text style={styles.compReported}>{report.reportedValue || 'N/A'}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerMeta}>
                      Reported by {report.reporterName || 'Customer'} •{' '}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </Text>

                    {report.status !== 'RESOLVED' && !isSelected && (
                      <TouchableOpacity
                        style={styles.resolveBtn}
                        onPress={() => {
                          setSelectedReport(report);
                          setResolutionNotes('');
                        }}
                      >
                        <Text style={styles.resolveBtnText}>Triage</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Resolution Action Drawer */}
                  {isSelected && (
                    <View style={styles.actionDrawer}>
                      <Text style={styles.drawerTitle}>Triage Discrepancy:</Text>
                      <TextInput
                        style={styles.drawerInput}
                        placeholder="Optional resolution notes..."
                        value={resolutionNotes}
                        onChangeText={setResolutionNotes}
                      />
                      <View style={styles.drawerActions}>
                        <TouchableOpacity
                          style={styles.drawerCancelBtn}
                          onPress={() => setSelectedReport(null)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.drawerCancelText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drawerRejectBtn}
                          onPress={() => handleAction('REJECTED')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.drawerRejectText}>Dismiss</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drawerInvestigateBtn}
                          onPress={() => handleAction('INVESTIGATING')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.drawerInvestigateText}>Investigate</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.drawerConfirmBtn, { backgroundColor: '#0284c7' }]}
                          onPress={() => handleAction('RESOLVED', 'RESOLVED_ONLY')}
                          disabled={isProcessing}
                        >
                          <Text style={styles.drawerConfirmText}>Resolve Only</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.drawerConfirmBtn}
                          onPress={() => handleAction('RESOLVED', 'CATALOG_CORRECTED')}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                          ) : (
                            <Text style={styles.drawerConfirmText}>Resolve & Flag Catalog Correction</Text>
                          )}
                        </TouchableOpacity>
                      </View>

                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  statusPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.onPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    padding: 0,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  grid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fffaf5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  statusOpen: {
    backgroundColor: colors.dangerSoft,
  },
  statusInvestigating: {
    backgroundColor: colors.warningSoft,
  },
  statusResolved: {
    backgroundColor: colors.successSoft,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  cardMain: {
    gap: 2,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dishName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info,
  },
  messageText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  comparisonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compColumn: {
    alignItems: 'center',
    gap: 2,
  },
  compLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  compCatalog: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  compReported: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 8,
  },
  footerMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  actionDrawer: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  drawerInput: {
    backgroundColor: colors.card,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
  },
  drawerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  drawerCancelBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  drawerCancelText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  drawerRejectBtn: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  drawerRejectText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  drawerInvestigateBtn: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  drawerInvestigateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  drawerConfirmBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  drawerConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
