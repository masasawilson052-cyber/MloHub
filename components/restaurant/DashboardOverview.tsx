import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { AttentionCenter, AttentionAlert } from './AttentionCenter';
import { RestaurantTab } from './RestaurantSidebar';

export interface DashboardMetrics {
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
  onQuickVerifyMenu: () => void;
  language?: 'en' | 'sw';
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  restaurantName,
  metrics,
  alerts,
  onNavigateTab,
  onQuickVerifyMenu,
  language = 'en',
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'sw' ? 'Habari za Asubuhi' : 'Good Morning';
    if (hour < 17) return language === 'sw' ? 'Habari za Mchana' : 'Good Afternoon';
    return language === 'sw' ? 'Habari za Jioni' : 'Good Evening';
  };

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
              : 'Here is your live operational overview and daily kitchen dispatch summary.'}
          </Text>
        </View>

        {/* Quick Verify Menu Action Button */}
        <TouchableOpacity
          style={styles.verifyActionBtn}
          onPress={onQuickVerifyMenu}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Verify Menu Prices Now"
        >
          <Ionicons name="shield-checkmark" size={18} color={Colors.white} />
          <Text style={styles.verifyActionBtnText}>
            {language === 'sw' ? 'Thibitisha Menyu Sasa' : 'Verify Menu Freshness'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Actionable Attention Center */}
      <AttentionCenter alerts={alerts} onNavigateTab={onNavigateTab} language={language} />

      {/* Operational Metrics Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>
          {language === 'sw' ? 'Viashiria vya Leo' : "Today's Operational Metrics"}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        {/* Metric 1: Incoming Orders */}
        <TouchableOpacity
          style={[styles.metricCard, metrics.openOrdersCount > 0 && styles.metricCardAlert]}
          onPress={() => onNavigateTab('orders')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Oda Mpya (Pending)' : 'Open Orders'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="receipt-outline" size={18} color="#D97706" />
            </View>
          </View>
          <Text style={[styles.metricValue, metrics.openOrdersCount > 0 && { color: '#B45309' }]}>
            {metrics.openOrdersCount}
          </Text>
          <Text style={styles.metricSub}>
            {metrics.openOrdersCount > 0
              ? language === 'sw' ? 'Zinahitaji uthibitisho wa jikoni' : 'Action required to accept'
              : language === 'sw' ? 'Hakuna zinazosubiri' : 'Queue is clear'}
          </Text>
        </TouchableOpacity>

        {/* Metric 2: Cooking Queue */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('kitchen')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Jikoni Zinapikwa' : 'Orders Cooking'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="flame-outline" size={18} color="#EA580C" />
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics.cookingOrdersCount}</Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Katika foleni ya jikoni' : 'In active kitchen queue'}
          </Text>
        </TouchableOpacity>

        {/* Metric 3: Reservations */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('reservations')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Meza za Leo' : "Today's Bookings"}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={18} color="#2563EB" />
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics.reservationsTodayCount}</Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Wateja wamehifadhi meza' : 'Confirmed table guests'}
          </Text>
        </TouchableOpacity>

        {/* Metric 4: Menu Verification */}
        <TouchableOpacity
          style={[styles.metricCard, metrics.itemsNeedingVerificationCount > 0 && styles.metricCardWarning]}
          onPress={() => onNavigateTab('menu')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Zinazotaka Uthibitisho' : 'Needs Verification'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#16A34A" />
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics.itemsNeedingVerificationCount}</Text>
          <Text style={styles.metricSub}>
            {metrics.itemsNeedingVerificationCount > 0
              ? language === 'sw' ? 'Vyakula vimezeeka, sasisha bei' : 'Dishes with aging prices'
              : language === 'sw' ? 'Bei zote ziko fresh leo' : 'All prices verified fresh'}
          </Text>
        </TouchableOpacity>

        {/* Metric 5: Revenue Today */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('earnings')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Mauzo ya Leo' : "Today's Sales"}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="cash-outline" size={18} color="#7E22CE" />
            </View>
          </View>
          <Text style={styles.metricValue}>{formatTzs(metrics.todaySalesTzs)}</Text>
          <Text style={styles.metricSub}>
            {language === 'sw' ? 'Kutoka kwa oda zilizokamilika' : 'From completed orders'}
          </Text>
        </TouchableOpacity>

        {/* Metric 6: Customer Reputation */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigateTab('reviews')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>
              {language === 'sw' ? 'Kiwango cha Ubora' : 'Customer Rating'}
            </Text>
            <View style={[styles.iconPill, { backgroundColor: '#FEF9C3' }]}>
              <Ionicons name="star" size={18} color="#CA8A04" />
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics.averageRating.toFixed(1)} ★</Text>
          <Text style={styles.metricSub}>
            {metrics.totalReviewsCount} {language === 'sw' ? 'maoni yaliyothibitishwa' : 'verified reviews'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  greetingCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.lg,
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
    color: Colors.textPrimary,
  },
  greetingName: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  greetingSubtitle: {
    ...Typography.Body,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  verifyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  verifyActionBtnText: {
    ...Typography.BodyMedium,
    color: Colors.white,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionHeading: {
    ...Typography.H3,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metricCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flex: 1,
    minWidth: 240,
    ...Shadows.sm,
  },
  metricCardAlert: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  metricCardWarning: {
    borderColor: '#BBF7D0',
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    ...Typography.Caption,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  metricSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
