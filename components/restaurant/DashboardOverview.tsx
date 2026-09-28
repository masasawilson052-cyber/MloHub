import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { AttentionCenter, AttentionAlert } from './AttentionCenter';
import { RestaurantTab } from './RestaurantSidebar';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface DashboardMetrics {
  ordersTodayCount?: number;
  foodSalesTzs?: number;
  restaurantNetTzs?: number;
  averagePrepTimeMinutes?: number;
  // Compatibility fields
  openOrdersCount: number;
  cookingOrdersCount: number;
  reservationsTodayCount: number;
  itemsNeedingVerificationCount: number;
  unavailableItemsCount: number;
  todaySalesTzs: number;
  averageRating: number;
  totalReviewsCount: number;
}

export interface DashboardOverviewProps {
  restaurantName: string;
  metrics: DashboardMetrics;
  alerts: AttentionAlert[];
  onNavigateTab: (tab: RestaurantTab) => void;
  onQuickVerifyMenu?: () => void;
  onPauseOrders?: () => void;
  onAddDish?: () => void;
  isOrdersPaused?: boolean;
  language?: 'en' | 'sw';
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  restaurantName,
  metrics,
  alerts,
  onNavigateTab,
  onQuickVerifyMenu,
  onPauseOrders,
  onAddDish,
  isOrdersPaused = false,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'sw' ? 'Habari za Asubuhi' : 'Good Morning';
    if (hour < 17) return language === 'sw' ? 'Habari za Mchana' : 'Good Afternoon';
    return language === 'sw' ? 'Habari za Jioni' : 'Good Evening';
  };

  const ordersToday = metrics.ordersTodayCount ?? metrics.openOrdersCount;
  const foodSales = metrics.foodSalesTzs ?? metrics.todaySalesTzs;
  const restaurantNet =
    metrics.restaurantNetTzs ?? Math.round((metrics.foodSalesTzs ?? metrics.todaySalesTzs) * 0.9);
  const prepTime = metrics.averagePrepTimeMinutes ?? 25;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {/* Operating Header Greeting */}
      <View style={styles.greetingCard}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greetingTitle}>
            {getGreeting()}, <Text style={styles.greetingName}>{restaurantName}</Text> 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            {language === 'sw'
              ? 'Huu ndio muhtasari wa uendeshaji wa mgahawa wako leo.'
              : 'Live operational summary, incoming orders, and kitchen dispatch.'}
          </Text>
        </View>

        {onQuickVerifyMenu && (
          <TouchableOpacity
            style={styles.verifyActionBtn}
            onPress={onQuickVerifyMenu}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Verify Menu Prices"
          >
            <Ionicons name="shield-checkmark" size={16} color={colors.onPrimary} />
            <Text style={styles.verifyActionBtnText}>
              {language === 'sw' ? 'Thibitisha Menyu' : 'Verify Menu Freshness'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 4 Canonical Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionHeading}>
          {language === 'sw' ? 'Hatua za Haraka' : 'Quick Actions'}
        </Text>
        <View style={styles.quickActionsRow}>
          {/* Action 1: Pause / Resume Orders */}
          <TouchableOpacity
            style={[
              styles.quickActionBtn,
              isOrdersPaused && { backgroundColor: colors.warningSoft, borderColor: colors.warning },
            ]}
            onPress={onPauseOrders || (() => onNavigateTab('settings'))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isOrdersPaused ? 'Resume Orders' : 'Pause Orders'}
          >
            <View
              style={[
                styles.quickActionIconWrap,
                { backgroundColor: isOrdersPaused ? colors.warningSoft : colors.primarySoft },
              ]}
            >
              <Ionicons
                name={isOrdersPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                size={18}
                color={isOrdersPaused ? colors.warning : colors.primary}
              />
            </View>
            <Text style={styles.quickActionLabel}>
              {isOrdersPaused
                ? language === 'sw' ? 'Endeleza Oda' : 'Resume Orders'
                : language === 'sw' ? 'Sitisha Oda' : 'Pause Orders'}
            </Text>
          </TouchableOpacity>

          {/* Action 2: Sold-out Items */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => onNavigateTab('menu')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sold-out Items"
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="cube-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.quickActionLabel}>
              {language === 'sw' ? 'Vyakula Vilivyoisha' : 'Sold-out Items'}
            </Text>
          </TouchableOpacity>

          {/* Action 3: Add Dish */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={onAddDish || (() => onNavigateTab('menu'))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add Dish"
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="add-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.quickActionLabel}>
              {language === 'sw' ? 'Ongeza Chakula' : 'Add Dish'}
            </Text>
          </TouchableOpacity>

          {/* Action 4: View Earnings */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => onNavigateTab('earnings')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="View Earnings"
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="cash-outline" size={18} color={colors.info} />
            </View>
            <Text style={styles.quickActionLabel}>
              {language === 'sw' ? 'Tazama Mapato' : 'View Earnings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Actionable Attention Center (Priorities 1 - 4) */}
      <AttentionCenter alerts={alerts} onNavigateTab={onNavigateTab} language={language} />

      {/* 4 Canonical Dashboard Metrics Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>
          {language === 'sw' ? 'Viashiria vya Leo' : "Today's Operational Metrics"}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        {/* Metric 1: Orders Today */}
        <TouchableOpacity
          style={[styles.metricCard, ordersToday > 0 && styles.metricCardAlert]}
          onPress={() => onNavigateTab('orders')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Oda za Leo' : 'Orders Today'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="receipt-outline" size={18} color={colors.warning} />
            </View>
          </View>
          <Text style={[styles.metricValue, ordersToday > 0 && { color: colors.warning }]}>
            {ordersToday}
          </Text>
          <Text style={styles.metricSub}>
            {ordersToday > 0
              ? language === 'sw' ? 'Oda zilizopokelewa leo' : 'Orders received today'
              : language === 'sw' ? 'Hakuna oda bado' : 'Queue is clear'}
          </Text>
        </TouchableOpacity>

        {/* Metric 2: Food Sales */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('earnings')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Mauzo ya Vyakula' : 'Food Sales'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.metricValue}>{formatTzs(foodSales)}</Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Jumla ya mauzo ya chakula leo' : 'Gross food billings today'}
          </Text>
        </TouchableOpacity>

        {/* Metric 3: Restaurant Net */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('earnings')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Kiasi Halisi cha Mgahawa' : 'Restaurant Net'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="cash-outline" size={18} color={colors.success} />
            </View>
          </View>
          <Text style={[styles.metricValue, { color: colors.success }]}>
            {formatTzs(restaurantNet)}
          </Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Malipo baada ya makato ya jukwaa' : 'Net payout after commission'}
          </Text>
        </TouchableOpacity>

        {/* Metric 4: Average Prep Time */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('kitchen')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Wastani wa Maandalizi' : 'Average Prep Time'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name="time-outline" size={18} color={colors.info} />
            </View>
          </View>
          <Text style={styles.metricValue}>{prepTime}m</Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Muda wa jikoni kuandaa mlo' : 'Target cooking elapsed time'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Secondary Status Badges: Kitchen cooking & reservations */}
      <View style={[styles.metricsGrid, { marginTop: Spacing.sm }]}>
        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => onNavigateTab('kitchen')}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryCardInner}>
            <Ionicons name="flame" size={16} color={colors.accent} />
            <Text style={styles.secondaryText}>
              {metrics.cookingOrdersCount} {language === 'sw' ? 'zinapikwa jikoni' : 'active cooking in kitchen'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => onNavigateTab('reservations')}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryCardInner}>
            <Ionicons name="calendar-outline" size={16} color={colors.info} />
            <Text style={styles.secondaryText}>
              {metrics.reservationsTodayCount} {language === 'sw' ? 'meza zilizohifadhiwa leo' : 'table bookings today'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => onNavigateTab('reviews')}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryCardInner}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.secondaryText}>
              {metrics.averageRating.toFixed(1)} ★ ({metrics.totalReviewsCount} {language === 'sw' ? 'maoni' : 'reviews'})
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollContainer: {
      padding: Spacing.md,
      maxWidth: 1000,
      width: '100%',
      alignSelf: 'center',
    },
    greetingCard: {
      backgroundColor: colors.card,
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: Spacing.md,
      ...Shadows.sm,
    },
    greetingLeft: {
      flex: 1,
      minWidth: 260,
    },
    greetingTitle: {
      ...Typography.H2,
      color: colors.textPrimary,
    },
    greetingName: {
      color: colors.primary,
      fontWeight: '800',
    },
    greetingSubtitle: {
      ...Typography.Body,
      color: colors.textSecondary,
      marginTop: 4,
    },
    verifyActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radii.md,
      ...Shadows.sm,
    },
    verifyActionBtnText: {
      ...Typography.Caption,
      color: colors.onPrimary,
      fontWeight: '700',
    },
    quickActionsSection: {
      marginBottom: Spacing.md,
    },
    quickActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    quickActionBtn: {
      flex: 1,
      minWidth: 140,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadows.sm,
    },
    quickActionIconWrap: {
      width: 32,
      height: 32,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionLabel: {
      ...Typography.Caption,
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 12,
    },
    sectionHeader: {
      marginBottom: Spacing.sm,
    },
    sectionHeading: {
      ...Typography.H3,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    metricCard: {
      backgroundColor: colors.card,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      flex: 1,
      minWidth: 200,
      ...Shadows.sm,
    },
    metricCardAlert: {
      borderColor: colors.warning,
      backgroundColor: colors.warningSoft,
    },
    metricTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    metricLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 12,
    },
    iconPill: {
      width: 32,
      height: 32,
      borderRadius: Radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      ...Typography.H1,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 22,
    },
    metricSub: {
      ...Typography.Caption,
      color: colors.textMuted,
      marginTop: 4,
    },
    secondaryCard: {
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flex: 1,
      minWidth: 180,
    },
    secondaryCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    secondaryText: {
      ...Typography.Caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });

let styles = createStyles(lightColors);
