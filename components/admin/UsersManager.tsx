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
import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

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
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedUsers, setRevealedUsers] = useState<Record<string, boolean>>({});

  const formatPhone = (phone?: string) => {
    if (!phone) return 'No phone';
    const clean = phone.replace(/\s+/g, '');
    if (clean.startsWith('+')) {
      return clean;
    }
    if (clean.startsWith('255') && clean.length === 12) {
      return `+255 ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
    }
    if (clean.startsWith('0') && clean.length === 10) {
      return `+255 ${clean.slice(1, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
    }
    return clean;
  };

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
              await onToggleSuspendUser(user.id, !isCurrentlySuspended, 'Administrative review');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.appBackground }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Watumiaji wa Mfumo' : 'Users & Customer Accounts Directory'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Inspect customer profiles, vendor owner assignments, and account standing with privacy safeguards.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPills}>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              roleFilter === 'ALL' && styles.pillActive,
            ]}
            onPress={() => setRoleFilter('ALL')}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                roleFilter === 'ALL' && styles.pillTextActive,
              ]}
            >
              All ({users.filter((u) => u.role !== UserRole.ADMIN && u.role !== UserRole.SUPER_ADMIN).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              roleFilter === UserRole.CUSTOMER && styles.pillActive,
            ]}
            onPress={() => setRoleFilter(UserRole.CUSTOMER)}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                roleFilter === UserRole.CUSTOMER && styles.pillTextActive,
              ]}
            >
              Customers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pill,
              { backgroundColor: colors.card, borderColor: colors.border },
              roleFilter === UserRole.RESTAURANT_OWNER && styles.pillActive,
            ]}
            onPress={() => setRoleFilter(UserRole.RESTAURANT_OWNER)}
          >
            <Text
              style={[
                styles.pillText,
                { color: colors.textSecondary },
                roleFilter === UserRole.RESTAURANT_OWNER && styles.pillTextActive,
              ]}
            >
              Restaurant Owners
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search name, phone, email..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Users List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Users Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No accounts match the search criteria.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((u) => {
              const isSuspended = u.status === 'SUSPENDED';
              const isRevealed = !!revealedUsers[u.id];

              return (
                <View
                  key={u.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSuspended && styles.cardSuspended,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarPill}>
                      <Text style={styles.avatarEmoji}>{u.avatarEmoji || '👤'}</Text>
                    </View>
                    <View style={styles.titleArea}>
                      <Text style={[styles.userName, { color: colors.textPrimary }]}>{u.fullName}</Text>
                      <Text style={[styles.userRole, { color: colors.textSecondary }]}>{u.role}</Text>
                    </View>
                    <View style={[styles.statusBadge, isSuspended ? styles.statusSuspended : styles.statusActive]}>
                      <Text style={styles.statusText}>{isSuspended ? 'SUSPENDED' : 'ACTIVE'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.infoText}>
                        {u.phone ? formatPhone(u.phone) : 'No phone'}
                      </Text>
                      {u.isPhoneVerified && (
                        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                      )}
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.infoText}>
                        {u.email || 'No email'}
                      </Text>
                    </View>
                    {u.companyOrGroup && (
                      <View style={styles.infoRow}>
                        <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.infoText}>{u.companyOrGroup}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.revealBtn}
                      onPress={() => setRevealedUsers((prev) => ({ ...prev, [u.id]: !isRevealed }))}
                    >
                      <Ionicons name={isRevealed ? "eye-off-outline" : "eye-outline"} size={13} color={colors.textSecondary} />
                      <Text style={styles.revealBtnText}>{isRevealed ? 'Hide PII' : 'Reveal'}</Text>
                    </TouchableOpacity>

                    <Text style={styles.dateText}>
                      Since {u.memberSince || '2026'}
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
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 280,
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardSuspended: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
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
    backgroundColor: colors.surfaceInteractive,
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
    color: colors.textPrimary,
  },
  userRole: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  statusActive: {
    backgroundColor: colors.successSoft,
  },
  statusSuspended: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  cardBody: {
    backgroundColor: colors.appBackground,
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
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 6,
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  suspendActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: colors.dangerSoft,
  },
  suspendActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  reactivateActionBtn: {
    backgroundColor: colors.successSoft,
  },
  reactivateActionText: {
    color: colors.success,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    backgroundColor: colors.surfaceInteractive,
  },
  revealBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
let styles = createStyles(lightColors);
