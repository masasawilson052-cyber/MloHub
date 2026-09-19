import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { RestaurantEntity } from '../../db/types';

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
  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftRow}>
        {onToggleMobileNav && (
          <TouchableOpacity
            style={styles.menuIconBtn}
            onPress={onToggleMobileNav}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
          >
            <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}

        <View style={styles.brandBadge}>
          <Text style={styles.brandEmoji}>🍳</Text>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{userRoleLabel}</Text>
            </View>
          </View>

          {branches.length > 1 && onSelectBranch ? (
            <View style={styles.branchRow}>
              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.branchText}>
                {branches.find((b) => b.id === activeBranchId)?.name || 'No branch selected'}
              </Text>
            </View>
          ) : (
            <Text style={styles.neighborhoodText}>
              {restaurant.neighborhood || restaurant.regionCity || restaurant.address || ''}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightRow}>
        {/* Realtime Status Indicator */}
        <View style={styles.realtimePill}>
          <View
            style={[
              styles.realtimeDot,
              realtimeStatus === 'LIVE' && styles.dotLive,
              realtimeStatus === 'RECONNECTING' && styles.dotReconnecting,
              realtimeStatus === 'OFFLINE' && styles.dotOffline,
            ]}
          />
          <Text style={styles.realtimeText}>
            {realtimeStatus === 'LIVE'
              ? 'Live'
              : realtimeStatus === 'RECONNECTING'
              ? 'Reconnecting...'
              : 'Offline'}
          </Text>
        </View>

        {/* Refresh Action */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh portal data"
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Logout / Switch Workspace */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onLogout}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Log out from restaurant portal"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  menuIconBtn: {
    marginRight: Spacing.sm,
    padding: 4,
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  brandEmoji: {
    fontSize: 22,
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
    ...Typography.H3,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  roleBadge: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  roleBadgeText: {
    ...Typography.Caption,
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  neighborhoodText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  branchText: {
    ...Typography.Caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radii.full,
    gap: 5,
  },
  realtimeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLive: {
    backgroundColor: Colors.success,
  },
  dotReconnecting: {
    backgroundColor: Colors.warning,
  },
  dotOffline: {
    backgroundColor: Colors.error,
  },
  realtimeText: {
    ...Typography.Caption,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
