import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii } from '../../constants/theme';
import { UserRole } from '../../db/types';
import { AdminTabId, ADMIN_NAV_ITEMS } from './AdminSidebar';
import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface AdminMobileNavProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  userRole?: UserRole | string;
  language?: 'en' | 'sw';
  badges?: {
    pendingApplications?: number;
    openReports?: number;
    staleMenus?: number;
    criticalAttention?: number;
    pendingRefunds?: number;
    pendingSettlements?: number;
  };
}

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({
  activeTab,
  onSelectTab,
  userRole = UserRole.ADMIN,
  language = 'en',
  badges = {},
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.topbarBackground,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          if (item.superAdminOnly && !isSuperAdmin) return null;

          const isActive = activeTab === item.id;
          let badgeCount = 0;
          if (item.id === 'OVERVIEW') badgeCount = badges.criticalAttention || 0;
          if (item.id === 'APPLICATIONS') badgeCount = badges.pendingApplications || 0;
          if (item.id === 'REPORTS') badgeCount = badges.openReports || 0;
          if (item.id === 'VERIFICATION') badgeCount = badges.staleMenus || 0;
          if (item.id === 'REFUNDS') badgeCount = badges.pendingRefunds || 0;
          if (item.id === 'SETTLEMENTS') badgeCount = badges.pendingSettlements || 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.surfaceInteractive,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelectTab(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isActive ? colors.card : colors.textSecondary}
                style={styles.icon}
              />
              <Text
                style={[
                  styles.label,
                  { color: isActive ? colors.card : colors.textSecondary },
                ]}
              >
                {language === 'sw' ? item.labelSw : item.labelEn}
              </Text>
              {badgeCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive ? colors.card : colors.dangerSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isActive ? colors.primary : colors.danger },
                    ]}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
