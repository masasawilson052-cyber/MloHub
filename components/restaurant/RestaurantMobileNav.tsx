import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { RestaurantRole } from '../../types/auth';
import { RestaurantTab, RESTAURANT_NAV_ITEMS } from './RestaurantSidebar';

export interface RestaurantMobileNavProps {
  activeTab: RestaurantTab;
  onSelectTab: (tab: RestaurantTab) => void;
  userRole: RestaurantRole;
  language?: 'en' | 'sw';
  orderBadgeCount?: number;
  kitchenBadgeCount?: number;
  reservationBadgeCount?: number;
}

export const RestaurantMobileNav: React.FC<RestaurantMobileNavProps> = ({
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
    <View style={styles.navContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          let badge = 0;
          if (item.id === 'orders') badge = orderBadgeCount;
          if (item.id === 'kitchen') badge = kitchenBadgeCount;
          if (item.id === 'reservations') badge = reservationBadgeCount;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => onSelectTab(item.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={language === 'sw' ? item.labelSw : item.label}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={isActive ? Colors.primaryDark : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {language === 'sw' ? item.labelSw : item.label}
              </Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    minHeight: 40,
  },
  tabBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabText: {
    ...Typography.Caption,
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.textSecondary,
    borderRadius: Radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeActive: {
    backgroundColor: Colors.primaryDark,
  },
  badgeText: {
    ...Typography.Caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  badgeTextActive: {
    color: Colors.white,
  },
});
