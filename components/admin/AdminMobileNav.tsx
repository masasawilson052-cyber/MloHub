import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { UserRole } from '../../db/types';
import { AdminTabId, ADMIN_NAV_ITEMS } from './AdminSidebar';

import { useTheme } from '../../context/ThemeContext';

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
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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
                { backgroundColor: isDark ? colors.card : '#f8fafc', borderColor: colors.border },
                isActive && styles.pillActive,
              ]}
              onPress={() => onSelectTab(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={isActive ? '#ffffff' : isDark ? colors.textSecondary : '#64748b'}
                style={styles.icon}
              />
              <Text
                style={[
                  styles.label,
                  { color: isDark ? colors.text : '#475569' },
                  isActive && styles.labelActive,
                ]}
              >
                {language === 'sw' ? item.labelSw : item.labelEn}
              </Text>
              {badgeCount > 0 && (
                <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeDefault]}>
                  <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextDefault]}>
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


const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  labelActive: {
    color: '#ffffff',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  badgeDefault: {
    backgroundColor: '#fee2e2',
  },
  badgeActive: {
    backgroundColor: '#ffffff',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextDefault: {
    color: '#b91c1c',
  },
  badgeTextActive: {
    color: Colors.primary,
  },
});
