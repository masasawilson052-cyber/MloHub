import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { RestaurantEntity } from '../../db/types';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { ThemeQuickSwitcher } from '../theme/ThemeQuickSwitcher';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type RealtimeStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

export interface RestaurantPortalHeaderProps {
  restaurant: RestaurantEntity;
  userRoleLabel: string;
  realtimeStatus: RealtimeStatus;
  onRefresh: () => void;
  onLogout: () => void;
  onToggleMobileNav?: () => void;
  branches?: { id: string; name: string }[];
  activeBranchId?: string;
  onSelectBranch?: (branchId: string) => void;
}

export const RestaurantPortalHeader: React.FC<RestaurantPortalHeaderProps> = ({
  restaurant,
  userRoleLabel,
  realtimeStatus,
  onRefresh,
  onLogout,
  onToggleMobileNav,
  branches = [],
  activeBranchId,
  onSelectBranch,
}) => {
  const router = useRouter();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { unreadCount } = useNotifications();

  const activeBranchName =
    branches.find((b) => b.id === activeBranchId)?.name ||
    restaurant.neighborhood ||
    restaurant.regionCity ||
    'No branch selected';

  const statusTone =
    realtimeStatus === 'LIVE'
      ? { bg: colors.successSoft, dot: colors.success, text: colors.success, label: 'LIVE' }
      : realtimeStatus === 'RECONNECTING'
      ? { bg: colors.warningSoft, dot: colors.warning, text: colors.warning, label: 'RECONNECTING' }
      : { bg: colors.dangerSoft, dot: colors.danger, text: colors.danger, label: 'OFFLINE' };

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: colors.topbarBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {onToggleMobileNav && (
          <TouchableOpacity
            style={[
              styles.menuIconBtn,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
            onPress={onToggleMobileNav}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
          >
            <Ionicons name="menu-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        <View style={[styles.brandBadge, { backgroundColor: colors.primarySoft }]}>
          <Text style={styles.brandEmoji}>🍳</Text>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.restaurantName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {restaurant.name}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                {userRoleLabel}
              </Text>
            </View>
            {restaurant.isPublished && (
              <View style={[styles.roleBadge, { backgroundColor: colors.successSoft }]}>
                <Text style={[styles.roleBadgeText, { color: colors.success, fontWeight: '800' }]}>
                  ● LIVE
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.neighborhoodText, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {restaurant.neighborhood || restaurant.regionCity || restaurant.address || 'Merchant Operations Workbench'}
          </Text>
        </View>
      </View>

      {/* Right Cluster: [Branch] [LIVE] [Theme] [Notifications] [Refresh] [Account/Logout] */}
      <View style={styles.rightRow}>
        {/* Branch Pill */}
        <TouchableOpacity
          style={[
            styles.branchPill,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          disabled={branches.length <= 1 || !onSelectBranch}
          onPress={() => {
            if (branches.length > 1 && onSelectBranch) {
              const idx = branches.findIndex((b) => b.id === activeBranchId);
              const next = branches[(idx + 1) % branches.length];
              if (next) onSelectBranch(next.id);
            }
          }}
          accessibilityLabel={`Branch: ${activeBranchName}`}
        >
          <Ionicons name="storefront-outline" size={13} color={colors.primary} />
          <Text
            style={[styles.branchPillText, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {activeBranchName}
          </Text>
        </TouchableOpacity>

        {/* Realtime LIVE Status Indicator */}
        <View style={[styles.realtimePill, { backgroundColor: statusTone.bg }]}>
          <View style={[styles.realtimeDot, { backgroundColor: statusTone.dot }]} />
          <Text style={[styles.realtimeText, { color: statusTone.text }]}>
            {statusTone.label}
          </Text>
        </View>

        {/* Top-Right Theme Quick Switcher */}
        <ThemeQuickSwitcher />

        {/* Notifications */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={() => router.push('/notifications')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Notifications. ${unreadCount} unread.`}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View
              style={[
                styles.notifBadge,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.topbarBackground,
                },
              ]}
            >
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Refresh Action */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh portal data"
        >
          <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Account / Logout */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: 'transparent',
            },
          ]}
          onPress={onLogout}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Log out from restaurant portal"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  headerContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    flexWrap: 'wrap',
    gap: 10,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 200,
    marginRight: Spacing.sm,
  },
  menuIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandEmoji: {
    fontSize: 20,
  },
  nameBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  neighborhoodText: {
    fontSize: 11,
    marginTop: 1,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: Radii.full,
    borderWidth: 1,
    maxWidth: 150,
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: Radii.full,
    gap: 6,
  },
  realtimeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  realtimeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  notifBadgeText: {
    color: colors.onPrimary,
    fontSize: 8,
    fontWeight: '900',
  },
});
let styles = createStyles(lightColors);
