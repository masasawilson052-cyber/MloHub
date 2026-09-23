import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { UserRole } from '../../db/types';
import { useTheme } from '../../context/ThemeContext';

export type AdminTabId =
  | 'OVERVIEW'
  | 'ORDERS'
  | 'APPLICATIONS'
  | 'RESTAURANTS'
  | 'VERIFICATION'
  | 'REPORTS'
  | 'PAYMENTS'
  | 'REFUNDS'
  | 'SETTLEMENTS'
  | 'ANALYTICS'
  | 'NOTIFICATIONS'
  | 'USERS'
  | 'ADMIN_USERS'
  | 'AUDIT_LOGS'
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

export interface AdminNavSection {
  titleEn: string;
  titleSw: string;
  items: AdminNavTab[];
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    titleEn: 'OPERATIONS',
    titleSw: 'UENDESHAJI',
    items: [
      { id: 'OVERVIEW', labelEn: 'Attention Center', labelSw: 'Kituo Kikuu', icon: 'speedometer-outline' },
      { id: 'ORDERS', labelEn: 'Orders Monitor', labelSw: 'Ufuatiliaji wa Oda', icon: 'cart-outline' },
    ],
  },
  {
    titleEn: 'MARKETPLACE GOVERNANCE',
    titleSw: 'UDHIBITI WA SOKO',
    items: [
      { id: 'APPLICATIONS', labelEn: 'Applications', labelSw: 'Maombi ya Migahawa', icon: 'document-text-outline' },
      { id: 'RESTAURANTS', labelEn: 'Restaurants', labelSw: 'Migahawa Yote', icon: 'restaurant-outline' },
      { id: 'VERIFICATION', labelEn: 'Verification & Freshness', labelSw: 'Uthibitisho & Ubora', icon: 'shield-checkmark-outline' },
      { id: 'REPORTS', labelEn: 'Customer Reports', labelSw: 'Ripoti za Wateja', icon: 'alert-circle-outline' },
    ],
  },
  {
    titleEn: 'FINANCE & PAYOUTS',
    titleSw: 'FEDHA & MALIPO',
    items: [
      { id: 'PAYMENTS', labelEn: 'Payments Monitor', labelSw: 'Malipo ya Wateja', icon: 'card-outline' },
      { id: 'REFUNDS', labelEn: 'Refunds & Disputes', labelSw: 'Marejesho & Migogoro', icon: 'repeat-outline' },
      { id: 'SETTLEMENTS', labelEn: 'Settlements & Payouts', labelSw: 'Malipo ya Migahawa', icon: 'wallet-outline' },
    ],
  },
  {
    titleEn: 'GROWTH & INTELLIGENCE',
    titleSw: 'UKUAJI & TAKWIMU',
    items: [
      { id: 'ANALYTICS', labelEn: 'Search & Demand', labelSw: 'Takwimu za Utafutaji', icon: 'trending-up-outline' },
      { id: 'NOTIFICATIONS', labelEn: 'Announcements', labelSw: 'Matangazo ya Jukwaa', icon: 'megaphone-outline' },
    ],
  },
  {
    titleEn: 'SYSTEM & GOVERNANCE',
    titleSw: 'MFUMO & USALAMA',
    items: [
      { id: 'USERS', labelEn: 'Users & Roles', labelSw: 'Watumiaji & Majukumu', icon: 'people-outline' },
      { id: 'ADMIN_USERS', labelEn: 'Admin Operators', labelSw: 'Wasimamizi Wakuu', icon: 'key-outline', superAdminOnly: true },
      { id: 'AUDIT_LOGS', labelEn: 'Audit Trail', labelSw: 'Kumbukumbu ya Ulinzi', icon: 'list-outline' },
      { id: 'HEALTH', labelEn: 'System Health', labelSw: 'Hali ya Mfumo', icon: 'pulse-outline' },
      { id: 'SETTINGS', labelEn: 'Platform Settings', labelSw: 'Mipangilio ya Jukwaa', icon: 'settings-outline' },
    ],
  },
];

// Flat list for callers that expect ADMIN_NAV_ITEMS
export const ADMIN_NAV_ITEMS: AdminNavTab[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

interface AdminSidebarProps {
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

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole = UserRole.ADMIN,
  language = 'en',
  badges = {},
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {ADMIN_NAV_SECTIONS.map((section, sIdx) => {
          // Filter items based on permissions
          const visibleItems = section.items.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <View key={section.titleEn} style={[styles.sectionBlock, sIdx > 0 && styles.sectionBorderTop]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {language === 'sw' ? section.titleSw : section.titleEn}
                </Text>
              </View>

              {visibleItems.map((item) => {
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
                      styles.navItem,
                      isActive && {
                        backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#fff7ed',
                        borderColor: isDark ? 'rgba(234, 88, 12, 0.3)' : '#fed7aa',
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => onSelectTab(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? Colors.primary : isDark ? '#94a3b8' : '#64748b'}
                      style={styles.navIcon}
                    />
                    <Text
                      style={[
                        styles.navLabel,
                        { color: isDark ? colors.text : '#475569' },
                        isActive && styles.navLabelActive,
                      ]}
                      numberOfLines={1}
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
            </View>
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  sectionBlock: {
    marginBottom: Spacing.sm,
  },
  sectionBorderTop: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sectionHeader: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
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

