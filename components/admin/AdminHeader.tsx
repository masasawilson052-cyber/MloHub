import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole } from '../../db/types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { AdminSystemHealthService, PlatformHealthStatus } from '../../services/AdminSystemHealthService';
import { useAdminPreview } from '../../context/AdminPreviewContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeQuickSwitcher } from '../theme/ThemeQuickSwitcher';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface AdminHeaderProps {
  userName?: string;
  userRole?: UserRole | string;
  activeSectionTitle?: string;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onToggleSidebar?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  userName = 'Platform Operator',
  userRole = UserRole.ADMIN,
  activeSectionTitle,
  isRefreshing = false,
  onRefresh,
  onLogout,
  onToggleSidebar,
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const isLive = isSupabaseConfigured();
  const { enterPreview } = useAdminPreview();
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isCompact = width < 960;

  const [health, setHealth] = useState<PlatformHealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    AdminSystemHealthService.getHealth()
      .then((h) => {
        if (mounted) setHealth(h);
      })
      .catch((err) => {
        console.warn('AdminHeader health check error:', err);
      });
    return () => {
      mounted = false;
    };
  }, [isRefreshing]);

  const handleSwitchToCustomer = async () => {
    await enterPreview();
  };

  const getHealthBadge = () => {
    if (!isLive) {
      return {
        label: 'DEGRADED',
        bg: colors.warningSoft,
        color: colors.warning,
      };
    }
    if (!health) {
      return {
        label: 'UNVERIFIED',
        bg: colors.infoSoft,
        color: colors.info,
      };
    }
    if (health.status === 'HEALTHY') {
      return {
        label: 'HEALTHY',
        bg: colors.successSoft,
        color: colors.success,
      };
    }
    if (health.status === 'UNVERIFIED') {
      return {
        label: 'UNVERIFIED',
        bg: colors.warningSoft,
        color: colors.warning,
      };
    }
    if (health.status === 'DEGRADED') {
      return {
        label: 'DEGRADED',
        bg: colors.warningSoft,
        color: colors.warning,
      };
    }
    return {
      label: 'DOWN',
      bg: colors.dangerSoft,
      color: colors.danger,
    };
  };

  const badge = getHealthBadge();

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
      {/* Left: Brand / Workbench Breadcrumb */}
      <View style={styles.leftCluster}>
        {onToggleSidebar && (
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
            onPress={onToggleSidebar}
            accessibilityLabel="Toggle navigation menu"
          >
            <Ionicons name="menu-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        <View style={[styles.logoBadge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        </View>

        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.portalTitle, { color: colors.textPrimary }]}>
              MloHub Governance
            </Text>
            {activeSectionTitle && !isCompact && (
              <>
                <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
                <Text style={[styles.breadcrumbCurrent, { color: colors.textSecondary }]}>
                  {activeSectionTitle}
                </Text>
              </>
            )}
          </View>
          <Text style={[styles.portalSubtitle, { color: colors.textMuted }]}>
            Platform Operations & Control Center
          </Text>
        </View>
      </View>

      {/* Right: [Backend Health] [Admin Identity] [Theme] [Refresh] [Preview Customer] [Logout] */}
      <View style={styles.controlsRow}>
        {/* Compact Backend Health Pill */}
        <View style={[styles.healthPill, { backgroundColor: badge.bg }]}>
          <View style={[styles.healthDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.healthLabel, { color: badge.color }]}>
            {isCompact ? badge.label : `BACKEND ${badge.label}`}
          </Text>
        </View>

        {/* Admin Identity */}
        {!isCompact && (
          <View
            style={[
              styles.userBadge,
              {
                backgroundColor: colors.surfaceInteractive,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.roleTag,
                {
                  backgroundColor: isSuperAdmin ? colors.primarySoft : colors.infoSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.roleTagText,
                  { color: isSuperAdmin ? colors.primary : colors.info },
                ]}
              >
                {isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}
              </Text>
            </View>
            <Text
              style={[styles.userName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {userName}
            </Text>
          </View>
        )}

        {/* Top-Right Theme Quick Switcher */}
        <ThemeQuickSwitcher />

        {/* Refresh */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={onRefresh}
          disabled={isRefreshing}
          accessibilityLabel="Refresh portal data"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
          )}
        </TouchableOpacity>

        {/* Preview Customer App */}
        <TouchableOpacity
          style={[
            styles.switchButton,
            {
              backgroundColor: colors.surfaceInteractive,
              borderColor: colors.border,
            },
          ]}
          onPress={handleSwitchToCustomer}
          accessibilityLabel="Preview customer app"
        >
          <Ionicons name="storefront-outline" size={15} color={colors.primary} />
          {!isCompact && (
            <Text style={[styles.switchButtonText, { color: colors.textPrimary }]}>
              Preview Customer
            </Text>
          )}
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: 'transparent',
            },
          ]}
          onPress={onLogout}
          accessibilityLabel="Log out of admin portal"
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  headerContainer: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  portalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  breadcrumbCurrent: {
    fontSize: 13,
    fontWeight: '600',
  },
  portalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 130,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
let styles = createStyles(lightColors);
