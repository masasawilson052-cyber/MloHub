import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { UserEntity, UserRole } from '../../db/types';

interface UsersManagerProps {
  users: UserEntity[];
  onToggleSuspendUser?: (userId: string, shouldSuspend: boolean, reason?: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const UsersManager: React.FC<UsersManagerProps> = ({
  users,
  onToggleSuspendUser,
  language = 'en',
}) => {
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = users.filter((u) => {
    // Hide platform operators from standard user manager; they are in AdminUsersManager
    if (u.role === UserRole.ADMIN || u.role === UserRole.SUPER_ADMIN) return false;

    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      u.fullName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.phone.includes(query)
    );
  });

  const handleToggleSuspend = (user: UserEntity) => {
    const isCurrentlySuspended = user.status === 'SUSPENDED';
    const actionText = isCurrentlySuspended ? 'reactivate' : 'suspend';

    Alert.alert(
      `${isCurrentlySuspended ? 'Reactivate' : 'Suspend'} User`,
      `Are you sure you want to ${actionText} "${user.fullName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlySuspended ? 'Reactivate' : 'Suspend',
          style: isCurrentlySuspended ? 'default' : 'destructive',
          onPress: async () => {
            if (onToggleSuspendUser) {
              await onToggleSuspendUser(user.id, !isCurrentlySuspended, 'Terms review');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Watumiaji wa Mfumo' : 'Users & Customer Accounts Directory'}
          </Text>
          <Text style={styles.subtitle}>
            Inspect customer profiles, vendor owner assignments, and account standing.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[styles.pill, roleFilter === 'ALL' && styles.pillActive]}
            onPress={() => setRoleFilter('ALL')}
          >
            <Text style={[styles.pillText, roleFilter === 'ALL' && styles.pillTextActive]}>
              All ({users.filter((u) => u.role !== UserRole.ADMIN && u.role !== UserRole.SUPER_ADMIN).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, roleFilter === UserRole.CUSTOMER && styles.pillActive]}
            onPress={() => setRoleFilter(UserRole.CUSTOMER)}
          >
            <Text style={[styles.pillText, roleFilter === UserRole.CUSTOMER && styles.pillTextActive]}>
              Customers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, roleFilter === UserRole.RESTAURANT_OWNER && styles.pillActive]}
            onPress={() => setRoleFilter(UserRole.RESTAURANT_OWNER)}
          >
            <Text style={[styles.pillText, roleFilter === UserRole.RESTAURANT_OWNER && styles.pillTextActive]}>
              Restaurant Owners
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, phone, email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Users List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptySubtitle}>No accounts match the search criteria.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((u) => {
              const isSuspended = u.status === 'SUSPENDED';

              return (
                <View key={u.id} style={[styles.card, isSuspended && styles.cardSuspended]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarPill}>
                      <Text style={styles.avatarEmoji}>{u.avatarEmoji || '👤'}</Text>
                    </View>
                    <View style={styles.titleArea}>
                      <Text style={styles.userName}>{u.fullName}</Text>
                      <Text style={styles.userRole}>{u.role}</Text>
                    </View>
                    <View style={[styles.statusBadge, isSuspended ? styles.statusSuspended : styles.statusActive]}>
                      <Text style={styles.statusText}>{isSuspended ? 'SUSPENDED' : 'ACTIVE'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={12} color="#64748b" />
                      <Text style={styles.infoText}>{u.phone || 'No phone'}</Text>
                      {u.isPhoneVerified && (
                        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                      )}
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="mail-outline" size={12} color="#64748b" />
                      <Text style={styles.infoText}>{u.email}</Text>
                    </View>
                    {u.companyOrGroup && (
                      <View style={styles.infoRow}>
                        <Ionicons name="business-outline" size={12} color="#64748b" />
                        <Text style={styles.infoText}>{u.companyOrGroup}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>
                      Member since {u.memberSince || '2026'}
                    </Text>
                    {onToggleSuspendUser && (
                      <TouchableOpacity
                        style={[styles.suspendActionBtn, isSuspended ? styles.reactivateActionBtn : null]}
                        onPress={() => handleToggleSuspend(u)}
                      >
                        <Text style={[styles.suspendActionText, isSuspended ? styles.reactivateActionText : null]}>
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSuspended: {
    borderColor: '#fecaca',
    backgroundColor: '#fffaf0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  titleArea: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userRole: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusSuspended: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  cardBody: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.sm,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  suspendActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: '#fee2e2',
  },
  suspendActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  reactivateActionBtn: {
    backgroundColor: '#dcfce7',
  },
  reactivateActionText: {
    color: '#16a34a',
  },
});
