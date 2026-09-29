import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AuditLog } from '../../types/domain';
import { AuditLogEntity } from '../../db/types';
import { AuditLogRepository } from '../../repositories/auditLogs.repository';
import { AdminDataState } from './AdminDataState';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface AuditLogViewerProps {
  logs?: AuditLogEntity[];
  language?: 'en' | 'sw';
}

type DateFilterType = 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS';

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs: initialLogsFallback = [],
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const getDateBounds = (filter: DateFilterType) => {
    if (filter === 'ALL') return { from: undefined, to: undefined };
    const now = new Date();
    const fromDate = new Date();
    if (filter === 'TODAY') {
      fromDate.setHours(0, 0, 0, 0);
    } else if (filter === '7_DAYS') {
      fromDate.setDate(now.getDate() - 7);
    } else if (filter === '30_DAYS') {
      fromDate.setDate(now.getDate() - 30);
    }
    return { from: fromDate.toISOString(), to: now.toISOString() };
  };

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateBounds(dateFilter);
      const res = await AuditLogRepository.listAdminPage({
        page,
        pageSize,
        status: actionFilter !== 'ALL' ? actionFilter : undefined,
        from,
        to,
        search: searchQuery.trim() || undefined,
      });

      setLogs(res.items);
      setTotalCount(res.total);
      setHasNext(res.hasNext);
    } catch (err: any) {
      console.warn('[AuditLogViewer] Failed to load server audit page:', err?.message);
      if (initialLogsFallback.length > 0) {
        // Fallback for offline test harness
        const mapped = initialLogsFallback.map((l) => ({
          id: l.id,
          actorUserId: l.adminUserId,
          adminName: l.adminName,
          action: l.action,
          entityType: l.targetType,
          entityId: l.targetId,
          metadata: l.details,
          ipAddress: l.ipAddress,
          createdAt: l.timestamp,
        }));
        setLogs(mapped);
        setTotalCount(mapped.length);
        setHasNext(false);
      } else {
        setError(err?.message || 'Authoritative audit trail unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFilter, searchQuery, initialLogsFallback]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('REJECT') || act.includes('SUSPEND') || act.includes('REVOKE') || act.includes('HOLD')) {
      return { bg: colors.dangerSoft, color: colors.danger };
    }
    if (act.includes('APPROVE') || act.includes('REACTIVATE') || act.includes('GRANT') || act.includes('RELEASE')) {
      return { bg: colors.successSoft, color: colors.success };
    }
    if (act.includes('BROADCAST') || act.includes('RECONCILE')) {
      return { bg: colors.warningSoft, color: colors.warning };
    }
    return { bg: colors.infoSoft, color: colors.info };
  };

  const sanitizeDetails = (details: Record<string, any> | undefined) => {
    if (!details) return '{}';
    const copy = { ...details };
    const sensitiveKeys = [
      'pin',
      'password',
      'passwordHash',
      'token',
      'secret',
      'key',
      'apiKey',
      'authorization',
      'jwt',
      'cookie',
    ];
    for (const key of Object.keys(copy)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        copy[key] = '[REDACTED]';
      }
    }
    return JSON.stringify(copy, null, 2);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Kumbukumbu ya Ulinzi na Utawala' : 'Immutable Governance Audit Trail'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Append-only security log recording administrative decisions, approvals, suspensions, and role changes.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={loadLogs}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh audit logs"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={16} color={colors.textPrimary} />
          )}
          <Text style={[styles.refreshBtnText, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Sasisha' : 'Refresh'}
          </Text>
        </TouchableOpacity>
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
            'HOLD_SETTLEMENT',
            'RELEASE_SETTLEMENT_HOLD',
            'RETRY_PAYOUT',
            'RESOLVE_DISPUTE',
            'ADMIN_RECONCILE_PAYMENT',
            'GRANT_ADMIN',
            'REVOKE_ADMIN',
          ].map((act) => (
            <TouchableOpacity
              key={act}
              style={[
                styles.pill,
                { backgroundColor: colors.card, borderColor: colors.border },
                actionFilter === act && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => {
                setActionFilter(act);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  actionFilter === act && { color: colors.onPrimary, fontWeight: '700' },
                ]}
              >
                {act === 'ALL' ? 'All Actions' : act.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.dateAndSearchRow}>
          <View style={styles.datePills}>
            {(
              [
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today (24h)' },
                { id: '7_DAYS', label: 'Past 7 Days' },
                { id: '30_DAYS', label: 'Past 30 Days' },
              ] as const
            ).map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.datePill,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  dateFilter === d.id && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => {
                  setDateFilter(d.id);
                  setPage(1);
                }}
              >
                <Text
                  style={[
                    styles.datePillText,
                    { color: colors.textSecondary },
                    dateFilter === d.id && { color: colors.onPrimary, fontWeight: '700' },
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search action, actor, target..."
              placeholderTextColor={colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={(txt) => {
                setSearchQuery(txt);
                setPage(1);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Main Data State & List */}
      <AdminDataState
        loading={loading}
        error={error}
        isEmpty={logs.length === 0}
        emptyTitle="No Audit Logs Recorded"
        emptySubtitle="No governance actions match the selected action or timeframe criteria."
        emptyIcon="shield-outline"
        onRetry={loadLogs}
      >
        <ScrollView style={styles.logList} contentContainerStyle={styles.logListContent} showsVerticalScrollIndicator={false}>
          {logs.map((log) => {
            const badge = getActionBadge(log.action);
            const isExpanded = expandedLogId === log.id;

            return (
              <View
                key={log.id}
                style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => setExpandedLogId(isExpanded ? null : log.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.actionBadgeRow}>
                      <View style={[styles.actionBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.actionBadgeText, { color: badge.color }]}>{log.action}</Text>
                      </View>
                      <View style={[styles.targetTypeBadge, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[styles.targetTypeText, { color: colors.textSecondary }]}>
                          {log.entityType}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.actorRow}>
                    <View style={styles.actorItem}>
                      <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
                      <Text style={[styles.actorLabel, { color: colors.textSecondary }]}>Actor:</Text>
                      <Text style={[styles.actorValue, { color: colors.textPrimary }]}>
                        {log.adminName || log.actorUserId}
                      </Text>
                    </View>

                    <View style={styles.actorItem}>
                      <Ionicons name="key-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.actorLabel, { color: colors.textSecondary }]}>Target ID:</Text>
                      <Text
                        style={[
                          styles.targetId,
                          {
                            color: colors.textPrimary,
                            fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
                          },
                        ]}
                      >
                        {log.entityId}
                      </Text>
                    </View>

                    {log.ipAddress && (
                      <View style={styles.actorItem}>
                        <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.actorLabel, { color: colors.textSecondary }]}>IP:</Text>
                        <Text style={[styles.actorValue, { color: colors.textPrimary }]}>{log.ipAddress}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.expandedDetails, { borderTopColor: colors.divider }]}>
                    <Text style={[styles.detailsTitle, { color: colors.textSecondary }]}>
                      Event Metadata (Sanitized):
                    </Text>
                    <Text
                      style={[
                        styles.jsonDetails,
                        {
                          backgroundColor: colors.surfaceHover,
                          color: colors.textPrimary,
                          fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
                        },
                      ]}
                    >
                      {sanitizeDetails(log.metadata)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <View style={[styles.paginationBar, { borderColor: colors.border }]}>
              <Text style={[styles.pageInfoText, { color: colors.textSecondary }]}>
                Page {page} of {totalPages} ({totalCount} total audit entries)
              </Text>

              <View style={styles.pageBtnGroup}>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    page <= 1 && { opacity: 0.4 },
                  ]}
                  disabled={page <= 1 || loading}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page of audit logs"
                >
                  <Ionicons name="chevron-back" size={15} color={colors.textPrimary} />
                  <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Prev</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    (!hasNext && page >= totalPages) && { opacity: 0.4 },
                  ]}
                  disabled={(!hasNext && page >= totalPages) || loading}
                  onPress={() => setPage((p) => p + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Next page of audit logs"
                >
                  <Text style={[styles.pageBtnText, { color: colors.textPrimary }]}>Next</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </AdminDataState>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
      gap: 16,
      flexWrap: 'wrap',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      marginTop: 4,
      maxWidth: 700,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    refreshBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    controlsRow: {
      marginBottom: 16,
      gap: 10,
    },
    filterPills: {
      flexDirection: 'row',
      gap: 6,
    },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    dateAndSearchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    datePills: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    datePill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    datePillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: 240,
      maxWidth: 320,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      padding: 0,
    },
    logList: {
      flex: 1,
    },
    logListContent: {
      gap: 10,
      paddingBottom: 40,
    },
    logCard: {
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden',
    },
    cardMain: {
      padding: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    actionBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    targetTypeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    targetTypeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    timestamp: {
      fontSize: 11,
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    },
    actorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actorLabel: {
      fontSize: 11,
    },
    actorValue: {
      fontSize: 12,
      fontWeight: '600',
    },
    targetId: {
      fontSize: 12,
    },
    expandedDetails: {
      borderTopWidth: 1,
      padding: 14,
    },
    detailsTitle: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
    },
    jsonDetails: {
      fontSize: 11,
      padding: 10,
      borderRadius: 6,
      lineHeight: 16,
    },
    paginationBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 12,
    },
    pageInfoText: {
      fontSize: 12,
      fontWeight: '600',
    },
    pageBtnGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pageBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });

let styles = createStyles(lightColors);
