import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { UserRole } from '../../db/types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { runtimeConfig } from '../../lib/runtimeConfig';

interface AdminHeaderProps {
  userName?: string;
  userRole?: UserRole | string;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onSwitchToCustomer?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  userName = 'Platform Operator',
  userRole = UserRole.ADMIN,
  isRefreshing = false,
  onRefresh,
  onLogout,
  onSwitchToCustomer,
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const isLive = isSupabaseConfigured();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.brandingRow}>
        <View style={styles.logoBadge}>
          <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
        </View>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.portalTitle}>MloHub Governance</Text>
            <View style={[styles.envPill, runtimeConfig.isProduction ? styles.prodPill : runtimeConfig.isStaging ? styles.stagingPill : styles.devPill]}>
              <Text style={[styles.envText, runtimeConfig.isProduction ? styles.prodText : runtimeConfig.isStaging ? styles.stagingText : styles.devText]}>
                {runtimeConfig.environmentLabel}
              </Text>
            </View>
            <View style={[styles.realtimePill, isLive ? styles.livePill : styles.mockPill]}>
              <View style={[styles.pulseDot, isLive ? styles.liveDot : styles.mockDot]} />
              <Text style={[styles.realtimeText, isLive ? styles.liveText : styles.mockText]}>
                {isLive ? 'SUPABASE LIVE' : 'OFFLINE BUS'}
              </Text>
            </View>
          </View>
          <Text style={styles.portalSubtitle}>Platform Operations & Control Center</Text>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.userBadge}>
          <View style={[styles.roleTag, isSuperAdmin ? styles.superAdminTag : styles.adminTag]}>
            <Text style={[styles.roleTagText, isSuperAdmin ? styles.superAdminText : styles.adminText]}>
              {isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}
            </Text>
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionIconButton}
          onPress={onRefresh}
          disabled={isRefreshing}
          accessibilityLabel="Refresh portal data"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={Colors.textPrimary} />
          )}
        </TouchableOpacity>

        {onSwitchToCustomer && (
          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToCustomer}
            accessibilityLabel="Switch to customer app"
          >
            <Ionicons name="storefront-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.switchButtonText}>Customer View</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          accessibilityLabel="Log out of admin portal"
        >
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  portalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  envPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  prodPill: {
    backgroundColor: '#fee2e2',
  },
  stagingPill: {
    backgroundColor: '#fef3c7',
  },
  devPill: {
    backgroundColor: '#e0f2fe',
  },
  envText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  prodText: {
    color: '#b91c1c',
  },
  stagingText: {
    color: '#b45309',
  },
  devText: {
    color: '#0369a1',
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
    gap: 4,
  },
  livePill: {
    backgroundColor: '#ecfdf5',
  },
  mockPill: {
    backgroundColor: '#fffbeb',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveDot: {
    backgroundColor: '#10b981',
  },
  mockDot: {
    backgroundColor: '#f59e0b',
  },
  realtimeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveText: {
    color: '#047857',
  },
  mockText: {
    color: '#b45309',
  },
  portalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.xs,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  superAdminTag: {
    backgroundColor: '#fdf2f8',
  },
  adminTag: {
    backgroundColor: '#eff6ff',
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  superAdminText: {
    color: '#be185d',
  },
  adminText: {
    color: '#1d4ed8',
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 130,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: Radii.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
