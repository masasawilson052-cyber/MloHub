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
import { Spacing } from '../../theme/spacing';
import { RestaurantRole } from '../../types/auth';
import { useTheme } from '../../context/ThemeContext';

export { RestaurantTab, NavItemConfig, RESTAURANT_NAV_ITEMS } from '../../constants/restaurantPortal';
import { RestaurantTab, RESTAURANT_NAV_ITEMS, NavItemConfig } from '../../constants/restaurantPortal';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface RestaurantNavGroup {
  titleEn: string;
  titleSw: string;
  tabIds: RestaurantTab[];
}

export const RESTAURANT_NAV_GROUPS: RestaurantNavGroup[] = [
  {
    titleEn: 'OPERATIONS',
    titleSw: 'UENDESHAJI',
    tabIds: ['overview', 'orders', 'kitchen'],
  },
  {
    titleEn: 'CATALOG',
    titleSw: 'ORODHA YA VYAKULA',
    tabIds: ['menu', 'custom-meals'],
  },
  {
    titleEn: 'CUSTOMERS',
    titleSw: 'WATEJA',
    tabIds: ['reservations', 'reviews'],
  },
  {
    titleEn: 'BUSINESS',
    titleSw: 'BIASHARA & MAPATO',
    tabIds: ['earnings', 'analytics'],
  },
  {
    titleEn: 'TEAM & STORE',
    titleSw: 'TIMU & DUKA',
    tabIds: ['staff', 'settings'],
  },
];

export interface RestaurantSidebarProps {
  activeTab: RestaurantTab;
  onSelectTab: (tab: RestaurantTab) => void;
  userRole: RestaurantRole;
  language?: 'en' | 'sw';
  orderBadgeCount?: number;
  kitchenBadgeCount?: number;
  reservationBadgeCount?: number;
}

export const RestaurantSidebar: React.FC<RestaurantSidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  language = 'en',
  orderBadgeCount = 0,
  kitchenBadgeCount = 0,
  reservationBadgeCount = 0,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  const itemMap = new Map<RestaurantTab, NavItemConfig>();
  for (const item of RESTAURANT_NAV_ITEMS) {
    if (item.allowedRoles.includes(userRole)) {
      itemMap.set(item.id, item);
    }
  }

  return (
    <View
      style={[
        styles.sidebarContainer,
        {
          backgroundColor: colors.sidebarBackground,
          borderRightColor: colors.border,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {RESTAURANT_NAV_GROUPS.map((group, gIdx) => {
          const groupItems = group.tabIds
            .map((id) => itemMap.get(id))
            .filter((item): item is NavItemConfig => Boolean(item));

          if (groupItems.length === 0) return null;

          return (
            <View
              key={group.titleEn}
              style={[
                styles.groupBlock,
                gIdx > 0 && {
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {language === 'sw' ? group.titleSw : group.titleEn}
                </Text>
              </View>

              {groupItems.map((item) => {
                const isActive = activeTab === item.id;
                let badge = 0;
                if (item.id === 'orders') badge = orderBadgeCount;
                if (item.id === 'kitchen') badge = kitchenBadgeCount;
                if (item.id === 'reservations') badge = reservationBadgeCount;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.navItem,
                      isActive && {
                        backgroundColor: colors.navActiveBackground,
                      },
                    ]}
                    onPress={() => onSelectTab(item.id)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={language === 'sw' ? item.labelSw : item.label}
                  >
                    {isActive && (
                      <View
                        style={[
                          styles.activeBar,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                    <View style={styles.navItemLeft}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={isActive ? colors.primary : colors.navText}
                        style={styles.navIcon}
                      />
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
                        {language === 'sw' ? item.labelSw : item.label}
                      </Text>
                    </View>

                    {badge > 0 && (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isActive
                              ? colors.primary
                              : colors.surfaceInteractive,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: isActive ? colors.card : colors.textSecondary,
                            },
                          ]}
                        >
                          {badge > 99 ? '99+' : badge}
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

      {/* Footer Role Notice */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.divider,
            backgroundColor: colors.surfaceMuted,
          },
        ]}
      >
        <Text style={[styles.footerRoleText, { color: colors.textSecondary }]}>
          Role:{' '}
          <Text style={[styles.footerRoleBold, { color: colors.primary }]}>
            {userRole}
          </Text>
        </Text>
        <Text style={[styles.footerSecurityText, { color: colors.textMuted }]}>
          Merchant Operations Workbench
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  sidebarContainer: {
    width: 240,
    borderRightWidth: 1,
    height: '100%',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  groupBlock: {
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
    justifyContent: 'space-between',
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 9,
    marginBottom: 2,
    position: 'relative',
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
    }),
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  footerRoleText: {
    fontSize: 11,
  },
  footerRoleBold: {
    fontWeight: '700',
  },
  footerSecurityText: {
    fontSize: 10,
    marginTop: 2,
  },
});
let styles = createStyles(lightColors);
