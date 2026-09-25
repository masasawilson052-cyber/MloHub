import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole } from '../../db/types';
import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

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

export const ADMIN_NAV_ITEMS: AdminNavTab[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

interface AdminSidebarProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  userRole?: UserRole | string;
  language?: 'en' | 'sw';
  compact?: boolean;
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
  compact = false,
  badges = {},
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <View
      style={[
        styles.sidebar,
        compact && styles.sidebarCompact,
        {
          backgroundColor: colors.sidebarBackground,
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* Compact MloHub Governance Brand Header */}
      <View
        style={[
          styles.brandBlock,
          { borderBottomColor: colors.divider },
        ]}
      >
        <View style={[styles.brandIconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="layers" size={16} color={colors.primary} />
        </View>
        {!compact && (
          <View style={styles.brandTextWrap}>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>
              MloHub Console
            </Text>
            <Text style={[styles.brandSub, { color: colors.textMuted }]}>
              Governance & Operations
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ADMIN_NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <View
              key={section.titleEn}
              style={[
                styles.sectionBlock,
                sIdx > 0 && {
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                },
              ]}
            >
              {!compact && (
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    {language === 'sw' ? section.titleSw : section.titleEn}
                  </Text>
                </View>
              )}

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
                      compact && styles.navItemCompact,
                      isActive && {
                        backgroundColor: colors.navActiveBackground,
                      },
                    ]}
                    onPress={() => onSelectTab(item.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={item.labelEn}
                  >
                    {isActive && (
                      <View
                        style={[
                          styles.activeIndicator,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? colors.primary : colors.navText}
                      style={!compact ? styles.navIcon : undefined}
                    />
                    {!compact && (
                      <Text
                        style={[
                          styles.navLabel,
                          {
                            color: isActive ? colors.navActiveText : colors.navText,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {language === 'sw' ? item.labelSw : item.labelEn}
                      </Text>
                    )}
                    {!compact && badgeCount > 0 && (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isActive
                              ? colors.primary
                              : colors.dangerSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: isActive ? colors.card : colors.danger,
                            },
                          ]}
                        >
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  sidebar: {
    width: 244,
    borderRightWidth: 1,
  },
  sidebarCompact: {
    width: 68,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flex: 1,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  sectionBlock: {
    marginBottom: 10,
  },
  sectionHeader: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 9,
    marginBottom: 2,
    position: 'relative',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  navItemCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    flex: 1,
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
let styles = createStyles(lightColors);
