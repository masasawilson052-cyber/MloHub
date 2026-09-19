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

interface AuditLogViewerProps {
  logs: AuditLogEntity[];
  language?: 'en' | 'sw';
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs,
  language = 'en',
}) => {
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filtered = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

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
      return { bg: '#fee2e2', color: '#b91c1c' };
    }
    if (action.includes('APPROVE') || action.includes('REACTIVATE') || action.includes('GRANT')) {
      return { bg: '#dcfce7', color: '#15803d' };
    }
    if (action.includes('BROADCAST')) {
      return { bg: '#fef3c7', color: '#b45309' };
    }
    return { bg: '#eff6ff', color: '#1d4ed8' };
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
                {act === 'ALL' ? 'All Events' : act.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#94a3b8" />
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
            <Ionicons name="shield-outline" size={48} color="#cbd5e1" />
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
                    <Ionicons name="person-circle-outline" size={14} color="#64748b" />
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
                          color={Colors.primary}
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
  filterPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
    fontSize: 11,
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
  },
  logList: {
    gap: Spacing.sm,
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#334155',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logActorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actorText: {
    fontSize: 12,
    color: '#64748b',
  },
  actorHighlight: {
    fontWeight: '700',
    color: '#0f172a',
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
    color: Colors.primary,
  },
  jsonBox: {
    backgroundColor: '#0f172a',
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginTop: 6,
  },
  jsonCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#e2e8f0',
  },
});
