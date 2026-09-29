import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AdminActionInboxItem } from '../../types/admin';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface AdminActionInboxProps {
  visible: boolean;
  items: AdminActionInboxItem[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelectItem: (item: AdminActionInboxItem) => void;
}

type CategoryTab = 'ALL' | 'CRITICAL' | 'FINANCE' | 'MERCHANTS' | 'SYSTEM';

export const AdminActionInbox: React.FC<AdminActionInboxProps> = ({
  visible,
  items,
  loading = false,
  error = null,
  onClose,
  onRefresh,
  onSelectItem,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<CategoryTab>('ALL');

  const filteredItems = items.filter((item) => {
    if (activeTab === 'CRITICAL') return item.severity === 'CRITICAL';
    if (activeTab === 'FINANCE') {
      return (
        item.targetTab === 'PAYMENTS' ||
        item.targetTab === 'REFUNDS' ||
        item.targetTab === 'SETTLEMENTS' ||
        item.kind.includes('PAY') ||
        item.kind.includes('REFUND') ||
        item.kind.includes('DISPUTE') ||
        item.kind.includes('SETTLEMENT')
      );
    }
    if (activeTab === 'MERCHANTS') {
      return (
        item.targetTab === 'APPLICATIONS' ||
        item.targetTab === 'RESTAURANTS' ||
        item.targetTab === 'VERIFICATION' ||
        item.kind.includes('APPLICATION') ||
        item.kind.includes('MERCHANT')
      );
    }
    if (activeTab === 'SYSTEM') {
      return (
        item.targetTab === 'HEALTH' ||
        item.targetTab === 'NOTIFICATIONS' ||
        item.kind.includes('NOTIFICATION') ||
        item.kind.includes('SECURITY') ||
        item.kind.includes('WORKER')
      );
    }
    return true;
  });

  const getSeverityBadge = (severity: AdminActionInboxItem['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: 'alert-circle' as const,
          bgColor: colors.dangerSoft,
          color: colors.danger,
        };
      case 'HIGH':
        return {
          icon: 'warning' as const,
          bgColor: colors.warningSoft,
          color: colors.warning,
        };
      case 'MEDIUM':
        return {
          icon: 'information-circle' as const,
          bgColor: colors.infoSoft,
          color: colors.info,
        };
      default:
        return {
          icon: 'help-circle' as const,
          bgColor: colors.surfaceHover,
          color: colors.textSecondary,
        };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="notifications" size={20} color={colors.primary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Action Inbox</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.countBadgeText, { color: colors.onPrimary }]}>{items.length}</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Items requiring operator attention
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.surfaceHover }]}
                onPress={onRefresh}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Refresh action inbox"
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.textPrimary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.surfaceHover }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close action inbox"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          {/* Category Tabs */}
          <View style={styles.tabsRow}>
            {(
              [
                { key: 'ALL', label: `All (${items.length})` },
                {
                  key: 'CRITICAL',
                  label: `Critical (${items.filter((i) => i.severity === 'CRITICAL').length})`,
                },
                { key: 'FINANCE', label: 'Finance' },
                { key: 'MERCHANTS', label: 'Merchants' },
                { key: 'SYSTEM', label: 'System' },
              ] as const
            ).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabPill,
                  { backgroundColor: colors.surfaceHover, borderColor: colors.border },
                  activeTab === tab.key && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: colors.textSecondary },
                    activeTab === tab.key && { color: colors.onPrimary, fontWeight: '700' },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content List */}
          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {loading && items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary, marginTop: 12 }]}>
                  Loading action inbox...
                </Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.success} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Pending Actions</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  All queues in this category are currently clear.
                </Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const badge = getSeverityBadge(item.severity);
                return (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.severityBadge, { backgroundColor: badge.bgColor }]}>
                        <Ionicons name={badge.icon} size={13} color={badge.color} />
                        <Text style={[styles.severityBadgeText, { color: badge.color }]}>
                          {item.severity}
                        </Text>
                      </View>
                      <View style={[styles.kindTag, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[styles.kindTagText, { color: colors.textMuted }]}>{item.kind}</Text>
                      </View>
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.cardDetail, { color: colors.textSecondary }]}>{item.detail}</Text>

                    <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.targetTabText, { color: colors.textMuted }]}>
                        Target Tab: {item.targetTab}
                      </Text>

                      <TouchableOpacity
                        style={[styles.reviewBtn, { backgroundColor: colors.primary }]}
                        onPress={() => onSelectItem(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Review ${item.title}`}
                      >
                        <Text style={[styles.reviewBtnText, { color: colors.onPrimary }]}>Review</Text>
                        <Ionicons name="arrow-forward" size={13} color={colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 640,
      maxHeight: '90%',
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
    },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    tabPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    tabPillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    scrollList: {
      maxHeight: 460,
    },
    scrollContent: {
      gap: 10,
      paddingBottom: 10,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    emptySubtitle: {
      fontSize: 12,
      textAlign: 'center',
      maxWidth: 320,
    },
    card: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    severityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    severityBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    kindTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    kindTagText: {
      fontSize: 10,
      fontWeight: '600',
    },
    timeText: {
      fontSize: 11,
      marginLeft: 'auto',
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 2,
    },
    cardDetail: {
      fontSize: 12,
      lineHeight: 16,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
    },
    targetTabText: {
      fontSize: 11,
      fontStyle: 'italic',
    },
    reviewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 6,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    reviewBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
  });

let styles = createStyles(lightColors);
