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
import { RestaurantApplicationEntity } from '../../db/types';
import { ApplicationDetail } from './ApplicationDetail';

type AppFilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface ApplicationsQueueProps {
  applications: RestaurantApplicationEntity[];
  onApprove: (appId: string) => Promise<void>;
  onReject: (appId: string, reason: string) => Promise<void>;
  onRequestChanges?: (appId: string, note: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const ApplicationsQueue: React.FC<ApplicationsQueueProps> = ({
  applications,
  onApprove,
  onReject,
  onRequestChanges,
  language = 'en',
}) => {
  const [selectedFilter, setSelectedFilter] = useState<AppFilterStatus>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeApp, setActiveApp] = useState<RestaurantApplicationEntity | null>(null);

  const filteredApps = applications.filter((app) => {
    const matchesFilter =
      selectedFilter === 'ALL' || app.status === selectedFilter;

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      app.businessName.toLowerCase().includes(query) ||
      app.ownerName.toLowerCase().includes(query) ||
      app.ownerPhone.includes(query) ||
      app.neighborhood.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const pendingCount = applications.filter((a) => a.status === 'PENDING').length;
  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter((a) => a.status === 'REJECTED').length;

  return (
    <View style={styles.container}>
      {/* Header & Stats */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Maombi ya Migahawa na Vibanda' : 'Restaurant Applications Queue'}
          </Text>
          <Text style={styles.subtitle}>
            Review registration submissions, verify TIN credentials, and provision owner access.
          </Text>
        </View>
      </View>

      {/* Filter Tabs & Search */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'PENDING' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('PENDING')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'PENDING' && styles.filterPillTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'ALL' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('ALL')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'ALL' && styles.filterPillTextActive]}>
              All ({applications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'APPROVED' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('APPROVED')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'APPROVED' && styles.filterPillTextActive]}>
              Approved ({approvedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, selectedFilter === 'REJECTED' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('REJECTED')}
          >
            <Text style={[styles.filterPillText, selectedFilter === 'REJECTED' && styles.filterPillTextActive]}>
              Rejected ({rejectedCount})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search business, owner, phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Applications List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="documents-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Applications Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'PENDING'
                ? 'All pending restaurant applications have been resolved!'
                : 'No records matching the selected filter or search term.'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filteredApps.map((app) => {
              const isPending = app.status === 'PENDING';
              const isApproved = app.status === 'APPROVED';
              const isRejected = app.status === 'REJECTED';

              return (
                <TouchableOpacity
                  key={app.id}
                  style={styles.appCard}
                  onPress={() => setActiveApp(app)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.titleArea}>
                      <Text style={styles.businessName} numberOfLines={1}>
                        {app.businessName}
                      </Text>
                      <Text style={styles.cuisineText}>{app.cuisineType} • {app.neighborhood}</Text>
                    </View>
                    <View
                      style={[
                        styles.cardStatusBadge,
                        isApproved
                          ? styles.badgeApproved
                          : isRejected
                          ? styles.badgeRejected
                          : styles.badgePending,
                      ]}
                    >
                      <Text style={styles.cardStatusText}>{app.status}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardBody}>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={14} color="#64748b" />
                      <Text style={styles.metaText}>{app.ownerName}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={14} color="#64748b" />
                      <Text style={styles.metaText}>{app.ownerPhone}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons
                        name={app.hasTinOrLicense ? 'shield-checkmark' : 'shield-outline'}
                        size={14}
                        color={app.hasTinOrLicense ? '#059669' : '#94a3b8'}
                      />
                      <Text style={styles.metaText}>
                        {app.hasTinOrLicense ? 'TIN / Official License On File' : 'Informal / Basic Vendor'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>
                      Submitted {new Date(app.createdAt).toLocaleDateString()}
                    </Text>
                    <View style={styles.viewAction}>
                      <Text style={styles.viewActionText}>Inspect</Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <ApplicationDetail
        application={activeApp}
        visible={!!activeApp}
        onClose={() => setActiveApp(null)}
        onApprove={onApprove}
        onReject={onReject}
        onRequestChanges={onRequestChanges}
        language={language}
      />
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
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  searchBar: {
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
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  appCard: {
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
  titleArea: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cuisineText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cardStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  badgePending: {
    backgroundColor: '#ffedd5',
  },
  badgeApproved: {
    backgroundColor: '#dcfce7',
  },
  badgeRejected: {
    backgroundColor: '#fee2e2',
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  cardBody: {
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  viewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});
