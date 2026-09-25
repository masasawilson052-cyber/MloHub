import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { AuditLogEntity } from '../../db/types';

import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface AuditLogViewerProps {
  logs: AuditLogEntity[];
  language?: 'en' | 'sw';
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs,
  language = 'en',
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filtered = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (entityFilter !== 'ALL' && log.targetType !== entityFilter) return false;

    if (dateFilter !== 'ALL') {
      const logDate = new Date(log.timestamp).getTime();
      const now = Date.now();
      const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
      if (dateFilter === 'TODAY' && diffDays > 1) return false;
      if (dateFilter === '7_DAYS' && diffDays > 7) return false;
      if (dateFilter === '30_DAYS' && diffDays > 30) return false;
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      log.action.toLowerCase().includes(query) ||
      (log.adminName && log.adminName.toLowerCase().includes(query)) ||
      log.targetId.toLowerCase().includes(query) ||
      (log.targetType && log.targetType.toLowerCase().includes(query))
    );
  });


  const getActionBadge = (action: string) => {
    if (action.includes('REJECT') || action.includes('SUSPEND') || action.includes('REVOKE')) {
      return { bg: '#fee2e2', color: colors.danger };
    }
    if (action.includes('APPROVE') || action.includes('REACTIVATE') || action.includes('GRANT')) {
      return { bg: '#dcfce7', color: colors.success };
    }
    if (action.includes('BROADCAST')) {
      return { bg: '#fef3c7', color: colors.warning };
    }
    return { bg: '#eff6ff', color: colors.info };
  };

  const sanitizeDetails = (details: Record<string, any> | undefined) => {
    if (!details) return '{}';
    const copy = { ...details };
    // Redact password or pin hashes if any
    if (copy.pin) copy.pin = '****';
    if (copy.passwordHash) copy.passwordHash = '[REDACTED]';
    return JSON.stringify(copy, null, 2);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Kumbukumbu ya Ulinzi na Utawala' : 'Immutable Governance Audit Trail'}
          </Text>
          <Text style={styles.subtitle}>
            Append-only security log recording administrative decisions, approvals, suspensions, and role changes.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          {[
            'ALL',
            'APPROVE_APPLICATION',
            'REJECT_APPLICATION',
            'SUSPEND_RESTAURANT',
            'REACTIVATE_RESTAURANT',
            'ONBOARD_RESTAURANT',
            'BROADCAST_ANNOUNCEMENT',
            'GRANT_ADMIN',
            'REVOKE_ADMIN',
          ].map((act) => (
            <TouchableOpacity
              key={act}
              style={[styles.pill, actionFilter === act && styles.pillActive]}
              onPress={() => setActionFilter(act)}
            >
              <Text style={[styles.pillText, actionFilter === act && styles.pillTextActive]}>
                {act === 'ALL' ? 'All Actions' : act.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterPills, { marginTop: 6 }]}>
          {([
            { id: 'ALL', label: 'All Time' },
            { id: 'TODAY', label: 'Today (24h)' },
            { id: '7_DAYS', label: 'Past 7 Days' },
            { id: '30_DAYS', label: 'Past 30 Days' },
          ] as const).map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.pill, dateFilter === d.id && styles.pillActive]}
              onPress={() => setDateFilter(d.id)}
            >
              <Text style={[styles.pillText, dateFilter === d.id && styles.pillTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>


        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search action, actor, target..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Audit Log Stream */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Audit Records Found</Text>
            <Text style={styles.emptySubtitle}>No records match the current filter.</Text>
          </View>
        ) : (
          <View style={styles.logList}>
            {filtered.map((log) => {
              const badge = getActionBadge(log.action);
              const isExpanded = expandedLogId === log.id;

              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logTopRow}>
                    <View style={styles.leftHeader}>
                      <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.actionText, { color: badge.color }]}>{log.action}</Text>
                      </View>
                      <Text style={styles.targetInfo}>
                        Target: {log.targetType} ({log.targetId})
                      </Text>
                    </View>
                    <Text style={styles.timestamp}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} •{' '}
                      {new Date(log.timestamp).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.logActorRow}>
                    <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.actorText}>
                      Executed by: <Text style={styles.actorHighlight}>{log.adminName || log.adminUserId}</Text>
                    </Text>
                  </View>

                  {/* Expand / Collapse Metadata */}
                  {log.details && Object.keys(log.details).length > 0 && (
                    <View style={styles.metadataSection}>
                      <TouchableOpacity
                        style={styles.expandToggle}
                        onPress={() => setExpandedLogId(isExpanded ? null : log.id)}
                      >
                        <Text style={styles.expandToggleText}>
                          {isExpanded ? 'Hide Event Metadata' : 'View Event Metadata'}
                        </Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={colors.primary}
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.jsonBox}>
                          <Text style={styles.jsonCode}>{sanitizeDetails(log.details)}</Text>
                        </View>
                      )}
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
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
    fontSize: 11,
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
  },
  logList: {
    gap: Spacing.sm,
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: 6,
    ...Shadows.sm,
  },
  logTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  targetInfo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },
  logActorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actorText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actorHighlight: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metadataSection: {
    marginTop: 4,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  jsonBox: {
    backgroundColor: colors.primary,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginTop: 6,
  },
  jsonCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.border,
  },
});
let styles = createStyles(lightColors);
