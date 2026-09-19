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

  const handleAction = async (status: 'RESOLVED' | 'REJECTED' | 'INVESTIGATING') => {
    if (!selectedReport) return;
    setIsProcessing(true);
    try {
      await onResolveReport(selectedReport.id, status, resolutionNotes.trim() || undefined);
      setSelectedReport(null);
      setResolutionNotes('');
      Alert.alert(
        'Success',
        status === 'RESOLVED'
          ? 'Customer report resolved and catalog updated.'
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
        return { label: 'Wrong Price', bg: '#fee2e2', color: '#b91c1c', icon: 'pricetag-outline' as const };
      case 'ITEM_UNAVAILABLE':
        return { label: 'Unavailable', bg: '#ffedd5', color: '#c2410c', icon: 'close-circle-outline' as const };
      case 'WRONG_HOURS':
        return { label: 'Wrong Hours', bg: '#fef3c7', color: '#b45309', icon: 'time-outline' as const };
      case 'RESTAURANT_CLOSED':
        return { label: 'Closed Spot', bg: '#fee2e2', color: '#991b1b', icon: 'lock-closed-outline' as const };
      default:
        return { label: type, bg: '#eff6ff', color: '#1d4ed8', icon: 'alert-circle-outline' as const };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Ripoti za Hitilafu za Bei na Upatikanaji' : 'Customer Data Discrepancy Reports'}
          </Text>
          <Text style={styles.subtitle}>
            Investigate customer feedback on inaccurate menu prices, out-of-stock dishes, and operating hours.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.statusPills}>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'OPEN' && styles.pillActive]}
            onPress={() => setStatusFilter('OPEN')}
          >
            <Text style={[styles.pillText, statusFilter === 'OPEN' && styles.pillTextActive]}>
              Open ({openCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'INVESTIGATING' && styles.pillActive]}
            onPress={() => setStatusFilter('INVESTIGATING')}
          >
            <Text style={[styles.pillText, statusFilter === 'INVESTIGATING' && styles.pillTextActive]}>
              Investigating ({investigatingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'RESOLVED' && styles.pillActive]}
            onPress={() => setStatusFilter('RESOLVED')}
          >
            <Text style={[styles.pillText, statusFilter === 'RESOLVED' && styles.pillTextActive]}>
              Resolved ({resolvedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'ALL' && styles.pillActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.pillText, statusFilter === 'ALL' && styles.pillTextActive]}>
              All ({reports.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search report, restaurant, dish..."
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
            <Text style={styles.emptyTitle}>No Data Reports in Queue</Text>
            <Text style={styles.emptySubtitle}>
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
                  style={[styles.card, isSelected && styles.cardSelected]}
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
                    <Text style={styles.restaurantName}>
                      {report.restaurantName || report.restaurantId}
                    </Text>
                    {report.menuItemName && (
                      <Text style={styles.dishName}>Dish: {report.menuItemName}</Text>
                    )}
                    <Text style={styles.messageText}>"{report.message}"</Text>
                  </View>

                  {/* Side-by-Side Comparison if values present */}
                  {(report.reportedValue || report.catalogValue) && (
                    <View style={styles.comparisonBox}>
                      <View style={styles.compColumn}>
                        <Text style={styles.compLabel}>Catalog Value:</Text>
                        <Text style={styles.compCatalog}>{report.catalogValue || 'Unknown'}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color="#94a3b8" />
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
                        <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
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
                          style={styles.drawerConfirmBtn}
                          onPress={() => handleAction('RESOLVED')}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.drawerConfirmText}>Resolve & Update</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
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
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 320,
  },
  grid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: Colors.primary,
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
    backgroundColor: '#fee2e2',
  },
  statusInvestigating: {
    backgroundColor: '#fef3c7',
  },
  statusResolved: {
    backgroundColor: '#dcfce7',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  cardMain: {
    gap: 2,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  dishName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  messageText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    marginTop: 2,
  },
  comparisonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compColumn: {
    alignItems: 'center',
    gap: 2,
  },
  compLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  compCatalog: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  compReported: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  footerMeta: {
    fontSize: 11,
    color: '#94a3b8',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionDrawer: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  drawerInput: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#64748b',
  },
  drawerRejectBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  drawerRejectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  drawerInvestigateBtn: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  drawerInvestigateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
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
    color: '#ffffff',
  },
});
