import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Restaurant } from '../../types/domain';
import { ReservationModal } from '../../components/ReservationModal';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { OrderTrackingTimeline } from '../../components/checkout/OrderTrackingTimeline';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PriceText } from '../../components/ui/PriceText';

type ActivityTab = 'ORDERS' | 'CUSTOM_MEALS' | 'RESERVATIONS';
type StatusFilter = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export default function BookingsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { orders, reservations, customOrders, restaurants, cancelReservation } = useMloHubDB();

  const [activeTab, setActiveTab] = useState<ActivityTab>('ORDERS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  const filteredOrders = orders.filter((o) => {
    const st = (o.status || '').toUpperCase();
    if (statusFilter === 'ACTIVE') {
      return st === 'PENDING' || st === 'ACCEPTED' || st === 'PREPARING' || st === 'READY';
    } else if (statusFilter === 'COMPLETED') {
      return st === 'COMPLETED';
    } else if (statusFilter === 'CANCELLED') {
      return st === 'CANCELLED' || st === 'REJECTED';
    }
    return false;
  });

  const filteredCustomOrders = customOrders.filter((o) => {
    const st = (o.status || '').toUpperCase();
    if (statusFilter === 'ACTIVE') {
      return st === 'PENDING' || st === 'ACCEPTED' || st === 'PREPARING' || st === 'READY' || st.includes('PENDING');
    } else if (statusFilter === 'COMPLETED') {
      return st === 'DELIVERED' || st === 'COMPLETED';
    } else if (statusFilter === 'CANCELLED') {
      return st === 'CANCELLED' || st === 'REJECTED';
    }
    return false;
  });

  const filteredReservations = reservations.filter((r) => {
    const st = (r.status || '').toLowerCase();
    if (statusFilter === 'ACTIVE') {
      return (
        st === 'pending' ||
        st === 'pending_restaurant_approval' ||
        st === 'awaiting_deposit' ||
        st === 'confirmed' ||
        st === 'seated'
      );
    } else if (statusFilter === 'COMPLETED') {
      return st === 'completed';
    } else if (statusFilter === 'CANCELLED') {
      return st === 'cancelled' || st === 'rejected' || st === 'no_show' || st === 'expired';
    }
    return false;
  });

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleDirections = (address: string) => {
    const encoded = encodeURIComponent(address + ', Dar es Salaam');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  const handleCancelBooking = (id: string) => {
    Alert.alert(
      language === 'sw' ? 'Sitisha Uhifadhi' : 'Cancel Reservation',
      language === 'sw'
        ? 'Je, una uhakika unataka kusitisha uhifadhi huu?'
        : 'Are you sure you want to cancel this table reservation?',
      [
        { text: language === 'sw' ? 'Hapana' : 'Keep', style: 'cancel' },
        {
          text: language === 'sw' ? 'Ndio, Sitisha' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelReservation(id);
              Alert.alert(
                language === 'sw' ? 'Uhifadhi Umesitishwa' : 'Reservation Cancelled',
                language === 'sw' ? 'Nafasi yako imesitishwa kikamilifu.' : 'Your reservation was cancelled successfully.'
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel reservation');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {language === 'sw' ? 'SHUGHULI ZAKO' : 'CUSTOMER ACTIVITY'}
          </Text>
          <Text style={styles.title}>
            {language === 'sw' ? 'Maagizo & Meza' : 'Orders & Reservations'}
          </Text>
        </View>

        {/* Primary Activity Tabs */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'ORDERS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('ORDERS')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'ORDERS' }}
          >
            <Ionicons
              name="fast-food-outline"
              size={16}
              color={activeTab === 'ORDERS' ? Colors.white : Colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'ORDERS' && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {language === 'sw' ? 'Maagizo' : 'Orders'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'CUSTOM_MEALS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('CUSTOM_MEALS')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'CUSTOM_MEALS' }}
          >
            <Ionicons
              name="restaurant-outline"
              size={16}
              color={activeTab === 'CUSTOM_MEALS' ? Colors.white : Colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'CUSTOM_MEALS' && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {language === 'sw' ? 'Maombi Maalum' : 'Custom Meals'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'RESERVATIONS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('RESERVATIONS')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'RESERVATIONS' }}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'RESERVATIONS' ? Colors.white : Colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.segmentText,
                activeTab === 'RESERVATIONS' && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {language === 'sw' ? 'Meza' : 'Bookings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <View style={styles.statusChipsRow}>
          {[
            { id: 'ACTIVE', label: language === 'sw' ? 'Yanayoendelea' : 'Active / Upcoming' },
            { id: 'COMPLETED', label: language === 'sw' ? 'Yaliyokamilika' : 'Completed' },
            { id: 'CANCELLED', label: language === 'sw' ? 'Yaliyositishwa' : 'Cancelled' },
          ].map((f) => {
            const isSelected = statusFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.statusChip, isSelected && styles.statusChipActive]}
                onPress={() => setStatusFilter(f.id as StatusFilter)}
                accessible={true}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.statusChipText,
                    isSelected && styles.statusChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CONTENT: STANDARD RESTAURANT ORDERS */}
        {activeTab === 'ORDERS' && (
          <View style={styles.contentSection}>
            {filteredOrders.map((order) => {
              const st = (order.status || '').toUpperCase();
              const isDelivered = st === 'COMPLETED';
              const isCancelled = st === 'CANCELLED' || st === 'REJECTED';
              const itemsSummary =
                order.items && order.items.length > 0
                  ? order.items.map((i) => `${i.quantity}x ${i.itemNameSnapshot}`).join(', ')
                  : order.specialInstructions || 'Standard Restaurant Order';

              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderHeaderLeft}>
                      <Text style={styles.orderIdText}>#{order.orderNumber || order.id.slice(0, 8)}</Text>
                      <Text style={styles.orderRestaurantName}>{order.restaurantName || 'Restaurant'}</Text>
                      <Text style={styles.orderDateText}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <Badge
                      label={order.status}
                      variant={isDelivered ? 'success' : isCancelled ? 'neutral' : 'warning'}
                      size="sm"
                    />
                  </View>

                  <Text style={styles.orderItemsText}>{itemsSummary}</Text>
                  <View style={styles.fulfillmentRow}>
                    <Text style={styles.fulfillmentTag}>
                      {order.fulfillmentType === 'Delivery' ? '🛵 Delivery' : order.fulfillmentType === 'Takeaway' ? '🥡 Takeaway' : '🍽️ Dine-In'}
                    </Text>
                    {order.fulfillmentType === 'Delivery' && order.deliveryAddress ? (
                      <Text style={styles.orderAddressText} numberOfLines={1}>📍 {order.deliveryAddress}</Text>
                    ) : null}
                  </View>

                  {/* Realtime Order Tracking Timeline */}
                  {!isDelivered && !isCancelled && (
                    <OrderTrackingTimeline
                      status={order.status}
                      estimatedMinutes={order.estimatedPrepMinutes}
                      style={{ marginTop: 12 }}
                    />
                  )}

                  <View style={styles.orderFooter}>
                    <View>
                      <Text style={styles.totalBillLabel}>Total</Text>
                      <PriceText amountTzs={order.totalTzs} size="md" color={Colors.primaryDark} />
                    </View>
                    <View style={styles.paymentStatusBadge}>
                      <Text style={styles.paymentStatusText}>
                        {order.paymentStatus === 'SUCCESS' ? 'PAID' : order.paymentStatus || 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {filteredOrders.length === 0 && (
              <EmptyState
                title={language === 'sw' ? 'Hakuna maagizo' : 'No orders found'}
                message={
                  statusFilter === 'ACTIVE'
                    ? (language === 'sw' ? 'Huna oda ya mgahawa inayoandaliwa sasa.' : "You don't have any restaurant orders in progress right now.")
                    : (language === 'sw' ? 'Hakuna maagizo yaliyopita kwenye historia yako.' : 'No past completed orders in your history.')
                }
                icon="fast-food-outline"
                actionTitle={language === 'sw' ? 'Agiza Chakula' : 'Order Food'}
                onAction={() => router.push('/(tabs)/explore')}
                style={styles.emptyStateContainer}
              />
            )}
          </View>
        )}

        {/* CONTENT: CUSTOM MEAL REQUESTS */}
        {activeTab === 'CUSTOM_MEALS' && (
          <View style={styles.contentSection}>
            {filteredCustomOrders.map((order) => {
              const st = (order.status || '').toUpperCase();
              const isDelivered = st === 'DELIVERED' || st === 'COMPLETED';
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderHeaderLeft}>
                      <Text style={styles.orderIdText}>#{order.orderNumber || order.id.slice(0, 8)}</Text>
                      <Text style={styles.orderRestaurantName}>{order.restaurantName || 'Custom Chef Request'}</Text>
                      <Text style={styles.orderDateText}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <Badge
                      label={isDelivered ? 'Delivered' : order.status}
                      variant={isDelivered ? 'neutral' : 'success'}
                      size="sm"
                    />
                  </View>

                  <Text style={styles.orderItemsText}>{order.dishName || order.specialInstructions || 'Meal Request'}</Text>
                  {order.deliveryAddress ? (
                    <Text style={styles.orderAddressText}>📍 {order.deliveryAddress}</Text>
                  ) : null}

                  <View style={styles.orderFooter}>
                    <View>
                      <Text style={styles.totalBillLabel}>Budget</Text>
                      <PriceText amountTzs={order.budgetTzs || order.quotedPriceTzs || 0} size="md" color={Colors.primaryDark} />
                    </View>
                    {order.customerPhone ? (
                      <TouchableOpacity
                        style={styles.callSupportBtn}
                        onPress={() => handleCall(order.customerPhone || '')}
                        accessible={true}
                        accessibilityRole="button"
                      >
                        <Ionicons name="call-outline" size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.callSupportText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {filteredCustomOrders.length === 0 && (
              <EmptyState
                title={language === 'sw' ? 'Hakuna maombi ya chakula' : 'No custom meal requests'}
                message={
                  statusFilter === 'ACTIVE'
                    ? (language === 'sw' ? 'Huna maombi maalum ya chakula yanayosubiriwa.' : "You don't have any custom meal requests being prepared right now.")
                    : (language === 'sw' ? 'Hakuna maombi yaliyopita kwenye historia yako.' : 'No past completed custom requests in your history.')
                }
                icon="restaurant-outline"
                actionTitle={language === 'sw' ? 'Omba Chakula Maalum' : 'Request Custom Meal'}
                onAction={() => router.push('/(tabs)/custom')}
                style={styles.emptyStateContainer}
              />
            )}
          </View>
        )}

        {/* CONTENT: TABLE RESERVATIONS */}
        {activeTab === 'RESERVATIONS' && (
          <View style={styles.contentSection}>
            {filteredReservations.map((b) => {
              const st = (b.status || '').toLowerCase();
              const isConfirmed = st === 'confirmed';
              const isPending = st === 'pending';
              const isCompleted = st === 'completed';
              return (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.emojiBadge}>
                      <Text style={styles.emoji}>🍽️</Text>
                    </View>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.restaurantName}>{b.restaurantName || 'Restaurant'}</Text>
                      <Text style={styles.addressText}>{b.specialNotes || b.address || 'Table Reservation'}</Text>
                    </View>
                    <Badge
                      label={isConfirmed ? 'Confirmed' : isPending ? 'Pending' : isCompleted ? 'Completed' : 'Cancelled'}
                      variant={isConfirmed ? 'success' : isPending ? 'warning' : 'neutral'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.bookingMeta}>
                    <Text style={styles.metaLabel}>
                      {t('timeLabel')}: <Text style={styles.metaVal}>{b.reservationDate} {b.timeSlot}</Text>
                    </Text>
                    <Text style={styles.metaLabel}>
                      {t('partyLabel')}: <Text style={styles.metaVal}>{b.guestsCount} {language === 'sw' ? 'Watu' : 'Guests'}</Text>
                    </Text>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.bookingActionsRow}>
                    {(isConfirmed || isPending) && (
                      <TouchableOpacity
                        style={[styles.actionPillBtn, styles.cancelPillBtn]}
                        onPress={() => handleCancelBooking(b.id)}
                      >
                        <Ionicons name="close-outline" size={14} color={Colors.error} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionPillText, styles.cancelPillText]}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {filteredReservations.length === 0 && (
              <EmptyState
                title={language === 'sw' ? 'Hakuna nafasi za meza' : 'No reservations found'}
                message={
                  statusFilter === 'ACTIVE'
                    ? (language === 'sw' ? 'Huna nafasi ya meza iliyohifadhiwa kwa sasa.' : "You don't have any active table reservations.")
                    : (language === 'sw' ? 'Hakuna nafasi za meza zilizopita.' : 'No past reservations in your history.')
                }
                icon="calendar-outline"
                actionTitle={language === 'sw' ? 'Weka Nafasi' : 'Book a Table'}
                onAction={() => router.push('/(tabs)/explore')}
                style={styles.emptyStateContainer}
              />
            )}

            {/* Instant New Booking Section */}
            <Text style={[styles.sectionHeading, { marginTop: Spacing.xl }]}>
              {t('bookNearbyHeading')}
            </Text>
            <View style={styles.restaurantList}>
              {restaurants && restaurants.length > 0 ? (
                restaurants.slice(0, 4).map((r) => (
                  <View key={r.id} style={styles.restaurantRow}>
                    <View style={styles.restaurantInfo}>
                      <Text style={styles.rName}>{r.emoji || '🍽️'} {r.name}</Text>
                      <Text style={styles.rSub}>{r.cuisine} • {r.distance || `${r.distanceKm || 0} km`}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.bookNowBtn}
                      onPress={() => setSelectedRestaurant(r as any)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.bookNowText}>{t('bookTableBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <EmptyState
                  title={language === 'sw' ? 'Hakuna migahawa' : 'No restaurants available'}
                  message={language === 'sw' ? 'Migahawa itaonekana hapa punde itakapoongezwa.' : 'Restaurants will appear here once added.'}
                  icon="restaurant-outline"
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <ReservationModal
        visible={selectedRestaurant !== null}
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  contentSection: {
    gap: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  orderRestaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  orderDateText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  orderItemsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  orderAddressText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  fulfillmentTag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceSecondary,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  timelineWrapper: {
    marginVertical: Spacing.md,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.xs,
  },
  totalBillLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  callSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
  },
  callSupportText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  emoji: {
    fontSize: 22,
  },
  bookingInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bookingMeta: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  metaVal: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  bookingActionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelPillBtn: {
    backgroundColor: Colors.errorLight,
  },
  cancelPillText: {
    color: Colors.error,
  },
  emptyStateContainer: {
    marginTop: Spacing.xl,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  restaurantList: {
    gap: Spacing.sm,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  restaurantInfo: {
    flex: 1,
  },
  rName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bookNowBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.sm,
  },
  bookNowText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
});
