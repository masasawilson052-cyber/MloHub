import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { UserRole } from '../../db/types';

export type AdminTabId =
  | 'OVERVIEW'
  | 'APPLICATIONS'
  | 'RESTAURANTS'
  | 'VERIFICATION'
  | 'REPORTS'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'USERS'
  | 'ADMIN_USERS'
  | 'NOTIFICATIONS'
  | 'AUDIT_LOGS'
  | 'ANALYTICS'
  | 'HEALTH'
  | 'SETTINGS';

export interface AdminNavTab {
  id: AdminTabId;
  labelEn: string;
  labelSw: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
  superAdminOnly?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavTab[] = [
  { id: 'OVERVIEW', labelEn: 'Attention Center', labelSw: 'Kituo Kikuu', icon: 'speedometer-outline' },
  { id: 'APPLICATIONS', labelEn: 'Applications', labelSw: 'Maombi ya Migahawa', icon: 'document-text-outline' },
  { id: 'RESTAURANTS', labelEn: 'Restaurants', labelSw: 'Migahawa Yote', icon: 'restaurant-outline' },
  { id: 'VERIFICATION', labelEn: 'Verification & Freshness', labelSw: 'Uthibitisho & Ubora', icon: 'shield-checkmark-outline' },
  { id: 'REPORTS', labelEn: 'Customer Reports', labelSw: 'Ripoti za Wateja', icon: 'alert-circle-outline' },
  { id: 'ORDERS', labelEn: 'Orders Monitor', labelSw: 'Ufuatiliaji wa Oda', icon: 'cart-outline' },
  { id: 'PAYMENTS', labelEn: 'Payments (Read-Only)', labelSw: 'Malipo', icon: 'card-outline' },
  { id: 'USERS', labelEn: 'Users & Roles', labelSw: 'Watumiaji', icon: 'people-outline' },
  { id: 'ADMIN_USERS', labelEn: 'Admin Operators', labelSw: 'Wasimamizi Wakuu', icon: 'key-outline', superAdminOnly: true },
  { id: 'NOTIFICATIONS', labelEn: 'Announcements', labelSw: 'Matangazo', icon: 'megaphone-outline' },
  { id: 'AUDIT_LOGS', labelEn: 'Audit Trail', labelSw: 'Kumbukumbu ya Ulinzi', icon: 'list-outline' },
  { id: 'ANALYTICS', labelEn: 'Search & Demand', labelSw: 'Takwimu za Utafutaji', icon: 'trending-up-outline' },
  { id: 'HEALTH', labelEn: 'System Health', labelSw: 'Hali ya Mfumo', icon: 'pulse-outline' },
  { id: 'SETTINGS', labelEn: 'Platform Settings', labelSw: 'Mipangilio', icon: 'settings-outline' },
];

interface AdminSidebarProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  userRole?: UserRole | string;
  language?: 'en' | 'sw';
  badges?: {
    pendingApplications?: number;
    openReports?: number;
    staleMenus?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole = UserRole.ADMIN,
  language = 'en',
  badges = {},
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';

  return (
    <View style={styles.sidebar}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'sw' ? 'UDHIBITI WA MLOHUB' : 'PLATFORM GOVERNANCE'}
          </Text>
        </View>

        {ADMIN_NAV_ITEMS.map((item) => {
          if (item.superAdminOnly && !isSuperAdmin) {
            return null;
          }

          const isActive = activeTab === item.id;
          let badgeCount = 0;
          if (item.id === 'APPLICATIONS') badgeCount = badges.pendingApplications || 0;
          if (item.id === 'REPORTS') badgeCount = badges.openReports || 0;
          if (item.id === 'VERIFICATION') badgeCount = badges.staleMenus || 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => onSelectTab(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={isActive ? Colors.primary : '#64748b'}
                style={styles.navIcon}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
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
  sidebar: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  scrollContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: 3,
  },
  navItemActive: {
    backgroundColor: '#fff7ed',
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  navLabelActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDefault: {
    backgroundColor: '#fee2e2',
  },
  badgeActive: {
    backgroundColor: Colors.primary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextDefault: {
    color: '#b91c1c',
  },
  badgeTextActive: {
    color: '#ffffff',
  },
});
