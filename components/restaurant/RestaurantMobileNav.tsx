import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { RestaurantRole } from '../../types/auth';
import { RestaurantTab, RESTAURANT_NAV_ITEMS } from './RestaurantSidebar';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export const RESTAURANT_MOBILE_PRIMARY = ['overview', 'orders', 'kitchen', 'menu'] as const;

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
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isSecondaryActive = !(RESTAURANT_MOBILE_PRIMARY as readonly string[]).includes(activeTab);

  const primaryItems = [
    {
      id: 'overview' as RestaurantTab,
      label: 'Home',
      labelSw: 'Nyumbani',
      icon: 'grid-outline' as const,
      badge: 0,
    },
    {
      id: 'orders' as RestaurantTab,
      label: 'Orders',
      labelSw: 'Oda',
      icon: 'receipt-outline' as const,
      badge: orderBadgeCount,
    },
    {
      id: 'kitchen' as RestaurantTab,
      label: 'Kitchen',
      labelSw: 'Jikoni',
      icon: 'flame-outline' as const,
      badge: kitchenBadgeCount,
    },
    {
      id: 'menu' as RestaurantTab,
      label: 'Menu',
      labelSw: 'Menyu',
      icon: 'restaurant-outline' as const,
      badge: 0,
    },
  ];

  const secondaryItems = RESTAURANT_NAV_ITEMS.filter(
    (item) =>
      !(RESTAURANT_MOBILE_PRIMARY as readonly string[]).includes(item.id) &&
      item.allowedRoles.includes(userRole)
  );

  const moreBadge = reservationBadgeCount;

  return (
    <>
      <View
        style={[
          styles.navContainer,
          {
            backgroundColor: colors.topbarBackground,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.primaryRow}>
          {primaryItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.primaryTab,
                  isActive && {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => onSelectTab(item.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={language === 'sw' ? item.labelSw : item.label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  {item.badge > 0 && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isActive ? colors.primary : colors.accent,
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: isActive ? colors.primary : colors.textSecondary,
                      fontWeight: isActive ? '700' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {language === 'sw' ? item.labelSw : item.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* 5th Tab: More Button */}
          <TouchableOpacity
            style={[
              styles.primaryTab,
              isSecondaryActive && {
                backgroundColor: colors.primarySoft,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => setIsMoreOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: isSecondaryActive }}
            accessibilityLabel={language === 'sw' ? 'Zaidi' : 'More'}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name="ellipsis-horizontal-circle-outline"
                size={18}
                color={isSecondaryActive ? colors.primary : colors.textSecondary}
              />
              {moreBadge > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isSecondaryActive ? colors.primary : colors.accent,
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {moreBadge > 99 ? '99+' : moreBadge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.primaryLabel,
                {
                  color: isSecondaryActive ? colors.primary : colors.textSecondary,
                  fontWeight: isSecondaryActive ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {language === 'sw' ? 'Zaidi' : 'More'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* More Operations Sheet / Modal */}
      <Modal
        visible={isMoreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMoreOpen(false)}
        >
          <View
            style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="grid-outline" size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>
                  {language === 'sw' ? 'Uendeshaji wa Mgahawa' : 'Restaurant Operations'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsMoreOpen(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
              {secondaryItems.map((item) => {
                const isActive = activeTab === item.id;
                let badge = 0;
                if (item.id === 'reservations') badge = reservationBadgeCount;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.sheetItem,
                      {
                        backgroundColor: isActive ? colors.primarySoft : colors.surfaceInteractive,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      onSelectTab(item.id);
                      setIsMoreOpen(false);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={styles.sheetItemLeft}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.sheetItemText,
                          {
                            color: isActive ? colors.primary : colors.textPrimary,
                            fontWeight: isActive ? '700' : '600',
                          },
                        ]}
                      >
                        {language === 'sw' ? item.labelSw : item.label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {badge > 0 && (
                        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.badgeText}>{badge}</Text>
                        </View>
                      )}
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={isActive ? colors.primary : colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    navContainer: {
      borderTopWidth: 1,
      paddingVertical: 6,
      paddingBottom: 10,
      paddingHorizontal: 8,
    },
    primaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      gap: 6,
    },
    primaryTab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 46,
    },
    iconWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    primaryLabel: {
      fontSize: 11,
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -10,
      borderRadius: Radii.full,
      paddingHorizontal: 4,
      paddingVertical: 1,
      minWidth: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      borderWidth: 1,
      borderBottomWidth: 0,
      padding: Spacing.md,
      maxHeight: '75%',
      ...Shadows.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      marginBottom: Spacing.sm,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      ...Typography.H3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    closeBtn: {
      padding: 4,
    },
    sheetList: {
      gap: 8,
      paddingVertical: Spacing.xs,
    },
    sheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    sheetItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sheetItemText: {
      ...Typography.Body,
      fontSize: 14,
    },
  });

let styles = createStyles(lightColors);
