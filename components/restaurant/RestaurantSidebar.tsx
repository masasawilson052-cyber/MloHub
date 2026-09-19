import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { RestaurantRole } from '../../types/auth';

export { RestaurantTab, NavItemConfig, RESTAURANT_NAV_ITEMS } from '../../constants/restaurantPortal';
import { RestaurantTab, RESTAURANT_NAV_ITEMS } from '../../constants/restaurantPortal';

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
  const visibleItems = RESTAURANT_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <View style={styles.sidebarContainer}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {language === 'sw' ? 'UENDESHAJI WA MGAHAWA' : 'RESTAURANT OPS'}
          </Text>
        </View>

        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          let badge = 0;
          if (item.id === 'orders') badge = orderBadgeCount;
          if (item.id === 'kitchen') badge = kitchenBadgeCount;
          if (item.id === 'reservations') badge = reservationBadgeCount;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => onSelectTab(item.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={language === 'sw' ? item.labelSw : item.label}
            >
              <View style={styles.navItemLeft}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? Colors.primaryDark : Colors.textSecondary}
                  style={styles.navIcon}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {language === 'sw' ? item.labelSw : item.label}
                </Text>
              </View>

              {badge > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer Role Notice */}
      <View style={styles.footer}>
        <Text style={styles.footerRoleText}>
          Role: <Text style={styles.footerRoleBold}>{userRole}</Text>
        </Text>
        <Text style={styles.footerSecurityText}>Stage 3 RLS Protected</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    height: '100%',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.Caption,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: 4,
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: Colors.primaryMuted,
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    marginRight: Spacing.sm,
  },
  navLabel: {
    ...Typography.BodyMedium,
    fontSize: 13.5,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  navLabelActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  badgeActive: {
    backgroundColor: Colors.primaryDark,
  },
  badgeText: {
    ...Typography.Caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  badgeTextActive: {
    color: Colors.white,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surfaceSecondary,
  },
  footerRoleText: {
    ...Typography.Caption,
    color: Colors.textSecondary,
  },
  footerRoleBold: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  footerSecurityText: {
    ...Typography.Caption,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
