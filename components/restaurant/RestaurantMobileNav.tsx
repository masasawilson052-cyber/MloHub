import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { RestaurantRole } from '../../types/auth';
import { RestaurantTab, RESTAURANT_NAV_ITEMS } from './RestaurantSidebar';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const visibleItems = RESTAURANT_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <View
      style={[
        styles.navContainer,
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
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          let badge = 0;
          if (item.id === 'orders') badge = orderBadgeCount;
          if (item.id === 'kitchen') badge = kitchenBadgeCount;
          if (item.id === 'reservations') badge = reservationBadgeCount;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: isActive
                    ? colors.primarySoft
                    : colors.surfaceInteractive,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelectTab(item.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={language === 'sw' ? item.labelSw : item.label}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={isActive ? colors.primary : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? '700' : '600',
                  },
                ]}
              >
                {language === 'sw' ? item.labelSw : item.label}
              </Text>
              {badge > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : colors.textMuted,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  navContainer: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    minHeight: 38,
  },
  tabText: {
    fontSize: 12,
  },
  badge: {
    borderRadius: Radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
